// Prepares one install for diffs: each JS module cleaned (`clean.ts`), and an index of its code units, cached on disk.
// A unit is a top-level statement or a function, with the functions inside it cut out, so a change shows in one unit.
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import {
  children,
  isFn,
  isMethod,
  Module,
  type Node,
  valueStart,
} from "./ast.ts";
import { listInstalls, program } from "./binary.ts";
import { renameChunks, renamer } from "./clean.ts";

export type Unit = {
  /** module file name, as in the binary (`chunk-abc.js`) */
  m: string;
  /** start and end offset in the module's original text */
  s: number;
  e: number;
  /** a label: the property, method, or variable name that holds it, or the statement type */
  k: string;
  /** the cleaned text with inner functions cut out (`ƒ`) */
  t: string;
  /** hash of `t` */
  h: string;
  /** fingerprint: sorted string literals (quoted) and property names (after a dot) */
  f: string[];
};
/** Raise when the cleaning or the units change, so an older cache is cleaned again. */
export const FORMAT = 1;

export type Index = {
  /** `FORMAT` of the code that wrote it */
  format?: number;
  version: string;
  binary: { size: number; mtime: number };
  /** modules that do not parse as JavaScript, with the parser's message */
  skipped: Record<string, string>;
  /** old chunk file name to the stable one */
  chunks: Record<string, string>;
  units: Unit[];
};

const sha = (s: string, n: number) =>
  createHash("sha1").update(s).digest("hex").slice(0, n);

/** Where cleaned installs live: `CC_INSPECT_CACHE`, else `./captures` when it exists, else `~/.cache/cc-inspect`. */
export const cacheRoot = (): string =>
  process.env["CC_INSPECT_CACHE"] ??
  (existsSync(join(process.cwd(), "captures"))
    ? join(process.cwd(), "captures")
    : join(homedir(), ".cache", "cc-inspect"));

const labelOf = (m: Module, n: Node): string => {
  const p = m.parent(n);
  if (!isFn(n)) return n.type === "Directive" ? "ExpressionStatement" : n.type;
  const key = (k: Node | undefined) =>
    k?.type === "Identifier"
      ? k.name
      : k?.type === "StringLiteral" || k?.type === "NumericLiteral"
        ? String(k.value)
        : "";
  if (isMethod(n)) return key(n.key as Node) || "fn";
  if (p?.type === "ObjectProperty") return key(p.key as Node) || "fn";
  if (p?.type === "VariableDeclarator" || p?.type === "AssignmentExpression")
    return "fn";
  return n.type === "FunctionDeclaration" ? "function" : "fn";
};

/** The units of one module, before chunk names are made stable. */
export const unitsOf = (
  name: string,
  m: Module,
  render = renamer(m),
): Unit[] => {
  type Open = { n: Node; start: number; holes: Span[]; f: Set<string> };
  type Span = { start: number; end: number };
  const done: Open[] = [];
  const walk = (n: Node, cur: Open | undefined) => {
    let here = cur;
    if (!cur || isFn(n)) {
      // A method's unit starts at its parameters, so the key stays in the unit around it.
      const start = isMethod(n) ? valueStart(m.text, n) : n.start;
      here = { n, start, holes: [], f: new Set() };
      cur?.holes.push({ start, end: n.end });
      done.push(here);
    }
    const f = (here as Open).f;
    if (n.type === "StringLiteral" || n.type === "DirectiveLiteral")
      f.add(JSON.stringify(n.value.slice(0, 80)));
    else if (n.type === "TemplateElement" && n.value.cooked)
      f.add(JSON.stringify(n.value.cooked.slice(0, 80)));
    else if (
      (n.type === "MemberExpression" ||
        n.type === "ObjectProperty" ||
        isMethod(n)) &&
      !n.computed
    ) {
      const k = (n.type === "MemberExpression" ? n.property : n.key) as Node;
      if (k.type === "Identifier")
        ((isMethod(n) ? cur : here) as Open).f.add(`.${k.name}`);
    }
    for (const c of children(n))
      walk(c, isMethod(n) && c === n.key ? cur : here);
  };
  for (const s of children(m.ast)) walk(s, undefined);
  return done.map(({ n, start, holes, f }) => {
    let t = "";
    let at = start;
    // A function in a method key is found after the method, though it comes first in the text.
    for (const h of holes.sort((a, b) => a.start - b.start)) {
      t += `${render(at, h.start)}ƒ`;
      at = h.end;
    }
    t += render(at, n.end);
    return {
      m: name,
      s: start,
      e: n.end,
      k: labelOf(m, n),
      t,
      h: "",
      f: [...f].sort(),
    };
  });
};

const binaryStat = (path: string) => {
  const st = statSync(path);
  return { size: st.size, mtime: Math.round(st.mtimeMs) };
};

/** Formats every file in `dir` with one `bun fmt` run, from a temp folder so no project config applies. */
const formatDir = (files: Map<string, string>, out: string) => {
  const tmp = mkdtempSync(join(tmpdir(), "cc-inspect-fmt-"));
  try {
    for (const [f, t] of files) writeFileSync(join(tmp, f), t);
    const r = Bun.spawnSync([process.execPath, "fmt", "--no-script", "."], {
      cwd: tmp,
      env: { PATH: process.env["PATH"] ?? "" },
    });
    if (r.exitCode !== 0)
      throw new Error(`bun fmt failed: ${r.stderr.toString().slice(0, 300)}`);
    mkdirSync(out, { recursive: true });
    for (const f of readdirSync(tmp)) renameSync(join(tmp, f), join(out, f));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
};

/**
 * Cleans the JS modules of an install and writes `<root>/<version>/clean/index.json` and `modules/`.
 * A second call for the same binary reads the cache and parses nothing (`parsed: 0`).
 */
export const prepare = (
  version: string,
  binaryPath: string,
  modules: { name: string; text: string }[],
  root = cacheRoot(),
): { dir: string; index: Index; parsed: number; ms: number } => {
  const t0 = performance.now();
  const dir = join(root, version, "clean");
  const file = join(dir, "index.json");
  const binary = binaryStat(binaryPath);
  if (existsSync(file)) {
    const index = JSON.parse(readFileSync(file, "utf8")) as Index;
    if (
      index.format === FORMAT &&
      index.binary.size === binary.size &&
      index.binary.mtime === binary.mtime
    )
      return { dir, index, parsed: 0, ms: Math.round(performance.now() - t0) };
  }
  const js = modules.filter((x) => /\.m?js$/.test(x.name));
  const units: Unit[] = [];
  const texts = new Map<string, string>();
  const literals = new Map<string, string[]>();
  const skipped: Record<string, string> = {};
  for (const x of js) {
    const name = x.name.split("/").pop() as string;
    // Each module on its own, so its syntax tree is freed after use.
    const m = new Module(x.name, x.text);
    try {
      m.ast;
    } catch (e) {
      skipped[name] = String((e as Error).message).slice(0, 120);
      continue;
    }
    const render = renamer(m);
    const us = unitsOf(name, m, render);
    units.push(...us);
    texts.set(name, render(0, m.text.length));
    literals.set(name, [...new Set(us.flatMap((u) => u.f))].sort());
  }
  // A chunk's stable name comes from its literals, which keep their text between builds.
  const chunks = new Map<string, string>();
  for (const [name, lits] of literals)
    if (/^chunk-[a-z0-9]+\.js$/.test(name))
      chunks.set(name, `chunk@${sha(lits.join("\n"), 8)}.js`);
  for (const u of units) {
    u.t = renameChunks(u.t, chunks);
    u.h = sha(u.t, 12);
  }
  const index: Index = {
    format: FORMAT,
    version,
    binary,
    skipped,
    chunks: Object.fromEntries(chunks),
    units,
  };
  mkdirSync(dir, { recursive: true });
  rmSync(join(dir, "readable"), { recursive: true, force: true });
  formatDir(
    new Map([...texts].map(([n, t]) => [n, renameChunks(t, chunks)])),
    join(dir, "modules"),
  );
  writeFileSync(file, JSON.stringify(index));
  return {
    dir,
    index,
    parsed: js.length - Object.keys(skipped).length,
    ms: Math.round(performance.now() - t0),
  };
};

const preparedCache = new Map<string, ReturnType<typeof prepare>>();

/** `prepare` for a version or path, kept in memory for the server's life. */
export const prepared = (binary?: string): ReturnType<typeof prepare> => {
  const p = program(binary);
  const version =
    listInstalls().find((i) => i.path === p.path)?.version ?? basename(p.path);
  let r = preparedCache.get(p.path);
  if (!r) {
    r = prepare(
      version,
      p.path,
      p.modules.map((m) => ({ name: m.name, text: m.source })),
    );
    preparedCache.set(p.path, r);
  }
  return r;
};
