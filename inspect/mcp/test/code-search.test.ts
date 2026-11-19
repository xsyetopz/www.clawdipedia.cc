// Run: bun test inspect/mcp/test/code-search.test.ts
import { expect, test } from "bun:test";

import { searchable } from "../src/mcp/app.ts";

test("with no module, search reads JS modules only", () => {
	const names = ["chunk-a.js", "entry.mjs", "claude-code.d.ts-x.txt.zst"];

	const read = names.filter((n) => searchable(n));

	expect(read).toEqual(["chunk-a.js", "entry.mjs"]);
});

test("with no module, search also reads the entry module, which has no .js name", () => {
	const names = ["chunk-a.js", "cli", "claude-code.d.ts-x.txt.zst"];

	const read = names.filter((n) => searchable(n, undefined, "cli"));

	expect(read).toEqual(["chunk-a.js", "cli"]);
});

test("a named module is searched even when it is not JS", () => {
	const name = "claude-code.d.ts-x.txt.zst";

	const read = searchable(name, "claude-code.d.ts");

	expect(read).toBe(true);
});

test("a named module excludes the other modules", () => {
	const read = searchable("chunk-a.js", "chunk-b.js");

	expect(read).toBe(false);
});
