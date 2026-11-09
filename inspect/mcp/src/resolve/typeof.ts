// The types an expression can give in a bundled program. `expr` (the keys of an object) comes from the
// class that extends this one.
import type * as t from "@babel/types";

import {
	type CallNode,
	functionOf,
	type Module,
	type Node,
	returnsOf,
} from "../ast.ts";
import { asNode } from "../ast/node.ts";
import { globalNameType, isString, logicalType } from "./rules.ts";
import {
	bind,
	COMPARE,
	globalCallType,
	importedCallType,
	isVoid,
	keyOf,
	memberCallType,
	SIMPLE_TYPES,
	unaryType,
} from "./tables.ts";
import {
	defaultTy,
	type Entry,
	type Env,
	jsonTypes,
	type JType,
	type Ty,
	union,
	type Val,
} from "./types.ts";
import { VarTypes } from "./vartypes.ts";

export abstract class TypeResolver extends VarTypes {
	protected readonly ty = (v: Val): JType[] | undefined => this.typeOfVal(v);

	abstract expr(
		m: Module,
		n: Node | null,
		env?: Env,
		depth?: number,
	): Entry[] | undefined;

	/** The JSON types a value can have, or undefined when the code does not show them. */
	typeOfVal(v: Val): JType[] | undefined {
		if (v.k !== "unk") {
			return defaultTy(v);
		}
		if (v.t !== undefined) {
			return v.t ?? undefined;
		}
		// A type can lead to keys, and keys to types: past a few levels, the type is not known.
		if (!v.ref || this.#nested > 4) {
			return undefined;
		}
		this.#nested++;
		try {
			return jsonTypes(this.typeOf(v.ref.m, v.ref.n, v.ref.env));
		} finally {
			this.#nested--;
		}
	}
	#nested = 0;

	/** The types an expression gives, "absent" for undefined; undefined when one of them is not known. */
	typeOf(m: Module, n: Node | null, env?: Env, depth = 0): Ty[] | undefined {
		// Without the arguments of a call, a node has one type: it is worked out once.
		if (!n || env) {
			return this.#typeOf(m, n, env, depth);
		}
		if (this.#types.has(n)) {
			return this.#types.get(n);
		}
		this.#types.set(n, undefined);
		const got = this.#typeOf(m, n, env, depth);
		this.#types.set(n, got);
		return got;
	}
	readonly #types = new Map<Node, Ty[] | undefined>();

	#typeOf(
		m: Module,
		n: Node | null,
		env?: Env,
		depth = 0,
		chained = false,
	): Ty[] | undefined {
		if (n?.type === "NullLiteral") {
			return ["null"];
		}
		if (!n || isVoid(n)) {
			return ["absent"];
		}
		if (depth > 12) {
			return undefined;
		}
		// A chain gives "absent" when a link is nullish.
		if (m.isChain(n) && !chained) {
			return union(this.#typeOf(m, n, env, depth + 1, true), ["absent"]);
		}
		const simple = SIMPLE_TYPES.get(n.type);
		if (simple) {
			return [simple];
		}
		return this.#exprType(m, n, env, depth);
	}

	/** The types of the node `x` inside an expression, one level deeper. */
	#sub(
		m: Module,
		x: t.Node | null | undefined,
		env: Env | undefined,
		depth: number,
	) {
		return this.typeOf(m, asNode(x) ?? null, env, depth + 1);
	}

	#exprType(
		m: Module,
		n: Node,
		env: Env | undefined,
		depth: number,
	): Ty[] | undefined {
		const sub = (x: t.Node | null | undefined) => this.#sub(m, x, env, depth);
		if (n.type === "UnaryExpression") {
			return [unaryType(n.operator)];
		}
		if (n.type === "BinaryExpression") {
			return this.#binaryType(n, sub);
		}
		if (n.type === "LogicalExpression") {
			return logicalType(n.operator, sub(n.left), sub(n.right));
		}
		if (n.type === "ConditionalExpression") {
			return union(sub(n.consequent), sub(n.alternate));
		}
		if (n.type === "SequenceExpression") {
			return sub(n.expressions.at(-1));
		}
		if (n.type === "AssignmentExpression") {
			return n.operator === "=" ? sub(n.right) : undefined;
		}
		if (n.type === "AwaitExpression") {
			return this.#awaitType(m, n, env, depth);
		}
		if (n.type === "CallExpression") {
			return this.#callType(m, n, env, depth, false);
		}
		if (n.type === "Identifier") {
			return this.#identType(m, n, env, depth);
		}
		if (n.type === "MemberExpression") {
			return this.#memberType(m, n, env, depth);
		}
		return undefined;
	}

	#awaitType(
		m: Module,
		n: t.AwaitExpression,
		env: Env | undefined,
		depth: number,
	): Ty[] | undefined {
		const arg = asNode(n.argument);
		return arg?.type === "CallExpression" && !m.isChain(arg)
			? this.#callType(m, arg, env, depth, true)
			: this.#sub(m, n.argument, env, depth);
	}

	#binaryType(
		n: t.BinaryExpression,
		sub: (x: t.Node | null | undefined) => Ty[] | undefined,
	): Ty[] | undefined {
		if (COMPARE.has(n.operator)) {
			return ["boolean"];
		}
		if (n.operator !== "+") {
			return ["number"];
		}
		const [a, b] = [sub(n.left), sub(n.right)];
		if (isString(a) || isString(b)) {
			return ["string"];
		}
		return a && b && [...a, ...b].every((x) => x === "number")
			? ["number"]
			: undefined;
	}

	#memberType(
		m: Module,
		n: Node & t.MemberExpression,
		env: Env | undefined,
		depth: number,
	): Ty[] | undefined {
		if (
			!n.computed &&
			n.property.type === "Identifier" &&
			(n.property.name === "length" || n.property.name === "size")
		) {
			return ["number"];
		}
		const key = keyOf(m, n);
		const obj = this.expr(m, asNode(n.object) ?? null, env, depth + 1);
		const e = obj?.find((x) => "key" in x && x.key === key);
		if (!e || !("key" in e)) {
			return undefined;
		}
		const got = this.typeOfVal(e.val);
		return got && (e.opt ? [...got, "absent"] : got);
	}

	#callType(
		m: Module,
		call: CallNode,
		env: Env | undefined,
		depth: number,
		awaited: boolean,
	): Ty[] | undefined {
		const c = asNode(call.callee);
		if (!c) {
			return undefined;
		}
		if (c.type === "Identifier") {
			const g = m.isGlobal(c) ? globalCallType(c.name) : importedCallType(m, c);
			if (g) {
				return [g];
			}
		}
		if (
			c.type === "MemberExpression" &&
			!c.computed &&
			c.property.type === "Identifier"
		) {
			const got = memberCallType(m, asNode(c.object), c.property.name);
			return got ? [got] : undefined;
		}
		const f = functionOf(m, c);
		if (!f || f.fn.generator === true || (f.fn.async && !awaited)) {
			return undefined;
		}
		const inner = bind(m, call, env, f.module, f.fn);
		const rets = returnsOf(f.fn);
		if (rets.length === 0) {
			return ["absent"];
		}
		let out: Ty[] | undefined = [];
		for (const r of rets) {
			out = union(out, this.typeOf(f.module, r, inner, depth + 1));
		}
		return out;
	}

	/** The types of a name: its argument in this call, the arguments at every call, or each write. */
	#identType(
		m: Module,
		id: Node,
		env: Env | undefined,
		depth: number,
	): Ty[] | undefined {
		if (id.type !== "Identifier") {
			return undefined;
		}
		const v = m.variable(id);
		if (!v) {
			return globalNameType(id.name);
		}
		if (env?.has(v) === true) {
			const arg = env.get(v);
			return arg ? this.typeOf(arg.m, arg.n, arg.env, depth + 1) : ["absent"];
		}
		const o = m.bundle?.origin(m, v) ?? { module: m, variable: v };
		return this.varTypeOf(o.module, o.variable, depth);
	}
}
