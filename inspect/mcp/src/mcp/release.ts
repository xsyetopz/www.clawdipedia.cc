import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { listInstalls } from "../binary.ts";
import { type Change, diffIndexes, filterChanges, unitDiff } from "../diff.ts";
import { explain } from "../explain.ts";
import { checkNotes, readNotes } from "../notes.ts";
import { prepared } from "../prepare.ts";
import { type Args, clip, group, need, P, text, WRITES_CACHE } from "./app.ts";

const DIFF_LINES = 40;
const changeHead = (c: Change) => {
  const u = (c.to ?? c.from) as NonNullable<Change["to"]>;
  const at = [
    c.from && `${c.from.m}:${c.from.s}`,
    c.to && `${c.to.m}:${c.to.s}`,
  ]
    .filter(Boolean)
    .join(" -> ");
  return `## ${c.kind} ${u.k}  ${at}${c.within.length ? `  in ${c.within.slice(0, 3).join(", ")}` : ""}${c.calls.length ? `\n  calls: ${c.calls.slice(0, 6).join("; ")}` : ""}`;
};

group<Args & { from?: string; to?: string }>(
  "release",
  "Compare two Claude Code versions by function (diff), check the release notes against that diff (notes), or explain where a name lives and who, when, and how its code runs (explain).",
  "action",
  {
    diff: ({ from, to, name, offset = 0, limit = 30 }) => {
      const [x, y] = [need(from, "from"), need(to, "to")];
      const a = prepared(x);
      const b = prepared(y);
      const d = diffIndexes(a.index, b.index);
      const all = name ? filterChanges(d, name) : d.changes;
      const order = { changed: 0, added: 1, gone: 2 };
      // Small changes first: they are the most of a release and the cheapest to read.
      const size = (c: Change) =>
        (c.from?.t.length ?? 0) + (c.to?.t.length ?? 0);
      const list = [...all].sort(
        (x, y) => order[x.kind] - order[y.kind] || size(x) - size(y),
      );
      const page = list.slice(offset, offset + Math.min(limit, 30));
      const count = (k: Change["kind"]) =>
        all.filter((c) => c.kind === k).length;
      const more = offset + page.length < list.length;
      return text(
        `${a.index.version} -> ${b.index.version}: ${d.counts.changed} changed, ${d.counts.added} added, ${d.counts.gone} gone (imports and exports left out).${name ? ` Matching "${name}": ${count("changed")} changed, ${count("added")} added, ${count("gone")} gone.` : ""} Showing ${offset + 1}-${offset + page.length}${more ? `, next_offset ${offset + page.length}` : ""}.\n\n${page
          .map((c) => `${changeHead(c)}\n${unitDiff(c, DIFF_LINES).join("\n")}`)
          .join("\n\n")}`,
        {
          counts: d.counts,
          matching: name ? all.length : undefined,
          next_offset: more ? offset + page.length : undefined,
          changes: page.map((c) => ({
            kind: c.kind,
            label: (c.to ?? c.from)?.k,
            from: c.from && { module: c.from.m, offset: c.from.s },
            to: c.to && { module: c.to.m, offset: c.to.s },
            within: c.within.slice(0, 3),
            calls: c.calls.slice(0, 6),
            diff: unitDiff(c, DIFF_LINES),
          })),
        },
      );
    },
    notes: ({ version, from }) => {
      const b = prepared(version);
      const num = (v: string) => v.split(/[.-]/).map((x) => Number(x) || 0);
      const below = (x: string, y: string) => {
        const [p, q] = [num(x), num(y)];
        const i = p.findIndex((n, j) => n !== q[j]);
        return i >= 0 && (p[i] as number) < (q[i] ?? 0);
      };
      const older =
        from ??
        listInstalls()
          .map((i) => i.version)
          .filter((v) => below(v, b.index.version))
          .sort((x, y) => (below(x, y) ? 1 : -1))[0];
      if (!older)
        throw new Error(`no install older than ${b.index.version}; give from`);
      const a = prepared(older);
      const root = dirname(b.dir);
      const report = join(root, "diff", "report.md");
      const items = existsSync(report)
        ? readFileSync(report, "utf8")
            .split("\n")
            .filter((l) => l.startsWith("- "))
        : [];
      const lines = checkNotes(
        readNotes(b.index.version, join(root, "notes.md")),
        diffIndexes(a.index, b.index),
        items,
      );
      const count = (k: string) => lines.filter((l) => l.status === k).length;
      return text(
        `${b.index.version} notes against ${a.index.version}: ${lines.length} lines, ${count("matched")} matched, ${count("gated")} gated, ${count("unmatched")} unmatched. Read the code of each match before you state it.\n${lines
          .map((l) => {
            const u = l.change && (l.change.to ?? l.change.from);
            const why = u
              ? `\n    -> ${l.change?.kind} ${u.k} ${u.m}:${u.s} (${l.hits.join(", ")})`
              : l.item
                ? `\n    -> report: ${clip(l.item, 120)} (${l.hits.join(", ")})`
                : "";
            return `- [${l.status}] ${clip(l.line, 160)}${why}`;
          })
          .join("\n")}`,
        {
          lines: lines.map((l) => ({
            line: l.line,
            status: l.status,
            hits: l.hits,
            ...(l.change && {
              at: `${(l.change.to ?? l.change.from)?.m}:${(l.change.to ?? l.change.from)?.s}`,
            }),
          })),
        },
      );
    },
    explain: ({ version, name }) => {
      const wanted = need(name, "name");
      const r = prepared(version);
      const e = explain(r.index, wanted);
      if (!e) return text(`"${name}" is not in ${r.index.version}.`);
      const h = e.holder;
      const list = (xs: string[], n: number) =>
        xs.length
          ? `${xs.slice(0, n).join(", ")}${xs.length > n ? `, and ${xs.length - n} more` : ""}`
          : "none found";
      return text(
        [
          e.via === "text"
            ? `"${name}" in ${r.index.version}, found by a search of the code text: no string literal, key, or read names it`
            : `"${name}" in ${r.index.version}`,
          `Where: ${h.m}:${h.s} (${h.k})${e.others.length ? `; also in ${e.others.join(", ")}` : ""}`,
          `Who: ${list(e.who, 10)}`,
          `When: gates ${list(e.when.gates, 10)}; env reads ${list(e.when.env, 10)}${e.when.isEnabled ? `; isEnabled ${e.when.isEnabled}` : ""}`,
          `How: ${e.how.length ? e.how.map((x) => `${x.label} ${x.how}${x.value ? ` (returns ${x.value})` : ""}`).join("; ") : "no function"}`,
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
