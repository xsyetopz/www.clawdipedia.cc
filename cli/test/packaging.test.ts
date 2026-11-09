// Run: bun test cli/test   (checks the files of the clawdipedia-docs-cli plugin and its registry package; no network)
import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import { BIN, isRecord, pathExists, readJson, ROOT } from "./helpers.ts";

const jsonOf = async (path: string): Promise<Record<string, unknown>> => {
	const v = await readJson(path);
	if (!isRecord(v)) {
		throw new TypeError(`${path} is not a JSON object`);
	}
	return v;
};

describe("packaging", () => {
	test("the bundle is one executable file that starts with a bun shebang", async () => {
		const text = await Bun.file(BIN).text();
		expect(text.startsWith("#!/usr/bin/env bun\n")).toBe(true);
		const info = await stat(BIN);
		expect(info.mode & 0o111).not.toBe(0);
	});

	test("the bundle runs by itself as a command", async () => {
		const p = Bun.spawn([BIN, "--help"], {
			env: process.env,
			stdout: "pipe",
			stderr: "pipe",
		});
		expect(await p.exited).toBe(0);
		// The help text names the command; its wording is not pinned.
		expect(await new Response(p.stdout).text()).toContain("clawdipedia");
	});

	test("the plugin has a skill and a bin, and no MCP server", async () => {
		const cli = join(ROOT, "cli");
		expect(await pathExists(join(cli, ".mcp.json"))).toBe(false);
		expect(await pathExists(join(cli, "bin", "clawdipedia"))).toBe(true);
		expect(
			await pathExists(join(cli, "skills", "clawdipedia-docs-cli", "SKILL.md")),
		).toBe(true);
		const plugin = await jsonOf(join(cli, ".claude-plugin", "plugin.json"));
		expect(plugin["name"]).toBe("clawdipedia-docs-cli");
		expect(plugin["displayName"]).toBe("Anthropic Docs CLI");
		expect(plugin["mcpServers"]).toBeUndefined();
	});

	test("the registry package is clawdipedia-docs, with a bin, files, and the plugin version", async () => {
		const cli = join(ROOT, "cli");
		const pkg = await jsonOf(join(cli, "package.json"));
		const plugin = await jsonOf(join(cli, ".claude-plugin", "plugin.json"));
		expect(pkg["name"]).toBe("clawdipedia-docs");
		expect(pkg["bin"]).toEqual({ clawdipedia: "bin/clawdipedia" });
		expect(pkg["files"]).toEqual(["bin/"]);
		expect(pkg["version"]).toBe(plugin["version"]);
		expect(pkg["dependencies"]).toBeUndefined();
	});
});
