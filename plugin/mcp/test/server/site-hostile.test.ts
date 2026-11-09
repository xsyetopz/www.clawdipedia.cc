// Hostile-site tests for the docs server: bad manifest entries and bad base URLs. Part of: bun test plugin/mcp/test
import { afterAll, describe, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { cleanup, connect, stops, tempDir } from "./harness.ts";

afterAll(cleanup);

const entry = (base: string, route: string) => ({
	route,
	title: `T ${route}`,
	description: "d",
	section: "S",
	md: `${base}${route}.md`,
	url: `${base}${route}`,
});

const hostileManifest = (base: string): string =>
	JSON.stringify([
		entry(base, "/zzfreshpage"),
		entry(base, "/../../../../tmp/pwned"),
		entry(base, "/a/../../x"),
		{ ...entry(base, "/evilurl"), url: "https://evil.example/x" },
		{ route: 5 },
		null,
		entry(base, "/dotted.md"),
	]);

const ALLOWED = new Set([
	"/llms-manifest.json",
	"/zzfreshpage.md",
	"/llms.txt",
	"/llms-search-index.json",
]);

const runBaseUrl = async (value: string) => {
	const fetcher = join(import.meta.dir, "..", "..", "src", "fetcher.ts");
	const proc = Bun.spawn(
		[
			"bun",
			"-e",
			`import { baseUrl } from ${JSON.stringify(fetcher)};console.info(baseUrl("X_BASE", "https://default.example"));`,
		],
		{ env: { ...process.env, X_BASE: value }, stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout: stdout.trim(), stderr };
};

const hostileServer = (hits: string[]) =>
	Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch(req) {
			const { pathname, origin } = new URL(req.url);
			hits.push(pathname);
			if (pathname === "/llms-manifest.json") {
				return new Response(hostileManifest(origin));
			}
			if (pathname === "/zzfreshpage.md") {
				return new Response(
					"---\ntitle: F\n---\n\n# Fresh\nquokkaquokka marker\n",
				);
			}
			return new Response("no", { status: 404 });
		},
	});

describe("hostile site", () => {
	test("rejects bad entries and keeps paths inside the cache", async () => {
		const hits: string[] = [];
		const srv = hostileServer(hits);
		stops.push(() => srv.stop(true));
		const cache = await tempDir();
		const { call } = await connect({
			CLAWDIPEDIA_CACHE_DIR: cache,
			CLAWDIPEDIA_BASE_URL: `http://127.0.0.1:${srv.port}`,
		});
		const list = await call("list_pages", {});
		expect(list.text).toContain("zzfreshpage");
		expect(list.text).not.toMatch(/pwned|evilurl|dotted|\.\./u);
		const read = await call("read_page", { route: "zzfreshpage" });
		expect(read.text).toContain("quokkaquokka");
		const search = await call("search_docs", { query: "quokkaquokka" });
		expect(search.text).toContain("zzfreshpage");
		const escape = await call("read_page", { route: "../../../../tmp/pwned" });
		expect(escape.error).toBe(true);
		expect(hits.every((h) => ALLOWED.has(h))).toBe(true);
		const names = await readdir(cache, { recursive: true });
		const files = names.map(String);
		expect(files.filter((f) => !f.endsWith(".meta.json")).toSorted()).toEqual([
			"site",
			"site/llms-manifest.json",
			"site/pages",
			"site/pages/zzfreshpage.md",
		]);
	});

	test("a non-https remote site is ignored with a warning", async () => {
		const bad = await Promise.all(
			["http://evil.example", "ftp://x", "nonsense"].map((v) => runBaseUrl(v)),
		);
		for (const r of bad) {
			expect(r.stdout).toBe("https://default.example");
			// The warning names the variable; its wording is not pinned.
			expect(r.stderr).toContain("X_BASE");
		}
		const good = await Promise.all(
			["http://127.0.0.1:9/", "https://mirror.example/"].map((v) =>
				runBaseUrl(v),
			),
		);
		expect(good.map((r) => r.stdout)).toEqual([
			"http://127.0.0.1:9",
			"https://mirror.example",
		]);
		expect(good.map((r) => r.stderr)).toEqual(["", ""]);
	});
});
