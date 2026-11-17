import { describe, expect, test } from "bun:test";

import { MARKETPLACE } from "../version/bump.ts";
import { exists, manifestFile, mirrorProblems, PLUGINS } from "./plugins.ts";

describe("exists", () => {
	test("is true for a folder, a file, and false for a missing path", async () => {
		const found = await Promise.all(
			["tools/plugin", "tools/plugin/plugins.ts", "tools/plugin/none"].map(
				(p) => exists(p),
			),
		);
		expect(found).toEqual([true, true, false]);
	});
});

type Json = Record<string, unknown>;

/** A repo where each plugin manifest has `name` p0, p1, ... with license MIT and one keyword. */
const repo = (entries: Json[]): ((file: string) => Json) => {
	const files = new Map<string, Json>([
		[MARKETPLACE, { plugins: entries }],
		...PLUGINS.map((p, i): [string, Json] => [
			manifestFile(p.dir),
			{ name: `p${i}`, license: "MIT", keywords: [`k${i}`] },
		]),
	]);
	return (file) => files.get(file) ?? {};
};

describe("mirrorProblems", () => {
	test("finds nothing when each entry copies its manifest", () => {
		// Arrange
		const read = repo(
			PLUGINS.map((_, i) => ({
				name: `p${i}`,
				license: "MIT",
				keywords: [`k${i}`],
			})),
		);

		// Act
		const problems = mirrorProblems(read);

		// Assert
		expect(problems).toEqual([]);
	});

	test("names the entry and field when the keywords differ", () => {
		// Arrange
		const read = repo([{ name: "p0", license: "MIT", keywords: ["other"] }]);

		// Act
		const problems = mirrorProblems(read);

		// Assert
		expect(problems).toEqual([
			'marketplace entry "p0" keywords differs from its plugin manifest: copy it from plugin.json',
		]);
	});

	test("names the license when an entry leaves it out", () => {
		// Arrange
		const read = repo([{ name: "p0", keywords: ["k0"] }]);

		// Act
		const problems = mirrorProblems(read);

		// Assert
		expect(problems).toEqual([
			'marketplace entry "p0" license differs from its plugin manifest: copy it from plugin.json',
		]);
	});

	test("names an entry that no plugin manifest matches", () => {
		// Arrange
		const read = repo([{ name: "missing", license: "MIT", keywords: [] }]);

		// Act
		const problems = mirrorProblems(read);

		// Assert
		expect(problems).toEqual([
			'marketplace entry "missing" has no plugin manifest with that name',
		]);
	});
});
