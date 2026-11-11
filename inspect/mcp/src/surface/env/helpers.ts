// The parts of kind `env` that run after the scan: helpers that pass a name on, and lists that fill each other.
import { callsOf, constString, type Fn, nameOf, type Node } from "../../ast.ts";
import { mapSeq } from "../../seq.ts";
import { asNode, type SurfaceItem } from "../common.ts";
import { type Ctx, eachName, LISTED, paramOf } from "./shared.ts";

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

/** Names added from one list count for the next ones, until no list adds a name. */
export const growLists = (c: Ctx, out: SurfaceItem[]): void => {
	const found = new Set(out.map((i) => i.name));
	for (let grew = true; grew;) {
		grew = false;
		for (const l of c.lists) {
			if (l.names.filter((x) => found.has(x)).length * 3 < l.names.length) {
				continue;
			}
			for (const x of l.names) {
				if (!found.has(x) && LISTED.test(x)) {
					c.add(l.m, l.n, x, { detail: "listed" });
					found.add(x);
					grew = true;
				}
			}
		}
	}
};
