// Code tools (code.claude.com) of the docs server. Part of: bun test plugin/mcp/test
import { afterAll, describe, expect, test } from "bun:test";

import { cleanup, connect, pagesOf, sourceOf, stops } from "./harness.ts";
import { mockCode } from "./mocks.ts";

afterAll(cleanup);

const start = async (env: Record<string, string> = {}) => {
	const p = mockCode();
	stops.push(p.stop);
	const c = await connect({ CODE_DOCS_BASE_URL: p.url, ...env });
	return { p, ...c };
};

describe("code tools", () => {
	test("search finds nested slugs, filters by ## group, and misses cleanly", async () => {
		const { call } = await start();
		const s = await call("search_docs", { source: "code", query: "plugin" });
		expect(s.error).toBe(false);
		expect(s.text).toContain("plugins/create");
		expect(sourceOf(s).origin).toMatch(/^127\.0\.0\.1:\d+$/u);
		expect(sourceOf(s).state).toBe("live");
		const g = await call("search_docs", {
			source: "code",
			query: "plugin",
			section: "Resources",
		});
		expect(g.error).toBe(false);
		expect(g.text).not.toContain("plugins/create");
		const hit = await call("search_docs", {
			source: "code",
			query: "agent sdk",
			section: "build with claude code",
		});
		expect(hit.text).toContain("agent-sdk/overview");
		const none = await call("search_docs", { source: "code", query: "zzzqqq" });
		expect(none.error).toBe(false);
		expect(none.text).not.toContain("plugins/create");
	});

	test("list groups by the ## heading and drops repeats and index links", async () => {
		const { call } = await start();
		const groups = await call("list_pages", { source: "code" });
		expect(groups.structured?.["groups"]).toEqual([
			{ group: "Getting started", count: 4 },
			{ group: "Build with Claude Code", count: 4 },
			{ group: "Resources", count: 1 },
		]);
		expect(groups.text).not.toMatch(/Indexes|evil|_llms/u);
		const g = await call("list_pages", {
			source: "code",
			section: "build with claude code",
		});
		expect(pagesOf(g).map((x) => x.route)).toEqual([
			"plugins/create",
			"plugins-reference",
			"agent-sdk/overview",
			"hooks-guide",
		]);
		// The first entry wins, so the description is not the repeated copy's.
		expect(g.text).toContain("Build a plugin with skills");
		const nope = await call("list_pages", { source: "code", section: "Nope" });
		expect(nope.error).toBe(true);
	});

	test("read a page, a nested page, and one heading", async () => {
		const { call, p } = await start();
		const r = await call("read_page", {
			source: "code",
			route: "/docs/en/overview.md",
		});
		expect(r.error).toBe(false);
		expect(r.seen).toContain("Quetzal");
		const nested = await call("read_page", {
			source: "code",
			route: "plugins/create",
		});
		expect(nested.seen).toContain("Ocelot");
		const sec = await call("read_page", {
			source: "code",
			route: "overview",
			section_heading: "Tools",
		});
		expect(sec.text).toContain("Tool list here");
		expect(sec.text).not.toContain("Quetzal");
		// Pages are always fetched with the .md suffix.
		expect(
			p.hits
				.filter((h) => h.path.startsWith("/docs/en/"))
				.every((h) => h.path.endsWith(".md")),
		).toBe(true);
	});

	test("rejects bad paths without a request", async () => {
		const { call, p } = await start();
		const bad = [
			"../x",
			"a/../../x",
			"docs/de/overview",
			"/docs/de/overview.md",
			"https://evil.example/docs/en/overview.md",
			"//evil.example/docs/en/overview",
			"Overview Page",
			"docs/overview",
		];
		const answers = await Promise.all(
			bad.map((route) => call("read_page", { source: "code", route })),
		);
		expect(answers.map((r) => r.error)).toEqual(bad.map(() => true));
		expect(p.hits.length).toBe(0);
		const full = await call("read_page", {
			source: "code",
			route: `${p.url}/docs/en/overview`,
		});
		expect(full.error).toBe(false);
	});

	test("a missing page lists the closest matches", async () => {
		const { call } = await start();
		const missing = await call("read_page", {
			source: "code",
			route: "plugins/make",
		});
		expect(missing.error).toBe(true);
		expect(missing.text).toContain("plugins/create");
	});

	test("offline: cached copy is served, uncached page is an error", async () => {
		const { call, p } = await start({ CLAWDIPEDIA_TTL_SCALE: "0" });
		await call("read_page", { source: "code", route: "overview" });
		await call("list_pages", { source: "code" });
		await p.stop();
		const r = await call("read_page", { source: "code", route: "overview" });
		expect(r.error).toBe(false);
		expect(r.text).toContain("Quetzal");
		const l = await call("list_pages", { source: "code" });
		expect(l.error).toBe(false);
		expect(sourceOf(l).state).toBe("stale-offline");
		const other = await call("read_page", {
			source: "code",
			route: "plugins/create",
		});
		expect(other.error).toBe(true);
	});

	test("offline with nothing cached is an error", async () => {
		const p = mockCode();
		await p.stop();
		const { call } = await connect({ CODE_DOCS_BASE_URL: p.url });
		const r = await call("search_docs", { source: "code", query: "plugin" });
		expect(r.error).toBe(true);
	});
});
