// The nested keys of kind `setting-key`: a walk over the zod value of each setting.
import {
	type CallNode,
	functionOf,
	isFn,
	type Node,
	type NodeOf,
	returnsOf,
} from "../../ast.ts";
import { mapSeq } from "../../seq.ts";
import { keyOf, type SurfaceItem } from "../common.ts";
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

type Found = NonNullable<Awaited<ReturnType<typeof functionOf>>>;

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

	async walk(cx: Cx, n: Node | null | undefined): Promise<void> {
		if (!n || cx.depth > MAX_DEPTH) {
			return;
		}
		if (
			n.type === "ArrowFunctionExpression" ||
			n.type === "FunctionExpression"
		) {
			await mapSeq(returnsOf(n), (r) => this.go(cx, r));
		} else if (n.type === "ConditionalExpression") {
			await this.#conditional(cx, n);
		} else if (n.type === "LogicalExpression") {
			await this.go(cx, n.right);
		} else if (n.type === "Identifier") {
			await this.#identifier(cx, n);
		} else if (n.type === "CallExpression") {
			await this.#call(cx, n);
		}
	}

	async go(
		cx: Cx,
		x: Node | null | undefined,
		over: Partial<Cx> = {},
	): Promise<void> {
		await this.walk({ ...cx, ...over, depth: cx.depth + 1 }, x);
	}

	async #key(
		cx: Cx,
		k: string,
		v: Node,
		at: number,
		env = cx.env,
	): Promise<void> {
		const path = `${cx.path}.${k}`;
		const it = await item("setting-key", cx.m, path, v, at, this.gate);
		this.out.push(it);
		await this.go(cx, v, { path, env });
	}

	async #shape(cx: Cx, o: Node | undefined): Promise<void> {
		if (o?.type !== "ObjectExpression") {
			await this.#fromEntries(cx, o);
			return;
		}
		await mapSeq(o.properties, async (p) => {
			if (p.type === "SpreadElement") {
				await this.#shape(cx, spreadTarget(p.argument));
				return;
			}
			const k = keyOf(p);
			if (k !== undefined && k !== "") {
				await this.#key(cx, k, p.value, p.start);
			}
		});
	}

	async #fromEntries(cx: Cx, o: Node | undefined): Promise<void> {
		const shape = await entriesShape(cx.m, o);
		if (!shape) {
			return;
		}
		await mapSeq(shape.keys, async (k) => {
			const env = new Map(cx.env).set(shape.param, { value: k });
			await this.#key(cx, k, shape.value, shape.value.start, env);
		});
	}

	/** `k === "default" ? a : b` with `k` bound to a constant picks one branch. */
	async #conditional(
		cx: Cx,
		n: NodeOf<"ConditionalExpression">,
	): Promise<void> {
		const { test } = n;
		if (test.type === "BinaryExpression" && /^[!=]==?$/u.test(test.operator)) {
			const l = await constOf(cx.m, test.left, cx.env);
			const r = await constOf(cx.m, test.right, cx.env);
			if (l !== undefined && r !== undefined) {
				const same = (l === r) === test.operator.startsWith("=");
				await this.go(cx, same ? n.consequent : n.alternate);
				return;
			}
		}
		await this.go(cx, n.consequent);
		await this.go(cx, n.alternate);
	}

	async #identifier(cx: Cx, n: NodeOf<"Identifier">): Promise<void> {
		const v = cx.m.variable(n);
		const b = v && cx.env.get(v);
		if (b) {
			if ("n" in b) {
				await this.go(cx, b.n, { m: b.m });
			}
			return;
		}
		// a schema held in a variable: `var s=z.object({…})`
		const o =
			v &&
			(cx.m.bundle
				? await cx.m.bundle.origin(cx.m, v)
				: { module: cx.m, variable: v });
		const d = o?.variable.defs[0];
		if (o && d?.type === "Variable") {
			await this.go(cx, d.node.init, { m: o.module });
		}
	}

	async #call(cx: Cx, n: CallNode): Promise<void> {
		const { arguments: args, callee } = n;
		if (callee.type === "MemberExpression") {
			await this.#method(cx, callee, args);
			return;
		}
		const f = await functionOf(cx.m, callee);
		if (f) {
			await this.#constructed(cx, f, args);
		} else {
			// `s()` where `var s=p(()=>z.object({…}))`: the memoized schema of a variable
			await this.go(cx, callee);
		}
	}

	async #method(
		cx: Cx,
		callee: NodeOf<"MemberExpression">,
		args: Node[],
	): Promise<void> {
		const p = callee.property;
		await this.go(cx, callee.object);
		if (p.type !== "Identifier" || !SAME_PATH_METHODS.has(p.name)) {
			return;
		}
		await mapSeq(args, (a) =>
			a.type === "ObjectExpression" ? this.#shape(cx, a) : this.go(cx, a),
		);
	}

	async #constructed(cx: Cx, f: Found, args: Node[]): Promise<void> {
		const type = zodType(f.module, f.fn);
		if (type === undefined) {
			await this.#helper(cx, f, args);
		} else if (type === "object") {
			await this.#shape(cx, args[0]);
		} else if (type === "record") {
			const value = args.length > 1 ? args[1] : args[0];
			await this.go(cx, value, { path: `${cx.path}.*` });
		} else if (SAME_PATH.has(type)) {
			await mapSeq(args, (a) => {
				const list: (Node | null)[] =
					a.type === "ArrayExpression" ? a.elements : [a];
				return mapSeq(list, (e) => this.go(cx, e));
			});
		}
	}

	/** A helper that builds a schema: its returns, with each parameter bound to its argument. */
	async #helper(cx: Cx, f: Found, args: Node[]): Promise<void> {
		const bound = new Map(cx.env);
		for (const [i, p] of f.fn.params.entries()) {
			const v = p.type === "Identifier" ? f.module.variable(p) : undefined;
			const a = args[i];
			if (v && a) {
				bound.set(v, { m: cx.m, n: a });
			}
		}
		await mapSeq(returnsOf(f.fn), (r) =>
			this.go(cx, r, { m: f.module, env: bound }),
		);
		// a callback that a wrapper outside the program calls: `p(()=>z.object({…}))` returns `lib.lazy(e)`
		await mapSeq(
			args.filter((a) => isFn(a)),
			(a) => this.go(cx, a),
		);
	}
}
