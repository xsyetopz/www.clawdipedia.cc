// The call and function queries of a module: who a callee is, who calls a function, what a name holds.

import type { Module, Variable } from "../ast.ts";
import {
	asNode,
	children,
	type Fn,
	isFn,
	type Node,
	type NodeOf,
} from "./node.ts";

/**
 * The function a callee names: a declaration, a variable whose only value is a function, or one whose
 * only value is the parameter of a setter (`var f;function set(e){f=e}set(g)`) that has one known call.
 */
export const functionOf = async (
	m: Module,
	callee: Node,
	depth = 0,
): Promise<{ module: Module; fn: Fn } | undefined> => {
	if (callee.type !== "Identifier") {
		return undefined;
	}
	const v0 = m.variable(callee);
	const o =
		v0 &&
		(m.bundle ? await m.bundle.origin(m, v0) : { module: m, variable: v0 });
	if (!o) {
		return undefined;
	}
	const { module, variable: v } = o;
	const writes = v.references.filter((r) => r.write);
	for (const d of v.defs) {
		if (d.type === "FunctionName" && isFn(d.node)) {
			return { module, fn: d.node };
		}
		const init = d.type === "Variable" ? asNode(d.node.init) : undefined;
		if (isFn(init) && writes.length <= 1) {
			return { module, fn: init };
		}
	}
	return writes.length === 1
		? writtenFunction(module, writes[0]?.writeExpr ?? null, depth)
		: undefined;
};

/** `var f; ... f=function(){}` or `f=e` in a setter: the function of the one write. */
const writtenFunction = (
	module: Module,
	w: Node | null,
	depth: number,
): Promise<{ module: Module; fn: Fn } | undefined> => {
	if (w?.type === "Identifier") {
		return setterArgument(module, w, depth);
	}
	return Promise.resolve(isFn(w) ? { module, fn: w } : undefined);
};

/** The function passed for parameter `p` at the one known call of the function that declares it. */
const setterArgument = async (
	m: Module,
	p: Node,
	depth: number,
): Promise<{ module: Module; fn: Fn } | undefined> => {
	const def = m.variable(p)?.defs[0];
	if (depth > 4 || def?.type !== "Parameter" || !isFn(def.node)) {
		return undefined;
	}
	const at = def.node.params.map((x) => asNode(x)).indexOf(def.name);
	const calls = await callsOf(m, def.node);
	const call = calls.length === 1 ? calls[0] : undefined;
	const arg = asNode(call?.call.arguments[at]);
	if (!call || !arg) {
		return undefined;
	}
	return isFn(arg)
		? { module: call.module, fn: arg }
		: functionOf(call.module, arg, depth + 1);
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

export type CallNode = NodeOf<"CallExpression">;
export interface Call {
	module: Module;
	call: CallNode;
}

/**
 * The calls of `fn`, in its module and in every module that imports it. An `undefined` in the list
 * means the function is used as a value somewhere, so not every call is known.
 */
export const callsOf = async (
	m: Module,
	fn: Fn,
): Promise<(Call | undefined)[]> => {
	const v = nameOf(m, fn);
	if (!v) {
		return [undefined];
	}
	const out: (Call | undefined)[] = [];
	scanRefs(out, fn, m, v);
	if (m.bundle) {
		for (const i of await m.bundle.importers(m, v)) {
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
export const constString = async (
	m: Module,
	n: Node | null | undefined,
	depth = 0,
): Promise<string | undefined> => {
	if (!n || depth > 8) {
		return undefined;
	}
	if (n.type === "Literal") {
		return typeof n.value === "string" ? n.value : undefined;
	}
	if (n.type === "TemplateLiteral" && n.expressions.length === 0) {
		return n.quasis[0]?.value.cooked ?? undefined;
	}
	if (n.type !== "Identifier") {
		return undefined;
	}
	const v0 = m.variable(n);
	const o =
		v0 &&
		(m.bundle ? await m.bundle.origin(m, v0) : { module: m, variable: v0 });
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
