// Kind `tool`: the built-in tools, from `baseTools` (tools.ts, the `tool-gates` source), the array that
// `getAllBaseTools` returns. Anchor (checked on 2.1.309, task 1.1): the `getAllBaseTools:` key. `gate` is the
// code of the conditions on the tool's entry, `detail` its own `isEnabled`. baseTools gives no offsets.
// The old `strings` heuristic has no tool list, so there is nothing to compare.
import { Resolver } from "../resolve.ts";
import { baseTools } from "../tools.ts";
import { type Extractor, short, type SurfaceItem, unique } from "./common.ts";

export const extractTools: Extractor = async (bundle) => {
	const r = await baseTools(bundle, new Resolver());
	const items: SurfaceItem[] = [];
	for (const t of r.tools) {
		const item: SurfaceItem = {
			kind: "tool",
			name: t.name,
			module: r.module,
			offset: null,
		};
		if (t.when.length > 0) {
			item.gate = t.when.join(" && ");
		}
		if (t.enabled !== undefined && t.enabled !== "") {
			item.detail = short(t.enabled);
		}
		items.push(item);
	}
	return unique(items);
};
