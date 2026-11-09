// What release:check --selftest checks after the program ran: its env dump and the results round trip.
import { join } from "node:path";

import { PROMPT } from "../lib/env.ts";
import { pathExists } from "../lib/fs.ts";
import { openRun, readRun, writeCase } from "../lib/results.ts";
import type { Sandbox } from "../lib/sandbox.ts";
import type { LoggedRequest, Stub } from "../lib/stub.ts";
import type { Ctx } from "../util.ts";
import type { Step } from "./checks/util.ts";
import { LEAKS, PROGRAM_SET } from "./env.ts";

export interface ProgramRun {
	ctx: Ctx;
	step: Step;
	sb: Sandbox;
	stub: Stub;
	out: string;
	bin: string;
	/** the child env names, from the env checks */
	names: string[];
	parentValues: Record<string, string | undefined>;
}

const parseDump = async (
	path: string,
): Promise<(readonly [string, string])[]> => {
	if (!(await pathExists(path))) {
		return [];
	}
	const text = await Bun.file(path).text();
	return text
		.split("\n")
		.filter((l) => l.includes("="))
		.map(
			(l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)] as const,
		);
};

export const dumpChecks = async (p: ProgramRun): Promise<void> => {
	const { step, sb, names, parentValues } = p;
	const pairs = await parseDump(join(sb.root, "envdump.txt"));
	const dumped = pairs.map(([k]) => k);
	step("hook dumped its env", dumped.length > 0, `${dumped.length} names`);
	// A name the program sets itself (CLAUDE_CODE_ENTRYPOINT, a fresh session id) may share a name with the parent's
	// variable but not its value. A leak is: a sentinel name, or a parent value passed through unchanged.
	const leaked = pairs
		.filter(
			([k, v]) =>
				k in LEAKS ||
				(!PROGRAM_SET.has(k) && !names.includes(k) && parentValues[k] === v),
		)
		.map(([k]) => k);
	step(
		"no parent env leaked into the program",
		leaked.length === 0,
		leaked.join(", "),
	);
	const dv = Object.fromEntries(pairs);
	step(
		"hook saw sandbox HOME and CLAUDE_CONFIG_DIR",
		dv["HOME"] === sb.home && dv["CLAUDE_CONFIG_DIR"] === sb.cfg,
	);
	const seen = dumped.filter((k) => k.startsWith("CLAUDE_CODE_")).toSorted();
	console.info(
		`     CLAUDE_CODE_* seen by the hook: ${seen.join(", ") || "(none)"}`,
	);
};

/** Writes one case to a temp run dir and reads it back. Returns the run dir. */
export const resultCheck = async (
	p: ProgramRun,
	res: { code: number | null; timedOut: boolean },
	reqs: LoggedRequest[],
): Promise<string> => {
	const { ctx, step, out, names } = p;
	const dir = await openRun("0.0.0", out);
	const path = await writeCase(dir, {
		schema: 1,
		id: "print.selftest.smoke",
		group: "print",
		version: ctx.to,
		prompt: PROMPT,
		args: ["-p"],
		envSet: [],
		exit: res.code,
		timedOut: res.timedOut,
		data: { requests: reqs.length, envNames: names.length },
		requests: {
			count: reqs.length,
			paths: [...new Set(reqs.map((r) => r.path))],
		},
		facts: [],
	});
	const back = await readRun("0.0.0", out);
	step(
		"results.ts write/read",
		(await pathExists(path)) &&
			back.length === 1 &&
			back[0]?.id === "print.selftest.smoke",
	);
	return dir;
};
