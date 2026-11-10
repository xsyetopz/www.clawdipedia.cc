// Managed probe phases, split from p305-managed/probe.ts. Each phase returns CaseResults (group "managed").
// baseline: no managed folder. main: folder without classifyAllShell. true/false: classifyAllShell cases only.
// owned: the main folder owned by the sudo user, the CLAUDE.md cases only.
// The program always runs as the calling user through childEnv (via print/run.ts runCase); nothing here uses sudo.
import { PROMPT } from "../../lib/env.ts";
import { type CaseResult, normalise } from "../../lib/results.ts";
import { dispose, requestSummary, type Run, runCase } from "../print/run.ts";
import { mapInOrder } from "../print/run/seq.ts";
import type { Phase } from "./fixtures.ts";
import { mainDefs } from "./phases/defs.ts";
import {
	base,
	type Def,
	extend,
	type Obj,
	type Out,
	type PhaseCtx,
} from "./phases/util.ts";
export { type PhaseCtx } from "./phases/util.ts";

// classifyAllShell: user/flag are true | false | undefined
const ROWS: [string, boolean | undefined, boolean | undefined][] = [
	["neither", undefined, undefined],
	["user-true", true, undefined],
	["user-false", false, undefined],
	["flag-true", undefined, true],
	["flag-false", undefined, false],
	["user-false-and-flag-true", false, true],
	["user-true-and-flag-false", true, false],
];

const classifyDefs = (phase: Phase): Def[] => {
	const managed = phase === "true" || (phase === "false" ? false : undefined);
	return ROWS.map(([label, u, f]) => {
		const user: Obj = {
			permissions: { allow: ["Bash(curl -s http://127.0.0.1:9/x)"] },
			enableAllProjectMcpServers: true,
		};
		if (u !== undefined) {
			user["autoMode"] = { classifyAllShell: u };
		}
		const args = ["--permission-mode", "auto"];
		if (f !== undefined) {
			args.push(
				"--settings",
				JSON.stringify({ autoMode: { classifyAllShell: f } }),
			);
		}
		const expectOld = managed === true || u === true || f === true ? 1 : 0;
		return {
			name: `classify-${label}`,
			c: {
				cfgFiles: { "settings.json": JSON.stringify(user) },
				args,
				// From 2.1.319 the server-side check refuses a call that the stub gives no verdict for, and no classifier request follows.
				env: { CLAUDE_CODE_AUTO_MODE_SERVER: "0" },
				tool: "Bash",
				toolInput: { command: "curl -s http://127.0.0.1:9/x" },
			},
			data: (_r, x) => {
				// the stub reply makes the program retry, so only "any classifier request" is comparable
				const seen = x.classifierRequests > 0 ? 1 : 0;
				return {
					data: {
						managed: managed ?? "unset",
						classifier_requested: seen === 1,
						expected_if_any_true: expectOld === 1,
						same_as_expected: seen === expectOld,
					},
				};
			},
		};
	});
};

export const defsFor = (phase: Phase, ctx: PhaseCtx): Def[] => {
	if (phase === "baseline") {
		return mainDefs(ctx);
	}
	if (phase === "main") {
		return [...mainDefs(ctx), ...classifyDefs(phase)];
	}
	if (phase === "owned") {
		return mainDefs(ctx).filter((d) => d.name.startsWith("claudemd-"));
	}
	return classifyDefs(phase);
};

export const caseId = (phase: Phase, d: Def): string =>
	`managed.${phase}.${d.name}`;

/** --only forms: `true`, `true.classify-neither`, `classify-neither`, each with or without the `managed.` prefix. */
const pick = (ctx: PhaseCtx, phase: Phase, id: string): boolean => {
	if (!ctx.only) {
		return true;
	}
	const full = id.slice("managed.".length);
	const forms = [full, full.slice(phase.length + 1)];
	return ctx.only.some((raw) => {
		const o = raw.startsWith("managed.") ? raw.slice("managed.".length) : raw;
		return forms.some((f) => f === o || f.startsWith(`${o}.`));
	});
};

export const selectedDefs = (phase: Phase, ctx: PhaseCtx): Def[] =>
	defsFor(phase, ctx).filter((d) => pick(ctx, phase, caseId(phase, d)));

export const phaseSelected = (ctx: PhaseCtx, phase: Phase): boolean =>
	selectedDefs(phase, ctx).length > 0;

const result = (
	ctx: PhaseCtx,
	id: string,
	r: Run | null,
	o: Out,
	notes?: string,
): CaseResult => ({
	schema: 1,
	id,
	group: "managed",
	version: ctx.version,
	prompt: r ? r.prompt || "(none)" : PROMPT,
	args: r ? normalise(r.args) : [],
	envSet: r ? r.envSet : [],
	exit: r ? r.code : null,
	timedOut: r ? r.timedOut : false,
	data: normalise(o.data),
	...(o.samples ? { samples: o.samples } : {}),
	...(r ? { requests: requestSummary(r) } : {}),
	facts: o.facts ?? [],
	...(notes === undefined || notes === "" ? {} : { notes }),
});

const invalid = (ctx: PhaseCtx, id: string, error: string, notes: string) =>
	result(ctx, id, null, { data: { precondition: false, error } }, notes);

const runDef = async (
	ctx: PhaseCtx,
	id: string,
	d: Def,
	truncate: () => Promise<void>,
	readStarted: () => Promise<string[]>,
): Promise<CaseResult> => {
	await truncate();
	let started: string[] = [];
	const c = base(ctx, d.c);
	const r = await runCase(ctx.bin, {
		...c,
		afterExit: async (sb) => {
			started = await readStarted();
			return (await c.afterExit?.(sb)) ?? {};
		},
	});
	try {
		return result(ctx, id, r, d.data(r, extend(r, started)), d.notes);
	} finally {
		await dispose(r);
	}
};

/** Runs one phase. A throwing case becomes `precondition: false`, never stops the phase. Dry: list only. */
export const runPhase = (
	phase: Phase,
	ctx: PhaseCtx,
	truncate: () => Promise<void>,
	readStarted: () => Promise<string[]>,
	/** Returns an error text when the phase precondition no longer holds (checked before every case). */
	guard?: () => Promise<string | null>,
): Promise<CaseResult[]> =>
	mapInOrder(selectedDefs(phase, ctx), async (d) => {
		const id = caseId(phase, d);
		if (ctx.dry) {
			return result(ctx, id, null, { data: {} });
		}
		const bad = (await guard?.()) ?? null;
		if (bad !== null && bad !== "") {
			return invalid(ctx, id, bad, "probe invalid: phase precondition failed");
		}
		try {
			return await runDef(ctx, id, d, truncate, readStarted);
		} catch (error) {
			return invalid(
				ctx,
				id,
				error instanceof Error ? error.message : String(error),
				"probe invalid: threw before producing data",
			);
		}
	});
