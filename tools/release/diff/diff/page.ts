import { relative } from "node:path";

import {
	exclusionOf,
	type MapEntry,
	mapOf,
	PAGES,
	status,
} from "../../../surface/coverage.ts";
import { ROOT } from "../../util.ts";

/** The page of an item of the new version: its docs table, its map route, its exclusion, or the page of its kind. */
export const pageOf = (
	kind: string,
	name: string,
	docs: Map<string, string>,
	map: Record<string, MapEntry>,
	exclusions: Record<string, string>,
): string => {
	const key = `${kind}:${name}`;
	const how = status(kind, name, { [kind]: docs }, map, exclusions);
	if (how === "docs") {
		return relative(ROOT, docs.get(name) ?? "");
	}
	if (how === "mapped") {
		const m = mapOf(key, map);
		return m?.anchor === undefined || m.anchor === ""
			? (m?.route ?? "")
			: `${m.route}#${m.anchor}`;
	}
	if (how === "excluded") {
		return `excluded: ${exclusions[exclusionOf(key, exclusions) ?? ""]}`;
	}
	const p = PAGES[kind]?.[0];
	return p !== undefined && p !== "" && p !== "docs"
		? `${p} (no row yet)`
		: "no page yet";
};
