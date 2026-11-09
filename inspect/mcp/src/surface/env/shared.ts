// What the parts of kind `env` share: name patterns, the collected state, and two lookups.
import { type Fn, isFn, type Module, type Node } from "../../ast.ts";
import { asNode, strings, type SurfaceItem } from "../common.ts";
import type { EnvObjects } from "./objects.ts";

export const NAME = /^[A-Za-z_][A-Za-z0-9_]*$/u;
export const UPPER = /^[A-Z_][A-Z0-9_]*$/u;
export const LISTED = /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/u;

/** A function whose parameter `index` is read as an env name (`process.env[param]`). */
export interface Helper {
	m: Module;
	fn: Fn;
	index: number;
}

/** A list or object of uppercase names. */
export interface NameList {
	m: Module;
	n: Node;
	names: string[];
}

export type Add = (
	m: Module,
	at: Node,
	name: string,
	extra?: Partial<SurfaceItem>,
) => void;

/** The state the parts fill while they scan the bundle. */
export interface Ctx {
	add: Add;
	env: EnvObjects;
	helpers: Helper[];
	lists: NameList[];
}

const EACH = new Set(["map", "flatMap", "forEach", "filter", "some", "every"]);

/** The names of a constant string list that `list.flatMap(f)` passes to `f`, when `f` is `n`. */
export const eachName = (m: Module, n: Node): string[] => {
	const c = m.parent(n);
	if (
		c?.type !== "CallExpression" ||
		c.arguments[0] !== n ||
		c.callee.type !== "MemberExpression" ||
		c.callee.property.type !== "Identifier" ||
		!EACH.has(c.callee.property.name)
	) {
		return [];
	}
	const list = asNode(c.callee.object);
	const def = list?.type === "Identifier" ? m.variable(list)?.defs[0] : null;
	const init = def?.type === "Variable" ? asNode(def.node.init) : list;
	return strings(m, init) ?? [];
};

/** The index of `id` among the parameters of the function that declares it, with that function. */
export const paramOf = (m: Module, id: Node): Omit<Helper, "m"> | undefined => {
	if (id.type !== "Identifier") {
		return undefined;
	}
	const def = m.variable(id)?.defs[0];
	if (def?.type !== "Parameter" || !isFn(def.node)) {
		return undefined;
	}
	const fn = def.node;
	const index = fn.params.findIndex(
		(p) => p.type === "Identifier" && p.name === id.name,
	);
	return index === -1 ? undefined : { fn, index };
};
