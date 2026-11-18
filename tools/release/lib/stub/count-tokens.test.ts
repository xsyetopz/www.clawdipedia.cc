import { describe, expect, test } from "bun:test";

import { DEFAULT_COUNT_TOKENS, fallbackRoute } from "../stub.ts";

const PATH = "/v1/messages/count_tokens";

describe("fallbackRoute", () => {
	test("answers the given count for count_tokens", async () => {
		// Arrange
		const tokens = 99_999;

		// Act
		const res = fallbackRoute(PATH, tokens);

		// Assert
		expect(await res.json()).toEqual({ input_tokens: 99_999 });
	});

	test("keeps the default count of 10", async () => {
		// Arrange
		const tokens = DEFAULT_COUNT_TOKENS;

		// Act
		const res = fallbackRoute(PATH, tokens);

		// Assert
		expect(await res.json()).toEqual({ input_tokens: 10 });
	});

	test("answers 404 for an unknown path", () => {
		// Arrange
		const path = "/v1/other";

		// Act
		const res = fallbackRoute(path, 10);

		// Assert
		expect(res.status).toBe(404);
	});
});
