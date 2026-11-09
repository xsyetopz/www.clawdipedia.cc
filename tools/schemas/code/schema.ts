// Schema building from resolved values: objects, literals, and the JSON type the code shows for a value.

import type { Node } from "../../../inspect/mcp/src/ast.ts";
import type { Entry, Val } from "../../../inspect/mcp/src/resolve.ts";
import { type Json, type Mode, R, UNVERIFIED } from "./ctx.ts";

export const objSchema = (
	entries: Entry[],
	mode: Mode,
	depth = 0,
	open = false,
): Json => {
	const properties: Record<string, Json> = {};
	for (const e of R.spreads(entries)) {
		if (!("key" in e)) {
			continue;
		}
		const next = properties[e.key];
		const here = valSchema(e.val, mode, depth + 1);
		// The same key twice (a spread then an override): the later one wins, as in JavaScript.
		properties[e.key] =
			next !== undefined &&
			here["x-unverified"] === true &&
			next["x-unverified"] !== true
				? next
				: here;
	}
	// An open object may also be another value, so only its keys are known.
	return open ? { properties } : { type: "object", properties };
};

export const valSchema = (v: Val, mode: Mode, depth: number): Json => {
	switch (v.k) {
		case "obj": {
			return objSchema(v.e, mode, depth, v.open);
		}
		case "str": {
			if (mode === "const") {
				return { const: v.v };
			}
			return mode === "default"
				? { type: "string", default: v.v }
				: { type: "string" };
		}
		case "enum": {
			return mode === "const" ? { enum: v.v } : { type: "string" };
		}
		case "num": {
			return mode === "default"
				? { type: "number", default: v.v }
				: { type: "number" };
		}
		case "bool": {
			return mode === "default"
				? { type: "boolean", default: v.v }
				: { type: "boolean" };
		}
		case "arr": {
			return { type: "array" };
		}
		case "unk": {
			if (depth < 4) {
				const asObj = R.objectValue(v);
				if (asObj) {
					return objSchema(asObj, mode, depth);
				}
			}
			return valType(v);
		}
		default: {
			return valType(v);
		}
	}
};

/** A literal that copies a line: `{...line, ...}`. */
export const copies = (n: Node | undefined): boolean =>
	n?.type === "ObjectExpression" && n.properties[0]?.type === "SpreadElement";
/** The JSON type the code shows for a value, or x-unverified when it shows none. */
export const valType = (v: Val): Json => {
	const t = R.typeOfVal(v);
	return t ? { type: t.length === 1 ? t[0] : t } : { ...UNVERIFIED };
};
