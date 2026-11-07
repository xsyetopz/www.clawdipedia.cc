// Shared runner for pty probes: one interactive program run per case, in a temp sandbox, against the local stub.
// Ports the p305-pty start.sh/launch.sh/sc.sh flow onto lib/* (env.ts, sandbox.ts, driver.ts, stub.ts).
// Nothing here uses OAuth, the macOS keychain, /tmp fixed paths, or a shell-launched child.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { binaryPath, childEnv, PROMPT } from "../../lib/env.ts";
import { runPty } from "../../lib/pty/driver.ts";
import {
  type CaseResult,
  type Data,
  normalise,
  openRun,
  writeCase,
} from "../../lib/results.ts";
import { type Files, makeSandbox, type Sandbox } from "../../lib/sandbox.ts";
import { readLog } from "../../lib/stub.ts";
import type { Ctx } from "../../util.ts";
import { baseResult, getStub, subst } from "./harness/base.ts";
import { isSystemMsg, selected, sentAt } from "./harness/read.ts";
import { HOOK_SH, SL_SH } from "./harness/steps.ts";
import {
  type Obj,
  obj,
  type PtyCase,
  type PtyCtx,
  type PtyRun,
} from "./harness/types.ts";

export { stopStub } from "./harness/base.ts";
export * from "./harness/read.ts";
export * from "./harness/steps.ts";
export * from "./harness/types.ts";
export { PROMPT };

let counter = 0;

const parseLog = (file: string): { t: number; json: Obj; line: string }[] =>
  existsSync(file)
    ? readFileSync(file, "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const i = line.indexOf(" ");
          let json: Obj = {};
          try {
            json = obj(JSON.parse(line.slice(i + 1)));
          } catch {
            // keep an empty object
          }
          return { t: Number(line.slice(0, i)), json, line };
        })
    : [];

const runOnce = async (ctx: PtyCtx, c: PtyCase): Promise<CaseResult[]> => {
  const id = `pty.${c.id}`;
  if (!selected(ctx.only, id)) return [];
  if (ctx.dry) return [baseResult(ctx, c, { data: {} })];
  const prompt = c.prompt ?? PROMPT;
  if (prompt !== PROMPT && !c.promptReason)
    return [
      baseResult(ctx, c, {
        data: { precondition: false, error: "prompt needs promptReason" },
      }),
    ];
  // every typed line that is not a /command or a key must be the standard prompt
  const stray = c.schedule.find(
    (st) =>
      st.send?.endsWith("\r") &&
      st.send !== "\r" &&
      !st.send.startsWith("/") &&
      !st.send.startsWith("\u001b") &&
      st.send !== `${PROMPT}\r`,
  );
  if (stray && !c.promptReason)
    return [
      baseResult(ctx, c, {
        data: {
          precondition: false,
          error: `schedule sends a non-standard prompt (${JSON.stringify(stray.send)}) without promptReason`,
        },
      }),
    ];
  let sb: Sandbox | undefined;
  try {
    const files: Files = { ...(c.cfgFiles ?? {}) };
    if (c.settings) files["settings.json"] = JSON.stringify(c.settings);
    sb = makeSandbox({
      cfgFiles: files,
      ...(c.projFiles ? { projFiles: c.projFiles } : {}),
      homeFiles: { "hook.sh": HOOK_SH, "sl.sh": SL_SH, ...(c.homeFiles ?? {}) },
      ...(c.git ? { git: true } : {}),
      trusted: true,
      seedOnboarding: true,
    });
    for (const [ev, v] of Object.entries(c.ctl ?? {})) {
      const d = join(sb.home, "hooklog", "ctl");
      mkdirSync(d, { recursive: true });
      if (v.out !== undefined) writeFileSync(join(d, ev), v.out);
      if (v.exit !== undefined)
        writeFileSync(join(d, `${ev}.exit`), String(v.exit));
    }
    c.setup?.(sb);
    const stub = await getStub();
    const log = join(sb.root, "requests.jsonl");
    const caseKey = `p${++counter}`;
    const sub = <T>(x: T): T =>
      x === undefined
        ? x
        : (JSON.parse(subst(JSON.stringify(x), sb as Sandbox)) as T);
    const base = stub.register(caseKey, {
      log,
      ...c.stub,
      ...(c.stub?.toolInput !== undefined
        ? { toolInput: sub(c.stub.toolInput) }
        : {}),
      ...(c.stub?.seq ? { seq: sub(c.stub.seq) } : {}),
    });
    const extra = Object.fromEntries(
      Object.entries(c.env ?? {}).map(([k, v]) => [k, subst(v, sb as Sandbox)]),
    );
    const env = childEnv({
      home: sb.home,
      configDir: sb.cfg,
      baseUrl: base,
      extra,
      tty: true,
      ...(c.allowOverride ? { allowOverride: c.allowOverride } : {}),
      ...(c.auth ? { auth: c.auth } : {}),
    });
    const args = [
      "--permission-mode",
      c.mode ?? "default",
      "--model",
      c.model ?? "claude-opus-5-5",
      ...(c.args ?? []).map((a) => subst(a, sb as Sandbox)),
    ];
    const out = join(sb.root, "pty", "RAW");
    mkdirSync(dirname(out), { recursive: true });
    const pty = await runPty({
      cwd: sb.proj,
      env,
      bin: ctx.bin,
      args,
      // end with /exit so the program writes its exit-time files; Ctrl-C twice if it is still up
      schedule: sub([
        ...c.schedule,
        { t: c.secs, send: "/exit\r", label: "exit" },
        { t: c.secs + 2.5, send: "\u0003", label: "ctrl-c-1" },
        { t: c.secs + 2.8, send: "\u0003", label: "ctrl-c-2" },
      ]),
      secs: c.secs + 5,
      ...(c.rows ? { rows: c.rows } : {}),
      ...(c.cols ? { cols: c.cols } : {}),
      out,
    });
    stub.unregister(caseKey);
    const reqs = existsSync(log) ? readLog(log) : [];
    const bad = reqs.some((r) => r.bad);
    const home = sb.home;
    const run: PtyRun = {
      pty,
      screen: pty.screen,
      reqs,
      sb,
      hook: (e) => parseLog(join(home, "hooklog", `${e}.log`)),
      file: (rel) => {
        const p = join(home, rel);
        return existsSync(p) ? readFileSync(p, "utf8") : "";
      },
      messages: reqs.filter(isSystemMsg),
    };
    // keep the raw bytes, byte offsets and rendered screen beside the JSON (never diffed)
    const dest = join(ctx.runDir, "pty");
    mkdirSync(dest, { recursive: true });
    const stem = join(dest, c.id);
    for (const [from, to] of [
      [pty.rawPath, `${stem}.raw`],
      [`${pty.rawPath}.idx`, `${stem}.idx`],
      [`${pty.rawPath}.sent`, `${stem}.sent`],
      [`${pty.rawPath}.screen.txt`, `${stem}.screen.txt`],
    ] as const)
      if (existsSync(from)) copyFileSync(from, to);
    const beta = run.messages[0]?.headers["anthropic-beta"];
    for (const [name, text] of Object.entries(c.artifacts?.(run) ?? {}))
      writeFileSync(`${stem}.${name}`, text);
    const samples = c.samples?.(run);
    const stepTimeouts = pty.sent
      .filter((s) => s.label.endsWith(":timeout"))
      .map((s) => s.label.slice(0, -":timeout".length));
    // Informational only: the step clock starts at READY, so a slow start no longer shifts the steps.
    const readyAt = sentAt(run, "ready");
    const firstRead = pty.idx[0]?.t;
    const startLagS =
      readyAt !== null && firstRead !== undefined
        ? Math.round((readyAt - firstRead) * 10) / 10
        : null;
    const data = {
      ...c.data(run),
      ...(startLagS !== null ? { startLagS } : {}),
      stepTimeouts,
      ...(stepTimeouts.length
        ? {
            precondition: false,
            "precondition.detail": `wait_for timed out: ${stepTimeouts.join(", ")}`,
          }
        : {}),
    };
    return [
      baseResult(ctx, c, {
        prompt,
        args: normalise(args),
        envSet: Object.keys(extra),
        exit: null, // the exit code goes to samples.exitCode (it varies with timing)
        timedOut: false,
        data: normalise(bad ? { ...data, badAuth: true } : data),
        samples: normalise({
          ...(samples ?? {}),
          exitCode: String(pty.exit),
          screenTail: pty.screen.split("\n").slice(-40).join("\n"),
        }),
        requests: {
          count: reqs.length,
          paths: [...new Set(reqs.map((r) => r.path))].sort(),
          ...(beta ? { betas: beta.split(",") } : {}),
        },
      }),
    ];
  } catch (e) {
    return [
      baseResult(ctx, c, {
        data: { precondition: false, error: (e as Error).message },
        notes: "probe invalid: threw before producing data",
      }),
    ];
  } finally {
    sb?.cleanup();
  }
};

/** Run one case. Never throws: a failure to run becomes `precondition: false`. Timing cases get one rerun when out of tolerance; an invalid run gets one retry; a case launches the program at most twice. */
export const runPtyCase = async (
  ctx: PtyCtx,
  c: PtyCase,
): Promise<CaseResult[]> => {
  const one = await runTimed(ctx, c);
  const f = one[0];
  if (!f || ctx.dry || f.data["precondition"] !== false) return one;
  // An invalid run (a step timed out, or the case threw) is often a loaded machine: run it once more.
  // runOnce, not runTimed: an invalid first run never reaches the timing rerun, so one launch here keeps
  // the total at 2 launches per case (runTimed here could make it 3).
  const again = await runOnce(ctx, c);
  const s = again[0];
  if (!s) return one;
  s.data["retried"] = true;
  s.attempts = [
    ...(f.attempts ?? []),
    { data: f.data, ...(f.samples ? { samples: f.samples } : {}) },
  ];
  return [s];
};

const runTimed = async (ctx: PtyCtx, c: PtyCase): Promise<CaseResult[]> => {
  const first = await runOnce(ctx, c);
  const f = first[0];
  if (!f || ctx.dry || !c.retryIf || f.data["precondition"] === false)
    return first;
  if (!c.retryIf(f.data)) return first;
  const second = await runOnce(ctx, c);
  const s = second[0];
  if (!s || s.data["precondition"] === false) return first;
  const agree = !c.retryIf(s.data);
  s.data["rerun"] = true;
  s.data["flaky"] = agree; // the first run was out of tolerance; true when the rerun disagrees
  s.data["firstOutOfTolerance"] = true;
  s.attempts = [{ data: f.data, ...(f.samples ? { samples: f.samples } : {}) }];
  return [s];
};

export const runDirFor = (ctx: Ctx): string => openRun(ctx.to);
export type { Data };
export { binaryPath, writeCase };
