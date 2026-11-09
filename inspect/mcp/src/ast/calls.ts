// The call and function queries of a module: who a callee is, who calls a function, what a name holds.

import type * as t from "@babel/types";

import type { Module, Variable } from "../ast.ts";
import { asNode, children, type Fn, isFn, type Node } from "./node.ts";

/** The function a callee names: a declaration, or a variable whose only value is a function. */
export const functionOf = (
	m: Module,
	callee: Node,
): { module: Module; fn: Fn } | undefined => {
	if (callee.type !== "Identifier") {
		return undefined;
	}
	const v0 = m.variable(callee);
	const o =
		v0 && (m.bundle ? m.bundle.origin(m, v0) : { module: m, variable: v0 });
	if (!o) {
		return undefined;
	}
	const { module, variable: v } = o;
	for (const d of v.defs) {
		if (d.type === "FunctionName" && isFn(d.node)) {
			return { module, fn: d.node };
		}
		const init = d.type === "Variable" ? asNode(d.node.init) : undefined;
		if (isFn(init)) {
			const writes = v.references.filter((r) => r.write);
			if (writes.length <= 1) {
				return { module, fn: init };
			}
		}
	}
	// `var f; ... f=function(){}`: one write, of a function.
	const writes = v.references.filter((r) => r.write);
	const w = writes[0]?.writeExpr;
	if (writes.length === 1 && isFn(w)) {
		return { module, fn: w };
	}
	return undefined;
};

/** The variable that names a function: its declaration, `const f=()=>`, or `f=function(){}`. */
export const nameOf = (m: Module, fn: Fn): Variable | undefined => {
	const id = fn.type === "FunctionDeclaration" ? asNode(fn.id) : undefined;
	if (id) {
		return m.variable(id);
	}
	const p = m.parent(fn);
	if (p?.type === "VariableDeclarator" && p.id.type === "Identifier") {
		const n = asNode(p.id);
		return n && m.variable(n);
	}
	if (p?.type === "AssignmentExpression" && p.left.type === "Identifier") {
		const n = asNode(p.left);
		return n && m.variable(n);
	}
	return undefined;
};

export type CallNode = Node & t.CallExpression;
export interface Call {
	module: Module;
	call: CallNode;
}

/**
 * The calls of `fn`, in its module and in every module that imports it. An `undefined` in the list
 * means the function is used as a value somewhere, so not every call is known.
 */
export const callsOf = (m: Module, fn: Fn): (Call | undefined)[] => {
	const v = nameOf(m, fn);
	if (!v) {
		return [undefined];
	}
	const out: (Call | undefined)[] = [];
	scanRefs(out, fn, m, v);
	if (m.bundle) {
		for (const i of m.bundle.importers(m, v)) {
			scanRefs(out, fn, i.module, i.variable);
		}
	}
	return out;
};

/** Adds the call or the `undefined` each reference of `variable` makes, to `out`. */
const scanRefs = (
	out: (Call | undefined)[],
	fn: Fn,
	module: Module,
	variable: Variable,
) => {
	for (const r of variable.references) {
		if (r.init || (r.write && r.writeExpr === fn)) {
			continue;
		}
		const id = r.identifier;
		const p = module.parent(id);
		if (p?.type === "CallExpression" && p.callee === id) {
			out.push({ module, call: p });
		} else if (p?.type !== "ExportSpecifier") {
			out.push(undefined);
		}
	}
};

/** A string the expression always gives: a literal, or a name bound once to one (followed across imports). */
export const constString = (
	m: Module,
	n: Node | null | undefined,
	depth = 0,
): string | undefined => {
	if (!n || depth > 8) {
		return undefined;
	}
	if (n.type === "StringLiteral") {
		return n.value;
	}
	if (n.type === "TemplateLiteral" && n.expressions.length === 0) {
		return n.quasis[0]?.value.cooked ?? undefined;
	}
	if (n.type !== "Identifier") {
		return undefined;
	}
	const v0 = m.variable(n);
	const o =
		v0 && (m.bundle ? m.bundle.origin(m, v0) : { module: m, variable: v0 });
	if (!o) {
		return undefined;
	}
	const values = valuesOf(o.variable);
	if (values.length !== 1) {
		return undefined;
	}
	return constString(o.module, asNode(values[0]), depth + 1);
};

/** The values a variable gets: its declarator's initializer and each later write. */
const valuesOf = (variable: Variable) => {
	const def = variable.defs[0];
	const init = def?.type === "Variable" ? def.node.init : undefined;
	return [
		...(init ? [init] : []),
		...variable.references
			.filter((r) => r.write && !r.init)
			.map((r) => r.writeExpr),
	];
};

/** Each `return` value of `fn` (an arrow's expression body counts), not those of nested functions. */
export const returnsOf = (fn: Fn): (Node | null)[] => {
	const body = asNode(fn.body);
	if (!body) {
		return [];
	}
	if (body.type !== "BlockStatement") {
		return [body];
	}
	const out: (Node | null)[] = [];
	const stack: Node[] = [body];
	for (let n = stack.pop(); n; n = stack.pop()) {
		if (n.type === "ReturnStatement") {
			out.push(asNode(n.argument) ?? null);
		}
		for (const c of children(n)) {
			if (!isFn(c) && c.type !== "ClassBody") {
				stack.push(c);
			}
		}
	}
	return out.toSorted((a, b) => (a?.start ?? 0) - (b?.start ?? 0));
};
