// Chunk citations in docs/ must name a module of the build of src/version.ts.
// Run with: bun tools/check/citations.ts [--bin <binary>]
// With --move-from <older binary>, it instead writes the docs/ files with each stale citation moved to the build of --bin (or of src/version.ts).
import { homedir } from "node:os";
import { join } from "node:path";

import { extractModules } from "../../inspect/mcp/src/bunfs.ts";
import {
	moveCitations,
	staleCitations,
} from "../../inspect/mcp/src/citations.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

const ROOT = join(import.meta.dir, "..", "..");
const flag = process.argv.indexOf("--bin");
const bin =
	flag === -1
		? join(homedir(), ".local/share/claude/versions", CLAUDE_CODE_VERSION)
		: (process.argv[flag + 1] ?? "");

const { modules } = await extractModules(bin);
const files: Record<string, string> = {};
for await (const f of new Bun.Glob("docs/**/*.md").scan(ROOT)) {
	files[f] = await Bun.file(join(ROOT, f)).text();
}
const moveFlag = process.argv.indexOf("--move-from");
const sources = async (binary: string) => {
	const { modules: mods } = await extractModules(binary);
	return mods.map((m) => ({ name: m.name, text: m.source }));
};
if (moveFlag === -1) {
	const stale = staleCitations(
		files,
		modules.map((m) => m.name),
	);
	if (stale.length > 0) {
		for (const c of stale) {
			console.error(
				`${c.file}:${c.line}: ${c.citation} names no module of ${bin}`,
			);
		}
		console.error(`\n${stale.length} stale citation(s) found.`);
		process.exitCode = 1;
	} else {
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
		`${count("same")} same, ${count("module")} module, ${count("unmapped")} unmapped`,
	);
}
