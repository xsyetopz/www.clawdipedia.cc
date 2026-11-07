// release:probe:print - runs the print probe groups against the local stub with the fake key.
// Usage: bun tools/release/cli.ts probe:print [--to V] [--only group,case,sweep.NAME] [--dry]
// --only matches dotted case ids by prefix, with or without the `print.` prefix (e.g. hooks.posttooluse, request.baseline-a).
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { binaryPath, PROMPT } from "../../lib/env.ts";
import { type CaseResult, openRun, writeCase } from "../../lib/results.ts";
import type { Ctx } from "../../util.ts";
import { groupsA } from "./groups/a.ts";
import { groupsB } from "./groups/b.ts";
import { selected, stopStub } from "./run.ts";
import type { PrintCtx } from "./types.ts";

const EMPTY = (c: PrintCtx): CaseResult => ({
  schema: 1,
  id: "",
  group: "print",
  version: c.version,
  prompt: PROMPT,
  args: [],
  envSet: [],
  exit: null,
  timedOut: false,
  data: {},
  facts: [],
});

export const runProbePrint = async (ctx: Ctx): Promise<number> => {
  if (!ctx.to) throw new Error("no --to given and no installed binary found");
  const bin = binaryPath(ctx.to);
  if (!ctx.dry && !existsSync(bin)) throw new Error(`binary missing: ${bin}`);
  const pctx: PrintCtx = {
    version: ctx.to,
    bin,
    runDir: ctx.dry ? "" : openRun(ctx.to),
    ...(ctx.only ? { only: ctx.only } : {}),
    dry: ctx.dry,
  };
  // A full run replaces the whole print/ folder, so a stale file never reads as current.
  if (!ctx.dry && !ctx.only) {
    const dir = join(pctx.runDir, "print");
    if (existsSync(dir))
      for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")))
        rmSync(join(dir, f));
  }
  console.log(`release:probe:print ${ctx.to}${ctx.dry ? " (dry)" : ""}`);
  let total = 0;
  let invalid = 0;
  const seen = new Set<string>();
  const write = (r: CaseResult): void => {
    total++;
    if (ctx.dry) {
      console.log(`  ${r.id}`);
      return;
    }
    if (seen.has(r.id)) {
      invalid++;
      console.log(
        `  INVALID ${r.id} (duplicate case id, second result dropped)`,
      );
      return;
    }
    seen.add(r.id);
    writeCase(pctx.runDir, r);
    const bad = r.data["precondition"] === false;
    if (bad) invalid++;
    const skipped = r.data["skipped"];
    if (typeof skipped === "string") {
      console.log(`  skipped ${r.id} (${skipped})`);
      return;
    }
    console.log(
      `  ${bad ? "INVALID" : "ok     "} ${r.id}${bad ? ` (${String(r.data["error"] ?? r.data["precondition.detail"] ?? "")})` : ""}`,
    );
  };
  try {
    for (const g of [...groupsA, ...groupsB]) {
      if (!selected(pctx, `print.${g.id}`)) continue;
      console.log(`group ${g.id}: ${g.title}`);
      let results: CaseResult[];
      try {
        results = await g.run(pctx);
      } catch (e) {
        console.log(`  group failed: ${(e as Error).message}`);
        // one invalid result per planned case, so no stale file stays behind
        let planned: CaseResult[] = [];
        try {
          planned = await g.run({ ...pctx, dry: true });
        } catch {
          // cannot plan: fall through to a group-level result
        }
        results = (
          planned.length
            ? planned
            : [{ ...EMPTY(pctx), id: `print.${g.id}.group-error` }]
        ).map((r) => ({
          ...r,
          data: {
            precondition: false,
            error: `group failed: ${(e as Error).message}`,
          },
        }));
      }
      for (const r of results) write(r);
    }
  } finally {
    const stray = await stopStub();
    if (stray.length) {
      invalid++;
      console.log(
        `STRAY ${stray.length} request(s) reached the stub without a case id: ${[...new Set(stray.map((r) => r.path))].join(", ")}`,
      );
    }
  }
  console.log(
    `${total} case(s)${ctx.dry ? " planned" : `, ${invalid} invalid probe(s)`}`,
  );
  return 0;
};
