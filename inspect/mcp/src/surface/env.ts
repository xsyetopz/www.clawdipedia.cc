// Kind `env`: environment variables the program reads or sets for a child process.
// Anchors (checked on 2.1.309, task 1.1):
// 1. The typed registry: `reg(ns,{NAME:()=>v,...})` where most getters are `v=H.bool()`, `H.triBool()`,
//    `H.int({min:0})`, `H.str()`, or `H.enum([...])` (chunk-jnz7zw3f.js in 2.1.309). The method gives
//    `detail`, the enum array gives `values`.
// 2. Env objects: `process.env`; a proxy made by a function that is called with a registry namespace
//    (`i=WG({...ns1,...ns2},c)`, `Zn=WG({},null)`); a call of a function that returns an env object
//    (`Io()`); an object that spreads one; a variable, an import, a parameter default, or a parameter
//    that every call fills with one. Reads of an env object: `x.NAME`, `x["NAME"]`, `"NAME" in x`,
//    and `const {NAME}=x`. Only SCREAMING_CASE names count, except on `process.env` itself.
// 3. Helpers that read `process.env[param]` or `globalThis.process.env?.[param]` (the SDK's), and
//    OpenTelemetry readers `x.get*FromEnv("NAME")` and their wrappers, called with a constant string.
// 4. Names set for a child process: the keys (also `[CONST]`) of `{...env, NAME:v}`, of an `env:{...}`
//    option, of objects spread into those (`...s&&{NAME:s}`), and `"--setenv","NAME"` sandbox arguments.
// 5. Name lists and name-keyed objects of uppercase strings (`["A_B",...x,"C"]`, `{A_B:1}`) where at
//    least a third of the names are found: the rest of their `A_B` names, with detail "listed". Repeated
//    until no list adds a name, so lists that share names (the telemetry set `bi`, the child-env scrub
//    lists) fill each other.
// Compared with the old `strings` heuristic (tools/release/diff/extract.ts, 1257 names) on 2.1.309:
// 1846 names, 704 only here, 115 only there.
// - Only here: 703 start with a prefix outside its 12 `ENV_PREFIXES` (GIT, AWS, CCR, VERTEX, AZURE, ...;
//   mostly the child-env scrub lists); CLAUDE_CODE_VERSION is set in a child `env:{}` with an object value.
// - Only there, not env names: constants and enum words (`MAX_*`, `NO_*`, `API_*`, `MCP_ENTRY_*`,
//   `OTEL_STATUS_CODE_VALUE_*`, `IS_A_SYMLINK`, `MCP_TRANSPORT_POLICY_ONLY`), shell variables (`BASH_*`),
//   config fields and hosts (`MCP_PROXY_URL`, `CLAUDE_AI_HOST`, `ANTHROPIC_TIER_NAMES`,
//   `ANTHROPIC_TELEMETRY_GROUP`), export names (`CLAUDE_AGENT`, `MCP_TASK`, `ENABLE_STUB_TOOLS`,
//   `CLAUDE_NAMES`), a warning code (`CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`), a file name (`CLAUDE_BASE`),
//   UI text (`CLAUDE_API_KEY` placeholder, `CLAUDE_IN_SLACK_V2`), and part of a regex (`DISABLE_COLORS`).
// - Only there, by design: `${NAME}` placeholders (`CLAUDE_SKILL_DIR`, `CLAUDE_SESSION_ID`,
//   `CLAUDE_TEST_*`, `CLAUDE_SESSION_SURFACE`, `CLAUDE_DEV_MODS_DIR`), and a name only in help text
//   (`CLAUDE_HELPER_CONTEXT`).
// - Only there, missed: `CLAUDE_CODE_DISABLE_HOME_SETTINGS_SEED` (read from a method result,
//   `e.spawnEnv()`), `CLAUDE_RUNNER_CLAUDE_BIN` (set in an env object with no `env:` key or spread),
//   and `CLAUDE_CODE_ARTIFACT_FD` (held in a constant; no read found).
import type * as t from "@babel/types";
import {
  callsOf,
  children,
  constString,
  type Fn,
  isFn,
  type Module,
  type Node,
  nameOf,
} from "../ast.ts";
import {
  type Extractor,
  keyOf,
  type Prop,
  propValue,
  type SurfaceItem,
  scan,
  strings,
  unique,
} from "./common.ts";

const EACH = new Set(["map", "flatMap", "forEach", "filter", "some", "every"]);
/** The names of a constant string list that `list.flatMap(f)` passes to `f`, when `f` is `n`. */
const eachName = (m: Module, n: Node): string[] => {
  const c = m.parent(n);
  if (
    c?.type !== "CallExpression" ||
    c.arguments[0] !== n ||
    c.callee.type !== "MemberExpression" ||
    c.callee.property.type !== "Identifier" ||
    !EACH.has(c.callee.property.name)
  )
    return [];
  const list = c.callee.object as Node;
  const def = list.type === "Identifier" ? m.variable(list)?.defs[0] : null;
  const init = def?.type === "Variable" ? (def.node.init as Node) : list;
  return strings(m, init) ?? [];
};

const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const UPPER = /^[A-Z_][A-Z0-9_]*$/;
const LISTED = /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/;
const TYPES = new Set([
  "bool",
  "triBool",
  "int",
  "num",
  "float",
  "str",
  "enum",
  "list",
  "json",
  "url",
  "path",
]);

import { EnvObjects, isProcessEnv, type Variable } from "./env/objects.ts";

const registryType = (
  m: Module,
  getter: Node,
): { method: string; detail: string; values?: string[] } | undefined => {
  if (
    getter.type !== "ArrowFunctionExpression" ||
    getter.body.type !== "Identifier"
  )
    return undefined;
  const v = m.variable(getter.body as Node);
  const def = v?.defs[0];
  const init = def?.type === "Variable" ? (def.node.init as Node | null) : null;
  if (init?.type !== "CallExpression") return undefined;
  const c = init.callee as Node;
  if (c.type !== "MemberExpression" || c.property.type !== "Identifier")
    return undefined;
  const values = strings(m, init.arguments[0] as Node | undefined);
  const opts =
    init.arguments[0]?.type === "ObjectExpression"
      ? m.src(init.arguments[0] as Node)
      : "";
  return {
    method: c.property.name,
    detail: `${c.property.name}${opts}`,
    ...(values && { values }),
  };
};

/** The index of `id` among the parameters of the function that declares it, with that function. */
const paramOf = (
  m: Module,
  id: Node,
): { fn: Fn; index: number } | undefined => {
  if (id.type !== "Identifier") return undefined;
  const def = m.variable(id)?.defs[0];
  if (def?.type !== "Parameter" || !isFn(def.node as Node)) return undefined;
  const fn = def.node as Fn;
  const index = fn.params.findIndex(
    (p) => p.type === "Identifier" && p.name === id.name,
  );
  return index < 0 ? undefined : { fn, index };
};

export const extractEnv: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  const add = (
    m: Module,
    n: Node,
    name: string,
    extra: Partial<SurfaceItem> = {},
  ) => {
    if (NAME.test(name))
      out.push({
        kind: "env",
        name,
        module: m.name,
        offset: n.start,
        ...extra,
      });
  };
  const env = new EnvObjects();

  // 1. registries
  const regs: { m: Module; v: Variable }[] = [];
  scan(bundle, [":()=>"], (m, n) => {
    if (
      n.type !== "CallExpression" ||
      n.arguments.length !== 2 ||
      n.arguments[1]?.type !== "ObjectExpression"
    )
      return;
    const o = n.arguments[1] as t.ObjectExpression;
    const keys = o.properties.map(keyOf);
    if (keys.length < 3 || !keys.every((k) => k && NAME.test(k))) return;
    const types = (o.properties as Prop[]).map((p) =>
      registryType(m, propValue(p)),
    );
    // An env registry: most getters are typed (`H.bool()`, ...); a constants namespace is not.
    if (types.filter((t) => t && TYPES.has(t.method)).length * 2 < types.length)
      return;
    (o.properties as Prop[]).forEach((p, i) => {
      const t = types[i];
      add(
        m,
        p as unknown as Node,
        keyOf(p) as string,
        t ? { detail: t.detail, ...(t.values && { values: t.values }) } : {},
      );
    });
    const ns = n.arguments[0] as Node;
    const v = ns.type === "Identifier" ? m.variable(ns) : undefined;
    if (v) regs.push({ m, v });
  });
  env.findFactories(regs);

  // 2-5. reads, helpers, names set for a child, lists
  const helpers: { m: Module; fn: Fn; index: number }[] = [];
  const lists: { m: Module; n: Node; names: string[] }[] = [];
  scan(bundle, [""], (m, n) => {
    if (
      n.type === "MemberExpression" &&
      !isProcessEnv(n) &&
      env.is(m, n.object as Node)
    ) {
      const direct = isProcessEnv(n.object as Node);
      if (!n.computed && n.property.type === "Identifier") {
        if (direct || UPPER.test(n.property.name)) add(m, n, n.property.name);
      } else if (n.computed) {
        const s = constString(m, n.property as Node);
        if (s !== undefined) add(m, n, s);
        else {
          const p = paramOf(m, n.property as Node);
          if (p) helpers.push({ m, ...p });
        }
      }
      return;
    }
    if (
      n.type === "BinaryExpression" &&
      n.operator === "in" &&
      env.is(m, n.right as Node)
    ) {
      const s = constString(m, n.left as Node);
      if (s !== undefined) add(m, n, s);
      return;
    }
    if (
      n.type === "VariableDeclarator" &&
      n.init &&
      n.id.type === "ObjectPattern" &&
      env.is(m, n.init as Node)
    )
      for (const p of n.id.properties) {
        const k = p.type === "ObjectProperty" ? keyOf(p) : undefined;
        if (k) add(m, p as unknown as Node, k);
      }
    if (n.type === "ObjectExpression") {
      const parent = m.parent(n);
      const option =
        parent?.type === "ObjectProperty" &&
        keyOf(parent) === "env" &&
        parent.value === n;
      if (option || env.is(m, n)) {
        const stack: Node[] = [n];
        while (stack.length) {
          const o = stack.pop() as Node;
          if (o.type === "LogicalExpression") stack.push(o.right as Node);
          else if (o.type === "ConditionalExpression")
            stack.push(o.consequent as Node, o.alternate as Node);
          else if (o.type === "ObjectExpression")
            for (const p of o.properties) {
              if (p.type === "SpreadElement") stack.push(p.argument as Node);
              const k =
                p.type === "SpreadElement"
                  ? undefined
                  : p.computed
                    ? constString(m, p.key as Node)
                    : keyOf(p);
              if (k && UPPER.test(k))
                add(m, p as unknown as Node, k, {
                  detail: "set for a child process",
                });
            }
        }
      }
      if (n.properties.length >= 2) {
        const s = n.properties.map((p) =>
          p.type === "SpreadElement" ? undefined : keyOf(p),
        );
        if (s.every((x) => x && UPPER.test(x)))
          lists.push({ m, n, names: s as string[] });
      }
    }
    // OpenTelemetry SDK readers (`x.getNumberFromEnv("OTEL_…")`); property names survive minifying.
    if (
      n.type === "CallExpression" &&
      n.callee.type === "MemberExpression" &&
      n.callee.property.type === "Identifier" &&
      /^get\w*FromEnv$/.test(n.callee.property.name)
    ) {
      const s = constString(m, n.arguments[0] as Node | undefined);
      const p =
        s === undefined && n.arguments[0]
          ? paramOf(m, n.arguments[0] as Node)
          : undefined;
      if (s !== undefined) add(m, n, s);
      else if (p) helpers.push({ m, ...p });
    }
    // `(j)=>Object.entries(process.env).filter(([k])=>k.toUpperCase()===j)`: a helper that matches its
    // parameter against each name, in any case.
    if (
      n.type === "CallExpression" &&
      n.callee.type === "MemberExpression" &&
      n.callee.object.type === "Identifier" &&
      n.callee.object.name === "Object" &&
      n.callee.property.type === "Identifier" &&
      ["entries", "keys"].includes(n.callee.property.name) &&
      n.arguments[0] &&
      env.is(m, n.arguments[0] as Node)
    ) {
      let fn = m.parent(n);
      while (fn && !isFn(fn)) fn = m.parent(fn);
      const stack: Node[] = fn ? [fn.body as Node] : [];
      while (stack.length) {
        const b = stack.pop() as Node;
        stack.push(...children(b));
        if (b.type !== "BinaryExpression" || b.operator !== "===") continue;
        for (const side of [b.left, b.right] as Node[]) {
          const p = paramOf(m, side);
          if (p && p.fn === fn) helpers.push({ m, ...p });
        }
      }
    }
    // `"--setenv","NAME",v`: a name set for the sandboxed child (bubblewrap arguments)
    const args =
      n.type === "CallExpression"
        ? n.arguments
        : n.type === "ArrayExpression"
          ? n.elements
          : [];
    args.forEach((a, i) => {
      const k =
        a && constString(m, a as Node) === "--setenv"
          ? constString(m, args[i + 1] as Node | undefined)
          : undefined;
      if (k && UPPER.test(k))
        add(m, a as Node, k, { detail: "set for a child process" });
    });
    if (n.type === "ArrayExpression") {
      // Spreads and names of other lists may sit among the strings (`["A_B",...x,y,"C_D"]`).
      const s = (n.elements as (Node | null)[]).flatMap(
        (e) => constString(m, e) ?? [],
      );
      if (s.length >= 2 && s.every((x) => UPPER.test(x)))
        lists.push({ m, n, names: s });
    }
  });
  // A helper may pass its parameter on to another helper (`wt(e)` -> `Su(e)` -> `process.env[e]`).
  const done = new Set<Fn>();
  for (const h of helpers) {
    if (done.has(h.fn)) continue;
    done.add(h.fn);
    if (h.index === 0)
      for (const u of [
        h.fn as Node,
        ...(nameOf(h.m, h.fn)?.references.map((r) => r.identifier as Node) ??
          []),
      ])
        for (const s of eachName(h.m, u)) add(h.m, u, s);
    for (const c of callsOf(h.m, h.fn)) {
      const a = c?.call.arguments[h.index] as Node | undefined;
      const s = c && constString(c.module, a);
      const p = c && a && s === undefined ? paramOf(c.module, a) : undefined;
      if (c && s !== undefined) add(c.module, c.call as Node, s);
      else if (c && p) helpers.push({ m: c.module, ...p });
    }
  }
  // Names added from one list count for the next ones, until no list adds a name.
  const found = new Set(out.map((i) => i.name));
  for (let grew = true; grew; ) {
    grew = false;
    for (const l of lists) {
      if (l.names.filter((x) => found.has(x)).length * 3 < l.names.length)
        continue;
      for (const x of l.names)
        if (!found.has(x) && LISTED.test(x)) {
          add(l.m, l.n, x, { detail: "listed" });
          found.add(x);
          grew = true;
        }
    }
  }
  return unique(out);
};
