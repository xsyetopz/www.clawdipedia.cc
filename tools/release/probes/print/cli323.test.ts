import { expect, test } from "bun:test";

import { CASES } from "./cli323.ts";

test("each cli323 case has its own name, so --only can pick it", () => {
	const names = CASES.map((c) => c.name);
	expect(new Set(names).size).toBe(names.length);
	expect(names).toContain("workspace-trust-json");
	expect(names).toContain("plugin-install-json");
});
