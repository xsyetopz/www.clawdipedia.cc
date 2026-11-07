// Usage: bun tools/surface/coverage.ts [--kind <a,b>] [--all] [--root <dir>]   (also: bun run surface:check)
// Every item of schemas/surface.json must be covered (design D4) by one of:
//   1. a docs table row whose first cell names it in backticks, exactly, on a page of its kind (PAGES below);
//   2. an entry of tools/surface/map.json: { "<kind>:<name>": { "route": "/path", "anchor": "id" } };
//      for the `error` kind only, a key ending in `*` maps a family by its stable prefix (design D3);
//   3. an entry of tools/surface/exclusions.json: { "<kind>:<name>" or "<kind>:<prefix>*": "reason" }.
// It prints the counts by kind, then fails on unmapped items (as `<kind>:<name>`, 20 for each kind unless --all)
// and on stale entries: a map or exclusion key that matches no item. --kind limits the check to some kinds.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Committed } from "./snapshot.ts";

const ROOT = join(import.meta.dir, "..", "..");
const SHOWN = 20;
/** The shortest prefix of an `error:` key ending in `*`: a shorter one would also cover errors that nobody has seen. */
const MIN_PREFIX = 8;

/** The docs pages (a file, or a folder read in full) whose tables name the items of a kind. */
export const PAGES: Record<string, string[]> = {
  env: ["docs/configure/env-vars"],
  flag: ["docs/configure/cli"],
  subcommand: ["docs/configure/cli"],
  "slash-command": [
    "docs/configure/cli",
    "docs/extend/skills-and-commands/slash-commands.md",
  ],
  setting: ["docs/configure/settings"],
  "setting-key": ["docs/configure", "docs/extend"],
  "permission-rule": ["docs/configure/permissions"],
  "hook-event": ["docs/extend/hooks"],
  "mod-api": ["docs/extend/mod-api"],
  tool: ["docs/reference/tools"],
  "otel-event": ["docs/reference/opentelemetry.md"],
  gate: ["docs"],
  model: ["docs/configure/models-and-providers"],
  beta: ["docs/reference/api/betas.md"],
  endpoint: ["docs/reference/api/endpoints.md"],
  keybinding: ["docs/configure/keybindings"],
  file: ["docs/start/files-on-disk.md"],
  error: ["docs"],
};

export type MapEntry = { route: string; anchor?: string };
export type Row = {
  kind: string;
  items: number;
  docs: number;
  mapped: number;
  excluded: number;
  unmapped: number;
};
export type Result = { rows: Row[]; unmapped: string[]; stale: string[] };

const markdown = (path: string): string[] => {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return /\.mdx?$/.test(path) ? [path] : [];
  return readdirSync(path)
    .sort()
    .flatMap((f) => markdown(join(path, f)));
};

/** The page that render.ts writes from the snapshot: it names every item, so it covers none. */
export const GENERATED = "docs/reference/surface-coverage.md";

/** The exact backticked names in the name cell (the first) of the table rows of the pages, each with its first file. A missing page names nothing. */
export const docsNames = (
  root: string,
  pages: string[],
): Map<string, string> => {
  const names = new Map<string, string>();
  for (const page of pages)
    for (const file of markdown(join(root, page)))
      if (file !== join(root, GENERATED))
        for (const line of readFileSync(file, "utf8").split("\n")) {
          if (!line.trimStart().startsWith("|")) continue;
          const cell =
            line
              .trimStart()
              .slice(1)
              .split(/(?<!\\)\|/)[0] ?? "";
          for (const m of cell.matchAll(/`([^`\n]+)`/g)) {
            const name = (m[1] as string).replaceAll("\\|", "|");
            if (!names.has(name)) names.set(name, file);
          }
        }
  return names;
};

const kindOf = (key: string) => key.slice(0, Math.max(key.indexOf(":"), 0));

export type Names = Record<string, { has: (name: string) => boolean }>;
export type Status = "docs" | "mapped" | "excluded" | "unmapped";

/** How one item is covered, in the order of design D4. An exclusion key ending in `*` is a prefix. */
export const status = (
  kind: string,
  name: string,
  docs: Names,
  map: Record<string, MapEntry>,
  exclusions: Record<string, string>,
): Status => {
  const key = `${kind}:${name}`;
  if (docs[kind]?.has(name)) return "docs";
  if (mapOf(key, map)) return "mapped";
  if (exclusionOf(key, exclusions)) return "excluded";
  return "unmapped";
};

/** The map entry of an item key: the key itself, or for an `error` item the longest matching prefix key. */
export const mapOf = (
  key: string,
  map: Record<string, MapEntry>,
): MapEntry | undefined => {
  if (key in map) return map[key];
  if (!key.startsWith("error:")) return undefined;
  const prefix = Object.keys(map)
    .filter((p) => p.startsWith("error:") && p.endsWith("*"))
    .filter((p) => key.startsWith(p.slice(0, -1)))
    .sort((a, b) => b.length - a.length)[0];
  return prefix ? map[prefix] : undefined;
};

/** The exclusion key that covers an item key: the key itself or a matching prefix. */
export const exclusionOf = (
  key: string,
  exclusions: Record<string, string>,
): string | undefined =>
  key in exclusions
    ? key
    : Object.keys(exclusions).find(
        (p) => p.endsWith("*") && key.startsWith(p.slice(0, -1)),
      );

/** Check the snapshot against the docs names, the map, and the exclusions. `only` limits the kinds. */
export const check = (
  snapshot: Committed,
  docs: Names,
  map: Record<string, MapEntry>,
  exclusions: Record<string, string>,
  only?: string[],
): Result => {
  const kinds = only ?? Object.keys(snapshot.kinds);
  const keys = new Set<string>();
  const rows: Row[] = [];
  const unmapped: string[] = [];
  for (const kind of kinds) {
    const row: Row = {
      kind,
      items: 0,
      docs: 0,
      mapped: 0,
      excluded: 0,
      unmapped: 0,
    };
    for (const { name } of snapshot.kinds[kind] ?? []) {
      const key = `${kind}:${name}`;
      keys.add(key);
      row.items++;
      const s = status(kind, name, docs, map, exclusions);
      row[s]++;
      if (s === "unmapped") unmapped.push(key);
    }
    rows.push(row);
  }
  const stale: string[] = [];
  const entries = (file: string, list: string[]) => {
    for (const key of list) {
      if (
        !kinds.includes(kindOf(key)) &&
        only &&
        Object.keys(snapshot.kinds).includes(kindOf(key))
      )
        continue; // the entry belongs to a kind that --kind left out
      const hit = key.endsWith("*")
        ? [...keys].some((k) => k.startsWith(key.slice(0, -1)))
        : keys.has(key);
      if (!hit) stale.push(`${file}: ${key}`);
    }
  };
  entries("map.json", Object.keys(map));
  entries("exclusions.json", Object.keys(exclusions));
  return { rows, unmapped, stale };
};

/** Problems with the shape of the map and the exclusions. */
export const shape = (
  map: Record<string, MapEntry>,
  exclusions: Record<string, string>,
): string[] => {
  const bad: string[] = [];
  for (const [k, v] of Object.entries(map))
    if (!v || typeof v.route !== "string" || !v.route.startsWith("/"))
      bad.push(`map.json: ${k} needs a route that starts with "/"`);
  for (const k of Object.keys(map))
    if (k.endsWith("*") && !k.startsWith("error:"))
      bad.push(
        `map.json: ${k} ends in "*", a prefix key only for the error kind`,
      );
  for (const [k, v] of Object.entries(exclusions))
    if (typeof v !== "string" || !v.trim())
      bad.push(`exclusions.json: ${k} needs a non-empty reason`);
  for (const [file, keys] of [
    ["map.json", Object.keys(map)],
    ["exclusions.json", Object.keys(exclusions)],
  ] as const)
    for (const k of keys)
      if (
        k.startsWith("error:") &&
        k.endsWith("*") &&
        k.length - "error:".length - 1 < MIN_PREFIX
      )
        bad.push(
          `${file}: ${k} needs a prefix of ${MIN_PREFIX} characters or more before the *`,
        );
  return bad;
};

const pad = (s: string | number, n: number) => String(s).padStart(n);
export const table = (rows: Row[]): string => {
  const w = Math.max(...rows.map((r) => r.kind.length), 4);
  const head = `${"kind".padEnd(w)} ${pad("items", 6)} ${pad("docs", 6)} ${pad("map", 6)} ${pad("excluded", 8)} ${pad("unmapped", 8)}`;
  const lines = rows.map(
    (r) =>
      `${r.kind.padEnd(w)} ${pad(r.items, 6)} ${pad(r.docs, 6)} ${pad(r.mapped, 6)} ${pad(r.excluded, 8)} ${pad(r.unmapped, 8)}`,
  );
  const sum = (f: (r: Row) => number) => rows.reduce((n, r) => n + f(r), 0);
  const total = `${"total".padEnd(w)} ${pad(
    sum((r) => r.items),
    6,
  )} ${pad(
    sum((r) => r.docs),
    6,
  )} ${pad(
    sum((r) => r.mapped),
    6,
  )} ${pad(
    sum((r) => r.excluded),
    8,
  )} ${pad(
    sum((r) => r.unmapped),
    8,
  )}`;
  return [head, ...lines, total].join("\n");
};

if (import.meta.main) {
  const { parseArgs } = await import("node:util");
  const { values: a } = parseArgs({
    options: {
      kind: { type: "string" },
      all: { type: "boolean" },
      root: { type: "string" },
    },
  });
  const root = a.root ?? ROOT;
  const read = <T>(file: string): T =>
    JSON.parse(readFileSync(file, "utf8")) as T;
  const snapshotFile = join(root, "schemas", "surface.json");
  if (!existsSync(snapshotFile)) {
    console.error(
      'surface:check: schemas/surface.json missing (run "bun run surface")',
    );
    process.exit(2);
  }
  const snapshot = read<Committed>(snapshotFile);
  const only = a.kind?.split(",");
  const unknown = (only ?? []).filter((k) => !(k in snapshot.kinds));
  if (unknown.length) {
    console.error(
      `surface:check: unknown kind ${unknown.join(", ")}; kinds: ${Object.keys(snapshot.kinds).join(", ")}`,
    );
    process.exit(2);
  }
  const dir = join(root, "tools", "surface");
  const map = read<Record<string, MapEntry>>(join(dir, "map.json"));
  const exclusions = read<Record<string, string>>(join(dir, "exclusions.json"));
  const docs: Names = {};
  for (const kind of only ?? Object.keys(snapshot.kinds))
    docs[kind] = docsNames(root, PAGES[kind] ?? []);
  const { rows, unmapped, stale } = check(
    snapshot,
    docs,
    map,
    exclusions,
    only,
  );
  const problems = shape(map, exclusions);
  console.log(`Claude Code ${snapshot.version}\n${table(rows)}`);
  for (const p of problems) console.error(`surface:check: ${p}`);
  for (const r of rows) {
    const list = unmapped.filter((k) => k.startsWith(`${r.kind}:`));
    if (!list.length) continue;
    console.error(`surface:check: ${list.length} unmapped ${r.kind} items`);
    for (const k of a.all ? list : list.slice(0, SHOWN))
      console.error(`  ${k}`);
    if (!a.all && list.length > SHOWN)
      console.error(`  ... ${list.length - SHOWN} more (--all lists them)`);
  }
  for (const s of stale) console.error(`surface:check: stale entry ${s}`);
  if (problems.length || unmapped.length || stale.length) process.exit(1);
  console.log("surface:check: every item is mapped or excluded");
}
