// What a tool expression of the program holds: its value, its name, and whether it is null (`tools.ts` lists the tools).

import {
	type CallNode,
	constString,
	type Fn,
	functionOf,
	isFn,
	type Module,
	type Node,
	type NodeOf,
	returnsOf,
} from "./ast.ts";
import { asNode, isNull } from "./ast/node.ts";
import type { Resolver } from "./resolve.ts";
import { everySeq, firstSeq } from "./seq.ts";
import { keyOf, type Prop } from "./surface/common.ts";

/** A tool's name, and its own `isEnabled` when its definition literal has one. */
export interface Found {
	name: string;
	enabled?: { m: Module; n: Node };
}

/** The value a name is bound to once (followed across imports), or undefined. */
export const initOf = async (
	m: Module,
	id: Node,
): Promise<{ m: Module; n: Node } | undefined> => {
	const v0 = m.variable(id);
	const o =
		v0 && ((await m.bundle?.origin(m, v0)) ?? { module: m, variable: v0 });
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
const chunkCall = async (
	m: Module,
	obj: Node,
): Promise<{ cm: Module; call: CallNode } | undefined> => {
	const i = obj.type === "Identifier" ? await initOf(m, obj) : undefined;
	const cm = i?.m ?? m;
	const c = i?.n ?? obj;
	if (
		c.type === "CallExpression" &&
		cm.src(c.callee).startsWith("import.meta.require")
	) {
		return { cm, call: c };
	}
	return undefined;
};

/** The value of export `name` in the chunk `from` of the bundle, when it is a variable with a value. */
const exportValue = async (
	m: Module,
	from: Module | undefined,
	name: string,
): Promise<{ m: Module; n: Node } | undefined> => {
	const local = from?.exports.get(name);
	const v = local === undefined ? undefined : from?.topLevel(local);
	const o = from && v && (await m.bundle?.origin(from, v));
	const def = o?.variable.defs[0];
	const init = def?.type === "Variable" ? asNode(def.node.init) : undefined;
	return o && init ? { m: o.module, n: init } : undefined;
};

/** `import.meta.require("/$bunfs/root/chunk").X`: the value of export `X` in that chunk, or its name. */
export const required = async (
	m: Module,
	n: Node,
): Promise<{ m: Module; n: Node } | string | undefined> => {
	if (n.type !== "MemberExpression" || n.property.type !== "Identifier") {
		return undefined;
	}
	const found = await chunkCall(m, n.object);
	if (!found) {
		return undefined;
	}
	const from = await m.bundle?.get(
		String(await constString(found.cm, asNode(found.call.arguments[0]))),
	);
	return (await exportValue(m, from, n.property.name)) ?? n.property.name;
};

/** The function a call calls: a name, or an inline function such as `(()=>x)()`. */
export const calleeFn = (
	m: Module,
	call: CallNode,
): Promise<{ module: Module; fn: Fn } | undefined> => {
	const { callee } = call;
	return isFn(callee)
		? Promise.resolve({ module: m, fn: callee })
		: functionOf(m, callee);
};

/** Always null: `null`, a name bound to it, or a call of null or of a function that only returns it. */
export const alwaysNull = async (
	m: Module,
	n: Node,
	depth = 0,
): Promise<boolean> => {
	if (depth > 6) {
		return false;
	}
	if (isNull(n)) {
		return true;
	}
	if (n.type === "Identifier") {
		const i = await initOf(m, n);
		return i !== undefined && (await alwaysNull(i.m, i.n, depth + 1));
	}
	if (n.type !== "CallExpression") {
		return false;
	}
	if (await alwaysNull(m, n.callee, depth + 1)) {
		return true;
	}
	const f = await calleeFn(m, n);
	if (!f) {
		return false;
	}
	const rets = returnsOf(f.fn);
	return (
		rets.length > 0 &&
		(await everySeq(rets, (r) =>
			r === null ? Promise.resolve(false) : alwaysNull(f.module, r, depth + 1),
		))
	);
};

const named = (name: string | undefined): Found | undefined =>
	name === undefined || name === "" ? undefined : { name };

/** The object literal of `{name:...}`, or of a tool builder called with one: `tn({name:io,...})`. */
const literalOf = (n: Node): NodeOf<"ObjectExpression"> | undefined => {
	if (n.type === "ObjectExpression") {
		return n;
	}
	const arg = n.type === "CallExpression" ? n.arguments[0] : undefined;
	return arg?.type === "ObjectExpression" ? arg : undefined;
};

/** The tool a definition literal gives. Undefined when the expression has no `name` property. */
const ofLiteral = async (
	m: Module,
	n: Node,
): Promise<{ tool: Found | undefined } | undefined> => {
	const props = literalOf(n)?.properties ?? [];
	const prop = (key: string) =>
		props.find(
			(x): x is Prop => x.type !== "SpreadElement" && keyOf(x) === key,
		);
	const p = prop("name");
	if (!p) {
		return undefined;
	}
	const base = named(await constString(m, p.value));
	const e = prop("isEnabled");
	return {
		tool: base && e !== undefined ? { ...base, enabled: { m, n: e } } : base,
	};
};

/** The tool that the function a call calls returns, or that its first argument gives (a lazy wrapper such as `Vr(HEAD,()=>import(...).Tool)`). Undefined when the call tells nothing. */
const viaCall = async (
	R: Resolver,
	m: Module,
	n: CallNode,
	depth: number,
): Promise<{ tool: Found | undefined } | undefined> => {
	const f = n.arguments.length === 0 ? await calleeFn(m, n) : undefined;
	if (f) {
		const hit = await firstSeq(returnsOf(f.fn), async (ret) =>
			ret === null || (await alwaysNull(f.module, ret))
				? undefined
				: { tool: await toolName(R, f.module, ret, depth + 1) },
		);
		if (hit) {
			return hit;
		}
	}
	const a = asNode(n.arguments[0]);
	const got = a && (await toolName(R, m, a, depth + 1));
	return got ? { tool: got } : undefined;
};

/** The `name` entry that the resolver shows for the expression. */
const viaResolver = async (
	R: Resolver,
	m: Module,
	n: Node,
): Promise<Found | undefined> => {
	const got = await R.expr(m, n);
	const e = got?.find((x) => "key" in x && x.key === "name");
	if (!e || !("key" in e)) {
		return undefined;
	}
	if (e.val.k === "str") {
		return { name: e.val.v };
	}
	return e.val.k === "unk" && e.val.ref
		? named(await constString(e.val.ref.m, e.val.ref.n))
		: undefined;
};

/** The tool an expression gives, or undefined. */
export const toolName = async (
	R: Resolver,
	m: Module,
	n: Node,
	depth = 0,
): Promise<Found | undefined> => {
	if (depth > 8) {
		return undefined;
	}
	if (n.type === "Identifier") {
		const i = await initOf(m, n);
		return i && toolName(R, i.m, i.n, depth + 1);
	}
	const own = await ofLiteral(m, n);
	if (own) {
		return own.tool;
	}
	if (n.type === "SequenceExpression") {
		const last = asNode(n.expressions.at(-1));
		return last && toolName(R, m, last, depth + 1);
	}
	const r = await required(m, n);
	if (typeof r === "string") {
		return { name: r };
	}
	if (r) {
		return (
			(await toolName(R, r.m, r.n, depth + 1)) ??
			named(m.src(n).split(".").pop())
		);
	}
	const call =
		n.type === "CallExpression" ? await viaCall(R, m, n, depth) : undefined;
	return call ? call.tool : viaResolver(R, m, n);
};
