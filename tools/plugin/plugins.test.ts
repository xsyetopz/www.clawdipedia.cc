import { describe, expect, test } from "bun:test";

import { exists } from "./plugins.ts";

describe("exists", () => {
	test("is true for a folder, a file, and false for a missing path", async () => {
		const found = await Promise.all(
			["tools/plugin", "tools/plugin/plugins.ts", "tools/plugin/none"].map(
				(p) => exists(p),
			),
		);
		expect(found).toEqual([true, true, false]);
	});
});
