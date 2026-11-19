// The command line of coverage.ts: loads the snapshot, the map, and the exclusions, then prints the check.
// It prints the counts by kind, then fails on unmapped items (as `<kind>:<name>`, 20 for each kind unless --all)
// and on stale entries: a map or exclusion key that matches no item. --kind limits the check to some kinds.
// --fix rewrites map.json and exclusions.json first: a stale entry carries to the unmapped key that rewords it (carry.ts), the rest are removed.
import { join } from "node:path";
import { parseArgs } from "node:util";

import { carryPairs } from "./carry.ts";
import {
	check,
	docsNames,
	isRecord,
	type MapEntry,
	PAGES,
	type Row,
	shape,
	table,
} from "./coverage.ts";
import type { Committed } from "./snapshot.ts";

const ROOT = join(import.meta.dir, "..", "..");
const SHOWN = 20;

/** A guard for the committed snapshot: the version and the kinds. */
export const isCommitted = (v: unknown): v is Committed =>
	isRecord(v) && typeof v["version"] === "string" && isRecord(v["kinds"]);
/** A guard for the map JSON object; `shape` checks its values. */
export const isMapRecord = (v: unknown): v is Record<string, MapEntry> =>
	isRecord(v);
/** A guard for the exclusions JSON object; `shape` checks its values. */
export const isStringRecord = (v: unknown): v is Record<string, string> =>
	isRecord(v);

/** Read a JSON file and narrow it with a guard. */
export const readJson = async <T>(
	file: string,
	guard: (v: unknown) => v is T,
): Promise<T> => {
	const data: unknown = JSON.parse(await Bun.file(file).text());
	if (!guard(data)) {
		throw new Error(`${file} does not have the expected shape`);
	}
	return data;
};

const report = (
	rows: Row[],
	unmapped: string[],
	all: boolean | undefined,
	problems: string[],
	stale: string[],
): void => {
	for (const p of problems) {
		console.error(`surface:check: ${p}`);
	}
	for (const r of rows) {
		const list = unmapped.filter((k) => k.startsWith(`${r.kind}:`));
		if (list.length === 0) {
			continue;
		}
		console.error(`surface:check: ${list.length} unmapped ${r.kind} items`);
		for (const k of all === true ? list : list.slice(0, SHOWN)) {
			console.error(`  ${k}`);
		}
		if (all !== true && list.length > SHOWN) {
			console.error(`  ... ${list.length - SHOWN} more (--all lists them)`);
		}
	}
	for (const s of stale) {
		console.error(`surface:check: stale entry ${s}`);
	}
};

/** The docs names of each kind, read from the pages of that kind. */
export const docsOf = async (
	root: string,
	kinds: string[],
): Promise<Record<string, Map<string, string>>> => {
	const found = await Promise.all(
		kinds.map((k) => docsNames(root, PAGES[k] ?? [])),
	);
	const docs: Record<string, Map<string, string>> = {};
	for (const [i, kind] of kinds.entries()) {
		docs[kind] = found[i] ?? new Map<string, string>();
	}
	return docs;
};

const rulesOf = async (root: string) => {
	const dir = join(root, "tools", "surface");
	return {
		map: await readJson(join(dir, "map.json"), isMapRecord),
		exclusions: await readJson(join(dir, "exclusions.json"), isStringRecord),
	};
};

/** Rename a key in place, so the order of the keys, and so the git diff, stays as it is. */
const renamed = <T>(
	entries: Record<string, T>,
	from: string,
	to: string,
): Record<string, T> =>
	Object.fromEntries(
		Object.entries(entries).map(([k, v]) => [k === from ? to : k, v]),
	);

const staleKeys = (stale: string[], file: string): string[] =>
	stale
		.filter((s) => s.startsWith(`${file}: `))
		.map((s) => s.slice(file.length + 2));

/** Carry the stale entries that reword an unmapped key, remove the other stale entries, and write both files. */
const fix = async (
	root: string,
	result: { unmapped: string[]; stale: string[] },
	rules: {
		map: Record<string, MapEntry>;
		exclusions: Record<string, string>;
	},
): Promise<void> => {
	const dir = join(root, "tools", "surface");
	const files = [
		["map.json", rules.map],
		["exclusions.json", rules.exclusions],
	] as const;
	let left = result.unmapped;
	const writes = files.map(([file, original]) => {
		const stale = staleKeys(result.stale, file);
		const carried = carryPairs(left, stale);
		left = left.filter((k) => !carried.some(([, to]) => to === k));
		const gone = new Set(carried.map(([from]) => from));
		const removed = stale.filter((k) => !gone.has(k));
		let entries: Record<string, unknown> = original;
		for (const [from, to] of carried) {
			entries = renamed(entries, from, to);
			console.info(`carried ${file}: ${from} -> ${to}`);
		}
		for (const key of removed) {
			console.info(`removed ${file}: ${key}`);
		}
		const kept = Object.entries(entries).filter(([k]) => !removed.includes(k));
		return Bun.write(
			join(dir, file),
			`${JSON.stringify(Object.fromEntries(kept), null, "\t")}\n`,
		);
	});
	await Promise.all(writes);
};

/** Run the check from the command line; failures set `process.exitCode`. */
export const main = async (): Promise<void> => {
	const { values: a } = parseArgs({
		options: {
			kind: { type: "string" },
			all: { type: "boolean" },
			root: { type: "string" },
			fix: { type: "boolean" },
		},
	});
	const root = a.root ?? ROOT;
	const snapshotFile = join(root, "schemas", "surface.json");
	if (!(await Bun.file(snapshotFile).exists())) {
		console.error(
			'surface:check: schemas/surface.json missing (run "bun run surface")',
		);
		process.exitCode = 2;
		return;
	}
	const snapshot = await readJson(snapshotFile, isCommitted);
	const only = a.kind?.split(",");
	const unknown = (only ?? []).filter((k) => !(k in snapshot.kinds));
	if (unknown.length > 0) {
		console.error(
			`surface:check: unknown kind ${unknown.join(", ")}; kinds: ${Object.keys(snapshot.kinds).join(", ")}`,
		);
		process.exitCode = 2;
		return;
	}
	let rules = await rulesOf(root);
	const docs = await docsOf(root, only ?? Object.keys(snapshot.kinds));
	let result = check(snapshot, docs, rules.map, rules.exclusions, only);
	if (a.fix === true) {
		await fix(root, result, rules);
		rules = await rulesOf(root);
		result = check(snapshot, docs, rules.map, rules.exclusions, only);
	}
	const { map, exclusions } = rules;
	const { rows, unmapped, stale } = result;
	const problems = shape(map, exclusions);
	console.info(`Claude Code ${snapshot.version}\n${table(rows)}`);
	report(rows, unmapped, a.all, problems, stale);
	if (problems.length > 0 || unmapped.length > 0 || stale.length > 0) {
		process.exitCode = 1;
		return;
	}
	console.info("surface:check: every item is mapped or excluded");
};
