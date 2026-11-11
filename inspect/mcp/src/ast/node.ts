import type * as O from "@oxc-project/types";

/** A node of the ESTree that oxc-parser gives; each one has `start` and `end`. */
export type Node = O.Node;
/** The node of `Node` whose `type` can be `T`. A function or a class has one node for several types. */
export type NodeOf<T extends Node["type"]> = Node extends infer N
	? N extends { type: infer U }
		? T extends U
			? N
			: never
		: never
	: never;
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

const holds = (x: unknown, pos: number): x is Node =>
	isNode(x) && x.start <= pos && pos < x.end;

// The item of one list field that holds `pos`. The items of a list are in source order, so a binary search
// finds it: the body of a module can have thousands of statements.
const itemAt = (list: unknown[], pos: number): Node | undefined => {
	let lo = 0;
	let hi = list.length;
	while (lo < hi) {
		const mid = Math.floor((lo + hi) / 2);
		const x: unknown = list[mid];
		if (!isNode(x)) {
			// An array with a hole (`[,a]`) has a null item.
			return list.find((y) => holds(y, pos));
		}
		if (x.end <= pos) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	const x: unknown = list[lo];
	return holds(x, pos) ? x : undefined;
};

/** The first of `children(n)` that holds index `pos`, found without the list of the children. */
export const childAt = (n: Node, pos: number): Node | undefined => {
	const hashbang = n.type === "Program" ? n.hashbang : undefined;
	let found: Node | undefined;
	for (const v of Object.values(n)) {
		const x: unknown = Array.isArray(v) ? itemAt(v, pos) : v;
		if (holds(x, pos) && x !== hashbang && (!found || x.start < found.start)) {
			found = x;
		}
	}
	return found;
};
