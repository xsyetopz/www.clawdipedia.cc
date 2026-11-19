import { describe, expect, test } from "bun:test";

import { citationTerms, codeAt, lineTerms } from "../src/citation-terms.ts";

const pad = "x".repeat(2000);
const modules = new Map([
	["chunk-abc.js", `${pad}function Moo(o){return!1}${pad}`],
]);

describe("lineTerms", () => {
	test("takes code spans, their code-like pieces, and quoted strings, not citations", () => {
		const terms = lineTerms(
			'The gate `Moo(o, x_y)` says "turned off" at `chunk-abc.js:2000`.',
		);
		expect(terms).toEqual(["Moo(o, x_y)", "Moo", "x_y", "turned off"]);
	});
});

describe("citationTerms", () => {
	test("finds a term of the line near the offset", () => {
		const md = "[^g]: The program, `chunk-abc.js:2005` (`Moo`).";
		expect(citationTerms(md, modules, "a.md")).toEqual([
			{
				file: "a.md",
				line: 1,
				citation: "chunk-abc.js:2005",
				term: "Moo",
				as: "offset",
			},
		]);
	});

	test("reports a miss when the term is far from the offset", () => {
		const md = "[^g]: The program, `chunk-abc.js:10` (`Moo`).";
		expect(citationTerms(md, modules)[0]?.term).toBeUndefined();
	});

	test("takes the terms of a footnote from the lines that use it", () => {
		const md =
			"The gate `Moo` is off.[^g]\n\n[^g]: The program, `chunk-abc.js:2005`.";
		expect(citationTerms(md, modules)[0]?.term).toBe("Moo");
	});

	test("codeAt prints the code that starts at the offset", () => {
		expect(codeAt("chunk-abc.js:2000", modules, 12)).toBe("function Moo");
		expect(codeAt("chunk-zzz.js:5", modules)).toBe("(no such module)");
	});

	test("reads N as a line of the cleaned module when the offset misses", () => {
		// Arrange
		const clean = new Map([
			["chunk-abc.js", ["// head", "let a = 1;", "function Moo(o) {"]],
		]);
		const md = "[^g]: The program, `chunk-abc.js:3` (`Moo`).";
		// Act
		const [hit] = citationTerms(md, modules, "a.md", clean);
		// Assert
		expect(hit).toEqual({
			file: "a.md",
			line: 1,
			citation: "chunk-abc.js:3",
			term: "Moo",
			as: "line",
		});
	});

	test("reports a miss when the line is past the end of the cleaned module", () => {
		const clean = new Map([["chunk-abc.js", ["function Moo(o) {"]]]);
		const md = "`chunk-abc.js:50` (`Moo`)";
		expect(citationTerms(md, modules, "", clean)[0]?.term).toBeUndefined();
	});

	test("reports a miss for a module the build lacks", () => {
		const md = "`chunk-zzz.js:5` (`Moo`)";
		expect(citationTerms(md, modules)[0]?.term).toBeUndefined();
	});
});
