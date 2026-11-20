import { expect, test } from "bun:test";

import { buildNames } from "./build-names.ts";

test("finds a build of the program and its line", () => {
	// Arrange
	const text =
		'{\n\t"env:X": "no code that reads it was found in 2.1.328 (chunk-a.js:4)."\n}';

	// Act
	const found = buildNames(text, "2.1.329");

	// Assert
	expect(found).toEqual([{ line: 2, build: "2.1.328" }]);
});

test("skips library versions and longer numbers", () => {
	// Arrange
	const text = "uses axios 2.4.0, node 4.14.1, and the address 12.1.329.4";

	// Act
	const found = buildNames(text, "2.1.329");

	// Assert
	expect(found).toEqual([]);
});
