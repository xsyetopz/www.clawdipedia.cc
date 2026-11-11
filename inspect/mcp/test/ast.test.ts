import { expect, spyOn, test } from "bun:test";

import { Bundle, Module } from "../src/ast.ts";
import { callsOf } from "../src/ast/calls.ts";
import { isFn } from "../src/ast/node.ts";
import { allSeq, firstSeq, mapSeq } from "../src/seq.ts";

// Claude Code 2.1.309 minifies a `using` binding to the name `as`.
test.each([
	"async function f(g){using as=await g();return as}",
	"async function f(g){await using as=g();return as}",
])("parses a using declaration bound to `as`: %s", async (src) => {
	const bundle = new Bundle([{ name: "/$bunfs/root/a.js", text: src }]);
	const m = await bundle.get("a.js");
	expect(m?.ast.type).toBe("Program");
});

// A protobuf chunk of Claude Code 2.1.322 calls `eval` directly; its names still belong to their declarations.
test("resolves a name in a scope that calls eval", async () => {
	const src = 'var a=1;function f(){eval("0");return a}';
	const bundle = new Bundle([{ name: "/$bunfs/root/a.js", text: src }]);
	const m = await bundle.get("a.js");
	expect(m?.topLevel("a")?.references).toHaveLength(2);
});

// eslint-scope decides this by the place of each node in the text; a patch makes it read `start`, not `range`.
test("a name in a parameter default is not the variable of the function body", async () => {
	const src = "var b=1;function f(a=b){var b=2;return a}";
	const bundle = new Bundle([{ name: "/$bunfs/root/a.js", text: src }]);
	const m = await bundle.get("a.js");
	expect(m?.topLevel("b")?.references.map((r) => r.identifier.start)).toEqual([
		src.indexOf("b=1"),
		src.indexOf("b)"),
	]);
});

// A template has its texts in one list and its expressions in another.
const TEMPLATE = `\`a\${b}c\${d}\``;

test.each([
	["[,a,,b]", "b", "Identifier"],
	["[,a,,b]", ",,", "ArrayExpression"],
	["var a=1; var b=2; var c=3; var d=4; var e=5", "d=4", "Identifier"],
	["var a=1; var b=2; var c=3; var d=4; var e=5", " var d", "Program"],
	["({a})", "a", "Identifier"],
	[TEMPLATE, "d", "Identifier"],
	[TEMPLATE, "c", "TemplateElement"],
])("the innermost node of `%s` at `%s` is a %s", async (src, at, type) => {
	const bundle = new Bundle([{ name: "/$bunfs/root/a.js", text: src }]);
	const m = await bundle.get("a.js");
	expect<string | undefined>(m?.nodeAt(src.indexOf(at)).type).toBe(type);
});

// Claude Code 2.1.322 embeds `mermaid.min.js` and two more `.js` files as zstd data.
test("a bundle leaves out a file that is not JavaScript, and keeps the order of the rest", async () => {
	const bundle = new Bundle([
		{ name: "/$bunfs/root/zstd.js", text: "(�/�\u0000" },
		{ name: "/$bunfs/root/b.js", text: "var b=1" },
		{ name: "/$bunfs/root/a.js", text: "var a=1" },
	]);
	const names = [...bundle.texts.keys()];
	const mods = await mapSeq(names, (n) => bundle.get(n));
	expect(names.filter((_, i) => mods[i] !== undefined)).toEqual([
		"b.js",
		"a.js",
	]);
});

const originOf = async (bundle: Bundle, file: string, name: string) => {
	const m = await bundle.get(file);
	const v = m?.topLevel(name);
	return m && v && bundle.origin(m, v);
};

const importersOf = async (bundle: Bundle, file: string, name: string) => {
	const m = await bundle.get(file);
	const v = m?.topLevel(name);
	return m && v ? bundle.importers(m, v) : [];
};

// The calls of the function whose `function` keyword is at `pos`.
const callsAt = async (bundle: Bundle, file: string, pos: number) => {
	const m = await bundle.get(file);
	const fn = m?.nodeAt(pos);
	return m && isFn(fn) ? callsOf(m, fn) : [];
};

// Item 1 gives undefined; a later item ends first when the steps run at once.
const stepLogger = (log: string[]) => async (i: number) => {
	log.push(`start ${i}`);
	await Bun.sleep(3 - i);
	log.push(`end ${i}`);
	return i === 1 ? undefined : i;
};

// Parsing every module of Claude Code 2.1.322 at once held several GB per test file.
test("a bundle parses only the modules a reader asks for, each one once", async () => {
	const parse = spyOn(Module, "parse");
	try {
		const bundle = new Bundle([
			{
				name: "/$bunfs/root/a.js",
				text: 'import{x}from"/$bunfs/root/b.js";var y=x',
			},
			{ name: "/$bunfs/root/b.js", text: "var v=1;export{v as x}" },
			{ name: "/$bunfs/root/c.js", text: "var c=1" },
		]);
		expect(parse).not.toHaveBeenCalled();
		const o = await originOf(bundle, "a.js", "x");
		await bundle.get("/$bunfs/root/a.js");
		expect(o?.module.name).toBe("b.js");
		expect(o?.variable.name).toBe("v");
		expect(parse.mock.calls.map(([name]) => name)).toEqual(["a.js", "b.js"]);
	} finally {
		parse.mockRestore();
	}
});

test("the importers of a variable come in bundle order, for each name it is exported as", async () => {
	const from = 'from"/$bunfs/root/c.js"';
	const bundle = new Bundle([
		{ name: "/$bunfs/root/a.js", text: `import{y as p,x as q,z as s}${from}` },
		{ name: "/$bunfs/root/b.js", text: `import{x as r}${from}` },
		{
			name: "/$bunfs/root/c.js",
			text: "var v=1,w=2;export{v as x,v as y,w as z}",
		},
	]);
	const found = await importersOf(bundle, "c.js", "v");
	expect(found.map((i) => [i.module.name, i.variable.name])).toEqual([
		["a.js", "p"],
		["a.js", "q"],
		["b.js", "r"],
	]);
});

// A minifier gives a nested function the name of a top-level one that its scope does not use.
test("a nested function with the name of an export has no calls in other modules", async () => {
	const text = "function v(){function v(){}v()}export{v as x}";
	const bundle = new Bundle([
		{ name: "/$bunfs/root/a.js", text: 'import{x}from"/$bunfs/root/b.js";x()' },
		{ name: "/$bunfs/root/b.js", text },
	]);
	const calls = await callsAt(bundle, "b.js", text.indexOf("function v(){}"));
	expect(calls.map((c) => c?.module.name)).toEqual(["b.js"]);
});

test("the sequential helpers run one item at a time, in order, and stop early", async () => {
	const log: string[] = [];
	const step = stepLogger(log);
	expect(await mapSeq([0, 1, 2], step)).toEqual([0, undefined, 2]);
	expect(log).toEqual([
		"start 0",
		"end 0",
		"start 1",
		"end 1",
		"start 2",
		"end 2",
	]);
	log.length = 0;
	expect(await allSeq([0, 1, 2], step)).toBeUndefined();
	expect(await firstSeq([1, 2, 0], step)).toBe(2);
	expect(log).toEqual([
		"start 0",
		"end 0",
		"start 1",
		"end 1",
		"start 1",
		"end 1",
		"start 2",
		"end 2",
	]);
});
