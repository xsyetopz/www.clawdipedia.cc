// compare.md and the diff/*.json reader of release:compare.
import { join } from "node:path";

import { pathExists } from "../../lib/fs.ts";
import type { CaseDiff, Compare, FactResult } from "./types.ts";

const DIFF_FILES = [
	"strings-env.json",
	"flags.json",
	"commands.json",
	"settings.json",
	"hooks.json",
	"gates.json",
];
export interface DiffJson {
	kind: string;
	added?: string[];
	removed?: string[];
	changed?: { name: string }[];
}

const isDiffJson = (v: unknown): v is DiffJson =>
	typeof v === "object" &&
	v !== null &&
	"kind" in v &&
	typeof v.kind === "string";

const readDiff = async (path: string): Promise<DiffJson> => {
	const raw: unknown = await Bun.file(path).json();
	if (!isDiffJson(raw)) {
		throw new Error(`${path} is not a diff file`);
	}
	return raw;
};

export const readDiffs = async (dir: string): Promise<DiffJson[]> => {
	const paths = DIFF_FILES.map((f) => join(dir, "diff", f));
	const present = await Promise.all(paths.map((p) => pathExists(p)));
	return Promise.all(
		paths.filter((_, i) => present[i] === true).map((p) => readDiff(p)),
	);
};

const fmt = (v: unknown): string => {
	const s = JSON.stringify(v);
	return s.length > 80 ? `${s.slice(0, 77)}...` : s;
};

/** The facts that need a person: changed, not run, or from an invalid run. */
export const isWork = (x: FactResult): boolean =>
	x.result === "changed" ||
	x.result === "not-run" ||
	x.result === "invalid-run";

const invalidLines = (c: Compare): string[] =>
	c.counts.invalid > 0
		? [
				`> **${c.counts.invalid} invalid runs - re-run these cases, do not edit docs from them:** ${Object.keys(
					c.invalidRuns ?? {},
				)
					.map((i) => `\`${i}\``)
					.join(", ")}`,
				"",
			]
		: [];

const worklistLines = (c: Compare): string[] => {
	const L: string[] = ["## Worklist", ""];
	if (c.facts === undefined) {
		L.push("No facts.json for this version: run `release:facts` first.");
	} else {
		const work = c.facts.filter((x) => isWork(x));
		L.push(`Facts to re-check: ${work.length} of ${c.facts.length}.`, "");
		for (const r of work) {
			L.push(
				`- ${r.result}: \`${r.id}\` (${r.file}:${r.line}, ${r.kind ?? "?"})${r.why === undefined || r.why === "" ? "" : ` - ${r.why}`}`,
			);
		}
	}
	L.push("");
	return L;
};

const uncoveredLines = (c: Compare): string[] => {
	const u = c.uncoveredNames;
	if (u === undefined) {
		return [];
	}
	const L = [`New names in diff/ that no fact covers: ${u.length}.`, ""];
	for (const n of u.slice(0, 80)) {
		L.push(`- ${n.kind}: \`${n.name}\``);
	}
	if (u.length > 80) {
		L.push(`- ... ${u.length - 80} more (see the JSON)`);
	}
	L.push("");
	return L;
};

const caseLines = (id: string, d: CaseDiff): string[] => {
	const L = [`### \`${id}\``, ""];
	for (const [k, v] of Object.entries(d.changed)) {
		const p = [
			...(v.added ?? []).map((x) => `+${x}`),
			...(v.removed ?? []).map((x) => `-${x}`),
		].map((x) => `\`${x.slice(0, 60)}\``);
		L.push(
			`- changed \`${k}\`: ${fmt(v.old)} -> ${fmt(v.new)}${p.length > 0 ? ` (${p.join(" ")})` : ""}`,
		);
	}
	for (const [k, v] of Object.entries(d.added)) {
		L.push(`- added \`${k}\`: ${fmt(v)}`);
	}
	for (const [k, v] of Object.entries(d.removed)) {
		L.push(`- removed \`${k}\`: ${fmt(v)}`);
	}
	for (const k of Object.keys(d.samples ?? {})) {
		L.push(`- sample \`${k}\` differs`);
	}
	L.push("");
	return L;
};

const casesLines = (c: Compare): string[] => [
	"## Cases",
	"",
	`${c.counts.cases} in both, ${c.counts.changed} changed, ${c.counts.unchanged} unchanged, ${c.counts.invalid} invalid runs, ${c.onlyFrom.length} only in ${c.from}, ${c.onlyTo.length} only in ${c.to}.`,
	"",
	...Object.entries(c.invalidRuns ?? {}).flatMap(([id, why]) => [
		`### \`${id}\` (invalid run)`,
		"",
		`- ${why}`,
		"",
	]),
	...Object.entries(c.cases).flatMap(([id, d]) => caseLines(id, d)),
];

const noiseLines = (c: Compare): string[] =>
	c.noise !== undefined || (c.facts ?? []).some((r) => r.noise !== undefined)
		? [
				"## Noise (ignored)",
				"",
				"Data that differs but is not a release change (run-to-run noise, or a version string only). Rules: `NOISY` in `tools/release/facts/compare.ts`.",
				"",
				...Object.entries(c.noise ?? {}).flatMap(([id, m]) =>
					Object.entries(m).map(([k, why]) => `- \`${id}\` \`${k}\`: ${why}`),
				),
				...(c.facts ?? []).flatMap((r) =>
					Object.entries(r.noise ?? {}).flatMap(([id, m]) =>
						Object.entries(m).map(
							([k, why]) => `- fact \`${r.id}\`: \`${id}\` \`${k}\`: ${why}`,
						),
					),
				),
				"",
			]
		: [];

const onlyLines = (title: string, ids: string[]): string[] =>
	ids.length > 0 ? [title, "", ...ids.map((i) => `- \`${i}\``), ""] : [];

export const renderCompare = (c: Compare): string => {
	const L: string[] = [
		`# Compare ${c.from} to ${c.to}`,
		"",
		...(c.warning === undefined ? [] : [`> **WARNING:** ${c.warning}`, ""]),
		...invalidLines(c),
		...worklistLines(c),
		...uncoveredLines(c),
		...casesLines(c),
		...noiseLines(c),
		...onlyLines(`## Only in ${c.from}`, c.onlyFrom),
		...onlyLines(`## Only in ${c.to}`, c.onlyTo),
	];
	return `${L.join("\n")}\n`;
};
