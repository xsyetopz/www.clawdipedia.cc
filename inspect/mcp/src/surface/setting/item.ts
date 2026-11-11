// What kinds `setting` and `setting-key` share: the item of one key, with its description as detail.
import { constString, type Module, type Node } from "../../ast.ts";
import { asNode, short, type SurfaceItem } from "../common.ts";

/** The `.describe("…")` text of the outer zod chain of a getter `()=>z…describe("…").optional()`. */
export const describe = (
	m: Module,
	n: Node | undefined,
): Promise<string | undefined> => {
	const walk = async (cur: Node | undefined): Promise<string | undefined> => {
		if (
			cur?.type !== "CallExpression" ||
			cur.callee.type !== "MemberExpression"
		) {
			return undefined;
		}
		const p = cur.callee.property;
		if (p.type === "Identifier" && p.name === "describe") {
			const text = await constString(m, asNode(cur.arguments[0]));
			return text;
		}
		const found = await walk(asNode(cur.callee.object));
		return found;
	};
	return walk(n?.type === "ArrowFunctionExpression" ? asNode(n.body) : n);
};

export const item = async (
	kind: string,
	m: Module,
	name: string,
	value: Node,
	offset: number,
	gate?: string,
): Promise<SurfaceItem> => {
	const d = await describe(m, value);
	return {
		kind,
		name,
		module: m.name,
		offset,
		...(d !== undefined && d !== "" && { detail: short(d) }),
		...(gate !== undefined && gate !== "" && { gate }),
	};
};
