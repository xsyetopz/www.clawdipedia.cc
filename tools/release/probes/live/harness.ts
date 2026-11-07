// Shared pieces for live cases: the sandbox, the live env, print and pty runs, stream-json parsing.
// Every live run uses liveEnv (assertLiveEnv inside) with the token from our own env; nothing else carries it.
// Dry mode (fake token, local stub, dead proxy) uses the same code paths and sends nothing out of the machine.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PROMPT } from "../../lib/env.ts";
import { liveEnv } from "../../lib/live/env.ts";
import type { Mitm } from "../../lib/mitm.ts";
import { runChild } from "../../lib/proc.ts";
import { type PtyResult, type PtyStep, runPty } from "../../lib/pty/driver.ts";
import type { CaseResult, Data } from "../../lib/results.ts";
import { type Files, makeSandbox, type Sandbox } from "../../lib/sandbox.ts";
import { assertShimReady } from "../../lib/shim.ts";
import type { Stub } from "../../lib/stub.ts";

export { PROMPT };
export type Obj = Record<string, unknown>;
export const obj = (x: unknown): Obj =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {};
export const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export { loose, tolerant } from "../pty/harness.ts";

/** Safety net for every live sandbox: the Artifact tool can never publish anything. */
const LIVE_SETTINGS = JSON.stringify({ permissions: { deny: ["Artifact"] } });

export type LiveCtx = {
  version: string;
  bin: string;
  runDir: string; // captures/<v>, or a temp dir in dry mode
  token: string;
  dry: boolean;
  /** Dry only: local stub that stands in for the API. */
  stub?: Stub;
  stubBase?: (id: string) => string;
};

export type LiveCase = {
  id: string; // inside the group: "live.<name>" is the CaseResult id
  title: string;
  coldSensitive?: boolean;
  requests: string; // rough model-request count, for the plan
  note?: string; // extra plan line (side effects)
  run: (x: LiveCtx) => Promise<CaseResult[]>;
};

export const liveSandbox = (projFiles: Files = {}): Sandbox =>
  makeSandbox({
    cfgFiles: { "settings.json": LIVE_SETTINGS },
    projFiles,
    trusted: true,
    seedOnboarding: true,
    live: true,
  });

export type EnvOpts = {
  mitm?: Mitm;
  tty?: boolean;
  allowNonessential?: boolean;
  featureGates?: boolean;
  /** Dry: route the program at the local stub (print cases). */
  caseId?: string;
};

export const envFor = (
  x: LiveCtx,
  sb: Sandbox,
  o: EnvOpts = {},
): Record<string, string> =>
  liveEnv({
    home: sb.home,
    configDir: sb.cfg,
    token: x.token,
    ...(o.tty ? { tty: true } : {}),
    ...(o.allowNonessential ? { allowNonessential: true } : {}),
    ...(o.featureGates ? { featureGates: true } : {}),
    ...(o.mitm
      ? { mitm: { proxyUrl: o.mitm.proxyUrl, caFile: o.mitm.caFile } }
      : {}),
    ...(x.dry ? { deadProxy: true } : {}),
    ...(x.dry && o.caseId && x.stubBase
      ? { baseUrl: x.stubBase(o.caseId) }
      : {}),
  });

/** Print-mode run (-p, stream-json) in the sandbox. One attempt. */
export const runPrint = async (
  x: LiveCtx,
  sb: Sandbox,
  args: string[],
  o: EnvOpts & { model?: string } = {},
) => {
  const env = envFor(x, sb, o);
  assertShimReady(env);
  const res = await runChild(
    [
      x.bin,
      ...args,
      "--output-format",
      "stream-json",
      "--verbose",
      ...(o.model ? ["--model", o.model] : []),
    ],
    { cwd: sb.proj, env, timeoutMs: 120_000 },
  );
  return { ...res, events: events(res.stdout) };
};

/** Interactive run through the pty driver. One attempt. */
export const runLivePty = async (
  x: LiveCtx,
  sb: Sandbox,
  o: {
    schedule: PtyStep[];
    secs: number;
    mitm?: Mitm;
    allowNonessential?: boolean;
    featureGates?: boolean;
    args?: string[];
  },
): Promise<PtyResult> => {
  const out = join(sb.root, "pty", "RAW");
  mkdirSync(dirname(out), { recursive: true });
  return runPty({
    cwd: sb.proj,
    env: envFor(x, sb, { tty: true, ...o }),
    bin: x.bin,
    ...(o.args ? { args: o.args } : {}),
    schedule: [
      ...o.schedule,
      { t: o.secs, send: "/exit\r", label: "exit" },
      { t: o.secs + 2.5, send: "\u0003", label: "ctrl-c-1" },
      { t: o.secs + 2.8, send: "\u0003", label: "ctrl-c-2" },
    ],
    secs: o.secs + 5,
    out,
    liveToken: x.token,
  });
};

/** The model the program really used, from the system/init event. */
export const initModel = (evs: Obj[]): string =>
  String(
    evs.find((e) => e["type"] === "system" && e["subtype"] === "init")?.[
      "model"
    ] ?? "",
  );

const UUID =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
/** Live-only scrub: ids and URLs that identify the account (uuids, artifact URLs, org/account path parts). */
export const scrub = (s: string): string =>
  s
    .replace(/https?:\/\/\S*claude\.ai\S*/gi, "<claude.ai-url>")
    .replace(/\/(organizations|accounts?|orgs)\/[^/\s?"']+/gi, "/$1/<id>")
    .replace(UUID, "<uuid>")
    .replace(/\b(org|acct|account|user|artifact)_[A-Za-z0-9]{6,}/gi, "<id>");

const deep = (v: unknown): unknown => {
  if (typeof v === "string") return scrub(v);
  if (Array.isArray(v)) return v.map(deep);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]));
  return v;
};
export const scrubResult = (r: CaseResult): CaseResult => deep(r) as CaseResult;

export const events = (stdout: string): Obj[] =>
  stdout
    .split("\n")
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [obj(JSON.parse(l))];
      } catch {
        return [];
      }
    });

/** Usage of the first model response: its cache_read_input_tokens says if the cache was warm. */
export const firstUsage = (evs: Obj[]): Obj | null => {
  for (const e of evs) {
    const u = obj(obj(e["message"])["usage"]);
    if (e["type"] === "assistant" && Object.keys(u).length) return u;
  }
  const r = evs.find((e) => e["type"] === "result");
  return r ? obj(r["usage"]) : null;
};

/** The context_usage object, wherever the event keeps it (port of p305-live/sum.py). */
export const contextUsage = (evs: Obj[]): Obj | null => {
  let found: Obj | null = null;
  for (const e of evs) {
    const c = e["context_usage"] ?? obj(e["message"])["context_usage"];
    if (c) found = obj(c);
    for (const v of Object.values(e))
      if (v && typeof v === "object" && "context_usage" in v)
        found = obj(obj(v)["context_usage"]);
  }
  return found;
};

export const sumTokens = (xs: unknown[]): number =>
  xs.reduce<number>((n, m) => n + Number(obj(m)["tokens"] ?? 0), 0);

export const baseResult = (
  x: LiveCtx,
  id: string,
  o: Partial<CaseResult> & { data: Record<string, Data> },
): CaseResult => ({
  schema: 1,
  id: `live.${id}`,
  group: "live",
  version: x.version,
  prompt: PROMPT,
  args: [],
  envSet: ["CLAUDE_CODE_OAUTH_TOKEN"], // name only
  exit: null,
  timedOut: false,
  facts: [],
  ...o,
});
