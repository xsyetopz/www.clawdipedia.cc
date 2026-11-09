// What a tool expression of the program holds: its value, its name, and whether it is null (`tools.ts` lists the tools).

import type * as t from "@babel/types";

import {
	type CallNode,
	constString,
	type Fn,
	functionOf,
	isFn,
	type Module,
	type Node,
	returnsOf,
} from "./ast.ts";
import { asNode } from "./ast/node.ts";
import type { Resolver } from "./resolve.ts";
import { keyOf, type Prop, propValue } from "./surface/common.ts";

/** A tool's name, and its own `isEnabled` when its definition literal has one. */
export interface Found {
	name: string;
	enabled?: { m: Module; n: Node };
}

/** A child node. Every node of a parsed module has a position. */
export const at = (x: t.Node): Node => {
	const n = asNode(x);
	if (n === undefined) {
		throw new Error(`${x.type} has no position`);
	}
	return n;
};

/** The value a name is bound to once (followed across imports), or undefined. */
export const initOf = (
	m: Module,
	id: Node,
): { m: Module; n: Node } | undefined => {
	const v0 = m.variable(id);
	const o = v0 && (m.bundle?.origin(m, v0) ?? { module: m, variable: v0 });
	const def = o?.variable.defs[0];
	const init = def?.type === "Variable" ? asNode(def.node.init) : undefined;
	if (!o || init === undefined) {
		return undefined;
	}
	if (o.variable.references.some((r) => r.write && !r.init)) {
		return undefined;
	}
	return { m: o.module, n: init };
};

/** The `import.meta.require(...)` call that `obj` is, or a local bound to it: `let b=import.meta.require(...);return b.X`. */
const chunkCall = (
	m: Module,
	obj: Node,
): { cm: Module; call: CallNode } | undefined => {
	const i = obj.type === "Identifier" ? initOf(m, obj) : undefined;
	const cm = i?.m ?? m;
	const c = i?.n ?? obj;
	if (
		c.type === "CallExpression" &&
		cm.src(at(c.callee)).startsWith("import.meta.require")
	) {
		return { cm, call: c };
	}
	return undefined;
};

/** The value of export `name` in the chunk `from` of the bundle, when it is a variable with a value. */
const exportValue = (
	m: Module,
	from: Module | undefined,
	name: string,
): { m: Module; n: Node } | undefined => {
	const local = from?.exports.get(name);
	const v = local === undefined ? undefined : from?.topLevel(local);
	const o = from && v && m.bundle?.origin(from, v);
	const def = o?.variable.defs[0];
	const init = def?.type === "Variable" ? asNode(def.node.init) : undefined;
	return o && init ? { m: o.module, n: init } : undefined;
};

/** `import.meta.require("/$bunfs/root/chunk").X`: the value of export `X` in that chunk, or its name. */
export const required = (
	m: Module,
	n: Node,
): { m: Module; n: Node } | string | undefined => {
	if (n.type !== "MemberExpression" || n.property.type !== "Identifier") {
		return undefined;
	}
	const found = chunkCall(m, at(n.object));
	if (!found) {
		return undefined;
	}
	const from = m.bundle?.get(
		String(constString(found.cm, asNode(found.call.arguments[0]))),
	);
	return exportValue(m, from, n.property.name) ?? n.property.name;
};

/** The function a call calls: a name, or an inline function such as `(()=>x)()`. */
export const calleeFn = (
	m: Module,
	call: CallNode,
): { module: Module; fn: Fn } | undefined => {
	const callee = at(call.callee);
	return isFn(callee) ? { module: m, fn: callee } : functionOf(m, callee);
};

/** Always null: `null`, a name bound to it, or a call of null or of a function that only returns it. */
export const isNull = (m: Module, n: Node, depth = 0): boolean => {
	if (depth > 6) {
		return false;
	}
	if (n.type === "NullLiteral") {
		return true;
	}
	if (n.type === "Identifier") {
		const i = initOf(m, n);
		return i !== undefined && isNull(i.m, i.n, depth + 1);
	}
	if (n.type !== "CallExpression") {
		return false;
	}
	if (isNull(m, at(n.callee), depth + 1)) {
		return true;
	}
	const f = calleeFn(m, n);
	if (!f) {
		return false;
	}
	const rets = returnsOf(f.fn);
	return (
		rets.length > 0 &&
		rets.every((r) => r !== null && isNull(f.module, r, depth + 1))
	);
};

const named = (name: string | undefined): Found | undefined =>
	name === undefined || name === "" ? undefined : { name };

/** The object literal of `{name:...}`, or of a tool builder called with one: `tn({name:io,...})`. */
const literalOf = (n: Node): t.ObjectExpression | undefined => {
	if (n.type === "ObjectExpression") {
		return n;
	}
	const arg = n.type === "CallExpression" ? n.arguments[0] : undefined;
	return arg?.type === "ObjectExpression" ? arg : undefined;
};

/** The tool a definition literal gives. Undefined when the expression has no `name` property. */
const ofLiteral = (
	m: Module,
	n: Node,
): { tool: Found | undefined } | undefined => {
	const props = literalOf(n)?.properties ?? [];
	const prop = (key: string) =>
		props.find(
			(x): x is Prop => x.type !== "SpreadElement" && keyOf(x) === key,
		);
	const p = prop("name");
	if (!p) {
		return undefined;
	}
	const base = named(constString(m, propValue(p)));
	const e = asNode(prop("isEnabled"));
	return {
		tool: base && e !== undefined ? { ...base, enabled: { m, n: e } } : base,
	};
};

/** The tool that the function a call calls returns, or that its first argument gives (a lazy wrapper such as `Vr(HEAD,()=>import(...).Tool)`). Undefined when the call tells nothing. */
const viaCall = (
	R: Resolver,
	m: Module,
	n: CallNode,
	depth: number,
): { tool: Found | undefined } | undefined => {
	const f = n.arguments.length === 0 ? calleeFn(m, n) : undefined;
	if (f) {
		for (const ret of returnsOf(f.fn)) {
			if (ret !== null && !isNull(f.module, ret)) {
				return { tool: toolName(R, f.module, ret, depth + 1) };
			}
		}
	}
	const a = asNode(n.arguments[0]);
	const got = a && toolName(R, m, a, depth + 1);
	return got ? { tool: got } : undefined;
};

/** The `name` entry that the resolver shows for the expression. */
const viaResolver = (R: Resolver, m: Module, n: Node): Found | undefined => {
	const e = R.expr(m, n)?.find((x) => "key" in x && x.key === "name");
	if (!e || !("key" in e)) {
		return undefined;
	}
	if (e.val.k === "str") {
		return { name: e.val.v };
	}
	return e.val.k === "unk" && e.val.ref
		? named(constString(e.val.ref.m, e.val.ref.n))
		: undefined;
};

/** The tool an expression gives, or undefined. */
export const toolName = (
	R: Resolver,
	m: Module,
	n: Node,
	depth = 0,
): Found | undefined => {
	if (depth > 8) {
		return undefined;
	}
	if (n.type === "Identifier") {
		const i = initOf(m, n);
		return i && toolName(R, i.m, i.n, depth + 1);
	}
	const own = ofLiteral(m, n);
	if (own) {
		return own.tool;
	}
	if (n.type === "SequenceExpression") {
		const last = asNode(n.expressions.at(-1));
		return last && toolName(R, m, last, depth + 1);
	}
	const r = required(m, n);
	if (typeof r === "string") {
		return { name: r };
	}
	if (r) {
		return toolName(R, r.m, r.n, depth + 1) ?? named(m.src(n).split(".").pop());
	}
	const call =
		n.type === "CallExpression" ? viaCall(R, m, n, depth) : undefined;
	return call ? call.tool : viaResolver(R, m, n);
};
