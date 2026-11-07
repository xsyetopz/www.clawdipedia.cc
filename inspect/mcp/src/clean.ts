// Cleans a minified module into stable text: each declared name gets a name from its scope position, then `bun fmt`.
// Strings, property names, and export names keep their text, so the same code in two builds prints the same.
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isFn, type Module, type Node, type Variable } from "./ast.ts";

const hash = (s: string, n = 6): string =>
  createHash("sha1").update(s).digest("hex").slice(0, n);

/** The name of a non-module scope's variable: a letter for its depth, then its order (`a1`, `b2`). */
const localName = (depth: number, i: number): string =>
  `${depth <= 26 ? String.fromCharCode(96 + depth) : `z${depth}_`}${i}`;

/**
 * How many scopes a child `x` of `p` is inside because of `p`. The count follows the scopes that
 * ESLint's analysis drew, which Babel draws differently, so names stay the same as in older runs.
 */
const span = (m: Module, p: Node, x: Node): number => {
  if (isFn(p))
    return x === (p as { key?: Node }).key
      ? 0
      : p.type === "FunctionExpression" && p.id
        ? 2
        : 1;
  switch (p.type) {
    case "BlockStatement": {
      const g = m.parent(p);
      return isFn(g) && g.body === p ? 0 : 1;
    }
    case "SwitchStatement":
      return x === p.discriminant ? 0 : 1;
    case "ForStatement":
    case "ForInStatement":
    case "ForOfStatement": {
      const head = p.type === "ForStatement" ? p.init : p.left;
      return head?.type === "VariableDeclaration" && head.kind !== "var"
        ? 1
        : 0;
    }
    case "ClassDeclaration":
    case "ClassExpression":
    case "CatchClause":
    case "StaticBlock":
      return 1;
    case "ClassProperty":
    case "ClassPrivateProperty":
    case "ClassAccessorProperty":
      return x === p.value ? 1 : 0;
  }
  return 0;
};

/** The scope that holds a non-module variable: its node and its depth. A named function expression's own name has a scope of its own. */
const slotOf = (
  m: Module,
  v: Variable,
): { key: Node; depth: number } | undefined => {
  const s = v.binding.scope.path.node as Node;
  if (s.type === "Program") return undefined;
  let key: Node = s;
  if (v.binding.kind === "local" && s.type === "FunctionExpression")
    key = v.identifiers[0] as Node;
  else if (s.type === "CatchClause" && v.defs[0]?.node !== s)
    key = s.body as Node;
  // Counts the scopes around the function for its name, and the name's own for the function.
  let depth =
    1 +
    (key === s && s.type === "FunctionExpression" && s.id ? 1 : 0) +
    (s.type === "CatchClause" && key !== s ? 1 : 0);
  for (let x: Node = s, p = m.parent(x); p; x = p, p = m.parent(x))
    depth += span(m, p, x);
  return { key, depth };
};

/** Each variable that a module declares, with the identifier nodes that name it, in the order that the code declares them. */
const declared = (m: Module): { v: Variable; ids: Node[] }[] =>
  [...new Set(m.variables.values())]
    .sort(
      (a, b) =>
        (a.identifiers[0] as Node).start - (b.identifiers[0] as Node).start,
    )
    .map((v) => ({
      v,
      ids: [
        ...new Set([
          ...v.identifiers,
          ...v.references.map((r) => r.identifier),
        ]),
      ],
    }));

/** The replacement text for one identifier, keeping shorthand keys and export names. */
const spell = (m: Module, id: Node, old: string, name: string): string => {
  const p = m.parent(id);
  if (p?.type === "ExportSpecifier" && (p.exported as Node).start === id.start)
    return `${name} as ${old}`;
  if (p?.type === "ImportSpecifier" && (p.imported as Node).start === id.start)
    return `${old} as ${name}`;
  const prop =
    p?.type === "AssignmentPattern" && (p.left as Node) === id
      ? m.parent(p)
      : p;
  if (prop?.type === "ObjectProperty" && prop.shorthand)
    return `${old}:${name}`;
  return name;
};

/** Renders any range of the module with stable names, before formatting. */
export const renamer = (
  m: Module,
): ((start: number, end: number) => string) => {
  const all = declared(m);
  const names = new Map<Variable, string>();
  const count = new Map<Node, number>();
  const edits: { id: Node; v: Variable }[] = all
    .flatMap(({ v, ids }) => ids.map((id) => ({ id, v })))
    .sort((a, b) => a.id.start - b.id.start);
  // The text from `start` to `end` with each name spelled by `nameOf`.
  const render = (
    start: number,
    end: number,
    nameOf: (v: Variable, id: Node) => string,
  ) => {
    let out = "";
    let at = start;
    let lo = 0;
    for (let hi = edits.length; lo < hi; ) {
      const mid = (lo + hi) >> 1;
      if ((edits[mid] as (typeof edits)[number]).id.start < start) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < edits.length; k++) {
      const { id, v } = edits[k] as (typeof edits)[number];
      if (id.start >= end) break;
      if (id.end > end || id.start < at) continue;
      out += m.text.slice(at, id.start) + spell(m, id, v.name, nameOf(v, id));
      at = id.end;
    }
    return out + m.text.slice(at, end);
  };
  // The hash leaves out a class's name inside its own body, as when that name had a scope of its own.
  const inside = (v: Variable, id: Node): boolean => {
    const c = v.defs[0]?.node as Node;
    return (
      c.type === "ClassDeclaration" &&
      id !== v.identifiers[0] &&
      id.start >= c.start &&
      id.end <= c.end
    );
  };
  const top: Variable[] = [];
  for (const { v } of all) {
    const s = slotOf(m, v);
    if (!s) {
      top.push(v);
      continue;
    }
    const i = (count.get(s.key) ?? 0) + 1;
    count.set(s.key, i);
    names.set(v, localName(s.depth, i));
  }
  // A module-level name comes from its declaration with local names in place and module names
  // left out, so it keeps its name when other code moves or the minifier picks other names.
  const taken = new Set<string>();
  for (const v of top) {
    const def = v.defs[0]?.node as Node;
    const base = `$${hash(render(def.start, def.end, (x, id) => (inside(x, id) ? "$" : (names.get(x) ?? "$"))))}`;
    let n = base;
    for (let k = 2; taken.has(n); k++) n = `${base}_${k}`;
    taken.add(n);
    names.set(v, n);
  }
  return (start, end) => render(start, end, (v) => names.get(v) as string);
};

/** Bun chunk paths renamed by `chunkNames` (old file name to new). */
export const renameChunks = (
  text: string,
  chunkNames?: Map<string, string>,
): string =>
  chunkNames
    ? text.replace(
        /\/\$bunfs\/root\/(chunk-[a-z0-9]+\.js)/g,
        (_, c: string) => `/$bunfs/root/${chunkNames.get(c) ?? c}`,
      )
    : text;

/** The module text with stable names, before formatting. */
export const renameModule = (
  m: Module,
  chunkNames?: Map<string, string>,
): string => renameChunks(renamer(m)(0, m.text.length), chunkNames);

/** Formats JavaScript with `bun fmt`, run outside any project so no config changes it. */
export const format = (js: string): string => {
  const r = Bun.spawnSync(
    [process.execPath, "fmt", "--stdin-filepath=module.js"],
    {
      stdin: Buffer.from(js),
      cwd: tmpdir(),
      env: { PATH: process.env["PATH"] ?? "" },
    },
  );
  if (r.exitCode !== 0)
    throw new Error(`bun fmt failed: ${r.stderr.toString().slice(0, 300)}`);
  return r.stdout.toString();
};

export const cleanModule = (
  m: Module,
  chunkNames?: Map<string, string>,
): string => format(renameModule(m, chunkNames));
