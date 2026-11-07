// Case runner shared by print probes: one program run against the local stub, in a temp sandbox, from a built env.
// Port of p305-print/lib.ts runCase (placeholders, bad-auth check) on top of lib/*.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import { childEnv, PROMPT } from "../../lib/env.ts";
import { allocPort } from "../../lib/ports.ts";
import { runChild } from "../../lib/proc.ts";
import { type CaseResult, type Data, normalise } from "../../lib/results.ts";
import {
  type Files,
  makeSandbox,
  type Sandbox,
  subst,
} from "../../lib/sandbox.ts";
import { assertShimReady } from "../../lib/shim.ts";
import {
  type LoggedRequest,
  readLog,
  type Stub,
  startStub,
} from "../../lib/stub.ts";
import type { PrintCtx } from "./types.ts";

export type Obj = Record<string, unknown>;
export const obj = (x: unknown): Obj =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {};
export const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export type Seq = { name: string; input: unknown }[];
export type Case = {
  prompt?: string; // anything but PROMPT needs promptReason
  promptReason?: string;
  args?: string[]; // after the fixed -p/--output-format/--model part; {HOME} {CFG} {PROJ} {MEMORY_MCP} {BASE} allowed
  env?: Record<string, string>; // variable under test
  cfgFiles?: Files;
  projFiles?: Files;
  homeFiles?: Files;
  git?: boolean;
  tool?: string;
  toolInput?: unknown;
  seq?: Seq;
  text?: string;
  stdin?: string;
  stdinOpenMs?: number; // keep stdin open this long after `stdin` is written
  noPrompt?: boolean; // no -p prompt (stream-json input or control requests)
  argv?: string[]; // replaces the whole argument list after the binary
  timeoutMs?: number;
  respHeaders?: Record<string, string>;
  model?: string; // default claude-opus-5-5
  commit?: boolean; // git init plus one commit in the project dir
  setup?: (sb: Sandbox) => void; // after fixture files, before the run
  auth?: "none"; // no API key in the child env
  allowOverride?: string[]; // fixed env keys that `env` may replace
  fakeCredentials?: string[]; // credential-named env vars set to a sentinel (see lib/env.ts)
  afterExit?: (sb: Sandbox) => Record<string, unknown>; // read state after exit, before leftover children are killed
  cwdSub?: string; // run in this subfolder of the project dir (created before the run)
  safeguard?: "flagged" | "not_flagged"; // stub: server-side auto mode verdict for each tool call
  refuseServerCheck?: boolean; // stub: HTTP 400 for the dangerous-tool-use beta
  orchestrator?: {
    secret: string;
    hints: Record<string, unknown>[];
    assignment?: string;
    refuseRemote?: boolean;
  }; // stub: self-hosted runner API with these spawn hints
  tooLongOn?: number; // stub: the Nth messages request gets the prompt-is-too-long 400
  gapMs?: number; // stub: wait between SSE events
  deltas?: number; // stub: split a text block into this many deltas
};

export type Run = {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
  reqs: LoggedRequest[];
  sb: Sandbox;
  prompt: string;
  promptReason?: string;
  args: string[];
  envSet: string[];
  after: Record<string, unknown>;
};

let stubP: Promise<Stub> | null = null;
const getStub = (): Promise<Stub> => {
  stubP ??= allocPort().then((p) => startStub(p));
  return stubP;
};
/** Stops the stub; returns requests that reached it without a registered case id. */
export const stopStub = async (): Promise<LoggedRequest[]> => {
  const p = stubP;
  stubP = null;
  return p ? (await p).stop() : [];
};

/** Every prompt the argument list or stdin would send: `-p`/`--print` values and stream-json user lines. */
const promptsOf = (argv: string[], stdin: string | undefined): string[] => {
  const out: string[] = [];
  argv.forEach((a, i) => {
    const next = argv[i + 1];
    if ((a === "-p" || a === "--print") && next && !next.startsWith("-"))
      out.push(next);
  });
  for (const l of (stdin ?? "").split("\n")) {
    try {
      const j = obj(JSON.parse(l));
      const c = obj(j["message"])["content"];
      if (j["type"] === "user" && typeof c === "string") out.push(c);
    } catch {
      // not JSON
    }
  }
  return out;
};

const commitFixture = (sb: Sandbox): void => {
  const env = {
    PATH: "/usr/bin:/bin",
    HOME: sb.home,
    GIT_CONFIG_GLOBAL: join(sb.home, ".gitconfig"),
    GIT_AUTHOR_NAME: "t",
    GIT_AUTHOR_EMAIL: "t@example.com",
    GIT_COMMITTER_NAME: "t",
    GIT_COMMITTER_EMAIL: "t@example.com",
  };
  for (const c of [
    ["add", "-A"],
    ["commit", "-q", "-m", "init"],
  ]) {
    const g = Bun.spawnSync(["/usr/bin/git", ...c], { cwd: sb.proj, env });
    if (g.exitCode !== 0) throw new Error(`git ${c[0]} failed in sandbox`);
  }
};

let counter = 0;
export const runCase = async (bin: string, c: Case): Promise<Run> => {
  const prompt = c.noPrompt || c.argv ? "" : (c.prompt ?? PROMPT);
  const sent = promptsOf(c.argv ?? ["-p", prompt, ...(c.args ?? [])], c.stdin);
  if (sent.some((p) => p !== PROMPT) && !c.promptReason)
    throw new Error("a prompt other than PROMPT needs promptReason");
  const sb = makeSandbox({
    ...(c.cfgFiles ? { cfgFiles: c.cfgFiles } : {}),
    ...(c.projFiles ? { projFiles: c.projFiles } : {}),
    ...(c.homeFiles ? { homeFiles: c.homeFiles } : {}),
    ...(c.git || c.commit ? { git: true } : {}),
  });
  const s = await getStub();
  const id = `c${++counter}`;
  const log = join(sb.root, "requests.jsonl");
  const sub = <T>(x: T): T =>
    x === undefined ? x : (JSON.parse(subst(JSON.stringify(x), sb)) as T);
  try {
    if (c.commit) commitFixture(sb);
    c.setup?.(sb);
    let after: Record<string, unknown> = {};
    const baseUrl = s.register(id, {
      log,
      ...(c.text !== undefined ? { text: c.text } : {}),
      ...(c.tool !== undefined ? { tool: c.tool } : {}),
      ...(c.toolInput !== undefined ? { toolInput: sub(c.toolInput) } : {}),
      ...(c.seq ? { seq: sub(c.seq) } : {}),
      ...(c.respHeaders ? { respHeaders: c.respHeaders } : {}),
      ...(c.safeguard ? { safeguard: c.safeguard } : {}),
      ...(c.refuseServerCheck ? { refuseServerCheck: true } : {}),
      ...(c.orchestrator ? { orchestrator: c.orchestrator } : {}),
      ...(c.tooLongOn ? { tooLongOn: c.tooLongOn } : {}),
      ...(c.gapMs ? { gapMs: c.gapMs } : {}),
      ...(c.deltas ? { deltas: c.deltas } : {}),
    });
    const args = (
      c.argv ?? [
        ...(c.noPrompt ? [] : ["-p", prompt]),
        "--output-format",
        "stream-json",
        "--verbose",
        "--model",
        c.model ?? "claude-opus-5-5",
        ...(c.args ?? []),
      ]
    ).map((a) =>
      subst(a, sb)
        .split("{BASE}")
        .join(baseUrl)
        .split("{MEMORY_MCP}")
        .join(`${new URL(baseUrl).origin}/v2/ccr-sessions/${id}/memory/mcp`),
    );
    const extra = Object.fromEntries(
      Object.entries(c.env ?? {}).map(([k, v]) => [k, subst(v, sb)]),
    );
    const childEnvVars = childEnv({
      home: sb.home,
      configDir: sb.cfg,
      baseUrl,
      extra,
      ...(c.auth ? { auth: c.auth } : {}),
      ...(c.allowOverride ? { allowOverride: c.allowOverride } : {}),
      ...(c.fakeCredentials ? { fakeCredentials: c.fakeCredentials } : {}),
    });
    assertShimReady(childEnvVars);
    if (c.cwdSub) mkdirSync(join(sb.proj, c.cwdSub), { recursive: true });
    const res = await runChild([bin, ...args], {
      cwd: c.cwdSub ? join(sb.proj, c.cwdSub) : sb.proj,
      env: childEnvVars,
      ...(c.afterExit
        ? {
            beforeReap: () => {
              after = c.afterExit?.(sb) ?? {};
            },
          }
        : {}),
      ...(c.stdin !== undefined ? { stdin: c.stdin } : {}),
      ...(c.stdinOpenMs !== undefined ? { stdinOpenMs: c.stdinOpenMs } : {}),
      timeoutMs: c.timeoutMs ?? 60_000,
    });
    const reqs = existsSync(log) ? readLog(log) : [];
    s.unregister(id);
    if (reqs.some((r) => r.bad)) throw new Error("bad auth or stray request");
    return {
      stdout: res.stdout,
      stderr: res.stderr,
      code: res.code,
      timedOut: res.timedOut,
      reqs,
      sb,
      prompt,
      ...(c.promptReason ? { promptReason: c.promptReason } : {}),
      args,
      envSet: Object.keys(extra),
      after,
    };
  } catch (e) {
    sb.cleanup();
    throw e;
  }
};
export const dispose = (r: Run): void => r.sb.cleanup();

/** JSON lines of stdout (stream-json events). */
export const events = (r: Run): Obj[] =>
  r.stdout
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return obj(JSON.parse(l));
      } catch {
        return { _raw: l };
      }
    });
/** Requests that carry a messages array (the model calls). */
export const msgs = (r: Run): LoggedRequest[] =>
  r.reqs.filter(
    (x) => x.path.startsWith("/v1/messages") && obj(x.body)["messages"],
  );
export const listFiles = (d: string, base = d): string[] => {
  const out: string[] = [];
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d)) {
    const f = join(d, e);
    if (statSync(f).isDirectory()) out.push(...listFiles(f, base));
    else out.push(f.slice(base.length + 1));
  }
  return out.sort();
};
export const readIf = (p: string): string =>
  existsSync(p) ? readFileSync(p, "utf8") : "";

/** Most tool_result blocks seen in any one request: the tool results the program sent back to the model. */
export const toolResults = (r: Run): number =>
  Math.max(
    0,
    ...msgs(r).map((q) =>
      arr(obj(q.body)["messages"]).reduce<number>(
        (n, m) =>
          n +
          arr(obj(m)["content"]).filter((b) => obj(b)["type"] === "tool_result")
            .length,
        0,
      ),
    ),
  );

export const requestSummary = (r: Run): NonNullable<CaseResult["requests"]> => {
  const m = msgs(r)[0];
  const beta = m?.headers["anthropic-beta"];
  return {
    count: r.reqs.length,
    paths: [...new Set(r.reqs.map((x) => x.path))].sort(),
    ...(beta ? { betas: beta.split(",") } : {}),
    ...(m ? { bodyKeys: Object.keys(obj(m.body)) } : {}),
  };
};

/** Does this case id (full, `print.<group>.<case>`) match the --only list? Prefix match on dotted segments, both ways. */
export const selected = (ctx: PrintCtx, id: string): boolean => {
  if (!ctx.only) return true;
  return ctx.only.some((raw) => {
    const o = raw.startsWith("print.") ? raw : `print.${raw}`;
    return o === id || id.startsWith(`${o}.`) || o.startsWith(`${id}.`);
  });
};

export const baseResult = (
  ctx: PrintCtx,
  id: string,
  run: Run | null,
  o: {
    data: Record<string, Data>;
    samples?: Record<string, string> | undefined;
    notes?: string;
    facts?: string[];
  },
): CaseResult => ({
  schema: 1,
  id,
  group: "print",
  version: ctx.version,
  prompt: run ? run.prompt || "(none)" : PROMPT,
  args: run ? normalise(run.args) : [],
  envSet: run ? run.envSet : [],
  exit: run ? run.code : null,
  timedOut: run ? run.timedOut : false,
  data: normalise(o.data),
  ...(o.samples ? { samples: o.samples } : {}),
  ...(run ? { requests: requestSummary(run) } : {}),
  facts: o.facts ?? [],
  ...(run?.promptReason || o.notes
    ? { notes: [run?.promptReason, o.notes].filter(Boolean).join(" ") }
    : {}),
});

/**
 * Run one case under the selection and dry rules. `build` does the work; a throw becomes a
 * `precondition: false` result so one broken probe never stops the run.
 */
export const oneCase = async (
  ctx: PrintCtx,
  id: string,
  build: () => Promise<CaseResult>,
): Promise<CaseResult[]> => {
  if (!selected(ctx, id)) return [];
  if (ctx.dry) return [baseResult(ctx, id, null, { data: {} })];
  try {
    return [await build()];
  } catch (e) {
    return [
      baseResult(ctx, id, null, {
        data: { precondition: false, error: (e as Error).message },
        notes: "probe invalid: threw before producing data",
      }),
    ];
  }
};
