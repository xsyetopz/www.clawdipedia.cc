// Observed types for the schemas that code.ts reads from the program's code (status line, transcript,
// OpenTelemetry, frontmatter, ~/.claude.json). A fixture per schema in tools/schemas/observed/ maps a field
// path to the JSON types that real payloads had there, with sample counts and no value. code.ts adds
// "x-observed-type" to a field that is still "x-unverified" and has enough samples.
//
// "x-unverified" keeps its meaning (the code does not show the type); observation does not remove it.
//
// A path is `<$def>.<key>.<key>`, with `[]` after an array's property (`event:tool_result.tool_name`,
// `assistant.message.usage.speed`, `subagentStatusLineInput.tasks[].id`); a property of the root object
// has no `<$def>` part.
import { join } from "node:path";

import { sortedStrings } from "./sorted.ts";

type Json = Record<string, unknown>;

const isJson = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const isSeen = (v: unknown): v is Seen =>
	isJson(v) && Object.values(v).every((c) => typeof c === "number");

const isFixture = (v: unknown): v is Fixture =>
	isJson(v) &&
	typeof v["$comment"] === "string" &&
	typeof v["version"] === "string" &&
	isJson(v["fields"]) &&
	Object.values(v["fields"]).every((x) => isSeen(x));

export const OBSERVED_DIR = join(import.meta.dir, "observed");
/** Non-null samples a field needs before its types are written to the schema. */
export const MIN_SAMPLES = 3;
/** A count above this is stored as this: the fixture says "at least", and never leaks an exact volume. */
export const COUNT_CAP = 100;

/** JSON types seen at a path, with a (capped) count each. `integer` is kept apart from `number`. */
export type Seen = Record<string, number>;
export interface Fixture {
	$comment: string;
	/** Claude Code version the fixture was last merged from. */
	version: string;
	fields: Record<string, Seen>;
}

export const fixturePath = (schemaFile: string): string =>
	join(OBSERVED_DIR, schemaFile);

export const readFixture = async (
	schemaFile: string,
): Promise<Fixture | undefined> => {
	const file = Bun.file(fixturePath(schemaFile));
	if (!(await file.exists())) {
		return undefined;
	}
	const parsed: unknown = await file.json();
	if (!isFixture(parsed)) {
		throw new TypeError(
			`${fixturePath(schemaFile)} is not an observed fixture`,
		);
	}
	return parsed;
};

/** A deep copy that gives every position its own node, so a node shared between fields is not shared in the copy. */
export const cloneTree = (v: Json): Json => {
	const copy = (x: unknown): unknown => {
		if (Array.isArray(x)) {
			return x.map((item) => copy(item));
		}
		if (isJson(x)) {
			return Object.fromEntries(
				Object.entries(x).map(([k, item]) => [k, copy(item)]),
			);
		}
		return x;
	};
	return Object.fromEntries(
		Object.entries(v).map(([k, item]) => [k, copy(item)]),
	);
};

type Walk = (n: unknown, path: string, isRoot: boolean) => void;

const children = (k: string, v: unknown, path: string, walk: Walk): void => {
	if (k === "properties" && isJson(v)) {
		for (const [p, s] of Object.entries(v)) {
			walk(s, path === "" ? p : `${path}.${p}`, false);
		}
	} else if (k === "items") {
		walk(v, `${path}[]`, false);
	} else if (k === "$defs" && isJson(v)) {
		for (const [p, s] of Object.entries(v)) {
			walk(s, p, true);
		}
	} else if (["anyOf", "oneOf", "allOf", "additionalProperties"].includes(k)) {
		walk(v, path, true);
	}
};

/** Call `visit` for every property node of a schema, with its path. */
export const walkFields = (
	schema: Json,
	visit: (path: string, node: Json) => void,
): void => {
	const walk = (n: unknown, path: string, isRoot: boolean): void => {
		if (Array.isArray(n)) {
			for (const x of n) {
				walk(x, path, true);
			}
			return;
		}
		if (!isJson(n)) {
			return;
		}
		if (!isRoot && path !== "") {
			visit(path, n);
		}
		for (const [k, v] of Object.entries(n)) {
			children(k, v, path, walk);
		}
	};
	walk(schema, "", true);
};

/** Paths of the properties that carry "x-unverified". */
export const unverifiedPaths = (schema: Json): string[] => {
	const acc: string[] = [];
	walkFields(schema, (p, n) => {
		if (n["x-unverified"] === true) {
			acc.push(p);
		}
	});
	return acc;
};

/** The schema type names for what was seen: `integer` folds into `number`; `null` stays. Sorted. */
export const typeNames = (seen: Seen): string[] =>
	sortedStrings([
		...new Set(Object.keys(seen).map((t) => (t === "integer" ? "number" : t))),
	]);

const nonNull = (seen: Seen): number =>
	Object.entries(seen).reduce((a, [t, c]) => a + (t === "null" ? 0 : c), 0);

/**
 * Add "x-observed-type" (a sorted list of JSON type names, "null" included when seen) to each field that is
 * still "x-unverified" and has MIN_SAMPLES non-null samples in the fixture. Works on a copy, because the
 * builders share one `{ "x-unverified": true }` node between fields. Returns the copy and how many it marked.
 */
export const applyObserved = async (
	schemaFile: string,
	input: Json,
	fixture?: Fixture,
): Promise<{ schema: Json; n: number }> => {
	const fx = fixture ?? (await readFixture(schemaFile));
	if (fx === undefined) {
		return { schema: input, n: 0 };
	}
	const schema = cloneTree(input);
	let n = 0;
	walkFields(schema, (path, node) => {
		const seen = fx.fields[path];
		if (seen === undefined || node["x-unverified"] !== true) {
			return;
		}
		if (nonNull(seen) < MIN_SAMPLES) {
			return;
		}
		node["x-observed-type"] = typeNames(seen);
		n++;
	});
	return { schema, n };
};
