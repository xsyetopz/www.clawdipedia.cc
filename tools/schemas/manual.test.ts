import { describe, expect, test } from "bun:test";

import { anchorIn, applyManual, staleUnsent } from "./manual.ts";

const unk = { "x-unverified": true };
const schema = {
	$defs: {
		a: { properties: { id: unk, n: unk } },
		b: { properties: { id: unk } },
	},
};
const fx = (anchors: string[]) => ({
	$comment: "",
	version: "",
	fields: {
		"a.id": { schema: { type: ["string", "null"] }, anchors, note: "" },
	},
});

describe("applyManual", () => {
	test("types the field when its anchor is in the program, and only that field", async () => {
		const out = await applyManual(
			"x.json",
			schema,
			(s) => s === "id:",
			fx(["id:"]),
			{},
		);
		expect(out.n).toBe(1);
		expect(out.stale).toEqual([]);
		expect(out.schema).toEqual({
			$defs: {
				a: { properties: { id: { type: ["string", "null"] }, n: unk } },
				b: { properties: { id: unk } },
			},
		});
	});
	test("leaves the field unverified and reports it when the anchor is gone", async () => {
		const out = await applyManual(
			"x.json",
			schema,
			() => false,
			fx(["id:"]),
			{},
		);
		expect(out.n).toBe(0);
		expect(out.stale).toEqual(["a.id: anchor not in the program: id:"]);
		expect(out.schema).toEqual(schema);
	});
	test("reports an entry for a path that is not unverified", async () => {
		const f = fx(["id:"]);
		const out = await applyManual(
			"x.json",
			schema,
			() => true,
			{
				...f,
				fields: { ...f.fields, "a.gone": f.fields["a.id"] },
			},
			{},
		);
		expect(out.stale).toEqual([
			"a.gone: no x-unverified field or item-less array at this path",
		]);
	});
	test("gives an item-less array its hand-read items, and leaves a typed array alone", async () => {
		// Arrange
		const arrays = {
			$defs: {
				a: {
					properties: {
						open: { type: "array" },
						typed: { type: "array", items: { type: "integer" } },
					},
				},
			},
		};
		const entry = {
			schema: { type: "array", items: { type: "string" } },
			anchors: ["id:"],
			note: "",
		};
		const manual = {
			$comment: "",
			version: "",
			fields: { "a.open": entry, "a.typed": entry },
		};

		// Act
		const out = await applyManual("x.json", arrays, () => true, manual, {});

		// Assert
		expect(out.n).toBe(1);
		expect(out.stale).toEqual([
			"a.typed: no x-unverified field or item-less array at this path",
		]);
		expect(out.schema).toEqual({
			$defs: {
				a: {
					properties: {
						open: { type: "array", items: { type: "string" } },
						typed: { type: "array", items: { type: "integer" } },
					},
				},
			},
		});
	});
	test("reports a type real payloads had that the entry does not allow", async () => {
		const out = await applyManual("x.json", schema, () => true, fx(["id:"]), {
			"a.id": { string: 5, number: 2, null: 1 },
		});
		expect(out.missed).toEqual(["a.id: real payloads also had number"]);
	});
});

describe("anchorIn", () => {
	const has = anchorIn(
		"var aPo={skill:f(()=>sPo().strict())};name:mg().optional()",
	);
	test("matches a renamed identifier at each «»", () => {
		expect(has("«»={skill:«»(()=>«»().strict())}")).toBe(true);
		expect(has("name:«»().optional()")).toBe(true);
	});
	test("does not match when the fixed text differs", () => {
		expect(has("name:«»().required()")).toBe(false);
		expect(has("«».«»")).toBe(false);
	});
});

const unsentEntry = (anchors: string[]) => ({
	schema: { type: "string" },
	anchors,
	note: "",
});

describe("staleUnsent", () => {
	test("reports an unsent entry whose anchor is gone or whose path the schema has", () => {
		// Arrange
		const f = {
			...fx(["id:"]),
			unsent: {
				"a.gone": unsentEntry(["id:"]),
				"b.lost": unsentEntry(["lost:"]),
				"b.id": unsentEntry(["id:"]),
			},
		};

		// Act
		const out = staleUnsent(f, schema, (s) => s === "id:");

		// Assert
		expect(out).toEqual([
			"unsent b.lost: anchor not in the program: lost:",
			'unsent b.id: the schema has this path; move the entry to "fields"',
		]);
	});
});
