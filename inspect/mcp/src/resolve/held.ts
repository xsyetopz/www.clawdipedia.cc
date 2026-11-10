import type { Module, Node, Variable } from "../ast.ts";
import { asNode } from "../ast/node.ts";
import { memberPath } from "./tables.ts";
import { TypeResolver } from "./typeof.ts";
import { type Entry, type Env, mergeEntries, type Val } from "./types.ts";

/** The entries a variable holds: its writes, and the keys later code adds with `name.key=value`. */
export abstract class HeldEntries extends TypeResolver {
	abstract value(m: Module, n: Node, env?: Env): Val;

	/** The entries of the writes of `variable` that start before `before`, with the keys added by `name.key=value`. */
	protected held(
		module: Module,
		variable: Variable,
		init: Node | null | undefined,
		before: number,
		env: Env | undefined,
		depth: number,
	): Entry[] | undefined {
		const lists: Entry[][] = [];
		const later: Entry[] = [];
		if (!init) {
			lists.push([]);
		}
		for (const r of variable.references) {
			if (r.identifier.start >= before) {
				continue;
			}
			const p = module.parent(r.identifier);
			if (r.write) {
				if (p?.type === "AssignmentExpression" && p.operator !== "=") {
					continue;
				}
				const got = this.expr(module, r.writeExpr, env, depth + 1);
				if (!got) {
					return undefined;
				}
				lists.push(got);
				continue;
			}
			// `name.key=value` adds a key.
			const added = this.#added(module, r.identifier, p, env);
			if (added) {
				later.push(added);
			}
		}
		const merged = [...mergeEntries(lists, this.ty), ...later];
		// No key at all: the name may hold a string or a number, so it is no known object.
		return merged.length > 0 ? merged : undefined;
	}

	/** The key that `name.key=value` adds, where `p` is the member expression around the name `id`. */
	#added(
		module: Module,
		id: Node,
		p: Node | undefined,
		env: Env | undefined,
	): Entry | undefined {
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
		const key = memberPath(module, p)?.path[0];
		const right = asNode(a.right);
		return key !== undefined && right
			? { key, opt: true, val: this.value(module, right, env) }
			: undefined;
	}
}
