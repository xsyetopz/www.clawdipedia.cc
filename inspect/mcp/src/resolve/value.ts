// The keys of the object an expression gives; the calls, parameters, and pins come from the class that
// extends this one.
import type * as t from "@babel/types";

import {
	type CallNode,
	type Fn,
	isFn,
	isLit,
	type Module,
	type Node,
	valueStart,
	type Variable,
} from "../ast.ts";
import { asNode } from "../ast/node.ts";
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
	): Entry[] | undefined;
	abstract call(
		m: Module,
		call: CallNode,
		env?: Env,
		depth?: number,
	): Entry[] | undefined;
	abstract pin(entries: Entry[], depth?: number): Entry[];

	/** Entries of the object literal whose `{` is at `pos`; empty when there is none. */
	objectAt(m: Module, pos: number): Entry[] {
		const o = m.at(pos, "ObjectExpression");
		return o ? this.entries(m, o) : [];
	}

	/** Entries of an object literal: keys (computed ones when they are constant strings) and spreads. */
	entries(m: Module, obj: Node & t.ObjectExpression, env?: Env): Entry[] {
		const out: Entry[] = [];
		for (const raw of obj.properties) {
			const p = asNode(raw);
			if (!p) {
				continue;
			}
			if (p.type === "SpreadElement") {
				const arg = asNode(p.argument);
				if (arg) {
					this.#spread(m, arg, false, env, out);
				}
				continue;
			}
			if (p.type !== "ObjectProperty" && p.type !== "ObjectMethod") {
				continue;
			}
			const key = propKey(m, p);
			if (key === undefined) {
				continue;
			}
			out.push({
				key,
				opt: false,
				val:
					p.type === "ObjectProperty"
						? this.#valueOf(m, p.value, env)
						: { k: "unk", text: m.text.slice(valueStart(m.text, p), p.end) },
			});
		}
		return out;
	}

	/** Adds the entries a spread of `n` gives to `out`; `opt` marks them as present at some sites only. */
	#spread(
		m: Module,
		n: Node,
		opt: boolean,
		env: Env | undefined,
		out: Entry[],
	) {
		if (n.type === "ObjectExpression") {
			for (const e of this.entries(m, n, env)) {
				out.push({ ...e, opt: e.opt || opt });
			}
			return;
		}
		// `a && {...}`, `a ?? {...}`, `a || {...}`, and `c ? {...} : {...}`: the keys of either side.
		const parts = spreadParts(n);
		if (parts) {
			for (const part of parts) {
				this.#spread(m, part, true, env, out);
			}
		} else if (
			!isVoid(n) &&
			!isLit(n) &&
			!(n.type === "UnaryExpression" && n.operator === "!")
		) {
			out.push({ spread: m.src(n), opt, ref: { m, n, env } });
		}
	}

	/** The value of a node the parser may have left without a position; unknown when it has none. */
	#valueOf(m: Module, x: t.Node | null | undefined, env?: Env): Val {
		const n = asNode(x);
		return n ? this.value(m, n, env) : { k: "unk", text: "" };
	}

	/** `c ? "a" : "b"`: the strings of both branches; undefined when a branch is not a string. */
	#branches(
		m: Module,
		n: Node & t.ConditionalExpression,
		env?: Env,
	): Val | undefined {
		const all: string[] = [];
		for (const b of [n.consequent, n.alternate]) {
			const strs = strings(this.#valueOf(m, b, env));
			if (!strs) {
				return undefined;
			}
			all.push(...strs);
		}
		const v = [...new Set(all)];
		return v.length === 1 ? { k: "str", v: v[0] ?? "" } : { k: "enum", v };
	}

	value(m: Module, n: Node, env?: Env): Val {
		const lit = literalVal(n);
		if (lit) {
			return lit;
		}
		if (n.type === "ConditionalExpression") {
			const v = this.#branches(m, n, env);
			if (v) {
				return v;
			}
		}
		if (n.type === "ArrayExpression") {
			return { k: "arr" };
		}
		if (n.type === "ObjectExpression") {
			return { k: "obj", e: this.entries(m, n, env) };
		}
		return { k: "unk", text: m.src(n), ref: { m, n, env } };
	}

	/**
	 * Entries of the object an expression gives: a literal, a call, a name, `a.b`, `await x`, `a,b`, or a
	 * ternary of those. Null and undefined give no entries, as a spread of them adds nothing.
	 */
	expr(m: Module, n: Node | null, env?: Env, depth = 0): Entry[] | undefined {
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
			const a = this.expr(m, asNode(n.consequent) ?? null, env, depth);
			const c = this.expr(m, asNode(n.alternate) ?? null, env, depth);
			return a && c ? mergeEntries([a, c], this.ty) : undefined;
		}
		if (n.type === "ObjectExpression") {
			return this.pin(this.entries(m, n, env), depth + 1);
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
	#member(
		m: Module,
		n: Node & t.MemberExpression,
		env: Env | undefined,
		depth: number,
	): Entry[] | undefined {
		const p = memberPath(m, n);
		if (!p) {
			return undefined;
		}
		let got = this.ident(m, p.root, env, depth);
		for (const k of p.path) {
			const e = got?.find((x) => "key" in x && x.key === k);
			got = e && "key" in e && e.val.k === "obj" ? e.val.e : undefined;
		}
		const last = p.path.at(-1);
		return (
			got ?? (last === undefined ? undefined : this.#assigned(m, last, depth))
		);
	}

	/** `o.key` whose object cannot be followed (a parameter of a function called with state, say): every write of `.key`, as minified code keeps property names. */
	#assigned(m: Module, key: string, depth: number): Entry[] | undefined {
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
	ident(m: Module, id: Node, env?: Env, depth = 0): Entry[] | undefined {
		const v = m.variable(id);
		if (!v) {
			return undefined;
		}
		if (env?.has(v) === true) {
			const arg = env.get(v);
			return arg ? this.expr(arg.m, arg.n, arg.env, depth + 1) : [];
		}
		const o = m.bundle?.origin(m, v) ?? { module: m, variable: v };
		const def = o.variable.defs[0];
		if (def?.type === "Parameter") {
			return isFn(def.node)
				? this.param(o.module, o.variable, def.node, depth)
				: undefined;
		}
		return this.#declared(m, id, o, def, env, depth);
	}

	/** The entries of a name declared by a variable declarator, kept per name when it is read from another module. */
	#declared(
		m: Module,
		id: Node,
		o: { module: Module; variable: Variable },
		def: Variable["defs"][number] | undefined,
		env: Env | undefined,
		depth: number,
	): Entry[] | undefined {
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
		const out = held();
		this.#names.set(def.name, out);
		return out;
	}
}
