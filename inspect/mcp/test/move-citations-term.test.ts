import { expect, test } from "bun:test";

import { moveCitations } from "../src/citations.ts";

const PAD = "var q=1;".repeat(10);
const SHIFT = "var r=2;".repeat(2);
const LITERAL = '"a long string literal that both builds hold"';

// Lines with no hash name: a window of them is long enough for `sameLine`, so a changed line must break it.
const plain = (from: number, to: number) =>
	Array.from(
		{ length: to - from },
		(_, i) => `const filler${from + i} = compute("filler value ${from + i}");`
	);
const TERM_LINE = "const fooTermNameLong = readSetting();";
const TERM_OLD = [...plain(0, 99), TERM_LINE, ...plain(100, 200)];
const runTerm = (oldLines: string[], newLines: string[], text: string) =>
	moveCitations(
		{ "a.md": text },
		[
			{
				name: "chunk-aaaaaaaa.js",
				text: LITERAL,
				clean: oldLines.join("\n")
			}
		],
		[
			{
				name: "chunk-bbbbbbbb.js",
				text: LITERAL,
				clean: newLines.join("\n")
			}
		]
	);

test("moves a line by its term when the code around the line changed", () => {
	// Arrange: the cited line (3 after the term) changed, and the term moved 20 lines down.
	const changed = [...TERM_OLD];
	changed[102] = "const different = 1;";
	const next = [...plain(300, 320), ...changed];

	// Act
	const { moves, files } = runTerm(
		TERM_OLD,
		next,
		"The program reads `fooTermNameLong` (`chunk-aaaaaaaa.js:103`)."
	);

	// Assert
	expect(files["a.md"]).toBe(
		"The program reads `fooTermNameLong` (`chunk-bbbbbbbb.js:123`)."
	);
	expect(moves.map((m) => m.how)).toEqual(["term"]);
});

test("moves a line by the place of its term with the most alike lines around it", () => {
	// Arrange: a decoy of the term stands nearer to the old line, but its lines are other ones.
	const changed = [...TERM_OLD];
	changed[102] = "const different = 1;";
	const next = [...plain(300, 320), ...changed];
	next[100] = "const fooTermNameLong = somethingElse();";

	// Act
	const { files, moves } = runTerm(
		TERM_OLD,
		next,
		"The program reads `fooTermNameLong` (`chunk-aaaaaaaa.js:103`)."
	);

	// Assert
	expect(files["a.md"]).toContain("chunk-bbbbbbbb.js:123");
	expect(moves.map((m) => m.how)).toEqual(["term"]);
});

test("moves a line to the nearest place of its term when two places are as alike", () => {
	// Arrange: two places hold the term with the lines of the old place around them.
	const around = (extra: string) => [
		...TERM_OLD.slice(95, 99),
		extra,
		...TERM_OLD.slice(100, 105)
	];
	const next = [
		...plain(300, 390),
		...around("const fooTermNameLong = near();"),
		...plain(390, 550),
		...around("const fooTermNameLong = far();"),
		...plain(550, 600)
	];

	// Act
	const { files } = runTerm(
		TERM_OLD,
		next,
		"The program reads `fooTermNameLong` (`chunk-aaaaaaaa.js:103`)."
	);

	// Assert: the nearer place is line 95, so the line is 3 after it.
	expect(files["a.md"]).toContain("chunk-bbbbbbbb.js:98");
});

test("moves a raw offset by its term when the code around it changed", () => {
	// Arrange
	const old = `${PAD}function A(e){return i.CLAUDE_CODE_FOO_BAR&&e.timeout===1e4?Zq(e):qq(e)}${LITERAL}`;
	const next = `${SHIFT}${PAD}function aa(x){if(!x)throw 1;return i.CLAUDE_CODE_FOO_BAR&&x.other===2?Ww(x):zz(x)}${LITERAL}`;
	const at = old.indexOf("CLAUDE_CODE_FOO_BAR") + 5;

	// Act
	const { moves, files } = moveCitations(
		{
			"a.md": `The \`CLAUDE_CODE_FOO_BAR\` setting (chunk-aaaaaaaa.js@${at}).`
		},
		[{ name: "chunk-aaaaaaaa.js", text: old }],
		[{ name: "chunk-bbbbbbbb.js", text: next }]
	);

	// Assert
	expect(files["a.md"]).toContain(
		`chunk-bbbbbbbb.js@${next.indexOf("CLAUDE_CODE_FOO_BAR") + 5}`
	);
	expect(moves.map((m) => m.how)).toEqual(["term"]);
});

test("keeps a changed line as a module move when its line has no term", () => {
	const changed = [...TERM_OLD];
	changed[102] = "const different = 1;";

	const { moves, files } = runTerm(
		TERM_OLD,
		[...plain(300, 320), ...changed],
		"The program reads the setting (`chunk-aaaaaaaa.js:103`)."
	);

	expect(files["a.md"]).toBe(
		"The program reads the setting (`chunk-bbbbbbbb.js:103`)."
	);
	expect(moves.map((m) => m.how)).toEqual(["module"]);
});

test("keeps a changed line as a module move when the new module lacks its term", () => {
	const { moves } = runTerm(
		TERM_OLD,
		plain(300, 500),
		"The program reads `fooTermNameLong` (`chunk-aaaaaaaa.js:103`)."
	);

	expect(moves.map((m) => m.how)).toEqual(["module"]);
});

test("keeps a changed line as a module move when a short term sits only among other lines", () => {
	const old = [...plain(0, 99), "const shortOne = read();", ...plain(100, 200)];
	const next = [
		...plain(300, 400),
		"const shortOne = other();",
		...plain(400, 500)
	];

	const { moves } = runTerm(
		old,
		next,
		"The program reads `shortOne` (`chunk-aaaaaaaa.js:103`)."
	);

	expect(moves.map((m) => m.how)).toEqual(["module"]);
});
