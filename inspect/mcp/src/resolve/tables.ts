import {
	constString,
	type Fn,
	litValue,
	type Module,
	type Node,
	type NodeOf,
} from "../ast.ts";
import { asNode, isNull } from "../ast/node.ts";
import type { Env, Ty, Val } from "./types.ts";

export const isVoid = (n: Node | null | undefined): boolean =>
	!n ||
	(n.type === "UnaryExpression" && n.operator === "void") ||
	isNull(n) ||
	(n.type === "Identifier" && n.name === "undefined");

/** The name a member expression reads: the string a computed key holds, or a plain property name. */
export const keyOf = (
	m: Module,
	x: NodeOf<"MemberExpression">,
): Promise<string | undefined> => {
	if (x.computed) {
		return constString(m, asNode(x.property));
	}
	return Promise.resolve(
		x.property.type === "Identifier" ? x.property.name : undefined,
	);
};

/** The object, property names, and root name of `a.b.c`; undefined for anything else. */
export const memberPath = async (
	m: Module,
	n: Node,
): Promise<{ root: Node; path: string[] } | undefined> => {
	const path: string[] = [];
	const walk = async (x: Node): Promise<Node | undefined> => {
		if (x.type !== "MemberExpression") {
			return x;
		}
		const key = await keyOf(m, x);
		const next = asNode(x.object);
		if (key === undefined || !next) {
			return undefined;
		}
		path.unshift(key);
		return walk(next);
	};
	const root = await walk(n);
	return root?.type === "Identifier" ? { root, path } : undefined;
};

/** The parameters of `fn` (in module `dm`) bound to the arguments of `call` (in `m`). */
export const bind = (
	m: Module,
	call: NodeOf<"CallExpression" | "NewExpression">,
	env: Env | undefined,
	dm: Module,
	fn: Fn,
): Env => {
	const inner: Env = new Map();
	const args = call.arguments.map((a) => asNode(a));
	const spreadAt = args.findIndex((a) => a?.type === "SpreadElement");
	for (const [i, p] of fn.params.entries()) {
		if (p.type !== "Identifier" || (spreadAt !== -1 && i >= spreadAt)) {
			continue;
		}
		const id = asNode(p);
		const v = id && dm.variable(id);
		const a = args[i];
		if (v) {
			inner.set(v, a && !isVoid(a) ? { m, n: a, env } : null);
		}
	}
	return inner;
};

// Built-ins whose result type does not depend on what they are called on. Minified code keeps these
// names, as they are properties of the built-in objects.
export const GLOBAL_CALLS: Record<string, Ty> = {
	String: "string",
	Number: "number",
	parseInt: "number",
	parseFloat: "number",
	Boolean: "boolean",
	isNaN: "boolean",
	isFinite: "boolean",
	encodeURIComponent: "string",
	decodeURIComponent: "string",
};
export const STATIC_CALLS: Record<string, Record<string, Ty>> = {
	Math: {},
	Date: { now: "number", parse: "number" },
	JSON: { stringify: "string" },
	Object: { keys: "array", values: "array", entries: "array" },
	Array: { isArray: "boolean", from: "array", of: "array" },
	Number: {
		isFinite: "boolean",
		isInteger: "boolean",
		isNaN: "boolean",
		isSafeInteger: "boolean",
		parseInt: "number",
		parseFloat: "number",
	},
	performance: { now: "number" },
	crypto: { randomUUID: "string" },
};
// Functions of Node built-in modules, by module name without `node:`. The program imports these by
// their real names, so the import specifier tells which one a minified local name is.
const NODE_CALLS: Record<string, Record<string, Ty>> = {
	crypto: { randomUUID: "string" },
};
export const METHODS: Record<string, Ty> = {
	toISOString: "string",
	toLowerCase: "string",
	toUpperCase: "string",
	trim: "string",
	trimStart: "string",
	trimEnd: "string",
	toFixed: "string",
	padStart: "string",
	padEnd: "string",
	replace: "string",
	replaceAll: "string",
	join: "string",
	includes: "boolean",
	startsWith: "boolean",
	endsWith: "boolean",
	getTime: "number",
	indexOf: "number",
	lastIndexOf: "number",
	findIndex: "number",
	map: "array",
	filter: "array",
	flatMap: "array",
	split: "array",
};
export const COMPARE = new Set([
	"==",
	"!=",
	"===",
	"!==",
	"<",
	">",
	"<=",
	">=",
	"instanceof",
	"in",
]);

/** The branches of an expression whose keys are those of either side; undefined for any other. */
export const spreadParts = (n: Node): Node[] | undefined => {
	let parts: Node[];
	if (n.type === "LogicalExpression") {
		parts = n.operator === "&&" ? [n.right] : [n.left, n.right];
	} else if (n.type === "ConditionalExpression") {
		parts = [n.consequent, n.alternate];
	} else {
		return undefined;
	}
	return parts;
};

/** The name of a property: a plain or literal key, or a computed key that is a constant string. */
export const propKey = (
	m: Module,
	p: NodeOf<"Property">,
): Promise<string | undefined> => {
	const k = p.key;
	if (p.computed) {
		return constString(m, k);
	}
	if (k.type === "Identifier") {
		return Promise.resolve(k.name);
	}
	return Promise.resolve(
		k.type === "Literal" ? String(litValue(k)) : undefined,
	);
};

/** The expression a wrapper passes its value through (`await x`, `a,b`); undefined for any other node. */
export const unwrapped = (n: Node): Node | null | undefined => {
	if (n.type === "AwaitExpression") {
		return asNode(n.argument) ?? null;
	}
	if (n.type === "SequenceExpression") {
		return asNode(n.expressions.at(-1)) ?? null;
	}
	return undefined;
};

/** Whether `def` declares the variable of a `for (x of y)` or `for (x in y)` head. */
export const inLoopHead = (m: Module, def: { parent: Node }): boolean => {
	const loop = m.parent(def.parent);
	return (
		(loop?.type === "ForOfStatement" || loop?.type === "ForInStatement") &&
		loop.left === def.parent
	);
};

/** The strings a value holds, when it is one string or an enum of them. */
export const strings = (x: Val): string[] | undefined => {
	if (x.k === "str") {
		return [x.v];
	}
	return x.k === "enum" ? x.v : undefined;
};

/** The value of a literal: a string, number, or boolean, a template with no parts, or a negated or signed number. */
export const literalVal = (n: Node): Val | undefined => {
	const v = n.type === "Literal" ? n.value : undefined;
	if (typeof v === "string") {
		return { k: "str", v };
	}
	if (typeof v === "number") {
		return { k: "num", v };
	}
	if (typeof v === "boolean") {
		return { k: "bool", v };
	}
	if (n.type === "TemplateLiteral" && n.expressions.length === 0) {
		return { k: "str", v: n.quasis[0]?.value.cooked ?? "" };
	}
	const arg =
		n.type === "UnaryExpression" && n.argument.type === "Literal"
			? n.argument.value
			: undefined;
	if (n.type === "UnaryExpression" && typeof arg === "number") {
		if (n.operator === "!") {
			return { k: "bool", v: !arg };
		}
		if (n.operator === "-") {
			return { k: "num", v: -arg };
		}
	}
	return undefined;
};

/** The types of nodes that always give the same one. */
export const SIMPLE_TYPES = new Map<string, Ty>([
	["TemplateLiteral", "string"],
	["ArrayExpression", "array"],
	["ObjectExpression", "object"],
	["UpdateExpression", "number"],
]);

/** The type of `!x`, `typeof x`, `delete x`, and the other unary operators. */
export const unaryType = (operator: string): Ty => {
	if (operator === "!" || operator === "delete") {
		return "boolean";
	}
	return operator === "typeof" ? "string" : "number";
};

/** The type of a built-in function called as a bare name, such as `String(x)`; own keys only, as `toString` is on every object. */
export const globalCallType = (name: string): Ty | undefined =>
	Object.hasOwn(GLOBAL_CALLS, name) ? GLOBAL_CALLS[name] : undefined;

/** The type of a call of a name imported from a Node built-in module, such as `randomUUID` from `"crypto"`. */
export const importedCallType = (m: Module, id: Node): Ty | undefined => {
	const def = m.variable(id)?.defs[0];
	if (def?.type !== "ImportBinding" || def.node.type !== "ImportSpecifier") {
		return undefined;
	}
	const calls = NODE_CALLS[def.parent.source.value.replace(/^node:/u, "")];
	const sp = def.node.imported;
	const name = sp.type === "Identifier" ? sp.name : sp.value;
	return calls && Object.hasOwn(calls, name) ? calls[name] : undefined;
};

/** The type of `object.name(...)`: a static of a built-in object, or a method by name. */
export const memberCallType = (
	m: Module,
	object: Node | undefined,
	name: string,
): Ty | undefined => {
	if (
		object?.type === "Identifier" &&
		m.isGlobal(object) &&
		Object.hasOwn(STATIC_CALLS, object.name)
	) {
		if (object.name === "Math") {
			return "number";
		}
		const statics = STATIC_CALLS[object.name];
		return statics && Object.hasOwn(statics, name) ? statics[name] : undefined;
	}
	return Object.hasOwn(METHODS, name) ? METHODS[name] : undefined;
};
