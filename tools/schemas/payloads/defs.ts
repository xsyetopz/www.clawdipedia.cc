// Helpers of payloads/build.ts: reference rewriting, definition merging, inlining, and size limits.
import type { Json } from "../build.ts";

export const isObject = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

export const REF = /^#\/\$defs\//u;

const rewriteRef = (v: string, own: string, prefix: string): string => {
	if (v === "#") {
		return `#/$defs/${own}`;
	}
	return v.startsWith("#/$defs/")
		? `#/$defs/${prefix}${v.replace(REF, "")}`
		: v;
};

// Rewrites every "#" and "#/$defs/x" reference of one captured schema so it points into the combined document.
export const rewriteRefs = (
	node: unknown,
	own: string,
	prefix: string,
): unknown => {
	if (Array.isArray(node)) {
		return node.map((x) => rewriteRefs(x, own, prefix));
	}
	if (!isObject(node)) {
		return node;
	}
	const out: Json = {};
	for (const [k, v] of Object.entries(node)) {
		if (k === "$ref" && typeof v === "string") {
			out[k] = rewriteRef(v, own, prefix);
		} else {
			out[k] = rewriteRefs(v, own, prefix);
		}
	}
	return out;
};

export const dropMeta = (schema: Json): Json => {
	const { $schema: _s, ...rest } = schema;
	void _s;
	return rest;
};

/** Adds one captured schema to `defs` under `name`; its own $defs move up as `<name>__<local name>`. */
export const addDef = (
	defs: Json,
	name: string,
	schema: Json,
	prefix = `${name}__`,
) => {
	if (name in defs) {
		throw new Error(`duplicate definition "${name}"`);
	}
	const { $defs, ...body } = dropMeta(schema);
	defs[name] = rewriteRefs(body, name, prefix);
	if (isObject($defs)) {
		for (const [k, v] of Object.entries($defs)) {
			defs[`${prefix}${k}`] = rewriteRefs(v, name, prefix);
		}
	}
};

export const usable = (v: unknown): v is Json =>
	isObject(v) && !("x-cc-error" in v) && v["$schema"] !== undefined;

export const need = (raw: Record<string, unknown>, kind: string): Json => {
	const v = raw[kind];
	if (!isObject(v)) {
		throw new Error(`missing raw capture "${kind}"`);
	}
	return v;
};

const compareKeys = (a: string, b: string): number => {
	if (a < b) {
		return -1;
	}
	return a > b ? 1 : 0;
};

// Inserts each entry before the first larger key (the lib has no `toSorted`, and `sort` mutates).
export const sortDefs = (defs: Json): Json => {
	const sorted: [string, unknown][] = [];
	for (const entry of Object.entries(defs)) {
		const at = sorted.findIndex(([k]) => compareKeys(k, entry[0]) > 0);
		sorted.splice(at === -1 ? sorted.length : at, 0, entry);
	}
	return Object.fromEntries(sorted);
};

export const refTarget = (v: unknown): string | null =>
	typeof v === "string" && v.startsWith("#/$defs/") ? v.replace(REF, "") : null;

// zod's "ref" mode shares every schema used twice, even a bare string. Put the small and the single-use ones back
// in place, so a property reads as its own type, and keep only the large shared ones (and recursive ones) in $defs.
export const getJson = (o: Json, key: string): Json | undefined => {
	const v = o[key];
	return isObject(v) ? v : undefined;
};

export const jsonList = (v: unknown, what: string): Json[] => {
	if (!Array.isArray(v) || !v.every((x) => isObject(x))) {
		throw new TypeError(`${what} is not a list of objects`);
	}
	return v.filter((x): x is Json => isObject(x));
};

export const stringList = (v: unknown): string[] =>
	Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

export const requireJson = (v: unknown, what: string): Json => {
	if (!isObject(v)) {
		throw new TypeError(`${what} is not an object`);
	}
	return v;
};

const asJson = (v: unknown): Json => (isObject(v) ? v : {});

const objectsOf = (v: unknown): Json[] =>
	Array.isArray(v) ? v.filter((x): x is Json => isObject(x)) : [];

interface RefGraph {
	uses: Map<string, number>;
	edges: Map<string, Set<string>>;
}

const scanRefs = (graph: RefGraph, node: unknown, from: string | null) => {
	if (Array.isArray(node)) {
		for (const x of node) {
			scanRefs(graph, x, from);
		}
		return;
	}
	if (!isObject(node)) {
		return;
	}
	for (const [k, v] of Object.entries(node)) {
		const t = k === "$ref" ? refTarget(v) : null;
		if (t === null) {
			scanRefs(graph, v, from);
		} else {
			graph.uses.set(t, (graph.uses.get(t) ?? 0) + 1);
			if (from !== null) {
				const set = graph.edges.get(from) ?? new Set<string>();
				set.add(t);
				graph.edges.set(from, set);
			}
		}
	}
};

const isRecursive = (
	edges: Map<string, Set<string>>,
	name: string,
): boolean => {
	const seen = new Set<string>();
	const stack = [...(edges.get(name) ?? [])];
	let n = stack.pop();
	while (n !== undefined) {
		if (n === name) {
			return true;
		}
		if (!seen.has(n)) {
			seen.add(n);
			stack.push(...(edges.get(n) ?? []));
		}
		n = stack.pop();
	}
	return false;
};

const findInlinable = (defs: Json, graph: RefGraph, maxSmall: number) => {
	const inlinable = new Set<string>();
	for (const [k, v] of Object.entries(defs)) {
		if (
			!isRecursive(graph.edges, k) &&
			((graph.uses.get(k) ?? 0) <= 1 || JSON.stringify(v).length <= maxSmall)
		) {
			inlinable.add(k);
		}
	}
	return inlinable;
};

const expandRefs = (
	node: unknown,
	defs: Json,
	inlinable: Set<string>,
): unknown => {
	if (Array.isArray(node)) {
		return node.map((x) => expandRefs(x, defs, inlinable));
	}
	if (!isObject(node)) {
		return node;
	}
	const t = refTarget(node["$ref"]);
	if (t !== null && inlinable.has(t)) {
		const { $ref: _r, ...siblings } = node;
		void _r;
		return {
			...asJson(expandRefs(defs[t], defs, inlinable)),
			...asJson(expandRefs(siblings, defs, inlinable)),
		};
	}
	return Object.fromEntries(
		Object.entries(node).map(([k, v]) => [k, expandRefs(v, defs, inlinable)]),
	);
};

// zod's "ref" mode shares every schema used twice, even a bare string. Put the small and the single-use ones back
// in place, so a property reads as its own type, and keep only the large shared ones (and recursive ones) in $defs.
export const inlineDefs = (schema: Json, maxSmall = 700): Json => {
	const defs = schema["$defs"];
	if (!isObject(defs)) {
		return schema;
	}
	const graph: RefGraph = { uses: new Map(), edges: new Map() };
	const { $defs: _d, ...root } = schema;
	void _d;
	scanRefs(graph, root, null);
	for (const [k, v] of Object.entries(defs)) {
		scanRefs(graph, v, k);
	}
	const inlinable = findInlinable(defs, graph, maxSmall);
	const kept = Object.fromEntries(
		Object.entries(defs)
			.filter(([k]) => !inlinable.has(k))
			.map(([k, v]) => [k, expandRefs(v, defs, inlinable)]),
	);
	return { ...asJson(expandRefs(root, defs, inlinable)), $defs: kept };
};

// Some payloads carry whole other documents: a control_request holds any control subtype, and a turn_handoff request
// holds transcript messages. The other file has them, so here a part bigger than the limit is replaced by a pointer
// (the node itself stays, only what is below it is checked).
const size = (v: unknown) => JSON.stringify(v).length;
// The sub-schemas of a schema: property values, items, additionalProperties, and union members.
const SINGLE_KEYS = ["items", "additionalProperties"];
const UNION_KEYS = ["anyOf", "oneOf", "allOf"];
const subSchemas = (schema: Json): Json[] => {
	const out: Json[] = [];
	const props = schema["properties"];
	if (isObject(props)) {
		out.push(...objectsOf(Object.values(props)));
	}
	for (const k of SINGLE_KEYS) {
		const v = schema[k];
		if (isObject(v)) {
			out.push(v);
		}
	}
	for (const k of UNION_KEYS) {
		out.push(...objectsOf(schema[k]));
	}
	return out;
};
// A sub-schema over the limit is replaced when none of its own sub-schemas is over the limit; otherwise it is
// kept and its big parts are looked at in turn. The schema passed in is never replaced.
export const omitLarge = (
	schema: Json,
	where: string,
	limit: number,
	top = true,
): Json => {
	if (!top) {
		if (size(schema) <= limit) {
			return schema;
		}
		if (!subSchemas(schema).some((c) => size(c) > limit)) {
			return {
				description: `Left out for size; the definitions are in ${where}.`,
			};
		}
	}
	const walk = (v: Json) => omitLarge(v, where, limit, false);
	const out: Json = { ...schema };
	const props = schema["properties"];
	if (isObject(props)) {
		out["properties"] = Object.fromEntries(
			Object.entries(props).map(([k, v]) => [k, isObject(v) ? walk(v) : v]),
		);
	}
	for (const k of SINGLE_KEYS) {
		const v = schema[k];
		if (isObject(v)) {
			out[k] = walk(v);
		}
	}
	for (const k of UNION_KEYS) {
		const v = schema[k];
		if (Array.isArray(v)) {
			out[k] = v.map((x: unknown) => (isObject(x) ? walk(x) : x));
		}
	}
	return out;
};
