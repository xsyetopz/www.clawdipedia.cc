// Result and negative checks of release:check --selftest: the facts a result lists, refused secrets and paths.
import { join } from "node:path";

import { factsForProbe } from "../facts/map.ts";
import { childEnv, PROMPT } from "../lib/env.ts";
import {
	type CaseResult,
	openRun,
	readRun,
	writeCase,
} from "../lib/results.ts";
import { makeSandbox, type Sandbox } from "../lib/sandbox.ts";
import type { Stub } from "../lib/stub.ts";
import { runCases } from "../probes/print/run/helpers.ts";
import type { Ctx } from "../util.ts";
import { serverChecks } from "./checks/server.ts";
import { rejects, type Step, throws } from "./checks/util.ts";

export interface ResultChecks {
	ctx: Ctx;
	step: Step;
	sb: Sandbox;
	stub: Stub;
	stubPort: number;
	out: string;
	/** the run dir that openRun made for the smoke case */
	dir: string;
}

const emptyCase = (
	ctx: Ctx,
	id: string,
	extra: Partial<Parameters<typeof writeCase>[1]> = {},
): Parameters<typeof writeCase>[1] => ({
	schema: 1,
	id,
	group: "print",
	version: ctx.to,
	prompt: PROMPT,
	args: [],
	envSet: [],
	exit: 0,
	timedOut: false,
	data: {},
	facts: [],
	...extra,
});

const skipCheck = async ({ ctx, step, out }: ResultChecks) => {
	// a print case whose required file is missing is skipped with a reason, not marked invalid, and does not run
	let ran = false;
	const sk: CaseResult[] = await runCases(
		{ version: ctx.to, bin: "", runDir: out, dry: false },
		"selftest",
		[
			{
				name: "needs-file",
				requires: {
					path: join(out, "no-such-file"),
					reason: "needs a file",
				},
				run: () => {
					ran = true;
					return { data: {} };
				},
			},
		],
	);
	step(
		"a print case with a missing required file is skipped, not invalid",
		!ran &&
			sk.length === 1 &&
			typeof sk[0]?.data["skipped"] === "string" &&
			sk[0]?.data["precondition"] === undefined,
		String(sk[0]?.data["skipped"] ?? "no result"),
	);
};

const writeChecks = async (c: ResultChecks) => {
	const { ctx, step, out, dir } = c;
	// a probe result lists the facts that map.json maps to its case, without each probe asking
	const mapped = factsForProbe("print.control.requests");
	await writeCase(
		await openRun("0.0.1", out),
		emptyCase(ctx, "print.control.requests", { facts: ["control.own"] }),
	);
	const back = await readRun("0.0.1", out);
	const listed = back[0]?.facts ?? [];
	step(
		"writeCase adds the map.json facts of the case",
		mapped.length > 0 &&
			[...mapped, "control.own"].every((f) => listed.includes(f)),
		`${listed.length} listed, ${mapped.length} mapped`,
	);
	step(
		"writeCase refuses secret-shaped strings",
		await rejects(() =>
			writeCase(
				dir,
				emptyCase(ctx, "print.selftest.leak", {
					data: { k: "sk-ant-oat01-abcdef" },
				}),
			),
		),
	);
};

const envChecks = (step: Step, sb: Sandbox) => {
	const base = {
		home: sb.home,
		configDir: sb.cfg,
		baseUrl: "http://127.0.0.1:1/x",
	};
	step(
		"childEnv accepts *_TOKENS names",
		!throws(() =>
			childEnv({ ...base, extra: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: "9" } }),
		),
	);
	step(
		"childEnv: extra cannot overwrite fixed keys",
		throws(() => childEnv({ ...base, extra: { HOME: "/x" } })) &&
			!throws(() =>
				childEnv({ ...base, extra: { HOME: "/x" }, allowOverride: ["HOME"] }),
			),
	);
};

const pathCheck = async ({ ctx, step, out }: ResultChecks) => {
	const badId = await rejects(() => writeCase(out, emptyCase(ctx, "../x")));
	const badFixture = await rejects(() =>
		makeSandbox({ projFiles: { "../../evil": "x" } }),
	);
	step(
		"paths: bad case id and fixture traversal rejected",
		badId && badFixture,
	);
};

export const runResultChecks = async (c: ResultChecks): Promise<void> => {
	await skipCheck(c);
	await writeChecks(c);
	envChecks(c.step, c.sb);
	const env = {
		step: c.step,
		stub: c.stub,
		stubPort: c.stubPort,
		root: c.sb.root,
	};
	await serverChecks(env);
	await pathCheck(c);
};
