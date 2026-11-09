// What kinds `setting` and `setting-key` share: the item of one key, with its description as detail.
import { constString, type Module, type Node } from "../../ast.ts";
import { asNode, short, type SurfaceItem } from "../common.ts";

/** The `.describe("…")` text of the outer zod chain of a getter `()=>z…describe("…").optional()`. */
export const describe = (
	m: Module,
	n: Node | undefined,
): string | undefined => {
	let cur = n?.type === "ArrowFunctionExpression" ? asNode(n.body) : n;
	while (
		cur?.type === "CallExpression" &&
		cur.callee.type === "MemberExpression"
	) {
		const p = cur.callee.property;
		if (p.type === "Identifier" && p.name === "describe") {
			return constString(m, asNode(cur.arguments[0]));
		}
		cur = asNode(cur.callee.object);
	}
	return undefined;
};

export const item = (
	kind: string,
	m: Module,
	name: string,
	value: Node,
	offset: number,
	gate?: string,
): SurfaceItem => {
	const d = describe(m, value);
	return {
		kind,
		name,
		module: m.name,
		offset,
		...(d !== undefined && d !== "" && { detail: short(d) }),
		...(gate !== undefined && gate !== "" && { gate }),
	};
};
