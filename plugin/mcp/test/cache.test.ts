// Unit tests for the disk cache: eviction order under the size cap.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DiskCache } from "../src/cache.ts";

const V = { url: "http://x/" };
const dirs: string[] = [];
afterEach(async () => {
	delete process.env["CLAWDIPEDIA_CACHE_CAP_BYTES"];
	await Promise.all(
		dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
	);
});

const put = async (c: DiskCache, rel: string, n: number) => {
	await Bun.sleep(3);
	await c.put(rel, "x".repeat(n), V);
};

const scenario = async (c: DiskCache) => {
	await put(c, "platform/llms.txt", 10);
	await put(c, "site/llms-manifest.json", 10);
	await put(c, "site/pages/a.md", 100);
	await put(c, "platform/pages/old.md", 100);
	await put(c, "platform/pages/new.md", 100);
	// 320 bytes: under the cap of 350, nothing is evicted yet.
	expect(await c.get("platform/pages/old.md")).toBeDefined();
	await put(c, "platform/pages/newer.md", 100);
	// Over the cap: the oldest platform page goes first.
	expect(await c.get("platform/pages/old.md")).toBeUndefined();
	expect(await c.get("platform/pages/new.md")).toBeDefined();
	await put(c, "site/pages/b.md", 200);
	// Still over: the remaining platform pages go before any site page.
	expect(await c.get("platform/pages/new.md")).toBeUndefined();
	expect(await c.get("platform/pages/newer.md")).toBeUndefined();
	expect(await c.get("site/pages/a.md")).toBeDefined();
	expect(await c.get("site/pages/b.md")).toBeDefined();
	expect(await c.get("platform/llms.txt")).toBeDefined();
	expect(await c.get("site/llms-manifest.json")).toBeDefined();
};

describe("cache cap", () => {
	test("disk: oldest platform pages go first, index files stay", async () => {
		const root = await mkdtemp(join(tmpdir(), "ccdocs-cache-"));
		dirs.push(root);
		process.env["CLAWDIPEDIA_CACHE_CAP_BYTES"] = "350";
		await scenario(await DiskCache.open(root));
	});
	test("memory fallback follows the same order", async () => {
		process.env["CLAWDIPEDIA_CACHE_CAP_BYTES"] = "350";
		await scenario(await DiskCache.open("/proc/nonexistent/cache"));
	});
});
