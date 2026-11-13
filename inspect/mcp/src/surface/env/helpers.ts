// The parts of kind `env` that run after the scan: helpers that pass a name on, and lists that fill each other.
import {
	callsOf,
	constString,
	type Fn,
	isFn,
	nameOf,
	type Node,
} from "../../ast.ts";
import { mapSeq } from "../../seq.ts";
import { asNode, type SurfaceItem } from "../common.ts";
import {
	type Ctx,
	eachName,
	LISTED,
	type NameList,
	paramOf,
} from "./shared.ts";

/** A helper may pass its parameter on to another helper (`wt(e)` -> `Su(e)` -> `process.env[e]`). */
export const resolveHelpers = async (c: Ctx): Promise<void> => {
	const done = new Set<Fn>();
	await mapSeq(c.helpers, async (h) => {
		if (done.has(h.fn)) {
			return;
		}
		done.add(h.fn);
		if (h.index === 0) {
			const uses: Node[] = [
				h.fn,
				...(nameOf(h.m, h.fn)?.references.map((r) => r.identifier) ?? []),
			];
			await mapSeq(uses, async (u) => {
				for (const s of await eachName(h.m, u)) {
					c.add(h.m, u, s);
				}
			});
		}
		await mapSeq(await callsOf(h.m, h.fn), async (call) => {
			if (!call) {
				return;
			}
			const a = asNode(call.call.arguments[h.index]);
			const s = await constString(call.module, a);
			const p = s === undefined && a ? paramOf(call.module, a) : undefined;
			if (s !== undefined) {
				c.add(call.module, call.call, s);
			} else if (p) {
				c.helpers.push({ m: call.module, ...p });
			}
		});
	});
};

/** The declaration that holds a list: `var a=new Set([...]),b=new Set([...])` splits one list in two. A list nested in another list or in a function is its own. */
const declOf = (l: NameList): Node => {
	let n = l.m.parent(l.n);
	while (
		n &&
		n.type !== "VariableDeclaration" &&
		n.type !== "ObjectExpression" &&
		n.type !== "ArrayExpression" &&
		!isFn(n)
	) {
		n = l.m.parent(n);
	}
	return n?.type === "VariableDeclaration" ? n : l.n;
};

/** Names added from one list count for the next ones, until no list adds a name. Lists of one declaration count as one. */
export const growLists = (c: Ctx, out: SurfaceItem[]): void => {
	const found = new Set(out.map((i) => i.name));
	const groups = Map.groupBy(c.lists, declOf).values().toArray();
	for (let grew = true; grew;) {
		grew = false;
		for (const g of groups) {
			const all = g.flatMap((l) => l.names);
			if (all.filter((x) => found.has(x)).length * 3 < all.length) {
				continue;
			}
			for (const [l, x] of g.flatMap((list) =>
				list.names.map((name) => [list, name] as const),
			)) {
				if (!found.has(x) && LISTED.test(x)) {
					c.add(l.m, l.n, x, { detail: "listed" });
					found.add(x);
					grew = true;
				}
			}
		}
	}
};
