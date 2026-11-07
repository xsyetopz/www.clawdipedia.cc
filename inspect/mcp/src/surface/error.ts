// Kind `error`: error and warning text a user can see.
// Anchor (checked on 2.1.309, task 1.1): the message (first argument) of `throw Error(…)` and
// `throw new X(…)` (each branch of a `c ? … : …` argument counts), where `X` is Error, TypeError, RangeError, SyntaxError (the global, not a local
// binding), or a class that extends one (the class is found through its binding, followed across imports,
// and through its `extends` chain); and the argument of `process.stderr.write(…)`. A message is a literal,
// a name bound once to a literal, a template, or a `+` concatenation with at least one literal part; `${…}`
// parts and other operands are blanked (short). Factory throws such as `throw dyn("Cloud gateway")` are
// left out, because their argument is not the message. `console.error` is left out, because only bundled
// libraries use it. `detail` is "throw <Class>" or "stderr".
// Filter (design D3): drop texts shorter than 10 characters, with no space, or with no letters, and texts
// inside a bundled CommonJS module (`x((e,n)=>{…n.exports=…})`), which is library code. On 2.1.309 that
// drops 507 of 4529 texts, leaving 4022 (OpenTelemetry protobuf, crypto, XML, CSS selector, JWT). Bundled ES modules have no such wrapper, and no
// module or function marker tells them from app code without losing app texts, so the rest stay.
// The old `strings` heuristic has no error list, so there is nothing to compare.
import type * as t from "@babel/types";
import { constString, isFn, type Module, type Node } from "../ast.ts";
import {
  type Extractor,
  type SurfaceItem,
  scan,
  short,
  unique,
} from "./common.ts";

/** Stands for a part that the code computes (short blanks it again). */
const BLANK = `\${}`;

const BASE = new Set(["Error", "TypeError", "RangeError", "SyntaxError"]);

/** The builtin error that the class `id` names is or extends (`TypeError`), or undefined. */
const errorClass = (m: Module, id: Node, depth = 0): string | undefined => {
  if (id.type !== "Identifier" || depth > 8) return undefined;
  const v0 = m.variable(id);
  if (!v0 || v0.defs.length === 0)
    return BASE.has(id.name) ? id.name : undefined;
  const o = m.bundle ? m.bundle.origin(m, v0) : { module: m, variable: v0 };
  if (!o) return undefined;
  const def = o.variable.defs[0];
  const writes = o.variable.references.filter((r) => r.write && !r.init);
  const cls: Node | null | undefined =
    def?.type === "ClassName"
      ? (def.node as Node)
      : def?.type === "Variable" && def.node.init
        ? (def.node.init as Node)
        : (writes[0]?.writeExpr as Node | undefined);
  if (
    (cls?.type !== "ClassDeclaration" && cls?.type !== "ClassExpression") ||
    !cls.superClass
  )
    return undefined;
  return errorClass(o.module, cls.superClass as Node, depth + 1);
};

/** The text of a message expression, with unknown parts blanked, or undefined when it holds no literal. */
const text = (m: Module, n: Node | undefined): string | undefined => {
  if (!n) return undefined;
  const s = constString(m, n);
  if (s !== undefined) return s;
  if (n.type === "TemplateLiteral") {
    return n.quasis
      .map(
        (q, i) =>
          (q.value.cooked ?? q.value.raw) +
          (i < n.expressions.length ? BLANK : ""),
      )
      .join("");
  }
  if (n.type === "BinaryExpression" && n.operator === "+") {
    const l = text(m, n.left as Node);
    const r = text(m, n.right as Node);
    if (l === undefined && r === undefined) return undefined;
    return (l ?? BLANK) + (r ?? BLANK);
  }
  return undefined;
};

const keep = (s: string): boolean =>
  s.length >= 10 && s.includes(" ") && /[A-Za-z]/.test(s);

const cjs = new WeakMap<Node, boolean>();
/** Inside a bundled CommonJS module: `x((e,n)=>{…n.exports=…})`, a function that is a call's only argument. */
const inLibrary = (m: Module, at: Node): boolean => {
  for (let n = m.parent(at); n; n = m.parent(n)) {
    if (!isFn(n)) continue;
    let hit = cjs.get(n);
    if (hit === undefined) {
      const p = m.parent(n);
      const names = n.params.flatMap((x) =>
        x.type === "Identifier" ? [x.name] : [],
      );
      hit =
        p?.type === "CallExpression" &&
        p.arguments.length === 1 &&
        p.arguments[0] === n &&
        names.length === n.params.length &&
        names.length >= 1 &&
        names.length <= 2 &&
        names.some((x) => m.src(n).includes(`${x}.exports`));
      cjs.set(n, hit);
    }
    if (hit) return true;
  }
  return false;
};

type Call = t.NewExpression | t.CallExpression;

/** The constructions a throw can raise: both branches of `c ? new A(…) : new B(…)` raise one each. */
const thrown = (a: t.Expression): Call[] =>
  a.type === "ConditionalExpression"
    ? [...thrown(a.consequent), ...thrown(a.alternate)]
    : a.type === "NewExpression" || a.type === "CallExpression"
      ? [a]
      : [];

export const extractErrors: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  const add = (m: Module, call: Call, detail: string) => {
    const t = text(m, call.arguments[0] as Node | undefined);
    if (t === undefined) return;
    const name = short(t);
    if (keep(name) && !inLibrary(m, call as Node))
      out.push({
        kind: "error",
        name,
        module: m.name,
        offset: (call as Node).start,
        detail,
      });
  };
  scan(bundle, ["throw", "stderr"], (m, n) => {
    if (n.type === "ThrowStatement") {
      for (const call of thrown(n.argument as t.Expression)) {
        const base = errorClass(m, call.callee as Node);
        if (base) add(m, call, `throw ${base}`);
      }
    } else if (
      n.type === "CallExpression" &&
      n.callee.type === "MemberExpression" &&
      !n.callee.computed &&
      n.callee.property.type === "Identifier" &&
      n.callee.property.name === "write" &&
      m.src(n.callee.object as Node) === "process.stderr"
    )
      add(m, n, "stderr");
  });
  return unique(out);
};
