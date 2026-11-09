// The nested keys of kind `setting-key`: a walk over the zod value of each setting.
import type * as t from "@babel/types";

import { functionOf, isFn, type Node, returnsOf } from "../../ast.ts";
import { asNode, keyOf, propValue, type SurfaceItem } from "../common.ts";
import { item } from "./item.ts";
import {
	constOf,
	type Cx,
	entriesShape,
	SAME_PATH,
	SAME_PATH_METHODS,
	spreadTarget,
	zodType,
} from "./zod.ts";

const MAX_DEPTH = 40;

type Found = NonNullable<ReturnType<typeof functionOf>>;

/**
 * The nested keys of the zod value `n` at `path`. It follows helper functions through their returns (with their
 * parameters bound to the arguments), memoized schemas (`p(()=>…)`) through their callbacks, `z.object` shapes,
 * `Object.fromEntries(list.map((k)=>[k,v]))` shapes, and `z.record` values (as `path.*`).
 * Array items are left out, as in the generated schema walk.
 */
export class KeyWalk {
	readonly out: SurfaceItem[];
	readonly gate: string | undefined;

	constructor(out: SurfaceItem[], gate: string | undefined) {
		this.out = out;
		this.gate = gate;
	}

	walk(cx: Cx, n: Node | null | undefined): void {
		if (!n || cx.depth > MAX_DEPTH) {
			return;
		}
		if (
			n.type === "ArrowFunctionExpression" ||
			n.type === "FunctionExpression"
		) {
			for (const r of returnsOf(n)) {
				this.go(cx, r);
			}
		} else if (n.type === "ConditionalExpression") {
			this.#conditional(cx, n);
		} else if (n.type === "LogicalExpression") {
			this.go(cx, n.right);
		} else if (n.type === "Identifier") {
			this.#identifier(cx, n);
		} else if (n.type === "CallExpression") {
			this.#call(cx, n);
		}
	}

	go(cx: Cx, x: t.Node | null | undefined, over: Partial<Cx> = {}): void {
		this.walk({ ...cx, ...over, depth: cx.depth + 1 }, asNode(x));
	}

	#key(cx: Cx, k: string, v: Node, at: number, env = cx.env): void {
		const path = `${cx.path}.${k}`;
		this.out.push(item("setting-key", cx.m, path, v, at, this.gate));
		this.go(cx, v, { path, env });
	}

	#shape(cx: Cx, o: Node | undefined): void {
		if (o?.type !== "ObjectExpression") {
			this.#fromEntries(cx, o);
			return;
		}
		for (const p of o.properties) {
			if (p.type === "SpreadElement") {
				this.#shape(cx, spreadTarget(asNode(p.argument)));
				continue;
			}
			const k = keyOf(p);
			const v = propValue(p);
			const at = asNode(p);
			if (k !== undefined && k !== "" && v && at) {
				this.#key(cx, k, v, at.start);
			}
		}
	}

	#fromEntries(cx: Cx, o: Node | undefined): void {
		const shape = entriesShape(cx.m, o);
		if (!shape) {
			return;
		}
		for (const k of shape.keys) {
			const env = new Map(cx.env).set(shape.param, { value: k });
			this.#key(cx, k, shape.value, shape.value.start, env);
		}
	}

	/** `k === "default" ? a : b` with `k` bound to a constant picks one branch. */
	#conditional(cx: Cx, n: t.ConditionalExpression): void {
		const test = asNode(n.test);
		if (test?.type === "BinaryExpression" && /^[!=]==?$/u.test(test.operator)) {
			const l = constOf(cx.m, asNode(test.left), cx.env);
			const r = constOf(cx.m, asNode(test.right), cx.env);
			if (l !== undefined && r !== undefined) {
				const same = (l === r) === test.operator.startsWith("=");
				this.go(cx, same ? n.consequent : n.alternate);
				return;
			}
		}
		this.go(cx, n.consequent);
		this.go(cx, n.alternate);
	}

	#identifier(cx: Cx, n: Node & t.Identifier): void {
		const v = cx.m.variable(n);
		const b = v && cx.env.get(v);
		if (b) {
			if ("n" in b) {
				this.go(cx, b.n, { m: b.m });
			}
			return;
		}
		// a schema held in a variable: `var s=z.object({…})`
		const o =
			v &&
			(cx.m.bundle
				? cx.m.bundle.origin(cx.m, v)
				: { module: cx.m, variable: v });
		const d = o?.variable.defs[0];
		if (o && d?.type === "Variable") {
			this.go(cx, d.node.init, { m: o.module });
		}
	}

	#call(cx: Cx, n: t.CallExpression): void {
		const args = n.arguments.flatMap((a) => asNode(a) ?? []);
		const callee = asNode(n.callee);
		if (callee?.type === "MemberExpression") {
			this.#method(cx, callee, args);
			return;
		}
		const f = callee && functionOf(cx.m, callee);
		if (f) {
			this.#constructed(cx, f, args);
		} else {
			// `s()` where `var s=p(()=>z.object({…}))`: the memoized schema of a variable
			this.go(cx, callee);
		}
	}

	#method(cx: Cx, callee: t.MemberExpression, args: Node[]): void {
		const p = callee.property;
		this.go(cx, callee.object);
		if (p.type !== "Identifier" || !SAME_PATH_METHODS.has(p.name)) {
			return;
		}
		for (const a of args) {
			if (a.type === "ObjectExpression") {
				this.#shape(cx, a);
			} else {
				this.go(cx, a);
			}
		}
	}

	#constructed(cx: Cx, f: Found, args: Node[]): void {
		const type = zodType(f.module, f.fn);
		if (type === undefined) {
			this.#helper(cx, f, args);
		} else if (type === "object") {
			this.#shape(cx, args[0]);
		} else if (type === "record") {
			const value = args.length > 1 ? args[1] : args[0];
			this.go(cx, value, { path: `${cx.path}.*` });
		} else if (SAME_PATH.has(type)) {
			for (const a of args) {
				for (const e of a.type === "ArrayExpression" ? a.elements : [a]) {
					this.go(cx, e);
				}
			}
		}
	}

	/** A helper that builds a schema: its returns, with each parameter bound to its argument. */
	#helper(cx: Cx, f: Found, args: Node[]): void {
		const bound = new Map(cx.env);
		for (const [i, p] of f.fn.params.entries()) {
			const id = asNode(p);
			const v = id?.type === "Identifier" ? f.module.variable(id) : undefined;
			const a = args[i];
			if (v && a) {
				bound.set(v, { m: cx.m, n: a });
			}
		}
		for (const r of returnsOf(f.fn)) {
			this.go(cx, r, { m: f.module, env: bound });
		}
		// a callback that a wrapper outside the program calls: `p(()=>z.object({…}))` returns `lib.lazy(e)`
		for (const a of args) {
			if (isFn(a)) {
				this.go(cx, a);
			}
		}
	}
}
