import { expect, test } from "bun:test";

import { entryFromCitations, remap, similarity } from "./remap.ts";
import { factsFromFile } from "./scan.ts";
import type { Fact } from "./types.ts";

const FILE = "docs/page.md";

/** The facts of a page as release:facts finds them, all unmapped. */
const factsOf = (content: string): Fact[] => {
	const hits = content
		.split("\n")
		.flatMap((l, i) => (/2\.1\.[0-9]+/u.test(l) ? [i + 1] : []));
	return factsFromFile(FILE, content, hits);
};

const page = (body: string): string => `# Page\n\n## Part\n\n${body}\n`;

test("an edited sentence takes over the entry of the sentence it replaced", () => {
	// Arrange
	const before = page(
		"Since `2.1.300`, the tool reads the whole file at once.",
	);
	const now = page(
		"Since `2.1.300`, the tool reads the whole file at once, and fast.",
	);
	const [old] = factsOf(before);
	const entry = { kind: "manual" as const, probes: [], note: "kept note" };
	const map = { [old?.id ?? ""]: entry };

	// Act
	const r = remap({
		facts: factsOf(now),
		map,
		before: new Map([[FILE, before]]),
		now: new Map([[FILE, now]]),
	});

	// Assert
	expect(Object.values(r.map)).toEqual([entry]);
	expect(r).toMatchObject({
		renamed: 1,
		sourced: 0,
		dropped: 0,
		unsourced: [],
	});
});

test("a new sentence takes its source from the footnote of its own line", () => {
	// Arrange
	const now = page(
		"Since `2.1.327`, it stops.[^a]\n\n[^a]: The program, `chunk-ab12cd34.js:5678`. [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).",
	);
	const facts = factsOf(now);
	const sentence = facts.find((f) => f.text.startsWith("Since"));

	// Act
	const r = remap({
		facts,
		map: {},
		before: new Map(),
		now: new Map([[FILE, now]]),
	});

	// Assert
	expect(r.map[sentence?.id ?? ""]).toEqual({
		kind: "manual",
		probes: [],
		note: "read in the program at chunk-ab12cd34.js:5678; release notes 2.1.327",
	});
});

test("a sentence with no footnote of its own takes the footnote of its paragraph", () => {
	// Arrange
	const lines = [
		"Since `2.1.327`, it stops.",
		"It also waits.[^n]",
		"",
		"[^n]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).",
	];

	// Act
	const entry = entryFromCitations(lines.join("\n"), {
		line: 1,
		text: "Since `2.1.327`, it stops.",
	});

	// Assert
	expect(entry).toEqual({
		kind: "external",
		probes: [],
		note: "cites the 2.1.327 release notes",
	});
});

test("a sentence with no citation stays out of the map and is reported", () => {
	// Arrange
	const now = page("Since `2.1.327`, it stops.");
	const facts = factsOf(now);

	// Act
	const r = remap({
		facts,
		map: {},
		before: new Map(),
		now: new Map([[FILE, now]]),
	});

	// Assert
	expect(r.map).toEqual({});
	expect(r.unsourced.map((f) => f.id)).toEqual(facts.map((f) => f.id));
});

test("a second run keeps the entries that the first run passed on", () => {
	// Arrange
	const before = page(
		"Since `2.1.300`, the tool reads the whole file at once.",
	);
	const now = page(
		"Since `2.1.300`, the tool reads the whole file at once, and fast.",
	);
	const [old] = factsOf(before);
	const map = {
		[old?.id ?? ""]: { kind: "manual" as const, probes: [], note: "kept note" },
	};
	const texts = {
		before: new Map([[FILE, before]]),
		now: new Map([[FILE, now]]),
	};
	const first = remap({ facts: factsOf(now), map, ...texts });
	const mapped = factsOf(now);
	for (const f of mapped) {
		f.status = "mapped";
	}

	// Act
	const second = remap({ facts: mapped, map: first.map, ...texts });

	// Assert
	expect(second.map).toEqual(first.map);
});

test("similarity is 1 when one sentence holds every word of the other", () => {
	// Act
	const score = similarity("reads the file", "it reads the file now");

	// Assert
	expect(score).toBe(1);
});

test("an info fact with no citation is not reported, because the gate holds only change facts", () => {
	// Arrange
	const now = page("The `2.1.327` build reads the file.");
	const facts = factsOf(now);

	// Act
	const r = remap({
		facts,
		map: {},
		before: new Map(),
		now: new Map([[FILE, now]]),
	});

	// Assert
	expect(facts.map((f) => f.class)).toEqual(["info"]);
	expect(r.unsourced).toEqual([]);
});
