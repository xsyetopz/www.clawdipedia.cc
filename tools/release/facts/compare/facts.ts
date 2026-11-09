// Compares the version-labelled facts of release:compare: per-fact results and doc tokens.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { pathExists } from "../../lib/fs.ts";
import type { CaseResult } from "../../lib/results.ts";
import { diffCase } from "./case.ts";
import { invalidDetail, isEmpty } from "./data.ts";
import type { FactResult, FactRow } from "./types.ts";

type Runs = Map<string, CaseResult>;

interface Outcome {
	probe: string;
	state: "not-run" | "changed" | "invalid" | "same";
	why?: string;
	ignored?: Record<string, string>;
}

/** The sweep holds every env name: look at the data of the fact's names only. */
const onlyFor = (
	p: string,
	c: FactRow,
): ((k: string) => boolean) | undefined => {
	const names = c.diffNames ?? [];
	return p.endsWith("sweep") && names.length > 0
		? (k) => names.some((n) => k.startsWith(`${n}.`))
		: undefined;
};

const probeOutcome = (
	c: FactRow,
	probe: string,
	[am, bm]: [Runs, Runs],
	versions?: [string, string],
): Outcome => {
	const n = bm.get(probe);
	if (n === undefined) {
		return {
			probe,
			state: "not-run",
			why: `${probe}: no result for the new version`,
		};
	}
	const o = am.get(probe);
	if (o === undefined) {
		return {
			probe,
			state: "changed",
			why: `${probe}: new case, no result for the old version`,
		};
	}
	const bad = invalidDetail(o, n);
	if (bad !== null) {
		return { probe, state: "invalid", why: `${probe}: ${bad}` };
	}
	const ignored: Record<string, string> = {};
	const d = diffCase(o, n, false, onlyFor(probe, c), {
		id: probe,
		ignored,
		...(versions === undefined ? {} : { versions }),
	});
	if (isEmpty(d)) {
		return { probe, state: "same", ignored };
	}
	const names = [
		...Object.keys(d.changed),
		...Object.keys(d.added),
		...Object.keys(d.removed),
	];
	return {
		probe,
		state: "changed",
		why: `${probe}: ${names.slice(0, 5).join(", ")}`,
		ignored,
	};
};

const probeResult = (
	c: FactRow,
	runs: [Runs, Runs],
	versions?: [string, string],
): FactResult => {
	const outcomes = c.probes.map((p) => probeOutcome(c, p, runs, versions));
	const has = (s: Outcome["state"]) => outcomes.some((o) => o.state === s);
	// a probe that did not run hides what the others say, so it comes first
	let result: NonNullable<FactResult["result"]> = "unchanged";
	if (has("not-run")) {
		result = "not-run";
	} else if (has("invalid")) {
		result = "invalid-run";
	} else if (has("changed")) {
		result = "changed";
	}
	const noise: Record<string, Record<string, string>> = {};
	const noted: string[] = [];
	for (const o of outcomes) {
		const keys = Object.keys(o.ignored ?? {});
		if (o.ignored !== undefined && keys.length > 0) {
			noise[o.probe] = o.ignored;
			noted.push(...keys.map((k) => `${o.probe} ${k}`));
		}
	}
	const text = outcomes
		.flatMap((o) => (o.why === undefined ? [] : [o.why]))
		.join("; ");
	const note = noted.length > 0 ? `noise ignored: ${noted.join(", ")}` : "";
	let why = text;
	if (note !== "") {
		why = result === "unchanged" ? `unchanged (${note})` : `${text}; ${note}`;
	}
	return { ...c, result, why, ...(noted.length > 0 ? { noise } : {}) };
};

const notRun = (c: FactRow, why: string): FactResult => ({
	...c,
	result: "not-run",
	why,
});

const lookup = (c: FactRow, hit: string[], where: string): FactResult => ({
	...c,
	result: hit.length > 0 ? "changed" : "unchanged",
	...(hit.length > 0 ? { why: `${where}: ${hit.join(", ")}` } : {}),
});

const noProbeResult = (
	c: FactRow,
	diffChanged: Set<string> | null,
	schemaText: string | null,
): FactResult => {
	if (c.kind === "manual") {
		return notRun(
			c,
			"manual: program behaviour with no probe; check it by hand",
		);
	}
	const names = c.diffNames ?? [];
	if (c.kind === "schema") {
		if (schemaText === null) {
			return notRun(c, "no schemas-diff.json for this version");
		}
		return lookup(
			c,
			names.filter((n) => schemaText.includes(n.split(".").pop() ?? n)),
			"in schemas-diff.json",
		);
	}
	if (names.length > 0) {
		if (diffChanged === null) {
			return notRun(c, "no diff/ for this version");
		}
		return lookup(
			c,
			names.filter((n) => diffChanged.has(n)),
			"in diff/",
		);
	}
	return notRun(c, "no probe and no diff name to look up");
};

/** `result` per fact from the mapped probes (or, for diff kinds, from diff/*.json of `to`). */
export const factResults = (
	facts: FactRow[],
	a: CaseResult[],
	b: CaseResult[],
	diffChanged: Set<string> | null,
	schemaText: string | null = null,
	versions?: [string, string],
): FactResult[] => {
	const runs: [Runs, Runs] = [
		new Map(a.map((r) => [r.id, r])),
		new Map(b.map((r) => [r.id, r])),
	];
	return facts.map((c) => {
		if (c.status === "static" || c.kind === "static" || c.kind === "external") {
			return c;
		}
		return c.probes.length > 0
			? probeResult(c, runs, versions)
			: noProbeResult(c, diffChanged, schemaText);
	});
};

/** Backticked tokens in docs/ (whole token, and its first word: `--flag <v>` gives `--flag`). */
export const docTokens = async (dir: string): Promise<Set<string>> => {
	const out = new Set<string>();
	if (!(await pathExists(dir))) {
		return out;
	}
	const entries = await readdir(dir, { recursive: true });
	const texts = await Promise.all(
		entries
			.filter((n) => /\.mdx?$/u.test(n))
			.map((n) => Bun.file(join(dir, n)).text()),
	);
	for (const text of texts) {
		for (const m of text.matchAll(/`([^`\n]+)`/gu)) {
			const t = (m[1] ?? "").trim();
			out.add(t);
			out.add(t.split(/\s/u)[0] ?? t);
		}
	}
	return out;
};
