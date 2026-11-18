// Value-free field shapes of transcript lines. A schema audit compares these shapes with the schema, so the
// output keeps key paths and JSON type counts only, never a value.
import type { Line } from "./sessions.ts";

/** JSON type counts at each key path, such as `{"system.foldedUuids[]": {"string": 3}}`. */
export type FieldTypes = Record<string, Record<string, number>>;

const MAX_DEPTH = 8;

const typeOf = (v: unknown): string => {
	if (v === null) {
		return "null";
	}
	if (Array.isArray(v)) {
		return "array";
	}
	return typeof v === "number" && Number.isInteger(v) ? "integer" : typeof v;
};

const add = (
	into: FieldTypes,
	path: string,
	v: unknown,
	depth: number,
): void => {
	const t = typeOf(v);
	const c = into[path] ?? {};
	into[path] = c;
	c[t] = (c[t] ?? 0) + 1;
	if (depth >= MAX_DEPTH) {
		return;
	}
	if (Array.isArray(v)) {
		for (const item of v) {
			add(into, `${path}[]`, item, depth + 1);
		}
		return;
	}
	if (typeof v === "object" && v !== null) {
		for (const [k, item] of Object.entries(v)) {
			add(into, `${path}.${k}`, item, depth + 1);
		}
	}
};

/**
 * Adds the key paths and JSON types of each JSON line to `into`, rooted at the line's `type` (`?` when it has none).
 * Array items take the path `<array>[]`. A `match` keeps only the paths it accepts.
 */
export const scanFields = (
	lines: Line[],
	match?: RegExp,
	into: FieldTypes = {},
): FieldTypes => {
	const all: FieldTypes = {};
	for (const l of lines) {
		if (l.json === undefined) {
			continue;
		}
		const root = typeof l.json.type === "string" ? l.json.type : "?";
		for (const [k, v] of Object.entries(l.json)) {
			add(all, `${root}.${k}`, v, 1);
		}
	}
	for (const [path, types] of Object.entries(all)) {
		if (match !== undefined && !match.test(path)) {
			continue;
		}
		const c = into[path] ?? {};
		into[path] = c;
		for (const [t, n] of Object.entries(types)) {
			c[t] = (c[t] ?? 0) + n;
		}
	}
	return into;
};
