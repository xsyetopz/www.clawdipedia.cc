// Adapter for the surfaces that have no zod schema in the program: status line input, transcript lines,
// OpenTelemetry, frontmatter, and ~/.claude.json. It reads the program's code (the object literals and key
// lists that build each payload) and writes one JSON Schema (draft 2020-12) per surface to schemas/.
// Anchors are literal key names and strings, never minified identifiers; each file's $comment names them.
//
//   bun tools/schemas/code.ts [--bin <binary>] [--captures <dir>] [--out <dir>] [--check] [--spreads]
//
// --spreads lists each spread the adapter cannot resolve, with its module and the index of its literal.
//
// Conventions in the output: a field's type is the type the code gives it (a literal, or a computed value
// followed through names, calls, members, and built-ins such as String() or .length). A field whose type
// the code does not show is `{}` with "x-unverified": true.
// A field that a probe in captures/<version>/ saw is marked "x-observed": true.
// A field still "x-unverified" gets "x-observed-type": [...] when tools/schemas/observed/ has enough samples
// of real payloads (see observed.ts). The type is not enforced; "x-unverified" keeps its meaning.
// A field typed by hand in tools/schemas/manual/ (see manual.ts) gets that type and loses "x-unverified".
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildClaudeJson } from "./code/claudejson.ts";
import { argv, countProps, mods, OUT, R, ROOT, report } from "./code/ctx.ts";
import { buildFrontmatter } from "./code/frontmatter.ts";
import { buildOtel } from "./code/otel.ts";
import { buildStatusLine } from "./code/statusline.ts";
import { buildTranscript } from "./code/transcript.ts";
import { anchorIn, applyManual } from "./manual.ts";
import { applyObserved } from "./observed.ts";

const builders = [
  buildStatusLine,
  buildTranscript,
  buildOtel,
  buildFrontmatter,
  buildClaudeJson,
];
const check = argv.includes("--check");
let stale = 0;
const program = mods.map((m) => m.text).join("\n");
const inProgram = anchorIn(program);
for (const b of builders) {
  const { file, schema: built } = b();
  // Types read by hand from the program, from tools/schemas/manual/; these drop "x-unverified".
  const hand = applyManual(file, built, inProgram);
  for (const m of [...hand.stale, ...hand.missed]) {
    stale++;
    console.log(`manual ${file}: ${m}`);
  }
  // Types that real payloads had, from tools/schemas/observed/; "x-unverified" stays.
  const { schema, n: typed } = applyObserved(file, hand.schema);
  // Match the repo formatter so regenerating leaves a clean diff.
  const fmt = Bun.spawnSync(
    [
      process.execPath,
      "x",
      "biome",
      "format",
      `--stdin-file-path=${join(ROOT, "schemas", file)}`,
    ],
    {
      cwd: ROOT,
      stdin: Buffer.from(JSON.stringify(schema, null, 2)),
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  if (fmt.exitCode !== 0)
    throw new Error(`biome format failed:\n${fmt.stderr.toString()}`);
  const text = fmt.stdout.toString();
  const path = join(OUT, file);
  if (check) {
    if (!existsSync(path) || readFileSync(path, "utf8") !== text) {
      stale++;
      console.log(`stale: ${file}`);
    }
  } else writeFileSync(path, text);
  console.log(
    `${file}: ${countProps(schema)} properties, ${hand.n} typed by hand, ${typed} with x-observed-type`,
  );
}
const spreads = [...new Set(R.unresolved)];
console.log(`unresolved spreads: ${spreads.length}`);
if (argv.includes("--spreads")) for (const u of spreads) console.log(`  ${u}`);
for (const r of report) console.log(`note: ${r}`);
if (stale) process.exit(1);
