import type { Module, Node, Variable } from "../ast.ts";
import { asNode } from "../ast/node.ts";
import { firstSeq } from "../seq.ts";
import { memberPath } from "./tables.ts";
import { TypeResolver } from "./typeof.ts";
import { type Entry, type Env, mergeEntries, type Val } from "./types.ts";

/** The entries a variable holds: its writes, and the keys later code adds with `name.key=value`. */
export abstract class HeldEntries extends TypeResolver {
	abstract value(m: Module, n: Node, env?: Env): Promise<Val>;

	/** The entries of the writes of `variable` that start before `before`, with the keys added by `name.key=value`. */
	protected async held(
		module: Module,
		variable: Variable,
		init: Node | null | undefined,
		before: number,
		env: Env | undefined,
		depth: number,
	): Promise<Entry[] | undefined> {
		const lists: Entry[][] = [];
		const later: Entry[] = [];
		if (!init) {
			lists.push([]);
		}
		const failed = await firstSeq(
			variable.references,
			async (r): Promise<true | undefined> => {
				if (r.identifier.start >= before) {
					return undefined;
				}
				const p = module.parent(r.identifier);
				if (r.write) {
					if (p?.type === "AssignmentExpression" && p.operator !== "=") {
						return undefined;
					}
					const got = await this.expr(module, r.writeExpr, env, depth + 1);
					if (!got) {
						return true;
					}
					lists.push(got);
					return undefined;
				}
				// `name.key=value` adds a key.
				const added = await this.#added(module, r.identifier, p, env);
				if (added) {
					later.push(added);
				}
				return undefined;
			},
		);
		if (failed) {
			return undefined;
		}
		const merged = [...(await mergeEntries(lists, this.ty)), ...later];
		// No key at all: the name may hold a string or a number, so it is no known object.
		return merged.length > 0 ? merged : undefined;
	}

	/** The key that `name.key=value` adds, where `p` is the member expression around the name `id`. */
	async #added(
		module: Module,
		id: Node,
		p: Node | undefined,
		env: Env | undefined,
	): Promise<Entry | undefined> {
		const a = p && module.parent(p);
		if (
			p?.type !== "MemberExpression" ||
			p.object !== id ||
			a?.type !== "AssignmentExpression" ||
			a.left !== p ||
			a.operator !== "="
		) {
			return undefined;
		}
		const path = await memberPath(module, p);
		const key = path?.path[0];
		const right = asNode(a.right);
		return key !== undefined && right
			? { key, opt: true, val: await this.value(module, right, env) }
			: undefined;
	}
}
