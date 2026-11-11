// Run: bun test inspect/mcp/test/idle.test.ts
import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { program, releaseTrees } from "../src/binary.ts";
import { idleRelease } from "../src/idle.ts";
import { rejection } from "./run-helpers.ts";
import { compile } from "./server-harness.ts";

// The release and a promise that ends at its first run.
const counter = () => {
	const { promise, resolve } = Promise.withResolvers<number>();
	const count = { released: 0, first: promise };
	const release = () => {
		count.released += 1;
		resolve(count.released);
	};
	return { count, release };
};

test("the release waits for the last of the calls that run at once, and for a call that starts in the idle time", async () => {
	const { count, release } = counter();
	const whenIdle = idleRelease(20, release);
	expect(await whenIdle(() => Promise.resolve(7))).toBe(7);
	// Both start before the idle time of the first call ends; the short one ends 20 ms before the long one.
	const long = whenIdle(() => Bun.sleep(80));
	await whenIdle(() => Bun.sleep(1));
	await long;
	expect(count.released).toBe(0);
	expect(await count.first).toBe(1);
});

test("the release runs after a call that fails", async () => {
	const { count, release } = counter();
	const whenIdle = idleRelease(1, release);
	const failed = whenIdle(() => Promise.reject(new Error("no")));
	expect(await rejection(failed)).toMatch(/no/u);
	expect(await count.first).toBe(1);
});

test("a release gives each program a new resolver and new syntax trees, and keeps its module texts", async () => {
	const tmp = await mkdtemp(join(tmpdir(), "cc-inspect-idle-"));
	try {
		await writeFile(join(tmp, "app.mjs"), "globalThis.x = process.env.A;\n");
		// The module in the binary takes the name of the output file.
		await compile(join(tmp, "app.mjs"), join(tmp, "app.js"));
		const p = await program(join(tmp, "app.js"));
		const { resolver, modules } = p;
		const [name = ""] = p.bundle().texts.keys();
		const tree = await p.bundle().get(name);
		expect(tree).toBeDefined();
		releaseTrees();
		expect(p.resolver).not.toBe(resolver);
		expect(p.modules).toBe(modules);
		const again = await p.bundle().get(name);
		expect(again).not.toBe(tree);
		expect(again?.text).toBe(tree?.text);
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
});
