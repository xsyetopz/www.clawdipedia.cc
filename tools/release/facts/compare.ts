// release:compare - diffs captures/<from>/ against captures/<to>/ per case id, and per fact when facts.json exists.
//   bun tools/release/cli.ts compare <from> <to> [--samples]     (or --from V --to V)
// Writes captures/<to>/compare/<from>..<to>.json and compare.md.
// Design: the same archived design file, sections "Commands" and "Claim Map" under the old term.
import { join } from "node:path";

import { pathExists } from "../lib/fs.ts";
import { readRun } from "../lib/results.ts";
import { CAPTURES, type Ctx, ROOT, writeJson } from "../util.ts";
import { compareResults } from "./compare/case.ts";
import { docTokens, factResults } from "./compare/facts.ts";
import { isWork, readDiffs, renderCompare } from "./compare/render.ts";
import type { Compare, FactRow } from "./compare/types.ts";

export { compareResults, diffCase } from "./compare/case.ts";
export { invalidDetail } from "./compare/data.ts";
export { factResults } from "./compare/facts.ts";
export { NOISY } from "./compare/noise.ts";
export { renderCompare } from "./compare/render.ts";
export type { DiffOpts } from "./compare/case.ts";
export type {
	CaseDiff,
	Compare,
	DataChange,
	FactResult,
	FactRow,
} from "./compare/types.ts";

const isFactRows = (v: unknown): v is FactRow[] => Array.isArray(v);

/** Everything but the file writes, so the selftest can run it on fixture dirs. */
export const compareRuns = async (
	from: string,
	to: string,
	base: string,
	withSamples: boolean,
	docsDir = join(ROOT, "docs"),
): Promise<Compare> => {
	const [a, b] = await Promise.all([readRun(from, base), readRun(to, base)]);
	const c = compareResults(from, to, a, b, withSamples);
	const diffs = await readDiffs(join(base, to));
	const changedNames = new Set(
		diffs.flatMap((d) => [
			...(d.added ?? []),
			...(d.removed ?? []),
			...(d.changed ?? []).map((x) => x.name),
		]),
	);
	const cp = join(base, to, "facts.json");
	if (await pathExists(cp)) {
		const rows: unknown = await Bun.file(cp).json();
		if (!isFactRows(rows)) {
			throw new Error(`${cp} is not a list of facts`);
		}
		const sp = join(base, to, "schemas-diff.json");
		c.facts = factResults(
			rows,
			a,
			b,
			diffs.length > 0 ? changedNames : null,
			(await pathExists(sp)) ? await Bun.file(sp).text() : null,
			[from, to],
		);
	}
	if (diffs.length > 0) {
		const tokens = await docTokens(docsDir);
		c.uncoveredNames = diffs.flatMap((d) =>
			(d.added ?? [])
				.filter((n) => !tokens.has(n))
				.map((n) => ({ kind: d.kind, name: n })),
		);
	}
	return c;
};

const summary = (c: Compare): string => {
	const work = (c.facts ?? []).filter((x) => isWork(x)).length;
	const worklist = c.facts === undefined ? "no facts.json" : `${work} facts`;
	const uncovered =
		c.uncoveredNames === undefined
			? ""
			: `, ${c.uncoveredNames.length} uncovered names`;
	return `release:compare ${c.from}..${c.to}: ${c.counts.cases} cases in both (${c.counts.changed} changed, ${c.counts.invalid} invalid), ${c.onlyFrom.length} only in from, ${c.onlyTo.length} only in to; worklist ${worklist}${uncovered}`;
};

export const runCompare = async (ctx: Ctx): Promise<number> => {
	// cli.ts turns `compare <from> <to>` into --from/--to
	const { from, to } = ctx;
	if (to === undefined || to === "") {
		throw new Error("no <to> version given and no installed binary found");
	}
	// `--from` falls back to the tracked version and `--to` to the installed one, so a bare
	// `release:compare` asks for `<v>..<v>`. That run reports nothing and overwrites `compare.md`.
	if (from === to) {
		throw new Error(
			`compare needs two versions, and both are ${to}. Give them: \`release:compare -- <from> ${to}\``,
		);
	}
	const found = await Promise.all(
		[from, to].map((v) => pathExists(join(CAPTURES, v))),
	);
	const missing = [from, to].find((_, i) => found[i] !== true);
	if (missing !== undefined) {
		throw new Error(
			`no captures/${missing}/ (run the probes for ${missing} first)`,
		);
	}
	const c = await compareRuns(
		from,
		to,
		CAPTURES,
		ctx.rest.includes("--samples"),
	);
	const old = await readRun(from, CAPTURES);
	if (old.length === 0) {
		c.warning = `captures/${from}/ has no case results (print/ or pty/), so every probed fact shows as changed. Run \`release:probe:print -- --to ${from}\` and \`release:probe:pty -- --to ${from}\` with the old binary installed, then compare again.`;
		console.error(`release:compare WARNING: ${c.warning}`);
	}
	console.info(summary(c));
	if (ctx.dry) {
		return 0;
	}
	const dir = join(CAPTURES, to, "compare");
	const jsonPath = join(dir, `${from}..${to}.json`);
	const mdPath = join(dir, "compare.md");
	await writeJson(jsonPath, c);
	await Bun.write(mdPath, renderCompare(c));
	console.info(`  wrote ${jsonPath}\n  wrote ${mdPath}`);
	return 0;
};
