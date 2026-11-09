// Run: bun test cli/test   (runs cli/bin/clawdipedia against a local mock of the site and of platform.claude.com; no network)
import { describe, expect, test } from "bun:test";

import {
	cc,
	hitRoutes,
	mockPlatform,
	routesInText,
	tmp,
	withSite,
} from "./helpers.ts";
import { mcpCall } from "./mcp.ts";

describe("subcommands", () => {
	test("search then read a route from its output, each ending with a Source line", async () => {
		const { env } = await withSite();
		const s = await cc(["search", "PreToolUse"], env);
		expect(s.code).toBe(0);
		expect(s.out).toContain("configure/hooks");
		expect(s.out).toMatch(/Source: .*\n$/u);
		const [route = ""] = routesInText(s.out);
		expect(route).toBe("configure/hooks");
		const r = await cc(["read", route], env);
		expect(r.code).toBe(0);
		expect(r.out).toContain("The `PreToolUse` hook runs before a tool call.");
		expect(r.out).toMatch(/Source: .*\n$/u);
	});

	test("read --section prints one H2 section", async () => {
		const { env } = await withSite();
		const r = await cc(
			["read", "configure/hooks", "--section", "Timeouts"],
			env,
		);
		expect(r.code).toBe(0);
		expect(r.out).toContain("A hook command stops after the timeout.");
		expect(r.out).not.toContain("Hook handlers return JSON.");
	});

	test("search joins words and --limit caps the hits", async () => {
		const { env } = await withSite();
		const s = await cc(["search", "hook", "--limit", "1", "--json"], env);
		expect(s.code).toBe(0);
		expect(hitRoutes(s.out)).toHaveLength(1);
		const words = await cc(["search", "debounced", "status"], env);
		expect(words.out).toContain("configure/status-line");
	});

	test("list shows the sections, and list <prefix> one section", async () => {
		const { env } = await withSite();
		const all = await cc(["list"], env);
		expect(all.code).toBe(0);
		expect(all.out).toContain("`configure/hooks`");
		expect(all.out).toContain("Hook Events");
		expect(all.out).toMatch(/Source: .*\n$/u);
		const one = await cc(["list", "configure"], env);
		expect(one.out).toContain("`configure/status-line`");
		expect(one.out).not.toContain("`index`");
	});

	test("schema prints an outline and a property", async () => {
		const { env } = await withSite();
		const o = await cc(["schema", "tools"], env);
		expect(o.code).toBe(0);
		expect(o.out).toContain("BashInput");
		const p = await cc(["schema", "tools", "BashInput.command"], env);
		expect(p.code).toBe(0);
		expect(p.out).toContain("The command to run");
		expect(p.out).toMatch(/Source: .*\n$/u);
	});

	test("--source platform reads the platform docs", async () => {
		const platform = mockPlatform();
		const env = {
			PLATFORM_DOCS_BASE_URL: platform.url,
			CLAWDIPEDIA_CACHE_DIR: await tmp(),
		};
		const s = await cc(
			["search", "prompt caching", "--source", "platform"],
			env,
		);
		expect(s.code).toBe(0);
		expect(s.out).toContain("build-with-claude/prompt-caching");
		const r = await cc(
			["read", "build-with-claude/overview", "--source", "platform"],
			env,
		);
		expect(r.code).toBe(0);
		expect(r.out).toContain("Zebrafinch");
		const l = await cc(["list", "--source", "platform"], env);
		expect(l.out).toContain("Messages: 3");
	});
	test("--source clawdipedia reads the site, and the old value docs is a usage error", async () => {
		const { env } = await withSite();
		const ok = await cc(
			["search", "PreToolUse", "--source", "clawdipedia"],
			env,
		);
		expect(ok.code).toBe(0);
		expect(ok.out).toContain("configure/hooks");
		const old = await cc(["search", "PreToolUse", "--source", "docs"], env);
		expect(old.code).toBe(2);
		expect(old.out).toBe("");
		for (const name of [
			"clawdipedia",
			"platform",
			"code",
			"claude-resources",
		]) {
			expect(old.err).toContain(name);
		}
	});
});

describe("--json", () => {
	test("stdout is one JSON value that parses, for every subcommand", async () => {
		const { env } = await withSite();
		const runs = await Promise.all(
			[
				["search", "PreToolUse"],
				["read", "configure/hooks"],
				["list"],
				["schema", "tools"],
			].map((args) => cc([...args, "--json"], env)),
		);
		for (const r of runs) {
			expect(r.code).toBe(0);
			const parsed: unknown = JSON.parse(r.out);
			expect(parsed).toBeDefined();
		}
		const s = await cc(["search", "PreToolUse", "--json"], env);
		expect(hitRoutes(s.out)).toContain("configure/hooks");
	});
});

describe("same answers as the MCP server", () => {
	test("search lists the same routes in the same order as search_docs", async () => {
		const { site } = await withSite();
		const cli = await cc(["search", "hook", "--json"], {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAWDIPEDIA_CACHE_DIR: await tmp(),
		});
		const mcp = await mcpCall(
			{ CLAWDIPEDIA_BASE_URL: site.url, CLAWDIPEDIA_CACHE_DIR: await tmp() },
			"search_docs",
			{ query: "hook" },
		);
		expect(mcp.routes.length).toBeGreaterThan(1);
		expect(hitRoutes(cli.out)).toEqual(mcp.routes);
		// The text lists the same routes too.
		const cliRun = await cc(["search", "hook"], {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAWDIPEDIA_CACHE_DIR: await tmp(),
		});
		expect(routesInText(cliRun.out)).toEqual(routesInText(mcp.text));
	});
});
