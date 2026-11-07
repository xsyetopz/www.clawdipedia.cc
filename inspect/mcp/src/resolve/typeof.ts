// The types an expression can give in a bundled program. `expr` (the keys of an object) comes from the
// class that extends this one.
import {
  type CallNode,
  callsOf,
  constString,
  type Fn,
  functionOf,
  type Module,
  type Node,
  returnsOf,
  type Variable,
} from "../ast.ts";
import {
  bind,
  COMPARE,
  GLOBAL_CALLS,
  isVoid,
  METHODS,
  STATIC_CALLS,
} from "./tables.ts";
import {
  type Entry,
  type Env,
  type JType,
  jsonTypes,
  kindType,
  type Ty,
  union,
  type Val,
} from "./types.ts";

export abstract class TypeResolver {
  #varTypes = new Map<Variable, Ty[] | undefined>();
  protected readonly ty = (v: Val): JType[] | undefined => this.typeOfVal(v);

  abstract expr(
    m: Module,
    n: Node | null,
    env?: Env,
    depth?: number,
  ): Entry[] | undefined;

  /** The JSON types a value can have, or undefined when the code does not show them. */
  typeOfVal(v: Val): JType[] | undefined {
    if (v.k !== "unk") return kindType(v) && [kindType(v) as JType];
    if (v.t !== undefined) return v.t ?? undefined;
    // A type can lead to keys, and keys to types: past a few levels, the type is not known.
    if (!v.ref || this.#nested > 4) return undefined;
    this.#nested++;
    try {
      return jsonTypes(this.typeOf(v.ref.m, v.ref.n, v.ref.env));
    } finally {
      this.#nested--;
    }
  }
  #nested = 0;

  /** The types an expression gives, "absent" for undefined; undefined when one of them is not known. */
  typeOf(m: Module, n: Node | null, env?: Env, depth = 0): Ty[] | undefined {
    // Without the arguments of a call, a node has one type: it is worked out once.
    if (!n || env) return this.#typeOf(m, n, env, depth);
    if (this.#types.has(n)) return this.#types.get(n);
    this.#types.set(n, undefined);
    const got = this.#typeOf(m, n, env, depth);
    this.#types.set(n, got);
    return got;
  }
  #types = new Map<Node, Ty[] | undefined>();

  #typeOf(
    m: Module,
    n: Node | null,
    env?: Env,
    depth = 0,
    chained = false,
  ): Ty[] | undefined {
    if (n?.type === "NullLiteral") return ["null"];
    if (!n || isVoid(n)) return ["absent"];
    if (depth > 12) return undefined;
    // A chain gives "absent" when a link is nullish.
    if (m.isChain(n) && !chained)
      return union(this.#typeOf(m, n, env, depth + 1, true), ["absent"]);
    const t = (x: Node | null | undefined) =>
      this.typeOf(m, (x as Node) ?? null, env, depth + 1);
    switch (n.type) {
      case "StringLiteral":
        return ["string"];
      case "NumericLiteral":
        return ["number"];
      case "BooleanLiteral":
        return ["boolean"];
      case "TemplateLiteral":
        return ["string"];
      case "ArrayExpression":
        return ["array"];
      case "ObjectExpression":
        return ["object"];
      case "UnaryExpression":
        return n.operator === "!" || n.operator === "delete"
          ? ["boolean"]
          : n.operator === "typeof"
            ? ["string"]
            : ["number"];
      case "UpdateExpression":
        return ["number"];
      case "BinaryExpression": {
        if (COMPARE.has(n.operator)) return ["boolean"];
        if (n.operator !== "+") return ["number"];
        const [a, b] = [t(n.left as Node), t(n.right as Node)];
        if (a?.length === 1 && a[0] === "string") return ["string"];
        if (b?.length === 1 && b[0] === "string") return ["string"];
        return a && b && [...a, ...b].every((x) => x === "number")
          ? ["number"]
          : undefined;
      }
      case "LogicalExpression": {
        const a = t(n.left as Node);
        const b = t(n.right as Node);
        return n.operator === "??"
          ? union(
              a?.filter((x) => x !== "null" && x !== "absent"),
              b,
            )
          : union(a, b);
      }
      case "ConditionalExpression":
        return union(t(n.consequent as Node), t(n.alternate as Node));
      case "SequenceExpression":
        return t(n.expressions.at(-1) as Node);
      case "AssignmentExpression":
        return n.operator === "=" ? t(n.right as Node) : undefined;
      case "AwaitExpression":
        return n.argument.type === "CallExpression" &&
          !m.isChain(n.argument as Node)
          ? this.#callType(m, n.argument as CallNode, env, depth, true)
          : t(n.argument as Node);
      case "CallExpression":
        return this.#callType(m, n, env, depth, false);
      case "Identifier":
        return this.#identType(m, n, env, depth);
      case "MemberExpression": {
        if (
          !n.computed &&
          n.property.type === "Identifier" &&
          (n.property.name === "length" || n.property.name === "size")
        )
          return ["number"];
        const key = n.computed
          ? constString(m, n.property as Node)
          : n.property.type === "Identifier"
            ? n.property.name
            : undefined;
        const obj = this.expr(m, n.object as Node, env, depth + 1);
        const e = obj?.find((x) => "key" in x && x.key === key);
        if (!e || !("key" in e)) return undefined;
        const got = this.typeOfVal(e.val);
        return got && (e.opt ? [...got, "absent"] : got);
      }
    }
    return undefined;
  }

  #callType(
    m: Module,
    call: CallNode,
    env: Env | undefined,
    depth: number,
    awaited: boolean,
  ): Ty[] | undefined {
    const c = call.callee as Node;
    const isGlobal = (id: Node) => id.type === "Identifier" && m.isGlobal(id);
    // Own keys only: `toString` and `constructor` are on every object's prototype.
    const own = <T>(o: Record<string, T> | undefined, k: string) =>
      o && Object.hasOwn(o, k) ? o[k] : undefined;
    if (c.type === "Identifier" && isGlobal(c)) {
      const g = own(GLOBAL_CALLS, c.name);
      if (g) return [g];
    }
    if (
      c.type === "MemberExpression" &&
      !c.computed &&
      c.property.type === "Identifier"
    ) {
      const o = c.object as Node;
      const name = c.property.name;
      const statics =
        o.type === "Identifier" && isGlobal(o)
          ? own(STATIC_CALLS, o.name)
          : undefined;
      const got = statics
        ? o.type === "Identifier" && o.name === "Math"
          ? "number"
          : own(statics, name)
        : own(METHODS, name);
      return got ? [got] : undefined;
    }
    const f = functionOf(m, c);
    if (!f || f.fn.generator || (f.fn.async && !awaited)) return undefined;
    const inner = bind(m, call, env, f.module, f.fn);
    const rets = returnsOf(f.fn);
    if (rets.length === 0) return ["absent"];
    let out: Ty[] | undefined = [];
    for (const r of rets)
      out = union(out, this.typeOf(f.module, r, inner, depth + 1));
    return out;
  }

  /** The types of a name: its argument in this call, the arguments at every call, or each write. */
  #identType(
    m: Module,
    id: Node,
    env: Env | undefined,
    depth: number,
  ): Ty[] | undefined {
    if (id.type !== "Identifier") return undefined;
    const v = m.variable(id);
    if (!v)
      return id.name === "undefined"
        ? ["absent"]
        : id.name === "NaN" || id.name === "Infinity"
          ? ["number"]
          : undefined;
    if (env?.has(v)) {
      const arg = env.get(v);
      return arg ? this.typeOf(arg.m, arg.n, arg.env, depth + 1) : ["absent"];
    }
    const o = m.bundle?.origin(m, v) ?? { module: m, variable: v };
    if (this.#varTypes.has(o.variable)) return this.#varTypes.get(o.variable);
    this.#varTypes.set(o.variable, undefined);
    const got = this.#varType(o.module, o.variable, depth);
    this.#varTypes.set(o.variable, got);
    return got;
  }

  #varType(m: Module, v: Variable, depth: number): Ty[] | undefined {
    const def = v.defs[0];
    if (def?.type === "Parameter") {
      const fn = def.node as Fn;
      const index = (fn.params as Node[]).indexOf(def.name);
      if (index < 0) return undefined;
      let out: Ty[] | undefined = [];
      for (const c of callsOf(m, fn)) {
        const args = c?.call.arguments ?? [];
        if (
          !c ||
          args.slice(0, index + 1).some((a) => a.type === "SpreadElement")
        )
          return undefined;
        out = union(
          out,
          this.typeOf(
            c.module,
            (args[index] as Node) ?? null,
            undefined,
            depth + 1,
          ),
        );
      }
      return out?.length ? out : undefined;
    }
    if (def?.type !== "Variable" || def.node.id !== def.name) return undefined;
    const loop = m.parent(def.parent);
    if (
      (loop?.type === "ForOfStatement" || loop?.type === "ForInStatement") &&
      loop.left === def.parent
    )
      return undefined;
    let out: Ty[] | undefined = def.node.init ? [] : ["absent"];
    for (const r of v.references) {
      if (!r.write) continue;
      const p = m.parent(r.identifier);
      const op = p?.type === "AssignmentExpression" ? p.operator : "=";
      const w =
        p?.type === "UpdateExpression"
          ? (["number"] as Ty[])
          : this.typeOf(m, r.writeExpr as Node, undefined, depth + 1);
      // `x+=y` stays a number only for numbers; a string makes it a string.
      const one = (k: Ty) => w?.length && w.every((x) => x === k);
      out =
        op === "=" || op === "??=" || op === "||=" || op === "&&="
          ? union(out, w)
          : op !== "+="
            ? union(out, ["number"])
            : one("number") || one("string")
              ? union(out, w)
              : undefined;
      if (!out) return undefined;
    }
    return out;
  }
}
