// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(import.meta.dir, "..", "src", "cli.ts");
let tmp = "";
beforeAll(async () => {
	tmp = await mkdtemp(join(tmpdir(), "cc-inspect-cli-"));
	await mkdir(join(tmp, "versions"));
});
afterAll(async () => {
	await rm(tmp, { recursive: true, force: true });
});

const cli = async (...args: string[]) => {
	const proc = Bun.spawn(["bun", CLI, ...args], {
		env: {
			...process.env,
			CC_INSPECT_VERSIONS_DIR: join(tmp, "versions"),
			CC_INSPECT_LAUNCHER: join(tmp, "no-launcher"),
			CC_INSPECT_CACHE: join(tmp, "cache"),
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { stdout, stderr, exitCode };
};

test("cli calls each tool in order and prints its text", async () => {
	const r = await cli(
		"code",
		'{"action":"installs"}',
		"code",
		'{"action":"installs"}',
	);
	expect(r.exitCode).toBe(0);
	expect(r.stdout.match(/^=== code \{"action":"installs"\}$/gmu)).toHaveLength(
		2,
	);
});

test("cli refuses an odd argument count with exit 2", async () => {
	const odd = await cli("code");
	expect(odd.exitCode).toBe(2);
	expect(odd.stderr).toContain("usage:");
});

test("cli refuses bad JSON with exit 2", async () => {
	const bad = await cli("code", "{not json");
	expect(bad.exitCode).toBe(2);
	expect(bad.stderr).toContain("not JSON");
});

test("cli exits 1 when a tool reports an error", async () => {
	const r = await cli("code", '{"action":"read"}');
	expect(r.exitCode).toBe(1);
});
