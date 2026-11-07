// Surface 2: transcript lines, from the entry type registry and every literal that writes a line.
import { join } from "node:path";
import {
  callsOf,
  type Fn,
  isFn,
  type Node,
} from "../../../inspect/mcp/src/ast.ts";
import { type Entry, mergeEntries } from "../../../inspect/mcp/src/resolve.ts";
import { isTranscriptSite } from "../transcript-sites.ts";
import {
  CAPTURES,
  esc,
  header,
  idx,
  type Json,
  markObserved,
  mods,
  note,
  OUT,
  only,
  props,
  R,
  readJson,
  type Src,
  VERSION,
} from "./ctx.ts";
import { copies, objSchema, valType } from "./schema.ts";

const CHAIN = ["user", "assistant", "system", "attachment", "progress"];

/** The nearest object literal around `n`, inside the same function. */
const outerObject = (m: Src, n: Node): Node | undefined => {
  for (let x = m.parent(n); x && !isFn(x); x = m.parent(x))
    if (x.type === "ObjectExpression") return x;
  return undefined;
};

/**
 * Where the program adds `key` to a line after building it: a key in a copy of the line (`{...line, key}`),
 * a key in a spread inside such a copy, a key returned by a function spread into one, or last a property
 * assignment (`x.key=`). The type comes from a literal value; else it is unverified.
 */
const spreadIntoCopy = new Map<Node, boolean>();
const laterWrite = (key: string): Json | undefined => {
  const k = esc(key);
  // A literal returned by a function, when a copy of a line spreads that function's result.
  const returnedIntoCopy = (m: Src, obj: Node): boolean => {
    if (m.parent(obj)?.type !== "ReturnStatement") return false;
    let fn = m.parent(obj);
    while (fn && !isFn(fn)) fn = m.parent(fn);
    if (!fn) return false;
    let hit = spreadIntoCopy.get(fn);
    if (hit === undefined) {
      hit = callsOf(m, fn as Fn).some((c) => {
        const sp = c?.module.parent(c.call);
        return sp?.type === "SpreadElement" && copies(c?.module.parent(sp));
      });
      spreadIntoCopy.set(fn, hit);
    }
    return hit;
  };
  for (const m of mods) {
    const re = new RegExp(`[{,]${k}:`, "g");
    for (let h = re.exec(m.text); h; h = re.exec(m.text)) {
      // A key of an object literal; `let{key:a,...rest}=line` is a pattern, which reads the key.
      const prop = m.parent(m.nodeAt(h.index + 1));
      const obj = prop && m.parent(prop);
      if (prop?.type !== "ObjectProperty" || obj?.type !== "ObjectExpression")
        continue;
      if (
        !copies(obj) &&
        !copies(outerObject(m, obj)) &&
        !returnedIntoCopy(m, obj)
      )
        continue;
      const e = R.entries(m, obj).find((x) => "key" in x && x.key === key);
      if (!e || !("key" in e)) continue;
      return {
        ...valType(e.val),
        $comment:
          "Added after the line is built, by a copy of the line or a spread into one.",
      };
    }
  }
  // Last, a property assignment. It can match an unrelated object, so copies of a line come first.
  for (const m of mods) {
    const re = new RegExp(`\\.${k}=(?!=)`, "g");
    for (let h = re.exec(m.text); h; h = re.exec(m.text)) {
      const member = m.parent(m.nodeAt(h.index + 1));
      const assign = member && m.parent(member);
      if (assign?.type !== "AssignmentExpression" || assign.left !== member)
        continue;
      return {
        ...valType(R.value(m, assign.right as Node)),
        $comment: "Added after the line is built, by a property assignment.",
      };
    }
  }
  return undefined;
};

export const buildTranscript = (): { file: string; schema: Json } => {
  const reg = only('{user:"transcript",assistant:"transcript"');
  const regAt = idx(reg, '{user:"transcript",assistant:"transcript"');
  const registry = R.objectAt(reg, regAt);
  const types = registry.flatMap((e) => ("key" in e ? [e.key] : []));
  const policy = new Map(
    registry.flatMap((e) =>
      "key" in e && e.val.k === "str" ? [[e.key, e.val.v] as const] : [],
    ),
  );

  // Fields the writer adds to every message line: the literal in insertMessageChain plus its spreads.
  const wRe = /parentUuid:[\w$]+\?null:[\w$]+,logicalParentUuid:/;
  const w = mods.find((m) => wRe.test(m.text)) as Src;
  const wAt = w.text.lastIndexOf("{", idx(w, wRe));
  const common = objSchema(R.objectAt(w, wAt), "const");

  // Every `{type:"<t>",...}` literal in the program.
  const sites = new Map<string, { src: Src; at: number; entries: Entry[] }[]>();
  const re = /\{(?:\.\.\.[\w$.()]+,)?type:"([\w-]+)"[,}]/g;
  for (const m of mods) {
    let hit: RegExpExecArray | null = re.exec(m.text);
    while (hit) {
      const t = hit[1] as string;
      if (types.includes(t)) {
        const list = sites.get(t) ?? [];
        list.push({ src: m, at: hit.index, entries: R.objectAt(m, hit.index) });
        sites.set(t, list);
      }
      hit = re.exec(m.text);
    }
    // Literals where `type:"<t>"` comes later, such as an assistant message built as {message, ..., type:"assistant"}:
    // the literal that holds the key.
    const mid = /,type:"([\w-]+)"[,}]/g;
    for (let h = mid.exec(m.text); h; h = mid.exec(m.text)) {
      const t = h[1] as string;
      if (!types.includes(t)) continue;
      const prop = m.parent(m.nodeAt(h.index + 1));
      const obj = prop && m.parent(prop);
      if (prop?.type !== "ObjectProperty" || obj?.type !== "ObjectExpression")
        continue;
      const list = sites.get(t) ?? [];
      if (!list.some((x) => x.src === m && x.at === obj.start))
        list.push({ src: m, at: obj.start, entries: R.entries(m, obj) });
      sites.set(t, list);
    }
  }
  const keysOf = (entries: Entry[]) =>
    entries.flatMap((e) => ("key" in e ? [e.key] : []));
  // Every property name in the stream-json schema, which generate.ts wrote before this step.
  const streamKeys = new Set<string>();
  const walk = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    const p = (o as Json)["properties"];
    if (p && typeof p === "object") for (const k in p) streamKeys.add(k);
    for (const v of Object.values(o)) walk(v);
  };
  walk(readJson(join(OUT, "claude-code-stream-json.json")));

  const probe = readJson(join(CAPTURES, "print/transcripts.lines.json"));
  const data = (probe?.["data"] ?? {}) as Json;

  const $defs: Record<string, Json> = {};
  const noCode: string[] = [];
  for (const t of types) {
    const all = sites.get(t) ?? [];
    let use: typeof all;
    if (CHAIN.includes(t)) {
      // Message constructors: they carry uuid, and no stream-json snake_case key.
      use = all.filter((s) =>
        isTranscriptSite(
          t,
          keysOf(s.entries),
          streamKeys,
          s.src.text.slice(Math.max(0, s.at - 8), s.at),
        ),
      );
    } else {
      use = all.filter((s) => keysOf(s.entries).includes("sessionId"));
      if (use.length === 0) use = all.filter((s) => s.src === reg);
    }
    const schema = objSchema(
      mergeEntries(use.map((s) => R.pin(s.entries))),
      "const",
    );
    const p = props(schema);
    // `type` is the discriminator, whatever the sites say.
    const withType: Record<string, Json> = { type: { const: t } };
    for (const [k, v] of Object.entries(p)) if (k !== "type") withType[k] = v;
    schema["properties"] = withType;
    if (CHAIN.includes(t))
      for (const [k, v] of Object.entries(props(common)))
        if (!(k in withType)) withType[k] = v;
    if (use.length === 0) noCode.push(t);
    // toolUseResult is a tool's output data (an object, or an array or a string for some tools) or an error string.
    const tur = withType["toolUseResult"];
    if (t === "user" && tur && !tur["type"])
      tur["type"] = ["object", "string", "array"];
    const seen = data[`line.${t}`];
    if (Array.isArray(seen)) {
      // A key a probe saw that no constructor has is added by a later step: find that write.
      const fresh = (seen as string[]).filter((k) => !(k in withType));
      const lost: string[] = [];
      for (const k of fresh) {
        const site = laterWrite(k);
        if (site) withType[k] = site;
        else lost.push(k);
      }
      markObserved(schema, seen as string[]);
      if (lost.length)
        note(
          `transcript ${t}: probe keys with no write site: ${lost.join(", ")}`,
        );
    }
    schema["$comment"] =
      `Registry policy: ${policy.get(t) ?? "none"}. Code sites used: ${use.length}.${use.length ? "" : " The program reads this type, and no code in this build writes it, so only `type` is known."}`;
    $defs[t] = schema;
  }
  if (noCode.length)
    note(
      `transcript: read-only types (the program reads them, and no code in this build writes them): ${noCode.join(", ")}`,
    );
  const probed = Object.keys(data)
    .filter((k) => k.startsWith("line."))
    .map((k) => k.slice(5));
  for (const t of probed)
    if (!types.includes(t))
      note(`transcript: probe line type ${t} is not in the registry`);

  const ordered = Object.fromEntries(
    Object.entries($defs).sort(([a], [b]) => a.localeCompare(b)),
  );
  const out: Json = {
    ...header(
      "claude-code-transcript.json",
      "Claude Code transcript JSONL entry",
      `For one line of a session transcript (.jsonl). Generated from Claude Code ${VERSION} by tools/schemas/code.ts. Anchors: the entry type registry (an object literal whose first keys are user, assistant, system, attachment, mapped to "transcript"); the literal built in the writer's insertMessageChain (key logicalParentUuid) and its two spreads for the common fields of message lines; every object literal with a top-level type:"<entry type>" (non-message types need a sessionId key), with its spreads resolved in the module that declares each function (imports followed); and, for a key a probe saw that no such literal has, the later write: a copy of the line ({...line, key}), a function spread into one, or last a property assignment. Keys are the union over all write sites; a string value that differs between sites is an enum, and one that is a literal at one site and computed at another is x-unverified. Probe print/transcripts.lines.json marks the observed keys. Do not edit by hand.`,
    ),
    type: "object",
    oneOf: Object.keys(ordered).map((t) => ({ $ref: `#/$defs/${t}` })),
    $defs: ordered,
  };
  return { file: "claude-code-transcript.json", schema: out };
};
