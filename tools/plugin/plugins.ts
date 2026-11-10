import { stat } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..", "..");

/** The plugins of this repo: folder, skill, bundle source and output, tests, and whether it has an MCP server. */
export const PLUGINS = [
	{
		dir: "plugin",
		skill: "clawdipedia-docs",
		src: "plugin/mcp/src/server.ts",
		out: "plugin/mcp/dist/server.js",
		test: "plugin/mcp/test",
		mcp: true,
	},
	{
		dir: "inspect",
		skill: "cc-inspect",
		src: "inspect/mcp/src/server.ts",
		out: "inspect/mcp/dist/server.js",
		test: "inspect/mcp/test",
		mcp: true,
	},
	{
		dir: "cli",
		skill: "clawdipedia-docs-cli",
		src: "cli/src/cli.ts",
		out: "cli/bin/clawdipedia",
		test: "cli/test",
		mcp: false,
	},
];
export type Plugin = (typeof PLUGINS)[number];

export const manifestFile = (dir: string) =>
	`${dir}/.claude-plugin/plugin.json`;

// `Bun.file().exists()` is false for a folder, and callers ask about folders too.
export const exists = async (p: string): Promise<boolean> => {
	try {
		await stat(join(ROOT, p));
		return true;
	} catch {
		return false;
	}
};
export const text = (p: string): Promise<string> =>
	Bun.file(join(ROOT, p)).text();
