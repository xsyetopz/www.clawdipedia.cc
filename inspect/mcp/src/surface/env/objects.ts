// The env objects of kind `env`: `process.env`, proxies made from a registry, and what holds or returns them.
import type * as t from "@babel/types";
import {
  callsOf,
  type Fn,
  functionOf,
  isFn,
  type Module,
  type Node,
  returnsOf,
} from "../../ast.ts";

export type Variable = NonNullable<ReturnType<Module["variable"]>>;

const isName = (n: Node, name: string): boolean =>
  (n.type === "Identifier" && n.name === name) ||
  (n.type === "MemberExpression" &&
    !n.computed &&
    n.property.type === "Identifier" &&
    n.property.name === name &&
    n.object.type === "Identifier" &&
    n.object.name === "globalThis");

/** `process.env` or `globalThis.process.env` (the SDK reads it that way). */
export const isProcessEnv = (n: Node): boolean =>
  n.type === "MemberExpression" &&
  !n.computed &&
  isName(n.object as Node, "process") &&
  n.property.type === "Identifier" &&
  n.property.name === "env";

/** The registry type of a getter `()=>v` with `v=H.method(...)`: the method, its options, and enum values. */

/** The single value of a variable that is never written again, or undefined. */
const initOf = (v: Variable): Node | undefined => {
  const def = v.defs[0];
  if (def?.type !== "Variable" || !def.node.init) return undefined;
  return v.references.every((r) => !r.write || r.init)
    ? (def.node.init as Node)
    : undefined;
};

export class EnvObjects {
  /** Registry namespaces, and objects that spread them. */
  readonly registries = new Set<Variable>();
  /** Functions that build an env proxy from a registry. */
  readonly factories = new Set<Fn>();
  #known = new WeakMap<object, boolean>();

  /** Find the proxy factories: the functions called with a registry namespace as an argument. */
  findFactories(regs: { m: Module; v: Variable }[]): void {
    const queue = [...regs];
    while (queue.length) {
      const { m, v } = queue.pop() as { m: Module; v: Variable };
      if (this.registries.has(v)) continue;
      this.registries.add(v);
      for (const r of v.references) {
        const id = r.identifier as Node;
        const p = m.parent(id);
        if (p?.type === "SpreadElement") {
          // `QN={...ns1,...ns2}` is a registry too
          const decl = m.parent(m.parent(p) as Node);
          if (
            decl?.type === "VariableDeclarator" &&
            decl.id.type === "Identifier"
          ) {
            const w = m.variable(decl.id as Node);
            if (w) queue.push({ m, v: w });
          }
        } else if (
          p?.type === "CallExpression" &&
          p.arguments.includes(id as t.Expression)
        ) {
          const f = functionOf(m, p.callee as Node);
          if (f) this.factories.add(f.fn);
        }
      }
    }
  }

  /** Is `n` an env object (anchor 2)? */
  is(m: Module, n: Node, seen = new Set<unknown>()): boolean {
    if (isProcessEnv(n)) return true;
    switch (n.type) {
      case "ObjectExpression":
        return n.properties.some(
          (p) =>
            p.type === "SpreadElement" && this.is(m, p.argument as Node, seen),
        );
      case "LogicalExpression":
        return (
          this.is(m, n.left as Node, seen) || this.is(m, n.right as Node, seen)
        );
      case "ConditionalExpression":
        return (
          this.is(m, n.consequent as Node, seen) ||
          this.is(m, n.alternate as Node, seen)
        );
      case "CallExpression": {
        const f = functionOf(m, n.callee as Node);
        if (!f || seen.has(f.fn)) return false;
        if (this.factories.has(f.fn)) return true;
        seen.add(f.fn);
        const rets = returnsOf(f.fn);
        return (
          rets.length > 0 && rets.every((r) => r && this.is(f.module, r, seen))
        );
      }
      case "Identifier":
        break;
      default:
        return false;
    }
    const v = m.variable(n);
    const def = v?.defs[0];
    if (!v || !def || seen.has(v)) return false;
    const known = this.#known.get(v);
    if (known !== undefined) return known;
    seen.add(v);
    const r = this.#binding(m, n as Node & t.Identifier, v, seen);
    this.#known.set(v, r);
    return r;
  }

  #binding(
    m: Module,
    n: Node & t.Identifier,
    v: Variable,
    seen: Set<unknown>,
  ): boolean {
    const def = v.defs[0];
    if (def?.type === "ImportBinding") {
      const o = m.bundle?.origin(m, v);
      const id = o?.variable.identifiers[0] as Node | undefined;
      return !!o && !!id && o.variable !== v && this.is(o.module, id, seen);
    }
    if (def?.type === "Variable") {
      const init = initOf(v);
      return !!init && this.is(m, init, seen);
    }
    if (def?.type !== "Parameter" || !isFn(def.node as Node)) return false;
    const fn = def.node as Fn;
    const index = fn.params.findIndex((p) => {
      const id = p.type === "AssignmentPattern" ? p.left : p;
      return id.type === "Identifier" && id.name === n.name;
    });
    const p = fn.params[index];
    if (p?.type === "AssignmentPattern") return isProcessEnv(p.right as Node);
    const calls = callsOf(m, fn);
    return (
      index >= 0 &&
      calls.length > 0 &&
      calls.every(
        (c) =>
          c?.call.arguments[index] &&
          this.is(c.module, c.call.arguments[index] as Node, seen),
      )
    );
  }
}
