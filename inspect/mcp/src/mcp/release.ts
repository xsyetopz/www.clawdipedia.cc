import { dirname, join } from "node:path";

import { z } from "zod";

import { listInstalls } from "../binary.ts";
import { type Change, diffIndexes, filterChanges, unitDiff } from "../diff.ts";
import { explain } from "../explain.ts";
import { checkNotes, type NoteLine, readNotes } from "../notes.ts";
import { prepared } from "../prepare.ts";
import { clip, group, has, need, P, text, WRITES_CACHE } from "./app.ts";

const DIFF_LINES = 40;
const MAX_PAGE = 30;
const ORDER = { changed: 0, added: 1, gone: 2 };
const unitOf = (c: Change) => c.to ?? c.from;
const changeHead = (c: Change) => {
	const u = unitOf(c);
	const at = [
		c.from && `${c.from.m}:${c.from.s}`,
		c.to && `${c.to.m}:${c.to.s}`,
	]
		.filter((x) => x !== undefined)
		.join(" -> ");
	return `## ${c.kind} ${u?.k ?? "?"}  ${at}${c.within.length > 0 ? `  in ${c.within.slice(0, 3).join(", ")}` : ""}${c.calls.length > 0 ? `\n  calls: ${c.calls.slice(0, 6).join("; ")}` : ""}`;
};
// Small changes first: they are the most of a release and the cheapest to read.
const size = (c: Change) => (c.from?.t.length ?? 0) + (c.to?.t.length ?? 0);
const byKindThenSize = (l: Change, r: Change) =>
	ORDER[l.kind] - ORDER[r.kind] || size(l) - size(r);
const countKind = (all: Change[], k: Change["kind"]) =>
	all.filter((c) => c.kind === k).length;

const num = (v: string) => v.split(/[.-]/u).map((part) => Number(part) || 0);
const below = (left: string, right: string) => {
	const [p, q] = [num(left), num(right)];
	const i = p.findIndex((n, j) => n !== q[j]);
	return i !== -1 && (p[i] ?? 0) < (q[i] ?? 0);
};
const newestBelow = async (version: string) => {
	const installs = await listInstalls();
	return installs
		.map((i) => i.version)
		.filter((v) => below(v, version))
		.toSorted((l, r) => (below(l, r) ? 1 : -1))[0];
};
const reportItems = async (report: string) => {
	const file = Bun.file(report);
	if (!(await file.exists())) {
		return [];
	}
	const body = await file.text();
	return body.split("\n").filter((l) => l.startsWith("- "));
};
const noteWhy = (l: NoteLine) => {
	const u = l.change && unitOf(l.change);
	if (u) {
		return `\n    -> ${l.change?.kind} ${u.k} ${u.m}:${u.s} (${l.hits.join(", ")})`;
	}
	if (has(l.item)) {
		return `\n    -> report: ${clip(l.item, 120)} (${l.hits.join(", ")})`;
	}
	return "";
};
const noteJson = (l: NoteLine) => {
	const u = l.change && unitOf(l.change);
	const row = { line: l.line, status: l.status, hits: l.hits };
	return u ? { ...row, at: `${u.m}:${u.s}` } : row;
};
const list = (xs: string[], n: number) =>
	xs.length > 0
		? `${xs.slice(0, n).join(", ")}${xs.length > n ? `, and ${xs.length - n} more` : ""}`
		: "none found";

group(
	"release",
	"Compare two Claude Code versions by function (diff), check the release notes against that diff (notes), or explain where a name lives and who, when, and how its code runs (explain).",
	"action",
	{
		diff: async ({ from, to, name, offset = 0, limit = MAX_PAGE }) => {
			const a = await prepared(need(from, "from"));
			const b = await prepared(need(to, "to"));
			const d = diffIndexes(a.index, b.index);
			const all = has(name) ? filterChanges(d, name) : d.changes;
			const sorted = all.toSorted(byKindThenSize);
			const page = sorted.slice(offset, offset + Math.min(limit, MAX_PAGE));
			const more = offset + page.length < sorted.length;
			const match = has(name)
				? ` Matching "${name}": ${countKind(all, "changed")} changed, ${countKind(all, "added")} added, ${countKind(all, "gone")} gone.`
				: "";
			return text(
				`${a.index.version} -> ${b.index.version}: ${d.counts.changed} changed, ${d.counts.added} added, ${d.counts.gone} gone (imports and exports left out).${match} Showing ${offset + 1}-${offset + page.length}${more ? `, next_offset ${offset + page.length}` : ""}.\n\n${page
					.map((c) => `${changeHead(c)}\n${unitDiff(c, DIFF_LINES).join("\n")}`)
					.join("\n\n")}`,
				{
					counts: d.counts,
					matching: has(name) ? all.length : undefined,
					next_offset: more ? offset + page.length : undefined,
					changes: page.map((c) => ({
						kind: c.kind,
						label: unitOf(c)?.k,
						from: c.from && { module: c.from.m, offset: c.from.s },
						to: c.to && { module: c.to.m, offset: c.to.s },
						within: c.within.slice(0, 3),
						calls: c.calls.slice(0, 6),
						diff: unitDiff(c, DIFF_LINES),
					})),
				},
			);
		},
		notes: async ({ version, from }) => {
			const b = await prepared(version);
			const older = has(from) ? from : await newestBelow(b.index.version);
			if (!has(older)) {
				throw new Error(`no install older than ${b.index.version}; give from`);
			}
			const a = await prepared(older);
			const root = dirname(b.dir);
			const items = await reportItems(join(root, "diff", "report.md"));
			const lines = checkNotes(
				await readNotes(b.index.version, join(root, "notes.md")),
				diffIndexes(a.index, b.index),
				items,
			);
			const count = (k: string) => lines.filter((l) => l.status === k).length;
			return text(
				`${b.index.version} notes against ${a.index.version}: ${lines.length} lines, ${count("matched")} matched, ${count("gated")} gated, ${count("unmatched")} unmatched. Read the code of each match before you state it.\n${lines
					.map((l) => `- [${l.status}] ${clip(l.line, 160)}${noteWhy(l)}`)
					.join("\n")}`,
				{ lines: lines.map((l) => noteJson(l)) },
			);
		},
		explain: async ({ version, name }) => {
			const wanted = need(name, "name");
			const r = await prepared(version);
			const e = explain(r.index, wanted);
			if (!e) {
				return text(`"${wanted}" is not in ${r.index.version}.`);
			}
			const h = e.holder;
			const how =
				e.how.length > 0
					? e.how
							.map(
								(x) =>
									`${x.label} ${x.how}${has(x.value) ? ` (returns ${x.value})` : ""}`,
							)
							.join("; ")
					: "no function";
			return text(
				[
					e.via === "text"
						? `"${wanted}" in ${r.index.version}, found by a search of the code text: no string literal, key, or read names it`
						: `"${wanted}" in ${r.index.version}`,
					`Where: ${h.m}:${h.s} (${h.k})${e.others.length > 0 ? `; also in ${e.others.join(", ")}` : ""}`,
					`Who: ${list(e.who, 10)}`,
					`When: gates ${list(e.when.gates, 10)}; env reads ${list(e.when.env, 10)}${has(e.when.isEnabled) ? `; isEnabled ${e.when.isEnabled}` : ""}`,
					`How: ${how}`,
					"What:",
					...e.what,
				].join("\n"),
				{
					where: `${h.m}:${h.s}`,
					via: e.via,
					who: e.who,
					when: e.when,
					how: e.how,
				},
			);
		},
	},
	{
		version: P.version,
		from: z.string().optional().describe("Older version or path."),
		to: z.string().optional().describe("Newer version or path."),
		name: z
			.string()
			.optional()
			.describe(
				"diff: keep changes whose code or enclosing strings hold this; explain: the string, command, or tool name.",
			),
		offset: P.offset,
		limit: z.number().int().min(1).max(30).optional(),
	},
	{ ...WRITES_CACHE, openWorldHint: true },
);
