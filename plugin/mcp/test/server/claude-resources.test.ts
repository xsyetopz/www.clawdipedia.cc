// claude-resources tools (claude.com/resources) of the docs server. Part of: bun test plugin/mcp/test
import { afterAll, describe, expect, test } from "bun:test";

import { cleanup, connect, pagesOf, sourceOf, stops } from "./harness.ts";
import { mockClaudeResources } from "./mocks.ts";

afterAll(cleanup);

const PAGE = "resources/articles/claude-duet";

const start = async (env: Record<string, string> = {}) => {
	const p = mockClaudeResources();
	stops.push(p.stop);
	const c = await connect({ CLAUDE_RESOURCES_BASE_URL: p.url, ...env });
	return { p, ...c };
};

describe("claude-resources tools", () => {
	test("the sitemap keeps only resources pages and takes the section from the second segment", async () => {
		const { call } = await start();
		const groups = await call("list_pages", { source: "claude-resources" });
		// The fixture holds locale copies, other sections, the home page, and another host: none may survive.
		expect(groups.structured?.["groups"]).toEqual([
			{ group: "resources", count: 1 },
			{ group: "best-practices", count: 1 },
			{ group: "articles", count: 3 },
			{ group: "guides", count: 1 },
			{ group: "webinars", count: 1 },
			{ group: "webinar-series", count: 1 },
		]);
		const r = await call("list_pages", {
			source: "claude-resources",
			section: "Articles",
		});
		const pages = pagesOf(r);
		expect(pages.map((x) => x.route)).toEqual([
			"resources/articles",
			PAGE,
			"resources/articles/agent-patterns",
		]);
		expect(pages.map((x) => x.description).join(" ")).toContain("2026-10-27");
		const de = await call("list_pages", {
			source: "claude-resources",
			section: "de",
		});
		expect(de.error).toBe(true);
	});

	test("search matches slug words and filters by section", async () => {
		const { call } = await start();
		const s = await call("search_docs", {
			source: "claude-resources",
			query: "duet",
		});
		expect(s.error).toBe(false);
		expect(s.text).toContain(PAGE);
		expect(s.text).toContain("Claude Duet");
		expect(sourceOf(s).origin).toMatch(/^127\.0\.0\.1:\d+$/u);
		const guides = await call("search_docs", {
			source: "claude-resources",
			query: "agents",
			section: "guides",
		});
		expect(guides.text).toContain("resources/guides/building-agents");
		expect(guides.text).not.toContain("webinars/agents-live");
		expect(guides.text).not.toContain("/de/");
	});

	test("read keeps the article body and drops the chrome", async () => {
		const { call, p } = await start();
		const r = await call("read_page", {
			source: "claude-resources",
			route: PAGE,
		});
		expect(r.error).toBe(false);
		expect(r.text).toContain("Introducing Claude Duet");
		expect(r.text).toContain("Narwhal");
		expect(r.text).toContain(
			`[agent guide](${p.url}/resources/guides/building-agents)`,
		);
		expect(r.text).toContain("- Prompt **chaining**");
		expect(r.text).toContain("```\nif (a < b) {");
		expect(r.text).not.toMatch(/JUNK|__next_f|<[a-z]/u);
	});

	test("read one heading, and an offset past the end", async () => {
		const { call } = await start();
		const sec = await call("read_page", {
			source: "claude-resources",
			route: `/${PAGE}`,
			section_heading: "Patterns",
		});
		expect(sec.text).toContain("Routing");
		expect(sec.text).not.toContain("Narwhal");
		const past = await call("read_page", {
			source: "claude-resources",
			route: PAGE,
			offset: 100_000,
		});
		expect(past.error).toBe(true);
	});

	test("rejects locale, other-section, and other-host paths without a request", async () => {
		const { call, p } = await start();
		const bad = [
			"de/resources/articles/claude-duet",
			"ja/resources",
			"pricing",
			"resources-archive/old",
			"../x",
			"resources/../pricing",
			"resources/Articles",
			"resources/.hidden",
			"https://evil.example/resources/articles/evil",
			"//evil.example/resources",
			"/",
			"",
		];
		const answers = await Promise.all(
			bad.map((route) =>
				call("read_page", { source: "claude-resources", route }),
			),
		);
		expect(answers.map((r) => r.error)).toEqual(bad.map(() => true));
		expect(p.hits.length).toBe(0);
		const full = await call("read_page", {
			source: "claude-resources",
			route: `${p.url}/${PAGE}`,
		});
		expect(full.error).toBe(false);
	});

	test("the hub page is requested without a trailing slash", async () => {
		const { call, p } = await start();
		const r = await call("read_page", {
			source: "claude-resources",
			route: "resources/",
		});
		// The mock has no hub page: the answer is a clean 404, and no request ended in a slash.
		expect(r.error).toBe(true);
		expect(p.hits.some((h) => h.path === "/resources")).toBe(true);
		expect(p.hits.some((h) => /^\/.+\/$/u.test(h.path))).toBe(false);
	});

	test("a missing page lists the closest matches", async () => {
		const { call } = await start();
		const missing = await call("read_page", {
			source: "claude-resources",
			route: "resources/articles/duet",
		});
		expect(missing.error).toBe(true);
		expect(missing.text).toContain(PAGE);
	});

	test("anthropic is no source: the error lists the valid ones", async () => {
		const { call } = await start();
		const r = await call("search_docs", { source: "anthropic", query: "duet" });
		expect(r.error).toBe(true);
		expect(r.text).toContain("claude-resources");
	});

	test("offline: cached copy is served, uncached page is an error", async () => {
		const { call, p } = await start({ CLAWDIPEDIA_TTL_SCALE: "0" });
		await call("read_page", { source: "claude-resources", route: PAGE });
		await call("list_pages", { source: "claude-resources" });
		await p.stop();
		const r = await call("read_page", {
			source: "claude-resources",
			route: PAGE,
		});
		expect(r.error).toBe(false);
		expect(r.text).toContain("Narwhal");
		const l = await call("list_pages", { source: "claude-resources" });
		expect(l.error).toBe(false);
		expect(sourceOf(l).state).toBe("stale-offline");
		const other = await call("read_page", {
			source: "claude-resources",
			route: "resources/guides/building-agents",
		});
		expect(other.error).toBe(true);
	});

	test("offline with nothing cached is an error", async () => {
		const p = mockClaudeResources();
		await p.stop();
		const { call } = await connect({ CLAUDE_RESOURCES_BASE_URL: p.url });
		const r = await call("search_docs", {
			source: "claude-resources",
			query: "duet",
		});
		expect(r.error).toBe(true);
	});
});
