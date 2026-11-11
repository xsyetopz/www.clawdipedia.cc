// Finds the keys of the object an expression gives in a bundled program: object literals, their spreads,
// the values a name is bound to, the arguments a parameter gets at each call, and what a called function
// returns, across chunks. A value it cannot follow stays unknown.
import {
	type CallNode,
	callsOf,
	type Fn,
	functionOf,
	type Module,
	type Node,
	returnsOf,
	type Variable,
} from "./ast.ts";
import { asNode } from "./ast/node.ts";
import { bind } from "./resolve/tables.ts";
import {
	type Entry,
	type Env,
	mergeEntries,
	type Val,
} from "./resolve/types.ts";
import { isUnset } from "./resolve/undef.ts";
import { ValueResolver } from "./resolve/value.ts";
import { allSeq, mapSeq } from "./seq.ts";

export type { Entry, Env, JType, Ref, Val } from "./resolve/types.ts";
export { mergeEntries } from "./resolve/types.ts";

/** The `f(...)` of `f(...).then((x)=>...)` when `fn` is that callback and `index` is its first parameter. */
const thenSource = (m: Module, fn: Fn, index: number): Node | undefined => {
	const p = m.parent(fn);
	return index === 0 &&
		p?.type === "CallExpression" &&
		p.arguments[0] === fn &&
		p.callee.type === "MemberExpression" &&
		p.callee.property.type === "Identifier" &&
		p.callee.property.name === "then"
		? p.callee.object
		: undefined;
};

export class Resolver extends ValueResolver {
	/**
	 * Each time a spread could not be followed, as `<module>@<index>: ...<text>`, also in an object read
	 * only for the type of one of its keys. A result is cached, so a spread is logged at its first visit.
	 */
	readonly unresolved: string[] = [];
	readonly #params = new Map<Variable, Entry[] | undefined>();

	/** A parameter with no call to bind it: the argument at every call of its function. */
	async param(
		m: Module,
		v: Variable,
		fn: Fn,
		depth: number,
	): Promise<Entry[] | undefined> {
		const params: readonly unknown[] = fn.params;
		const index = params.indexOf(v.defs[0]?.name);
		if (index === -1) {
			return undefined;
		}
		if (this.#params.has(v)) {
			return this.#params.get(v);
		}
		this.#params.set(v, undefined);
		const lists = await this.#argLists(m, fn, index, depth);
		const merged =
			lists === undefined ? [] : await mergeEntries(lists, this.ty);
		const out = merged.length > 0 ? merged : undefined;
		this.#params.set(v, out);
		return out;
	}

	/** The entries of the argument at `index` for each call of `fn`; undefined when one cannot be followed. */
	async #argLists(
		m: Module,
		fn: Fn,
		index: number,
		depth: number,
	): Promise<Entry[][] | undefined> {
		// `f(...).then((x)=>...)`: `x` is what `f` returns.
		const source = thenSource(m, fn, index);
		if (source !== undefined) {
			const got = await this.expr(
				m,
				asNode(source) ?? null,
				undefined,
				depth + 1,
			);
			return got && [got];
		}
		return allSeq(
			await callsOf(m, fn),
			async (c): Promise<Entry[] | undefined> => {
				const args = c?.call.arguments ?? [];
				if (
					!c ||
					args.slice(0, index + 1).some((a) => a.type === "SpreadElement")
				) {
					return undefined;
				}
				const got = await this.expr(
					c.module,
					asNode(args[index]) ?? null,
					undefined,
					depth + 1,
				);
				return got;
			},
		);
	}

	/**
	 * Entries returned by a call like `f(a,b)`, where `f` is any function the callee names, in this chunk or
	 * an imported one. The parameters bind to this call's arguments; one it leaves out is undefined, and a
	 * key whose value is undefined is dropped, as JSON drops it.
	 */
	async call(
		m: Module,
		call: CallNode,
		env?: Env,
		depth = 0,
	): Promise<Entry[] | undefined> {
		const callee = asNode(call.callee);
		const f = depth > 10 || !callee ? undefined : await functionOf(m, callee);
		if (!f) {
			return undefined;
		}
		const { module: dm, fn } = f;
		const rets = returnsOf(fn).filter((r): r is Node => r !== null);
		if (rets.length === 0) {
			return undefined;
		}
		const inner = bind(m, call, env, dm, fn);
		const lists = await allSeq(rets, (r) =>
			this.#returned(dm, inner, r, depth),
		);
		return (
			lists && this.pin(await mergeEntries(lists.flat(), this.ty), depth + 1)
		);
	}

	/** The entry lists a returned expression can give, one per branch; undefined when one cannot be followed. */
	async #returned(
		dm: Module,
		inner: Env,
		n: Node,
		depth: number,
	): Promise<Entry[][] | undefined> {
		const next = (x: Node | null | undefined) => {
			const node = asNode(x);
			return node && this.#returned(dm, inner, node, depth);
		};
		if (n.type === "SequenceExpression") {
			return next(n.expressions.at(-1));
		}
		if (n.type === "ConditionalExpression") {
			const a = await next(n.consequent);
			const b = await next(n.alternate);
			return a && b ? [...a, ...b] : undefined;
		}
		if (n.type === "AwaitExpression") {
			return next(n.argument);
		}
		if (n.type === "ObjectExpression") {
			const own = await this.entries(dm, n, inner);
			const spread = await this.spreads(
				own.filter((e) => !isUnset(dm, inner, e)),
				depth + 1,
			);
			return [spread.filter((e) => "key" in e)];
		}
		const got = await this.expr(dm, n, inner, depth + 1);
		return got && [got];
	}

	/** Inline the spreads that resolve; count the others as unresolved. */
	async spreads(entries: Entry[], depth = 0): Promise<Entry[]> {
		const out: Entry[] = [];
		await mapSeq(entries, async (e) => {
			if ("key" in e) {
				out.push(e);
				return;
			}
			const got =
				e.ref === undefined
					? undefined
					: await this.expr(e.ref.m, e.ref.n, e.ref.env, depth);
			if (got && depth < 6) {
				for (const inner of await this.spreads(got, depth + 1)) {
					out.push({ ...inner, opt: inner.opt || e.opt });
				}
			} else {
				this.unresolved.push(
					`${e.ref?.m.name ?? "?"}@${e.ref?.n.start ?? -1}: ...${e.spread}`,
				);
			}
		});
		return out;
	}

	/** The object a value holds, when it holds one with keys: an empty result may be null or a number. */
	async objectValue(v: Val, depth = 0): Promise<Entry[] | undefined> {
		if (v.k === "obj") {
			return v.e;
		}
		if (v.k !== "unk" || !v.ref) {
			return undefined;
		}
		const got = await this.expr(v.ref.m, v.ref.n, v.ref.env, depth);
		return got !== undefined && got.length > 0 ? got : undefined;
	}

	/**
	 * Resolve spreads and the values that hold objects. A value left unknown loses its place in the
	 * program, so that no later step reads it again.
	 */
	async pin(entries: Entry[], depth = 0): Promise<Entry[]> {
		return mapSeq(await this.spreads(entries, depth), (e) =>
			"key" in e ? this.#pinValue(e, depth) : Promise.resolve(e),
		);
	}

	async #pinValue(
		e: Extract<Entry, { key: string }>,
		depth: number,
	): Promise<Entry> {
		const inner = depth < 8 ? await this.objectValue(e.val, depth) : undefined;
		if (inner) {
			return {
				...e,
				val: {
					k: "obj",
					e: await this.pin(inner, depth + 1),
					...(e.val.k === "obj" && e.val.open === true && { open: true }),
				},
			};
		}
		// It keeps its types, which are worked out while its place is known.
		return e.val.k === "unk"
			? {
					...e,
					val: {
						k: "unk",
						text: e.val.text,
						t: (await this.typeOfVal(e.val)) ?? null,
					},
				}
			: e;
	}
}
