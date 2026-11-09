// claude-resources.ts: parseSitemap and normalizeClaudeResourcesPath.
import { describe, expect, test } from "bun:test";

import {
	normalizeClaudeResourcesPath,
	parseSitemap,
} from "../src/claude-resources.ts";

const BASE = "https://claude.com";
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

describe("parseSitemap", () => {
	test("reads loc and lastmod of the same url and keeps the first repeat", () => {
		const xml = `<urlset xmlns="${NS}">
      <url><loc>${BASE}/resources/guides/a?x=1&amp;y=2</loc></url>
      <url><loc>${BASE}/resources/articles/b</loc><lastmod>2025-01-02</lastmod></url>
      <url><loc>${BASE}/resources/articles/b</loc><lastmod>2030-01-01</lastmod></url>
    </urlset>`;
		const got = parseSitemap(xml, BASE);
		expect(got.map((e) => [e.path, e.lastmod])).toEqual([
			["resources/guides/a", ""],
			["resources/articles/b", "2025-01-02"],
		]);
		expect(got[1]).toMatchObject({
			title: "B",
			section: "articles",
			url: `${BASE}/resources/articles/b`,
		});
	});

	test("keeps only paths under resources and drops locale copies and other sections", () => {
		const locs = [
			"/resources",
			"/resources/best-practices",
			"/resources/webinar-series/s",
			"/de/resources/articles/x",
			"/ja/resources",
			"/resources-archive/old",
			"/pricing",
			"/",
		];
		const xml = `<urlset xmlns="${NS}">${locs
			.map((l) => `<url><loc>${BASE}${l}</loc></url>`)
			.join(
				"",
			)}<url><loc>https://evil.example/resources/x</loc></url></urlset>`;
		expect(parseSitemap(xml, BASE).map((e) => [e.path, e.section])).toEqual([
			["resources", "resources"],
			["resources/best-practices", "best-practices"],
			["resources/webinar-series/s", "webinar-series"],
		]);
	});

	test("accepts prefixed element names", () => {
		const xml = `<ns:urlset xmlns:ns="${NS}"><ns:url><ns:loc>${BASE}/resources</ns:loc><ns:lastmod>2025-03-04</ns:lastmod></ns:url></ns:urlset>`;
		expect(parseSitemap(xml, BASE)).toEqual([
			{
				path: "resources",
				title: "Resources",
				section: "resources",
				lastmod: "2025-03-04",
				url: `${BASE}/resources`,
			},
		]);
	});

	test("returns [] for malformed XML", () => {
		expect(parseSitemap("<urlset><url><loc>", BASE)).toEqual([]);
	});
});

describe("normalizeClaudeResourcesPath", () => {
	test("accepts a path, a slash form, a trailing slash, and the full URL", () => {
		for (const input of [
			"resources/articles/x",
			"/resources/articles/x/",
			`${BASE}/resources/articles/x?a=1#h`,
		]) {
			expect(normalizeClaudeResourcesPath(input)).toBe("resources/articles/x");
		}
		expect(normalizeClaudeResourcesPath("resources/")).toBe("resources");
	});

	test("rejects an empty path, a locale, and a path outside resources", () => {
		for (const input of ["", "/", "ja/resources/x", "pricing", "resources-x"]) {
			expect(normalizeClaudeResourcesPath(input)).toBeUndefined();
		}
	});
});
