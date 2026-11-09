// Usage: bun tools/surface/coverage.ts [--kind <a,b>] [--all] [--root <dir>]   (also: bun run surface:check)
// Every item of schemas/surface.json must be covered (design D4) by one of:
//   1. a docs table row whose first cell names it in backticks, exactly, on a page of its kind (PAGES below);
//   2. an entry of tools/surface/map.json: { "<kind>:<name>": { "route": "/path", "anchor": "id" } };
//      for the `error` kind only, a key ending in `*` maps a family by its stable prefix (design D3);
//   3. an entry of tools/surface/exclusions.json: { "<kind>:<name>" or "<kind>:<prefix>*": "reason" }.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import type { Committed } from "./snapshot.ts";

/** The shortest prefix of an `error:` key ending in `*`: a shorter one would also cover errors that nobody has seen. */
const MIN_PREFIX = 8;

/** The docs pages (a file, or a folder read in full) whose tables name the items of a kind. */
export const PAGES: Record<string, string[]> = {
	env: ["docs/configure/env-vars"],
	flag: ["docs/configure/cli"],
	subcommand: ["docs/configure/cli"],
	"slash-command": [
		"docs/configure/cli",
		"docs/extend/skills-and-commands/slash-commands.md",
	],
	setting: ["docs/configure/settings"],
	"setting-key": ["docs/configure", "docs/extend"],
	"permission-rule": ["docs/configure/permissions"],
	"hook-event": ["docs/extend/hooks"],
	"mod-api": ["docs/extend/mod-api"],
	tool: ["docs/reference/tools"],
	"otel-event": ["docs/reference/opentelemetry.md"],
	gate: ["docs"],
	model: ["docs/configure/models-and-providers"],
	beta: ["docs/reference/api/betas.md"],
	endpoint: ["docs/reference/api/endpoints.md"],
	keybinding: ["docs/configure/keybindings"],
	file: ["docs/start/files-on-disk.md"],
	error: ["docs"],
};

export interface MapEntry {
	route: string;
	anchor?: string;
}
export interface Row {
	kind: string;
	items: number;
	docs: number;
	mapped: number;
	excluded: number;
	unmapped: number;
}
export interface Result {
	rows: Row[];
	unmapped: string[];
	stale: string[];
}

/** Byte order of two strings, the order of `Array#sort()` without an argument. */
export const compare = (a: string, b: string): number =>
	Number(a > b) - Number(a < b);

const markdown = async (path: string): Promise<string[]> => {
	const info = await stat(path).catch(() => null);
	if (info === null) {
		return [];
	}
	if (!info.isDirectory()) {
		return /\.mdx?$/u.test(path) ? [path] : [];
	}
	const files = await readdir(path);
	files.sort(compare);
	const found = await Promise.all(files.map((f) => markdown(join(path, f))));
	return found.flat();
};

/** The page that render.ts writes from the snapshot: it names every item, so it covers none. */
export const GENERATED = "docs/reference/surface-coverage.md";

const namesOf = (text: string): string[] => {
	const found: string[] = [];
	for (const line of text.split("\n")) {
		if (!line.trimStart().startsWith("|")) {
			continue;
		}
		const cell =
			line
				.trimStart()
				.slice(1)
				.split(/(?<!\\)\|/u)[0] ?? "";
		for (const m of cell.matchAll(/`([^`\n]+)`/gu)) {
			found.push((m[1] ?? "").replaceAll(String.raw`\|`, "|"));
		}
	}
	return found;
};

/** The exact backticked names in the name cell (the first) of the table rows of the pages, each with its first file. A missing page names nothing. */
export const docsNames = async (
	root: string,
	pages: string[],
): Promise<Map<string, string>> => {
	const listed = await Promise.all(pages.map((p) => markdown(join(root, p))));
	const files = listed.flat().filter((f) => f !== join(root, GENERATED));
	const texts = await Promise.all(files.map((f) => Bun.file(f).text()));
	const names = new Map<string, string>();
	const pairs = files.flatMap((file, i) =>
		namesOf(texts[i] ?? "").map((name): [string, string] => [name, file]),
	);
	for (const [name, file] of pairs) {
		if (!names.has(name)) {
			names.set(name, file);
		}
	}
	return names;
};

const kindOf = (key: string) => key.slice(0, Math.max(key.indexOf(":"), 0));

export type Names = Record<string, { has: (name: string) => boolean }>;
export type Status = "docs" | "mapped" | "excluded" | "unmapped";

/** How one item is covered, in the order of design D4. An exclusion key ending in `*` is a prefix. */
export const status = (
	kind: string,
	name: string,
	docs: Names,
	map: Record<string, MapEntry>,
	exclusions: Record<string, string>,
): Status => {
	const key = `${kind}:${name}`;
	if (docs[kind]?.has(name) === true) {
		return "docs";
	}
	if (mapOf(key, map)) {
		return "mapped";
	}
	if (exclusionOf(key, exclusions) !== undefined) {
		return "excluded";
	}
	return "unmapped";
};

/** The map entry of an item key: the key itself, or for an `error` item the longest matching prefix key. */
export const mapOf = (
	key: string,
	map: Record<string, MapEntry>,
): MapEntry | undefined => {
	if (key in map) {
		return map[key];
	}
	if (!key.startsWith("error:")) {
		return undefined;
	}
	const prefix = Object.keys(map)
		.filter((p) => p.startsWith("error:") && p.endsWith("*"))
		.filter((p) => key.startsWith(p.slice(0, -1)))
		.toSorted((a, b) => b.length - a.length)[0];
	return prefix === undefined ? undefined : map[prefix];
};

/** The exclusion key that covers an item key: the key itself or a matching prefix. */
export const exclusionOf = (
	key: string,
	exclusions: Record<string, string>,
): string | undefined =>
	key in exclusions
		? key
		: Object.keys(exclusions).find(
				(p) => p.endsWith("*") && key.startsWith(p.slice(0, -1)),
			);

const staleOf = (
	file: string,
	list: string[],
	keys: Set<string>,
	left: (key: string) => boolean,
): string[] =>
	list
		.filter((key) => !left(key))
		.filter((key) =>
			key.endsWith("*")
				? ![...keys].some((k) => k.startsWith(key.slice(0, -1)))
				: !keys.has(key),
		)
		.map((key) => `${file}: ${key}`);

/** Check the snapshot against the docs names, the map, and the exclusions. `only` limits the kinds. */
export const check = (
	snapshot: Committed,
	docs: Names,
	map: Record<string, MapEntry>,
	exclusions: Record<string, string>,
	only?: string[],
): Result => {
	const kinds = only ?? Object.keys(snapshot.kinds);
	const keys = new Set<string>();
	const rows: Row[] = [];
	const unmapped: string[] = [];
	for (const kind of kinds) {
		const row: Row = {
			kind,
			items: 0,
			docs: 0,
			mapped: 0,
			excluded: 0,
			unmapped: 0,
		};
		for (const { name } of snapshot.kinds[kind] ?? []) {
			const key = `${kind}:${name}`;
			keys.add(key);
			row.items++;
			const s = status(kind, name, docs, map, exclusions);
			row[s]++;
			if (s === "unmapped") {
				unmapped.push(key);
			}
		}
		rows.push(row);
	}
	// an entry of a kind that --kind left out is not stale
	const left = (key: string) =>
		!kinds.includes(kindOf(key)) &&
		only !== undefined &&
		Object.keys(snapshot.kinds).includes(kindOf(key));
	const stale = [
		...staleOf("map.json", Object.keys(map), keys, left),
		...staleOf("exclusions.json", Object.keys(exclusions), keys, left),
	];
	return { rows, unmapped, stale };
};

/** Whether a value is a plain object. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const hasRoute = (v: unknown) =>
	isRecord(v) && typeof v["route"] === "string" && v["route"].startsWith("/");
const shortPrefix = (k: string) =>
	k.startsWith("error:") &&
	k.endsWith("*") &&
	k.length - "error:".length - 1 < MIN_PREFIX;
const hasReason = (v: unknown) => typeof v === "string" && v.trim() !== "";

/** Problems with the shape of the map and the exclusions. */
export const shape = (
	map: Record<string, MapEntry>,
	exclusions: Record<string, string>,
): string[] => {
	const bad: string[] = [];
	for (const [k, v] of Object.entries(map)) {
		if (!hasRoute(v)) {
			bad.push(`map.json: ${k} needs a route that starts with "/"`);
		}
	}
	for (const k of Object.keys(map)) {
		if (k.endsWith("*") && !k.startsWith("error:")) {
			bad.push(
				`map.json: ${k} ends in "*", a prefix key only for the error kind`,
			);
		}
	}
	for (const [k, v] of Object.entries(exclusions)) {
		if (!hasReason(v)) {
			bad.push(`exclusions.json: ${k} needs a non-empty reason`);
		}
	}
	for (const [file, keys] of [
		["map.json", Object.keys(map)],
		["exclusions.json", Object.keys(exclusions)],
	] as const) {
		for (const p of keys.filter((q) => shortPrefix(q))) {
			bad.push(
				`${file}: ${p} needs a prefix of ${MIN_PREFIX} characters or more before the *`,
			);
		}
	}
	return bad;
};

export { table } from "./coverage-table.ts";

if (import.meta.main) {
	const { main } = await import("./coverage-cli.ts");
	await main();
}
