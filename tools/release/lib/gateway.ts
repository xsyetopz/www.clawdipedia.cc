// Helpers for the `claude gateway` probes: a Postgres container, a stub upstream, an HS256 session token and the gateway process.
// The secrets below are fixed fakes. The gateway needs Postgres (it has no dev store), so Docker is required.
import { createHash, createHmac } from "node:crypto";

import { childEnv } from "./env.ts";
import { startMitm } from "./mitm.ts";
import { allocPort } from "./ports.ts";
import { registerPid } from "./proc.ts";
import type { Sandbox } from "./sandbox.ts";

// The probes import the Postgres helpers from here with the rest of the gateway helpers.
export { requireDocker, withPostgres } from "./postgres.ts";

export const GATEWAY_SECRET = "gateway-probe-fake-secret-0123456789abcdef";
export const ADMIN_READ_KEY = "gateway-probe-fake-read-key-0123456789abcdef";

const b64 = (x: string) => Buffer.from(x).toString("base64url");

/** The bearer token the gateway verifies: HS256, `kid` = first 8 bytes of sha256(secret) in hex, `aud` "claude-gateway". */
export const mintJwt = (
	claims: Record<string, unknown>,
	secret = GATEWAY_SECRET,
	now = Math.floor(Date.now() / 1000),
): string => {
	const kid = createHash("sha256")
		.update(secret)
		.digest()
		.subarray(0, 8)
		.toString("hex");
	const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT", kid }));
	const p = b64(
		JSON.stringify({
			aud: "claude-gateway",
			iat: now,
			exp: now + 3600,
			...claims,
		}),
	);
	const sig = createHmac("sha256", secret)
		.update(`${h}.${p}`)
		.digest("base64url");
	return `${h}.${p}.${sig}`;
};

export const gatewayYaml = (o: {
	port: number;
	upstream: string;
	pgPort: number;
	billingGroupTag: boolean;
	/** `admin.identity_retention_days`, left out when unset. */
	identityRetentionDays?: number | string;
	/** The YAML under `upstreams:`, in place of the one Anthropic upstream. */
	upstreams?: string;
}): string => `listen:
  host: 127.0.0.1
  port: ${o.port}
upstreams:
${
	o.upstreams ??
	`  - provider: anthropic
    base_url: ${o.upstream}
    auth:
      api_key: sk-ant-fake-probe
`
}session:
  jwt_secret: ${GATEWAY_SECRET}
store:
  postgres_url: postgres://postgres@127.0.0.1:${o.pgPort}/probe
cri:
  enabled: true
  audience: [probe]
  org_allowlist: ["00000000-0000-4000-8000-000000000000"]
admin:
${o.billingGroupTag ? "  billing_group_tag: team\n" : ""}${o.identityRetentionDays === undefined ? "" : `  identity_retention_days: ${o.identityRetentionDays}\n`}  read_keys:
    - id: probe
      key: ${ADMIN_READ_KEY}
`;

export interface Seen {
	path: string;
	betas: string[];
	tags: boolean;
	/** The access key id in a SigV4 `Authorization` header, or null. */
	signedWith: string | null;
}
/** A stub Anthropic upstream that records the path, the betas and whether `tags` was in the body. */
export const startUpstream = () => {
	const seen: Seen[] = [];
	const srv = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(req) {
			let tags = false;
			try {
				const b: unknown = JSON.parse(await req.text());
				tags = typeof b === "object" && b !== null && "tags" in b;
			} catch {
				// no JSON body
			}
			seen.push({
				path: new URL(req.url).pathname,
				betas: (req.headers.get("anthropic-beta") ?? "")
					.split(",")
					.filter(Boolean),
				tags,
				signedWith:
					/Credential=([^/,\s]+)\//u.exec(
						req.headers.get("authorization") ?? "",
					)?.[1] ?? null,
			});
			return Response.json({
				id: "m",
				type: "message",
				role: "assistant",
				model: "x",
				content: [{ type: "text", text: "OK" }],
				stop_reason: "end_turn",
				usage: { input_tokens: 1, output_tokens: 1 },
			});
		},
	});
	return {
		url: `http://127.0.0.1:${srv.port}`,
		seen,
		stop: () => srv.stop(true),
	};
};

/** The access key id in the assumed-role answer of the stub STS. */
export const ASSUMED_KEY_ID = "ASIAPROBEASSUMED";
/**
 * A stub for https://sts.us-east-1.amazonaws.com: the program has no setting for the STS address (it builds it from the region), so the gateway reaches the stub through a CONNECT proxy and a throw-away CA.
 * `calls` holds the form fields and the SigV4 key id of each AssumeRole request. "denied" answers AccessDenied.
 */
export const startSts = async (answer: "ok" | "denied" = "ok") => {
	const calls: (Record<string, string> & { signedWith: string })[] = [];
	const mitm = await startMitm({
		tunnelOthers: false,
		hosts: ["sts.us-east-1.amazonaws.com"],
		upstream: async (req) => {
			const form = Object.fromEntries(new URLSearchParams(await req.text()));
			calls.push({
				...form,
				signedWith:
					/Credential=([^/,\s]+)\//u.exec(
						req.headers.get("authorization") ?? "",
					)?.[1] ?? "",
			});
			const xml = { headers: { "content-type": "text/xml" } };
			if (answer === "denied") {
				return new Response(
					'<ErrorResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><Error><Type>Sender</Type><Code>AccessDenied</Code><Message>probe: not allowed to assume the role</Message></Error><RequestId>probe</RequestId></ErrorResponse>',
					{ status: 403, ...xml },
				);
			}
			return new Response(
				`<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleResult><Credentials><AccessKeyId>${ASSUMED_KEY_ID}</AccessKeyId><SecretAccessKey>probe-assumed-secret</SecretAccessKey><SessionToken>probe-assumed-session</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials><AssumedRoleUser><AssumedRoleId>AROAPROBE:s</AssumedRoleId><Arn>${form["RoleArn"] ?? ""}</Arn></AssumedRoleUser></AssumeRoleResult></AssumeRoleResponse>`,
				xml,
			);
		},
	});
	return {
		/** Environment that sends the gateway's STS calls to the stub. */
		env: { HTTPS_PROXY: mitm.proxyUrl, NODE_EXTRA_CA_CERTS: mitm.caFile },
		calls,
		stop: mitm.stop,
	};
};

const watchProcess = (
	p: ReturnType<typeof Bun.spawn<"ignore", "pipe", "pipe">>,
): { log: () => string; exited: () => boolean } => {
	let log = "";
	let exited = false;
	const pump = async (s: ReadableStream<Uint8Array>): Promise<void> => {
		const d = new TextDecoder();
		for await (const c of s) {
			log += d.decode(c);
		}
	};
	void pump(p.stdout);
	void pump(p.stderr);
	void (async () => {
		await p.exited;
		exited = true;
	})();
	return { log: () => log, exited: () => exited };
};

const reachable = async (url: string): Promise<boolean> => {
	try {
		await fetch(`${url}/`);
		return true;
	} catch {
		return false;
	}
};

const readyBy = async (
	url: string,
	exited: () => boolean,
	end: number,
): Promise<boolean> => {
	if (exited() || Date.now() >= end) {
		return false;
	}
	if (await reachable(url)) {
		return true;
	}
	await Bun.sleep(250);
	return readyBy(url, exited, end);
};

/** `claude gateway --config` in the sandbox. `ready` is true once the port answers, false if the process exits first. */
export const startGateway = async (
	bin: string,
	sb: Sandbox,
	o: Omit<Parameters<typeof gatewayYaml>[0], "port"> & {
		env?: Record<string, string>;
	},
) => {
	const port = await allocPort();
	const cfg = `${sb.root}/gateway.yaml`;
	const { env, ...yaml } = o;
	await Bun.write(cfg, gatewayYaml({ port, ...yaml }));
	const p = Bun.spawn([bin, "gateway", "--config", cfg], {
		cwd: sb.proj,
		env: childEnv({
			home: sb.home,
			configDir: sb.cfg,
			baseUrl: o.upstream,
			auth: "none",
			extra: { CLAUDE_GATEWAY_ALLOW_LOOPBACK: "1", ...env },
			allowOverride: Object.keys(env ?? {}),
		}),
		stdout: "pipe",
		stderr: "pipe",
		detached: true,
	});
	await registerPid(p.pid);
	const watch = watchProcess(p);
	const url = `http://127.0.0.1:${port}`;
	return {
		url,
		ready: (timeoutMs = 60_000) =>
			readyBy(url, watch.exited, Date.now() + timeoutMs),
		exit: () => p.exited,
		log: watch.log,
		stop: async () => {
			if (!watch.exited()) {
				p.kill("SIGTERM");
			}
			await Promise.race([p.exited, Bun.sleep(5000)]);
			if (!watch.exited()) {
				p.kill("SIGKILL");
			}
		},
	};
};
