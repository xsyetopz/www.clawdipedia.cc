import type * as t from "@babel/types";
import { z } from "zod";
import type { Node } from "../ast.ts";
import { program } from "../binary.ts";
import { eventSites } from "../events.ts";
import { type Entry, mergeEntries, type Val } from "../resolve.ts";
import { KINDS, type SurfaceItem, surface } from "../surface/index.ts";
import { baseTools } from "../tools.ts";
import { type Args, clip, group, MAX_CHARS, need, P, text } from "./app.ts";

/** An analyzer result as plain JSON: a key ending in "?" is optional. */
const valJson = (v: Val): unknown =>
  v.k === "obj"
    ? entriesJson(v.e)
    : v.k === "str" || v.k === "num" || v.k === "bool"
      ? { const: v.v }
      : v.k === "enum"
        ? { enum: v.v }
        : v.k === "arr"
          ? { type: "array" }
          : { unknown: clip(v.text, 120) };
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
const surfaceLine = (i: SurfaceItem) =>
  `- ${clip(i.name, SURFACE_NAME_CHARS)}${i.default !== undefined ? `  default ${i.default}` : ""}${i.values ? `  values ${i.values.join("|")}` : ""}${i.gate ? `  gate ${clip(i.gate, 120)}` : ""}${i.detail ? `  (${clip(i.detail, 120)})` : ""}  ${i.module ?? "-"}:${i.offset ?? "-"}`;

const listKind = (
  kind: string,
  { name, offset = 0, limit = SURFACE_LIMIT, version }: Args,
) => {
  const { bundle, modules } = program(version);
  if (!kind)
    return text(
      Object.keys(KINDS)
        .map((k) => {
          try {
            return `- ${k}: ${surface(bundle, k, modules).length}`;
          } catch (e) {
            return `- ${k}: error: ${(e as Error).message}`;
          }
        })
        .join("\n"),
    );
  const q = name?.toLowerCase();
  const all = surface(bundle, kind, modules).filter(
    (i) => !q || i.name.toLowerCase().includes(q),
  );
  const budget = MAX_CHARS - SURFACE_HEADER_CHARS;
  let used = 0;
  const lines: string[] = [];
  for (const i of all.slice(offset, offset + limit)) {
    const l = surfaceLine(i);
    if (used + l.length + 1 > budget) {
      if (!lines.length) lines.push(l.slice(0, budget));
      break;
    }
    lines.push(l);
    used += l.length + 1;
  }
  const more = offset + lines.length < all.length;
  return text(
    `${kind}: items ${offset + 1}-${offset + lines.length} of ${all.length}${name ? ` matching "${clip(name, 100)}"` : ""}${more ? `, next_offset ${offset + lines.length}` : ""}\n${lines.join("\n")}`,
  );
};

group<Args & { kind?: string; anchor?: string }>(
  "surface",
  `List what a Claude Code binary exposes by kind (${Object.keys(KINDS).join(", ")}), or resolve object-keys, event-keys, or tool-gates from its code.`,
  "kind",
  {
    ...Object.fromEntries(
      ["", ...Object.keys(KINDS)].map((k) => [k, (a: Args) => listKind(k, a)]),
    ),
    "object-keys": ({ module, offset, anchor, version }) => {
      const { bundle, resolver: R } = program(version);
      const m = bundle.get(need(module, "module"));
      if (!m) throw new Error(`no JavaScript module "${module}"`);
      const pos = anchor ? m.text.indexOf(anchor) : (offset ?? -1);
      if (pos < 0)
        throw new Error(
          anchor ? `anchor not found: ${anchor}` : "give offset or anchor",
        );
      let obj: Node | undefined = m.nodeAt(pos);
      while (obj && obj.type !== "ObjectExpression") obj = m.parent(obj);
      if (!obj) throw new Error(`no object literal around ${module}@${pos}`);
      const before = R.unresolved.length;
      const keys = entriesJson(
        R.pin(R.entries(m, obj as Node & t.ObjectExpression)),
      );
      const unresolved = [...new Set(R.unresolved.slice(before))];
      return text(
        `${JSON.stringify(keys, null, 2)}${unresolved.length ? `\n\nSpreads not followed:\n${unresolved.map((u) => `- ${u}`).join("\n")}` : ""}`,
        { keys, unresolved },
      );
    },
    "event-keys": ({ name, version }) => {
      const { bundle, resolver } = program(version);
      const events = eventSites(bundle, resolver);
      if (!name)
        return text(
          [...events]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([n, l]) => `- ${n}: ${l.length} call sites`)
            .join("\n"),
          {
            events: Object.fromEntries(
              [...events].map(([n, l]) => [n, l.length]),
            ),
          },
        );
      const lists = events.get(name.replace(/^claude_code\./, ""));
      if (!lists)
        throw new Error(
          `no event "${name}"; events: ${[...events.keys()].join(", ")}`,
        );
      const keys = entriesJson(mergeEntries(lists));
      return text(
        `${lists.length} call sites\n${JSON.stringify(keys, null, 2)}`,
        {
          sites: lists.length,
          keys,
        },
      );
    },
    "tool-gates": ({ version }) => {
      const { bundle, resolver } = program(version);
      const r = baseTools(bundle, resolver);
      return text(
        `${r.module}: ${r.tools.length} tools\n${r.tools
          .map(
            (t) =>
              `- ${t.name}${t.unresolved ? " (unresolved)" : ""}${t.when.length ? `  when: ${t.when.join(" && ")}` : ""}${t.enabled ? `  own: ${t.enabled}` : ""}`,
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
    anchor: z
      .string()
      .optional()
      .describe("For object-keys: text inside the literal, instead of offset."),
  },
);
