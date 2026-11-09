// The evaluation file: its shape, the tools and actions it names, and the fixture it reads.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { KINDS } from "../src/surface/index.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const xml = await Bun.file(
	join(import.meta.dir, "..", "evaluation.xml"),
).text();
const between = (text: string, tag: string): string => {
	const open = `<${tag}>`;
	return text.slice(
		text.indexOf(open) + open.length,
		text.indexOf(`</${tag}>`),
	);
};
const chunks = xml.split("<qa_pair>").slice(1);
const pairs = chunks.map((c) => ({
	q: between(c, "question"),
	a: between(c, "answer"),
}));
const all = pairs.map((p) => p.q).join("\n");
const captures = (re: RegExp): string[] =>
	Array.from(all.matchAll(re), (m) => m.slice(1).join(""));

describe("inspect/mcp/evaluation.xml", () => {
	test("every qa_pair has a question and an answer", () => {
		expect(pairs.length).toBe(xml.split("<qa_pair>").length - 1);
		for (const p of pairs) {
			expect(p.q.trim()).not.toBe("");
			expect(p.a.trim()).not.toBe("");
		}
	});

	test("questions are distinct", () => {
		expect(new Set(pairs.map((p) => p.q)).size).toBe(pairs.length);
	});

	test.each(["code", "surface", "sessions", "release"])(
		"exercises the %s tool",
		(tool) => {
			expect(all).toContain(`Use ${tool} `);
		},
	);

	test.each(["search", "read", "modules", "tool-calls", "diff"])(
		"exercises the %s action",
		(action) => {
			expect(all).toContain(`action "${action}"`);
		},
	);

	test("every kind that a question passes is a kind of surface", () => {
		const kinds = captures(/kind "([^"]+)"/gu);
		expect(kinds.length).toBeGreaterThan(0);
		for (const k of kinds) {
			expect(Object.keys(KINDS)).toContain(k);
		}
	});

	test("the transcript fixture that sessions questions read exists", async () => {
		const paths = captures(/session "([^"]+\.jsonl)"/gu);
		expect(paths.length).toBeGreaterThan(0);
		const found = await Promise.all(
			paths.map((p) => Bun.file(join(ROOT, p)).exists()),
		);
		expect(found.every(Boolean)).toBe(true);
	});
});
