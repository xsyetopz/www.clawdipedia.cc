import { join } from "node:path";

import type { MapEntry } from "../../../surface/coverage.ts";
import { writeJson } from "../../util.ts";
import { type ByKind, type Group, itemsOf } from "./groups.ts";
import { diffKind, type DocFile, type KindDiff } from "./kind.ts";
import { pageOf } from "./page.ts";

export interface Rules {
	docs: DocFile[];
	names: Record<string, Map<string, string>>;
	map: Record<string, MapEntry>;
	exclusions: Record<string, string>;
}

/** Maps a prefixed name back to its kind by the prefix, then to its page. */
const pageFinder = (g: Group, r: Rules) => (n: string) => {
	const [kind = "", prefix = ""] =
		g.kinds.find(([, p]) => p !== "" && n.startsWith(p)) ??
		g.kinds.find(([, p]) => p === "") ??
		[];
	return pageOf(
		kind,
		n.slice(prefix.length),
		r.names[kind] ?? new Map<string, string>(),
		r.map,
		r.exclusions,
	);
};

/** Diffs one group and writes its JSON file under `ctx.dir`. */
export const writeGroup = async (
	g: Group,
	a: ByKind,
	b: ByKind,
	r: Rules,
	ctx: { from: string; to: string; dir: string },
): Promise<KindDiff> => {
	const items = itemsOf(g, b);
	const d = diffKind(
		g.key,
		ctx.from,
		ctx.to,
		itemsOf(g, a),
		items,
		r.docs,
		pageFinder(g, r),
	);
	await writeJson(join(ctx.dir, g.file), {
		...d,
		items: Object.fromEntries(items),
	});
	console.info(
		`  ${g.key}: ${d.fromCount} -> ${d.toCount} (+${d.added.length} -${d.removed.length} ~${d.changed.length})`,
	);
	return d;
};
