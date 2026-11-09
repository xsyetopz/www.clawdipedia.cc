import { describe, expect, test } from "bun:test";

import { splitTop } from "./jsparse.ts";

describe("splitTop", () => {
	test("splits at the top level only, not in brackets or strings", () => {
		expect(splitTop('"a|b" | { "x": number | null } | null', "|")).toEqual([
			'"a|b" ',
			' { "x": number | null } ',
			" null",
		]);
	});
	test("splits at a two-character separator", () => {
		expect(splitTop("a&&f(b&&c)&&d", "&&")).toEqual(["a", "f(b&&c)", "d"]);
	});
});
