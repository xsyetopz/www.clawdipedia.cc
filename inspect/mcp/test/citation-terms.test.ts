import { describe, expect, test } from "bun:test";

import { toLines } from "../src/citation-lines.ts";
import {
	citationTerms,
	codeAt,
	lineTerms,
	suggest,
	termsByLine
} from "../src/citation-terms.ts";

const pad = "x".repeat(2000);
const modules = new Map([
	["chunk-abc.js", `${pad}function Moo(o){return!1}${pad}`]
]);

describe("lineTerms", () => {
	test("takes code spans, their code-like pieces, and quoted strings, not citations", () => {
		const terms = lineTerms(
			'The gate `Moo(o, x_y)` says "turned off" at `chunk-abc.js:2000`.'
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
				as: "offset"
			}
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
			["chunk-abc.js", ["// head", "let a = 1;", "function Moo(o) {"]]
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
			as: "line"
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

describe("suggest", () => {
	test("lists lines of the cited module that hold a term, nearest to N first", () => {
		// Arrange
		const clean = new Map([
			["chunk-abc.js", ["a", "Moo(1)", "b", "c", "d", "Moo(2)"]]
		]);
		// Act
		const got = suggest("chunk-abc.js:5", ["Moo"], clean);
		// Assert
		expect(got.map((s) => s.place)).toEqual([
			"chunk-abc.js:6",
			"chunk-abc.js:2"
		]);
	});

	test("looks in other modules for a term the cited module lacks", () => {
		// Arrange
		const clean = new Map([
			["chunk-abc.js", ["a"]],
			["chunk-def.js", ["x", "Zed()"]]
		]);
		// Act
		const got = suggest("chunk-abc.js:1", ["Zed"], clean);
		// Assert
		expect(got).toEqual([{ place: "chunk-def.js:2", term: "Zed" }]);
	});

	test("skips a term at more than 5 places in other modules", () => {
		// Arrange
		const clean = new Map([
			["chunk-def.js", Array.from({ length: 6 }, () => "Zed")]
		]);
		// Act
		const got = suggest("chunk-gone.js:1", ["Zed"], clean);
		// Assert
		expect(got).toEqual([]);
	});
});

describe("termsByLine", () => {
	test("gives a footnote the terms of each line that uses it", () => {
		// Arrange
		const md = "Uses `Moo`.[^m]\n\n[^m]: The program, `chunk-abc.js:1`.";
		// Act
		const got = termsByLine(md);
		// Assert
		expect(got[2]).toEqual(["Moo"]);
	});
});

describe("toLines", () => {
	const gap = " ".repeat(300);
	const code = `${pad}${gap}function mooFn(o){return alpha(o)}${gap}${pad}${gap}function mooFn(p){return beta(p)}${gap}${pad}`;
	const mods = new Map([["chunk-abc.js", code]]);
	const rows = [
		"// head",
		"function mooFn(o) {",
		"  return alpha(o);",
		"}",
		"",
		"",
		"",
		"function mooFn(p) {",
		"  return beta(p);",
		"}"
	];
	const clean = new Map([["chunk-abc.js", rows]]);

	test("converts an offset to the line that holds the term at that place", () => {
		// Arrange
		const second = code.lastIndexOf("function mooFn");
		const md = `[^g]: The program, \`chunk-abc.js:${second}\` (\`mooFn\`).`;
		// Act
		const got = toLines(md, mods, clean, "a.md");
		// Assert
		expect(got.text).toBe("[^g]: The program, `chunk-abc.js:8` (`mooFn`).");
		expect(got.done[0]?.term).toBe("mooFn");
	});

	test("leaves a tie unchanged and reports it", () => {
		// Arrange
		const tie = new Map([["chunk-abc.js", ["mooFn(1)", "x", "mooFn(2)"]]]);
		const md = `\`chunk-abc.js:2005\` (\`mooFn\`)`;
		// Act
		const got = toLines(md, mods, tie);
		// Assert
		expect(got.text).toBe(md);
		expect(got.left[0]?.reason).toContain("tie");
	});

	test("converts both ends of a range or neither", () => {
		// Arrange
		const first = code.indexOf("function mooFn");
		const second = code.lastIndexOf("function mooFn");
		const md = `\`mooFn\` \`chunk-abc.js:${first}-${second}\` and \`chunk-abc.js:${first}-3000000\``;
		// Act
		const got = toLines(md, mods, clean);
		// Assert
		expect(got.text).toBe(
			`\`mooFn\` \`chunk-abc.js:2-8\` and \`chunk-abc.js:${first}-3000000\``
		);
		expect(got.left).toHaveLength(1);
	});

	test("leaves a citation that already reads as a line untouched", () => {
		// Arrange
		const md = "`chunk-abc.js:5` (`mooFn`)";
		// Act
		const got = toLines(md, mods, clean);
		// Assert
		expect(got.text).toBe(md);
		expect(got.done).toEqual([]);
	});

	test("leaves a number inside the module's line count for a read by hand", () => {
		// Arrange
		const near = new Map([["chunk-abc.js", `function mooFn(){}${gap}`]]);
		const far = new Map([
			[
				"chunk-abc.js",
				[...Array.from({ length: 30 }, () => "x"), "function mooFn() {"]
			]
		]);
		const md = "`chunk-abc.js:5` (`mooFn`)";
		// Act
		const got = toLines(md, near, far);
		// Assert
		expect(got.text).toBe(md);
		expect(got.left[0]?.reason).toBe("number is also a line of the module");
	});

	test("does not place a citation by a plain word", () => {
		// Arrange
		const second = code.lastIndexOf("function mooFn");
		const md = `\`chunk-abc.js:${second}\` (\`beta\`)`;
		// Act
		const got = toLines(md, mods, clean);
		// Assert
		expect(got.text).toBe(md);
		expect(got.left).toHaveLength(1);
	});

	test("writes a range whose ends land on one line as that line", () => {
		// Arrange
		const first = code.indexOf("function mooFn");
		const md = `\`chunk-abc.js:${first}-${first + 5}\` (\`mooFn\`)`;
		// Act
		const got = toLines(md, mods, clean);
		// Assert
		expect(got.text).toBe("`chunk-abc.js:2` (`mooFn`)");
	});
});

describe("citationTerms with linesOnly", () => {
	test("counts a citation that matches only as an offset as a miss", () => {
		// Arrange
		const clean = new Map([["chunk-abc.js", ["a"]]]);
		const md = "[^g]: The program, `chunk-abc.js:2005` (`Moo`).";
		// Act
		const strict = citationTerms(md, modules, "", clean, true);
		const loose = citationTerms(md, modules, "", clean);
		// Assert
		expect(strict[0]?.term).toBeUndefined();
		expect(loose[0]?.as).toBe("offset");
	});

	test("still accepts a line", () => {
		// Arrange
		const clean = new Map([["chunk-abc.js", ["function Moo(o) {"]]]);
		// Act
		const [hit] = citationTerms(
			"`chunk-abc.js:1` (`Moo`)",
			modules,
			"",
			clean,
			true
		);
		// Assert
		expect(hit?.as).toBe("line");
	});
});
