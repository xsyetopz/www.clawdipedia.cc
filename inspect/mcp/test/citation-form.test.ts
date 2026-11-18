import { expect, test } from "bun:test";

import { unlocatedCitations } from "../src/citation-form.ts";

const DOC = [
	"The program reads it.[^a]",
	"",
	"## Sources",
	"",
	"[^a]: The program, `chunk-aaaaaaaa.js:12` and `:40-44`.",
	"[^b]: The program, the agent loop.",
	"[^c]: The program, `chunk-bbbbbbbb.js@340`.",
	"[^d]: The program, `chunk-cccccccc.js` lines 5 to 9.",
	"[^e]: The program, `chunk-dddddddd.js`.",
	"[^f]: Probe case `pty.x`. Official page: [Commands](https://example.com).",
].join("\n");

test("unlocatedCitations accepts a footnote with a chunk and a :N place", () => {
	const lines = unlocatedCitations({ "a.md": DOC }).map((u) => u.line);
	expect(lines).not.toContain(5);
	expect(lines).not.toContain(10);
});

test("unlocatedCitations reports each form that lacks :N, and a program footnote with no chunk", () => {
	expect(
		unlocatedCitations({ "a.md": DOC }).map((u) => [u.line, u.problem]),
	).toEqual([
		[6, "names the program but no chunk-x.js:N"],
		[7, "chunk-bbbbbbbb.js@N: write the place as chunk-bbbbbbbb.js:N"],
		[7, "names the program but no chunk-x.js:N"],
		[
			8,
			"chunk-cccccccc.js lines A to B: write the place as chunk-cccccccc.js:A-B",
		],
		[8, "names the program but no chunk-x.js:N"],
		[9, "chunk-dddddddd.js names no :N place"],
		[9, "names the program but no chunk-x.js:N"],
	]);
});

test("unlocatedCitations reports a range that ends before it starts, after a chunk or alone", () => {
	// Arrange
	const files = {
		"r.md": [
			"[^a]: The program, `chunk-aaaaaaaa.js:40-44` and `:50-52`.",
			"[^b]: The program, `chunk-bbbbbbbb.js:632-616`.",
			"[^c]: The program, `chunk-cccccccc.js:9` and `:593-58`.",
		].join("\n"),
	};

	// Act
	const found = unlocatedCitations(files).map((u) => [u.line, u.problem]);

	// Assert
	expect(found).toEqual([
		[2, ":632-616 ends before it starts: write the range as :A-B with A <= B"],
		[3, ":593-58 ends before it starts: write the range as :A-B with A <= B"],
	]);
});

test("unlocatedCitations ignores the program in prose, and checks every JSON line", () => {
	const files = {
		"p.md": "The program prints it in a table row.",
		"x.json": [
			"{",
			'\t"a": "A link that the program prints.",',
			'\t"b": "A path the program joins (`chunk-aaaaaaaa.js:9`).",',
			"}",
		].join("\n"),
	};
	expect(unlocatedCitations(files).map((u) => [u.file, u.line])).toEqual([
		["x.json", 2],
	]);
});
