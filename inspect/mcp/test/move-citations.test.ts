import { expect, test } from "bun:test";

import { moveCitations } from "../src/citations.ts";

const PAD = "var q=1;".repeat(10);
const SHIFT = "var r=2;".repeat(2);
const LITERAL = '"a long string literal that both builds hold"';
const OLD = `${PAD}function A(e){return i.CLAUDE_CODE_FOO_BAR&&e.timeout===1e4?Zq(e):qq(e)}${LITERAL}`;
const NEW = `${SHIFT}${PAD}function aa(x){return i.CLAUDE_CODE_FOO_BAR&&x.timeout===1e4?Ww(x):zz(x)}${LITERAL}`;
const OLD_AT = OLD.indexOf("e.timeout");
const NEW_AT = NEW.indexOf("x.timeout");

const oldSources = [
	{ name: "/$bunfs/root/chunk-aaaaaaaa.js", text: OLD },
	{ name: "chunk-cccccccc.js", text: '"a literal that no new module holds"' },
];
const newSources = [
	{ name: "/$bunfs/root/chunk-bbbbbbbb.js", text: NEW },
	{ name: "chunk-dddddddd.js", text: "nothing here" },
];

const run = (text: string) =>
	moveCitations({ "a.md": text }, oldSources, newSources);

test("moves an offset to the same code in the mapped module", () => {
	const { moves, files } = run(
		`The program reads CLAUDE_CODE_FOO_BAR (chunk-aaaaaaaa.js:${OLD_AT}) and (chunk-aaaaaaaa.js@${OLD_AT}).`,
	);
	expect(moves).toEqual([
		{
			file: "a.md",
			line: 1,
			from: `chunk-aaaaaaaa.js:${OLD_AT}`,
			to: `chunk-bbbbbbbb.js:${NEW_AT}`,
			how: "same",
		},
		{
			file: "a.md",
			line: 1,
			from: `chunk-aaaaaaaa.js@${OLD_AT}`,
			to: `chunk-bbbbbbbb.js@${NEW_AT}`,
			how: "same",
		},
	]);
	expect(files["a.md"]).toBe(
		`The program reads CLAUDE_CODE_FOO_BAR (chunk-bbbbbbbb.js:${NEW_AT}) and (chunk-bbbbbbbb.js@${NEW_AT}).`,
	);
});

test("moves a bare name and a lines form to the mapped module with the numbers kept", () => {
	const { moves, files } = run(
		"See `chunk-aaaaaaaa.js` and `chunk-aaaaaaaa.js lines 5 to 9`.",
	);
	expect(moves.map((m) => [m.from, m.to, m.how])).toEqual([
		["chunk-aaaaaaaa.js", "chunk-bbbbbbbb.js", "module"],
		[
			"chunk-aaaaaaaa.js lines 5 to 9",
			"chunk-bbbbbbbb.js lines 5 to 9",
			"module",
		],
	]);
	expect(files["a.md"]).toBe(
		"See `chunk-bbbbbbbb.js` and `chunk-bbbbbbbb.js lines 5 to 9`.",
	);
});

test("keeps the offset as a module move when the code is not found", () => {
	const { moves, files } = run("The program reads `chunk-aaaaaaaa.js:3`.");
	expect(moves.map((m) => [m.to, m.how])).toEqual([
		["chunk-bbbbbbbb.js:3", "module"],
	]);
	expect(files["a.md"]).toBe("The program reads `chunk-bbbbbbbb.js:3`.");
});

const importing = (dep: string) =>
	`${`import{a}from"/$bunfs/root/chunk-${dep}.js";`.repeat(4)}${PAD.repeat(6)}"a second long literal that both builds hold"`;

test("keeps an offset as the same code when the code at it did not move and no anchor is near", () => {
	const inName = importing("gggggggg").lastIndexOf("gggg");
	const { moves } = moveCitations(
		{
			"a.md": `See \`chunk-eeeeeeee.js:${inName}\`, \`chunk-eeeeeeee.js:300\` and \`chunk-eeeeeeee.js:9000\`.`,
		},
		[{ name: "chunk-eeeeeeee.js", text: importing("gggggggg") }],
		[{ name: "chunk-ffffffff.js", text: importing("hhhhhhhh") }],
	);
	expect(moves.map((m) => [m.to, m.how])).toEqual([
		[`chunk-ffffffff.js:${inName}`, "same"],
		["chunk-ffffffff.js:300", "same"],
		["chunk-ffffffff.js:9000", "module"],
	]);
});

const cleanLines = (from: number, to: number) =>
	Array.from(
		{ length: to - from },
		(_, i) =>
			`let v${from + i} = $a${String(from + i).padStart(5, "0")}("value ${from + i}");`,
	);
const CLEAN_OLD = [
	...cleanLines(1, 201),
	'import "/$bunfs/root/chunk@0693a6aa.js";',
].join("\n");
const CLEAN_NEW = [
	"new line 1",
	"new line 2",
	"new line 3",
	...cleanLines(1, 150),
	"let v150 = changed();",
	...cleanLines(151, 201),
	'import "/$bunfs/root/chunk@b5116781.js";',
]
	.join("\n")
	.replaceAll("$a0", "$b0");
const runClean = (text: string) =>
	moveCitations(
		{ "a.md": text },
		[{ name: "chunk-aaaaaaaa.js", text: OLD, clean: CLEAN_OLD }],
		[{ name: "chunk-bbbbbbbb.js", text: NEW, clean: CLEAN_NEW }],
	);

test("moves a line of the cleaned module to the same lines in the new one", () => {
	const { moves, files } = runClean(
		"See `chunk-aaaaaaaa.js:12`, `:20-30`, `:201` and `chunk-aaaaaaaa.js` lines 40 to 45.",
	);
	expect(files["a.md"]).toBe(
		"See `chunk-bbbbbbbb.js:15`, `:23-33`, `:204` and `chunk-bbbbbbbb.js` lines 43 to 48.",
	);
	expect(moves.map((m) => m.how)).toEqual(["same", "same"]);
});

test("keeps a line whose code changed, as a module move", () => {
	const { moves, files } = runClean(
		"See `chunk-aaaaaaaa.js:150` and `chunk-aaaaaaaa.js` lines 149 to 151.",
	);
	expect(files["a.md"]).toBe(
		"See `chunk-bbbbbbbb.js:150` and `chunk-bbbbbbbb.js` lines 149 to 151.",
	);
	expect(moves.map((m) => m.how)).toEqual(["module", "module"]);
});

test("reads a number as a raw offset after an at sign, past the last line, or when only the raw code holds the claim's words", () => {
	const { files } = runClean(
		`\`chunk-aaaaaaaa.js@${OLD_AT}\`, \`chunk-aaaaaaaa.js:${OLD_AT}\` reads CLAUDE_CODE_FOO_BAR, \`chunk-aaaaaaaa.js:9000\`.`,
	);
	expect(files["a.md"]).toBe(
		`\`chunk-bbbbbbbb.js@${NEW_AT}\`, \`chunk-bbbbbbbb.js:${NEW_AT}\` reads CLAUDE_CODE_FOO_BAR, \`chunk-bbbbbbbb.js:9000\`.`,
	);
});

test("moves a follow-on number or range with the last chunk before it", () => {
	const { files } = run(
		`CLAUDE_CODE_FOO_BAR: \`chunk-aaaaaaaa.js:${OLD_AT}\`, \`:${OLD_AT}-${OLD_AT + 4}\`, \`:7\``,
	);
	expect(files["a.md"]).toBe(
		`CLAUDE_CODE_FOO_BAR: \`chunk-bbbbbbbb.js:${NEW_AT}\`, \`:${NEW_AT}-${NEW_AT + 4}\`, \`:7\``,
	);
});

test("reports a chunk with no matching module and leaves its text", () => {
	const text = "See `chunk-cccccccc.js:5`, `:9`.";
	const { moves, files } = run(text);
	expect(moves).toEqual([
		{ file: "a.md", line: 1, from: "chunk-cccccccc.js:5", how: "unmapped" },
	]);
	expect(files["a.md"]).toBe(text);
});

test("leaves a citation of a module of the new build and one of no build", () => {
	const text = `See \`chunk-bbbbbbbb.js:${NEW_AT}\`, \`:${NEW_AT}\` and chunk-zzzzzzzz.js:4.`;
	const { moves, files } = run(text);
	expect(moves).toEqual([]);
	expect(files["a.md"]).toBe(text);
});
