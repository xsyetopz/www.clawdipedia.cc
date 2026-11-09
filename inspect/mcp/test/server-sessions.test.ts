// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { listOf, seen, SESSION, startServer } from "./server-harness.ts";

const { call } = startServer();

describe("sessions", () => {
	test("sessions list finds the session under CLAUDE_CONFIG_DIR", async () => {
		const r = await call("sessions", { action: "list" });
		const s = listOf(
			r,
			"sessions",
			z.object({ id: z.string(), project: z.string() }),
		);
		expect(s.map((x) => [x.id, x.project])).toEqual([[SESSION, "-tmp-demo"]]);
	});

	test("sessions read pages and filters by type", async () => {
		// Claude Code 2.1.309 (`ds` in chunk-gf8e163f.js) shows the model only structuredContent when set.
		const r = await call("sessions", {
			action: "read",
			session: "1111",
			limit: 1,
		});
		// Only the range, the total, the next_offset field, and the first line are pinned.
		expect(seen(r)).toMatch(/1-1 of 4\D.*next_offset 1\n1: \{/u);
		const t = await call("sessions", {
			action: "read",
			session: SESSION,
			type: "last-prompt",
		});
		expect(seen(t)).toMatch(
			/of 1 with type "last-prompt"\n\d+: \{.*last-prompt/u,
		);
	});

	test("sessions search returns the line of a match", async () => {
		const r = await call("sessions", { action: "search", query: "Fixture" });
		expect(r.structuredContent?.["hits"]).toMatchObject([
			{ session: SESSION, line: 1, type: "custom-title" },
		]);
	});

	test("sessions validate fails wrong types, unknown types, and non-JSON lines", async () => {
		const r = await call("sessions", { action: "validate", session: SESSION });
		const failures = listOf(r, "failures", z.object({ line: z.number() }));
		expect(r.structuredContent?.["failed"]).toBe(3);
		expect(failures.map((f) => f.line)).toEqual([2, 3, 4]);
	});

	test("an unknown session is a tool error", async () => {
		const r = await call("sessions", {
			action: "read",
			session: "nope",
		});
		expect(r.isError).toBe(true);
	});
});
