import { expect, test } from "bun:test";

import { findCitations, staleCitations } from "../src/citations.ts";

const DOC = [
	"---",
	"title: T",
	"---",
	"The program reads it (`chunk-aaaaaaaa.js:12`, `chunk-bbbbbbbb.js@340`).",
	"See `chunk-cccccccc.js` lines 5 to 9 and `chunk-aaaaaaaa.js`.",
	"No citation here: chunk.js and chunk-ABC.js.",
].join("\n");

test("findCitations gives each form with its line", () => {
	expect(findCitations("a.md", DOC)).toEqual([
		{
			file: "a.md",
			line: 4,
			citation: "chunk-aaaaaaaa.js:12",
			chunk: "chunk-aaaaaaaa.js",
		},
		{
			file: "a.md",
			line: 4,
			citation: "chunk-bbbbbbbb.js@340",
			chunk: "chunk-bbbbbbbb.js",
		},
		{
			file: "a.md",
			line: 5,
			citation: "chunk-cccccccc.js` lines 5 to 9",
			chunk: "chunk-cccccccc.js",
		},
		{
			file: "a.md",
			line: 5,
			citation: "chunk-aaaaaaaa.js",
			chunk: "chunk-aaaaaaaa.js",
		},
	]);
});

test("staleCitations keeps only the chunks the build lacks, by file name of a module path", () => {
	const stale = staleCitations(
		{ "a.md": DOC, "b.md": "`chunk-dddddddd.js@1`" },
		["/$bunfs/root/chunk-aaaaaaaa.js", "chunk-cccccccc.js"],
	);
	expect(stale.map((c) => [c.file, c.line, c.citation])).toEqual([
		["a.md", 4, "chunk-bbbbbbbb.js@340"],
		["b.md", 1, "chunk-dddddddd.js@1"],
	]);
});

test("staleCitations is empty when every chunk is in the build", () => {
	expect(
		staleCitations({ "a.md": DOC }, [
			"chunk-aaaaaaaa.js",
			"chunk-bbbbbbbb.js",
			"chunk-cccccccc.js",
		]),
	).toEqual([]);
});
