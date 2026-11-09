// Platform tools of the docs server. Part of: bun test plugin/mcp/test
import { afterAll, describe, expect, test } from "bun:test";

import { cleanup, connect, pagesOf, sourceOf, stops } from "./harness.ts";
import { mockPlatform } from "./mocks.ts";

afterAll(cleanup);

describe("platform tools", () => {
	test("search, read, and list work and report a live source", async () => {
		const p = mockPlatform();
		stops.push(p.stop);
		const { call } = await connect({ PLATFORM_DOCS_BASE_URL: p.url });
		const s = await call("search_docs", {
			source: "platform",
			query: "prompt caching",
		});
		expect(s.error).toBe(false);
		expect(s.text).toContain("build-with-claude/prompt-caching");
		expect(sourceOf(s).origin).toMatch(/^127\.0\.0\.1:\d+$/u);
		expect(sourceOf(s).state).toBe("live");
		const g = await call("search_docs", {
			source: "platform",
			query: "caching",
			section: "Getting Started",
		});
		expect(g.error).toBe(false);
		expect(g.text).not.toContain("build-with-claude/prompt-caching");
		const none = await call("search_docs", {
			source: "platform",
			query: "zzzqqq",
		});
		expect(none.error).toBe(false);
		expect(none.text).not.toContain("build-with-claude");
		const r = await call("read_page", {
			source: "platform",
			route: "/docs/en/build-with-claude/overview.md",
		});
		expect(r.error).toBe(false);
		expect(r.seen).toContain("Zebrafinch");
		expect(r.text).toContain("<HomePage>");
		const sec = await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
			section_heading: "Tools",
		});
		expect(sec.text).toContain("Tool list here");
		expect(sec.text).not.toContain("Zebrafinch");
		const groups = await call("list_pages", { source: "platform" });
		expect(groups.structured?.["groups"]).toContainEqual({
			group: "Getting Started",
			count: 2,
		});
		expect(groups.text).not.toMatch(/Erste|Deutsch|evil/u);
		// Without a group the structured result has counts only, no page list.
		expect(groups.structured?.["pages"]).toBeUndefined();
		expect(groups.structured?.["groups"]).toContainEqual({
			group: "Messages",
			count: 3,
		});
		const withGroup = await call("list_pages", {
			source: "platform",
			section: "messages",
		});
		expect(withGroup.structured?.["pages"]).toHaveLength(3);
		const msgs = await call("list_pages", {
			source: "platform",
			section: "messages",
		});
		const msg = pagesOf(msgs).find((x) => x.route === "api/messages");
		expect(msg?.title).toBe("Create a Message");
		expect(msg?.description).toContain("Send");
		const nope = await call("list_pages", {
			source: "platform",
			section: "Nope",
		});
		expect(nope.error).toBe(true);
		const missing = await call("read_page", {
			source: "platform",
			route: "build-with-claude/caching",
		});
		expect(missing.error).toBe(true);
		expect(missing.text).toContain("build-with-claude/prompt-caching");
	});

	test("a mirror serving the real llms.txt links still works", async () => {
		const p = mockPlatform(false);
		stops.push(p.stop);
		const { call } = await connect({ PLATFORM_DOCS_BASE_URL: p.url });
		const s = await call("search_docs", {
			source: "platform",
			query: "prompt caching",
		});
		expect(s.text).toContain("build-with-claude/prompt-caching");
		expect(s.text).toContain(`${p.url}/docs/en/`);
		const r = await call("read_page", {
			source: "platform",
			route: "build-with-claude/prompt-caching",
		});
		expect(r.error).toBe(false);
		expect(r.text).toContain("cache_control");
		expect(p.hits.some((h) => h.path.endsWith("prompt-caching.md"))).toBe(true);
	});

	test("a group name query does not boost every page of the group", async () => {
		const p = mockPlatform();
		stops.push(p.stop);
		const { call } = await connect({ PLATFORM_DOCS_BASE_URL: p.url });
		const s = await call("search_docs", {
			source: "platform",
			query: "Messages",
		});
		// The page titled "Create a Message" has no phrase boost from the group name.
		expect(s.error).toBe(false);
		expect(s.text).toContain("api/messages");
	});

	test("no request inside the TTL", async () => {
		const p = mockPlatform();
		stops.push(p.stop);
		const { call } = await connect({ PLATFORM_DOCS_BASE_URL: p.url });
		await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
		});
		await call("search_docs", { source: "platform", query: "streaming" });
		const n = p.hits.length;
		const again = await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
		});
		await call("search_docs", { source: "platform", query: "streaming" });
		expect(p.hits.length).toBe(n);
		expect(again.error).toBe(false);
	});

	test("after the TTL llms.txt is revalidated and a page is a plain GET", async () => {
		const p = mockPlatform();
		stops.push(p.stop);
		const { call } = await connect({
			PLATFORM_DOCS_BASE_URL: p.url,
			CLAWDIPEDIA_TTL_SCALE: "0",
		});
		await call("search_docs", { source: "platform", query: "streaming" });
		await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
		});
		p.hits.length = 0;
		const s = await call("search_docs", {
			source: "platform",
			query: "streaming",
		});
		expect(s.error).toBe(false);
		await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
		});
		const page = p.hits.filter((h) => h.path.endsWith("overview.md"));
		expect(page.length).toBe(1);
		expect(page[0]?.ims).toBeNull();
		expect(p.hits.find((h) => h.path === "/llms.txt")?.ims).not.toBeNull();
	});

	test("rejects bad paths without a request", async () => {
		const p = mockPlatform();
		stops.push(p.stop);
		const { call } = await connect({ PLATFORM_DOCS_BASE_URL: p.url });
		const bad = [
			"../x",
			"a/../../x",
			"docs/de/home",
			"/docs/de/home.md",
			"https://evil.example/docs/en/home.md",
			"//evil.example/docs/en/home",
			"Home Page",
			"docs/home",
		];
		const answers = await Promise.all(
			bad.map((route) => call("read_page", { source: "platform", route })),
		);
		expect(answers.map((r) => r.error)).toEqual(bad.map(() => true));
		expect(p.hits.length).toBe(0);
		// The configured host and the bare path forms are accepted.
		const full = await call("read_page", {
			source: "platform",
			route: `${p.url}/docs/en/build-with-claude/overview`,
		});
		expect(full.error).toBe(false);
	});

	test("offline: cached copy is served, uncached page is an error", async () => {
		const p = mockPlatform();
		const { call } = await connect({
			PLATFORM_DOCS_BASE_URL: p.url,
			CLAWDIPEDIA_TTL_SCALE: "0",
		});
		await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
		});
		await call("list_pages", { source: "platform" });
		await p.stop();
		const r = await call("read_page", {
			source: "platform",
			route: "build-with-claude/overview",
		});
		expect(r.error).toBe(false);
		expect(r.text).toContain("Zebrafinch");
		const l = await call("list_pages", { source: "platform" });
		expect(l.error).toBe(false);
		expect(sourceOf(l).state).toBe("stale-offline");
		const other = await call("read_page", {
			source: "platform",
			route: "build-with-claude/prompt-caching",
		});
		expect(other.error).toBe(true);
	});

	test("offline with nothing cached is an error", async () => {
		const p = mockPlatform();
		await p.stop();
		const { call } = await connect({ PLATFORM_DOCS_BASE_URL: p.url });
		const search = await call("search_docs", {
			source: "platform",
			query: "caching",
		});
		const list = await call("list_pages", { source: "platform" });
		expect([search.error, list.error]).toEqual([true, true]);
	});
});
