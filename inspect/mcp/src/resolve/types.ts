import type { Module, Node, Variable } from "../ast.ts";

/** What a parameter is bound to in one call: the argument, or null when the call leaves it out. */
export type Env = Map<Variable, Ref | null>;
/** Where a value is in the program, with the parameters of the call it is evaluated in. */
export type Ref = { m: Module; n: Node; env?: Env | undefined };

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
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "null";
/** A value that JSON drops: undefined. Only used while types are worked out. */
export type Ty = JType | "absent";

/** The JSON type of a value that is no unknown. */
export const kindType = (v: Val): JType | undefined =>
  v.k === "str" || v.k === "enum"
    ? "string"
    : v.k === "num"
      ? "number"
      : v.k === "bool"
        ? "boolean"
        : v.k === "arr"
          ? "array"
          : v.k === "obj"
            ? "object"
            : undefined;
/** Both type lists joined, or undefined when either is unknown. */
export const union = (
  a: readonly Ty[] | undefined,
  b: readonly Ty[] | undefined,
): Ty[] | undefined => (a && b ? [...new Set([...a, ...b])].sort() : undefined);
/** The types JSON can hold; undefined when there are none. */
export const jsonTypes = (
  t: readonly Ty[] | undefined,
): JType[] | undefined => {
  const out = t?.filter((x): x is JType => x !== "absent");
  return out?.length ? out : undefined;
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

/**
 * Merge several literals of one thing: a key missing from any of them becomes optional. `ty` gives the
 * types of an unknown value; without it, a value whose sites differ in type keeps only the types it holds.
 */
export const mergeEntries = (
  lists: Entry[][],
  ty: (v: Val) => JType[] | undefined = (v) =>
    v.k === "unk" ? (v.t ?? undefined) : kindType(v) && [kindType(v) as JType],
): Entry[] => {
  const seen = new Map<string, Entry>();
  const count = new Map<string, number>();
  for (const l of lists)
    for (const e of l) {
      if (!("key" in e)) continue;
      count.set(e.key, (count.get(e.key) ?? 0) + 1);
      const prev = seen.get(e.key);
      if (!prev || !("key" in prev)) seen.set(e.key, e);
      // A literal at one site and an unknown value at another: the literal is one case only. An object
      // keeps its keys, and its leaf values become unknown.
      else if (prev.val.k === "unk" || e.val.k === "unk") {
        const known = prev.val.k === "unk" ? e.val : prev.val;
        const unknown = prev.val.k === "unk" ? prev.val : e.val;
        seen.set(e.key, {
          ...prev,
          opt: prev.opt || e.opt,
          val:
            known.k === "obj"
              ? loosen(known)
              : unknown.k === "unk"
                ? {
                    ...unknown,
                    t: jsonTypes(union(ty(known), ty(unknown))) ?? null,
                  }
                : unknown,
        });
      } else if (
        (prev.val.k === "str" || prev.val.k === "enum") &&
        (e.val.k === "str" || e.val.k === "enum")
      ) {
        const all = new Set([prev.val.v, e.val.v].flat());
        if (all.size > 1)
          seen.set(e.key, { ...prev, val: { k: "enum", v: [...all] } });
      } else if (prev.val.k === "obj" && e.val.k === "obj")
        seen.set(e.key, {
          ...prev,
          val: {
            k: "obj",
            e: mergeEntries([prev.val.e, e.val.e], ty),
            ...((prev.val.open || e.val.open) && { open: true }),
          },
        });
      // An object at one site and another value at another: the object is one case only.
      else if (prev.val.k === "obj" || e.val.k === "obj")
        seen.set(e.key, {
          ...prev,
          val: loosen(prev.val.k === "obj" ? prev.val : e.val),
        });
      // Two kinds, such as a string and a number: both types.
      else if (prev.val.k !== e.val.k)
        seen.set(e.key, {
          ...prev,
          val: {
            k: "unk",
            text: "",
            t: jsonTypes(union(ty(prev.val), ty(e.val))) ?? null,
          },
        });
    }
  return [...seen.values()].map((e) =>
    "key" in e
      ? { ...e, opt: e.opt || (count.get(e.key) ?? 0) < lists.length }
      : e,
  );
};
