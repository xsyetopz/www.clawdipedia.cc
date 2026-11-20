// Run: bun test inspect/mcp/test/binary-fetch.test.ts
// `binaryPath` fetches a release that is not installed from the native npm package, through a fake registry on localhost.
import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { rejection } from "./run-helpers.ts";

const work = await mkdtemp(join(tmpdir(), "cc-inspect-bin-"));
const cache = join(work, "cache");
const versions = join(work, "versions");
await mkdir(join(work, "src", "package"), { recursive: true });
await mkdir(versions);
await Bun.write(join(work, "src", "package", "claude"), "native binary");
await Bun.$`tar -czf ${join(work, "p.tgz")} -C ${join(work, "src")} package`;
const tgz = new Uint8Array(await Bun.file(join(work, "p.tgz")).arrayBuffer());
const integrity = `sha512-${createHash("sha512").update(tgz).digest("base64")}`;

process.env["CC_INSPECT_CACHE"] = cache;
process.env["CC_INSPECT_VERSIONS_DIR"] = versions;
process.env["CC_INSPECT_LAUNCHER"] = join(work, "no-launcher");
const requested: string[] = [];
const registry = Bun.serve({
	port: 0,
	fetch: (req): Response => {
		const path = new URL(req.url).pathname;
		requested.push(path);
		if (path === "/p.tgz") {
			return new Response(tgz);
		}
		if (path.endsWith("/9.8.7")) {
			return Response.json({
				version: "9.8.7",
				dist: { tarball: `${registry.url.origin}/p.tgz`, integrity }
			});
		}
		return new Response("no", { status: 404 });
	}
});
process.env["CC_INSPECT_NPM_REGISTRY"] = registry.url.origin;
const { binaryPath, nativePackage } = await import("../src/binary.ts");
afterAll(async () => {
	await registry.stop(true);
	await rm(work, { recursive: true, force: true });
});

test("names the native package of a platform", () => {
	const name = nativePackage("darwin", "arm64");

	expect(name).toBe("@anthropic-ai/claude-code-darwin-arm64");
});

test("a release that is not installed comes from its native npm package", async () => {
	const path = await binaryPath("9.8.7");

	expect(await Bun.file(path).text()).toBe("native binary");
	expect(requested).toContain(`/${nativePackage().replace("/", "%2f")}/9.8.7`);
});

test("a release npm does not have names the installs and the npm error", async () => {
	const message = await rejection(binaryPath("0.0.1"));

	expect(message).toMatch(/no install "0\.0\.1"; installed: .*; npm: /u);
});

test("a name that is not a release version is still an error", async () => {
	const message = await rejection(binaryPath("not-a-version"));

	expect(message).toMatch(/no install "not-a-version"/u);
});
