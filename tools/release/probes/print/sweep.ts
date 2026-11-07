// Env var sweep, ported from p305-print/sweep.ts. Each name from the binary's strings is set to "1" in two
// baseline runs (A plain, B tool+plugin+hooks); the result is which signature keys change, minus baseline noise.
// The name list comes from release:diff's extractor over the cached strings dump, not from a saved file.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { extractEnv } from "../../diff/extract.ts";
import { dumpStrings } from "../../diff/strings.ts";
import { assertSafeEnv, binaryPath, childEnv, PROMPT } from "../../lib/env.ts";
import { type CaseResult, type Data, normalise } from "../../lib/results.ts";
import { dispose, runCase, selected } from "./run.ts";
import {
  baselineA,
  baselineB,
  diffSample,
  diffSig,
  type Sig,
  sig,
  stableBaseline,
} from "./sig.ts";
import type { PrintCtx, PrintGroup } from "./types.ts";

const ID = "print.sweep";
const WORKERS = 8;
const SAMPLE_CAP = 150;

/** Names the sweep cannot set safely: fixed child env keys, and anything childEnv refuses (credentials). */
const unsettable = (name: string, fixed: Set<string>): string | null => {
  if (fixed.has(name)) return "fixed by childEnv";
  try {
    assertSafeEnv({ [name]: "1" });
  } catch {
    return "credential-shaped name";
  }
  return null;
};

// The strings extractor misses names that only the AST finds (helper chains, tables), so the surface list joins it.
export const sweepNames = (version: string): string[] => {
  const surface = JSON.parse(
    readFileSync(
      join(import.meta.dir, "../../../..", "captures", version, "surface.json"),
      "utf8",
    ),
  ) as { kinds: { env: { name: string }[] } };
  return [
    ...new Set([
      ...extractEnv(readFileSync(dumpStrings(version), "latin1")).keys(),
      ...surface.kinds.env.map((i) => i.name),
    ]),
  ];
};

type Out =
  | {
      diff: string[];
      code: number | null;
      vals: Record<string, [string, string]>;
    }
  | { err: string };

/** A partial sweep over `names` replaces their entries in the full sweep `prev`; every other entry stays. */
export const mergeSweep = (
  prev: Pick<CaseResult, "data" | "samples">,
  part: Record<string, Data>,
  samples: Record<string, string>,
  names: string[],
): { data: Record<string, Data>; samples: Record<string, string> } => {
  const own = (k: string) => names.some((n) => k.startsWith(`${n}.`));
  const data = Object.fromEntries(
    Object.entries(prev.data).filter(([k]) => !own(k)),
  ) as Record<string, Data>;
  for (const [k, v] of Object.entries(part)) if (own(k)) data[k] = v;
  const skipped = new Set([
    ...((prev.data["skipped"] as string[] | undefined) ?? []).filter(
      (n) => !names.includes(n),
    ),
    ...((part["skipped"] as string[] | undefined) ?? []),
  ]);
  data["skipped"] = [...skipped].sort();
  const swept = new Set(
    Object.keys(data)
      .filter((k) => /\.[AB]$/.test(k) && k !== "noise.A" && k !== "noise.B")
      .map((k) => k.slice(0, -2)),
  );
  data["names"] = swept.size;
  data["changed"] = [...swept].filter((n) =>
    [`${n}.A`, `${n}.B`].some((k) => (data[k] as string[] | undefined)?.length),
  );
  data["errors"] = Object.keys(data).filter(
    (k) =>
      Array.isArray(data[k]) &&
      (data[k] as unknown[]).some(
        (x) => typeof x === "string" && x.startsWith("error:"),
      ),
  );
  return {
    data,
    samples: {
      ...Object.fromEntries(
        Object.entries(prev.samples ?? {}).filter(([k]) => !own(k)),
      ),
      ...samples,
    },
  };
};

const run = async (ctx: PrintCtx): Promise<CaseResult[]> => {
  if (!selected(ctx, ID)) return [];
  // `--only sweep.NAME` is a partial run: its names replace their entries in the existing print/sweep.json.
  const want = (ctx.only ?? [])
    .map((o) => o.replace(/^print\./, ""))
    .filter((o) => o.startsWith("sweep."))
    .map((o) => o.slice("sweep.".length));
  const base = (
    data: Record<string, Data>,
    extra?: Partial<CaseResult>,
  ): CaseResult => ({
    schema: 1,
    id: ID,
    group: "print",
    version: ctx.version,
    prompt: PROMPT,
    args: ["-p", PROMPT],
    envSet: [],
    exit: null,
    timedOut: false,
    data: normalise(data),
    facts: [],
    ...extra,
  });
  if (ctx.dry) return [base({})];
  try {
    const all = sweepNames(ctx.version);
    const names = want.length ? all.filter((n) => want.includes(n)) : all;
    const probeEnv = childEnv({
      home: "/x",
      configDir: "/x",
      baseUrl: "http://127.0.0.1:1/x",
    });
    const fixed = new Set(Object.keys(probeEnv));
    const skipped: string[] = [];
    const todo: string[] = [];
    for (const n of names) {
      const why = unsettable(n, fixed);
      if (why) skipped.push(n);
      else todo.push(n);
    }
    const bin = binaryPath(ctx.version);
    const bases = {
      A: await stableBaseline(bin, baselineA, false),
      B: await stableBaseline(bin, baselineB, true),
    };
    console.log(
      `  sweep: ${todo.length} names, ${skipped.length} skipped, noise A=${bases.A.noise.length} B=${bases.B.noise.length}`,
    );
    const mk = { A: baselineA, B: baselineB };
    const res = new Map<string, Record<string, Out>>();
    const jobs = todo.flatMap((v) =>
      (["A", "B"] as const).map((k) => [v, k] as const),
    );
    let idx = 0;
    let done = 0;
    const worker = async () => {
      for (;;) {
        const j = jobs[idx++];
        if (!j) return;
        const [v, k] = j;
        let out: Out;
        try {
          const c = mk[k]();
          c.env = { [v]: "1" };
          c.timeoutMs = 40_000;
          const r = await runCase(bin, c);
          const s: Sig = sig(r);
          dispose(r);
          for (const x of Object.keys(s))
            if (x.startsWith("henv."))
              s[x] = (s[x] ?? "")
                .split(",")
                .filter((n) => n !== v)
                .join(",");
          const b = bases[k];
          const diff = diffSig(b.sig, s).filter((x) => !b.noise.includes(x));
          out = {
            diff,
            code: r.code,
            vals: Object.fromEntries(
              diff.map((x) => [x, diffSample(b.sig[x] ?? "", s[x] ?? "")]),
            ),
          };
        } catch (e) {
          out = { err: (e as Error).message.slice(0, 200) };
        }
        const rec = res.get(v) ?? {};
        rec[k] = out;
        res.set(v, rec);
        if (++done % 200 === 0) console.log(`  sweep: ${done}/${jobs.length}`);
      }
    };
    await Promise.all(Array.from({ length: WORKERS }, worker));

    const data: Record<string, Data> = {
      precondition: bases.A.valid && bases.B.valid,
      "precondition.detail": [
        bases.A.why && `A: ${bases.A.why}`,
        bases.B.why && `B: ${bases.B.why}`,
      ]
        .filter(Boolean)
        .join(" | "),
      names: todo.length,
      skipped,
      "noise.A": bases.A.noise,
      "noise.B": bases.B.noise,
    };
    const samples: Record<string, string> = {};
    const changed: string[] = [];
    const errored: string[] = [];
    for (const v of todo) {
      for (const k of ["A", "B"] as const) {
        const o = res.get(v)?.[k];
        if (!o) continue;
        if ("err" in o) {
          data[`${v}.${k}`] = [`error: ${o.err}`];
          errored.push(`${v}.${k}`);
          continue;
        }
        data[`${v}.${k}`] = o.diff;
        if (o.diff.length) {
          changed.push(v);
          for (const [key, [a, b]] of Object.entries(o.vals))
            if (Object.keys(samples).length < SAMPLE_CAP)
              samples[`${v}.${k}.${key}`] = `${a} => ${b}`;
        }
      }
    }
    data["changed"] = [...new Set(changed)];
    data["errors"] = errored;
    const notes =
      "Each name set to 1. Data: NAME.A / NAME.B = signature keys that changed vs baseline (noise removed).";
    if (!want.length) return [base(data, { samples, notes })];
    const file = join(ctx.runDir, "print", "sweep.json");
    if (!existsSync(file))
      throw new Error(
        "no print/sweep.json to merge into; run the full sweep first (--only sweep)",
      );
    const prev = JSON.parse(readFileSync(file, "utf8")) as CaseResult;
    const merged = mergeSweep(prev, data, samples, [...todo, ...skipped]);
    return [base(merged.data, { samples: merged.samples, notes })];
  } catch (e) {
    return [
      base(
        { precondition: false, error: (e as Error).message },
        want.length ? { id: `${ID}.partial` } : {},
      ),
    ];
  }
};

export const sweepGroup: PrintGroup = {
  id: "sweep",
  title: "Environment variable sweep (names from release:diff strings)",
  run,
};
