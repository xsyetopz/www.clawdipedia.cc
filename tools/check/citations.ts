// Chunk citations in docs/ must name a module of the build of src/version.ts.
// Run with: bun tools/check/citations.ts [--bin <binary>]
import { homedir } from "node:os";
import { join } from "node:path";

import { extractModules } from "../../inspect/mcp/src/bunfs.ts";
import { staleCitations } from "../../inspect/mcp/src/citations.ts";
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
