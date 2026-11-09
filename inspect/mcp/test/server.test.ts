// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { describe, expect, test } from "bun:test";

import { sorted, startServer } from "./server-harness.ts";

const { client, call } = startServer();

describe("tools", () => {
	test("the server offers 4 tools, each with a one-sentence description", async () => {
		const { tools } = await client.listTools();
		expect(sorted(tools.map((t) => t.name))).toEqual([
			"code",
			"release",
			"sessions",
			"surface",
		]);
		for (const t of tools) {
			expect(t.description?.match(/[.!?](\s|$)/gu)).toHaveLength(1);
		}
		// `code` reaches npm for the readable view, and `release` runs `gh`.
		const open = tools.filter((t) => t.annotations?.openWorldHint === true);
		expect(sorted(open.map((t) => t.name))).toEqual(["code", "release"]);
	});

	test("an inherited name such as constructor is an unknown action", async () => {
		const r = await call("release", { action: "constructor" });
		expect(r.isError).toBe(true);
		expect(r.content[0]?.text).toBe(
			'Error: unknown action "constructor"; actions: diff, notes, explain',
		);
	});

	test("an unknown action is an error that lists the actions", async () => {
		const r = await call("sessions", { action: "nope" });
		expect(r.isError).toBe(true);
		expect(r.content[0]?.text).toBe(
			'Error: unknown action "nope"; actions: list, read, search, validate, tool-calls',
		);
	});
});
