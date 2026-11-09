import { expect, test } from "bun:test";

import { normalise } from "./results.ts";

test("normalise drops the run date, so captures made on two days match", () => {
	expect(normalise("Today's date is 2026-10-22.")).toBe(
		normalise("Today's date is 2026-10-23."),
	);
});
