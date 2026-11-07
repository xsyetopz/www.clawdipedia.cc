// Print probes for the second half of the new 2.1.319 env names (task env319b).
// Each variable has an "unset" case and a "set" case, run with the same setup.
import { chmodSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:net";
import { BASE } from "./misc/shared.ts";
import {
  type CaseDef,
  initEvent,
  msgs,
  readCfg,
  runCases,
  withRun,
} from "./run/helpers.ts";
import { diffSig, type Sig, sig } from "./sig.ts";
import type { PrintGroup } from "./types.ts";

// Same override as err319.ts: the memory sync needs the traffic switches off. The base URL is still the local stub.
const GB_ON = {
  DISABLE_TELEMETRY: "",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
};
const DBG = ["--debug-file", "{CFG}/d.log"];

const grep = (s: string, re: RegExp, n = 6): string =>
  s
    .split("\n")
    .filter((l) => re.test(l))
    .slice(0, n)
    .map((l) => l.slice(0, 220))
    .join("\n");

const POLICY = JSON.stringify({
  terminal_tools: ["mcp__probe__reply"],
  ask_text: "Call the reply tool.",
  max_asks_after_person: 1,
  max_asks_after_server_event: 1,
});

const replyGate = (name: string, value: string | undefined): CaseDef => ({
  name: `reply-gate.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [...BASE, ...DBG],
        env:
          value === undefined ? {} : { CLAUDE_CODE_REPLY_GATE_POLICY: value },
      },
      (r) => {
        const log = readCfg(r, "d.log");
        const caps = initEvent(r)?.["capabilities"];
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 1,
            capabilities: JSON.stringify(caps ?? null),
            accepted: /CLAUDE_CODE_REPLY_GATE_POLICY accepted/.test(log),
            ignored: /ignoring CLAUDE_CODE_REPLY_GATE_POLICY/.test(log),
          },
          samples: { debug: grep(log, /REPLY_GATE_POLICY/) },
        };
      },
    ),
});

/** A listener that takes a connection and never answers, so a proxy tunnel can never open. */
const hung = async (): Promise<{ port: number; close: () => void }> => {
  const socks = new Set<import("node:net").Socket>();
  const srv: Server = createServer((s) => {
    socks.add(s);
    s.on("error", () => {});
  });
  await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
  const port = (srv.address() as { port: number }).port;
  return {
    port,
    close: () => {
      for (const s of socks) s.destroy();
      srv.close();
    },
  };
};

const otel = (name: string, env: Record<string, string>): CaseDef => ({
  name: `otel-timeout.${name}`,
  run: async (ctx) => {
    const h = await hung();
    const t0 = Date.now();
    try {
      return await withRun(
        ctx,
        {
          args: [...BASE, ...DBG],
          timeoutMs: 90000,
          // The sandbox fixes HTTPS_PROXY, so the hung proxy comes in by settings env.
          cfgFiles: {
            "settings.json": JSON.stringify({
              env: { HTTPS_PROXY: `http://127.0.0.1:${h.port}` },
            }),
          },
          env: {
            CLAUDE_CODE_ENABLE_TELEMETRY: "1",
            OTEL_LOGS_EXPORTER: "otlp",
            OTEL_METRICS_EXPORTER: "otlp",
            OTEL_TRACES_EXPORTER: "otlp",
            CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
            OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
            OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.invalid:4318",
            ...env,
          },
        },
        (r) => {
          const log = readCfg(r, "d.log");
          return {
            from: r,
            data: {
              precondition: msgs(r).length >= 1,
              wallMs: Date.now() - t0,
              timedOutLine: /in time, so this export was not sent/.test(log),
              logsFailed: /First logs export: FAILED \(Could not connect/.test(
                log,
              ),
              metricsFailed:
                /First metrics export: FAILED \(Could not connect/.test(log),
              tracesFailed:
                /trace[^\n]*in time, so this export was not sent/i.test(log),
              exit: r.code,
            },
            samples: {
              debug: grep(log, /FAILED|trace.*(fail|time)|flush timed/i, 8),
            },
          };
        },
      );
    } finally {
      h.close();
    }
  },
});

const delta = (name: string, env: Record<string, string>): CaseDef => ({
  name: `plain-delta.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [...BASE, "--include-partial-messages"],
        text: "OK ".repeat(40),
        env,
      },
      (r) => ({
        from: r,
        data: {
          precondition: msgs(r).length >= 1,
          streamEvents: r.stdout
            .split("\n")
            .filter((l) => l.includes('"stream_event"')).length,
          streamBytes: r.stdout.length,
        },
      }),
    ),
});

const USER = JSON.stringify({
  type: "user",
  message: { role: "user", content: "Reply with 'OK'." },
});
const subs = (v: boolean | null) =>
  JSON.stringify({
    type: "control_request",
    request_id: "r1",
    request: { subtype: "set_has_subscribers", has_subscribers: v },
  });

/** Stream-json input; the watcher answer goes first. The hold needs MAX_LINE_BYTES, or the program ignores it. */
const hold = (
  name: string,
  env: Record<string, string>,
  watched: boolean | null | undefined,
  spaced = false,
): CaseDef => ({
  name: `stream-hold.${name}`,
  run: async (ctx) => {
    const t0 = Date.now();
    return withRun(
      ctx,
      {
        // A spaced reply: 8 text deltas, 400 ms apart, so a hold has something to join.
        ...(spaced ? { gapMs: 400, deltas: 8, text: "abcdefghijklmnop" } : {}),
        noPrompt: true,
        args: [
          ...BASE,
          ...DBG,
          "--input-format",
          "stream-json",
          "--include-partial-messages",
        ],
        stdin: `${watched === undefined ? "" : `${subs(watched)}\n`}${USER}\n`,
        env: { CLAUDE_CODE_STREAM_EVENT_MAX_LINE_BYTES: "100000", ...env },
      },
      (r) => {
        const log = readCfg(r, "d.log");
        const answered = r.stdout
          .split("\n")
          .some(
            (l) =>
              l.includes('"control_response"') &&
              l.includes('"r1"') &&
              l.includes('"success"'),
          );
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 1,
            controlAnswered: watched === undefined ? null : answered,
            holdLog: /STREAM_EVENT_HOLD_MS/.test(log),
            noSubscriberCounter: /print_stream_event_no_subscriber_hold/.test(
              log,
            ),
            holdCounter: /print_stream_event_hold/.test(log),
            deltaLines: r.stdout
              .split("\n")
              .filter((l) => l.includes('"content_block_delta"')).length,
            wallMs: Date.now() - t0,
          },
          samples: { debug: grep(log, /stream_event|STREAM_EVENT/i) },
        };
      },
    );
  },
});

/** Two user turns; the stub answers the second model request with "prompt is too long", so the program runs a reactive compact. */
const trinket = (name: string, value: string | undefined): CaseDef => ({
  name: `curried-trinket.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        noPrompt: true,
        tooLongOn: 2,
        text: "<summary>S</summary>OK",
        args: [...BASE, ...DBG, "--input-format", "stream-json"],
        stdin: `${USER}\n${USER}\n`,
        env: value === undefined ? {} : { CLAUDE_CODE_CURRIED_TRINKET: value },
      },
      (r) => {
        const log = readCfg(r, "d.log");
        const bodies = msgs(r).map((q) => JSON.stringify(q.body));
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 2,
            modelRequests: msgs(r).length,
            reactiveCompactLogged: /Reactive compact/i.test(log),
            requestsWithMark: bodies.filter((b) => b.includes("TRINKET_MARK"))
              .length,
            markInRequest: bodies
              .map((b) => b.includes("TRINKET_MARK"))
              .join(","),
            compactRequests: bodies.filter((b) => b.includes("<summary>"))
              .length,
          },
          samples: { debug: grep(log, /compact/i, 8) },
        };
      },
    ),
});

/** CLAUDE_MEMORY_STORES with a session token file, so the team memory sync can start against the stub. */
const memSync = (name: string, env: Record<string, string>): CaseDef => ({
  name: `memory-push.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [...BASE, ...DBG],
        homeFiles: { tok: "probe-fake-credential" },
        allowOverride: Object.keys(GB_ON),
        env: {
          ...GB_ON,
          _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1",
          CLAUDE_SESSION_INGRESS_TOKEN_FILE: "{HOME}/tok",
          CLAUDE_MEMORY_STORES: JSON.stringify([
            { path: "{HOME}/st", mode: "rw" },
          ]),
          ...env,
        },
      },
      (r) => {
        const log = readCfg(r, "d.log");
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 1,
            paths: [...new Set(r.reqs.map((q) => q.path.split("?")[0]))].join(
              " ",
            ),
          },
          samples: { debug: grep(log, /memory|policy/i, 30) },
        };
      },
    ),
});

/** The API auth warm (`GET /v1/me`): first-party host plus a remote cowork entrypoint gives it a 120 s lifetime. */
const authWarm = (name: string, env: Record<string, string>): CaseDef => ({
  name: `auth-warm.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [...BASE, ...DBG],
        allowOverride: Object.keys(GB_ON),
        env: { ...GB_ON, ...env },
      },
      (r) => ({
        from: r,
        data: {
          precondition: msgs(r).length >= 1,
          paths: [...new Set(r.reqs.map((q) => q.path.split("?")[0]))].join(
            " ",
          ),
        },
        samples: { debug: grep(readCfg(r, "d.log"), /apiAuthWarm/, 8) },
      }),
    ),
});

/** An OTLP exporter with a protocol the program does not know: the message names the variables it read. */
const otlpProtocol = (
  name: string,
  signal: "LOGS" | "METRICS" | "TRACES",
  env: Record<string, string>,
): CaseDef => ({
  name: `otlp-protocol.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [...BASE, ...DBG],
        env: {
          CLAUDE_CODE_ENABLE_TELEMETRY: "1",
          CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
          OTEL_LOGS_EXPORTER: "none",
          OTEL_METRICS_EXPORTER: "none",
          OTEL_TRACES_EXPORTER: "none",
          [`OTEL_${signal}_EXPORTER`]: "otlp",
          ...env,
        },
      },
      (r) => ({
        from: r,
        data: { precondition: r.code !== null, exit: r.code },
        samples: {
          debug: grep(readCfg(r, "d.log"), /Unknown protocol/, 4),
          stderr: grep(r.stderr, /Unknown protocol/, 4),
        },
      }),
    ),
});

/** `claude gateway` with a config file that does not exist: the error line shows the log format. */
const gateway = (
  name: string,
  argv: string[],
  env: Record<string, string>,
): CaseDef => ({
  name: `gateway.${name}`,
  run: (ctx) =>
    withRun(ctx, { noPrompt: true, argv, env }, (r) => ({
      from: r,
      data: {
        precondition: r.stderr.length + r.stdout.length > 0,
        exit: r.code,
        jsonLine: r.stderr.split("\n").some((l) => /^\{"severity":/.test(l)),
        plainLine: /^claude gateway: /m.test(r.stderr),
      },
      samples: {
        stderr: r.stderr.slice(0, 600),
        stdout: r.stdout.slice(0, 600),
      },
    })),
});

/**
 * Two plain runs with the same host variables give the noise; a third run adds the name under test.
 * The data lists the signature keys that changed beyond the noise (sig.ts: headers, body parts, init event).
 */
const inert = (
  name: string,
  env: Record<string, string>,
  host: Record<string, string> = {},
): CaseDef => ({
  name: `inert.${name}`,
  run: async (ctx) => {
    const once = async (e: Record<string, string>): Promise<Sig> => {
      let s: Sig = {};
      await withRun(ctx, { args: [...BASE, ...DBG], env: e }, (r) => {
        s = sig(r);
        return { from: r, data: {} };
      });
      return s;
    };
    const a = await once(host);
    const b = await once(host);
    const noise = new Set(diffSig(a, b));
    let changed: string[] = [];
    let log = "";
    return withRun(
      ctx,
      { args: [...BASE, ...DBG], env: { ...host, ...env } },
      (r) => {
        changed = diffSig(a, sig(r)).filter((k) => !noise.has(k));
        log = readCfg(r, "d.log");
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 1 && r.code === 0,
            changedKeys: changed.length ? changed.join(",") : "none",
            noiseKeys: noise.size,
            exit: r.code,
          },
          samples: {
            debug: grep(log, new RegExp(Object.keys(env).join("|")), 4),
          },
        };
      },
    );
  },
});

/** CLAUDE_CODE_PERSONAL_HOOKS_OFF: the note that tells Claude and the user that their own hooks do not run. */
const hooksOff = (
  name: string,
  value: string | undefined,
  restricted: boolean,
): CaseDef => ({
  name: `personal-hooks-off.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [...BASE],
        cfgFiles: {
          "settings.json": JSON.stringify({
            hooks: {
              UserPromptSubmit: [
                {
                  hooks: [
                    {
                      type: "command",
                      command: "echo hook-ran >> {CFG}/hook.log",
                    },
                  ],
                },
              ],
            },
          }),
        },
        env: {
          ...(restricted ? { CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG: "1" } : {}),
          ...(value === undefined
            ? {}
            : { CLAUDE_CODE_PERSONAL_HOOKS_OFF: value }),
        },
      },
      (r) => {
        const body = JSON.stringify(msgs(r).map((m) => m.body));
        const note =
          /[^"]{0,60}own Claude Code hooks[^"]{0,260}/.exec(body)?.[0] ?? null;
        const evLines = r.stdout
          .split("\n")
          .filter((l) => /own Claude Code hooks/.test(l));
        return {
          from: r,
          data: {
            precondition: msgs(r).length >= 1,
            hookRan: readCfg(r, "hook.log").includes("hook-ran"),
            noteInRequest: note !== null,
            noteInOutput: evLines.length,
          },
          samples: {
            request: note ?? "",
            output: (evLines[0] ?? "").slice(0, 500),
          },
        };
      },
    ),
});

/** Commands that need a server, run against a closed local port. Each name is read only after the server answers. */
const offline = (
  name: string,
  argv: string[],
  env: Record<string, string>,
): CaseDef => ({
  name: `offline.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        noPrompt: true,
        argv,
        env,
        timeoutMs: 20000,
        homeFiles: { sec: "fake-secret" },
      },
      (r) => ({
        from: r,
        data: {
          precondition: r.stderr.length + r.stdout.length > 0,
          exit: r.code,
          recordFile: (() => {
            try {
              return readFileSync(`${r.sb.home}/ur-record`, "utf8").length > 0;
            } catch {
              return false;
            }
          })(),
        },
        samples: {
          stderr: r.stderr.slice(0, 500),
          stdout: r.stdout.slice(0, 300),
        },
      }),
    ),
});

const b64u = (o: unknown): string =>
  Buffer.from(JSON.stringify(o)).toString("base64url");
// Orchestrator mode: the stub serves one spawn hint; the spawn-runner hook writes what it sees to {HOME}/hook-env.
const secret = `${b64u({ alg: "none" })}.${b64u({ "ccr:pool_id": "ccpool_probe" })}.sig`;
const orchestrator = (
  name: string,
  hint: Record<string, unknown>,
  env: Record<string, string>,
  hookTail = "",
): CaseDef => ({
  name: `orchestrator.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        noPrompt: true,
        argv: [
          "self-hosted-runner",
          "orchestrator",
          "--api-url",
          "{BASE}",
          "--environment-secret-file",
          "{HOME}/sec",
          "--hooks-dir",
          "{HOME}/hooks",
          "--health-port",
          "0",
          "--log-level",
          "debug",
        ],
        env,
        timeoutMs: 8000,
        homeFiles: {
          sec: `sk-ant-oat-${secret}`,
          "hooks/spawn-runner": `#!/bin/sh\nprintf "%s" "\${CLAUDE_RUNNER_SPAWN_REASON-UNSET}" > "$HOME/hook-env"\n${hookTail}`,
        },
        setup: (sb) => chmodSync(`${sb.home}/hooks/spawn-runner`, 0o755),
        orchestrator: {
          secret: `sk-ant-oat-${secret}`,
          hints: [
            {
              session_uuid: "11111111-1111-4111-8111-111111111111",
              attempt: 1,
              jti: "jti-probe",
              work_order_jwt: `${b64u({ alg: "none" })}.${b64u({ jti: "jti-probe" })}.sig`,
              sources: [],
              ...hint,
            },
          ],
        },
        afterExit: (sb) => {
          try {
            return { hookSaw: readFileSync(`${sb.home}/hook-env`, "utf8") };
          } catch {
            return { hookSaw: null };
          }
        },
      },
      (r) => ({
        from: r,
        data: {
          precondition: r.stdout.includes("[runner:orchestrator] starting"),
          hookSaw: String(r.after["hookSaw"] ?? "null"),
          paths: [...new Set(r.reqs.map((q) => q.path))].join(" "),
          okLine: grep(r.stdout, /ok session=/, 2),
        },
        samples: {
          stdout: r.stdout.slice(0, 900),
          stderr: grep(r.stderr, /spawn_reason|spawn-hint/, 3),
        },
      }),
    ),
});

// Runner mode: the stub assigns one session; the case records which routes the runner calls and what it logs.
const runnerSession = (
  name: string,
  env: Record<string, string>,
  refuse = false,
  childBody = 'trap "exit 0" TERM\nwhile :; do sleep 1; done',
  runnerTokenTtlS?: number,
  extraArgv: () => string[] = () => [],
): CaseDef => ({
  name: `runner.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        noPrompt: true,
        argv: [
          "self-hosted-runner",
          "--api-url",
          "{BASE}",
          "--environment-secret-file",
          "{HOME}/sec",
          "--base-dir",
          "{HOME}/base",
          "--log-level",
          "debug",
          "--exec-path",
          "{HOME}/fakeclaude",
          ...extraArgv(),
        ],
        env,
        timeoutMs: refuse ? 170_000 : 12000,
        homeFiles: {
          sec: `sk-ant-oat-${secret}`,
          // stands in for the claude child: records its environment, then waits
          fakeclaude: `#!/bin/sh\nenv | grep "^CLAUDE_RUNNER_" | sort > "$HOME/child-env"\n${childBody}\n`,
        },
        setup: (sb) => chmodSync(`${sb.home}/fakeclaude`, 0o755),
        afterExit: (sb) => {
          try {
            return { childEnv: readFileSync(`${sb.home}/child-env`, "utf8") };
          } catch {
            return { childEnv: null };
          }
        },
        orchestrator: {
          secret: `sk-ant-oat-${secret}`,
          hints: [],
          assignment: "11111111-1111-4111-8111-111111111111",
          refuseRemote: refuse,
          ...(runnerTokenTtlS !== undefined && { runnerTokenTtlS }),
        },
      },
      (r) => ({
        from: r,
        data: {
          precondition: r.stdout.length + r.stderr.length > 0,
          paths: [...new Set(r.reqs.map((q) => q.path))].join(" "),
          childEnv: String(r.after["childEnv"] ?? "null"),
          remoteFetches: r.reqs.filter((q) => q.path.endsWith("/remote"))
            .length,
          warningEvents: r.reqs.filter((q) =>
            JSON.stringify(q.body).includes("model_access_renewal_refused"),
          ).length,
        },
        samples: {
          stdout: r.stdout.slice(0, 1500),
          stderr: r.stderr.slice(-1200),
        },
      }),
    ),
});

export const env319b: PrintGroup = {
  id: "env319b",
  title: "New 2.1.319 env names, second half",
  run: (ctx) =>
    runCases(ctx, "env319b", [
      hold("hold-only", { CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1" }, undefined),
      hold("hold-false", { CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1" }, false),
      hold(
        "nosub-false",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "2000",
        },
        false,
      ),
      hold(
        "nosub-true",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "2000",
        },
        true,
      ),
      hold(
        "nosub-null",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "2000",
        },
        null,
      ),
      hold(
        "nosub-untold",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "2000",
        },
        undefined,
      ),
      hold(
        "spaced-off",
        { CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100" },
        undefined,
        true,
      ),
      hold(
        "spaced-false-0",
        { CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100" },
        false,
        true,
      ),
      hold(
        "spaced-false-3000",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "3000",
        },
        false,
        true,
      ),
      hold(
        "spaced-true-3000",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "3000",
        },
        true,
        true,
      ),
      hold(
        "spaced-untold-3000",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "3000",
        },
        undefined,
        true,
      ),
      hold(
        "spaced-null-3000",
        {
          CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100",
          CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "3000",
        },
        null,
        true,
      ),
      memSync("probe", {}),
      authWarm("on", {
        _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1",
        CLAUDE_CODE_REMOTE: "1",
        CLAUDE_CODE_ENTRYPOINT: "remote_cowork",
      }),
      otlpProtocol("logs", "LOGS", {
        OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "bogus",
      }),
      otlpProtocol("metrics", "METRICS", {
        OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: "bogus",
      }),
      otlpProtocol("traces", "TRACES", {
        OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "bogus",
      }),
      otlpProtocol("logs-general", "LOGS", {
        OTEL_EXPORTER_OTLP_PROTOCOL: "bogus",
      }),
      authWarm("no-first-party", {
        CLAUDE_CODE_REMOTE: "1",
        CLAUDE_CODE_ENTRYPOINT: "remote_cowork",
      }),
      authWarm("no-remote", { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" }),
      trinket("unset", undefined),
      trinket(
        "set",
        "<summary>TRINKET_MARK</summary> Write the summary of this chat.",
      ),
      trinket("no-summary-tag", "TRINKET_MARK plain text"),
      inert("tunnel-binary-frames", {
        CLAUDE_CODE_MCP_SERVE_TUNNEL_BINARY_FRAMES: "1",
      }),
      inert("native-app-bundle", { CLAUDE_CODE_NATIVE_APP_BUNDLE: "1" }),
      inert("normalize-prefix-cache", {
        CLAUDE_CODE_NORMALIZE_PREFIX_CACHE: "1",
      }),
      inert("normalize-prefix-cache-verify", {
        CLAUDE_CODE_NORMALIZE_PREFIX_CACHE: "1",
        CLAUDE_CODE_NORMALIZE_PREFIX_CACHE_VERIFY: "1",
      }),
      inert("personal-hooks-off-plain", {
        CLAUDE_CODE_PERSONAL_HOOKS_OFF: "launch",
      }),
      inert(
        "personal-hooks-off-restricted",
        { CLAUDE_CODE_PERSONAL_HOOKS_OFF: "launch" },
        { CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG: "1" },
      ),
      inert(
        "personal-hooks-off-host",
        { CLAUDE_CODE_PERSONAL_HOOKS_OFF: "host" },
        { CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG: "1" },
      ),
      inert("use-case-id", { CLAUDE_CODE_PROGRAM_USE_CASE_ID: "probe_case_1" }),
      inert("use-case-id-stamped", {
        CLAUDE_CODE_PROGRAM_USE_CASE_ID: "probe_case_1",
        CLAUDE_CODE_PROGRAM_USE_CASE_STAMPED: "1",
      }),
      inert("resume-hint-flags", {
        CLAUDE_CODE_RELAUNCH_RESUME_HINT_FLAGS: "--model sonnet",
      }),
      inert("remote-stall-interval", {
        CLAUDE_CODE_REMOTE_STALL_CHECK_INTERVAL_MS: "1000",
      }),
      inert(
        "remote-stall-interval-remote",
        { CLAUDE_CODE_REMOTE_STALL_CHECK_INTERVAL_MS: "1000" },
        { CLAUDE_CODE_REMOTE: "true" },
      ),
      inert("resume-cache-warm", { CLAUDE_CODE_RESUME_CACHE_WARM: "1" }),
      inert(
        "resume-cache-warm-remote",
        { CLAUDE_CODE_RESUME_CACHE_WARM: "1" },
        { CLAUDE_CODE_REMOTE: "true" },
      ),
      inert("spare-keeps-boot-session-id", {
        CLAUDE_CODE_SPARE_KEEPS_BOOT_SESSION_ID: "1",
      }),
      inert("stream-timer-slack", { CLAUDE_CODE_STREAM_TIMER_SLACK_MS: "100" }),
      inert("teleport-move", { CLAUDE_CODE_TELEPORT_MOVE: "1" }),
      inert(
        "thread-cpu-one-in",
        { CLAUDE_CODE_THREAD_CPU_ONE_IN: "1" },
        { CLAUDE_CODE_REMOTE: "true" },
      ),
      inert("transcript-tail-load", { CLAUDE_CODE_TRANSCRIPT_TAIL_LOAD: "1" }),
      inert("ultrareview-launch-record", {
        CLAUDE_CODE_ULTRAREVIEW_LAUNCH_RECORD: "{HOME}/ur-record",
      }),
      hooksOff("unset-restricted", undefined, true),
      hooksOff("launch-restricted", "launch", true),
      hooksOff("retry-restricted", "retry", true),
      hooksOff("fix-restricted", "fix", true),
      hooksOff("host-restricted", "host", true),
      hooksOff("other-restricted", "banana", true),
      hooksOff("off-restricted", "off", true),
      hooksOff("host-plain", "host", false),
      runnerSession("base", {}),
      runnerSession("renewal-unset", {}, true),
      runnerSession(
        "renewal-disabled",
        { CLAUDE_RUNNER_DISABLE_RENEWAL_WARNING: "1" },
        true,
      ),
      runnerSession("offers-1", { CLAUDE_RUNNER_OFFERS_NEW_MACHINE: "1" }),
      runnerSession("update-bin", { CLAUDE_RUNNER_UPDATE_BIN: "/probe/up" }),
      orchestrator(
        "reason-set",
        { spawn_reason: "runner_lost" },
        { CLAUDE_RUNNER_SPAWN_REASON: "stale" },
      ),
      orchestrator("hook-fails", {}, {}, "echo boom >&2\nexit 1\n"),
      runnerSession("child-exits-1", {}, false, "exit 1"),
      runnerSession("token-ttl-8", {}, false, undefined, 8),
      runnerSession("retire-at", {}, false, undefined, undefined, () => [
        "--retire-at",
        String(Math.floor(Date.now() / 1000) + 7),
      ]),
      runnerSession("child-exits-0", {}, false, "exit 0"),
      orchestrator("reason-none", {}, { CLAUDE_RUNNER_SPAWN_REASON: "stale" }),
      orchestrator("reason-token", { spawn_reason: "Runner.Lost-1_x" }, {}),
      orchestrator("reason-long", { spawn_reason: "a".repeat(200) }, {}),
      orchestrator("reason-upper-colon", { spawn_reason: "A:b" }, {}),
      orchestrator("reason-bad", { spawn_reason: "bad value!" }, {}),
      offline("ur-base", ["ultrareview", "1", "--trust-workspace"], {}),
      offline("ur-record", ["ultrareview", "1", "--trust-workspace"], {
        CLAUDE_CODE_ULTRAREVIEW_LAUNCH_RECORD: "{HOME}/ur-record",
      }),
      gateway("help", ["gateway", "--help"], {}),
      gateway("cmds", ["--help"], {}),
      gateway("ur-help", ["ultrareview", "--help"], {}),
      gateway("runner-help", ["self-hosted-runner", "--help"], {}),
      gateway(
        "bad-config-default",
        ["gateway", "--config", "/nonexistent/gw.json"],
        {},
      ),
      gateway(
        "bad-config-json",
        ["gateway", "--config", "/nonexistent/gw.json"],
        { CLAUDE_GATEWAY_LOG_FORMAT: "json" },
      ),
      gateway(
        "bad-config-JSON-upper",
        ["gateway", "--config", "/nonexistent/gw.json"],
        { CLAUDE_GATEWAY_LOG_FORMAT: "JSON" },
      ),
      gateway(
        "bad-config-text",
        ["gateway", "--config", "/nonexistent/gw.json"],
        { CLAUDE_GATEWAY_LOG_FORMAT: "text" },
      ),
      delta("off", {}),
      delta("fast", { CLAUDE_CODE_PLAIN_DELTA_FAST_PATH: "1" }),
      delta("fast-direct", {
        CLAUDE_CODE_PLAIN_DELTA_FAST_PATH: "1",
        CLAUDE_CODE_PLAIN_DELTA_DIRECT_WRITE: "1",
      }),
      delta("direct-only", { CLAUDE_CODE_PLAIN_DELTA_DIRECT_WRITE: "1" }),
      delta("fast-source", {
        CLAUDE_CODE_PLAIN_DELTA_FAST_PATH: "1",
        CLAUDE_CODE_PLAIN_DELTA_TAKE_AT_SOURCE: "1",
      }),
      delta("source-only", { CLAUDE_CODE_PLAIN_DELTA_TAKE_AT_SOURCE: "1" }),
      replyGate("unset", undefined),
      replyGate("valid", POLICY),
      replyGate("invalid", "{not json"),
      otel("default", {}),
      otel("generic-500", { OTEL_EXPORTER_OTLP_TIMEOUT: "500" }),
      otel("all-three-500", {
        OTEL_EXPORTER_OTLP_TIMEOUT: "20000",
        OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: "500",
        OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: "500",
        OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "500",
      }),
      otel("generic-500-logs-5000", {
        OTEL_EXPORTER_OTLP_TIMEOUT: "500",
        OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: "5000",
      }),
      otel("generic-500-metrics-5000", {
        OTEL_EXPORTER_OTLP_TIMEOUT: "500",
        OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: "5000",
      }),
      otel("generic-500-traces-5000", {
        OTEL_EXPORTER_OTLP_TIMEOUT: "500",
        OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "5000",
      }),
      otel("generic-500-all-signals-5000", {
        OTEL_EXPORTER_OTLP_TIMEOUT: "500",
        OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: "5000",
        OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: "5000",
        OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "5000",
      }),
    ]),
};
