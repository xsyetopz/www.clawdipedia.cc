// Usage: bun run schemas:observe [-- --user] [--skip print,statusline]
// Refreshes tools/schemas/observed/*.json, the value-free fixtures of observed field types that code.ts adds
// to the schemas as "x-observed-type". Sources:
//   print       print-mode runs against the local stub with OTLP/JSON sent to a local collector (observe/print.ts)
//   statusline  the status line pty probes (observe/statusline.ts); about 90 s
//   --user      your own ~/.claude files, read-only (observe/user.ts): transcripts, .claude.json, frontmatter
// Each source writes raw key path -> type counts to a temp dir. This script keeps only paths that are fields of
// a schema in schemas/ that carry "x-unverified", and merges them into the fixtures: per path and type, the larger
// count wins, capped at COUNT_CAP. No value and no key outside the schemas reaches a fixture. The temp dir is removed.
// Run `bun run schemas` after it to write the schemas.
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";
import type { Observed } from "../observe.ts";
import {
  COUNT_CAP,
  type Fixture,
  fixturePath,
  OBSERVED_DIR,
  readFixture,
  unverifiedPaths,
} from "../observed.ts";

const argv = process.argv.slice(2);
const skip = new Set(
  (argv[argv.indexOf("--skip") + 1] ?? "").split(",").filter(Boolean),
);
if (argv.indexOf("--skip") < 0) skip.clear();
const withUser = argv.includes("--user");

const ROOT = join(import.meta.dir, "..", "..", "..");
const TRANSCRIPT = "claude-code-transcript.json";
const SOURCES: { source: string; file: string; schema: string }[] = [
  { source: "print", file: "print-otel.json", schema: "claude-code-otel.json" },
  { source: "print", file: "print-transcripts.json", schema: TRANSCRIPT },
  {
    source: "print",
    file: "print-claude-json.json",
    schema: "claude-code-claude-json.json",
  },
  {
    source: "statusline",
    file: "statusline.json",
    schema: "claude-code-status-line.json",
  },
  { source: "user", file: "user-transcripts.json", schema: TRANSCRIPT },
  {
    source: "user",
    file: "user-claude-json.json",
    schema: "claude-code-claude-json.json",
  },
  {
    source: "user",
    file: "user-frontmatter.json",
    schema: "claude-code-frontmatter.json",
  },
];

const tmp = mkdtempSync(join(tmpdir(), "cc-observe-"));
try {
  const scripts: [string, string][] = [
    ["print", "print.ts"],
    ["statusline", "statusline.ts"],
    ...(withUser ? ([["user", "user.ts"]] as [string, string][]) : []),
  ];
  for (const [source, script] of scripts) {
    if (skip.has(source)) continue;
    console.log(`observe: ${source}`);
    const r = Bun.spawnSync(
      [process.execPath, join(import.meta.dir, script), tmp],
      {
        cwd: ROOT,
        stdout: "inherit",
        stderr: "inherit",
      },
    );
    if (r.exitCode !== 0) throw new Error(`${script} failed (${r.exitCode})`);
  }

  // schema file -> path -> type -> count
  const merged = new Map<string, Map<string, Record<string, number>>>();
  for (const s of SOURCES) {
    let raw: { paths: Observed };
    try {
      raw = JSON.parse(readFileSync(join(tmp, s.file), "utf8")) as {
        paths: Observed;
      };
    } catch {
      continue; // source not run
    }
    const into =
      merged.get(s.schema) ?? new Map<string, Record<string, number>>();
    merged.set(s.schema, into);
    for (const [key, stat] of Object.entries(raw.paths)) {
      if (key === "$root") continue;
      const path = key.startsWith("$root.") ? key.slice("$root.".length) : key;
      const types = into.get(path) ?? {};
      for (const [t, c] of Object.entries(stat.types))
        types[t] = (types[t] ?? 0) + c;
      into.set(path, types);
    }
  }

  mkdirSync(OBSERVED_DIR, { recursive: true });
  for (const [schemaFile, paths] of [...merged].sort(([a], [b]) =>
    a < b ? -1 : 1,
  )) {
    const schema = JSON.parse(
      readFileSync(join(ROOT, "schemas", schemaFile), "utf8"),
    ) as Record<string, unknown>;
    const old = readFixture(schemaFile);
    const fields: Fixture["fields"] = { ...(old?.fields ?? {}) };
    let added = 0;
    for (const path of unverifiedPaths(schema)) {
      const seen = paths.get(path);
      if (!seen) continue;
      const cur = { ...(fields[path] ?? {}) };
      for (const [t, c] of Object.entries(seen))
        cur[t] = Math.min(COUNT_CAP, Math.max(cur[t] ?? 0, c));
      if (!fields[path]) added++;
      fields[path] = Object.fromEntries(
        Object.entries(cur).sort(([a], [b]) => (a < b ? -1 : 1)),
      );
    }
    const out: Fixture = {
      $comment:
        "Value-free. Field path -> JSON types seen in real payloads (stub probes and local files) with a count each, capped at 100. Built by tools/schemas/observe/run.ts; tools/schemas/code.ts reads it. Do not edit by hand.",
      version: CLAUDE_CODE_VERSION,
      fields: Object.fromEntries(
        Object.entries(fields).sort(([a], [b]) => (a < b ? -1 : 1)),
      ),
    };
    const fmt = Bun.spawnSync(
      [
        process.execPath,
        "x",
        "biome",
        "format",
        `--stdin-file-path=${fixturePath(schemaFile)}`,
      ],
      {
        cwd: ROOT,
        stdin: Buffer.from(JSON.stringify(out, null, 2)),
        stdout: "pipe",
        stderr: "pipe",
      },
    );
    if (fmt.exitCode !== 0)
      throw new Error(`biome format failed:\n${fmt.stderr.toString()}`);
    writeFileSync(fixturePath(schemaFile), fmt.stdout.toString());
    console.log(
      `${schemaFile}: ${Object.keys(out.fields).length} fields (${added} new)`,
    );
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
