// Kind `hook-event`: the hook event names.
// Anchor (checked on 2.1.309, task 1.1): the longest array literal of PascalCase strings that holds
// "PreToolUse" and "PostToolUse" (`var Hd=["PreToolUse","PostToolUse",...]` in chunk-y5k2hwkv.js;
// chunk-pneybb7a.js holds the same 33). The 12 shorter lists of 2.1.309 hold no other name.
// Compared with the old `strings` heuristic: the same 33 names.
import type { Node } from "../ast.ts";
import {
	type Extractor,
	scan,
	strings,
	type SurfaceItem,
	unique,
} from "./common.ts";

const PASCAL = /^[A-Z][A-Za-z]+$/u;

export const extractHookEvents: Extractor = (bundle) => {
	let best: { m: string; n: Node; names: string[] } | undefined;
	scan(bundle, ['"PreToolUse"'], (m, n) => {
		if (n.type !== "ArrayExpression") {
			return;
		}
		const s = strings(m, n);
		if (
			!s ||
			!s.includes("PreToolUse") ||
			!s.includes("PostToolUse") ||
			!s.every((x) => PASCAL.test(x))
		) {
			return;
		}
		if (!best || s.length > best.names.length) {
			best = { m: m.name, n, names: s };
		}
	});
	if (!best) {
		return [];
	}
	const { m, n, names } = best;
	return unique(
		names.map((name): SurfaceItem => ({
			kind: "hook-event",
			name,
			module: m,
			offset: n.start,
		})),
	);
};
