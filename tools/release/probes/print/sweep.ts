// Env var sweep, ported from p305-print/sweep.ts. Each name from the binary's strings is set to "1" in two
// baseline runs (A plain, B tool+plugin+hooks); the result is which signature keys change, minus baseline noise.
// The name list comes from release:diff's extractor over the cached strings dump, not from a saved file.
import { join } from "node:path";

import { binaryPath, childEnv, PROMPT } from "../../lib/env.ts";
import { type CaseResult, type Data, normalise } from "../../lib/results.ts";
import { obj, pathExists, selected } from "./run.ts";
import { scalar, show } from "./run/helpers.ts";
import { baselineA, baselineB, stableBaseline } from "./sig.ts";
import { type Bases, errorText, runJobs, tally } from "./sweep/jobs.ts";
import { mergeSweep } from "./sweep/merge.ts";
import { sweepNames, unsettable } from "./sweep/names.ts";
import type { PrintCtx, PrintGroup } from "./types.ts";

export { mergeSweep } from "./sweep/merge.ts";
export { sweepNames } from "./sweep/names.ts";

const ID = "print.sweep";
const NOTES =
	"Each name set to 1. Data: NAME.A / NAME.B = signature keys that changed vs baseline (noise removed).";

const result = (
	ctx: PrintCtx,
	data: Record<string, Data>,
	extra?: Partial<CaseResult>,
): CaseResult => ({
	schema: 1,
	id: ID,
	group: "print",
	version: ctx.version,
	prompt: PROMPT,
	args: ["-p", PROMPT],
	envSet: [],
	exit: null,
	timedOut: false,
	data: normalise(data),
	facts: [],
	...extra,
});

const header = (
	bases: Bases,
	todo: string[],
	skipped: string[],
): Record<string, Data> => ({
	precondition: bases.A.valid && bases.B.valid,
	"precondition.detail": [
		bases.A.why && `A: ${bases.A.why}`,
		bases.B.why && `B: ${bases.B.why}`,
	]
		.filter(Boolean)
		.join(" | "),
	names: todo.length,
	skipped,
	"noise.A": bases.A.noise,
	"noise.B": bases.B.noise,
});

const dataOf = (v: unknown): Record<string, Data> =>
	Object.fromEntries(
		Object.entries(obj(v)).map(([k, x]) => [
			k,
			Array.isArray(x) ? x.map((e) => show(e)) : scalar(x),
		]),
	);

const mergePartial = async (
	ctx: PrintCtx,
	data: Record<string, Data>,
	samples: Record<string, string>,
	names: string[],
): Promise<CaseResult> => {
	const file = join(ctx.runDir, "print", "sweep.json");
	if (!(await pathExists(file))) {
		throw new Error(
			"no print/sweep.json to merge into; run the full sweep first (--only sweep)",
		);
	}
	const raw = obj(await Bun.file(file).json());
	const prev = {
		data: dataOf(raw["data"]),
		samples: Object.fromEntries(
			Object.entries(obj(raw["samples"])).map(([k, x]) => [k, show(x)]),
		),
	};
	const merged = mergeSweep(prev, data, samples, names);
	return result(ctx, merged.data, { samples: merged.samples, notes: NOTES });
};

const sweepAll = async (ctx: PrintCtx, want: string[]): Promise<CaseResult> => {
	const all = await sweepNames(ctx.version);
	const names = want.length > 0 ? all.filter((n) => want.includes(n)) : all;
	const fixed = new Set(
		Object.keys(
			childEnv({
				home: "/x",
				configDir: "/x",
				baseUrl: "http://127.0.0.1:1/x",
			}),
		),
	);
	const skipped: string[] = [];
	const todo: string[] = [];
	for (const n of names) {
		if (unsettable(n, fixed) === null) {
			todo.push(n);
		} else {
			skipped.push(n);
		}
	}
	const bin = binaryPath(ctx.version);
	const bases = {
		A: await stableBaseline(bin, baselineA, false),
		B: await stableBaseline(bin, baselineB, true),
	};
	console.info(
		`  sweep: ${todo.length} names, ${skipped.length} skipped, noise A=${bases.A.noise.length} B=${bases.B.noise.length}`,
	);
	const t = tally(todo, await runJobs(bin, bases, todo));
	const data = {
		...header(bases, todo, skipped),
		...t.data,
		changed: [...new Set(t.changed)],
		errors: t.errored,
	};
	if (want.length === 0) {
		return result(ctx, data, { samples: t.samples, notes: NOTES });
	}
	return mergePartial(ctx, data, t.samples, [...todo, ...skipped]);
};

const run = async (ctx: PrintCtx): Promise<CaseResult[]> => {
	if (!selected(ctx, ID)) {
		return [];
	}
	// `--only sweep.NAME` is a partial run: its names replace their entries in the existing print/sweep.json.
	const want = (ctx.only ?? [])
		.map((o) => o.replace(/^print\./u, ""))
		.filter((o) => o.startsWith("sweep."))
		.map((o) => o.slice("sweep.".length));
	if (ctx.dry) {
		return [result(ctx, {})];
	}
	try {
		return [await sweepAll(ctx, want)];
	} catch (error) {
		return [
			result(
				ctx,
				{ precondition: false, error: errorText(error) },
				want.length > 0 ? { id: `${ID}.partial` } : {},
			),
		];
	}
};

export const sweepGroup: PrintGroup = {
	id: "sweep",
	title: "Environment variable sweep (names from release:diff strings)",
	run,
};
