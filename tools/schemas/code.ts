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
import { join } from "node:path";

import { buildClaudeJson } from "./code/claudejson.ts";
import { argv, countProps, mods, OUT, R, report, ROOT } from "./code/ctx.ts";
import { buildFrontmatter } from "./code/frontmatter.ts";
import { buildOtel } from "./code/otel.ts";
import { buildStatusLine } from "./code/statusline.ts";
import { buildTranscript } from "./code/transcript.ts";
import { formatJson } from "./format.ts";
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
const program = mods.map((m) => m.text).join("\n");
const inProgram = anchorIn(program);

interface Built {
	file: string;
	text: string;
	lines: string[];
	stale: number;
}

// The builders run in order up to their first await, so their shared state (R, report) fills as before.
const buildOne = async (build: (typeof builders)[number]): Promise<Built> => {
	const { file, schema: built } = build();
	// Types read by hand from the program, from tools/schemas/manual/; these drop "x-unverified".
	const hand = await applyManual(file, built, inProgram);
	const lines: string[] = [];
	let stale = 0;
	for (const m of [...hand.stale, ...hand.missed]) {
		stale++;
		lines.push(`manual ${file}: ${m}`);
	}
	// Types that real payloads had, from tools/schemas/observed/; "x-unverified" stays.
	const { schema, n: typed } = await applyObserved(file, hand.schema);
	// Format as `bun fmt` does so regenerating leaves a clean diff.
	const text = await formatJson(schema, join(ROOT, "schemas", file));
	const path = join(OUT, file);
	if (check) {
		const committed = Bun.file(path);
		if (!(await committed.exists()) || (await committed.text()) !== text) {
			stale++;
			lines.push(`stale: ${file}`);
		}
	} else {
		await Bun.write(path, text);
	}
	lines.push(
		`${file}: ${countProps(schema)} properties, ${hand.n} typed by hand, ${typed} with x-observed-type`,
	);
	return { file, text, lines, stale };
};

const built = await Promise.all(builders.map((b) => buildOne(b)));
for (const b of built) {
	for (const l of b.lines) {
		console.info(l);
	}
}
const spreads = [...new Set(R.unresolved)];
console.info(`unresolved spreads: ${spreads.length}`);
if (argv.includes("--spreads")) {
	for (const u of spreads) {
		console.info(`  ${u}`);
	}
}
for (const r of report) {
	console.info(`note: ${r}`);
}
if (built.reduce((n, b) => n + b.stale, 0) > 0) {
	process.exitCode = 1;
}
