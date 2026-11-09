// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { describe, expect, test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import {
	APP,
	compile,
	listOf,
	startServer,
	structured,
	text,
} from "./server-harness.ts";

const { tmp, call } = startServer();

describe("release", () => {
	test("release notes marks each line from the cached notes", async () => {
		await mkdir(join(tmp, "cache", "9.9.9"), { recursive: true });
		await writeFile(
			join(tmp, "cache", "9.9.9", "notes.md"),
			"- Fixed `tengu_example_gate` handling\n- [Cloud sessions] Improved the checklist view\n",
		);
		const r = await call("release", {
			action: "notes",
			version: "9.9.9",
			from: "9.9.9",
		});
		expect(
			listOf(r, "lines", z.object({ status: z.string() })).map((l) => l.status),
		).toEqual(["unmatched", "unmatched"]);
		const none = await call("release", { action: "notes", version: "9.9.9" });
		expect(text(none)).toBe("Error: no install older than 9.9.9; give from");
	});

	test("release diff of one install with itself has no change", async () => {
		const r = await call("release", {
			action: "diff",
			from: "9.9.9",
			to: "9.9.9",
		});
		expect(structured(r)["counts"]).toEqual({
			changed: 0,
			added: 0,
			gone: 0,
		});
	});

	test("release diff puts each listed change in the structured data", async () => {
		await writeFile(
			join(tmp, "app2.mjs"),
			APP.replace('process.env.GREP === "1"', 'process.env.GREP === "2"'),
		);
		await compile(join(tmp, "app2.mjs"), join(tmp, "app2.js"));
		const r = await call("release", {
			action: "diff",
			from: join(tmp, "app.js"),
			to: join(tmp, "app2.js"),
		});
		const place = z.object({ module: z.string(), offset: z.number() });
		const changes = listOf(
			r,
			"changes",
			z.object({
				kind: z.string(),
				from: place.optional(),
				to: place.optional(),
				diff: z.array(z.string()),
			}),
		);
		const grep = changes.find((c) => c.diff.join("\n").includes('"2"'));
		expect(grep?.kind).toBe("changed");
		expect(typeof grep?.from?.offset).toBe("number");
		expect(typeof grep?.to?.module).toBe("string");
	}, 60_000);
});
