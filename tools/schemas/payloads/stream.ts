// The stream-json part of the payload schemas: the CLI's output and input messages, one definition per member.
import type { Json } from "../build.ts";
import {
	addDef,
	getJson,
	inlineDefs,
	isObject,
	jsonList,
	need,
	omitLarge,
	REF,
	refTarget,
	rewriteRefs,
	sortDefs,
	stringList,
} from "./defs.ts";

// Walks a union to its object members, following $ref into the schema's own $defs.
const members = (root: Json): Json[] => {
	const rootDefs = root["$defs"];
	const local = isObject(rootDefs) ? rootDefs : {};
	const walk = (n: Json): Json[] => {
		const ref = n["$ref"];
		if (typeof ref === "string") {
			const target = local[ref.replace(REF, "")];
			if (!isObject(target)) {
				throw new Error(`dangling ${ref}`);
			}
			return walk(target);
		}
		const union = n["anyOf"];
		if (Array.isArray(union)) {
			return jsonList(union, "anyOf").flatMap((x) => walk(x));
		}
		return [n];
	};
	return walk(root);
};

const literal = (prop: unknown): string | undefined => {
	if (!isObject(prop)) {
		return undefined;
	}
	const single = prop["const"];
	if (typeof single === "string") {
		return single;
	}
	const values = prop["enum"];
	if (Array.isArray(values)) {
		const strings = stringList(values);
		if (strings.length !== values.length) {
			return undefined;
		}
		// Several values share one shape: name them by what they have in common (error_a, error_b -> error).
		let common = strings[0] ?? "undefined";
		for (const v of strings) {
			while (!v.startsWith(common)) {
				common = common.slice(0, -1);
			}
		}
		const trimmed = common.replace(/_+$/u, "");
		return trimmed === "" ? undefined : trimmed;
	}
	return undefined;
};

const streamName = (m: Json): string => {
	const props = getJson(m, "properties") ?? {};
	const type = literal(props["type"]);
	if (type === undefined || type === "") {
		throw new TypeError("stream member without a literal type");
	}
	const subtype = literal(props["subtype"]);
	return subtype === undefined || subtype === "" ? type : `${type}_${subtype}`;
};

// Keeps the named definitions and what they reach; shared pieces nothing uses any more are dropped.
const pruneUnreferenced = (defs: Json, named: Set<string>): Json => {
	const keep = new Set<string>(named);
	const stack = [...named];
	const visit = (node: unknown) => {
		if (Array.isArray(node)) {
			for (const x of node) {
				visit(x);
			}
			return;
		}
		if (!isObject(node)) {
			return;
		}
		for (const [k, v] of Object.entries(node)) {
			const t = k === "$ref" ? refTarget(v) : null;
			if (t === null) {
				visit(v);
			} else if (!keep.has(t)) {
				keep.add(t);
				stack.push(t);
			}
		}
	};
	let next = stack.pop();
	while (next !== undefined) {
		visit(defs[next]);
		next = stack.pop();
	}
	return Object.fromEntries(Object.entries(defs).filter(([k]) => keep.has(k)));
};

// Two members with the same type (a user message and its replay): the first property only the second requires.
const dedupeName = (
	name: string,
	m: Json,
	have: string[],
	taken: Map<string, string[]>,
): string => {
	const fresh = stringList(m["required"]).filter((k) => !have.includes(k));
	const props = getJson(m, "properties") ?? {};
	const extra =
		fresh.find((k) => isObject(props[k]) && "const" in props[k]) ?? fresh[0];
	const unique = `${name}_${extra ?? "2"}`;
	if (taken.has(unique)) {
		throw new Error(`duplicate stream member ${unique}`);
	}
	return unique;
};

const addStreamMembers = (
	defs: Json,
	named: Set<string>,
	root: Json,
	suffix: string,
	shared: string,
) => {
	const taken = new Map<string, string[]>();
	for (const m of members(root)) {
		let name = streamName(m);
		const have = taken.get(name);
		if (have !== undefined) {
			name = dedupeName(name, m, have, taken);
		}
		taken.set(name, stringList(m["required"]));
		named.add(`${name}${suffix}`);
		const body = name.startsWith("control_re")
			? omitLarge(
					m,
					"claude-code-control-protocol.json (<subtype>Request and <subtype>Response)",
					200_000,
				)
			: m;
		addDef(defs, `${name}${suffix}`, body, `${shared}_`);
	}
};

const STREAM_KINDS = [
	["stream-out", "Output", "out"],
	["stream-in", "Input", "in"],
] as const;

export const streamJson = (raw: Record<string, unknown>): Json => {
	const defs: Json = {};
	const named = new Set<string>();
	for (const [kind, suffix, shared] of STREAM_KINDS) {
		const root = inlineDefs(need(raw, kind));
		addStreamMembers(defs, named, root, suffix, shared);
		// Shared pieces zod pulled out of the union.
		const local = root["$defs"];
		if (isObject(local)) {
			for (const [k, v] of Object.entries(local)) {
				if (!(`${shared}_${k}` in defs)) {
					defs[`${shared}_${k}`] = rewriteRefs(v, "", `${shared}_`);
				}
			}
		}
	}
	return { $defs: sortDefs(pruneUnreferenced(defs, named)) };
};
