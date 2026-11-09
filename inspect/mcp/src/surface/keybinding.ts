// Kind `keybinding`: keybinding actions and contexts.
// Anchor (checked on 2.1.309, task 1.1): two string arrays in one module (chunk-enj9vzgj.js), found by
// their literals: the contexts `["Global","Chat",…]` (the longest all-string array that holds "Global" and
// "Chat") and the actions `["app:interrupt",…,"chat:cancel",…]` (the longest that holds "chat:cancel").
// `detail` is "action" or "context".
// The old `strings` heuristic has no keybinding list, so there is nothing to compare.
import type { Node } from "../ast.ts";
import {
	type Extractor,
	scan,
	strings,
	type SurfaceItem,
	unique,
} from "./common.ts";

interface Best {
	m: string;
	n: Node;
	names: string[];
}

export const extractKeybindings: Extractor = (bundle) => {
	let actions: Best | undefined;
	let contexts: Best | undefined;
	scan(bundle, ['"chat:cancel"', '"Global"'], (m, n) => {
		if (n.type !== "ArrayExpression") {
			return;
		}
		const s = strings(m, n);
		if (!s) {
			return;
		}
		if (
			s.includes("chat:cancel") &&
			(!actions || s.length > actions.names.length)
		) {
			actions = { m: m.name, n, names: s };
		}
		if (
			s.includes("Global") &&
			s.includes("Chat") &&
			(!contexts || s.length > contexts.names.length)
		) {
			contexts = { m: m.name, n, names: s };
		}
	});
	const out: SurfaceItem[] = [];
	for (const [best, detail] of [
		[actions, "action"],
		[contexts, "context"],
	] as const) {
		for (const name of best?.names ?? []) {
			out.push({
				kind: "keybinding",
				name,
				module: best?.m ?? null,
				offset: best?.n.start ?? null,
				detail,
			});
		}
	}
	return unique(out);
};
