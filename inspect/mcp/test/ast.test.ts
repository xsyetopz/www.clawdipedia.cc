import { expect, test } from "bun:test";

import { Bundle } from "../src/ast.ts";

// Claude Code 2.1.309 minifies a `using` binding to the name `as`.
test.each([
	"async function f(g){using as=await g();return as}",
	"async function f(g){await using as=g();return as}",
])("parses a using declaration bound to `as`: %s", async (src) => {
	const bundle = await Bundle.parse([{ name: "/$bunfs/root/a.js", text: src }]);
	const m = bundle.get("a.js");
	expect(m?.ast.type).toBe("Program");
});

// A protobuf chunk of Claude Code 2.1.322 calls `eval` directly; its names still belong to their declarations.
test("resolves a name in a scope that calls eval", async () => {
	const src = 'var a=1;function f(){eval("0");return a}';
	const bundle = await Bundle.parse([{ name: "/$bunfs/root/a.js", text: src }]);
	const m = bundle.get("a.js");
	expect(m?.topLevel("a")?.references).toHaveLength(2);
});

// Claude Code 2.1.322 embeds `mermaid.min.js` and two more `.js` files as zstd data.
test("a bundle leaves out a file that is not JavaScript, and keeps the order of the rest", async () => {
	const bundle = await Bundle.parse([
		{ name: "/$bunfs/root/zstd.js", text: "(�/�\u0000" },
		{ name: "/$bunfs/root/b.js", text: "var b=1" },
		{ name: "/$bunfs/root/a.js", text: "var a=1" },
	]);
	expect([...bundle.modules.keys()]).toEqual(["b.js", "a.js"]);
});
