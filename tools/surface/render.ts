// Usage: bun tools/surface/render.ts [--check] [--root <dir>]   (part of: bun run surface, bun run surface:check)
// Writes docs/reference/surface-coverage.md from schemas/surface.json (design D4): the count of each kind, and each
// item with the page that names it, its map route, its exclusion reason, or no page yet. It also rewrites the
// "In the Program" section of docs/reference/undocumented.md with the count of each kind.
// --check writes nothing and fails when either file differs from a fresh render.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  check,
  docsNames,
  exclusionOf,
  GENERATED,
  type MapEntry,
  mapOf,
  PAGES,
  type Row,
  status,
} from "./coverage.ts";
import type { Committed } from "./snapshot.ts";

const UNDOCUMENTED = "docs/reference/undocumented.md";
const SECTION = "## In the Program";
const DRAFT = false;

const TITLES: Record<string, string> = {
  beta: "Betas",
  endpoint: "API Endpoints",
  env: "Environment Variables",
  error: "Error Texts",
  file: "Files",
  flag: "CLI Flags",
  gate: "Gates",
  "hook-event": "Hook Events",
  keybinding: "Keybindings",
  "mod-api": "Mod API",
  model: "Models",
  "otel-event": "OpenTelemetry Events",
  "permission-rule": "Permission Rules",
  setting: "Settings",
  "setting-key": "Nested Setting Keys",
  "slash-command": "Slash Commands",
  subcommand: "Subcommands",
  tool: "Tools",
};
export const title = (kind: string) => TITLES[kind] ?? kind;
const slug = (kind: string) => title(kind).toLowerCase().replaceAll(" ", "-");

// check:docs allows no emoji outside docs/prompts, so a program text shows them as code points.
const EMOJI = /\p{Extended_Pictographic}|\u{FE0F}/gu;

/** A table cell code span that holds any text: pipes escaped, a fence longer than any backtick run. */
export const code = (text: string): string => {
  const t = text
    .replaceAll("\n", "\\n")
    .replaceAll("|", "\\|")
    .replace(EMOJI, (c) => `U+${c.codePointAt(0)?.toString(16).toUpperCase()}`);
  const fence = "`".repeat(
    Math.max(0, ...(t.match(/`+/g) ?? []).map((r) => r.length)) + 1,
  );
  const pad = t.startsWith("`") || t.endsWith("`") ? " " : "";
  return `${fence}${pad}${t}${pad}${fence}`;
};

const pageTitle = (file: string) =>
  readFileSync(file, "utf8")
    .match(/^title:\s*(.+)$/m)?.[1]
    ?.trim()
    .replace(/^(["'])(.*)\1$/, "$2") ?? file;

export type Rendered = { page: string; undocumented: string };

/** The coverage page and the new text of undocumented.md. */
export const render = (
  root: string,
  snapshot: Committed,
  map: Record<string, MapEntry>,
  exclusions: Record<string, string>,
  undocumented: string,
): Rendered => {
  const names: Record<string, Map<string, string>> = {};
  for (const kind of Object.keys(snapshot.kinds))
    names[kind] = docsNames(root, PAGES[kind] ?? []);
  const { rows } = check(snapshot, names, map, exclusions);
  const dir = join(root, "docs", "reference");
  const titles = new Map<string, string>();
  const where = (kind: string, name: string): string => {
    const key = `${kind}:${name}`;
    switch (status(kind, name, names, map, exclusions)) {
      case "docs": {
        const file = names[kind]?.get(name) as string;
        if (!titles.has(file)) titles.set(file, pageTitle(file));
        return `[${titles.get(file)}](${relative(dir, file)})`;
      }
      case "mapped": {
        const m = mapOf(key, map) as MapEntry;
        const to = m.anchor ? `${m.route}#${m.anchor}` : m.route;
        return `[${to}](${to})`;
      }
      case "excluded":
        return `Excluded: ${exclusions[exclusionOf(key, exclusions) as string]}`;
      default:
        return "Not on a page yet";
    }
  };
  const total = (f: (r: Row) => number) => rows.reduce((n, r) => n + f(r), 0);
  const items = total((r) => r.items);
  const kinds = rows.length;
  const summary = [
    "| Kind | Items | In a Docs Table | In the Map | Excluded | Not on a Page Yet |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map(
      (r) =>
        `| [${title(r.kind)}](#${slug(r.kind)}) | ${r.items} | ${r.docs} | ${r.mapped} | ${r.excluded} | ${r.unmapped} |`,
    ),
    `| Total | ${items} | ${total((r) => r.docs)} | ${total((r) => r.mapped)} | ${total((r) => r.excluded)} | ${total((r) => r.unmapped)} |`,
  ];
  const sections = rows.flatMap((r) => [
    "",
    `## ${title(r.kind)}`,
    "",
    `Items: ${r.items}.`,
    "",
    "| Item | Where |",
    "| --- | --- |",
    ...(snapshot.kinds[r.kind] ?? []).map(
      ({ name }) => `| ${code(name)} | ${where(r.kind, name)} |`,
    ),
  ]);
  const page = [
    "---",
    "title: Surface Coverage",
    `description: Every item that the Claude Code ${snapshot.version} program holds, by kind, with the page that covers it.`,
    "sidebar_position: 11",
    ...(DRAFT ? ["draft: true"] : []),
    "---",
    "",
    `The program of Claude Code \`${snapshot.version}\` holds ${items} items in ${kinds} kinds.`,
    "Each row below names the page that covers an item, or the reason the item is left out.",
    "`bun run surface` makes this page from `schemas/surface.json`, so do not edit it by hand.",
    "",
    "## Summary",
    "",
    ...summary,
    ...sections,
    "",
  ].join("\n");
  // the gap column waits for the coverage page to go live
  const gap = (cell: string | number) => (DRAFT ? "" : ` ${cell} |`);
  const block = [
    SECTION,
    "",
    `The program of \`${snapshot.version}\` holds ${items} items in ${kinds} kinds, counted from \`schemas/surface.json\`.`,
    ...(DRAFT
      ? []
      : [
          "[Surface Coverage](surface-coverage.md) lists each item with its page.",
        ]),
    "",
    `| Kind | Items |${gap("Not on a Page Yet")}`,
    `| --- | --- |${gap("---")}`,
    ...rows.map(
      (r) =>
        `| ${DRAFT ? title(r.kind) : `[${title(r.kind)}](surface-coverage.md#${slug(r.kind)})`} | ${r.items} |${gap(r.unmapped)}`,
    ),
    `| All kinds | ${items} |${gap(total((r) => r.unmapped))}`,
    "",
    "",
  ].join("\n");
  const at = undocumented.indexOf(`\n${SECTION}\n`);
  const next = (from: number) => {
    const i = undocumented.indexOf("\n## ", from);
    return i < 0 ? undocumented.length : i + 1;
  };
  const text =
    at >= 0
      ? undocumented.slice(0, at + 1) + block + undocumented.slice(next(at + 1))
      : (() => {
          const i = undocumented.indexOf("\n## Related Pages\n");
          const cut = i < 0 ? undocumented.length : i + 1;
          return `${undocumented.slice(0, cut)}${block}${undocumented.slice(cut)}`;
        })();
  return { page, undocumented: text };
};

if (import.meta.main) {
  const { parseArgs } = await import("node:util");
  const { values: a } = parseArgs({
    options: { check: { type: "boolean" }, root: { type: "string" } },
  });
  const root = a.root ?? join(import.meta.dir, "..", "..");
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  if (!existsSync(join(root, "schemas", "surface.json"))) {
    console.error(
      'surface render: schemas/surface.json missing (run "bun run surface")',
    );
    process.exit(2);
  }
  const out = render(
    root,
    JSON.parse(read("schemas/surface.json")) as Committed,
    JSON.parse(read("tools/surface/map.json")),
    JSON.parse(read("tools/surface/exclusions.json")),
    read(UNDOCUMENTED),
  );
  const files: [string, string][] = [
    [GENERATED, out.page],
    [UNDOCUMENTED, out.undocumented],
  ];
  const stale = files.filter(
    ([p, t]) => !existsSync(join(root, p)) || read(p) !== t,
  );
  if (a.check) {
    for (const [p] of stale)
      console.error(
        `surface render: ${p} differs from a fresh render (run "bun run surface")`,
      );
    if (stale.length) process.exit(1);
    console.log("surface render: pages match the snapshot");
  } else {
    for (const [p, t] of stale) writeFileSync(join(root, p), t);
    console.log(
      `surface render: wrote ${stale.length} of ${files.length} files`,
    );
  }
}
