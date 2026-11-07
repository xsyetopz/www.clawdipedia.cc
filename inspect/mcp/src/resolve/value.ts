// The keys of the object an expression gives; the calls, parameters, and pins come from the class that
// extends this one.
import type * as t from "@babel/types";
import {
  type CallNode,
  constString,
  type Fn,
  isLit,
  type Module,
  type Node,
  type Variable,
  valueStart,
} from "../ast.ts";
import { isVoid, memberPath } from "./tables.ts";
import { TypeResolver } from "./typeof.ts";
import { type Entry, type Env, mergeEntries, type Val } from "./types.ts";

export abstract class ValueResolver extends TypeResolver {
  #names = new Map<Node, Entry[] | undefined>();

  abstract param(
    m: Module,
    v: Variable,
    fn: Fn,
    depth: number,
  ): Entry[] | undefined;
  abstract call(
    m: Module,
    call: CallNode,
    env?: Env,
    depth?: number,
  ): Entry[] | undefined;
  abstract pin(entries: Entry[], depth?: number): Entry[];

  /** Entries of the object literal whose `{` is at `pos`; empty when there is none. */
  objectAt(m: Module, pos: number): Entry[] {
    const o = m.at(pos, "ObjectExpression");
    return o ? this.entries(m, o) : [];
  }

  /** Entries of an object literal: keys (computed ones when they are constant strings) and spreads. */
  entries(m: Module, obj: Node & t.ObjectExpression, env?: Env): Entry[] {
    const out: Entry[] = [];
    const spread = (n: Node, opt: boolean) => {
      if (n.type === "ObjectExpression")
        for (const e of this.entries(m, n, env))
          out.push({ ...e, opt: e.opt || opt });
      else if (n.type === "LogicalExpression" && n.operator === "&&")
        spread(n.right as Node, true);
      // `a ?? {...}` and `a || {...}`: the keys of either side.
      else if (n.type === "LogicalExpression") {
        spread(n.left as Node, true);
        spread(n.right as Node, true);
      } else if (n.type === "ConditionalExpression") {
        spread(n.consequent as Node, true);
        spread(n.alternate as Node, true);
      } else if (
        !isVoid(n) &&
        !isLit(n) &&
        !(n.type === "UnaryExpression" && n.operator === "!")
      )
        out.push({ spread: m.src(n), opt, ref: { m, n, env } });
    };
    for (const p of obj.properties as (Node &
      (t.ObjectProperty | t.ObjectMethod | t.SpreadElement))[]) {
      if (p.type === "SpreadElement") {
        spread(p.argument as Node, false);
        continue;
      }
      const k = p.key as Node;
      const key = p.computed
        ? constString(m, k)
        : k.type === "Identifier"
          ? k.name
          : isLit(k)
            ? String((k as t.StringLiteral).value)
            : undefined;
      if (key === undefined) continue;
      out.push({
        key,
        opt: false,
        val:
          p.type === "ObjectProperty"
            ? this.value(m, p.value as Node, env)
            : { k: "unk", text: m.text.slice(valueStart(m.text, p), p.end) },
      });
    }
    return out;
  }

  value(m: Module, n: Node, env?: Env): Val {
    if (n.type === "StringLiteral") return { k: "str", v: n.value };
    if (n.type === "NumericLiteral") return { k: "num", v: n.value };
    if (n.type === "BooleanLiteral") return { k: "bool", v: n.value };
    if (n.type === "TemplateLiteral" && n.expressions.length === 0)
      return { k: "str", v: n.quasis[0]?.value.cooked ?? "" };
    if (n.type === "UnaryExpression" && n.argument.type === "NumericLiteral") {
      if (n.operator === "!") return { k: "bool", v: !n.argument.value };
      if (n.operator === "-") return { k: "num", v: -n.argument.value };
    }
    // `c ? "a" : "b"`: the strings of both branches. Any other branch makes it unknown.
    if (n.type === "ConditionalExpression") {
      const all = [n.consequent, n.alternate].map((b) =>
        this.value(m, b as Node, env),
      );
      const v = [
        ...new Set(
          all.flatMap((x) => (x.k === "str" || x.k === "enum" ? x.v : [])),
        ),
      ];
      if (all.every((x) => x.k === "str" || x.k === "enum"))
        return v.length === 1
          ? { k: "str", v: v[0] as string }
          : { k: "enum", v };
    }
    if (n.type === "ArrayExpression") return { k: "arr" };
    if (n.type === "ObjectExpression")
      return { k: "obj", e: this.entries(m, n, env) };
    return { k: "unk", text: m.src(n), ref: { m, n, env } };
  }

  /**
   * Entries of the object an expression gives: a literal, a call, a name, `a.b`, `await x`, `a,b`, or a
   * ternary of those. Null and undefined give no entries, as a spread of them adds nothing.
   */
  expr(m: Module, n: Node | null, env?: Env, depth = 0): Entry[] | undefined {
    if (!n || isVoid(n)) return [];
    if (depth > 12) return undefined;
    switch (n.type) {
      case "AwaitExpression":
        return this.expr(m, n.argument as Node, env, depth);
      case "SequenceExpression":
        return this.expr(m, n.expressions.at(-1) as Node, env, depth);
      case "ConditionalExpression": {
        const a = this.expr(m, n.consequent as Node, env, depth);
        const c = this.expr(m, n.alternate as Node, env, depth);
        return a && c ? mergeEntries([a, c], this.ty) : undefined;
      }
      case "ObjectExpression":
        return this.pin(this.entries(m, n, env), depth + 1);
      case "CallExpression":
        return this.call(m, n, env, depth);
      case "Identifier":
        return this.ident(m, n, env, depth);
      case "MemberExpression": {
        const p = memberPath(m, n);
        let got = p && this.ident(m, p.root, env, depth);
        for (const k of p?.path ?? []) {
          const e = got?.find((x) => "key" in x && x.key === k);
          got = e && "key" in e && e.val.k === "obj" ? e.val.e : undefined;
        }
        return got;
      }
    }
    return undefined;
  }

  /**
   * Entries of the object that a name holds at its use: the value of each write before the use (and
   * the keys that `name.key=` adds), the argument of the call it is evaluated in, or for a parameter the
   * argument at every call site.
   */
  ident(m: Module, id: Node, env?: Env, depth = 0): Entry[] | undefined {
    const v = m.variable(id);
    if (!v) return undefined;
    if (env?.has(v)) {
      const arg = env.get(v);
      return arg ? this.expr(arg.m, arg.n, arg.env, depth + 1) : [];
    }
    const o = m.bundle?.origin(m, v) ?? { module: m, variable: v };
    const def = o.variable.defs[0];
    if (def?.type === "Parameter")
      return this.param(o.module, o.variable, def.node as Fn, depth);
    if (def?.type !== "Variable" || def.node.id !== def.name) return undefined;
    const loop = o.module.parent(def.parent);
    if (
      (loop?.type === "ForOfStatement" || loop?.type === "ForInStatement") &&
      loop.left === def.parent
    )
      return undefined;
    const cacheable = !env && o.module !== m;
    if (cacheable && this.#names.has(def.name as Node))
      return this.#names.get(def.name as Node);
    if (cacheable) this.#names.set(def.name as Node, undefined);
    // In another module every write counts; here, the writes before the use.
    const before = o.module === m ? id.start : Number.POSITIVE_INFINITY;
    const lists: Entry[][] = [];
    const later: Entry[] = [];
    if (!def.node.init) lists.push([]);
    for (const r of o.variable.references) {
      const at = r.identifier.start;
      if (at >= before) continue;
      const p = o.module.parent(r.identifier);
      if (r.write) {
        if (p?.type === "AssignmentExpression" && p.operator !== "=") continue;
        const got = this.expr(o.module, r.writeExpr as Node, env, depth + 1);
        if (!got) return undefined;
        lists.push(got);
        continue;
      }
      // `name.key=value` adds a key.
      const a = p && o.module.parent(p);
      if (
        p?.type === "MemberExpression" &&
        p.object === r.identifier &&
        a?.type === "AssignmentExpression" &&
        a.left === p &&
        a.operator === "="
      ) {
        const key = memberPath(o.module, p)?.path[0];
        if (key !== undefined)
          later.push({
            key,
            opt: true,
            val: this.value(o.module, a.right as Node, env),
          });
      }
    }
    const merged = [...mergeEntries(lists, this.ty), ...later];
    // No key at all: the name may hold a string or a number, so it is no known object.
    const out = merged.length > 0 ? merged : undefined;
    if (cacheable) this.#names.set(def.name as Node, out);
    return out;
  }
}
