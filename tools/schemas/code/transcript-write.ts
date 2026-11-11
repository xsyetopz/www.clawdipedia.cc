// Transcript lines: where the program adds a key to a line after building it.
import { callsOf, isFn, type Node } from "../../../inspect/mcp/src/ast.ts";
import { isNode } from "../../../inspect/mcp/src/ast/node.ts";
import { firstSeq } from "../../../inspect/mcp/src/seq.ts";
import { esc, type Json, mods, parsed, R, type Src } from "./ctx.ts";
import { copies, valType } from "./schema.ts";

/** The nearest object literal around `n`, inside the same function. */
const outerObject = (m: Src, n: Node): Node | undefined => {
	for (let x = m.parent(n); x && !isFn(x); x = m.parent(x)) {
		if (x.type === "ObjectExpression") {
			return x;
		}
	}
	return undefined;
};

const spreadIntoCopy = new Map<Node, boolean>();

/** A literal returned by a function, when a copy of a line spreads that function's result. */
const returnedIntoCopy = async (m: Src, obj: Node): Promise<boolean> => {
	if (m.parent(obj)?.type !== "ReturnStatement") {
		return false;
	}
	let fn = m.parent(obj);
	while (fn && !isFn(fn)) {
		fn = m.parent(fn);
	}
	if (!fn) {
		return false;
	}
	let hit = spreadIntoCopy.get(fn);
	if (hit === undefined) {
		const calls = await callsOf(m, fn);
		hit = calls.some((c) => {
			const sp = c?.module.parent(c.call);
			return sp?.type === "SpreadElement" && copies(c?.module.parent(sp));
		});
		spreadIntoCopy.set(fn, hit);
	}
	return hit;
};

/** A key in a copy of the line, in a spread inside one, or in a function spread into one. */
const laterInCopy = (key: string, k: string): Promise<Json | undefined> =>
	firstSeq(mods, async (t): Promise<Json | undefined> => {
		const hits = [...t.text.matchAll(new RegExp(`[{,]${k}:`, "gu"))];
		if (hits.length === 0) {
			return undefined;
		}
		const m = await parsed(t);
		return firstSeq(hits, async (h): Promise<Json | undefined> => {
			// A key of an object literal; `let{key:a,...rest}=line` is a pattern, which reads the key.
			const prop = m.parent(m.nodeAt(h.index + 1));
			const obj = prop && m.parent(prop);
			if (prop?.type !== "Property" || obj?.type !== "ObjectExpression") {
				return undefined;
			}
			if (
				!copies(obj) &&
				!copies(outerObject(m, obj)) &&
				!(await returnedIntoCopy(m, obj))
			) {
				return undefined;
			}
			const entries = await R.entries(m, obj);
			const e = entries.find((x) => "key" in x && x.key === key);
			if (!e || !("key" in e)) {
				return undefined;
			}
			return {
				...(await valType(e.val)),
				$comment:
					"Added after the line is built, by a copy of the line or a spread into one.",
			};
		});
	});

/** A property assignment. It can match an unrelated object, so copies of a line come first. */
const laterAssign = (k: string): Promise<Json | undefined> =>
	firstSeq(mods, async (t): Promise<Json | undefined> => {
		const hits = [...t.text.matchAll(new RegExp(`\\.${k}=(?!=)`, "gu"))];
		if (hits.length === 0) {
			return undefined;
		}
		const m = await parsed(t);
		return firstSeq(hits, async (h): Promise<Json | undefined> => {
			const member = m.parent(m.nodeAt(h.index + 1));
			const assign = member && m.parent(member);
			if (assign?.type !== "AssignmentExpression" || assign.left !== member) {
				return undefined;
			}
			if (!isNode(assign.right)) {
				return undefined;
			}
			return {
				...(await valType(await R.value(m, assign.right))),
				$comment: "Added after the line is built, by a property assignment.",
			};
		});
	});

/**
 * Where the program adds `key` to a line after building it: a key in a copy of the line (`{...line, key}`),
 * a key in a spread inside such a copy, a key returned by a function spread into one, or last a property
 * assignment (`x.key=`). The type comes from a literal value; else it is unverified.
 */
export const laterWrite = async (key: string): Promise<Json | undefined> => {
	const k = esc(key);
	return (await laterInCopy(key, k)) ?? laterAssign(k);
};
