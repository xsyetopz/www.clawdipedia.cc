import { expect, test } from "bun:test";

import { parseFrontMatter } from "./front-matter.ts";

test("reads front matter keys as strings and the line where the body starts", () => {
	// Arrange
	const text =
		'---\ntitle: Clock\ndescription: "a: b"\nsidebar_position: 14\ngenerated: false\n---\n\nBody';

	// Act
	const fm = parseFrontMatter(text);

	// Assert
	expect(fm).toEqual({
		data: {
			title: "Clock",
			description: "a: b",
			sidebar_position: "14",
			generated: "false"
		},
		bodyStart: 6
	});
});

test("finds no front matter without an opening fence", () => {
	// Arrange
	const text = "# Title\n";

	// Act
	const fm = parseFrontMatter(text);

	// Assert
	expect(fm).toBeNull();
});

test("rejects a plain value with a colon that the site build cannot parse", () => {
	// Arrange
	const text =
		"---\ntitle: Clock\ndescription: The nouns: time and timers.\n---\n";

	// Act
	const parse = (): unknown => parseFrontMatter(text);

	// Assert
	expect(parse).toThrow("front matter is not valid YAML");
});
