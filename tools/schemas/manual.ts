// Types read by hand from the program's code, for fields the generator leaves "x-unverified". A fixture per
// schema in tools/schemas/manual/ maps a field path (the format of observed.ts) to its type and to anchors:
// strings copied from the program at the code that writes the field. code.ts applies an entry only when every
// anchor is still in the program; then the field gets the type and loses "x-unverified", because the code shows
// it. An entry whose anchor is gone, or whose path is no longer unverified, is stale.
import { join } from "node:path";

import {
	cloneTree,
	type Fixture,
	readFixture,
	type Seen,
	typeNames,
	walkFields,
} from "./observed.ts";

type Json = Record<string, unknown>;

export interface ManualEntry {
	/** The JSON Schema of every value the program can write here. */
	schema: Json;
	/** Strings copied from the program at the write sites, each found in it as is. */
	anchors: string[];
	/** Where and why: the write sites and how the type follows from them. */
	note: string;
}
export interface ManualFixture {
	$comment: string;
	version: string;
	fields: Record<string, ManualEntry>;
}

export const MANUAL_DIR = join(import.meta.dir, "manual");

const isRecord = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const isManualEntry = (v: unknown): v is ManualEntry =>
	isRecord(v) &&
	isRecord(v["schema"]) &&
	Array.isArray(v["anchors"]) &&
	v["anchors"].every((a) => typeof a === "string") &&
	typeof v["note"] === "string";
const isManualFixture = (v: unknown): v is ManualFixture =>
	isRecord(v) &&
	typeof v["$comment"] === "string" &&
	typeof v["version"] === "string" &&
	isRecord(v["fields"]) &&
	Object.values(v["fields"]).every((e) => isManualEntry(e));

export const readManual = async (
	schemaFile: string,
): Promise<ManualFixture | undefined> => {
	const file = Bun.file(join(MANUAL_DIR, schemaFile));
	if (!(await file.exists())) {
		return undefined;
	}
	const fixture: unknown = await file.json();
	if (!isManualFixture(fixture)) {
		throw new Error(`${schemaFile}: not a manual fixture`);
	}
	return fixture;
};

/** In an anchor, stands for one identifier, because the minifier renames them each release. */
export const ID = "«»";

/** The longest of the fixed parts of an anchor, which is the best thing to search for. */
const longest = (parts: string[]): string => {
	let key = "";
	for (const p of parts) {
		if (p.length > key.length) {
			key = p;
		}
	}
	return key;
};

/** Whether the pattern for `parts` matches near a hit of its longest fixed part. */
const matchNearKey = (
	program: string,
	anchor: string,
	parts: string[],
	key: string,
): boolean => {
	const re = new RegExp(
		parts
			.map((p) => p.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`))
			.join(String.raw`[\w$]+`),
		"u",
	);
	// Test the pattern on the text around each hit (an identifier is at most 64 characters).
	const i = parts.indexOf(key);
	const left = parts.slice(0, i).join("").length + 64 * i;
	const right = anchor.length + 64 * parts.length;
	let at = program.indexOf(key);
	while (at !== -1) {
		if (re.test(program.slice(Math.max(0, at - left), at + right))) {
			return true;
		}
		at = program.indexOf(key, at + 1);
	}
	return false;
};

/** A test of whether an anchor is in `program`, with each `«»` matching one identifier. */
export const anchorIn = (program: string): ((anchor: string) => boolean) => {
	const memo = new Map<string, boolean>();
	return (anchor) => {
		const parts = anchor.split(ID);
		if (parts.length === 1) {
			return program.includes(anchor);
		}
		const known = memo.get(anchor);
		if (known !== undefined) {
			return known;
		}
		// Search the longest fixed part first.
		const key = longest(parts);
		if (key.length < 4) {
			return false;
		}
		const hit = matchNearKey(program, anchor, parts, key);
		memo.set(anchor, hit);
		return hit;
	};
};

const valueType = (v: unknown): string => {
	if (v === null) {
		return "null";
	}
	return Array.isArray(v) ? "array" : typeof v;
};

/** The JSON type names a leaf schema allows, or undefined when it allows any. */
const leafTypes = (x: Json): string[] | undefined => {
	const t = x["type"];
	if (Array.isArray(t) || (typeof t === "string" && t !== "")) {
		const names: unknown[] = Array.isArray(t) ? t : [t];
		return names.filter((n) => typeof n === "string");
	}
	if ("const" in x) {
		return [valueType(x["const"])];
	}
	const values = x["enum"];
	return Array.isArray(values) ? values.map((v) => valueType(v)) : undefined;
};

/** JSON type names a schema allows, or undefined when it allows any (no type, or a $ref). */
const allowed = (s: Json): Set<string> | undefined => {
	const out = new Set<string>();
	const add = (x: Json): boolean => {
		const alt = Array.isArray(x["anyOf"]) ? x["anyOf"] : x["oneOf"];
		if (Array.isArray(alt)) {
			return alt.every((a) => isRecord(a) && add(a));
		}
		const names = leafTypes(x);
		if (names === undefined) {
			return false;
		}
		for (const n of names) {
			out.add(n === "integer" ? "number" : n);
		}
		return true;
	};
	return add(s) ? out : undefined;
};

/** Types real payloads had at a field that its hand-read schema does not allow. */
export const missedObserved = (schema: Json, seen: Seen): string[] => {
	const ok = allowed(schema);
	return ok ? typeNames(seen).filter((t) => !ok.has(t)) : [];
};

/**
 * Give each "x-unverified" field with a live entry its hand-read type. Works on a copy, because the builders
 * share one `{ "x-unverified": true }` node between fields. `has` tells if a string is in the program. `missed` lists
 * the types real payloads had (tools/schemas/observed/) that the entry does not allow.
 */
export const applyManual = async (
	schemaFile: string,
	input: Json,
	has: (s: string) => boolean,
	manual?: ManualFixture,
	seen?: Fixture["fields"],
): Promise<{ schema: Json; n: number; stale: string[]; missed: string[] }> => {
	const fx = manual ?? (await readManual(schemaFile));
	const fixture =
		seen === undefined ? await readFixture(schemaFile) : undefined;
	const observed = seen ?? fixture?.fields ?? {};
	if (fx === undefined) {
		return { schema: input, n: 0, stale: [], missed: [] };
	}
	const schema = cloneTree(input);
	const used = new Set<string>();
	const stale: string[] = [];
	const missed: string[] = [];
	let n = 0;
	walkFields(schema, (path, node) => {
		const e = fx.fields[path];
		if (e === undefined || node["x-unverified"] !== true) {
			return;
		}
		used.add(path);
		const gone = e.anchors.filter((a) => !has(a));
		if (e.anchors.length === 0 || gone.length > 0) {
			stale.push(`${path}: anchor not in the program: ${gone.join(" | ")}`);
			return;
		}
		delete node["x-unverified"];
		Object.assign(node, e.schema);
		n++;
		const seenAt = observed[path];
		const miss = seenAt === undefined ? [] : missedObserved(e.schema, seenAt);
		if (miss.length > 0) {
			missed.push(`${path}: real payloads also had ${miss.join(", ")}`);
		}
	});
	for (const p of Object.keys(fx.fields)) {
		if (!used.has(p)) {
			stale.push(`${p}: no x-unverified field at this path`);
		}
	}
	return { schema, n, stale, missed };
};
