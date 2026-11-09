// Managed-folder fixture for probe:managed. The tool only builds this in a temp stage dir and prints commands;
// the root-owned copy into /Library/Application Support/ClaudeCode is done by the generated script (see script.ts).
import { cp } from "node:fs/promises";
import { join } from "node:path";

export const MANAGED_DIR = "/Library/Application Support/ClaudeCode";
/** Marker file inside the managed folder. A folder without it is not ours and is never touched or probed. */
export const MARKER = ".release-toolkit-probe";
export const PHASES = ["baseline", "main", "true", "false", "owned"] as const;
export type Phase = (typeof PHASES)[number];
/** Root-owned file in the managed folder naming the installed variant; the tool polls it. */
export const VARIANT_FILE = ".variant";
/** Variants the script installs, in order. `main` has no classifyAllShell; `true`/`false` set it. `owned` is `main` in a folder that the sudo user owns. */
export const VARIANTS = ["main", "true", "false", "owned"] as const;

export const HERE = import.meta.dir;
export const MCP_SERVER = join(HERE, "mcp", "server.js");

/** An stdio MCP server definition for the probe server. `startedLog` records which servers the program started. */
export const srvDef = (name: string, startedLog: string) => ({
	type: "stdio",
	command: process.execPath,
	args: [MCP_SERVER, name, startedLog],
});

const w = async (root: string, rel: string, content: string): Promise<void> => {
	await Bun.write(join(root, rel), content);
};

/** Writes the base `ClaudeCode/` tree (no managed-settings.json) and `variants/<v>/managed-settings.json` under stage. */
export const buildStage = async (
	stage: string,
	startedLog: string,
): Promise<void> => {
	const base = join(stage, "ClaudeCode");
	await w(base, MARKER, "");
	await w(base, "CLAUDE.md", "# Managed memory\nPROBE-MANAGED-MD\n");
	await w(
		base,
		"managed-mcp.json",
		`${JSON.stringify({ mcpServers: { managed_srv: srvDef("managed_srv", startedLog) } }, null, 2)}\n`,
	);
	await w(
		base,
		"managed-settings.d/10-deny.json",
		'{"permissions":{"deny":["NotebookEdit"]}}\n',
	);
	await w(
		base,
		"managed-settings.d/20-automode.json",
		'{"autoMode":{"allow":["PROBE-DROPIN-ALLOW"]}}\n',
	);
	await w(
		base,
		".claude/output-styles/managed-style.md",
		"---\nname: managed-style\ndescription: Managed style\n---\nPROBE-MANAGED-STYLE answer in a managed way.\n",
	);
	await w(
		base,
		".claude/rules/managed-rule.md",
		"# Managed rule\nPROBE-MANAGED-RULE\n",
	);
	await w(
		base,
		".claude/skills/managed-skill/SKILL.md",
		"---\nname: managed-skill\ndescription: PROBE-MANAGED-SKILL-DESC managed policy skill\n---\nPROBE-MANAGED-SKILL-BODY\n",
	);
	await cp(join(HERE, "variants"), join(stage, "variants"), {
		recursive: true,
	});
	// fail early if a variant file is missing or not JSON
	await Promise.all(
		VARIANTS.map((v) =>
			Bun.file(join(stage, "variants", v, "managed-settings.json")).json(),
		),
	);
};
