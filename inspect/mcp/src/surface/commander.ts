// Kinds `flag` and `subcommand`: the Commander program of the CLI.
// Anchors (checked on 2.1.309, task 1.1): Commander keeps its method names when minified.
// - `subcommand`: `.command("name [args]")` with a constant string. The full path joins the
//   `.command()` calls of the chain and of the variable it is called on (`mcp add`). `{hidden:!0}` as
//   the second argument marks it hidden.
// - `flag`: `.option("-d, --debug [filter]","desc")`, `.requiredOption(...)`, and
//   `.addOption(new X("--init","desc"))` (the Option class name is minified, so the anchor is the flag
//   spec as the first argument). The Option may sit in a variable (`let h=new X(...)`), a factory
//   (`s=()=>new X(...)`), or `c?h:h.hideHelp()`. `.hideHelp()` marks it hidden, a conditional one gives
//   `hidden unless <condition>`. Commander's own `this.addOption(r)` resolves to no flag spec.
// Compared with the old `strings` heuristic on 2.1.309 (keys: the long flag, and the last word of a
// subcommand):
// - flag: 303 items (86 hidden; 173 on subcommands). Only here: `--issuer` (`.requiredOption`, which the
//   old regex skips), `--debug-to-stderr` (short form `-d2e` has more than one letter). Only there:
//   `--jq`, a key of the `gh api` flag map (`"-q":"--jq"`), not a flag of this program.
// - subcommand: 71 paths, 56 old names. Only here: `apply-project-settings`, named by a constant
//   (`.command(Hmn,{hidden:!0})`). None only there.
import type * as t from "@babel/types";
import {
  constString,
  functionOf,
  type Module,
  type Node,
  returnsOf,
} from "../ast.ts";
import {
  type Extractor,
  type SurfaceItem,
  scan,
  short,
  unique,
} from "./common.ts";

const SPEC = /^(?:-[\w-]+, ?)?--?[a-zA-Z][\w-]*/;

type Call = Node & t.CallExpression;

const method = (n: Node | undefined): string | undefined =>
  n?.type === "CallExpression" &&
  n.callee.type === "MemberExpression" &&
  n.callee.property.type === "Identifier"
    ? n.callee.property.name
    : undefined;

/** The command words of `.command("x")` calls below `n` in its chain, outermost last. */
const chainCommands = (
  m: Module,
  n: Node,
  seen = new Set<unknown>(),
): string[] => {
  const out: string[] = [];
  let cur: Node | undefined = n;
  while (cur) {
    if (
      cur.type === "CallExpression" &&
      cur.callee.type === "MemberExpression"
    ) {
      if (method(cur) === "command") {
        const s = constString(m, cur.arguments[0] as Node | undefined);
        if (s) out.unshift(s.split(/\s/)[0] as string);
      }
      cur = cur.callee.object as Node;
    } else if (cur.type === "Identifier" && !seen.has(cur.name)) {
      // `let x=program.command("mcp")…; x.command("add")`
      seen.add(cur.name);
      const def = m.variable(cur)?.defs[0];
      const init =
        def?.type === "Variable" ? (def.node.init as Node | null) : null;
      return init ? [...chainCommands(m, init, seen), ...out] : out;
    } else return out;
  }
  return out;
};

/** The calls chained on `call`: `call.a().b()`. */
const chainedAfter = (m: Module, call: Node): string[] => {
  const out: string[] = [];
  let cur = call;
  for (;;) {
    const mem = m.parent(cur);
    const next = mem?.type === "MemberExpression" ? m.parent(mem) : undefined;
    const name = next && method(next);
    if (!next || !name) return out;
    out.push(name);
    cur = next;
  }
};

/** Does this option expression call `.hideHelp()` in its own chain, or (a variable) in another statement? */
const hides = (m: Module, n: Node, skip?: Node): boolean => {
  if (n.type === "Identifier")
    return !!m.variable(n)?.references.some((r) => {
      const id = r.identifier as Node;
      if (skip && id.start >= skip.start && id.end <= skip.end) return false;
      const p = m.parent(id);
      return (
        p?.type === "MemberExpression" && method(m.parent(p)) === "hideHelp"
      );
    });
  for (
    let cur: Node = n;
    cur.type === "CallExpression" && cur.callee.type === "MemberExpression";
    cur = cur.callee.object as Node
  )
    if (method(cur) === "hideHelp") return true;
  return false;
};

/** The `new Option(...)` behind an `addOption` argument: through call chains, `a?b:c`, variables, and factories. */
const optionOf = (
  m: Module,
  n: Node,
  seen = new Set<unknown>(),
): { m: Module; n: Node & t.NewExpression } | undefined => {
  if (seen.has(n)) return undefined;
  seen.add(n);
  if (n.type === "NewExpression") return { m, n: n as Node & t.NewExpression };
  if (n.type === "ConditionalExpression")
    return optionOf(m, n.consequent as Node, seen);
  if (n.type === "CallExpression" && n.callee.type === "MemberExpression")
    return optionOf(m, n.callee.object as Node, seen);
  if (n.type === "CallExpression") {
    const f = functionOf(m, n.callee as Node);
    const r = f && returnsOf(f.fn)[0];
    return r ? optionOf(f.module, r, seen) : undefined;
  }
  if (n.type === "Identifier") {
    const def = m.variable(n)?.defs[0];
    const init =
      def?.type === "Variable" ? (def.node.init as Node | null) : null;
    return init ? optionOf(m, init, seen) : undefined;
  }
  return undefined;
};

export const extractSubcommands: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  scan(bundle, [".command("], (m, n) => {
    if (method(n) !== "command") return;
    const spec = constString(m, (n as Call).arguments[0] as Node | undefined);
    if (!spec || !/^[a-z][\w-]*/.test(spec)) return;
    const path = chainCommands(m, n).join(" ");
    const args = spec.slice(spec.split(/\s/)[0]?.length).trim();
    const opts = (n as Call).arguments[1];
    const hidden =
      opts?.type === "ObjectExpression" &&
      /\bhidden:(!0|true)/.test(m.src(opts as Node));
    out.push({
      kind: "subcommand",
      name: path,
      module: m.name,
      offset: n.start,
      ...(args && { detail: args }),
      ...(hidden && { gate: "hidden" }),
    });
  });
  return unique(out);
};

export const extractFlags: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  /** `at` and `args` are in `m`; `owner` (the command chain) is in `om`. */
  const add = (
    m: Module,
    at: Node,
    owner: Node,
    args: Node[],
    gate?: string,
    om = m,
  ) => {
    const spec = constString(m, args[0]);
    if (!spec || !SPEC.test(spec)) return;
    const name =
      spec.match(/--[a-zA-Z][\w-]*/)?.[0] ?? spec.match(/-[\w-]+/)?.[0];
    if (!name) return;
    const desc = constString(m, args[1]);
    const cmd = chainCommands(om, owner).join(" ");
    out.push({
      kind: "flag",
      name: cmd ? `${cmd} ${name}` : name,
      module: m.name,
      offset: at.start,
      detail: short(`${spec}${desc ? ` | ${desc}` : ""}`),
      ...(gate && { gate }),
    });
  };
  scan(bundle, [".option(", ".requiredOption(", ".addOption("], (m, n) => {
    const name = method(n);
    if (!name) return;
    const c = n as Call;
    const owner = (c.callee as t.MemberExpression).object as Node;
    if (name === "option" || name === "requiredOption")
      add(m, n, owner, c.arguments as Node[]);
    else if (name === "addOption" && c.arguments[0]) {
      const arg = c.arguments[0] as Node;
      const o = optionOf(m, arg);
      if (!o) return;
      const gate =
        arg.type === "ConditionalExpression" &&
        hides(m, arg.alternate as Node) &&
        !hides(m, arg.consequent as Node, arg)
          ? `hidden unless ${m.src(arg.test as Node)}`
          : hides(m, arg) || chainedAfter(o.m, o.n).includes("hideHelp")
            ? "hidden"
            : undefined;
      add(o.m, o.n, owner, o.n.arguments as Node[], gate, m);
    }
  });
  return unique(out);
};
