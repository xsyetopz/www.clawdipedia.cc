// The call and function queries of a module: who a callee is, who calls a function, what a name holds.

import type * as t from "@babel/types";
import type { Module, Variable } from "../ast.ts";
import { children, type Fn, isFn, type Node } from "./node.ts";

/** The function a callee names: a declaration, or a variable whose only value is a function. */
export const functionOf = (
  m: Module,
  callee: Node,
): { module: Module; fn: Fn } | undefined => {
  if (callee.type !== "Identifier") return undefined;
  const v0 = m.variable(callee);
  const o =
    v0 && (m.bundle ? m.bundle.origin(m, v0) : { module: m, variable: v0 });
  if (!o) return undefined;
  const { module, variable: v } = o;
  for (const d of v.defs) {
    if (d.type === "FunctionName" && isFn(d.node))
      return { module, fn: d.node as Fn };
    if (d.type === "Variable" && isFn(d.node.init as Node | null)) {
      const writes = v.references.filter((r) => r.write);
      if (writes.length <= 1) return { module, fn: d.node.init as Fn };
    }
  }
  // `var f; ... f=function(){}`: one write, of a function.
  const writes = v.references.filter((r) => r.write);
  const w = writes[0]?.writeExpr as Node | null | undefined;
  if (writes.length === 1 && isFn(w)) return { module, fn: w };
  return undefined;
};

/** The variable that names a function: its declaration, `const f=()=>`, or `f=function(){}`. */
export const nameOf = (m: Module, fn: Fn): Variable | undefined => {
  if (fn.type === "FunctionDeclaration" && fn.id)
    return m.variable(fn.id as Node);
  const p = m.parent(fn);
  if (p?.type === "VariableDeclarator" && p.id.type === "Identifier")
    return m.variable(p.id as Node);
  if (p?.type === "AssignmentExpression" && p.left.type === "Identifier")
    return m.variable(p.left as Node);
  return undefined;
};

export type CallNode = Node & t.CallExpression;
export type Call = { module: Module; call: CallNode };

/**
 * The calls of `fn`, in its module and in every module that imports it. An `undefined` in the list
 * means the function is used as a value somewhere, so not every call is known.
 */
export const callsOf = (m: Module, fn: Fn): (Call | undefined)[] => {
  const v = nameOf(m, fn);
  if (!v) return [undefined];
  const out: (Call | undefined)[] = [];
  const scan = (module: Module, variable: Variable) => {
    for (const r of variable.references) {
      if (r.init || (r.write && r.writeExpr === fn)) continue;
      const id = r.identifier as Node;
      const p = module.parent(id);
      if (p?.type === "CallExpression" && p.callee === id)
        out.push({ module, call: p as Node & t.CallExpression });
      else if (p?.type !== "ExportSpecifier") out.push(undefined);
    }
  };
  scan(m, v);
  if (m.bundle)
    for (const i of m.bundle.importers(m, v)) scan(i.module, i.variable);
  return out;
};

/** A string the expression always gives: a literal, or a name bound once to one (followed across imports). */
export const constString = (
  m: Module,
  n: Node | null | undefined,
  depth = 0,
): string | undefined => {
  if (!n || depth > 8) return undefined;
  if (n.type === "StringLiteral") return n.value;
  if (n.type === "TemplateLiteral" && n.expressions.length === 0)
    return n.quasis[0]?.value.cooked ?? undefined;
  if (n.type !== "Identifier") return undefined;
  const v0 = m.variable(n);
  const o =
    v0 && (m.bundle ? m.bundle.origin(m, v0) : { module: m, variable: v0 });
  if (!o) return undefined;
  const writes = o.variable.references.filter((r) => r.write);
  const def = o.variable.defs[0];
  const values = [
    ...(def?.type === "Variable" && def.node.init ? [def.node.init] : []),
    ...writes.filter((r) => !r.init).map((r) => r.writeExpr),
  ];
  if (values.length !== 1) return undefined;
  return constString(o.module, values[0] as Node, depth + 1);
};

/** Each `return` value of `fn` (an arrow's expression body counts), not those of nested functions. */
export const returnsOf = (fn: Fn): (Node | null)[] => {
  if (fn.body.type !== "BlockStatement") return [fn.body as Node];
  const out: (Node | null)[] = [];
  const stack: Node[] = [fn.body as Node];
  while (stack.length) {
    const n = stack.pop() as Node;
    if (n.type === "ReturnStatement") out.push((n.argument as Node) ?? null);
    for (const c of children(n))
      if (!isFn(c) && c.type !== "ClassBody") stack.push(c);
  }
  return out.sort((a, b) => (a?.start ?? 0) - (b?.start ?? 0));
};
