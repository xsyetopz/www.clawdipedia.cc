// Kind `setting`: the top-level keys of settings.json.
// Anchors (checked on 2.1.309, task 1.1), the same objects that tools/schemas/generate.ts runs:
// 1. The object of zod getters whose `$schema` getter ends in
//    `.describe("JSON Schema reference for Claude Code settings")` (`return{$schema:()=>…,apiKeyHelper:()=>…}`
//    in chunk-0cfgmnxm.js). Each key is a setting; its `.describe("…")` text is the detail.
//    Keys in a conditional spread (`...i.CLAUDE_CODE_ENABLE_XAA&&{xaaIdp:…}`) carry the condition as gate.
// 2. The gated tables `name:{buildGate:()=>…,shape:()=>({key:zod…})}`: each `shape` key is a setting, with
//    the `buildGate` code as its gate (the generator keeps only the tables whose gate is true).
// Compared on 2.1.309 (the old list is the generated schema, not the `strings` heuristic): 194 keys, equal
// to the top-level keys of schemas/claude-code-managed-settings.json. Only here, against
// schemas/claude-code-settings.json (171): 23 keys honored only from managed settings
// (`allowManagedHooksOnly`, `policyHelper`, `requiredMinimumVersion`, ...). None only there.
// Kind `setting-key`: the nested leaf keys under those settings, as dotted paths (`permissions.allow`), with
// `*` for a record key (`extraKnownMarketplaces.*.source.repo`). Checked on 2.1.319: the 196 leaf paths equal the
// nested leaf property paths of schemas/claude-code-managed-settings.json (test/surface/binary.test.ts).
import type * as t from "@babel/types";
import {
  type Bundle,
  constString,
  type Fn,
  functionOf,
  isFn,
  type Module,
  type Node,
  returnsOf,
  type Variable,
} from "../ast.ts";
import {
  type Extractor,
  keyOf,
  prop,
  propValue,
  type SurfaceItem,
  scan,
  short,
  unique,
} from "./common.ts";

const ANCHOR = "JSON Schema reference for Claude Code settings";

/** The `.describe("…")` text of the outer zod chain of a getter `()=>z…describe("…").optional()`. */
const describe = (m: Module, n: Node | undefined): string | undefined => {
  let cur = n?.type === "ArrowFunctionExpression" ? (n.body as Node) : n;
  while (
    cur?.type === "CallExpression" &&
    cur.callee.type === "MemberExpression"
  ) {
    const p = cur.callee.property;
    if (p.type === "Identifier" && p.name === "describe")
      return constString(m, cur.arguments[0] as Node | undefined);
    cur = cur.callee.object as Node;
  }
  return undefined;
};

type Top = {
  m: Module;
  name: string;
  value: Node;
  offset: number;
  gate?: string;
};

/** Each top-level setting: its key, its zod value, and the gate of its table or spread. */
const topLevel = (bundle: Bundle): Top[] => {
  const out: Top[] = [];
  const keys = (m: Module, o: t.ObjectExpression, gate?: string) => {
    for (const p of o.properties) {
      // `...cond&&{key:…}` and `...cond?{key:…}:{}`: keys behind a condition
      const a = p.type === "SpreadElement" ? (p.argument as Node) : undefined;
      const [cond, obj] =
        a?.type === "LogicalExpression" && a.operator === "&&"
          ? [a.left, a.right]
          : a?.type === "ConditionalExpression"
            ? [a.test, a.consequent]
            : [];
      if (cond && obj?.type === "ObjectExpression")
        keys(m, obj, short(m.src(cond as Node), 120));
      const k = keyOf(p);
      if (!k || p.type === "SpreadElement") continue;
      out.push({
        m,
        name: k,
        value: propValue(p),
        offset: (p as unknown as Node).start,
        ...(gate && { gate }),
      });
    }
  };
  scan(bundle, [ANCHOR, "buildGate:"], (m, n) => {
    if (n.type !== "ObjectExpression") return;
    const o = n as t.ObjectExpression;
    if (describe(m, prop(o, "$schema")) === ANCHOR) return keys(m, o);
    const gate = prop(o, "buildGate");
    const shape = prop(o, "shape");
    // `shape:()=>({…})`
    const body =
      shape?.type === "ArrowFunctionExpression"
        ? (shape.body as Node)
        : undefined;
    if (gate && body?.type === "ObjectExpression")
      keys(
        m,
        body as t.ObjectExpression,
        `buildGate ${short(m.src(gate), 120)}`,
      );
  });
  return out;
};

const item = (
  kind: string,
  m: Module,
  name: string,
  value: Node,
  offset: number,
  gate?: string,
): SurfaceItem => {
  const d = describe(m, value);
  return {
    kind,
    name,
    module: m.name,
    offset,
    ...(d && { detail: short(d) }),
    ...(gate && { gate }),
  };
};

export const extractSettings: Extractor = (bundle) =>
  unique(
    topLevel(bundle).map((s) =>
      item("setting", s.m, s.name, s.value, s.offset, s.gate),
    ),
  );

/** The zod types whose inner schemas hold the same value, so their keys sit at the same path. */
const SAME_PATH = new Set([
  "union",
  "intersection",
  "pipe",
  "lazy",
  "optional",
  "nullable",
  "default",
  "prefault",
  "catch",
  "readonly",
  "nonoptional",
]);
/** Methods of a zod schema whose argument adds keys or another schema for the same value. */
const SAME_PATH_METHODS = new Set([
  "extend",
  "safeExtend",
  "merge",
  "or",
  "and",
]);

/** The zod type that a constructor builds: the `type:"…"` of the object it passes to the class. */
const zodType = (m: Module, fn: Fn): string | undefined =>
  /\btype:"(\w+)"/.exec(m.src(fn))?.[1];

/** What a parameter of a followed function or callback holds in this walk: the argument and its module. */
type Env = Map<Variable, { m: Module; n: Node }>;

/** The constant string of `n`, through the bound parameters. */
const constOf = (m: Module, n: Node, env: Env): string | undefined => {
  const v = n.type === "Identifier" ? m.variable(n) : undefined;
  const b = v && env.get(v);
  return b ? constOf(b.m, b.n, env) : constString(m, n);
};

/** The strings of an array literal, with its `...list` spreads read in. */
const stringList = (m: Module, n: Node | null | undefined): string[] => {
  if (n?.type === "Identifier") {
    const v = m.variable(n);
    const o = v && m.bundle?.origin(m, v);
    const d = o?.variable.defs[0];
    return d?.type === "Variable" && o
      ? stringList(o.module, d.node.init as Node | null)
      : [];
  }
  if (n?.type !== "ArrayExpression") return [];
  return (n as t.ArrayExpression).elements.flatMap((e) =>
    e?.type === "SpreadElement"
      ? stringList(m, e.argument as Node)
      : (constString(m, e as Node | null) ?? []),
  );
};

/**
 * The nested keys of the zod value `n` at `path`. It follows helper functions through their returns (with their
 * parameters bound to the arguments), memoized schemas (`p(()=>…)`) through their callbacks, `z.object` shapes,
 * `Object.fromEntries(list.map((k)=>[k,v]))` shapes, and `z.record` values (as `path.*`).
 * Array items are left out, as in the generated schema walk.
 */
const nested = (
  m: Module,
  n: Node | null | undefined,
  path: string,
  gate: string | undefined,
  out: SurfaceItem[],
  env: Env,
  depth = 0,
): void => {
  if (!n || depth > 40) return;
  const go = (x: Node | null | undefined, p = path, mod = m, e = env) =>
    nested(mod, x, p, gate, out, e, depth + 1);
  const key = (k: string, v: Node, at: number, e = env) => {
    out.push(item("setting-key", m, `${path}.${k}`, v, at, gate));
    go(v, `${path}.${k}`, m, e);
  };
  const shape = (o: Node | undefined) => {
    if (o?.type === "ObjectExpression") {
      for (const p of (o as t.ObjectExpression).properties) {
        if (p.type === "SpreadElement") {
          const a = p.argument as Node;
          shape(
            a.type === "LogicalExpression"
              ? (a.right as Node)
              : a.type === "ConditionalExpression"
                ? (a.consequent as Node)
                : a,
          );
          continue;
        }
        const k = keyOf(p);
        if (k) key(k, propValue(p), (p as unknown as Node).start);
      }
      return;
    }
    // `Object.fromEntries(list.map((k)=>[k,schema]))`
    const c =
      o?.type === "CallExpression" ? (o as t.CallExpression) : undefined;
    const map = c?.arguments[0] as Node | undefined;
    if (
      c?.callee.type !== "MemberExpression" ||
      m.src(c.callee as Node) !== "Object.fromEntries" ||
      map?.type !== "CallExpression"
    )
      return;
    const mc = map as Node & t.CallExpression;
    const cb = mc.arguments[0] as Node | undefined;
    if (mc.callee.type !== "MemberExpression" || !isFn(cb)) return;
    const pair = returnsOf(cb)[0];
    const param = cb.params[0] as Node | undefined;
    const v = param?.type === "Identifier" ? m.variable(param) : undefined;
    if (pair?.type !== "ArrayExpression" || !v) return;
    const value = (pair as t.ArrayExpression).elements[1] as Node;
    for (const k of stringList(m, mc.callee.object as Node)) {
      const lit = { type: "StringLiteral", value: k } as unknown as Node;
      key(k, value, value.start, new Map(env).set(v, { m, n: lit }));
    }
  };
  if (n.type === "ArrowFunctionExpression" || n.type === "FunctionExpression") {
    for (const r of returnsOf(n as Fn)) go(r);
    return;
  }
  if (n.type === "ConditionalExpression") {
    const c = n as Node & t.ConditionalExpression;
    const test = c.test as Node;
    // `k === "default" ? a : b` with `k` bound to a constant picks one branch
    if (test.type === "BinaryExpression" && /^[!=]==?$/.test(test.operator)) {
      const l = constOf(m, test.left as Node, env);
      const r = constOf(m, test.right as Node, env);
      if (l !== undefined && r !== undefined) {
        go(
          ((l === r) === test.operator.startsWith("=")
            ? c.consequent
            : c.alternate) as Node,
        );
        return;
      }
    }
    go(c.consequent as Node);
    go(c.alternate as Node);
    return;
  }
  if (n.type === "LogicalExpression") {
    go((n as t.LogicalExpression).right as Node);
    return;
  }
  if (n.type === "Identifier") {
    const v = m.variable(n);
    const b = v && env.get(v);
    if (b) {
      go(b.n, path, b.m);
      return;
    }
    // a schema held in a variable: `var s=z.object({…})`
    const o =
      v && (m.bundle ? m.bundle.origin(m, v) : { module: m, variable: v });
    const d = o?.variable.defs[0];
    if (o && d?.type === "Variable")
      go(d.node.init as Node | null, path, o.module);
    return;
  }
  if (n.type !== "CallExpression") return;
  const c = n as Node & t.CallExpression;
  const args = c.arguments as Node[];
  const callee = c.callee as Node;
  if (callee.type === "MemberExpression") {
    const p = (callee as Node & t.MemberExpression).property;
    const name = p.type === "Identifier" ? p.name : undefined;
    go((callee as Node & t.MemberExpression).object as Node);
    if (name && SAME_PATH_METHODS.has(name))
      for (const a of args) a.type === "ObjectExpression" ? shape(a) : go(a);
    return;
  }
  const f = functionOf(m, callee);
  if (!f) {
    // `s()` where `var s=p(()=>z.object({…}))`: the memoized schema of a variable
    go(callee);
    return;
  }
  const type = zodType(f.module, f.fn);
  if (type === "object") {
    shape(args[0]);
    return;
  }
  if (type === "record") {
    go(args.length > 1 ? args[1] : args[0], `${path}.*`);
    return;
  }
  if (type && SAME_PATH.has(type)) {
    for (const a of args)
      if (a.type === "ArrayExpression")
        for (const e of (a as t.ArrayExpression).elements) go(e as Node | null);
      else go(a);
    return;
  }
  if (type) return;
  // A helper that builds a schema: its returns, with each parameter bound to its argument.
  const bound = new Map(env);
  f.fn.params.forEach((p, i) => {
    const v =
      p.type === "Identifier" ? f.module.variable(p as Node) : undefined;
    if (v && args[i]) bound.set(v, { m, n: args[i] as Node });
  });
  for (const r of returnsOf(f.fn)) go(r, path, f.module, bound);
  // a callback that a wrapper outside the program calls: `p(()=>z.object({…}))` returns `lib.lazy(e)`
  for (const a of args) if (isFn(a)) go(a);
};

export const extractSettingKeys: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  for (const s of topLevel(bundle))
    nested(s.m, s.value, s.name, s.gate, out, new Map());
  // An object key is set through its own keys, so only the leaves are items.
  const all = unique(out);
  const parents = new Set(
    all.flatMap((i) =>
      i.name
        .split(".")
        .map((_, j, a) => a.slice(0, j).join("."))
        .slice(2),
    ),
  );
  return all.filter((i) => !parents.has(i.name));
};
