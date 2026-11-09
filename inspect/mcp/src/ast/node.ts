import type * as t from "@babel/types";

export type Node = t.Node & { start: number; end: number };
export type Fn = Node &
	(
		| t.FunctionDeclaration
		| t.FunctionExpression
		| t.ArrowFunctionExpression
		| t.ObjectMethod
		| t.ClassMethod
		| t.ClassPrivateMethod
	);

export const isNode = (x: unknown): x is Node =>
	typeof x === "object" &&
	x !== null &&
	"type" in x &&
	typeof x.type === "string" &&
	"start" in x &&
	typeof x.start === "number";

/** The node as a located `Node`, or undefined when it has no position (a node the parser made up). */
export const asNode = (x: t.Node | null | undefined): Node | undefined =>
	isNode(x) ? x : undefined;

export const isFn = (n: Node | null | undefined): n is Fn =>
	n?.type === "FunctionDeclaration" ||
	n?.type === "FunctionExpression" ||
	n?.type === "ArrowFunctionExpression" ||
	n?.type === "ObjectMethod" ||
	n?.type === "ClassMethod" ||
	n?.type === "ClassPrivateMethod";

/** A value written in the code: string, number, boolean, null, regex, or bigint. A template is not one. */
export const isLit = (n: Node | null | undefined): boolean =>
	n !== null &&
	n !== undefined &&
	n.type !== "TemplateLiteral" &&
	n.type.endsWith("Literal");

/** The value of a literal: `null` for `null`, and undefined for a regex. */
export const litValue = (n: Node): unknown => {
	if (n.type === "NullLiteral") {
		return null;
	}
	return "value" in n ? n.value : undefined;
};

export type Method = Node &
	(t.ObjectMethod | t.ClassMethod | t.ClassPrivateMethod);
export const isMethod = (n: Node | null | undefined): n is Method =>
	n?.type === "ObjectMethod" ||
	n?.type === "ClassMethod" ||
	n?.type === "ClassPrivateMethod";

/** Where the function of a method starts: at its parameters, as ESTree's `value` did. A Babel method starts at its key. */
export const valueStart = (text: string, n: Method): number =>
	text.indexOf("(", n.key.end ?? 0);

/** The child nodes of `n`, in source order. */
export const children = (n: Node): Node[] => {
	const out: Node[] = [];
	for (const [k, v] of Object.entries(n)) {
		if (k === "loc" || k === "range" || k === "interpreter") {
			continue;
		}
		if (Array.isArray(v)) {
			for (const x of v) {
				if (isNode(x)) {
					out.push(x);
				}
			}
		} else if (isNode(v)) {
			out.push(v);
		}
	}
	return out.toSorted((a, b) => a.start - b.start);
};
