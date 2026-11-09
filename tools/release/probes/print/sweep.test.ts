// Run: bun test tools/release/probes/print/sweep.test.ts
import { expect, test } from "bun:test";

import { mergeSweep } from "./sweep.ts";

const prev = {
	data: {
		skipped: ["SECRET_TOKEN"],
		"A.A": [],
		"A.B": [],
		"B.A": ["m0.beta"],
		"B.B": [],
		changed: ["B"],
		errors: [],
	},
	samples: { "B.A.m0.beta": "x => y" },
};

test("a partial run replaces its names and keeps the others", () => {
	const out = mergeSweep(
		prev,
		{ "B.A": [], "B.B": [], "C.A": ["m0.system"], "C.B": [], skipped: [] },
		{ "C.A.m0.system": "p => q" },
		["B", "C"],
	);
	expect(out.data["B.A"]).toEqual([]);
	expect(out.data["A.A"]).toEqual([]);
	expect(out.data["changed"]).toEqual(["C"]);
	expect(out.data["names"]).toBe(3);
	expect(out.data["skipped"]).toEqual(["SECRET_TOKEN"]);
	expect(out.samples).toEqual({ "C.A.m0.system": "p => q" });
});

test("a name that turns skipped leaves the swept names", () => {
	const out = mergeSweep(prev, { skipped: ["A"] }, {}, ["A"]);
	expect(out.data["A.A"]).toBeUndefined();
	expect(out.data["skipped"]).toEqual(["A", "SECRET_TOKEN"]);
});
