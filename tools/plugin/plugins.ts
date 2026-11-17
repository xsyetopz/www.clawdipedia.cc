import { stat } from "node:fs/promises";
import { join } from "node:path";

import { MARKETPLACE } from "../version/bump.ts";

export const ROOT = join(import.meta.dir, "..", "..");

/**
 * The plugins of the marketplace: folder, skill, bundle source and output, tests, whether it has an MCP server,
 * and the packages its bundle leaves out (a native package, which Bun installs on first run).
 */
export const PLUGINS = [
	{
		dir: "plugin",
		skill: "clawdipedia-docs",
		src: "plugin/mcp/src/server.ts",
		out: "plugin/mcp/dist/server.js",
		test: "plugin/mcp/test",
		mcp: true,
		external: [],
	},
	{
		dir: "inspect",
		skill: "cc-inspect",
		src: "inspect/mcp/src/server.ts",
		out: "inspect/mcp/dist/server.js",
		test: "inspect/mcp/test",
		mcp: true,
		external: ["oxc-parser"],
	},
	{
		dir: "cli",
		skill: "clawdipedia-docs-cli",
		src: "cli/src/cli.ts",
		out: "cli/bin/clawdipedia",
		test: "cli/test",
		mcp: false,
		external: [],
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

type Json = Record<string, unknown>;

/**
 * Lists the plugin entries of the marketplace file.
 *
 * @param read Returns the parsed JSON of a repo file.
 * @returns Each object in the `plugins` array; other values are left out.
 */
export const marketplaceEntries = (read: (file: string) => Json): Json[] => {
	const plugins = read(MARKETPLACE)["plugins"];
	return Array.isArray(plugins)
		? plugins.filter(
				(p): p is Json =>
					typeof p === "object" && p !== null && !Array.isArray(p),
			)
		: [];
};

/** Marketplace entry fields that copy the plugin manifest, so the two must stay equal. */
export const MIRRORED_FIELDS = ["license", "keywords"] as const;

/**
 * Finds each marketplace entry whose mirrored fields differ from its plugin manifest.
 *
 * @param read Returns the parsed JSON of a repo file: the marketplace file and each plugin manifest.
 * @returns One message per entry with no manifest and per differing field.
 */
export const mirrorProblems = (read: (file: string) => Json): string[] => {
	const manifests = new Map(
		PLUGINS.map((p) => {
			const m = read(manifestFile(p.dir));
			return [String(m["name"]), m];
		}),
	);
	return marketplaceEntries(read).flatMap((entry) => {
		const name = String(entry["name"]);
		const manifest = manifests.get(name);
		if (!manifest) {
			return [
				`marketplace entry "${name}" has no plugin manifest with that name`,
			];
		}
		// JSON text compares arrays by value and order, and keeps keyword order a reviewed choice.
		return MIRRORED_FIELDS.filter(
			(f) => JSON.stringify(entry[f]) !== JSON.stringify(manifest[f]),
		).map(
			(f) =>
				`marketplace entry "${name}" ${f} differs from its plugin manifest: copy it from plugin.json`,
		);
	});
};
