// Transcript lines: keys that no write-site literal has, from a probe or from the code.
import type { Node } from "../../../inspect/mcp/src/ast.ts";
import type { Module } from "../../../inspect/mcp/src/ast/module.ts";
import { mapSeq } from "../../../inspect/mcp/src/seq.ts";
import { isStringArray, type Json, markObserved, note, R } from "./ctx.ts";
import { valType } from "./schema.ts";
import { addedKeys } from "./transcript-added.ts";
import { laterWrite } from "./transcript-write.ts";

/** A write site: the module and the offset of its literal. */
interface Site {
	src: Module;
	at: number;
}

/** Add the keys a probe saw that no constructor has: find the later write of each. */
export const addProbeKeys = async (
	t: string,
	schema: Json,
	withType: Record<string, Json>,
	seen: unknown
): Promise<void> => {
	if (!isStringArray(seen)) {
		return;
	}
	const lost: string[] = [];
	await mapSeq(
		seen.filter((s) => !(s in withType)),
		async (k) => {
			const site = await laterWrite(k);
			if (site) {
				withType[k] = site;
			} else {
				lost.push(k);
			}
		}
	);
	markObserved(schema, seen);
	if (lost.length > 0) {
		note(`transcript ${t}: probe keys with no write site: ${lost.join(", ")}`);
	}
};

/** Add the keys the code writes after a constructor builds the line: a spread literal or a member assignment. */
export const addCodeKeys = async (
	use: readonly Site[],
	withType: Record<string, Json>
): Promise<void> => {
	const roots = use.flatMap((s) => {
		let obj: Node | undefined = s.src.nodeAt(s.at);
		while (obj && obj.type !== "ObjectExpression") {
			obj = s.src.parent(obj);
		}
		return obj ? [{ src: s.src, obj }] : [];
	});
	const added = await addedKeys(R, roots);
	await mapSeq([...added], async ([k, val]) => {
		if (!(k in withType)) {
			withType[k] = {
				...(await valType(val)),
				$comment:
					"Added after a constructor builds the line, by a spread literal or a member assignment."
			};
		}
	});
};
