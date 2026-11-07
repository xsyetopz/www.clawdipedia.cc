import type * as t from "@babel/types";
import { constString, type Fn, type Module, type Node } from "../ast.ts";
import type { Env, Ty } from "./types.ts";

export const isVoid = (n: Node | null | undefined): boolean =>
  !n ||
  (n.type === "UnaryExpression" && n.operator === "void") ||
  n.type === "NullLiteral" ||
  (n.type === "Identifier" && n.name === "undefined");

/** The object, property names, and root name of `a.b.c`; undefined for anything else. */
export const memberPath = (
  m: Module,
  n: Node,
): { root: Node; path: string[] } | undefined => {
  const path: string[] = [];
  let x = n;
  while (x.type === "MemberExpression") {
    const key = x.computed
      ? constString(m, x.property as Node)
      : x.property.type === "Identifier"
        ? x.property.name
        : undefined;
    if (key === undefined) return undefined;
    path.unshift(key);
    x = x.object as Node;
  }
  return x.type === "Identifier" ? { root: x, path } : undefined;
};

/** The parameters of `fn` (in module `dm`) bound to the arguments of `call` (in `m`). */
export const bind = (
  m: Module,
  call: Node & (t.CallExpression | t.NewExpression),
  env: Env | undefined,
  dm: Module,
  fn: Fn,
): Env => {
  const inner: Env = new Map();
  const args = call.arguments as Node[];
  const spreadAt = args.findIndex((a) => a.type === "SpreadElement");
  fn.params.forEach((p, i) => {
    if (p.type !== "Identifier" || (spreadAt >= 0 && i >= spreadAt)) return;
    const v = dm.variable(p as Node);
    const a = args[i];
    if (v) inner.set(v, a && !isVoid(a) ? { m, n: a, env } : null);
  });
  return inner;
};

// Built-ins whose result type does not depend on what they are called on. Minified code keeps these
// names, as they are properties of the built-in objects.
export const GLOBAL_CALLS: Record<string, Ty> = {
  String: "string",
  Number: "number",
  parseInt: "number",
  parseFloat: "number",
  Boolean: "boolean",
  isNaN: "boolean",
  isFinite: "boolean",
  encodeURIComponent: "string",
  decodeURIComponent: "string",
};
export const STATIC_CALLS: Record<string, Record<string, Ty>> = {
  Math: {},
  Date: { now: "number", parse: "number" },
  JSON: { stringify: "string" },
  Object: { keys: "array", values: "array", entries: "array" },
  Array: { isArray: "boolean", from: "array", of: "array" },
  Number: {
    isFinite: "boolean",
    isInteger: "boolean",
    isNaN: "boolean",
    isSafeInteger: "boolean",
    parseInt: "number",
    parseFloat: "number",
  },
  performance: { now: "number" },
};
export const METHODS: Record<string, Ty> = {
  toISOString: "string",
  toLowerCase: "string",
  toUpperCase: "string",
  trim: "string",
  trimStart: "string",
  trimEnd: "string",
  toFixed: "string",
  padStart: "string",
  padEnd: "string",
  replace: "string",
  replaceAll: "string",
  join: "string",
  includes: "boolean",
  startsWith: "boolean",
  endsWith: "boolean",
  getTime: "number",
  indexOf: "number",
  lastIndexOf: "number",
  findIndex: "number",
  map: "array",
  filter: "array",
  flatMap: "array",
  split: "array",
};
export const COMPARE = new Set([
  "==",
  "!=",
  "===",
  "!==",
  "<",
  ">",
  "<=",
  ">=",
  "instanceof",
  "in",
]);
