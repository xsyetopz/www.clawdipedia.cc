// Kind `gate`: feature and server gates (`tengu_*` names read from the feature store).
// Anchor (checked on 2.1.309, task 1.1): calls `f("tengu_x", …)`, grouped by the function they call
// (resolved through imports; a member call by its property name, as in `F.read`). The gate readers and
// the event logger share the `tengu_` prefix, so the group decides: a function whose calls mostly pass
// an object with keys other than `safe` is an event logger (`a("tengu_x",{feature_name,…})`); any
// other is a gate reader (`F.read("tengu_x",!1)`, `Jr("tengu_x",{safe:!0})`, `h("tengu_x")`). The
// second argument of a reader call is the default: a literal, or `unknown` when computed. A wrapper that passes its first
// parameter on to a logger (`fo(e){…a(e,{…})}`) is a logger too. Names must match `tengu_[a-z0-9_]*[a-z0-9]`,
// which drops prefixes such as `"tengu_"+x`.
// Compared with the old regex `f("tengu_x",<literal>)` (tools/release/diff/extract.ts, 669 names) on
// 2.1.309: 1101 names, 432 only here, 0 only there. Of the 432, 301 are two-word code names
// (`tengu_calm_eagle`) and 224 have a literal default; the rest are reads with no default or with an
// object option (`*_config`, `*_killswitch`, `*_ms`).
import type * as t from "@babel/types";
import {
  children,
  constString,
  type Fn,
  functionOf,
  type Module,
  type Node,
} from "../ast.ts";
import {
  type Extractor,
  keyOf,
  literal,
  type SurfaceItem,
  scan,
  unique,
} from "./common.ts";

type Site = { m: Module; n: Node & t.CallExpression; name: string };

/** An object argument with a key other than `safe`: an event payload. */
const payload = (n: Node | undefined): boolean =>
  n?.type === "ObjectExpression" &&
  n.properties.some((p) => keyOf(p) !== "safe");

export const extractGates: Extractor = (bundle) => {
  const groups = new Map<unknown, Site[]>();
  scan(bundle, ['"tengu_'], (m, n) => {
    if (n.type !== "CallExpression") return;
    const name = constString(m, n.arguments[0] as Node | undefined);
    if (!name || !/^tengu_[a-z0-9_]*[a-z0-9]$/.test(name)) return;
    const c = n.callee as Node;
    const key =
      functionOf(m, c)?.fn ??
      (c.type === "MemberExpression" && c.property.type !== "PrivateName"
        ? `.${m.src(c.property as Node)}`
        : m.src(c));
    const g = groups.get(key) ?? [];
    g.push({ m, n: n as Site["n"], name });
    groups.set(key, g);
  });
  const loggers = new Set(
    [...groups]
      .filter(
        ([, s]) =>
          s.filter((x) => payload(x.n.arguments[1] as Node | undefined))
            .length *
            2 >
          s.length,
      )
      .map(([k]) => k),
  );
  // A wrapper `fo(e){…a(e,{…})…}` that passes its first parameter on to a logger is a logger too.
  for (let grew = true; grew; ) {
    grew = false;
    for (const [k, sites] of groups) {
      if (loggers.has(k) || typeof k === "string") continue;
      const fn = k as Fn;
      const p = fn.params[0];
      const m = sites[0]?.m;
      const fm = m && functionOf(m, sites[0]?.n.callee as Node)?.module;
      if (p?.type !== "Identifier" || !fm) continue;
      const stack: Node[] = [fn.body as Node];
      while (stack.length) {
        const n = stack.pop() as Node;
        const a0 = n.type === "CallExpression" ? n.arguments[0] : undefined;
        if (
          a0?.type === "Identifier" &&
          a0.name === p.name &&
          loggers.has(
            functionOf(fm, (n as t.CallExpression).callee as Node)?.fn,
          )
        ) {
          loggers.add(k);
          grew = true;
          break;
        }
        stack.push(...children(n));
      }
    }
  }
  const out: SurfaceItem[] = [];
  for (const [k, sites] of groups) {
    if (loggers.has(k)) continue;
    for (const { m, n, name } of sites) {
      const d = n.arguments[1] as Node | undefined;
      const def = !d
        ? undefined
        : d.type === "ObjectExpression"
          ? undefined
          : literal(m, d);
      out.push({
        kind: "gate",
        name,
        module: m.name,
        offset: n.start,
        ...(def && { default: def }),
      });
    }
  }
  return unique(out);
};
