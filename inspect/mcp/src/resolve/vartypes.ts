import {
	callsOf,
	type Fn,
	isFn,
	type Module,
	type Node,
	type Variable,
} from "../ast.ts";
import { asNode } from "../ast/node.ts";
import { writeType } from "./rules.ts";
import { inLoopHead } from "./tables.ts";
import { type Env, type Ty, union } from "./types.ts";

/** The types of a variable: its argument in a call, the arguments at every call, or each write. */
export abstract class VarTypes {
	readonly #varTypes = new Map<Variable, Ty[] | undefined>();

	abstract typeOf(
		m: Module,
		n: Node | null,
		env?: Env,
		depth?: number,
	): Ty[] | undefined;

	/** The types of a variable, worked out once; a variable that leads back to itself is not known. */
	protected varTypeOf(m: Module, v: Variable, depth: number): Ty[] | undefined {
		if (this.#varTypes.has(v)) {
			return this.#varTypes.get(v);
		}
		this.#varTypes.set(v, undefined);
		const got = this.#varType(m, v, depth);
		this.#varTypes.set(v, got);
		return got;
	}

	#varType(m: Module, v: Variable, depth: number): Ty[] | undefined {
		const def = v.defs[0];
		if (def?.type === "Parameter") {
			return isFn(def.node)
				? this.#paramType(m, def.name, def.node, depth)
				: undefined;
		}
		if (def?.type !== "Variable" || def.node.id !== def.name) {
			return undefined;
		}
		if (inLoopHead(m, def)) {
			return undefined;
		}
		return this.#writesType(m, v, def.node.init ? [] : ["absent"], depth);
	}

	/** The types a variable gets from each of its writes, starting from `out`. */
	#writesType(
		m: Module,
		v: Variable,
		start: Ty[],
		depth: number,
	): Ty[] | undefined {
		let out: Ty[] | undefined = start;
		for (const r of v.references) {
			if (!r.write) {
				continue;
			}
			const p = m.parent(r.identifier);
			const op = p?.type === "AssignmentExpression" ? p.operator : "=";
			const w: Ty[] | undefined =
				p?.type === "UpdateExpression"
					? ["number"]
					: this.typeOf(m, r.writeExpr, undefined, depth + 1);
			out = writeType(out, op, w);
			if (!out) {
				return undefined;
			}
		}
		return out;
	}

	/** The types of a parameter: the argument at every call of its function. */
	#paramType(m: Module, name: Node, fn: Fn, depth: number): Ty[] | undefined {
		const index = fn.params.map((p) => asNode(p)).indexOf(name);
		if (index === -1) {
			return undefined;
		}
		let out: Ty[] | undefined = [];
		for (const c of callsOf(m, fn)) {
			if (!c) {
				return undefined;
			}
			const args = c.call.arguments;
			if (args.slice(0, index + 1).some((a) => a.type === "SpreadElement")) {
				return undefined;
			}
			out = union(
				out,
				this.typeOf(
					c.module,
					asNode(args[index]) ?? null,
					undefined,
					depth + 1,
				),
			);
		}
		return out && out.length > 0 ? out : undefined;
	}
}
