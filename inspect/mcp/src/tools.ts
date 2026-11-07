// Lists the built-in tools of the program: the array that `getAllBaseTools` returns, with the code that
// gates each entry (`c?[T]:[]`, `[A,B].filter(f)`) and the source of the functions that code calls.
import type * as t from "@babel/types";
import {
  type Bundle,
  type CallNode,
  children,
  constString,
  type Fn,
  functionOf,
  isFn,
  type Module,
  type Node,
  returnsOf,
} from "./ast.ts";
import type { Resolver } from "./resolve.ts";
import { keyOf, type Prop, propValue } from "./surface/common.ts";

export type Tool = {
  name: string;
  when: string[];
  /** The source of the tool's own `isEnabled`, when its definition has one. */
  enabled?: string;
  unresolved?: true;
};
type Cond = { m: Module; n: Node; text: string };

const MAX_FN = 300;

/** The value a name is bound to once (followed across imports), or undefined. */
const initOf = (m: Module, id: Node): { m: Module; n: Node } | undefined => {
  const v0 = m.variable(id);
  const o = v0 && (m.bundle?.origin(m, v0) ?? { module: m, variable: v0 });
  const def = o?.variable.defs[0];
  if (!o || def?.type !== "Variable" || !def.node.init) return undefined;
  if (o.variable.references.some((r) => r.write && !r.init)) return undefined;
  return { m: o.module, n: def.node.init as Node };
};

/** `import.meta.require("/$bunfs/root/chunk").X`: the value of export `X` in that chunk, or its name. */
const required = (
  m: Module,
  n: Node,
): { m: Module; n: Node } | string | undefined => {
  if (n.type !== "MemberExpression" || n.property.type !== "Identifier")
    return undefined;
  // The chunk may sit in a local: `let b=import.meta.require(...);return b.X`.
  const i =
    n.object.type === "Identifier" ? initOf(m, n.object as Node) : undefined;
  const cm = i?.m ?? m;
  const c = (i?.n ?? n.object) as Node;
  if (
    c.type !== "CallExpression" ||
    !cm.src(c.callee as Node).startsWith("import.meta.require")
  )
    return undefined;
  const name = n.property.name;
  const from = m.bundle?.get(String(constString(cm, c.arguments[0] as Node)));
  const local = from?.exports.get(name);
  const v = local ? from?.topLevel(local) : undefined;
  const o = from && v && m.bundle?.origin(from, v);
  const def = o?.variable.defs[0];
  return o && def?.type === "Variable" && def.node.init
    ? { m: o.module, n: def.node.init as Node }
    : name;
};

/** The function a call calls: a name, or an inline function such as `(()=>x)()`. */
const calleeFn = (m: Module, call: CallNode) =>
  isFn(call.callee as Node)
    ? { module: m, fn: call.callee as Fn }
    : functionOf(m, call.callee as Node);

/** Always null: `null`, a name bound to it, or a call of null or of a function that only returns it. */
const isNull = (m: Module, n: Node, depth = 0): boolean => {
  if (depth > 6) return false;
  if (n.type === "NullLiteral") return true;
  if (n.type === "Identifier") {
    const i = initOf(m, n);
    return !!i && isNull(i.m, i.n, depth + 1);
  }
  if (n.type !== "CallExpression") return false;
  if (isNull(m, n.callee as Node, depth + 1)) return true;
  const f = calleeFn(m, n);
  const rets = f ? returnsOf(f.fn) : [];
  return (
    rets.length > 0 &&
    rets.every((r) => !!r && isNull(f?.module as Module, r, depth + 1))
  );
};

/** A tool's name, and its own `isEnabled` when its definition literal has one. */
type Found = { name: string; enabled?: { m: Module; n: Node } };

/** The tool an expression gives, or undefined. */
const toolName = (
  R: Resolver,
  m: Module,
  n: Node,
  depth = 0,
): Found | undefined => {
  const named = (name: string | undefined) => (name ? { name } : undefined);
  if (depth > 8) return undefined;
  if (n.type === "Identifier") {
    const i = initOf(m, n);
    return i && toolName(R, i.m, i.n, depth + 1);
  }
  // `{name:...}`, or a tool builder called with one: `tn({name:io,...})`.
  const lit =
    n.type === "ObjectExpression"
      ? n
      : n.type === "CallExpression" &&
          n.arguments[0]?.type === "ObjectExpression"
        ? n.arguments[0]
        : undefined;
  const prop = (key: string) =>
    lit?.properties.find(
      (x): x is Prop => x.type !== "SpreadElement" && keyOf(x) === key,
    );
  const p = prop("name");
  if (p) {
    const name = constString(m, propValue(p));
    const e = prop("isEnabled");
    return name
      ? { name, ...(e && { enabled: { m, n: e as Node } }) }
      : undefined;
  }
  if (n.type === "SequenceExpression")
    return toolName(R, m, n.expressions.at(-1) as Node, depth + 1);
  const r = required(m, n);
  if (typeof r === "string") return { name: r };
  if (r)
    return toolName(R, r.m, r.n, depth + 1) ?? named(m.src(n).split(".").pop());
  if (n.type === "CallExpression") {
    const f = n.arguments.length === 0 ? calleeFn(m, n) : undefined;
    for (const ret of f ? returnsOf(f.fn) : [])
      if (ret && !isNull(f?.module as Module, ret))
        return toolName(R, f?.module as Module, ret, depth + 1);
    // A lazy wrapper such as `Vr(HEAD,()=>import(...).Tool)` takes its name from its first argument.
    const a = n.arguments[0] as Node | undefined;
    const got = a && toolName(R, m, a, depth + 1);
    if (got) return got;
  }
  const e = R.expr(m, n)?.find((x) => "key" in x && x.key === "name");
  if (e && "key" in e) {
    if (e.val.k === "str") return { name: e.val.v };
    if (e.val.k === "unk" && e.val.ref)
      return named(constString(e.val.ref.m, e.val.ref.n));
  }
  return undefined;
};

/** Each tool of an expression that gives a list of tools, with the conditions it is under. */
const items = (
  R: Resolver,
  m: Module,
  n: Node,
  when: Cond[],
  out: (Tool & { conds: Cond[] })[],
  depth = 0,
): void => {
  const add = (t: Tool): void => {
    out.push({ ...t, when: when.map((c) => c.text), conds: when });
  };
  if (depth > 8) {
    add({ name: `...${m.src(n)}`, when: [], unresolved: true });
    return;
  }
  if (n.type === "ArrayExpression") {
    for (const el of n.elements as (Node | null)[]) {
      if (!el) continue;
      if (el.type === "SpreadElement")
        items(R, m, el.argument as Node, when, out, depth + 1);
      else if (!isNull(m, el)) {
        const t = toolName(R, m, el);
        if (!t) add({ name: m.src(el), when: [], unresolved: true });
        else if (!t.enabled) add({ name: t.name, when: [] });
        else {
          const src = t.enabled.m.src(t.enabled.n);
          out.push({
            name: t.name,
            when: when.map((c) => c.text),
            enabled: src.length > MAX_FN ? `${src.slice(0, MAX_FN)}…` : src,
            conds: [...when, { ...t.enabled, text: src }],
          });
        }
      }
    }
    return;
  }
  if (n.type === "ConditionalExpression") {
    const t = n.test as Node;
    if (isNull(m, t)) {
      items(R, m, n.alternate as Node, when, out, depth + 1);
      return;
    }
    const i = t.type === "Identifier" ? initOf(m, t) : undefined;
    const text = i ? `${m.src(t)} (=${i.m.src(i.n)})` : m.src(t);
    const at = i ?? { m, n: t };
    items(
      R,
      m,
      n.consequent as Node,
      [...when, { ...at, text }],
      out,
      depth + 1,
    );
    items(
      R,
      m,
      n.alternate as Node,
      [...when, { ...at, text: `!(${text})` }],
      out,
      depth + 1,
    );
    return;
  }
  if (n.type === "CallExpression") {
    const c = n.callee as Node;
    if (
      c.type === "MemberExpression" &&
      c.property.type === "Identifier" &&
      c.property.name === "filter" &&
      n.arguments[0]
    ) {
      const f = n.arguments[0] as Node;
      items(
        R,
        m,
        c.object as Node,
        [...when, { m, n: f, text: m.src(f) }],
        out,
        depth + 1,
      );
      return;
    }
    // `x?.()` with `x=null` gives no tool.
    if ("optional" in n && n.optional && isNull(m, c)) return;
    const f = calleeFn(m, n);
    if (f) {
      for (const ret of returnsOf(f.fn))
        if (ret && !isNull(f.module, ret))
          items(R, f.module, ret, when, out, depth + 1);
      return;
    }
  }
  if (n.type === "Identifier" && isNull(m, n)) return;
  // `x?.()`, `a ?? b`, `a || b`: the tools of each part. A name or an import: its value.
  const r = required(m, n);
  const i = n.type === "Identifier" ? initOf(m, n) : undefined;
  const next =
    n.type === "LogicalExpression"
      ? [
          { m, n: n.left as Node },
          { m, n: n.right as Node },
        ]
      : i
        ? [i]
        : r && typeof r !== "string"
          ? [r]
          : [];
  for (const x of next) items(R, x.m, x.n, when, out, depth + 1);
  if (next.length) return;
  add({
    name: `...${typeof r === "string" ? r : m.src(n)}`,
    when: [],
    unresolved: true,
  });
};

/** The functions that code calls, and the functions those call, `depth` levels down: name to source. */
const calledFns = (
  m: Module,
  n: Node,
  out: Map<string, string>,
  depth = 2,
): void => {
  const stack = [n];
  while (stack.length) {
    const x = stack.pop() as Node;
    stack.push(...children(x));
    // A call `f()`, or a function named as a value: `isEnabled:f`.
    const id =
      x.type === "CallExpression"
        ? x.callee
        : x.type === "ObjectProperty" && x === n
          ? x.value
          : undefined;
    if (id?.type !== "Identifier") continue;
    const name = id.name;
    if (out.has(name)) continue;
    const f = functionOf(m, id as Node);
    if (!f) continue;
    const s = f.module.src(f.fn);
    out.set(name, s.length > MAX_FN ? `${s.slice(0, MAX_FN)}…` : s);
    if (depth > 1) calledFns(f.module, f.fn.body as Node, out, depth - 1);
  }
};

/** The built-in tools `getAllBaseTools` returns, and the source of the functions their conditions call. */
export const baseTools = (
  bundle: Bundle,
  R: Resolver,
): { module: string; tools: Tool[]; functions: Record<string, string> } => {
  const key = "getAllBaseTools:";
  const f = bundle
    .withText(key)
    .map((m) => {
      const at = new RegExp(`${key}[\\w$]`).exec(m.text);
      return at && functionOf(m, m.nodeAt(at.index + key.length));
    })
    .find((x) => x);
  if (!f) throw new Error("no getAllBaseTools function found");
  const out: (Tool & { conds: Cond[] })[] = [];
  for (const ret of returnsOf(f.fn))
    if (ret) items(R, f.module, ret as Node & t.Expression, [], out);
  const fns = new Map<string, string>();
  for (const t of out) for (const c of t.conds) calledFns(c.m, c.n, fns);
  return {
    module: f.module.name,
    tools: out.map(({ conds: _, ...t }) => t),
    functions: Object.fromEntries(fns),
  };
};
