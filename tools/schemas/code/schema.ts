// Schema building from resolved values: objects, literals, and the JSON type the code shows for a value.

import type { Node } from "../../../inspect/mcp/src/ast.ts";
import type { Entry, Val } from "../../../inspect/mcp/src/resolve.ts";
import { mapSeq } from "../../../inspect/mcp/src/seq.ts";
import { type Json, type Mode, R, UNVERIFIED } from "./ctx.ts";

export const objSchema = async (
	entries: Entry[],
	mode: Mode,
	depth = 0,
	open = false,
): Promise<Json> => {
	const properties: Record<string, Json> = {};
	const spread = await R.spreads(entries);
	const schemas = await mapSeq(spread, async (e): Promise<Json | undefined> => {
		if (!("key" in e)) {
			return undefined;
		}
		const schema = await valSchema(e.val, mode, depth + 1);
		return schema;
	});
	for (const [i, e] of spread.entries()) {
		const here = schemas[i];
		if (!("key" in e) || here === undefined) {
			continue;
		}
		const next = properties[e.key];
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

export const valSchema = async (
	v: Val,
	mode: Mode,
	depth: number,
): Promise<Json> => {
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
				const asObj = await R.objectValue(v);
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
export const valType = async (v: Val): Promise<Json> => {
	const t = await R.typeOfVal(v);
	return t ? { type: t.length === 1 ? t[0] : t } : { ...UNVERIFIED };
};
