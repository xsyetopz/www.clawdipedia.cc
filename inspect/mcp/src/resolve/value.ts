// The keys of the object an expression gives; the calls, parameters, and pins come from the class that
// extends this one.
import {
	type CallNode,
	type Fn,
	isFn,
	isLit,
	type Module,
	type Node,
	type NodeOf,
	type Variable,
} from "../ast.ts";
import { asNode } from "../ast/node.ts";
import { allSeq, mapSeq } from "../seq.ts";
import { HeldEntries } from "./held.ts";
import {
	inLoopHead,
	isVoid,
	literalVal,
	memberPath,
	propKey,
	spreadParts,
	strings,
	unwrapped,
} from "./tables.ts";
import { type Entry, type Env, mergeEntries, type Val } from "./types.ts";
import { Writes } from "./writes.ts";

export abstract class ValueResolver extends HeldEntries {
	readonly #names = new Map<Node, Entry[] | undefined>();
	readonly #writes = new Writes();

	abstract param(
		m: Module,
		v: Variable,
		fn: Fn,
		depth: number,
	): Promise<Entry[] | undefined>;
	abstract call(
		m: Module,
		call: CallNode,
		env?: Env,
		depth?: number,
	): Promise<Entry[] | undefined>;
	abstract pin(entries: Entry[], depth?: number): Promise<Entry[]>;

	/** Entries of the object literal whose `{` is at `pos`; empty when there is none. */
	objectAt(m: Module, pos: number): Promise<Entry[]> {
		const o = m.at(pos, "ObjectExpression");
		return o ? this.entries(m, o) : Promise.resolve([]);
	}

	/** Entries of an object literal: keys (computed ones when they are constant strings) and spreads. */
	async entries(
		m: Module,
		obj: NodeOf<"ObjectExpression">,
		env?: Env,
	): Promise<Entry[]> {
		const out: Entry[] = [];
		await mapSeq(obj.properties, async (p) => {
			if (p.type === "SpreadElement") {
				await this.#spread(m, p.argument, false, env, out);
				return;
			}
			const key = await propKey(m, p);
			if (key === undefined) {
				return;
			}
			out.push({
				key,
				opt: false,
				val:
					p.method || p.kind !== "init"
						? { k: "unk", text: m.src(p.value) }
						: await this.value(m, p.value, env),
			});
		});
		return out;
	}

	/** Adds the entries a spread of `n` gives to `out`; `opt` marks them as present at some sites only. */
	async #spread(
		m: Module,
		n: Node,
		opt: boolean,
		env: Env | undefined,
		out: Entry[],
	): Promise<void> {
		if (n.type === "ObjectExpression") {
			for (const e of await this.entries(m, n, env)) {
				out.push({ ...e, opt: e.opt || opt });
			}
			return;
		}
		// `a && {...}`, `a ?? {...}`, `a || {...}`, and `c ? {...} : {...}`: the keys of either side.
		const parts = spreadParts(n);
		if (parts) {
			await mapSeq(parts, (part) => this.#spread(m, part, true, env, out));
		} else if (
			!isVoid(n) &&
			!isLit(n) &&
			!(n.type === "UnaryExpression" && n.operator === "!")
		) {
			out.push({ spread: m.src(n), opt, ref: { m, n, env } });
		}
	}

	/** `c ? "a" : "b"`: the strings of both branches; undefined when a branch is not a string. */
	async #branches(
		m: Module,
		n: NodeOf<"ConditionalExpression">,
		env?: Env,
	): Promise<Val | undefined> {
		const found = await allSeq([n.consequent, n.alternate], async (b) =>
			strings(await this.value(m, b, env)),
		);
		if (!found) {
			return undefined;
		}
		const v = [...new Set(found.flat())];
		return v.length === 1 ? { k: "str", v: v[0] ?? "" } : { k: "enum", v };
	}

	async value(m: Module, n: Node, env?: Env): Promise<Val> {
		const lit = literalVal(n);
		if (lit) {
			return lit;
		}
		if (n.type === "ConditionalExpression") {
			const v = await this.#branches(m, n, env);
			if (v) {
				return v;
			}
		}
		if (n.type === "ArrayExpression") {
			return { k: "arr" };
		}
		if (n.type === "ObjectExpression") {
			return { k: "obj", e: await this.entries(m, n, env) };
		}
		return { k: "unk", text: m.src(n), ref: { m, n, env } };
	}

	/**
	 * Entries of the object an expression gives: a literal, a call, a name, `a.b`, `await x`, `a,b`, or a
	 * ternary of those. Null and undefined give no entries, as a spread of them adds nothing.
	 */
	async expr(
		m: Module,
		n: Node | null,
		env?: Env,
		depth = 0,
	): Promise<Entry[] | undefined> {
		if (!n || isVoid(n)) {
			return [];
		}
		if (!this.#within(depth)) {
			return undefined;
		}
		const inner = unwrapped(n);
		if (inner !== undefined) {
			return this.expr(m, inner, env, depth);
		}
		if (n.type === "ConditionalExpression") {
			const a = await this.expr(m, asNode(n.consequent) ?? null, env, depth);
			const c = await this.expr(m, asNode(n.alternate) ?? null, env, depth);
			return a && c ? mergeEntries([a, c], this.ty) : undefined;
		}
		if (n.type === "ObjectExpression") {
			return this.pin(await this.entries(m, n, env), depth + 1);
		}
		if (n.type === "CallExpression") {
			return this.call(m, n, env, depth);
		}
		if (n.type === "Identifier") {
			return this.ident(m, n, env, depth);
		}
		return n.type === "MemberExpression"
			? this.#member(m, n, env, depth)
			: undefined;
	}

	/** Entries of the object `a.b.c` reads: each key of the path is followed through the object values. */
	async #member(
		m: Module,
		n: NodeOf<"MemberExpression">,
		env: Env | undefined,
		depth: number,
	): Promise<Entry[] | undefined> {
		const p = await memberPath(m, n);
		if (!p) {
			return undefined;
		}
		let got = await this.ident(m, p.root, env, depth);
		for (const k of p.path) {
			const e = got?.find((x) => "key" in x && x.key === k);
			got = e && "key" in e && e.val.k === "obj" ? e.val.e : undefined;
		}
		const last = p.path.at(-1);
		return (
			got ??
			(last === undefined ? undefined : await this.#assigned(m, last, depth))
		);
	}

	/** `o.key` whose object cannot be followed (a parameter of a function called with state, say): every write of `.key`, as minified code keeps property names. */
	#assigned(
		m: Module,
		key: string,
		depth: number,
	): Promise<Entry[] | undefined> {
		return this.#writes.entries(
			m,
			key,
			(mod, value) => this.expr(mod, value, undefined, depth + 1),
			(lists) => mergeEntries(lists, this.ty),
		);
	}

	#within(depth: number): boolean {
		return depth <= 12 && this.#writes.step();
	}

	/**
	 * Entries of the object that a name holds at its use: the value of each write before the use (and
	 * the keys that `name.key=` adds), the argument of the call it is evaluated in, or for a parameter the
	 * argument at every call site.
	 */
	async ident(
		m: Module,
		id: Node,
		env?: Env,
		depth = 0,
	): Promise<Entry[] | undefined> {
		const v = m.variable(id);
		if (!v) {
			return undefined;
		}
		if (env?.has(v) === true) {
			const arg = env.get(v);
			return arg ? this.expr(arg.m, arg.n, arg.env, depth + 1) : [];
		}
		const o = (await m.bundle?.origin(m, v)) ?? { module: m, variable: v };
		const def = o.variable.defs[0];
		if (def?.type === "Parameter") {
			return isFn(def.node)
				? this.param(o.module, o.variable, def.node, depth)
				: undefined;
		}
		return this.#declared(m, id, o, def, env, depth);
	}

	/** The entries of a name declared by a variable declarator, kept per name when it is read from another module. */
	async #declared(
		m: Module,
		id: Node,
		o: { module: Module; variable: Variable },
		def: Variable["defs"][number] | undefined,
		env: Env | undefined,
		depth: number,
	): Promise<Entry[] | undefined> {
		if (def?.type !== "Variable" || def.node.id !== def.name) {
			return undefined;
		}
		if (inLoopHead(o.module, def)) {
			return undefined;
		}
		// In another module every write counts; here, the writes before the use.
		const before = o.module === m ? id.start : Number.POSITIVE_INFINITY;
		const held = () =>
			this.held(o.module, o.variable, def.node.init, before, env, depth);
		if (env || o.module === m) {
			return held();
		}
		if (this.#names.has(def.name)) {
			return this.#names.get(def.name);
		}
		this.#names.set(def.name, undefined);
		const out = await held();
		this.#names.set(def.name, out);
		return out;
	}
}
