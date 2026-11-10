import { expect, test } from "bun:test";

import { claimTerms, relocate } from "../src/relocate.ts";

const PAD = "var q=1;".repeat(10);
const SHIFT = "var r=2;".repeat(2);
const OLD = `${PAD}function A(e){return i.CLAUDE_CODE_FOO_BAR&&e.timeout===1e4?Zq(e):qq(e)}function B(){return "the other thing here"}`;
// The same code under other minified names, and 16 characters further on.
const MOVED = `${PAD}function aa(x){return i.CLAUDE_CODE_FOO_BAR&&x.timeout===1e4?Ww(x):zz(x)}function B(){return "the other thing here"}`;
const CHANGED = `${PAD}function aa(x){return i.CLAUDE_CODE_FOO_BAR&&x.timeout===3e4?Ww(x):zz(x)}function B(){return "the other thing here"}`;

test("claimTerms keeps the words that could name code and drops chunk citations", () => {
	expect(
		claimTerms(
			"The program reads `CLAUDE_CODE_FOO_BAR` (chunk-abcd1234.js@12) with a `1e4` timeout, see `chunk-abcd1234.js` lines 1 to 2.",
		),
	).toEqual(["program", "reads", "CLAUDE_CODE_FOO_BAR", "timeout"]);
});

test("relocate keeps the distance from the anchor and says when the code is the same", () => {
	const at = OLD.indexOf("e.timeout");
	const found = relocate(
		OLD,
		at,
		["CLAUDE_CODE_FOO_BAR"],
		[
			{
				name: "/$bunfs/root/chunk-aaaaaaaa.js",
				text: `${SHIFT}${MOVED}`,
			},
			{ name: "chunk-bbbbbbbb.js", text: "nothing here" },
		],
	);
	expect(found).toHaveLength(1);
	expect(found[0]).toMatchObject({
		module: "chunk-aaaaaaaa.js",
		offset: SHIFT.length + MOVED.indexOf("x.timeout"),
		anchor: "CLAUDE_CODE_FOO_BAR",
		same: true,
	});
});

test("relocate puts the module with the same code before one whose code changed", () => {
	const at = OLD.indexOf("e.timeout");
	const found = relocate(
		OLD,
		at,
		["CLAUDE_CODE_FOO_BAR"],
		[
			{ name: "chunk-cccccccc.js", text: CHANGED },
			{ name: "chunk-dddddddd.js", text: MOVED },
		],
	);
	expect(found.map((r) => [r.module, r.same])).toEqual([
		["chunk-dddddddd.js", true],
		["chunk-cccccccc.js", false],
	]);
});

test("relocate takes the nearer of two places with the same code in one module", () => {
	const caps = `capabilities:["effort","max_effort","adaptive_thinking","per_turn_effort","per_turn_timing","context_management","fast_mode",`;
	const fill = "var s=3;".repeat(60);
	const before = `${PAD}{id:"one",${caps}"lean_prompt","refusal_fallback"]},${fill}{id:"two",${caps}"lean_prompt","org_locked_thinking"]}`;
	// The first entry lost a word that the second one now holds, so the words around the second one match better.
	const after = `${PAD}{id:"one",${caps}"vertex_fast_mode","lean_prompt"]},${fill}{id:"two",${caps}"lean_prompt","refusal_fallback","org_locked_thinking"]}`;
	const at = before.indexOf("per_turn_effort");
	expect(
		relocate(
			before,
			at,
			["per_turn_effort"],
			[{ name: "chunk-eeeeeeee.js", text: after }],
		),
	).toMatchObject([{ offset: at, same: true }]);
});

test("relocate gives nothing when no anchor stands near the offset", () => {
	expect(
		relocate(
			OLD,
			0,
			["CLAUDE_CODE_ABSENT"],
			[{ name: "a.js", text: "unrelated" }],
		),
	).toEqual([]);
});
