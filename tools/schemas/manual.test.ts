import { describe, expect, test } from "bun:test";

import { anchorIn, applyManual } from "./manual.ts";

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
		expect(out.stale).toEqual(["a.gone: no x-unverified field at this path"]);
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
