import { describe, expect, test } from "bun:test";

import {
	anchorIn,
	applyManual,
	minifiedNames,
	readManual,
	staleUnsent
} from "./manual.ts";

const unk = { "x-unverified": true };
const schema = {
	$defs: {
		a: { properties: { id: unk, n: unk } },
		b: { properties: { id: unk } }
	}
};
const fx = (anchors: string[]) => ({
	$comment: "",
	version: "",
	fields: {
		"a.id": { schema: { type: ["string", "null"] }, anchors, note: "" }
	}
});

describe("applyManual", () => {
	test("types the field when its anchor is in the program, and only that field", async () => {
		const out = await applyManual(
			"x.json",
			schema,
			(s) => s === "id:",
			fx(["id:"]),
			{}
		);
		expect(out.n).toBe(1);
		expect(out.stale).toEqual([]);
		expect(out.schema).toEqual({
			$defs: {
				a: { properties: { id: { type: ["string", "null"] }, n: unk } },
				b: { properties: { id: unk } }
			}
		});
	});
	test("leaves the field unverified and reports it when the anchor is gone", async () => {
		const out = await applyManual(
			"x.json",
			schema,
			() => false,
			fx(["id:"]),
			{}
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
				fields: { ...f.fields, "a.gone": f.fields["a.id"] }
			},
			{}
		);
		expect(out.stale).toEqual([
			"a.gone: no x-unverified field or item-less array at this path"
		]);
	});
	test("gives an item-less array its hand-read items, and leaves a typed array alone", async () => {
		// Arrange
		const arrays = {
			$defs: {
				a: {
					properties: {
						open: { type: "array" },
						typed: { type: "array", items: { type: "integer" } }
					}
				}
			}
		};
		const entry = {
			schema: { type: "array", items: { type: "string" } },
			anchors: ["id:"],
			note: ""
		};
		const manual = {
			$comment: "",
			version: "",
			fields: { "a.open": entry, "a.typed": entry }
		};

		// Act
		const out = await applyManual("x.json", arrays, () => true, manual, {});

		// Assert
		expect(out.n).toBe(1);
		expect(out.stale).toEqual([
			"a.typed: no x-unverified field or item-less array at this path"
		]);
		expect(out.schema).toEqual({
			$defs: {
				a: {
					properties: {
						open: { type: "array", items: { type: "string" } },
						typed: { type: "array", items: { type: "integer" } }
					}
				}
			}
		});
	});
	test("reports a type real payloads had that the entry does not allow", async () => {
		const out = await applyManual("x.json", schema, () => true, fx(["id:"]), {
			"a.id": { string: 5, number: 2, null: 1 }
		});
		expect(out.missed).toEqual(["a.id: real payloads also had number"]);
	});
});

describe("anchorIn", () => {
	const has = anchorIn(
		"var aPo={skill:f(()=>sPo().strict())};name:mg().optional()"
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
	note: ""
});

describe("staleUnsent", () => {
	test("reports an unsent entry whose anchor is gone or whose path the schema has", () => {
		// Arrange
		const f = {
			...fx(["id:"]),
			unsent: {
				"a.gone": unsentEntry(["id:"]),
				"b.lost": unsentEntry(["lost:"]),
				"b.id": unsentEntry(["id:"])
			}
		};

		// Act
		const out = staleUnsent(f, schema, (s) => s === "id:");

		// Assert
		expect(out).toEqual([
			"unsent b.lost: anchor not in the program: lost:",
			'unsent b.id: the schema has this path; move the entry to "fields"'
		]);
	});
});

describe("minifiedNames", () => {
	test("reports a minified name where the anchor needs «»", () => {
		expect(
			minifiedNames("...n?.contextUsage!==void 0&&{contextUsage:«»}")
		).toEqual(["n"]);
		expect(minifiedNames("messageCount:n")).toEqual(["n"]);
		expect(minifiedNames('IYe({type:"x",sessionId:W()})')).toEqual([
			"IYe",
			"W"
		]);
		expect(minifiedNames("!Ee.incomplete)V.push({v:1})")).toEqual(["Ee", "V"]);
		expect(minifiedNames("let n=_il.find((s)=>s===e.type)")).toEqual([
			"n",
			"_il",
			"s",
			"s",
			"e"
		]);
		expect(minifiedNames("function xO(«»){}")).toEqual(["xO"]);
	});
	test("reports a name inside a template expression, not the template text", () => {
		// Joined from parts so this source holds no "${" that reads as a misplaced template.
		const anchor = ["`n $", "{e.host} to $", "{«».port}`"].join("");
		expect(minifiedNames(anchor)).toEqual(["e"]);
	});
	test("accepts keys, properties, keywords, literals, strings, and regex literals", () => {
		const fine = [
			'{type:"tools-used",v:1,id:«»,as:«»}',
			"x:«».id,y:«»?.url,...«».at(0)",
			"uuid:«»(),isMeta:!1,a:!0,b:void 0,c:new Date().toISOString()",
			'return typeof «»==="string"?this.name:null',
			"var «»=/^[A-Za-z0-9_.:-]{1,256}$/,",
			"content:\"e n h\",k:'t'",
			"for(let «» of «»)new Set"
		];
		for (const a of fine) {
			expect(minifiedNames(a)).toEqual([]);
		}
	});
	test("flags none of the anchors of the committed fixtures", async () => {
		const files = [
			"claude-code-claude-json.json",
			"claude-code-frontmatter.json",
			"claude-code-otel.json",
			"claude-code-status-line.json",
			"claude-code-transcript.json"
		];
		const fixtures = await Promise.all(files.map((f) => readManual(f)));
		const bad = fixtures.flatMap((m, i) =>
			[...Object.entries(m?.fields ?? {}), ...Object.entries(m?.unsent ?? {})]
				.flatMap(([p, e]) => e.anchors.map((a) => ({ p, a })))
				.filter(({ a }) => minifiedNames(a).length > 0)
				.map(({ p, a }) => `${files[i]} ${p}: ${a}`)
		);
		expect(bad).toEqual([]);
	});
	test("makes applyManual report an anchor that hard-codes a minified name", async () => {
		const out = await applyManual(
			"x.json",
			schema,
			() => true,
			fx(["id:n"]),
			{}
		);
		expect(out.n).toBe(0);
		expect(out.stale).toEqual([
			"a.id: anchor hard-codes a minified name: n in id:n (use «» for each)"
		]);
	});
});
