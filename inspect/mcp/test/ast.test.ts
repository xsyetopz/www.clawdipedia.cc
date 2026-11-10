import { expect, test } from "bun:test";

import { Bundle } from "../src/ast.ts";

// Claude Code 2.1.309 minifies a `using` binding to the name `as`.
test.each([
	"async function f(g){using as=await g();return as}",
	"async function f(g){await using as=g();return as}",
])("parses a using declaration bound to `as`: %s", (src) => {
	const m = new Bundle([{ name: "/$bunfs/root/a.js", text: src }]).get("a.js");
	expect(m?.ast.type).toBe("Program");
});

// A protobuf chunk of Claude Code 2.1.322 calls `eval` directly; its names still belong to their declarations.
test("resolves a name in a scope that calls eval", () => {
	const src = 'var a=1;function f(){eval("0");return a}';
	const m = new Bundle([{ name: "/$bunfs/root/a.js", text: src }]).get("a.js");
	expect(m?.topLevel("a")?.references).toHaveLength(2);
});
