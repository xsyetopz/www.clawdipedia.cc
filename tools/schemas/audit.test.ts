import { expect, test } from "bun:test";

import { auditFields, auditPasses } from "./audit.ts";

const manual = {
	$comment: "",
	version: "",
	fields: {
		"a.id": { schema: { type: "string" }, anchors: ["id:"], note: "" },
		"a.n": { schema: { type: "integer" }, anchors: ["n:"], note: "" },
	},
};
const has = (s: string): boolean => s === "id:" || s === "n:";

test("a typed field with agreeing payloads is 'samples agree'", () => {
	// Act
	const [row] = auditFields(["a.id"], manual, has, { "a.id": { string: 3 } });

	// Assert
	expect(row).toEqual({
		path: "a.id",
		verdict: "samples agree",
		missing: [],
		missed: [],
		samples: 3,
	});
});

test("a typed field with no payload is 'code only'", () => {
	// Act
	const [row] = auditFields(["a.n"], manual, has, {});

	// Assert
	expect(row?.verdict).toBe("code only");
});

test("an integer type accepts payloads seen as integers", () => {
	// Act
	const [row] = auditFields(["a.n"], manual, has, { "a.n": { integer: 2 } });

	// Assert
	expect(row?.verdict).toBe("samples agree");
});

test("a payload type the entry does not allow is a conflict, and the audit fails", () => {
	// Act
	const rows = auditFields(["a.id"], manual, has, { "a.id": { number: 1 } });

	// Assert
	expect(rows[0]).toMatchObject({ verdict: "conflict", missed: ["number"] });
	expect(auditPasses(rows)).toBe(false);
});

test("an anchor the program lacks makes the field 'anchor gone'", () => {
	// Act
	const [row] = auditFields(["a.id"], manual, (s) => s === "n:", {});

	// Assert
	expect(row).toMatchObject({ verdict: "anchor gone", missing: ["id:"] });
});

test("a field with no manual entry is 'no entry', and the audit fails", () => {
	// Act
	const rows = auditFields(["b.x"], manual, has, {});

	// Assert
	expect(rows[0]?.verdict).toBe("no entry");
	expect(auditPasses(rows)).toBe(false);
});

test("the audit passes when every field is 'code only' or 'samples agree'", () => {
	// Act
	const rows = auditFields(["a.id", "a.n"], manual, has, {
		"a.id": { string: 1 },
	});

	// Assert
	expect(auditPasses(rows)).toBe(true);
});
