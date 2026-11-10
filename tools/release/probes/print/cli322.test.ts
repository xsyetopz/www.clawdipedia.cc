import { expect, test } from "bun:test";

import { CASES } from "./cli322.ts";

test("each cli322 case has its own name, so --only can pick it", () => {
	const names = CASES.map((c) => c.name);
	expect(new Set(names).size).toBe(names.length);
	expect(names).toContain("fast-vertex-model-region");
});
