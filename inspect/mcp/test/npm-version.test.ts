// Run: bun test inspect/mcp/test/npm-version.test.ts
// `versionAt` picks the release that was current at a time, from a fake registry on localhost.
import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const cache = await mkdtemp(join(tmpdir(), "cc-inspect-ver-"));
process.env["CC_INSPECT_CACHE"] = cache;
let hits = 0;
const registry = Bun.serve({
	port: 0,
	fetch: (req): Response => {
		if (new URL(req.url).pathname !== "/@fx%2fv") {
			return new Response("no", { status: 404 });
		}
		hits++;
		return Response.json({
			time: {
				created: "2020-01-01T00:00:00Z",
				"1.0.0": "2024-01-01T00:00:00Z",
				"1.5.0": "2024-06-01T00:00:00Z",
				"1.6.0-beta.1": "2024-07-01T00:00:00Z",
				"2.0.0": "2024-08-01T00:00:00Z",
				"1.7.0": "2025-03-01T00:00:00Z",
			},
		});
	},
});
process.env["CC_INSPECT_NPM_REGISTRY"] = registry.url.origin;
const { versionAt, linesAt } = await import("../src/npm.ts");
afterAll(async () => {
	await registry.stop(true);
	await rm(cache, { recursive: true, force: true });
});

test("the highest release in every range that was published before the time", async () => {
	expect(await versionAt("@fx/v", "2024-12-01T00:00:00Z", ["^1.0.0"])).toEqual({
		version: "1.5.0",
		from: "range-max",
	});
	expect(
		await versionAt("@fx/v", "2025-12-01T00:00:00Z", ["^1.0.0", "<1.7.0"]),
	).toEqual({ version: "1.5.0", from: "range-max" });
});

test("with no range, or none that fits, the release published last before the time", async () => {
	expect(await versionAt("@fx/v", "2024-12-01T00:00:00Z")).toEqual({
		version: "2.0.0",
		from: "dated",
	});
	expect(await versionAt("@fx/v", "2024-12-01T00:00:00Z", ["^9.0.0"])).toEqual({
		version: "2.0.0",
		from: "dated",
	});
});

test("nothing was published before the time", async () => {
	expect(await versionAt("@fx/v", "2023-01-01T00:00:00Z")).toBeUndefined();
});

test("the packument is fetched once and kept", async () => {
	await versionAt("@fx/v", "2024-12-01T00:00:00Z");
	await versionAt("@fx/v", "2025-12-01T00:00:00Z");
	expect(hits).toBe(1);
});

test("a package the registry does not know is an error that names the status", async () => {
	const error = await versionAt("@fx/none", "2025-01-01T00:00:00Z").catch(
		(error_: unknown) => error_,
	);
	expect(error).toBeInstanceOf(Error);
	expect(String(error)).toContain("HTTP 404");
});

test("the highest release of each major that was published before the time", async () => {
	expect(await linesAt("@fx/v", "2025-12-01T00:00:00Z")).toEqual([
		"1.7.0",
		"2.0.0",
	]);
	expect(await linesAt("@fx/v", "2024-12-01T00:00:00Z")).toEqual([
		"1.5.0",
		"2.0.0",
	]);
});

test("with a major, the highest release of each minor of it", async () => {
	expect(await linesAt("@fx/v", "2025-12-01T00:00:00Z", "1")).toEqual([
		"1.0.0",
		"1.5.0",
		"1.7.0",
	]);
});
