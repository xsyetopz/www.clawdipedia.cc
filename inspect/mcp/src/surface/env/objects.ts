// The env objects of kind `env`: `process.env`, proxies made from a registry, and what holds or returns them.
import {
	type CallNode,
	callsOf,
	type Fn,
	functionOf,
	isFn,
	type Module,
	type Node,
	type NodeOf,
	returnsOf,
} from "../../ast.ts";
import { everySeq, mapSeq, someSeq } from "../../seq.ts";
import { asNode } from "../common.ts";

export type Variable = NonNullable<ReturnType<Module["variable"]>>;

const isName = (n: Node, name: string): boolean =>
	(n.type === "Identifier" && n.name === name) ||
	(n.type === "MemberExpression" &&
		!n.computed &&
		n.property.type === "Identifier" &&
		n.property.name === name &&
		n.object.type === "Identifier" &&
		n.object.name === "globalThis");

/** `process.env` or `globalThis.process.env` (the SDK reads it that way). */
export const isProcessEnv = (n: Node): boolean =>
	n.type === "MemberExpression" &&
	!n.computed &&
	isName(n.object, "process") &&
	n.property.type === "Identifier" &&
	n.property.name === "env";

/** The registry type of a getter `()=>v` with `v=H.method(...)`: the method, its options, and enum values. */

/** The single value of a variable that is never written again, or undefined. */
const initOf = (v: Variable): Node | undefined => {
	const def = v.defs[0];
	const init = def?.type === "Variable" ? asNode(def.node.init) : undefined;
	return init && v.references.every((r) => !r.write || r.init)
		? init
		: undefined;
};

export class EnvObjects {
	/** Registry namespaces, and objects that spread them. */
	readonly registries = new Set<Variable>();
	/** Functions that build an env proxy from a registry. */
	readonly factories = new Set<Fn>();
	readonly #known = new WeakMap<object, boolean>();

	/** Find the proxy factories: the functions called with a registry namespace as an argument. */
	async findFactories(regs: { m: Module; v: Variable }[]): Promise<void> {
		const queue = [...regs];
		const next = async (): Promise<void> => {
			const item = queue.pop();
			if (!item) {
				return;
			}
			const { m, v } = item;
			if (!this.registries.has(v)) {
				this.registries.add(v);
				await mapSeq(v.references, async (r) => {
					const w = await this.#use(m, r.identifier);
					if (w) {
						queue.push({ m, v: w });
					}
				});
			}
			return next();
		};
		await next();
	}

	/** One use of a registry variable: the registry it is spread into (returned), or the factory it is passed to (recorded). */
	async #use(m: Module, id: Node): Promise<Variable | undefined> {
		const p = m.parent(id);
		if (p?.type === "SpreadElement") {
			// `QN={...ns1,...ns2}` is a registry too
			const obj = m.parent(p);
			const decl = obj && m.parent(obj);
			const target =
				decl?.type === "VariableDeclarator" ? asNode(decl.id) : undefined;
			return target?.type === "Identifier" ? m.variable(target) : undefined;
		}
		if (p?.type === "CallExpression" && p.arguments.some((a) => a === id)) {
			const callee = asNode(p.callee);
			const f = callee && (await functionOf(m, callee));
			if (f) {
				this.factories.add(f.fn);
			}
		}
		return undefined;
	}

	/** Is `n` an env object (anchor 2)? */
	is(m: Module, n: Node, seen = new Set<unknown>()): Promise<boolean> {
		if (isProcessEnv(n)) {
			return Promise.resolve(true);
		}
		if (n.type === "ObjectExpression") {
			return this.#any(
				m,
				n.properties.flatMap((p) =>
					p.type === "SpreadElement" ? [p.argument] : [],
				),
				seen,
			);
		}
		if (n.type === "LogicalExpression") {
			return this.#any(m, [n.left, n.right], seen);
		}
		if (n.type === "ConditionalExpression") {
			return this.#any(m, [n.consequent, n.alternate], seen);
		}
		if (n.type === "CallExpression") {
			return this.#call(m, n, seen);
		}
		return n.type === "Identifier"
			? this.#identifier(m, n, seen)
			: Promise.resolve(false);
	}

	#any(m: Module, nodes: Node[], seen: Set<unknown>): Promise<boolean> {
		return someSeq(nodes, (x) => this.is(m, x, seen));
	}

	/** A call of a proxy factory, or of a function that returns only env objects. */
	async #call(m: Module, n: CallNode, seen: Set<unknown>): Promise<boolean> {
		const callee = asNode(n.callee);
		const f = callee && (await functionOf(m, callee));
		if (!f || seen.has(f.fn)) {
			return false;
		}
		if (this.factories.has(f.fn)) {
			return true;
		}
		seen.add(f.fn);
		const rets = returnsOf(f.fn);
		return (
			rets.length > 0 &&
			(await everySeq(rets, (r) =>
				r === null ? Promise.resolve(false) : this.is(f.module, r, seen),
			))
		);
	}

	async #identifier(
		m: Module,
		n: NodeOf<"Identifier">,
		seen: Set<unknown>,
	): Promise<boolean> {
		const v = m.variable(n);
		const def = v?.defs[0];
		if (!v || !def || seen.has(v)) {
			return false;
		}
		const known = this.#known.get(v);
		if (known !== undefined) {
			return known;
		}
		seen.add(v);
		const r = await this.#binding(m, n, v, seen);
		this.#known.set(v, r);
		return r;
	}

	async #binding(
		m: Module,
		n: NodeOf<"Identifier">,
		v: Variable,
		seen: Set<unknown>,
	): Promise<boolean> {
		const def = v.defs[0];
		if (def?.type === "ImportBinding") {
			const o = await m.bundle?.origin(m, v);
			const id = o?.variable.identifiers[0];
			return (
				o !== undefined &&
				id !== undefined &&
				o.variable !== v &&
				this.is(o.module, id, seen)
			);
		}
		if (def?.type === "Variable") {
			const init = initOf(v);
			return init !== undefined && this.is(m, init, seen);
		}
		if (def?.type !== "Parameter" || !isFn(def.node)) {
			return false;
		}
		return this.#parameter(m, def.node, n.name, seen);
	}

	/** A parameter is an env object by its default, or when every call passes one. */
	async #parameter(
		m: Module,
		fn: Fn,
		name: string,
		seen: Set<unknown>,
	): Promise<boolean> {
		const index = fn.params.findIndex((p) => {
			const id = p.type === "AssignmentPattern" ? p.left : p;
			return id.type === "Identifier" && id.name === name;
		});
		const p = fn.params[index];
		if (p?.type === "AssignmentPattern") {
			return isProcessEnv(p.right);
		}
		const calls = await callsOf(m, fn);
		return (
			index !== -1 &&
			calls.length > 0 &&
			(await everySeq(calls, (c) => {
				const a = asNode(c?.call.arguments[index]);
				return c !== undefined && a !== undefined
					? this.is(c.module, a, seen)
					: Promise.resolve(false);
			}))
		);
	}
}
