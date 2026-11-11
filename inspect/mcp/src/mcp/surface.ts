import type { Node } from "../ast.ts";
import { program } from "../binary.ts";
import { eventSites } from "../events.ts";
import { type Entry, mergeEntries, type Val } from "../resolve.ts";
import { mapSeq } from "../seq.ts";
import { envPlaces } from "../surface/env.ts";
import { KINDS, surface, type SurfaceItem } from "../surface/index.ts";
import { baseTools } from "../tools.ts";
import {
	ARGS,
	type Args,
	clip,
	group,
	has,
	MAX_CHARS,
	messageOf,
	need,
	P,
	text,
} from "./app.ts";

/** An analyzer result as plain JSON: a key ending in "?" is optional. */
const valJson = (v: Val): unknown => {
	if (v.k === "obj") {
		return entriesJson(v.e);
	}
	if (v.k === "str" || v.k === "num" || v.k === "bool") {
		return { const: v.v };
	}
	if (v.k === "enum") {
		return { enum: v.v };
	}
	if (v.k === "arr") {
		return { type: "array" };
	}
	return { unknown: clip(v.text, 120) };
};
const entriesJson = (entries: Entry[]): Record<string, unknown> =>
	Object.fromEntries(
		entries.map((e) =>
			"key" in e
				? [`${e.key}${e.opt ? "?" : ""}`, valJson(e.val)]
				: [`...${clip(e.spread, 80)}`, "unresolved spread"],
		),
	);

const SURFACE_LIMIT = 200;
const SURFACE_NAME_CHARS = 120;
/** Room kept in the reply for the header line (it names the filter and the next offset). */
const SURFACE_HEADER_CHARS = 300;
/** A read through a list starts at the callback, so the list name is in the text before it. */
const PLACE_BEFORE = 60;
const PLACE_AFTER = 200;
const surfaceLine = (i: SurfaceItem) =>
	`- ${clip(i.name, SURFACE_NAME_CHARS)}${i.default === undefined ? "" : `  default ${i.default}`}${i.values ? `  values ${i.values.join("|")}` : ""}${has(i.gate) ? `  gate ${clip(i.gate, 120)}` : ""}${has(i.detail) ? `  (${clip(i.detail, 120)})` : ""}  ${i.module ?? "-"}:${i.offset ?? "-"}`;

const kindCount = async (
	bundle: Parameters<typeof surface>[0],
	modules: Parameters<typeof surface>[2],
	k: string,
) => {
	try {
		const items = await surface(bundle, k, modules);
		return `- ${k}: ${items.length}`;
	} catch (error) {
		return `- ${k}: error: ${messageOf(error)}`;
	}
};

const listKind = async (
	kind: string,
	{ name, offset = 0, limit = SURFACE_LIMIT, version }: Args,
) => {
	const p = await program(version);
	const bundle = p.bundle();
	if (kind === "") {
		const rows = await mapSeq(Object.keys(KINDS), (k) =>
			kindCount(bundle, p.modules, k),
		);
		return text(rows.join("\n"));
	}
	const q = name?.toLowerCase();
	const found = await surface(bundle, kind, p.modules);
	const all = found.filter((i) => !has(q) || i.name.toLowerCase().includes(q));
	const budget = MAX_CHARS - SURFACE_HEADER_CHARS;
	let used = 0;
	const lines: string[] = [];
	for (const i of all.slice(offset, offset + limit)) {
		const l = surfaceLine(i);
		if (used + l.length + 1 > budget) {
			if (lines.length === 0) {
				lines.push(l.slice(0, budget));
			}
			break;
		}
		lines.push(l);
		used += l.length + 1;
	}
	const more = offset + lines.length < all.length;
	return text(
		`${kind}: items ${offset + 1}-${offset + lines.length} of ${all.length}${has(name) ? ` matching "${clip(name, 100)}"` : ""}${more ? `, next_offset ${offset + lines.length}` : ""}\n${lines.join("\n")}`,
	);
};

group(
	"surface",
	`List what a Claude Code binary exposes by kind (${Object.keys(KINDS).join(", ")}), or resolve object-keys, event-keys, tool-gates, or env-places (every place that names the environment variable \`name\`: a typed registry entry, a read, a name set for a child process, or a list entry) from its code.`,
	"kind",
	{
		...Object.fromEntries(
			["", ...Object.keys(KINDS)].map((k) => [k, (a: Args) => listKind(k, a)]),
		),
		"object-keys": async ({ module, offset, anchor, version }) => {
			const p = await program(version);
			const R = p.resolver;
			const bundle = p.bundle();
			const modName = need(module, "module");
			const m = await bundle.get(modName);
			if (!m) {
				throw new Error(`no JavaScript module "${modName}"`);
			}
			const pos = has(anchor) ? m.text.indexOf(anchor) : (offset ?? -1);
			if (pos < 0) {
				throw new Error(
					has(anchor) ? `anchor not found: ${anchor}` : "give offset or anchor",
				);
			}
			let obj: Node | undefined = m.nodeAt(pos);
			while (obj && obj.type !== "ObjectExpression") {
				obj = m.parent(obj);
			}
			if (!obj) {
				throw new Error(`no object literal around ${module}@${pos}`);
			}
			const before = R.unresolved.length;
			const keys = entriesJson(await R.pin(await R.entries(m, obj)));
			const unresolved = [...new Set(R.unresolved.slice(before))];
			return text(
				`${JSON.stringify(keys, null, 2)}${unresolved.length > 0 ? `\n\nSpreads not followed:\n${unresolved.map((u) => `- ${u}`).join("\n")}` : ""}`,
				{ keys, unresolved },
			);
		},
		"event-keys": async ({ name, version }) => {
			const p = await program(version);
			const events = await eventSites(p.bundle(), p.resolver);
			if (!has(name)) {
				return text(
					[...events]
						.toSorted(([a], [b]) => a.localeCompare(b))
						.map(([n, l]) => `- ${n}: ${l.length} call sites`)
						.join("\n"),
					{
						events: Object.fromEntries(
							[...events].map(([n, l]) => [n, l.length]),
						),
					},
				);
			}
			const lists = events.get(name.replace(/^claude_code\./u, ""));
			if (!lists) {
				throw new Error(
					`no event "${name}"; events: ${[...events.keys()].join(", ")}`,
				);
			}
			const keys = entriesJson(await mergeEntries(lists));
			return text(
				`${lists.length} call sites\n${JSON.stringify(keys, null, 2)}`,
				{
					sites: lists.length,
					keys,
				},
			);
		},
		"env-places": async ({ name, version }) => {
			const p = await program(version);
			const bundle = p.bundle();
			const wanted = need(name, "name");
			const found = await envPlaces(bundle);
			const places = found.filter((i) => i.name === wanted);
			const lines = places.map((i) => {
				const at = i.offset ?? 0;
				const src = bundle.texts
					.get(i.module ?? "")
					?.slice(Math.max(0, at - PLACE_BEFORE), at + PLACE_AFTER);
				return `- ${i.detail ?? "read"}  ${i.module}:${at}\n  ${src?.replaceAll("\n", " ")}`;
			});
			return text(`${wanted}: places ${places.length}\n${lines.join("\n")}`);
		},
		"tool-gates": async ({ version }) => {
			const p = await program(version);
			const r = await baseTools(p.bundle(), p.resolver);
			return text(
				`${r.module}: ${r.tools.length} tools\n${r.tools
					.map(
						(t) =>
							`- ${t.name}${t.unresolved ? " (unresolved)" : ""}${t.when.length > 0 ? `  when: ${t.when.join(" && ")}` : ""}${has(t.enabled) ? `  own: ${t.enabled}` : ""}`,
					)
					.join("\n")}\n\nFunctions:\n${Object.entries(r.functions)
					.map(([n, s]) => `- ${n}: ${s}`)
					.join("\n")}`,
				r,
			);
		},
	},
	{
		version: P.version,
		name: P.name,
		module: P.module,
		offset: P.offset,
		limit: P.limit,
		anchor: ARGS.anchor.describe(
			"For object-keys: text inside the literal, instead of offset.",
		),
	},
);
