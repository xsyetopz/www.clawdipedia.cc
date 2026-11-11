import type * as O from "@oxc-project/types";

/** A node of the ESTree that oxc-parser gives; each one has `start` and `end`. */
export type Node = O.Node;
/** The node of `Node` whose `type` is `T`. */
export type NodeOf<T extends Node["type"]> = Extract<Node, { type: T }>;
export type Fn = O.Function | O.ArrowFunctionExpression;

export const isNode = (x: unknown): x is Node =>
	typeof x === "object" &&
	x !== null &&
	"type" in x &&
	typeof x.type === "string" &&
	"start" in x &&
	typeof x.start === "number";

/** The value as a `Node`, or undefined when it is not one. */
export const asNode = (x: unknown): Node | undefined =>
	isNode(x) ? x : undefined;

export const isFn = (n: Node | null | undefined): n is Fn =>
	n?.type === "FunctionDeclaration" ||
	n?.type === "FunctionExpression" ||
	n?.type === "ArrowFunctionExpression";

/** A value written in the code: string, number, boolean, null, regex, or bigint. A template is not one. */
export const isLit = (n: Node | null | undefined): n is NodeOf<"Literal"> =>
	n?.type === "Literal";

/** The text of a string literal, or undefined for any other node. */
export const strLit = (n: Node | null | undefined): string | undefined =>
	n?.type === "Literal" && typeof n.value === "string" ? n.value : undefined;

/** Whether `n` is `null` in the code. A regex that the runtime cannot build has a null value too. */
export const isNull = (n: Node | null | undefined): boolean =>
	n?.type === "Literal" && n.value === null && !("regex" in n);

/** The value of a literal: `null` for `null`, the digits for a bigint, and undefined for a regex. */
export const litValue = (n: NodeOf<"Literal">): unknown => {
	if ("regex" in n) {
		return undefined;
	}
	return "bigint" in n ? n.bigint : n.value;
};

/** The child nodes of `n`, in source order. */
export const children = (n: Node): Node[] => {
	const out: Node[] = [];
	const hashbang = n.type === "Program" ? n.hashbang : undefined;
	let sorted = true;
	const add = (x: unknown): void => {
		if (isNode(x) && x !== hashbang) {
			sorted &&= (out.at(-1)?.start ?? 0) <= x.start;
			out.push(x);
		}
	};
	for (const v of Object.values(n)) {
		if (Array.isArray(v)) {
			for (const x of v) {
				add(x);
			}
		} else {
			add(v);
		}
	}
	// The parser gives most nodes with the fields in source order, and the walk of a module asks for each node.
	return sorted ? out : out.toSorted((a, b) => a.start - b.start);
};
