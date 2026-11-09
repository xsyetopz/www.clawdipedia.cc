// The evaluation file: its shape, the tools and arguments it names, and the docs routes it reads.
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { DOC_SOURCES } from "../src/core/shared.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
const xml = await Bun.file(
	join(import.meta.dir, "..", "evaluation.xml"),
).text();
const fromXml = (t: string) =>
	t.replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
const exists = (path: string) => Bun.file(path).exists();
/** True when the docs route names a page under docs/. */
const isDocsPage = async (r: string) => {
	const candidates = [
		join(ROOT, "docs", `${r}.md`),
		join(ROOT, "docs", r, "index.md"),
		// a folder page named like its folder, such as prompts/tools/tools.md
		join(ROOT, "docs", r, `${r.split("/").pop()}.md`),
	];
	const found = await Promise.all(candidates.map((c) => exists(c)));
	return found.includes(true);
};
const pairs = [
	...xml.matchAll(
		/<qa_pair>\s*<question>([\s\S]*?)<\/question>\s*<answer>([\s\S]*?)<\/answer>\s*<\/qa_pair>/gu,
	),
].map(([, q, a]) => ({ q: fromXml(q ?? ""), a: fromXml(a ?? "") }));

describe("plugin/mcp/evaluation.xml", () => {
	test("every qa_pair has a question and an answer", () => {
		expect(pairs.length).toBe([...xml.matchAll(/<qa_pair>/gu)].length);
		for (const p of pairs) {
			expect(p.q.trim()).not.toBe("");
			expect(p.a.trim()).not.toBe("");
		}
	});

	test("questions are distinct", () => {
		expect(new Set(pairs.map((p) => p.q)).size).toBe(pairs.length);
	});

	test("exercises each tool and each source", () => {
		const all = pairs.map((p) => p.q).join("\n");
		for (const tool of [
			"search_docs",
			"read_page",
			"list_pages",
			"get_schema",
		]) {
			expect(all).toContain(tool);
		}
		for (const s of DOC_SOURCES) {
			expect(all).toContain(`source "${s}"`);
		}
		for (const arg of ["section_heading", "offset", "max_chars", "limit"]) {
			expect(all).toContain(arg);
		}
	});

	test("every route that read_page reads is a page of docs/", async () => {
		const routes = pairs
			.map((p) => /read_page on route (\S+)/u.exec(p.q)?.[1])
			.filter((r): r is string => r !== undefined);
		expect(routes.length).toBeGreaterThan(0);
		const ok = await Promise.all(routes.map((r) => isDocsPage(r)));
		expect(ok.every(Boolean)).toBe(true);
	});
});
