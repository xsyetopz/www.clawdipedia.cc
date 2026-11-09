import {
	mintJwt,
	startGateway,
	startSts,
	startUpstream,
	withPostgres,
} from "../../../lib/gateway.ts";
import { allocPort } from "../../../lib/ports.ts";
import type { Data } from "../../../lib/results.ts";
import { makeSandbox, type Sandbox } from "../../../lib/sandbox.ts";
import { obj } from "../run.ts";
import { type CaseDef, olderThan, type Out } from "../run/helpers.ts";
import type { PrintCtx } from "../types.ts";

export const REQ_TAGS = "request-tags-2026-08-21";

type Up = ReturnType<typeof startUpstream>;
type Sts = Awaited<ReturnType<typeof startSts>>;
type Gateway = Awaited<ReturnType<typeof startGateway>>;

export interface Live {
	url: string;
	up: Up;
	log: () => string;
	sts: Sts | null;
}

/** The plain one-message body that the gateway cases send. */
export const MESSAGE = JSON.stringify({
	model: "claude-sonnet-5-5",
	max_tokens: 1,
	messages: [{ role: "user", content: "Reply with 'OK'." }],
});

/** The JSON object of a reply, or `{}` when the body is not JSON. */
export const jsonOf = async (r: Response): Promise<Record<string, unknown>> =>
	obj(await r.json().catch(() => ({})));

export const none = (): Promise<Record<string, Data>> => Promise.resolve({});

export interface GwOpts {
	tag?: boolean;
	pg?: boolean;
	retention?: number | string;
	upstreams?: (url: string) => string;
	/** Reports the boot only: whether the gateway listens, its exit code and the first log line that matches. */
	boot?: RegExp;
	/** The stub STS: it answers ("ok"), answers AccessDenied ("denied"), or the proxy to it is a closed port ("down"). */
	sts?: "ok" | "denied" | "down";
	/** The first version with the options of the case: an older program may refuse the config. */
	since?: string;
}

/** On a program older than the options of the case, a gateway that exits on its own config check gave an answer. Any other failed start makes the case invalid. */
const refused = async (
	g: Gateway,
	older: boolean,
): Promise<Record<string, Data>> => {
	const exitCode = await Promise.race([
		g.exit(),
		Bun.sleep(1000).then(() => null),
	]);
	const line = /claude gateway: .*/u.exec(
		g.log().replaceAll(/\s+/gu, " "),
	)?.[0];
	if (!older || exitCode === null || line === undefined) {
		throw new Error("gateway did not start");
	}
	return { started: false, exitCode, refusal: line.slice(0, 400) };
};

const bootReport = async (
	g: Gateway,
	boot: RegExp,
): Promise<Record<string, Data>> => {
	const listening = await g.ready();
	await Bun.sleep(300);
	const text = g.log().replaceAll(/\s+/gu, " ");
	const at = text.search(boot);
	const hit = at < 0 ? undefined : text.slice(Math.max(0, at - 300), at + 500);
	return {
		listening,
		exitCode: listening ? null : await g.exit(),
		line: hit ?? null,
	};
};

const noPostgres = async (g: Gateway): Promise<Record<string, Data>> => {
	const code = await Promise.race([
		g.exit(),
		Bun.sleep(60_000).then(() => null),
	]);
	return {
		exitCode: code,
		connectError: g.log().includes("could not connect to Postgres"),
		listening: g.log().includes("listening on"),
	};
};

interface Env {
	ctx: PrintCtx;
	sb: Sandbox;
	up: Up;
	sts: Sts | null;
}

type Calls = (g: Live) => Promise<Record<string, Data>>;

const withGateway = async (
	e: Env,
	o: GwOpts,
	calls: Calls,
	pgPort: number,
): Promise<Out> => {
	const g = await startGateway(e.ctx.bin, e.sb, {
		...(e.sts === null ? {} : { env: e.sts.env }),
		upstream: e.up.url,
		pgPort,
		billingGroupTag: o.tag ?? false,
		...(o.retention === undefined
			? {}
			: { identityRetentionDays: o.retention }),
		...(o.upstreams === undefined ? {} : { upstreams: o.upstreams(e.up.url) }),
	});
	try {
		if (o.boot !== undefined) {
			return { data: await bootReport(g, o.boot) };
		}
		if (o.pg === false) {
			return { data: await noPostgres(g) };
		}
		if (!(await g.ready())) {
			const older = o.since !== undefined && olderThan(e.ctx, o.since);
			return { data: await refused(g, older) };
		}
		return {
			data: await calls({ url: g.url, up: e.up, log: g.log, sts: e.sts }),
		};
	} finally {
		await g.stop();
	}
};

/** One `claude gateway` run on a Postgres container and a stub upstream. `calls` sends requests and returns booleans and statuses. */
export const gatewayCase = (
	name: string,
	o: GwOpts,
	calls: Calls,
): CaseDef => ({
	name: `gateway.${name}`,
	run: async (ctx) => {
		const sb = await makeSandbox();
		const up = startUpstream();
		const sts =
			o.sts === "ok" || o.sts === "denied" ? await startSts(o.sts) : null;
		const go = (pgPort: number) =>
			withGateway({ ctx, sb, up, sts }, o, calls, pgPort);
		try {
			return await (o.pg === false ? go(await allocPort()) : withPostgres(go));
		} finally {
			await up.stop();
			await sts?.stop();
			await sb.cleanup();
		}
	},
});

/** POST /v1/messages through the gateway; reports what the upstream saw as booleans. */
export const viaGateway = async (
	g: Live,
	tags: unknown,
	groups: string[],
): Promise<Record<string, Data>> => {
	g.up.seen.length = 0;
	const r = await fetch(`${g.url}/v1/messages`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"anthropic-beta": `${REQ_TAGS},prompt-caching-scope-2026-01-05`,
			authorization: `Bearer ${mintJwt({ sub: "u1", email: "u@example.com", groups })}`,
		},
		body: JSON.stringify({
			...obj(JSON.parse(MESSAGE)),
			...(tags === undefined ? {} : { tags }),
		}),
	});
	const u = g.up.seen[0];
	return {
		status: r.status,
		upstreamCalls: g.up.seen.length,
		upstreamTags: u?.tags ?? null,
		upstreamRequestTagsBeta: u?.betas.includes(REQ_TAGS) ?? null,
		upstreamOtherBetaKept:
			u?.betas.includes("prompt-caching-scope-2026-01-05") ?? null,
	};
};

export const prefixed = (
	p: string,
	d: Record<string, Data>,
): Record<string, Data> =>
	Object.fromEntries(Object.entries(d).map(([k, v]) => [`${p}.${k}`, v]));
