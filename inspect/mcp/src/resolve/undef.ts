// Whether an expression gives undefined, which JSON drops, while the entries of a returned object are read.
import type { Module, Node, NodeOf } from "../ast.ts";
import { isNull } from "../ast/node.ts";
import { isVoid } from "./tables.ts";
import type { Entry, Env } from "./types.ts";

type Undef = (n: Node | null | undefined) => boolean;

const isUndefIdentifier = (
	dm: Module,
	inner: Env,
	n: NodeOf<"Identifier">,
	undef: Undef,
): boolean => {
	const v = dm.variable(n);
	if (!v) {
		return false;
	}
	if (inner.has(v)) {
		return inner.get(v) === null;
	}
	const d = v.defs[0];
	const writes = v.references.filter((r) => r.write && !r.init);
	return (
		d?.type === "Variable" &&
		writes.length === 0 &&
		d.node.init !== null &&
		undef(d.node.init)
	);
};

const isUndefConditional = (
	n: NodeOf<"ConditionalExpression">,
	undef: Undef,
): boolean => {
	let test: Node = n.test;
	while (test.type === "LogicalExpression" && test.operator === "&&") {
		test = test.left;
	}
	return undef(test) && undef(n.alternate);
};

const isUndefLogical = (
	n: NodeOf<"LogicalExpression">,
	undef: Undef,
): boolean =>
	n.operator === "??"
		? undef(n.left) && undef(n.right)
		: n.operator === "&&" && undef(n.left);

/** Whether an expression gives undefined, which JSON drops; null stays. */
const isUndef = (
	dm: Module,
	inner: Env,
	n: Node | null | undefined,
): boolean => {
	if (isNull(n)) {
		return false;
	}
	if (!n || isVoid(n)) {
		return true;
	}
	const undef: Undef = (x) => isUndef(dm, inner, x);
	if (n.type === "Identifier") {
		return isUndefIdentifier(dm, inner, n, undef);
	}
	if (n.type === "LogicalExpression") {
		return isUndefLogical(n, undef);
	}
	if (n.type === "ConditionalExpression") {
		return isUndefConditional(n, undef);
	}
	return n.type === "MemberExpression" && n.optional && undef(n.object);
};

export const isUnset = (dm: Module, inner: Env, e: Entry): boolean =>
	"key" in e &&
	e.val.k === "unk" &&
	e.val.ref !== undefined &&
	isUndef(dm, inner, e.val.ref.n);
