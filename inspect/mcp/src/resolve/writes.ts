import type { Module, Node } from "../ast.ts";
import { asNode } from "../ast/node.ts";

/** The node at `at` when it is the property of a member expression that a plain `=` writes. */
const writtenValue = (mod: Module, at: number): Node | undefined => {
	const prop = mod.nodeAt(at);
	const member = mod.parent(prop);
	const write = member && mod.parent(member);
	if (
		member?.type !== "MemberExpression" ||
		member.property !== prop ||
		write?.type !== "AssignmentExpression" ||
		write.operator !== "=" ||
		write.left !== member
	) {
		return undefined;
	}
	return asNode(write.right);
};

/** The right side of each `x.key=value` in the program, with its module. */
export const propertyWrites = (
	m: Module,
	key: string,
): { mod: Module; value: Node }[] => {
	const needle = `.${key}=`;
	const out: { mod: Module; value: Node }[] = [];
	for (const mod of m.bundle?.withText(needle) ?? [m]) {
		for (
			let at = mod.text.indexOf(needle);
			at !== -1;
			at = mod.text.indexOf(needle, at + 1)
		) {
			const value = writtenValue(mod, at + 1);
			if (value) {
				out.push({ mod, value });
			}
		}
	}
	return out;
};
