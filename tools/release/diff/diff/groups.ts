// The output groups of release:diff and the items of each group by prefixed name.
import type { SurfaceItem } from "../../../../inspect/mcp/src/surface/index.ts";
import { title } from "../../../surface/render.ts";

/** name -> detail ("" when the item has no default, values, gate, or detail). */
export type Items = Map<string, string>;
export type ByKind = Record<string, SurfaceItem[]>;

/** An output file: the surface kinds it holds, each with the prefix its names get. */
export interface Group {
	key: string;
	file: string;
	title: string;
	kinds: [string, string][];
}
export const LEGACY: Group[] = [
	{
		key: "env",
		file: "strings-env.json",
		title: "Environment variables",
		kinds: [["env", ""]],
	},
	{
		key: "flags",
		file: "flags.json",
		title: "CLI flags",
		kinds: [["flag", ""]],
	},
	{
		key: "commands",
		file: "commands.json",
		title: "Commands (cli:name = subcommand, /name = slash command)",
		kinds: [
			["subcommand", "cli:"],
			["slash-command", ""],
		],
	},
	{
		key: "settings",
		file: "settings.json",
		title: "Settings",
		kinds: [["setting", ""]],
	},
	{
		key: "hooks",
		file: "hooks.json",
		title: "Hook events",
		kinds: [["hook-event", ""]],
	},
	{
		key: "gates",
		file: "gates.json",
		title: "Gates",
		kinds: [["gate", ""]],
	},
];

/** The legacy groups, then one group for each other kind of either snapshot. */
export const groups = (kinds: string[]): Group[] => {
	const held = new Set(LEGACY.flatMap((g) => g.kinds.map(([k]) => k)));
	return [
		...LEGACY,
		...kinds
			.filter((k) => !held.has(k))
			.toSorted()
			.map((k): Group => ({
				key: k,
				file: `${k}.json`,
				title: title(k),
				kinds: [[k, ""]],
			})),
	];
};

const FIELDS = ["default", "values", "gate", "detail"] as const;
const detailOf = (i: SurfaceItem) =>
	FIELDS.flatMap((f) => {
		const v = i[f];
		if (v === undefined) {
			return [];
		}
		return [`${f}: ${Array.isArray(v) ? v.join(", ") : v}`];
	}).join("; ");

/** The items of a group by prefixed name. Items that share a name join their sorted details. */
export const itemsOf = (g: Group, byKind: ByKind): Items => {
	const all = new Map<string, string[]>();
	for (const [kind, prefix] of g.kinds) {
		for (const i of byKind[kind] ?? []) {
			const name = `${prefix}${i.name}`;
			all.set(name, [...(all.get(name) ?? []), detailOf(i)]);
		}
	}
	return new Map(
		[...all].map(([n, ds]) => [n, [...new Set(ds)].toSorted().join(" | ")]),
	);
};
