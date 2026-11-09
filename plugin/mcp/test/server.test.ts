// Run: bun test plugin/mcp/test   (needs plugin/mcp/dist/server.js; serves fixtures/site/ from a local mock; part of plugin:check)
import { afterAll, describe, expect, test } from "bun:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import {
	cleanup,
	clients,
	connect,
	SERVER,
	sourceNumbers,
	sourceOf,
	stops,
	tempDir,
} from "./server/harness.ts";
import { mockSite, newState } from "./server/mocks.ts";

afterAll(cleanup);

describe("what the model sees", () => {
	test("page and schema text reach the model", async () => {
		const { call } = await connect();
		const page = await call("read_page", { route: "configure/hooks" });
		expect(page.seen).toContain("PreToolUse");
		// A page sends text only (design D7), so what the model sees is the text.
		expect(page.structured).toBeUndefined();
		expect(page.seen).toBe(page.text);
		const schema = await call("get_schema", { name: "tools" });
		expect(schema.seen).toContain("BashInput");
		// Only the count is pinned (one definition in the fixture), not the wording.
		expect(schema.seen).toMatch(/\b1\b/u);
	});
});

/** `tools/list` measured on 2026-10-23 for the 7 tools of the old server (design D7). */
const OLD_TOOLS_LIST_BYTES = 15_468;

describe("tool list", () => {
	test("tools/list is at most 40% of the old size, and no tool is about platform", async () => {
		const cache = await tempDir();
		const c = new Client({ name: "test", version: "0" });
		await c.connect(
			new StdioClientTransport({
				command: "bun",
				args: [SERVER],
				env: { ...process.env, CLAWDIPEDIA_CACHE_DIR: cache },
			}),
		);
		clients.push(c);
		const list = await c.listTools();
		const bytes = Buffer.byteLength(JSON.stringify(list));
		const limit = Math.floor(OLD_TOOLS_LIST_BYTES * 0.4);
		console.info(
			`tools/list: ${bytes} bytes (limit ${limit} = 40% of ${OLD_TOOLS_LIST_BYTES})`,
		);
		expect(bytes).toBeLessThanOrEqual(limit);
		expect(list.tools.map((t) => t.name).toSorted()).toEqual([
			"get_schema",
			"list_pages",
			"read_page",
			"search_docs",
		]);
		for (const t of list.tools) {
			expect(t.name).not.toContain("platform");
			expect(t.outputSchema).toBeUndefined();
		}
	});
});

describe("prebuilt search index", () => {
	test("the first search makes one request for the index and none for a page", async () => {
		const state = newState();
		const site = mockSite(state);
		stops.push(site.stop);
		const { call } = await connect({ CLAWDIPEDIA_BASE_URL: site.url });
		const s = await call("search_docs", { query: "PreToolUse" });
		expect(s.error).toBe(false);
		expect(s.text).toContain("configure/hooks");
		// Only the count is pinned (the index covers the 3 fixture pages), not the wording.
		expect(sourceNumbers(s)).toContain(3);
		expect(
			state.hits.filter((h) => h.path === "/llms-search-index.json"),
		).toHaveLength(1);
		expect(state.hits.filter((h) => h.path.endsWith(".md"))).toHaveLength(0);
		// The next search makes no request for the index.
		state.hits.length = 0;
		await call("search_docs", { query: "debounced" });
		expect(state.hits.some((h) => h.path === "/llms-search-index.json")).toBe(
			false,
		);
	});

	test("a 404 for the index falls back to a read of every page", async () => {
		const state = newState();
		state.noIndex = true;
		const site = mockSite(state);
		stops.push(site.stop);
		const { call } = await connect({ CLAWDIPEDIA_BASE_URL: site.url });
		const s = await call("search_docs", { query: "PreToolUse" });
		expect(s.error).toBe(false);
		expect(s.text).toContain("configure/hooks");
		expect(state.hits.filter((h) => h.path.endsWith(".md")).length).toBe(3);
	});

	test("a cached index is revalidated by its ETag in a new process", async () => {
		const state = newState();
		state.etag = true;
		const site = mockSite(state);
		stops.push(site.stop);
		const cache = await tempDir();
		const env = {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAWDIPEDIA_CACHE_DIR: cache,
			CLAWDIPEDIA_TTL_SCALE: "0",
		};
		const warm = await connect(env);
		await warm.call("search_docs", { query: "hook" });
		state.hits.length = 0;
		const again = await connect(env);
		const s = await again.call("search_docs", { query: "hook" });
		expect(s.error).toBe(false);
		expect(s.text).toContain("configure/hooks");
		expect(
			state.hits.find((h) => h.path === "/llms-search-index.json")?.inm,
		).toBe('"i1"');
	});

	test("search with the site down and the index cached still answers", async () => {
		const site = mockSite();
		const cache = await tempDir();
		const env = {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAWDIPEDIA_CACHE_DIR: cache,
			CLAWDIPEDIA_TTL_SCALE: "0",
		};
		const warm = await connect(env);
		await warm.call("search_docs", { query: "hook" });
		await site.stop();
		const again = await connect(env);
		const s = await again.call("search_docs", { query: "hook" });
		expect(s.error).toBe(false);
		expect(s.text).toContain("configure/hooks");
	});
});

describe("offline read", () => {
	test("a page read once is served from the cache by a new process with the site down", async () => {
		const state = newState();
		const site = mockSite(state);
		const cache = await tempDir();
		const env = {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAWDIPEDIA_CACHE_DIR: cache,
			CLAWDIPEDIA_TTL_SCALE: "0",
		};
		const warm = await connect(env);
		const first = await warm.call("read_page", { route: "configure/hooks" });
		expect(first.error).toBe(false);
		expect(state.hits.some((h) => h.path === "/configure/hooks.md")).toBe(true);
		await site.stop();
		const second = await connect(env);
		const again = await second.call("read_page", { route: "configure/hooks" });
		expect(again.error).toBe(false);
		expect(again.text).toContain("PreToolUse");
		const l = await second.call("list_pages", {});
		expect(sourceOf(l).state).toBe("stale-offline");
	});
});

describe("get_schema", () => {
	test("follows additionalProperties and items", async () => {
		const { call } = await connect();
		const a = await call("get_schema", {
			name: "settings",
			property: "hooks.PreToolUse",
		});
		expect(a.error).toBe(false);
		expect(a.text).toContain('"type": "array"');
		const b = await call("get_schema", {
			name: "settings",
			property: "hooks.PreToolUse.[]",
		});
		expect(b.text).toContain('"matcher"');
	});
	test("prototype keys are not found", async () => {
		const { call } = await connect();
		const props = ["__proto__", "hooks.__proto__", "constructor"];
		const answers = await Promise.all(
			props.map((property) =>
				call("get_schema", { name: "settings", property }),
			),
		);
		expect(answers.map((a) => a.error)).toEqual(props.map(() => true));
	});
});

describe("get_schema definitions", () => {
	test("finds a definition and its fields, and lists definitions", async () => {
		const { call } = await connect();
		const def = await call("get_schema", {
			name: "tools",
			property: "BashInput",
		});
		expect(def.text).toContain('"required"');
		const field = await call("get_schema", {
			name: "tools",
			property: "BashInput.command",
		});
		expect(field.text).toContain("The command to run");
		const outline = await call("get_schema", { name: "tools" });
		expect(outline.text).toContain("1 definitions");
		const miss = await call("get_schema", {
			name: "tools",
			property: "BashInput.decider",
		});
		expect(miss.error).toBe(true);
	});
});

describe("get_schema types", () => {
	test("finds a type, a member, a call, and an event", async () => {
		const { call } = await connect();
		const get = async (property: string) => {
			const r = await call("get_schema", { name: "types", property });
			return r.text;
		};
		expect(await get("ToolCheckResult")).toContain("decision: 'allow'");
		const member = await get("ToolCheckResult.plugin");
		expect(member).toContain("readonly plugin?: string;");
		expect(member).not.toContain("decision");
		expect(await get("$.tool.check")).toContain(
			"check(input: { tool: string }): Promise<ToolCheckResult>;",
		);
		expect(await get("tool.check")).toContain(
			"'tool.check': { tool: string };",
		);
	});
	test("a missing name is an error that gives the closest names", async () => {
		const { call } = await connect();
		const r = await call("get_schema", {
			name: "types",
			property: "ToolCheckResult.decider",
		});
		expect(r.error).toBe(true);
		// The near names are listed apart from the query, which also starts with the name.
		expect(r.text.replace("ToolCheckResult.decider", "")).toContain(
			"ToolCheckResult",
		);
	});
	test("without property, lists the declared names", async () => {
		const { call } = await connect();
		const r = await call("get_schema", { name: "claude-code.d.ts" });
		expect(r.error).toBe(false);
		expect(r.text).toContain("ToolCheckResult");
		// Only the count is pinned (3 declared names in the fixture), not the wording.
		expect(r.text).toMatch(/\b3\b/u);
	});
});
