import { expect, test } from "bun:test";

import { CASES } from "./cli321.ts";

test("each cli321 case has its own name, so --only can pick it", () => {
	const names = CASES.map((c) => c.name);
	expect(new Set(names).size).toBe(names.length);
	expect(names).toContain("rc-settings-json");
	expect(names).toContain("runner-sigkill");
	expect(names).toContain("daemon-list");
});
