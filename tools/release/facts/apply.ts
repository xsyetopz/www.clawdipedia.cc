// The map of release:facts: map.json, the names in diff/*.json, and the status each fact gets from them.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isRecord } from "../../surface/coverage.ts";
import { pathExists } from "../lib/fs.ts";
import { CAPTURES } from "../util.ts";
import type { Fact, FactMap, Kind, Status } from "./types.ts";

export const MAP_PATH = join(import.meta.dir, "map.json");
const DIFF_KIND: Record<string, Kind> = {
	"strings-env.json": "env",
	"flags.json": "flag",
	"commands.json": "command",
	"settings.json": "setting",
	"hooks.json": "hook",
	"gates.json": "gate",
};
// Kinds that name a place to look (diff/*.json, schemas/) or say nothing needs a re-check; only `behaviour` needs a probe.
const NO_PROBE = new Set<Kind>([...Object.values(DIFF_KIND), "schema"]);

type DiffNames = Map<string, Kind>;

/** Whether a value could be a fact map (the file is repo-owned, so only the outer shape is checked). */
export const isFactMap = (v: unknown): v is FactMap => isRecord(v);

export const readMap = async (path = MAP_PATH): Promise<FactMap> => {
	if (!(await pathExists(path))) {
		return {};
	}
	const data: unknown = await Bun.file(path).json();
	if (!isFactMap(data)) {
		throw new Error(`${path} is not an object`);
	}
	return data;
};

const diffDirs = async (to: string, base: string): Promise<string[]> => {
	const entries = (await pathExists(base)) ? await readdir(base) : [];
	const versions = entries
		.filter((n) => /^\d+\.\d+\.\d+$/u.test(n))
		.toSorted((a, b) => b.localeCompare(a, undefined, { numeric: true }));
	return [
		join(base, to, "diff"),
		...versions.map((v) => join(base, v, "diff")),
	];
};

const namesIn = async (dir: string, file: string): Promise<string[]> => {
	const p = join(dir, file);
	if (!(await pathExists(p))) {
		return [];
	}
	const data: unknown = await Bun.file(p).json();
	const items = isRecord(data) ? data["items"] : undefined;
	return isRecord(items) ? Object.keys(items) : [];
};

/** Names in the latest captures/<v>/diff/*.json (the `to` dir when it has one, else the newest). */
export const loadDiffNames = async (
	to: string,
	base = CAPTURES,
): Promise<DiffNames | null> => {
	const dirs = await diffDirs(to, base);
	const has = await Promise.all(
		dirs.map((d) => pathExists(join(d, "flags.json"))),
	);
	const dir = dirs.find((_, i) => has[i] === true);
	if (dir === undefined) {
		return null;
	}
	const kinds = Object.entries(DIFF_KIND);
	const found = await Promise.all(kinds.map(([f]) => namesIn(dir, f)));
	const names: DiffNames = new Map();
	for (const [i, [, kind]] of kinds.entries()) {
		for (const n of found[i] ?? []) {
			if (!names.has(n)) {
				names.set(n, kind);
			}
		}
	}
	return names;
};

/** The subject of a table row: the first backticked token in the first cell, with a trailing argument cut off. */
const subject = (text: string): string | null => {
	if (!text.startsWith("|")) {
		return null;
	}
	const cell = text.split(/(?<!\\)\|/u)[1] ?? "";
	const first = /`([^`]+)`/u.exec(cell)?.[1];
	return first === undefined ? null : (first.split(/\s/u)[0] ?? null);
};

// The row subject, when diff/ has it or map.json gives a diff kind (so compare can look it up without diff/).
const namesOf = (
	subj: string | null,
	diff: DiffNames | null,
	kind: Kind | undefined,
): string[] => {
	if (subj === null || subj === "") {
		return [];
	}
	const known =
		diff?.has(subj) === true || (kind !== undefined && NO_PROBE.has(kind));
	return known ? [subj] : [];
};

const statusOf = (kind: Kind | null, probes: string[]): Status => {
	if (kind === "static" || kind === "external") {
		return "static";
	}
	if (kind === "manual") {
		return "mapped";
	}
	return kind !== null && (NO_PROBE.has(kind) || probes.length > 0)
		? "mapped"
		: "unmapped";
};

/** Apply map.json, then automatic kinds: a table row whose subject name is in diff/*.json. */
export const applyMap = (
	facts: Fact[],
	map: FactMap,
	diff: DiffNames | null,
): Fact[] =>
	facts.map((c) => {
		const e = map[c.id];
		const names = namesOf(subject(c.text), diff, e?.kind);
		let kind: Kind | null = null;
		let probes: string[] = [];
		if (e !== undefined) {
			kind = e.kind;
			probes = e.probes;
		} else if (names.length > 0 && diff !== null) {
			kind = diff.get(names[0] ?? "") ?? null;
		}
		return {
			...c,
			kind,
			probes,
			status: statusOf(kind, probes),
			...(names.length > 0 ? { diffNames: names } : {}),
		};
	});
