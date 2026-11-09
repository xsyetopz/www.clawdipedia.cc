// Kind `file`: files and folders the program reads or writes in the config folder.
// Anchor (checked on 2.1.309, task 1.1): calls `join(base(), "<name>")` with a constant string as the last
// argument, where `base` is the config folder function (`Le()`). `base` is found by anchor, not by name: it
// is the name (a variable bound once, here to a memoized wrapper `Le=po(()=>…)`, followed across imports)
// that is called, with no arguments, as the first argument of a call with "history.jsonl" and also of one with
// "keybindings.json" as the last argument (in 2.1.309 both are `join(Le(),…)`). Joins to the project
// folder or the home folder (other first arguments) are not listed.
// The old `strings` heuristic has no file list, so there is nothing to compare.

import { constString, type Module, type Node, type Variable } from "../ast.ts";
import {
	asNode,
	type Extractor,
	scan,
	type SurfaceItem,
	unique,
} from "./common.ts";

const ANCHORS = ["history.jsonl", "keybindings.json"];

/** The callee `base` and the last constant string of `join(base(), …, "name")`, or undefined for another call. */
const joinParts = (
	m: Module,
	n: Node,
): { callee: Node; name: string } | undefined => {
	if (n.type !== "CallExpression" || n.arguments.length < 2) {
		return undefined;
	}
	const a0 = n.arguments[0];
	if (
		a0?.type !== "CallExpression" ||
		a0.arguments.length > 0 ||
		a0.callee.type !== "Identifier"
	) {
		return undefined;
	}
	const name = constString(m, asNode(n.arguments.at(-1)));
	const callee = asNode(a0.callee);
	return name === undefined || name === "" || !callee
		? undefined
		: { callee, name };
};

export const extractFiles: Extractor = (bundle) => {
	const byBase = new Map<Variable, SurfaceItem[]>();
	const anchored = new Map<Variable, Set<string>>();
	scan(bundle, ['"'], (m, n) => {
		const parts = joinParts(m, n);
		if (!parts) {
			return;
		}
		const { callee, name } = parts;
		const v = m.variable(callee);
		const base = v && (bundle.origin(m, v)?.variable ?? v);
		if (!base) {
			return;
		}
		const items = byBase.get(base) ?? [];
		items.push({ kind: "file", name, module: m.name, offset: n.start });
		byBase.set(base, items);
		if (ANCHORS.includes(name)) {
			const s = anchored.get(base) ?? new Set<string>();
			s.add(name);
			anchored.set(base, s);
		}
	});
	const out: SurfaceItem[] = [];
	for (const [base, items] of byBase) {
		if (ANCHORS.every((a) => anchored.get(base)?.has(a) === true)) {
			out.push(...items);
		}
	}
	return unique(out);
};
