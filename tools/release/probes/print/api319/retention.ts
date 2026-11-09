import {
	startGateway,
	startUpstream,
	withPostgres,
} from "../../../lib/gateway.ts";
import { makeSandbox, type Sandbox } from "../../../lib/sandbox.ts";
import { type CaseDef, olderThan, type Out } from "../run/helpers.ts";
import type { PrintCtx } from "../types.ts";
import { viaGateway } from "./gw.ts";

type Query = (sql: string) => Promise<string>;

interface Env {
	ctx: PrintCtx;
	sb: Sandbox;
	up: ReturnType<typeof startUpstream>;
	pgPort: number;
	query: Query;
}

const day = (n: number): string =>
	`to_char(now() AT TIME ZONE 'UTC' - interval '${n} days', 'YYYY-MM-DD')`;

const boot = async (e: Env, days?: number) => {
	const g = await startGateway(e.ctx.bin, e.sb, {
		upstream: e.up.url,
		pgPort: e.pgPort,
		billingGroupTag: false,
		...(days === undefined ? {} : { identityRetentionDays: days }),
	});
	if (!(await g.ready())) {
		throw new Error("gateway did not start");
	}
	return g;
};

const until = async (
	tries: number,
	done: () => Promise<boolean>,
): Promise<void> => {
	if (tries > 0 && !(await done())) {
		await Bun.sleep(250);
		await until(tries - 1, done);
	}
};

const column = async (query: Query, sql: string): Promise<string> => {
	const out = await query(sql);
	return out.split("\n").filter(Boolean).join(",");
};

const state = async (query: Query) => ({
	emails: await column(
		query,
		"SELECT principal FROM principal_emails ORDER BY 1",
	),
	groups: await column(
		query,
		"SELECT principal || '@' || (CURRENT_DATE - day::date) FROM principal_groups ORDER BY 1",
	),
});

const backdate = async (query: Query): Promise<void> => {
	await query(
		"UPDATE principal_emails SET updated_at = now() - interval '60 days'",
	);
	await query(`UPDATE principal_groups SET day = ${day(60)}`);
	await query(
		"INSERT INTO principal_emails (principal, email, updated_at) VALUES ('old', 'o@example.com', now() - interval '100 days')",
	);
	await query(
		`INSERT INTO principal_groups (day, principal, groups) VALUES (${day(100)}, 'old', '["x"]'), (${day(1)}, 'orphan', '["x"]'), (${day(1)}, 'u1', '["x"]')`,
	);
};

const flow = async (e: Env, retention?: number): Promise<Out> => {
	const g1 = await boot(e);
	await viaGateway(
		{ url: g1.url, up: e.up, log: g1.log, sts: null },
		undefined,
		["g1", "g2"],
	);
	await until(
		40,
		async () => (await e.query("SELECT 1 FROM principal_emails")) !== "",
	);
	await g1.stop();
	// a program older than the retention option has no identity group table to sweep
	if (
		olderThan(e.ctx, "2.1.317") &&
		(await e.query("SELECT to_regclass('principal_groups')")) === ""
	) {
		return { data: { principalGroupsTable: false } };
	}
	const first = await state(e.query);
	await backdate(e.query);
	const seeded = await state(e.query);
	const g2 = await boot(e, retention);
	try {
		await until(
			80,
			async () =>
				(await e.query(
					"SELECT 1 FROM principal_emails WHERE principal = 'old'",
				)) === "",
		);
		await Bun.sleep(1500);
		const after = await state(e.query);
		return {
			data: {
				firstEmails: first.emails,
				firstGroups: first.groups,
				seededEmails: seeded.emails,
				seededGroups: seeded.groups,
				afterEmails: after.emails,
				afterGroups: after.groups,
			},
		};
	} finally {
		await g2.stop();
	}
};

/** Two gateway boots on one Postgres. The first writes the identity rows, the probe backdates them, the second boots with `retention` and its boot sweep deletes what is older. */
export const retentionCase = (name: string, retention?: number): CaseDef => ({
	name: `gateway.${name}`,
	run: async (ctx) => {
		const sb = await makeSandbox();
		const up = startUpstream();
		try {
			return await withPostgres((pgPort, query) =>
				flow({ ctx, sb, up, pgPort, query }, retention),
			);
		} finally {
			await up.stop();
			await sb.cleanup();
		}
	},
});
