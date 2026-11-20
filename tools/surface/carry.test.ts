import { describe, expect, test } from "bun:test";

import { carryPairs, score } from "./carry.ts";

describe("carryPairs", () => {
	test("carries a reworded pair", () => {
		const unmapped = ["error:a layout node is damaged"];
		const stale = ["error:a layout record is damaged"];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toEqual([
			["error:a layout record is damaged", "error:a layout node is damaged"]
		]);
	});

	test("carries when only a placeholder differs", () => {
		const unmapped = ["error:No walker function defined for node type"];
		const stale = [`error:No walker function defined for node type \${…}`];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toHaveLength(1);
	});

	test("does not carry a match that holds only placeholders", () => {
		const unmapped = [`error:error: \${…}`];
		const stale = [`error:\${…}: $.session.compact: \${…}`];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toEqual([]);
	});

	test("does not carry a pair that is not mutual-best", () => {
		const unmapped = [
			"error:a layout node is damaged",
			"error:a layout record is damaged"
		];
		const stale = ["error:a layout record is damaged"];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toEqual([
			["error:a layout record is damaged", "error:a layout record is damaged"]
		]);
	});

	test("does not carry a prefix key", () => {
		const unmapped = ["error:a layout node is damaged*"];
		const stale = ["error:a layout node is damaged now*"];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toEqual([]);
	});

	test("does not carry across kinds", () => {
		const unmapped = ["env:a layout node is damaged"];
		const stale = ["error:a layout record is damaged"];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toEqual([]);
	});

	test("does not carry a score below the threshold", () => {
		const unmapped = ["error:--task-budget must be a positive integer"];
		const stale = [
			"error:maxEntrySize must be a positive integer if specified"
		];

		const pairs = carryPairs(unmapped, stale);

		expect(pairs).toEqual([]);
	});
});

describe("score", () => {
	test("ignores placeholders", () => {
		const a = "error:refused credentials in the url";
		const b = `error:\${…}: \${…} refused credentials in the url`;

		const result = score(a, b);

		expect(result).toBe(1);
	});

	test("is 0 for a text with fewer than three words", () => {
		const result = score("error:must be", "error:must be");

		expect(result).toBe(0);
	});
});
