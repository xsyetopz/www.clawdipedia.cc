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
