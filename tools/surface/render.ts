// Usage: bun tools/surface/render.ts [--check] [--root <dir>]   (part of: bun run surface, bun run surface:check)
// Writes docs/reference/surface-coverage.md from schemas/surface.json (design D4): the count of each kind, and each
// item with the page that names it, its map route, its exclusion reason, or no page yet. It also rewrites the
// "In the Program" section of docs/reference/undocumented.md with the count of each kind.
// --check writes nothing and fails when either file differs from a fresh render.
import { join, relative } from "node:path";

import {
	docsOf,
	isCommitted,
	isMapRecord,
	isStringRecord,
	readJson,
} from "./coverage-cli.ts";
import {
	check,
	exclusionOf,
	GENERATED,
	type MapEntry,
	mapOf,
	type Row,
	status,
} from "./coverage.ts";
import type { Committed } from "./snapshot.ts";

const UNDOCUMENTED = "docs/reference/undocumented.md";
const SECTION = "## In the Program";
const DRAFT = false;

const TITLES: Record<string, string> = {
	beta: "Betas",
	endpoint: "API Endpoints",
	env: "Environment Variables",
	error: "Error Texts",
	file: "Files",
	flag: "CLI Flags",
	gate: "Gates",
	"hook-event": "Hook Events",
	keybinding: "Keybindings",
	"mod-api": "Mod API",
	model: "Models",
	"otel-event": "OpenTelemetry Events",
	"permission-rule": "Permission Rules",
	setting: "Settings",
	"setting-key": "Nested Setting Keys",
	"slash-command": "Slash Commands",
	subcommand: "Subcommands",
	tool: "Tools",
};
export const title = (kind: string) => TITLES[kind] ?? kind;
const slug = (kind: string) => title(kind).toLowerCase().replaceAll(" ", "-");

// check:docs allows no emoji outside docs/prompts, so a program text shows them as code points.
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}/gu;

/** A table cell code span that holds any text: pipes escaped, a fence longer than any backtick run. */
export const code = (text: string): string => {
	const t = text
		.replaceAll("\n", String.raw`\n`)
		.replaceAll("|", String.raw`\|`)
		.replaceAll(
			EMOJI,
			(c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase()}`,
		);
	const fence = "`".repeat(
		Math.max(0, ...(t.match(/`+/gu) ?? []).map((r) => r.length)) + 1,
	);
	const pad = t.startsWith("`") || t.endsWith("`") ? " " : "";
	return `${fence}${pad}${t}${pad}${fence}`;
};

const pageTitle = (text: string, file: string) =>
	/^title:\s*(.+)$/mu
		.exec(text)?.[1]
		?.trim()
		.replace(/^(["'])(.*)\1$/u, "$2") ?? file;

export interface Rendered {
	page: string;
	undocumented: string;
}

type Names = Record<string, Map<string, string>>;

interface Lookup {
	dir: string;
	names: Names;
	titles: Map<string, string>;
	map: Record<string, MapEntry>;
	exclusions: Record<string, string>;
}

const mappedCell = (m: MapEntry | undefined) => {
	const route = m?.route ?? "";
	const to = (m?.anchor ?? "") === "" ? route : `${route}#${m?.anchor}`;
	return `[${to}](${to})`;
};

const where = (l: Lookup, kind: string, name: string): string => {
	const key = `${kind}:${name}`;
	const state = status(kind, name, l.names, l.map, l.exclusions);
	if (state === "docs") {
		const file = l.names[kind]?.get(name) ?? "";
		return `[${l.titles.get(file) ?? file}](${relative(l.dir, file)})`;
	}
	if (state === "mapped") {
		return mappedCell(mapOf(key, l.map));
	}
	if (state === "excluded") {
		return `Excluded: ${l.exclusions[exclusionOf(key, l.exclusions) ?? ""] ?? ""}`;
	}
	return "Not on a page yet";
};

const totalOf = (rows: Row[], f: (r: Row) => number) =>
	rows.reduce((n, r) => n + f(r), 0);

const summaryOf = (rows: Row[]) => [
	"| Kind | Items | In a Docs Table | In the Map | Excluded | Not on a Page Yet |",
	"| --- | --- | --- | --- | --- | --- |",
	...rows.map(
		(r) =>
			`| [${title(r.kind)}](#${slug(r.kind)}) | ${r.items} | ${r.docs} | ${r.mapped} | ${r.excluded} | ${r.unmapped} |`,
	),
	`| Total | ${totalOf(rows, (r) => r.items)} | ${totalOf(rows, (r) => r.docs)} | ${totalOf(rows, (r) => r.mapped)} | ${totalOf(rows, (r) => r.excluded)} | ${totalOf(rows, (r) => r.unmapped)} |`,
];

const sectionsOf = (rows: Row[], snapshot: Committed, l: Lookup) =>
	rows.flatMap((r) => [
		"",
		`## ${title(r.kind)}`,
		"",
		`Items: ${r.items}.`,
		"",
		"| Item | Where |",
		"| --- | --- |",
		...(snapshot.kinds[r.kind] ?? []).map(
			({ name }) => `| ${code(name)} | ${where(l, r.kind, name)} |`,
		),
	]);

const pageOf = (rows: Row[], snapshot: Committed, l: Lookup) =>
	[
		"---",
		"title: Surface Coverage",
		`description: Every item that the Claude Code ${snapshot.version} program holds, by kind, with the page that covers it.`,
		"sidebar_position: 11",
		...(DRAFT ? ["draft: true"] : []),
		"---",
		"",
		`The program of Claude Code \`${snapshot.version}\` holds ${totalOf(rows, (r) => r.items)} items in ${rows.length} kinds.`,
		"Each row below names the page that covers an item, or the reason the item is left out.",
		"`bun run surface` makes this page from `schemas/surface.json`, so do not edit it by hand.",
		"",
		"## Summary",
		"",
		...summaryOf(rows),
		...sectionsOf(rows, snapshot, l),
		"",
	].join("\n");

// the gap column waits for the coverage page to go live
const gap = (cell: string | number) => (DRAFT ? "" : ` ${cell} |`);

const blockOf = (rows: Row[], version: string) => {
	const items = totalOf(rows, (r) => r.items);
	return [
		SECTION,
		"",
		`The program of \`${version}\` holds ${items} items in ${rows.length} kinds, counted from \`schemas/surface.json\`.`,
		...(DRAFT
			? []
			: [
					"[Surface Coverage](surface-coverage.md) lists each item with its page.",
				]),
		"",
		`| Kind | Items |${gap("Not on a Page Yet")}`,
		`| --- | --- |${gap("---")}`,
		...rows.map(
			(r) =>
				`| ${DRAFT ? title(r.kind) : `[${title(r.kind)}](surface-coverage.md#${slug(r.kind)})`} | ${r.items} |${gap(r.unmapped)}`,
		),
		`| All kinds | ${items} |${gap(totalOf(rows, (r) => r.unmapped))}`,
		"",
		"",
	].join("\n");
};

const withBlock = (undocumented: string, block: string) => {
	const at = undocumented.indexOf(`\n${SECTION}\n`);
	if (at === -1) {
		const i = undocumented.indexOf("\n## Related Pages\n");
		const cut = i === -1 ? undocumented.length : i + 1;
		return `${undocumented.slice(0, cut)}${block}${undocumented.slice(cut)}`;
	}
	const i = undocumented.indexOf("\n## ", at + 2);
	const next = i === -1 ? undocumented.length : i + 1;
	return undocumented.slice(0, at + 1) + block + undocumented.slice(next);
};

/** The coverage page and the new text of undocumented.md. */
export const render = async (
	root: string,
	snapshot: Committed,
	map: Record<string, MapEntry>,
	exclusions: Record<string, string>,
	undocumented: string,
): Promise<Rendered> => {
	const names = await docsOf(root, Object.keys(snapshot.kinds));
	const { rows } = check(snapshot, names, map, exclusions);
	const found = new Set<string>();
	for (const m of Object.values(names)) {
		for (const f of m.values()) {
			found.add(f);
		}
	}
	const files = [...found];
	const texts = await Promise.all(files.map((f) => Bun.file(f).text()));
	const titles = new Map(
		files.map((f, i) => [f, pageTitle(texts[i] ?? "", f)]),
	);
	const l: Lookup = {
		dir: join(root, "docs", "reference"),
		names,
		titles,
		map,
		exclusions,
	};
	return {
		page: pageOf(rows, snapshot, l),
		undocumented: withBlock(undocumented, blockOf(rows, snapshot.version)),
	};
};

const stalePaths = async (root: string, files: [string, string][]) => {
	const same = await Promise.all(
		files.map(async ([p, t]) => {
			const f = Bun.file(join(root, p));
			return (await f.exists()) && (await f.text()) === t;
		}),
	);
	return files.filter((_, i) => same[i] !== true);
};

const main = async (): Promise<void> => {
	const { parseArgs } = await import("node:util");
	const { values: a } = parseArgs({
		options: { check: { type: "boolean" }, root: { type: "string" } },
	});
	const root = a.root ?? join(import.meta.dir, "..", "..");
	const snapshotFile = join(root, "schemas", "surface.json");
	if (!(await Bun.file(snapshotFile).exists())) {
		console.error(
			'surface render: schemas/surface.json missing (run "bun run surface")',
		);
		process.exitCode = 2;
		return;
	}
	const dir = join(root, "tools", "surface");
	const out = await render(
		root,
		await readJson(snapshotFile, isCommitted),
		await readJson(join(dir, "map.json"), isMapRecord),
		await readJson(join(dir, "exclusions.json"), isStringRecord),
		await Bun.file(join(root, UNDOCUMENTED)).text(),
	);
	const files: [string, string][] = [
		[GENERATED, out.page],
		[UNDOCUMENTED, out.undocumented],
	];
	const stale = await stalePaths(root, files);
	if (a.check === true) {
		for (const [p] of stale) {
			console.error(
				`surface render: ${p} differs from a fresh render (run "bun run surface")`,
			);
		}
		if (stale.length > 0) {
			process.exitCode = 1;
			return;
		}
		console.info("surface render: pages match the snapshot");
		return;
	}
	await Promise.all(stale.map(([p, t]) => Bun.write(join(root, p), t)));
	console.info(
		`surface render: wrote ${stale.length} of ${files.length} files`,
	);
};

if (import.meta.main) {
	await main();
}
