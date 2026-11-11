import {
	callsOf,
	type Fn,
	isFn,
	type Module,
	type Node,
	type Variable,
} from "../ast.ts";
import { asNode } from "../ast/node.ts";
import { firstSeq } from "../seq.ts";
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
	): Promise<Ty[] | undefined>;

	/** The types of a variable, worked out once; a variable that leads back to itself is not known. */
	protected async varTypeOf(
		m: Module,
		v: Variable,
		depth: number,
	): Promise<Ty[] | undefined> {
		if (this.#varTypes.has(v)) {
			return this.#varTypes.get(v);
		}
		this.#varTypes.set(v, undefined);
		const got = await this.#varType(m, v, depth);
		this.#varTypes.set(v, got);
		return got;
	}

	async #varType(
		m: Module,
		v: Variable,
		depth: number,
	): Promise<Ty[] | undefined> {
		const def = v.defs[0];
		if (def?.type === "Parameter") {
			const param = isFn(def.node)
				? await this.#paramType(m, def.name, def.node, depth)
				: undefined;
			return param;
		}
		if (def?.type !== "Variable" || def.node.id !== def.name) {
			return undefined;
		}
		if (inLoopHead(m, def)) {
			return undefined;
		}
		const written = await this.#writesType(
			m,
			v,
			def.node.init ? [] : ["absent"],
			depth,
		);
		return written;
	}

	/** The types a variable gets from each of its writes, starting from `out`. */
	async #writesType(
		m: Module,
		v: Variable,
		start: Ty[],
		depth: number,
	): Promise<Ty[] | undefined> {
		let out: Ty[] | undefined = start;
		const unknown = await firstSeq(
			v.references.filter((r) => r.write),
			async (r) => {
				const p = m.parent(r.identifier);
				const op = p?.type === "AssignmentExpression" ? p.operator : "=";
				const w: Ty[] | undefined =
					p?.type === "UpdateExpression"
						? ["number"]
						: await this.typeOf(m, r.writeExpr, undefined, depth + 1);
				out = writeType(out, op, w);
				return out ? undefined : true;
			},
		);
		return unknown ? undefined : out;
	}

	/** The types of a parameter: the argument at every call of its function. */
	async #paramType(
		m: Module,
		name: Node,
		fn: Fn,
		depth: number,
	): Promise<Ty[] | undefined> {
		const index = fn.params.map((p) => asNode(p)).indexOf(name);
		if (index === -1) {
			return undefined;
		}
		let out: Ty[] | undefined = [];
		const unknown = await firstSeq(
			await callsOf(m, fn),
			async (c): Promise<true | undefined> => {
				if (!c) {
					return true;
				}
				const args = c.call.arguments;
				if (args.slice(0, index + 1).some((a) => a.type === "SpreadElement")) {
					return true;
				}
				out = union(
					out,
					await this.typeOf(
						c.module,
						asNode(args[index]) ?? null,
						undefined,
						depth + 1,
					),
				);
				return undefined;
			},
		);
		return !unknown && out !== undefined && out.length > 0 ? out : undefined;
	}
}
