// Chunk citations in docs/, tools/surface/exclusions.json, and tools/schemas/manual/ must name a module of the build of src/version.ts,
// and each program citation must name its chunk and its `:N` place.
// Run with: bun tools/check/citations.ts [--bin <binary>]
// With --move-from <older binary>, it instead writes those files with each stale citation moved to the build of --bin (or of src/version.ts).
// A move cleans each build once (about 14 seconds and a few GB of memory for each), because a `:N` can be a line of the cleaned module.
import { homedir } from "node:os";
import { join } from "node:path";

import { extractModules } from "../../inspect/mcp/src/bunfs.ts";
import { unlocatedCitations } from "../../inspect/mcp/src/citation-form.ts";
import {
	moveCitations,
	staleCitations,
} from "../../inspect/mcp/src/citations.ts";
import { sources } from "../../inspect/mcp/src/sources.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

const ROOT = join(import.meta.dir, "..", "..");
const flag = process.argv.indexOf("--bin");
const bin =
	flag === -1
		? join(homedir(), ".local/share/claude/versions", CLAUDE_CODE_VERSION)
		: (process.argv[flag + 1] ?? "");

const { modules } = await extractModules(bin);
// The Surface Coverage page renders the exclusions, so a citation there must move at its source.
const EXCLUSIONS = "tools/surface/exclusions.json";
const files: Record<string, string> = {
	[EXCLUSIONS]: await Bun.file(join(ROOT, EXCLUSIONS)).text(),
};
// The notes of the hand-read schema types (tools/schemas/manual/) cite the code each type was read from.
const scans = await Promise.all(
	["docs/**/*.md", "tools/schemas/manual/*.json"].map((g) =>
		Array.fromAsync(new Bun.Glob(g).scan(ROOT)),
	),
);
const names = scans.flat();
const texts = await Promise.all(
	names.map((f) => Bun.file(join(ROOT, f)).text()),
);
for (const [i, f] of names.entries()) {
	files[f] = texts[i] ?? "";
}
const moveFlag = process.argv.indexOf("--move-from");
if (moveFlag === -1) {
	const stale = staleCitations(
		files,
		modules.map((m) => m.name),
	);
	const unlocated = unlocatedCitations(files);
	for (const u of unlocated) {
		console.error(`${u.file}:${u.line}: ${u.problem}`);
	}
	if (unlocated.length > 0) {
		console.error(
			`\n${unlocated.length} program citation(s) without a chunk-x.js:N place.`,
		);
		process.exitCode = 1;
	}
	if (stale.length > 0) {
		for (const c of stale) {
			console.error(
				`${c.file}:${c.line}: ${c.citation} names no module of ${bin}`,
			);
		}
		console.error(`\n${stale.length} stale citation(s) found.`);
		process.exitCode = 1;
	} else if (unlocated.length === 0) {
		console.info(
			`check-citations: ok (${Object.keys(files).length} files, build ${CLAUDE_CODE_VERSION})`,
		);
	}
} else {
	const moved = moveCitations(
		files,
		await sources(process.argv[moveFlag + 1] ?? ""),
		await sources(bin),
	);
	await Promise.all(
		Object.entries(moved.files)
			.filter(([f, text]) => text !== files[f])
			.map(([f, text]) => Bun.write(join(ROOT, f), text)),
	);
	const count = (how: string) =>
		moved.moves.filter((m) => m.how === how).length;
	for (const m of moved.moves.filter((x) => x.how !== "same")) {
		console.info(
			`${m.file}:${m.line}: ${m.from} -> ${m.to ?? "unmapped"} (${m.how})`,
		);
	}
	console.info(
		`${count("same")} same, ${count("term")} term, ${count("module")} module, ${count("unmapped")} unmapped`,
	);
}
