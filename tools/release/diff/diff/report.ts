import type { KindDiff } from "./kind.ts";

// Lines per list in report.md; the JSON has everything.
const LIMIT = 80;

const list = (items: string[], fmt: (s: string) => string): string[] => [
	...items.slice(0, LIMIT).map((s) => fmt(s)),
	...(items.length > LIMIT
		? [`- ... ${items.length - LIMIT} more (see the JSON)`]
		: []),
];

const docsNote = (d: KindDiff, n: string) => {
	const f = d.inDocs[n];
	return f === undefined
		? ""
		: ` (docs: ${f.slice(0, 4).join(", ")}${f.length > 4 ? ", ..." : ""})`;
};

const pageNote = (d: KindDiff, n: string) => {
	const p = d.pages[n];
	return p === undefined || p === "" ? "" : ` -> ${p}`;
};

const sections = (d: KindDiff): string[] => {
	const undoc = new Set(d.undocumentedAdded);
	const out: string[] = [];
	if (d.added.length > 0) {
		out.push(
			`### Added (${d.added.length}; "new" = no docs page mentions it; -> the page that takes it)`,
			"",
			...list(
				d.added,
				(n) => `- \`${n}\`${undoc.has(n) ? " new" : ""}${pageNote(d, n)}`,
			),
			"",
		);
	}
	if (d.removed.length > 0) {
		out.push(
			`### Removed (${d.removed.length})`,
			"",
			...list(d.removed, (n) => `- \`${n}\`${docsNote(d, n)}`),
			"",
		);
	}
	if (d.changed.length > 0) {
		out.push(
			`### Changed (${d.changed.length})`,
			"",
			...d.changed
				.slice(0, LIMIT)
				.flatMap((c) => [
					`- \`${c.name}\`${docsNote(d, c.name)}${pageNote(d, c.name)}`,
					`  - old: ${c.old === "" ? "(empty)" : c.old}`,
					`  - new: ${c.new === "" ? "(empty)" : c.new}`,
				]),
			...(d.changed.length > LIMIT
				? [`- ... ${d.changed.length - LIMIT} more (see the JSON)`]
				: []),
			"",
		);
	}
	return out;
};

/** Renders report.md from the diffs of all kinds. */
export const renderReport = (
	from: string,
	to: string,
	ds: KindDiff[],
	titles: Record<string, string> = {},
): string => {
	const lines: string[] = [
		`# Release Diff ${from} -> ${to}`,
		"",
		"Made by `release:diff` from the surface snapshots of both binaries (`captures/<version>/surface.json`).",
		"",
		`| Kind | ${from} | ${to} | Added | Removed | Changed | Added, not in docs |`,
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
		...ds.map(
			(d) =>
				`| ${d.kind} | ${d.fromCount} | ${d.toCount} | ${d.added.length} | ${d.removed.length} | ${d.changed.length} | ${d.undocumentedAdded.length} |`,
		),
		"",
	];
	for (const d of ds) {
		lines.push(`## ${titles[d.kind] ?? d.kind}`, "");
		const body = sections(d);
		lines.push(...(body.length === 0 ? ["No change.", ""] : body));
	}
	const touched = new Set(ds.flatMap((d) => Object.values(d.inDocs).flat()));
	lines.push(
		"## Docs Pages Touched by Removed or Changed Names",
		"",
		...(touched.size > 0
			? [...touched].toSorted().map((f) => `- ${f}`)
			: ["None."]),
		"",
	);
	return lines.join("\n");
};
