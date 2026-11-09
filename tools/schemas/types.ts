// Usage: bun tools/schemas/types.ts [--bin <binary>] [--check]
// Writes schemas/claude-code.d.ts: the Mod API type file that the program embeds (zstd text),
// with a header naming the version. --check only verifies the committed file (part of schemas:check).
import { homedir } from "node:os";
import { join } from "node:path";

import { extractModules, typeFile } from "../../inspect/mcp/src/bunfs.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

const ROOT = join(import.meta.dir, "..", "..");
const OUT = join(ROOT, "schemas", "claude-code.d.ts");
const HEADER = (v: string) =>
	`// The Claude Code ${v} Mod API type file, as the program embeds it.\n// Extracted by tools/schemas/types.ts. Do not edit: run "bun run schemas".\n`;

/** The problems of the committed file, or an empty list. */
const problems = async (): Promise<string[]> => {
	const file = Bun.file(OUT);
	if (!(await file.exists())) {
		return ["missing"];
	}
	const text = await file.text();
	const found: string[] = [];
	if (!text.startsWith(HEADER(CLAUDE_CODE_VERSION))) {
		found.push(`header does not name ${CLAUDE_CODE_VERSION}`);
	}
	if (!text.includes("declare module 'claude-code' {")) {
		found.push("no `declare module 'claude-code'`");
	}
	return found;
};

const verify = async (): Promise<number> => {
	const found = await problems();
	if (found.length > 0) {
		for (const p of found) {
			console.error(`schemas/claude-code.d.ts: ${p} (run "bun run schemas")`);
		}
		return 1;
	}
	console.info("schemas/claude-code.d.ts ok");
	return 0;
};

const write = async (args: string[]): Promise<number> => {
	const at = args.indexOf("--bin");
	const given = args[at + 1];
	const bin =
		at !== -1 && given !== undefined && given !== ""
			? given
			: join(homedir(), ".local/share/claude/versions", CLAUDE_CODE_VERSION);
	const { modules } = await extractModules(bin);
	const { text } = await typeFile(modules);
	// Stamps src/version.ts, as generate.ts does for the JSON Schemas.
	await Bun.write(OUT, HEADER(CLAUDE_CODE_VERSION) + text);
	console.info(
		`schemas/claude-code.d.ts: ${text.split("\n").length} lines from ${bin}`,
	);
	return 0;
};

const args = process.argv.slice(2);
process.exitCode = args.includes("--check")
	? await verify()
	: await write(args);
