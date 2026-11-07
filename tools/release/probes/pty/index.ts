// release:probe:pty - interactive probes through the pty driver, against the local stub with the fake key.
// Usage: bun tools/release/cli.ts probe:pty [--to V] [--only group,case] [--dry]
// --only matches dotted case ids by prefix, with or without the `pty.` prefix (e.g. hooks.precompact, statusline), or a bare case name (fork). Exit 2 when nothing matches.
// Run it when the machine is idle: the status line cases measure timing. Cases run one at a time.
// Exit is non-zero only when a case failed to run (precondition false); a changed result is not a failure.
import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { binaryPath } from "../../lib/env.ts";
import { type CaseResult, openRun, writeCase } from "../../lib/results.ts";
import type { Ctx } from "../../util.ts";
import { agentsGroup } from "./agents.ts";
import { capturesGroup } from "./captures.ts";
import { cli319Group } from "./cli319.ts";
import {
  type PtyCtx,
  type PtyGroup,
  runPtyCase,
  selected,
  stopStub,
} from "./harness.ts";
import { hooksGroup } from "./hooks.ts";
import { notificationsGroup } from "./notifications.ts";
import { perfettoGroup } from "./perfetto.ts";
import { sizesGroup } from "./sizes.ts";
import { statuslineGroup } from "./statusline.ts";

export const GROUPS: PtyGroup[] = [
  hooksGroup,
  notificationsGroup,
  statuslineGroup,
  sizesGroup,
  agentsGroup,
  capturesGroup,
  perfettoGroup,
  cli319Group,
];

export const runProbePty = async (ctx: Ctx): Promise<number> => {
  if (!ctx.to) throw new Error("no --to given and no installed binary found");
  const bin = binaryPath(ctx.to);
  if (!ctx.dry && !existsSync(bin)) throw new Error(`binary missing: ${bin}`);
  const pctx: PtyCtx = {
    version: ctx.to,
    bin,
    runDir: ctx.dry ? "" : openRun(ctx.to),
    only: ctx.only,
    dry: ctx.dry,
  };
  // A full run replaces the whole pty/ folder, so a stale file never reads as current.
  if (!ctx.dry && !ctx.only) {
    const dir = join(pctx.runDir, "pty");
    if (existsSync(dir)) for (const f of readdirSync(dir)) rmSync(join(dir, f));
  }
  console.log(`release:probe:pty ${ctx.to}${ctx.dry ? " (dry)" : ""}`);
  let total = 0;
  let invalid = 0;
  const seen = new Set<string>();
  try {
    for (const g of GROUPS) {
      const cases = g.cases(pctx);
      if (!cases.some((c) => selected(ctx.only, `pty.${c.id}`))) continue;
      console.log(`group ${g.id}: ${g.title}`);
      for (const c of cases) {
        const results: CaseResult[] = await runPtyCase(pctx, c);
        for (const r of results) {
          total++;
          if (ctx.dry) {
            console.log(`  ${r.id}`);
            continue;
          }
          if (seen.has(r.id)) {
            invalid++;
            console.log(`  INVALID ${r.id} (duplicate case id, dropped)`);
            continue;
          }
          seen.add(r.id);
          writeCase(pctx.runDir, r);
          const bad = r.data["precondition"] === false;
          if (bad) invalid++;
          const flaky = r.data["flaky"] === true ? " FLAKY" : "";
          const why = bad
            ? ` (${String(r.data["error"] ?? r.data["precondition.detail"] ?? "")})`
            : "";
          console.log(`  ${bad ? "INVALID" : "ok     "} ${r.id}${flaky}${why}`);
        }
      }
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
  if (ctx.only && total === 0) {
    console.log(`no case matches --only ${ctx.only.join(",")}`);
    return 2;
  }
  console.log(
    `${total} case(s)${ctx.dry ? " planned" : `, ${invalid} invalid probe(s)`}`,
  );
  return invalid && !ctx.dry ? 1 : 0;
};
