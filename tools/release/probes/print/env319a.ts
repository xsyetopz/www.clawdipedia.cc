import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { BASE, MARK } from "./misc/shared.ts";
import {
  type CaseDef,
  evKinds,
  initEvent,
  msgs,
  readCfg,
  runCases,
  type Spec,
  sysText,
  toolNames,
  toolResultTexts,
  withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const DBG = ["--debug-file", "{CFG}/d.log"];
const UUID = "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f40";
const agent = (
  background: boolean,
  type = "general-purpose",
): NonNullable<Spec["stub"]> => ({
  seq: [
    {
      name: "Agent",
      input: {
        description: "d",
        prompt: MARK,
        subagent_type: type,
        run_in_background: background,
      },
    },
  ],
});

const lines = (s: string, re: RegExp): string =>
  s
    .split("\n")
    .filter((l) => re.test(l))
    .slice(0, 6)
    .map((l) => l.replace(/^\S+\s/, "").slice(0, 160))
    .join("\n");

/** One variable, one setup, a list of values (undefined = unset); `read` turns the run into data. */
const sweep = (
  name: string,
  envName: string,
  values: (string | undefined)[],
  spec: Spec,
  read: (
    r: Parameters<Parameters<typeof withRun>[2]>[0],
  ) => Record<string, string | number | boolean | null>,
  dbg?: RegExp,
): CaseDef[] =>
  values.map((v) => ({
    name: `${name}.${v === undefined ? "unset" : `v${v}`}`,
    run: (ctx) =>
      withRun(
        ctx,
        {
          ...spec,
          env: {
            ...(spec.env ?? {}),
            ...(v === undefined ? {} : { [envName]: v }),
          },
        },
        (r) => ({
          from: r,
          data: {
            precondition: msgs(r).length >= 1 || r.code !== null,
            ...read(r),
          },
          samples: {
            ...(dbg ? { debug: lines(readCfg(r, "d.log"), dbg) } : {}),
          },
        }),
      ),
  }));

// A holder keeps the config lock fresh for 25 s, then releases it. Without a wait the program gives up after its six retries (10 to 20 s).
const HOLD_S = 25;
const lockWait = (v: string | undefined): CaseDef => ({
  name: `config-lock-wait.${v === undefined ? "unset" : `v${v}`}`,
  run: async (ctx) => {
    let holder: ReturnType<typeof Bun.spawn> | undefined;
    const t0 = Date.now();
    return withRun(
      ctx,
      {
        argv: ["mcp", "add", "probe-srv", "--", "echo", "hi"],
        noPrompt: true,
        timeoutMs: 90_000,
        env: v === undefined ? {} : { CLAUDE_CODE_CONFIG_LOCK_WAIT_MS: v },
        setup: ({ cfg }) => {
          const lock = `${cfg}/.claude.json.lock`;
          mkdirSync(lock);
          holder = Bun.spawn([
            "sh",
            "-c",
            `i=0; while [ $i -lt ${HOLD_S} ]; do touch "${lock}"; sleep 1; i=$((i+1)); done; rmdir "${lock}"`,
          ]);
        },
        afterExit: () => {
          holder?.kill();
          return {};
        },
      },
      (r) => ({
        from: r,
        data: {
          precondition: r.code !== null && !r.timedOut,
          exit: r.code,
          seconds: Math.round((Date.now() - t0) / 5000) * 5,
          namesVariable: (r.stdout + r.stderr).includes(
            "CLAUDE_CODE_CONFIG_LOCK_WAIT_MS",
          ),
        },
        samples: { out: (r.stdout + r.stderr).slice(0, 300) },
      }),
    );
  },
});

// A stdio MCP server that advertises the tasks capability and logs each request it gets.
const TASK_SRV = `const fs=require("fs");const L=process.env.LOG;let buf="";
process.stdin.on("data",c=>{buf+=c;let i;while((i=buf.indexOf("\\n"))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}fs.appendFileSync(L,l+"\\n");const s=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");
if(m.method==="server/discover")s({ttlMs:0,cacheScope:"private",supportedVersions:["2026-07-28"],capabilities:{tools:{},tasks:{requests:{tools:{call:{}}},list:{},cancel:{}}},serverInfo:{name:"ms",version:"1"}});
else if(m.method==="initialize")s({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{},tasks:{requests:{tools:{call:{}}},list:{},cancel:{}}},serverInfo:{name:"ms",version:"1"}});
else if(m.method==="tools/list")s({tools:[{name:"ping",description:"p",inputSchema:{type:"object",properties:{}},execution:{taskSupport:"optional"}}]});
else if(m.method==="tools/call")s(process.env.TASK&&m.params._meta["io.modelcontextprotocol/clientCapabilities"].extensions?{resultType:"task",taskId:"t1",status:"working"}:{content:[{type:"text",text:"pong"}]});
else if(m.method==="tasks/get")s({taskId:"t1",status:"completed",result:{content:[{type:"text",text:"pong"}]}});
else if(m.id!==undefined)s({});}});process.stdin.on("end",()=>process.exit(0));`;
// Only a call that may become a task keeps the tasks extension in its `_meta`. A single-shot `-p "prompt"` run strips it,
// and so does a run whose input has ended, so the background cases use stream-json input held open past the call.
const STREAM_USER = `${JSON.stringify({ type: "user", message: { role: "user", content: "Reply with 'OK'." } })}\n`;
const mcpTasks = (
  envName: string,
  v: string | undefined,
  extra: Record<string, string> = {},
  stream = false,
): CaseDef => ({
  name: `${envName
    .replace(/^CLAUDE_CODE_/, "")
    .toLowerCase()
    .replaceAll("_", "-")}.${v === undefined ? "unset" : `v${v}`}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        ...(stream
          ? { noPrompt: true, stdin: STREAM_USER, stdinOpenMs: 15_000 }
          : {}),
        args: [
          ...(stream ? ["-p", "--input-format", "stream-json"] : []),
          ...BASE,
          "--mcp-config",
          "{CFG}/mcp.json",
          "--strict-mcp-config",
        ],
        env: {
          ENABLE_TOOL_SEARCH: "false",
          CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1",
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "0",
          DISABLE_TELEMETRY: "0",
          HTTPS_PROXY: "http://127.0.0.1:9",
          NO_PROXY: "127.0.0.1,localhost",
          ...extra,
          ...(v === undefined ? {} : { [envName]: v }),
        },
        allowOverride: [
          "ENABLE_TOOL_SEARCH",
          "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
          "DISABLE_TELEMETRY",
          "HTTPS_PROXY",
          "NO_PROXY",
        ],
        stub: { seq: [{ name: "mcp__ms__ping", input: {} }] },
        setup: ({ cfg }) => {
          writeFileSync(`${cfg}/srv.js`, TASK_SRV);
          writeFileSync(
            `${cfg}/.claude.json`,
            JSON.stringify({
              cachedGrowthBookFeatures: { tengu_glowing_lark: true },
            }),
          );
          writeFileSync(
            `${cfg}/mcp.json`,
            JSON.stringify({
              mcpServers: {
                ms: {
                  command: "bun",
                  args: [`${cfg}/srv.js`],
                  env: {
                    LOG: `${cfg}/srv.log`,
                    ...(stream && { TASK: "1" }),
                  },
                },
              },
            }),
          );
        },
        afterExit: ({ cfg }) => ({
          log: existsSync(`${cfg}/srv.log`)
            ? readFileSync(`${cfg}/srv.log`, "utf8")
            : "",
        }),
      },
      (r) => {
        const rows = String(r.after["log"] ?? "")
          .split("\n")
          .filter(Boolean)
          .map(
            (l) =>
              JSON.parse(l) as Record<
                string,
                Record<string, unknown> | string | undefined
              >,
          );
        const init = rows.find(
          (x) =>
            x["method"] === "initialize" || x["method"] === "server/discover",
        );
        const call = rows.find((x) => x["method"] === "tools/call");
        return {
          from: r,
          data: {
            precondition: rows.length > 0 && call !== undefined,
            methods: rows.map((x) => x["method"]).join(","),
            initCapabilities: JSON.stringify(
              (init?.["params"] as Record<string, unknown> | undefined)?.[
                "_meta"
              ],
            ),
            callParams: JSON.stringify(call?.["params"]),
            callHasTasksExtension: JSON.stringify(call).includes(
              "io.modelcontextprotocol/tasks",
            ),
            toolResult: toolResultTexts(r)[0] ?? "",
            taskEvents: r.stdout
              .split("\n")
              .filter((l) => /"subtype":"(task_|background_tasks)/.test(l))
              .map((l) => l.slice(0, 160))
              .slice(0, 5),
          },
        };
      },
    ),
});

// Run 1 defers an MCP tool call with a PreToolUse hook and ends with the call open. Run 2 resumes that session without the server, so the tool is gone.
const encodeDir = (p: string) => p.replace(/[^A-Za-z0-9]/g, "-");
const dropDeferred = (v: string | undefined): CaseDef => ({
  name: `drop-unavailable-deferred-tool.${v === undefined ? "unset" : `v${v}`}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        args: [
          ...BASE,
          "--mcp-config",
          "{CFG}/mcp.json",
          "--strict-mcp-config",
        ],
        env: { ENABLE_TOOL_SEARCH: "false" },
        allowOverride: ["ENABLE_TOOL_SEARCH"],
        stub: { seq: [{ name: "mcp__ms__ping", input: {} }] },
        setup: ({ cfg }) => {
          writeFileSync(`${cfg}/srv.js`, TASK_SRV);
          writeFileSync(
            `${cfg}/mcp.json`,
            JSON.stringify({
              mcpServers: {
                ms: {
                  command: "bun",
                  args: [`${cfg}/srv.js`],
                  env: { LOG: `${cfg}/srv.log` },
                },
              },
            }),
          );
          writeFileSync(
            `${cfg}/settings.json`,
            JSON.stringify({
              hooks: {
                PreToolUse: [
                  {
                    matcher: "mcp__ms__ping",
                    hooks: [
                      {
                        type: "command",
                        command:
                          'echo \'{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"defer"}}\'',
                      },
                    ],
                  },
                ],
              },
            }),
          );
        },
      },
      async (first) => {
        const sid = String(initEvent(first)?.["session_id"] ?? "");
        return withRun(
          ctx,
          {
            args: ["--resume", sid],
            env:
              v === undefined
                ? {}
                : { CLAUDE_CODE_DROP_UNAVAILABLE_DEFERRED_TOOL: v },
            setup: ({ cfg, proj }) => {
              const src = join(first.sb.cfg, "projects");
              const old = readdirSync(src)[0];
              if (old)
                cpSync(join(src, old), join(cfg, "projects", encodeDir(proj)), {
                  recursive: true,
                });
            },
          },
          (r) => {
            const q = msgs(r)[0];
            const m = q ? JSON.stringify(q.body) : "";
            return {
              from: r,
              data: {
                precondition:
                  sid.length > 0 && first.stdout.includes("tool_deferred"),
                firstTerminal:
                  first.stdout.match(/"terminal_reason":"([^"]*)"/)?.[1] ?? "",
                exit: r.code,
                requests: msgs(r).length,
                requestHasPing: m.includes("ping"),
                terminal:
                  r.stdout.match(/"terminal_reason":"([^"]*)"/)?.[1] ?? "",
                notice: /isn't available, so its deferred call/.test(
                  r.stdout + r.stderr,
                ),
              },
              samples: { out: (r.stdout + r.stderr).slice(-400) },
            };
          },
        );
      },
    ),
});

// CLAUDE_CODE_REMOTE=1 makes the program treat the session as a cloud session (chunk-qzv5gd5j.js@813).
const replyHold = (v: string | undefined): CaseDef => ({
  name: `main-reply-hold.${v === undefined ? "unset" : `v${v}`}`,
  run: async (ctx) => {
    const t0 = Date.now();
    return withRun(
      ctx,
      {
        env: {
          CLAUDE_CODE_REMOTE: "1",
          ...(v === undefined ? {} : { CLAUDE_CODE_MAIN_REPLY_HOLD_MS: v }),
        },
      },
      (r) => ({
        from: r,
        data: {
          precondition: r.code === 0,
          seconds: Math.round((Date.now() - t0) / 1000),
          requests: msgs(r).length,
        },
      }),
    );
  },
});

// The program derives the child session id as a UUID v5 of the remote id (namespace 3ab19d7e-9f35-45c2-926e-75e271cc60b3).
const derived = (id: string): string => {
  const h = createHash("sha1")
    .update(
      Buffer.from(
        "3ab19d7e-9f35-45c2-926e-75e271cc60b3".replace(/-/g, ""),
        "hex",
      ),
    )
    .update(id)
    .digest();
  h.writeUInt8((h.readUInt8(6) & 15) | 80, 6);
  h.writeUInt8((h.readUInt8(8) & 63) | 128, 8);
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
};

const CHILD = {
  CLAUDE_CODE_CHILD_SESSION: "1",
  CLAUDE_CODE_REMOTE_SESSION_ID: UUID,
};

export const env319a: PrintGroup = {
  id: "env319a",
  title: "New 2.1.319 env names, first half",
  run: (ctx) =>
    runCases(ctx, "env319a", [
      ...["BUN_GC_TIMER_DISABLE", "CCR_AGENT_PROXY_MAX_BUSY_TUNNELS"].flatMap(
        (n) =>
          sweep(`plain.${n}`, n, [undefined, "1"], {}, (r) => {
            const q = msgs(r)[0];
            return {
              exit: r.code,
              tools: q ? toolNames(q).length : 0,
              sys: q ? sysText(q).length : 0,
              requests: msgs(r).length,
            };
          }),
      ),
      dropDeferred(undefined),
      dropDeferred("1"),
      mcpTasks("CLAUDE_CODE_DISABLE_MCP_TASKS", undefined),
      mcpTasks("CLAUDE_CODE_DISABLE_MCP_TASKS", "1"),
      ...[undefined, "1"].map((v) =>
        mcpTasks(
          "CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND",
          v,
          { CLAUDE_AUTO_BACKGROUND_TASKS: "1" },
          true,
        ),
      ),
      lockWait(undefined),
      lockWait("60000"),
      replyHold(undefined),
      replyHold("8000"),
      ...sweep(
        "nested-session-id",
        "CLAUDE_CODE_DISABLE_NESTED_SESSION_ID",
        [undefined, "1"],
        { env: CHILD },
        (r) => ({
          sessionId: String(initEvent(r)?.["session_id"] ?? ""),
          equalsRemoteId: initEvent(r)?.["session_id"] === derived(UUID),
        }),
      ),
      ...sweep(
        "agent-summaries",
        "CLAUDE_CODE_DISABLE_AGENT_PROGRESS_SUMMARIES",
        [undefined, "1"],
        {
          noPrompt: true,
          argv: [
            "-p",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            "--model",
            "claude-opus-5-5",
            ...BASE,
            ...DBG,
          ],
          stdin: `${[
            {
              type: "control_request",
              request_id: "i1",
              request: { subtype: "initialize", agentProgressSummaries: true },
            },
            {
              type: "user",
              message: { role: "user", content: "Reply with 'OK'." },
            },
          ]
            .map((l) => JSON.stringify(l))
            .join("\n")}\n`,
          env: { CLAUDE_CODE_FORK_SUBAGENT: "1" },
          timeoutMs: 240_000,
          stub: {
            seq: [
              {
                name: "Agent",
                input: { description: "d", prompt: MARK },
              },
              {
                name: "Bash",
                input: {
                  command: 'python3 -c "import time; time.sleep(70)"',
                },
              },
            ],
          },
        },
        (r) => {
          const log = readCfg(r, "d.log");
          return {
            requests: msgs(r).length,
            timerLines: (log.match(/\[AgentSummary\] Timer fired/g) ?? [])
              .length,
            offLine: /No progress summaries/.test(log),
            anyLine: /AgentSummary/.test(log),
            trace: log
              .split("\n")
              .filter((l) =>
                /AgentSummary|Bash|sleep|subagent|Agent tool/i.test(l),
              )
              .slice(0, 40)
              .map((l) => l.slice(0, 150))
              .join("\n"),
          };
        },
        /AgentSummary/,
      ),
      ...sweep(
        "subagent-handback",
        "CLAUDE_CODE_DISABLE_SUBAGENT_HANDBACK",
        [undefined, "1"],
        {
          args: ["--permission-mode", "auto", ...DBG],
          safeguard: "not_flagged",
          timeoutMs: 60_000,
          stub: agent(false),
        },
        (r) => {
          const all = msgs(r)
            .map((q) => JSON.stringify(q.body))
            .join("\n");
          return {
            requests: msgs(r).length,
            denied: r.stdout.includes("permission_denied"),
            handbackTool: /SubagentHandback/.test(all),
            handBack: toolResultTexts(r).some((t) =>
              t.includes("[Subagent hand-back]"),
            ),
            deliveredLine: /final report is delivered through/.test(all),
            result: (toolResultTexts(r)[0] ?? "").slice(0, 200),
          };
        },
      ),
      ...sweep(
        "cryptic-horizon-poll",
        "CLAUDE_CODE_CRYPTIC_HORIZON",
        [undefined, "1"],
        {
          noPrompt: true,
          argv: [
            "-p",
            "--input-format",
            "stream-json",
            "--output-format",
            "stream-json",
            "--verbose",
            ...BASE,
            "--permission-mode",
            "auto",
            ...DBG,
          ],
          stdin: `${[
            {
              type: "control_request",
              request_id: "p1",
              request: {
                subtype: "poll_event",
                kind: "note",
                event:
                  '<event kind="note" at="2026-11-06T12:00:00.000Z">build finished</event>',
                wake: false,
                authority: "peer-agent",
                sender_id: "peer-1",
                sender_text: "build finished",
              },
            },
            {
              type: "user",
              message: { role: "user", content: "Reply with 'OK'." },
            },
          ]
            .map((l) => JSON.stringify(l))
            .join("\n")}\n`,
          env: { CLAUDE_CODE_POLL_EVENTS: "1", CLAUDE_CODE_REMOTE: "1" },
          safeguard: "not_flagged",
          timeoutMs: 60_000,
          stub: {
            seq: [
              { name: "Poll", input: {} },
              { name: "Bash", input: { command: "echo hi" } },
            ],
          },
        },
        (r) => {
          const all = msgs(r).map((q) => JSON.stringify(q.body));
          const ctx = all.filter((b) => b.includes("classifier_context"));
          return {
            requests: msgs(r).length,
            pollReply:
              r.stdout.match(/"subtype":"(success|error)"[^\n]{0,200}/)?.[0] ??
              "",
            pollInHistory: all.filter((b) => /build finished/.test(b)).length,
            withContext: ctx.length,
            withEvents: ctx.filter((b) =>
              /classifier_context[\s\S]*"events"/.test(b),
            ).length,
            hist: all
              .map((b) => b.match(/.{0,300}build finished.{0,100}/)?.[0] ?? "")
              .filter(Boolean)
              .slice(0, 1)
              .join(""),
            events: (ctx.at(-1) ?? "").match(/"events":.{0,260}/)?.[0] ?? "",
            sample:
              (ctx.at(-1) ?? "").match(/"classifier_context":.{0,400}/)?.[0] ??
              "",
          };
        },
        /auto_mode_poll_event_listing|poll/i,
      ),
      ...sweep(
        "wrap-up",
        "CLAUDE_CODE_ENABLE_WRAP_UP",
        [undefined, "1"],
        {
          env: { CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1" },
          setup: ({ cfg }) =>
            writeFileSync(
              `${cfg}/.claude.json`,
              JSON.stringify({
                cachedGrowthBookFeatures: { tengu_merry_thunder: true },
              }),
            ),
        },
        (r) => {
          const q = msgs(r)[0];
          return {
            wrapUpTool: q ? toolNames(q).includes("WrapUp") : null,
            tools: q ? toolNames(q).length : 0,
          };
        },
      ),
      ...sweep(
        "cowork-plugin-skill",
        "CLAUDE_CODE_COWORK_PLUGIN_SKILL",
        [undefined, "1"],
        {},
        (r) => {
          const body = JSON.stringify(msgs(r)[0]?.body ?? "");
          return {
            mentionsCowork: /cowork/i.test(body),
            snippet: /.{80}cowork-plugin.{160}/i.exec(body)?.[0] ?? "",
            bodyLen: body.length,
          };
        },
      ),
      ...sweep(
        "disable-feature-flags",
        "CLAUDE_CODE_DISABLE_FEATURE_FLAGS",
        [undefined, "1"],
        {
          env: {
            CLAUDE_CODE_ENABLE_WRAP_UP: "1",
            CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1",
          },
          setup: ({ cfg }) =>
            writeFileSync(
              `${cfg}/.claude.json`,
              JSON.stringify({
                cachedGrowthBookFeatures: { tengu_merry_thunder: true },
              }),
            ),
        },
        (r) => {
          const q = msgs(r)[0];
          return { wrapUpTool: q ? toolNames(q).includes("WrapUp") : null };
        },
      ),
      ...sweep(
        "code-mode",
        "CLAUDE_CODE_EXPERIMENTAL_CODE_MODE",
        [undefined, "1", "on", "bogus"],
        { args: DBG },
        (r) => ({
          tools: toolNames(msgs(r)[0] ?? ({} as never)).join(","),
          events: evKinds(r).slice(0, 80),
          exit: r.code,
          debugMentions: /code mode|repl_mode|opt.in/i.test(
            readCfg(r, "d.log"),
          ),
        }),
        /code mode|repl_mode|opt.in/i,
      ),
      // User settings set the proxy variable; the host-managed marker decides whether the program takes it.
      ...sweep(
        "proxy-resolves-hosts-from-settings",
        "CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST",
        [undefined, "1"],
        {
          args: DBG,
          cfgFiles: {
            "settings.json": JSON.stringify({
              env: { CLAUDE_CODE_PROXY_RESOLVES_HOSTS: "1" },
            }),
          },
        },
        (r) => ({
          ignored: /Ignoring \S*CLAUDE_CODE_PROXY_RESOLVES_HOSTS/.test(
            readCfg(r, "d.log"),
          ),
          exit: r.code,
        }),
        /CLAUDE_CODE_PROXY_RESOLVES_HOSTS/,
      ),
    ]),
};
