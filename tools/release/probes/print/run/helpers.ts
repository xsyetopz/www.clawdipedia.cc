// B3-specific helpers on top of run.ts (runCase, oneCase, baseResult, msgs, events, dispose).

import { existsSync, readFileSync } from "node:fs";
import type { CaseResult, Data } from "../../../lib/results.ts";
import type { LoggedRequest } from "../../../lib/stub.ts";
import {
  baseResult,
  type Case,
  dispose,
  events,
  msgs,
  obj,
  oneCase,
  type Run,
  runCase,
} from "../run.ts";
import type { PrintCtx } from "../types.ts";

/** A run.ts Case plus `stub` sugar for the canned reply (seq, respHeaders, text, tool, toolInput). */
export type Spec = Case & {
  stub?: Pick<Case, "seq" | "respHeaders" | "text" | "tool" | "toolInput">;
};

/** Run once; the sandbox lives until `fn` returns. */
export const withRun = async <T>(
  ctx: PrintCtx,
  spec: Spec,
  fn: (r: Run) => T | Promise<T>,
): Promise<T> => {
  const { stub, ...c } = spec;
  const r = await runCase(ctx.bin, { ...c, ...(stub ?? {}) });
  try {
    return await fn(r);
  } finally {
    dispose(r);
  }
};

// ---- request and event helpers -------------------------------------------------------------

type Body = {
  model?: string;
  system?: { text?: string }[] | string;
  tools?: { name: string }[];
  messages?: { role?: string; content?: unknown }[];
  [k: string]: unknown;
};
export const bodyOf = (q: LoggedRequest): Body => q.body as Body;
export const toolNames = (q: LoggedRequest): string[] =>
  (bodyOf(q).tools ?? []).map((t) => t.name);
export const sysText = (q: LoggedRequest): string => {
  const s = bodyOf(q).system;
  return Array.isArray(s) ? s.map((x) => x.text ?? "").join("\n") : (s ?? "");
};
export const json = (v: unknown): string => JSON.stringify(v) ?? "";
export const initEvent = (r: Run) =>
  events(r).find((e) => e["subtype"] === "init");
export const evKinds = (r: Run): string =>
  events(r)
    .map((e) => `${String(e["type"])}/${String(e["subtype"] ?? "")}`)
    .join(" ");
/** The distinct tool_result contents the program sent back (JSON text). */
export const toolResultTexts = (r: Run): string[] => {
  const out: string[] = [];
  for (const q of msgs(r))
    for (const m of bodyOf(q).messages ?? [])
      if (Array.isArray(m.content))
        for (const c of m.content)
          if (obj(c)["type"] === "tool_result")
            out.push(json(obj(c)["content"]));
  return [...new Set(out)];
};
export const readCfg = (r: Run, name: string): string => {
  try {
    return readFileSync(`${r.sb.cfg}/${name}`, "utf8");
  } catch {
    return "";
  }
};
/** Replace the sandbox root and its dash-encoded form with a fixed token, so sizes do not depend on the tmp path. */
export const fixed = (r: Run, s: string): string =>
  s
    .split(r.sb.root)
    .join("<SB>")
    .split(r.sb.root.replace(/[^A-Za-z0-9]/g, "-"))
    .join("<SB>");

/** Is the program under test older than `v`? A case may accept a missing feature as a result only there, so a failure on a version that has the feature stays invalid. */
export const olderThan = (ctx: PrintCtx, v: string): boolean =>
  ctx.version.localeCompare(v, undefined, { numeric: true }) < 0;

// ---- case definitions ----------------------------------------------------------------------

export type Out = {
  data: Record<string, Data>;
  samples?: Record<string, string>;
  notes?: string;
  from?: Run; // supplies prompt, args, envSet, exit and the request summary
};
export type CaseDef = {
  name: string; // the case id is print.<group>.<name>
  /** A file the case needs. When it is missing the case does not run: its result has `data.skipped` (the reason) and no `precondition: false`. */
  requires?: { path: string; reason: string };
  run: (ctx: PrintCtx) => Promise<Out>;
};

/** Each def goes through oneCase (selection, dry, probe-invalid on throw); index.ts writes the results. */
export const runCases = async (
  ctx: PrintCtx,
  group: string,
  defs: CaseDef[],
): Promise<CaseResult[]> => {
  const out: CaseResult[] = [];
  for (const d of defs) {
    const id = `print.${group}.${d.name}`;
    out.push(
      ...(await oneCase(ctx, id, async () => {
        if (d.requires && !existsSync(d.requires.path))
          return baseResult(ctx, id, null, {
            data: {
              skipped: `${d.requires.reason} (missing ${d.requires.path})`,
            },
          });
        const o = await d.run(ctx);
        return baseResult(ctx, id, o.from ?? null, {
          data: o.data,
          samples: o.samples,
          ...(o.notes ? { notes: o.notes } : {}),
        });
      })),
    );
  }
  return out;
};
export type { Run };
export { msgs };
