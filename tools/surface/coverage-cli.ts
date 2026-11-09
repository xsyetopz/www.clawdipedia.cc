// The command line of coverage.ts: loads the snapshot, the map, and the exclusions, then prints the check.
// It prints the counts by kind, then fails on unmapped items (as `<kind>:<name>`, 20 for each kind unless --all)
// and on stale entries: a map or exclusion key that matches no item. --kind limits the check to some kinds.
import { join } from "node:path";
import { parseArgs } from "node:util";

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

/** Run the check from the command line; failures set `process.exitCode`. */
export const main = async (): Promise<void> => {
	const { values: a } = parseArgs({
		options: {
			kind: { type: "string" },
			all: { type: "boolean" },
			root: { type: "string" },
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
	const { map, exclusions } = await rulesOf(root);
	const docs = await docsOf(root, only ?? Object.keys(snapshot.kinds));
	const { rows, unmapped, stale } = check(
		snapshot,
		docs,
		map,
		exclusions,
		only,
	);
	const problems = shape(map, exclusions);
	console.info(`Claude Code ${snapshot.version}\n${table(rows)}`);
	report(rows, unmapped, a.all, problems, stale);
	if (problems.length > 0 || unmapped.length > 0 || stale.length > 0) {
		process.exitCode = 1;
		return;
	}
	console.info("surface:check: every item is mapped or excluded");
};
