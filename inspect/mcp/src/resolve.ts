// Finds the keys of the object an expression gives in a bundled program: object literals, their spreads,
// the values a name is bound to, the arguments a parameter gets at each call, and what a called function
// returns, across chunks. A value it cannot follow stays unknown.
import {
  type CallNode,
  callsOf,
  type Fn,
  functionOf,
  type Module,
  type Node,
  returnsOf,
  type Variable,
} from "./ast.ts";
import { bind, isVoid } from "./resolve/tables.ts";
import {
  type Entry,
  type Env,
  mergeEntries,
  type Val,
} from "./resolve/types.ts";
import { ValueResolver } from "./resolve/value.ts";

export type { Entry, Env, JType, Ref, Val } from "./resolve/types.ts";
export { mergeEntries } from "./resolve/types.ts";

export class Resolver extends ValueResolver {
  /**
   * Each time a spread could not be followed, as `<module>@<index>: ...<text>`, also in an object read
   * only for the type of one of its keys. A result is cached, so a spread is logged at its first visit.
   */
  readonly unresolved: string[] = [];
  #params = new Map<Variable, Entry[] | undefined>();

  /** A parameter with no call to bind it: the argument at every call of its function. */
  param(m: Module, v: Variable, fn: Fn, depth: number): Entry[] | undefined {
    const index = (fn.params as Node[]).indexOf(v.defs[0]?.name as Node);
    if (index < 0) return undefined;
    if (this.#params.has(v)) return this.#params.get(v);
    this.#params.set(v, undefined);
    const lists: Entry[][] = [];
    let ok = true;
    // `f(...).then((x)=>...)`: `x` is what `f` returns.
    const p = m.parent(fn);
    if (
      index === 0 &&
      p?.type === "CallExpression" &&
      p.arguments[0] === fn &&
      p.callee.type === "MemberExpression" &&
      p.callee.property.type === "Identifier" &&
      p.callee.property.name === "then"
    ) {
      const got = this.expr(m, p.callee.object as Node, undefined, depth + 1);
      if (got) lists.push(got);
      else ok = false;
    } else
      for (const c of callsOf(m, fn)) {
        const args = c?.call.arguments ?? [];
        if (
          !c ||
          args.slice(0, index + 1).some((a) => a.type === "SpreadElement")
        ) {
          ok = false;
          break;
        }
        const got = this.expr(
          c.module,
          (args[index] as Node) ?? null,
          undefined,
          depth + 1,
        );
        if (!got) {
          ok = false;
          break;
        }
        lists.push(got);
      }
    const merged = mergeEntries(lists, this.ty);
    const out = ok && merged.length > 0 ? merged : undefined;
    this.#params.set(v, out);
    return out;
  }

  /**
   * Entries returned by a call like `f(a,b)`, where `f` is any function the callee names, in this chunk or
   * an imported one. The parameters bind to this call's arguments; one it leaves out is undefined, and a
   * key whose value is undefined is dropped, as JSON drops it.
   */
  call(m: Module, call: CallNode, env?: Env, depth = 0): Entry[] | undefined {
    if (depth > 10) return undefined;
    const f = functionOf(m, call.callee as Node);
    if (!f) return undefined;
    const { module: dm, fn } = f;
    const rets = returnsOf(fn).filter((r): r is Node => r !== null);
    if (rets.length === 0) return undefined;
    const inner = bind(m, call, env, dm, fn);
    // Undefined, which JSON drops; null stays.
    const isUndef = (n: Node | null | undefined): boolean => {
      if (n?.type === "NullLiteral") return false;
      if (!n || isVoid(n)) return true;
      if (n.type === "Identifier") {
        const v = dm.variable(n);
        if (!v) return false;
        if (inner.has(v)) return inner.get(v) === null;
        const d = v.defs[0];
        const writes = v.references.filter((r) => r.write && !r.init);
        return (
          d?.type === "Variable" &&
          writes.length === 0 &&
          d.node.init !== null &&
          isUndef(d.node.init as Node)
        );
      }
      if (n.type === "LogicalExpression")
        return n.operator === "??"
          ? isUndef(n.left as Node) && isUndef(n.right as Node)
          : n.operator === "&&" && isUndef(n.left as Node);
      if (n.type === "ConditionalExpression") {
        let t = n.test as Node;
        while (t.type === "LogicalExpression" && t.operator === "&&")
          t = t.left as Node;
        return isUndef(t) && isUndef(n.alternate as Node);
      }
      if (n.type === "MemberExpression" && "optional" in n && n.optional)
        return isUndef(n.object as Node);
      return false;
    };
    const unset = (e: Entry) =>
      "key" in e &&
      e.val.k === "unk" &&
      e.val.ref !== undefined &&
      isUndef(e.val.ref.n);
    const returned = (n: Node): Entry[][] | undefined => {
      if (n.type === "SequenceExpression")
        return returned(n.expressions.at(-1) as Node);
      if (n.type === "ConditionalExpression") {
        const a = returned(n.consequent as Node);
        const b = returned(n.alternate as Node);
        return a && b ? [...a, ...b] : undefined;
      }
      if (n.type === "AwaitExpression") return returned(n.argument as Node);
      if (n.type === "ObjectExpression")
        return [
          this.spreads(
            this.entries(dm, n, inner).filter((e) => !unset(e)),
            depth + 1,
          ).filter((e) => "key" in e),
        ];
      const got = this.expr(dm, n, inner, depth + 1);
      return got && [got];
    };
    const lists: Entry[][] = [];
    for (const r of rets) {
      const got = returned(r);
      if (!got) return undefined;
      lists.push(...got);
    }
    return this.pin(mergeEntries(lists, this.ty), depth + 1);
  }

  /** Inline the spreads that resolve; count the others as unresolved. */
  spreads(entries: Entry[], depth = 0): Entry[] {
    const out: Entry[] = [];
    for (const e of entries) {
      if ("key" in e) {
        out.push(e);
        continue;
      }
      const got = e.ref && this.expr(e.ref.m, e.ref.n, e.ref.env, depth);
      if (got && depth < 6)
        for (const inner of this.spreads(got, depth + 1))
          out.push({ ...inner, opt: inner.opt || e.opt });
      else
        this.unresolved.push(
          `${e.ref?.m.name ?? "?"}@${e.ref?.n.start ?? -1}: ...${e.spread}`,
        );
    }
    return out;
  }

  /** The object a value holds, when it holds one with keys: an empty result may be null or a number. */
  objectValue(v: Val, depth = 0): Entry[] | undefined {
    if (v.k === "obj") return v.e;
    if (v.k !== "unk" || !v.ref) return undefined;
    const got = this.expr(v.ref.m, v.ref.n, v.ref.env, depth);
    return got?.length ? got : undefined;
  }

  /**
   * Resolve spreads and the values that hold objects. A value left unknown loses its place in the
   * program, so that no later step reads it again.
   */
  pin(entries: Entry[], depth = 0): Entry[] {
    return this.spreads(entries, depth).map((e) => {
      if (!("key" in e)) return e;
      const inner = depth < 8 ? this.objectValue(e.val, depth) : undefined;
      if (inner)
        return {
          ...e,
          val: {
            k: "obj",
            e: this.pin(inner, depth + 1),
            ...(e.val.k === "obj" && e.val.open && { open: true }),
          },
        };
      // It keeps its types, which are worked out while its place is known.
      return e.val.k === "unk"
        ? {
            ...e,
            val: {
              k: "unk",
              text: e.val.text,
              t: this.typeOfVal(e.val) ?? null,
            },
          }
        : e;
    });
  }
}
