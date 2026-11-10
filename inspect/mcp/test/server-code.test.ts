// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { describe, expect, test } from "bun:test";
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
	at,
	exists,
	listOf,
	recordOf,
	sorted,
	startServer,
	structured,
	text,
} from "./server-harness.ts";

const { tmp, client, call } = startServer();

describe("binary", () => {
	test("code installs lists the versions dir", async () => {
		const r = await call("code", { action: "installs" });
		expect(structured(r)["installs"]).toMatchObject([
			{ version: "9.9.9", current: false },
		]);
	});

	test("code prepare cleans an install once and then reads the cache", async () => {
		const r = await call("code", { action: "prepare", version: "9.9.9" });
		expect(r.structuredContent).toMatchObject({
			version: "9.9.9",
			parsed: 1,
			dir: join(tmp, "cache", "9.9.9", "clean"),
		});
		expect(structured(r)["units"]).toBeGreaterThan(10);
	});

	test("code search and read find code by a literal anchor", async () => {
		const r = await call("code", {
			action: "search",
			query: '"api_error"',
			version: "9.9.9",
		});
		const [hit] = listOf(
			r,
			"hits",
			z.object({ module: z.string(), offset: z.number() }),
		);
		expect(hit?.module).toBe("app.js");
		const m = await call("code", {
			action: "read",
			module: "app.js",
			offset: hit?.offset,
			length: 11,
		});
		expect(text(m)).toEndWith('"api_error"');
	});

	test("code read with view readable runs Wakaru once, caches it, and pages the text", async () => {
		const fail = join(tmp, "wakaru-fail");
		await writeFile(fail, "");
		const bad = await call("code", {
			action: "read",
			module: "app.js",
			view: "readable",
			version: "9.9.9",
		});
		expect(bad.isError).toBe(true);
		expect(
			await exists(join(tmp, "cache", "9.9.9", "clean", "readable", "app.js")),
		).toBe(false);
		await rm(fail);
		const args = { action: "read", module: "app.js", view: "readable" };
		const cached = join(tmp, "cache", "9.9.9", "clean", "readable", "app.js");
		const empty = join(tmp, "wakaru-empty");
		await writeFile(empty, "");
		const none = await call("code", { ...args, version: "9.9.9" });
		expect(none.isError).toBe(true);
		expect(await exists(cached)).toBe(false);
		await rm(empty);
		// Wakaru gets PATH and HOME only, runs in its own temp folder, and does not hold up other calls.
		const slow = join(tmp, "wakaru-slow");
		await writeFile(slow, "");
		const pending = call("code", { ...args, version: "9.9.9", length: 60 });
		await Bun.sleep(300);
		await call("code", { action: "installs" });
		const other = !(await exists(cached));
		const a = await pending;
		await rm(slow);
		expect(other).toBe(true);
		// A boolean, so a failure does not print the environment.
		const env = await Bun.file(join(tmp, "wakaru-env")).text();
		expect(env.includes("CC_INSPECT_TEST_SECRET")).toBe(false);
		const cwdText = await Bun.file(join(tmp, "wakaru-cwd")).text();
		const cwd = cwdText.trim();
		expect(cwd).not.toBe(await realpath(process.cwd()));
		expect(await exists(cwd)).toBe(false);
		expect(text(a)).toContain("--formatter");
		expect(structured(a)["text"]).toContain("--formatter");
		const b = await call("code", {
			...args,
			version: "9.9.9",
			offset: 20,
			length: 30,
		});
		expect(structured(b)["text"]).toBe(
			String(structured(a)["text"]).slice(20, 50),
		);
		expect(await Bun.file(cached).text()).toStartWith("// readable:");
		expect(await Bun.file(join(tmp, "wakaru-runs")).text()).toBe(
			"run\nrun\nrun\n",
		);
	});

	test("code citations lists the chunk citations of a folder that the build lacks", async () => {
		const dir = join(tmp, "docs");
		await mkdir(join(dir, "sub"), { recursive: true });
		await writeFile(
			join(dir, "sub", "a.md"),
			"x\nSee `chunk-aaaaaaaa.js:5`.\n",
		);
		await writeFile(join(dir, "b.md"), "No citation.\n");
		const r = await call("code", {
			action: "citations",
			dir,
			version: "9.9.9",
		});
		expect(structured(r)["stale"]).toEqual([
			{
				file: join("sub", "a.md"),
				line: 2,
				citation: "chunk-aaaaaaaa.js:5",
				chunk: "chunk-aaaaaaaa.js",
			},
		]);
		expect(text(r)).toContain("sub/a.md:2: chunk-aaaaaaaa.js:5");
		const none = await call("code", { action: "citations", version: "9.9.9" });
		expect(none.isError).toBe(true);
	});

	test("surface object-keys follows a spread into a function", async () => {
		const r = await call("surface", {
			kind: "object-keys",
			module: "app.js",
			anchor: '"Bash"',
		});
		expect(r.structuredContent).toEqual({
			keys: {
				tool_name: { const: "Bash" },
				success: { const: "true" },
				"tool.kind": { enum: ["a", "b"] },
			},
			unresolved: [],
		});
	});

	test("surface event-keys merges the call sites of one event", async () => {
		const list = await call("surface", { kind: "event-keys" });
		expect(structured(list)["events"]).toEqual({
			api_error: 1,
			tool_result: 2,
		});
		const r = await call("surface", {
			kind: "event-keys",
			name: "claude_code.tool_result",
		});
		expect(r.structuredContent).toMatchObject({ sites: 2 });
		expect(sorted(Object.keys(recordOf(r, "keys")))).toEqual([
			"duration_ms?",
			"success?",
			"tool.kind?",
			"tool_name",
		]);
	});

	test("surface tool-gates gives each base tool with its gate and the gate's functions", async () => {
		const r = await call("surface", { kind: "tool-gates" });
		const tools = listOf(
			r,
			"tools",
			z.object({
				name: z.string(),
				when: z.array(z.string()),
				enabled: z.string().optional(),
			}),
		);
		expect(tools.map((t) => [t.name, t.when.length])).toEqual([
			["Shell", 0],
			["Glob", 1],
			["Grep", 1],
			["CronCreate", 1],
		]);
		expect(tools[1]?.when[0]).toContain(".has(");
		expect(tools.map((t) => t.enabled !== undefined)).toEqual([
			false,
			false,
			true,
			false,
		]);
		expect(tools[2]?.enabled).toContain("process.env.GREP");
		const fns = Object.values(recordOf(r, "functions"));
		expect(fns.some((s) => String(s).includes("process.env.LEAN"))).toBe(true);
	});
});

describe("find and prompts", () => {
	test("code find ranks the unit that holds the query words first", async () => {
		const r = await call("code", {
			action: "find",
			query: "sleep seconds blocked",
			version: "9.9.9",
		});
		const [top] = listOf(r, "found", z.object({ hits: z.array(z.string()) }));
		expect(top?.hits).toEqual(["sleep", "seconds", "blocked"]);
		expect(text(r)).toContain("/^sleep");
		// the model sees only structuredContent, so the excerpt must be in it
		expect(JSON.stringify(r.structuredContent)).toContain("/^sleep");
	});

	test("code cli needs args and an installed version", async () => {
		const none = await call("code", { action: "cli", version: "9.9.9" });
		expect(none.isError).toBe(true);
		expect(text(none)).toContain("args");
		const gone = await call("code", {
			action: "cli",
			args: ["--version"],
			version: "0.0.1",
		});
		expect(gone.isError).toBe(true);
		expect(text(gone)).toContain("installed: 9.9.9");
	});

	test("prompts/list gives the release and explain prompts", async () => {
		const { prompts } = await client.listPrompts();
		expect(sorted(prompts.map((p) => p.name))).toEqual([
			"explain_change",
			"release_review",
		]);
		const p = await client.getPrompt({
			name: "release_review",
			arguments: { from: "1.0.0", to: "1.0.1" },
		});
		const t = z
			.object({ text: z.string() })
			.parse(at(p.messages, 0).content).text;
		// The step that runs `notes` names both versions.
		const step = t.split("\n").find((l) => l.includes("`notes`"));
		expect(step).toContain("1.0.1");
		expect(step).toContain("1.0.0");
	});
});
