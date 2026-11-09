// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { describe, expect, test } from "bun:test";
import { stat } from "node:fs/promises";
import { join } from "node:path";

import { KINDS } from "../src/surface/index.ts";
import {
	at,
	byCode,
	type Result,
	startServer,
	text,
} from "./server-harness.ts";

const { tmp, call } = startServer();

const lines = (r: Result) => text(r).split("\n").slice(1);

const state = async (dir: string) => {
	const files = await Array.fromAsync(
		new Bun.Glob("**/*").scan({ cwd: dir, dot: true }),
	);
	const rows = await Promise.all(
		files.map(async (f) => {
			const s = await stat(join(dir, f));
			return `${f}:${s.size}:${s.mtimeMs}`;
		}),
	);
	return rows.toSorted(byCode);
};

describe("surface", () => {
	test("surface lists one kind with module and offset", async () => {
		const r = await call("surface", { kind: "env", version: "9.9.9" });
		expect(r.isError).toBeUndefined();
		expect(r.structuredContent).toBeUndefined();
		expect(
			lines(r).filter((l) =>
				/^- CLAUDE_CODE_USE_BEDROCK .*\S+\.js:\d+$/u.test(l),
			),
		).toHaveLength(1);
	});

	test("surface filters by name", async () => {
		const r = await call("surface", { kind: "env", name: "BEDROCK" });
		const names = lines(r).map((l) => at(l.split(" "), 1));
		expect(names.toSorted(byCode)).toEqual([
			"ANTHROPIC_BEDROCK_BASE_URL",
			"CLAUDE_CODE_USE_BEDROCK",
		]);
	});

	test("surface pages with limit and offset", async () => {
		const r = await call("surface", { kind: "env", limit: 1 });
		expect(text(r)).toMatch(/^env: items 1-1 of \d+, next_offset 1/u);
		expect(lines(r)).toHaveLength(1);
	});

	test("surface cuts a long reply at a line and gives the offset to continue", async () => {
		const r = await call("surface", {
			kind: "env",
			name: "FIXTURE_LONG",
			limit: 400,
		});
		const t = text(r);
		expect(t.length).toBeLessThanOrEqual(40_000);
		const next = /next_offset (\d+)/u.exec(t);
		expect(next).not.toBeNull();
		const shown = lines(r).filter((l) => l.startsWith("- "));
		expect(Number(next?.[1])).toBe(shown.length);
		expect(shown.every((l) => /\S+\.js:\d+$/u.test(l))).toBe(true);
		const rest = await call("surface", {
			kind: "env",
			name: "FIXTURE_LONG",
			limit: 400,
			offset: Number(next?.[1]),
		});
		const more = lines(rest).filter((l) => l.startsWith("- "));
		expect(more.length).toBeGreaterThan(0);
		expect(shown).not.toContain(at(more, 0));
	});

	test("surface without kind gives each kind with its count", async () => {
		const r = await call("surface");
		const t = text(r);
		for (const k of ["env", "flag", "gate", "tool", "mod-api"]) {
			expect(t).toMatch(new RegExp(`^- ${k}: (\\d+|error: .+)$`, "mu"));
		}
		expect(t).toMatch(/^- tool: 4$/mu);
	});

	test("surface errors name the kinds and the installs", async () => {
		const k = await call("surface", { kind: "nope" });
		expect(k.isError).toBe(true);
		const t = text(k);
		expect(t).toContain("nope");
		// The reply lists every kind the server accepts, so a caller recovers from a wrong one without
		// another request. KINDS is the source of that list, so this fails if the list stops being sent.
		for (const kind of Object.keys(KINDS)) {
			expect(t).toContain(kind);
		}
		const b = await call("surface", { kind: "env", version: "0.0.1" });
		expect(b.isError).toBe(true);
		expect(text(b)).toContain("9.9.9");
	});

	test("surface writes no file", async () => {
		const before = await state(tmp);
		await call("surface");
		await call("surface", { kind: "env" });
		expect(await state(tmp)).toEqual(before);
	});
});
