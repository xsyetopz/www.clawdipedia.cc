import type { Module, Node, Variable } from "../ast.ts";

/** What a parameter is bound to in one call: the argument, or null when the call leaves it out. */
export type Env = Map<Variable, Ref | null>;
/** Where a value is in the program, with the parameters of the call it is evaluated in. */
export interface Ref {
	m: Module;
	n: Node;
	env?: Env | undefined;
}

export type Val =
	/** `open`: one site gives this object and another an unknown value, which may be no object. */
	| { k: "obj"; e: Entry[]; open?: boolean }
	| { k: "str"; v: string }
	| { k: "enum"; v: string[] }
	| { k: "num"; v: number }
	| { k: "bool"; v: boolean }
	| { k: "arr" }
	/** `t`: the JSON types the code shows for it; null when no type is known (the `ref` is not read for one). */
	| { k: "unk"; text: string; ref?: Ref; t?: JType[] | null };
export type Entry =
	| { key: string; opt: boolean; val: Val }
	| { spread: string; opt: boolean; ref?: Ref };
export type JType =
	"string" | "number" | "boolean" | "array" | "object" | "null";
/** A value that JSON drops: undefined. Only used while types are worked out. */
export type Ty = JType | "absent";

const KIND_TYPE: Record<Exclude<Val["k"], "unk">, JType> = {
	str: "string",
	enum: "string",
	num: "number",
	bool: "boolean",
	arr: "array",
	obj: "object",
};
/** The JSON type of a value that is no unknown. */
export const kindType = (v: Val): JType | undefined =>
	v.k === "unk" ? undefined : KIND_TYPE[v.k];
/** Both type lists joined, or undefined when either is unknown. */
export const union = (
	a: readonly Ty[] | undefined,
	b: readonly Ty[] | undefined,
): Ty[] | undefined =>
	a && b ? [...new Set([...a, ...b])].toSorted() : undefined;
/** The types JSON can hold; undefined when there are none. */
export const jsonTypes = (
	t: readonly Ty[] | undefined,
): JType[] | undefined => {
	const out = t?.filter((x): x is JType => x !== "absent");
	return out !== undefined && out.length > 0 ? out : undefined;
};

/** A value that is one case of several: an object keeps its keys, every other value becomes unknown. */
export const loosen = (v: Val): Val =>
	v.k === "obj"
		? {
				k: "obj",
				e: v.e.map((x) => ("key" in x ? { ...x, val: loosen(x.val) } : x)),
				open: true,
			}
		: { k: "unk", text: "" };

type Keyed = Extract<Entry, { key: string }>;
export type TyOf = (v: Val) => JType[] | undefined;

/** The JSON types of a value the code shows: its own, or the types it holds when unknown. */
export const defaultTy: TyOf = (v) => {
	if (v.k === "unk") {
		return v.t ?? undefined;
	}
	const k = kindType(v);
	return k === undefined ? undefined : [k];
};

/** The value of a key that one site gives as a literal and another as an unknown value: the literal is one case only. */
const mergeUnknown = (pv: Val, ev: Val, ty: TyOf): Val => {
	const known = pv.k === "unk" ? ev : pv;
	const unknown = pv.k === "unk" ? pv : ev;
	// An object keeps its keys, and its leaf values become unknown.
	if (known.k === "obj") {
		return loosen(known);
	}
	if (unknown.k === "unk") {
		return { ...unknown, t: jsonTypes(union(ty(known), ty(unknown))) ?? null };
	}
	return unknown;
};

/** The value of a key that two sites give as known values; undefined when the first stands. */
const mergeKnown = (pv: Val, ev: Val, ty: TyOf): Val | undefined => {
	if (
		(pv.k === "str" || pv.k === "enum") &&
		(ev.k === "str" || ev.k === "enum")
	) {
		const all = new Set([pv.v, ev.v].flat());
		return all.size > 1 ? { k: "enum", v: [...all] } : undefined;
	}
	if (pv.k === "obj" && ev.k === "obj") {
		return {
			k: "obj",
			e: mergeEntries([pv.e, ev.e], ty),
			...(pv.open === true || ev.open === true ? { open: true } : {}),
		};
	}
	// An object at one site and another value at another: the object is one case only.
	if (pv.k === "obj" || ev.k === "obj") {
		return loosen(pv.k === "obj" ? pv : ev);
	}
	// Two kinds, such as a string and a number: both types.
	if (pv.k !== ev.k) {
		return { k: "unk", text: "", t: jsonTypes(union(ty(pv), ty(ev))) ?? null };
	}
	return undefined;
};

/** The entry that replaces `prev` when a second site gives the same key as `e`; undefined when `prev` stands. */
const mergeKeyed = (prev: Keyed, e: Keyed, ty: TyOf): Keyed | undefined => {
	if (prev.val.k === "unk" || e.val.k === "unk") {
		return {
			...prev,
			opt: prev.opt || e.opt,
			val: mergeUnknown(prev.val, e.val, ty),
		};
	}
	const val = mergeKnown(prev.val, e.val, ty);
	return val && { ...prev, val };
};

/**
 * Merge several literals of one thing: a key missing from any of them becomes optional. `ty` gives the
 * types of an unknown value; without it, a value whose sites differ in type keeps only the types it holds.
 */
export const mergeEntries = (
	lists: Entry[][],
	ty: TyOf = defaultTy,
): Entry[] => {
	const seen = new Map<string, Entry>();
	const count = new Map<string, number>();
	for (const l of lists) {
		for (const e of l) {
			if (!("key" in e)) {
				continue;
			}
			count.set(e.key, (count.get(e.key) ?? 0) + 1);
			const prev = seen.get(e.key);
			if (!prev || !("key" in prev)) {
				seen.set(e.key, e);
				continue;
			}
			const merged = mergeKeyed(prev, e, ty);
			if (merged) {
				seen.set(e.key, merged);
			}
		}
	}
	const out: Entry[] = [];
	for (const e of seen.values()) {
		out.push(
			"key" in e
				? { ...e, opt: e.opt || (count.get(e.key) ?? 0) < lists.length }
				: e,
		);
	}
	return out;
};
