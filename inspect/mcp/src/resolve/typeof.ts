// The types an expression can give in a bundled program. `expr` (the keys of an object) comes from the
// class that extends this one.
import {
	type CallNode,
	functionOf,
	type Module,
	type Node,
	type NodeOf,
	returnsOf,
} from "../ast.ts";
import { asNode, isNull } from "../ast/node.ts";
import { mapSeq } from "../seq.ts";
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
	protected readonly ty = (v: Val): Promise<JType[] | undefined> =>
		this.typeOfVal(v);

	abstract expr(
		m: Module,
		n: Node | null,
		env?: Env,
		depth?: number,
	): Promise<Entry[] | undefined>;

	/** The JSON types a value can have, or undefined when the code does not show them. */
	async typeOfVal(v: Val): Promise<JType[] | undefined> {
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
			return jsonTypes(await this.typeOf(v.ref.m, v.ref.n, v.ref.env));
		} finally {
			this.#nested--;
		}
	}
	#nested = 0;

	/** The types an expression gives, "absent" for undefined; undefined when one of them is not known. */
	async typeOf(
		m: Module,
		n: Node | null,
		env?: Env,
		depth = 0,
	): Promise<Ty[] | undefined> {
		// Without the arguments of a call, a node has one type: it is worked out once.
		if (!n || env) {
			return this.#typeOf(m, n, env, depth);
		}
		if (this.#types.has(n)) {
			return this.#types.get(n);
		}
		this.#types.set(n, undefined);
		const got = await this.#typeOf(m, n, env, depth);
		this.#types.set(n, got);
		return got;
	}
	readonly #types = new Map<Node, Ty[] | undefined>();

	async #typeOf(
		m: Module,
		n: Node | null,
		env?: Env,
		depth = 0,
		chained = false,
	): Promise<Ty[] | undefined> {
		if (isNull(n)) {
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
			return union(await this.#typeOf(m, n, env, depth + 1, true), ["absent"]);
		}
		const simple = SIMPLE_TYPES.get(n.type);
		if (simple) {
			return [simple];
		}
		if (n.type === "Literal") {
			const ty = typeof n.value;
			return ty === "string" || ty === "number" || ty === "boolean"
				? [ty]
				: undefined;
		}
		return this.#exprType(m, n, env, depth);
	}

	/** The types of the node `x` inside an expression, one level deeper. */
	#sub(
		m: Module,
		x: Node | null | undefined,
		env: Env | undefined,
		depth: number,
	) {
		return this.typeOf(m, asNode(x) ?? null, env, depth + 1);
	}

	async #exprType(
		m: Module,
		n: Node,
		env: Env | undefined,
		depth: number,
	): Promise<Ty[] | undefined> {
		const sub = (x: Node | null | undefined) => this.#sub(m, x, env, depth);
		if (n.type === "UnaryExpression") {
			return [unaryType(n.operator)];
		}
		if (n.type === "BinaryExpression") {
			return this.#binaryType(n, sub);
		}
		if (n.type === "LogicalExpression") {
			const left = await sub(n.left);
			return logicalType(n.operator, left, await sub(n.right));
		}
		if (n.type === "ConditionalExpression") {
			const a = await sub(n.consequent);
			return union(a, await sub(n.alternate));
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
		n: NodeOf<"AwaitExpression">,
		env: Env | undefined,
		depth: number,
	): Promise<Ty[] | undefined> {
		const arg = asNode(n.argument);
		return arg?.type === "CallExpression" && !m.isChain(arg)
			? this.#callType(m, arg, env, depth, true)
			: this.#sub(m, n.argument, env, depth);
	}

	async #binaryType(
		n: NodeOf<"BinaryExpression">,
		sub: (x: Node | null | undefined) => Promise<Ty[] | undefined>,
	): Promise<Ty[] | undefined> {
		if (COMPARE.has(n.operator)) {
			return ["boolean"];
		}
		if (n.operator !== "+") {
			return ["number"];
		}
		const a = await sub(n.left);
		const b = await sub(n.right);
		if (isString(a) || isString(b)) {
			return ["string"];
		}
		return a && b && [...a, ...b].every((x) => x === "number")
			? ["number"]
			: undefined;
	}

	async #memberType(
		m: Module,
		n: NodeOf<"MemberExpression">,
		env: Env | undefined,
		depth: number,
	): Promise<Ty[] | undefined> {
		if (
			!n.computed &&
			n.property.type === "Identifier" &&
			(n.property.name === "length" || n.property.name === "size")
		) {
			return ["number"];
		}
		const key = await keyOf(m, n);
		const obj = await this.expr(m, asNode(n.object) ?? null, env, depth + 1);
		const e = obj?.find((x) => "key" in x && x.key === key);
		if (!e || !("key" in e)) {
			return undefined;
		}
		const got = await this.typeOfVal(e.val);
		return got && (e.opt ? [...got, "absent"] : got);
	}

	async #callType(
		m: Module,
		call: CallNode,
		env: Env | undefined,
		depth: number,
		awaited: boolean,
	): Promise<Ty[] | undefined> {
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
		const f = await functionOf(m, c);
		if (!f || f.fn.generator || (f.fn.async && !awaited)) {
			return undefined;
		}
		const inner = bind(m, call, env, f.module, f.fn);
		const rets = returnsOf(f.fn);
		if (rets.length === 0) {
			return ["absent"];
		}
		const types = await mapSeq(rets, (r) =>
			this.typeOf(f.module, r, inner, depth + 1),
		);
		let out: Ty[] | undefined = [];
		for (const t of types) {
			out = union(out, t);
		}
		return out;
	}

	/** The types of a name: its argument in this call, the arguments at every call, or each write. */
	async #identType(
		m: Module,
		id: Node,
		env: Env | undefined,
		depth: number,
	): Promise<Ty[] | undefined> {
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
		const o = (await m.bundle?.origin(m, v)) ?? { module: m, variable: v };
		return this.varTypeOf(o.module, o.variable, depth);
	}
}
