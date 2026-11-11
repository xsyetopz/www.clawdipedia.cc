// What the walk of kind `setting-key` reads from zod code: types, constant strings, and key lists.
import {
	constString,
	type Fn,
	isFn,
	type Module,
	type Node,
	returnsOf,
	type Variable,
} from "../../ast.ts";
import { mapSeq } from "../../seq.ts";
import { asNode } from "../common.ts";

/** The zod types whose inner schemas hold the same value, so their keys sit at the same path. */
export const SAME_PATH = new Set([
	"union",
	"intersection",
	"pipe",
	"lazy",
	"optional",
	"nullable",
	"default",
	"prefault",
	"catch",
	"readonly",
	"nonoptional",
]);
/** Methods of a zod schema whose argument adds keys or another schema for the same value. */
export const SAME_PATH_METHODS = new Set([
	"extend",
	"safeExtend",
	"merge",
	"or",
	"and",
]);

/** The zod type that a constructor builds: the `type:"…"` of the object it passes to the class. */
export const zodType = (m: Module, fn: Fn): string | undefined =>
	/\btype:"(\w+)"/u.exec(m.src(fn))?.[1];

/** What a parameter of a followed function or callback holds in this walk: an argument with its module, or a constant string. */
export type Bound = { m: Module; n: Node } | { value: string };
export type Env = Map<Variable, Bound>;

/** Where the walk is: the module, the dotted path, the bound parameters, and the depth. */
export interface Cx {
	m: Module;
	path: string;
	env: Env;
	depth: number;
}

/** The constant string of `n`, through the bound parameters. */
export const constOf = async (
	m: Module,
	n: Node | undefined,
	env: Env,
): Promise<string | undefined> => {
	const v = n?.type === "Identifier" ? m.variable(n) : undefined;
	const b = v && env.get(v);
	if (!b) {
		return constString(m, n);
	}
	const found = "value" in b ? b.value : await constOf(b.m, b.n, env);
	return found;
};

/** The strings of an array literal, with its `...list` spreads read in. */
const stringList = async (
	m: Module,
	n: Node | null | undefined,
): Promise<string[]> => {
	if (n?.type === "Identifier") {
		const v = m.variable(n);
		const o = v && (await m.bundle?.origin(m, v));
		const d = o?.variable.defs[0];
		return d?.type === "Variable" && o
			? stringList(o.module, asNode(d.node.init))
			: [];
	}
	if (n?.type !== "ArrayExpression") {
		return [];
	}
	const lists = await mapSeq(n.elements, async (e) =>
		e?.type === "SpreadElement"
			? stringList(m, asNode(e.argument))
			: ((await constString(m, asNode(e))) ?? []),
	);
	return lists.flat();
};

/** The part of a spread in a shape that holds keys: `...cond&&{…}` and `...cond?{…}:{}` give the object. */
export const spreadTarget = (a: Node | undefined): Node | undefined => {
	if (a?.type === "LogicalExpression") {
		return asNode(a.right);
	}
	return a?.type === "ConditionalExpression" ? asNode(a.consequent) : a;
};

/** The list and the callback of `Object.fromEntries(list.map(cb))`. */
const entriesMap = (
	m: Module,
	o: Node | undefined,
): { list: Node | undefined; cb: Fn } | undefined => {
	const callee = o?.type === "CallExpression" ? asNode(o.callee) : undefined;
	if (
		o?.type !== "CallExpression" ||
		callee?.type !== "MemberExpression" ||
		m.src(callee) !== "Object.fromEntries"
	) {
		return undefined;
	}
	const map = asNode(o.arguments[0]);
	const cb =
		map?.type === "CallExpression" ? asNode(map.arguments[0]) : undefined;
	if (
		map?.type !== "CallExpression" ||
		map.callee.type !== "MemberExpression" ||
		!isFn(cb)
	) {
		return undefined;
	}
	return { list: asNode(map.callee.object), cb };
};

/** `Object.fromEntries(list.map((k)=>[k,schema]))`: the keys, the variable of `k`, and the schema. */
export const entriesShape = async (
	m: Module,
	o: Node | undefined,
): Promise<{ keys: string[]; param: Variable; value: Node } | undefined> => {
	const parts = entriesMap(m, o);
	if (!parts) {
		return undefined;
	}
	const { list, cb } = parts;
	const pair = returnsOf(cb)[0];
	const id = asNode(cb.params[0]);
	const param = id?.type === "Identifier" ? m.variable(id) : undefined;
	const value =
		pair?.type === "ArrayExpression" ? asNode(pair.elements[1]) : undefined;
	return param && value
		? { keys: await stringList(m, list), param, value }
		: undefined;
};
