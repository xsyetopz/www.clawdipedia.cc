// Run: bun test tools/release/probes/print/sig.test.ts
import { expect, test } from "bun:test";

import { diffSample } from "./sig.ts";

test("a long pair that shares a prefix is sampled where it first differs", () => {
	const head = "x".repeat(1000);
	const [a, b] = diffSample(`${head}AAA tail`, `${head}BBB tail`, 50);
	expect(a).toContain("AAA");
	expect(b).toContain("BBB");
	expect(a.length).toBeLessThanOrEqual(51);
});

test("a short pair is kept whole", () => {
	expect(diffSample("abc", "abd", 50)).toEqual(["abc", "abd"]);
});

test("a value that is a prefix of the other is sampled at its end", () => {
	const head = "y".repeat(1000);
	const [a, b] = diffSample(head, `${head}MORE`, 50);
	expect(a.startsWith("…")).toBe(true);
	expect(b).toContain("MORE");
});
