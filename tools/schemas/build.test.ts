import { expect, test } from "bun:test";

import { isRawSchemas } from "./build.ts";

test("isRawSchemas accepts the row lists that the control and tools captures give", () => {
	expect(
		isRawSchemas({
			settings: { type: "object" },
			control: [{ request: {}, originator: "client", response: {} }],
			tools: [{ name: "Read", inputSchema: {} }],
		}),
	).toBe(true);
});

test("isRawSchemas refuses a value that is not a record", () => {
	expect(isRawSchemas([])).toBe(false);
	expect(isRawSchemas(null)).toBe(false);
});
