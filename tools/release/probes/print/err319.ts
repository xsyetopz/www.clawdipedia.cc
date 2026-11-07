// Print probes for the 2.1.319 user-triggerable error texts (task err319).
// Each case records the lines that carry the text, so the docs quote what the program printed.
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROMPT } from "../../lib/env.ts";
import { startMitm } from "../../lib/mitm.ts";
import { withRamDisk } from "../../lib/ramdisk.ts";
import { SRV } from "./api319.ts";
import {
  type CaseDef,
  json,
  msgs,
  type Run,
  readCfg,
  runCases,
  type Spec,
  toolNames,
  toolResultTexts,
  withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const GI = { "connector-downloads/.gitignore": "*\n" };
const GB_ON = {
  DISABLE_TELEMETRY: "",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
};
const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };
const GATEWAY_YAML = `listen:
  host: 127.0.0.1
  port: 18099
upstreams:
  - provider: mantle
    region: us-east-1
    models: [claude-opus-4-7]
    auth:
      aws_bearer_token: fake-bearer
    assume_role:
      role_arn: arn:aws:iam::123456789012:role/probe
`;
const BASH = { seq: [{ name: "Bash", input: { command: "echo hi" } }] };

const grep = (r: Run, re: RegExp): string =>
  [
    ...r.stdout.split("\n").map((l) => `out: ${l}`),
    ...r.stderr.split("\n").map((l) => `err: ${l}`),
    ...toolResultTexts(r).map((l) => `tool_result: ${l}`),
    ...readCfg(r, "d.log")
      .split("\n")
      .map((l) => `debug: ${l}`),
  ]
    .filter((l) => re.test(l))
    .slice(0, 8)
    .map((l) => l.slice(0, 700))
    .join("\n");

const one = (name: string, spec: Spec, re: RegExp): CaseDef => ({
  name,
  run: (ctx) =>
    withRun(ctx, spec, (r) => ({
      from: r,
      data: {
        exit: r.code,
        requests: msgs(r).length,
        tools: msgs(r)[0] ? toolNames(msgs(r)[0] as never).length : 0,
      },
      samples: { text: grep(r, re) },
    })),
});

/** A stdio MCP tool whose outputSchema declares `url` as its `$schema`, called once. */
const mcpOutputSchema = (id: string, url: string): CaseDef =>
  one(
    `mcp-output-schema-${id}`,
    {
      setup: (sb) => {
        mkdirSync(`${sb.home}/m`);
        writeFileSync(
          `${sb.home}/m/srv.js`,
          SRV.replace(
            'inputSchema:{type:"object",properties:{}}}',
            `inputSchema:{type:"object",properties:{}},outputSchema:{$schema:${JSON.stringify(url)},type:"object",properties:{n:{type:"number"}}}}`,
          ).replace(
            "else if(m.id!==undefined)s({});",
            'else if(m.method==="tools/call")s({content:[{type:"text",text:"{\\"n\\":1}"}],structuredContent:{n:1}});else if(m.id!==undefined)s({});',
          ),
        );
        writeFileSync(
          `${sb.home}/m/mcp.json`,
          json({
            mcpServers: {
              psrv: { command: "bun", args: [`${sb.home}/m/srv.js`] },
            },
          }),
        );
      },
      env: { ENABLE_TOOL_SEARCH: "false" },
      args: [
        "--mcp-config",
        "{HOME}/m/mcp.json",
        "--permission-mode",
        "bypassPermissions",
        "--debug-file",
        "{CFG}/d.log",
      ],
      stub: { seq: [{ name: "mcp__psrv__ping", input: {} }] },
    },
    /unsupported dialect|"n":1|[Ss]chema|dialect/,
  );

export const err319: PrintGroup = {
  id: "err319",
  title: "Error texts a user can trigger (2.1.319)",
  run: (ctx) =>
    runCases(ctx, "err319", [
      one(
        "hook-powershell",
        {
          args: ["--debug-file", "{CFG}/d.log"],
          projFiles: {
            ".claude/settings.json": json({
              hooks: {
                PreToolUse: [
                  {
                    matcher: "Bash",
                    hooks: [
                      {
                        type: "command",
                        command: "echo hi",
                        shell: "powershell",
                      },
                    ],
                  },
                ],
              },
            }),
          },
          stub: BASH.seq ? { seq: BASH.seq } : {},
        },
        /PowerShell|powershell/,
      ),
      one(
        "mcp-add-connector-downloads",
        {
          argv: ["mcp", "add", "--scope", "project", "probe", "--", "echo"],
          cwdSub: "connector-downloads",
          projFiles: GI,
        },
        /connector-downloads/,
      ),
      one(
        "mcp-add-connector-downloads-no-gitignore",
        {
          argv: ["mcp", "add", "--scope", "project", "probe", "--", "echo"],
          cwdSub: "connector-downloads",
        },
        /connector-downloads|Added|added/,
      ),
      one(
        "resume-damaged-transcript",
        {
          args: [
            "--resume",
            "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f40",
            "--debug-file",
            "{CFG}/d.log",
          ],
          setup: (sb) => {
            const dir = `${sb.cfg}/projects/${realpathSync(sb.proj).replace(/[^A-Za-z0-9]/g, "-")}`;
            mkdirSync(dir, { recursive: true });
            writeFileSync(
              `${dir}/0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f40.jsonl`,
              '{"type":"user","message":{"role":"user","content":"hi"},"uuid":"u1","sessionId":"0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f40"}\nnot json at all\n',
            );
          },
        },
        /transcript|damaged|resume|No conversation/i,
      ),
      one(
        "settings-connector-downloads",
        {
          cwdSub: "connector-downloads",
          projFiles: {
            ...GI,
            "connector-downloads/.claude/settings.json": json({ model: "x" }),
          },
          args: ["--debug-file", "{CFG}/d.log"],
        },
        /connector-downloads/,
      ),
      one(
        "auto-mode-print-refused",
        {
          argv: [
            "-p",
            PROMPT,
            "--permission-mode",
            "auto",
            "--model",
            "claude-opus-5-5",
          ],
          stub: {
            seq: [
              {
                name: "Bash",
                input: { command: "curl -s http://127.0.0.1:9/x" },
              },
            ],
          },
          refuseServerCheck: true,
        },
        /auto mode|could not check|Exiting|result/,
      ),
      one(
        "gateway-assume-role-bearer",
        {
          argv: ["gateway", "--config", "{PROJ}/g.yaml"],
          projFiles: { "g.yaml": GATEWAY_YAML },
        },
        /assume_role/,
      ),
      one(
        "remote-trigger-bad-cursor",
        {
          env: { ...GB_ON, ...FIRST_PARTY },
          allowOverride: Object.keys(GB_ON),
          cfgFiles: {
            ".credentials.json": json({
              claudeAiOauth: {
                accessToken: "sk-ant-oat01-fake",
                refreshToken: "sk-ant-ort01-fake",
                expiresAt: 9999999999999,
                scopes: ["user:inference", "user:profile"],
                subscriptionType: "max",
              },
            }),
            ".claude.json": json({
              hasCompletedOnboarding: true,
              cachedGrowthBookFeatures: { tengu_zippy_cocoa: true },
            }),
          },
          args: ["--debug-file", "{CFG}/d.log"],
          stub: {
            seq: [
              {
                name: "RemoteTrigger",
                input: {
                  action: "get_run_log",
                  session_id: "session_01ABCDEFGHJKLMNPQRSTUVWX",
                  cursor: "bogus",
                },
              },
            ],
          },
        },
        /RemoteTrigger|cursor|No such tool/,
      ),
      one(
        "write-verify-race",
        {
          setup: (sb) => writeFileSync(`${sb.proj}/racy.txt`, "start\n"),
          args: ["--permission-mode", "bypassPermissions"],
          stub: {
            seq: [
              { name: "Read", input: { file_path: "{PROJ}/racy.txt" } },
              {
                name: "Bash",
                input: {
                  command:
                    "(i=0; while [ $i -lt 40000 ]; do printf 'x' > racy.txt; i=$((i+1)); done) >/dev/null 2>&1 &",
                },
              },
              {
                name: "Write",
                input: {
                  file_path: "{PROJ}/racy.txt",
                  content: "a longer replacement text that is not one letter",
                },
              },
            ],
          },
        },
        /tool_result|verification|does not hold/,
      ),
      one(
        "write-verify-watcher",
        {
          setup: (sb) => writeFileSync(`${sb.proj}/racy.txt`, "start\n"),
          args: ["--permission-mode", "bypassPermissions"],
          stub: {
            seq: [
              { name: "Read", input: { file_path: "{PROJ}/racy.txt" } },
              {
                name: "Bash",
                input: {
                  // Rewrites the file in place with same-size other bytes as soon as its mtime moves (after the Write began).
                  command:
                    "python3 -c \"import os,time\\np='racy.txt'\\nm=os.stat(p).st_mtime_ns\\nt=time.time()+20\\nwhile time.time()<t:\\n  if os.stat(p).st_mtime_ns!=m:\\n    n=os.stat(p).st_size\\n    f=os.open(p,os.O_WRONLY)\\n    os.write(f,b'Z'*n)\\n    break\\n\" >/dev/null 2>&1 &",
                },
              },
              {
                name: "Write",
                input: {
                  file_path: "{PROJ}/racy.txt",
                  content: "a longer replacement text that is not one letter",
                },
              },
            ],
          },
        },
        /tool_result|verification|does not hold/,
      ),
      one(
        "write-verify-pretooluse-order",
        {
          setup: (sb) => writeFileSync(`${sb.proj}/racy.txt`, "start\n"),
          args: ["--permission-mode", "bypassPermissions"],
          cfgFiles: {
            "settings.json": json({
              hooks: {
                PreToolUse: [
                  {
                    matcher: "Write",
                    hooks: [
                      { type: "command", command: "printf z >> racy.txt" },
                    ],
                  },
                ],
              },
            }),
          },
          stub: {
            seq: [
              { name: "Read", input: { file_path: "{PROJ}/racy.txt" } },
              {
                name: "Write",
                input: { file_path: "{PROJ}/racy.txt", content: "replacement" },
              },
            ],
          },
        },
        /tool_result|verification|does not hold|modified/,
      ),
      {
        name: "write-verify-full-disk",
        run: (ctx) =>
          withRamDisk(4096, (d) => {
            d.fillLeaving(32 * 1024);
            return withRun(
              ctx,
              {
                args: ["--permission-mode", "bypassPermissions"],
                stub: {
                  seq: [
                    {
                      name: "Write",
                      input: {
                        file_path: `${d.dir}/new.txt`,
                        content: "x".repeat(300 * 1024),
                      },
                    },
                  ],
                },
              },
              (r) => ({
                from: r,
                data: { exit: r.code, free_before: d.free() },
                samples: {
                  text: grep(r, /tool_result|verification|space|ENOSPC/),
                },
              }),
            );
          }),
      },
      one(
        "chrome-no-extension",
        {
          env: { ...GB_ON, ...FIRST_PARTY },
          allowOverride: Object.keys(GB_ON),
          cfgFiles: {
            ".credentials.json": json({
              claudeAiOauth: {
                accessToken: "sk-ant-oat01-fake",
                refreshToken: "sk-ant-ort01-fake",
                expiresAt: 9999999999999,
                scopes: ["user:inference", "user:profile"],
                subscriptionType: "max",
              },
            }),
          },
          args: ["--chrome", "--debug-file", "{CFG}/d.log"],
          stub: {
            seq: [
              { name: "mcp__claude-in-chrome__tabs_context_mcp", input: {} },
            ],
          },
        },
        /hrome|xtension|bridge|browser|mcp__/,
      ),
      one(
        "auth-logout-dir",
        {
          argv: ["auth", "logout"],
          cfgFiles: { ".claude.json/x": "1" },
        },
        /logout|Logout|config file/,
      ),
      one(
        "auth-logout-unwritable",
        {
          argv: ["auth", "logout"],
          cfgFiles: {
            ".claude.json": json({
              primaryApiKey: "sk-ant-probe",
              hasCompletedOnboarding: true,
            }),
          },
          setup: (sb) => chmodSync(sb.cfg, 0o555),
          afterExit: (sb) => {
            chmodSync(sb.cfg, 0o755);
            return {};
          },
        },
        /logout|Logout|config file/,
      ),
      one(
        "grep-untraversable-dir",
        {
          setup: (sb) => {
            mkdirSync(`${sb.proj}/locked`);
            writeFileSync(`${sb.proj}/locked/a.txt`, "needle\n");
            chmodSync(`${sb.proj}/locked`, 0o600);
          },
          afterExit: (sb) => {
            chmodSync(`${sb.proj}/locked`, 0o755);
            return {};
          },
          args: ["--permission-mode", "bypassPermissions", "--tools", "Grep"],
          stub: {
            seq: [
              {
                name: "Grep",
                input: { pattern: "needle", path: "{PROJ}/locked" },
              },
            ],
          },
        },
        /Cannot search|traversable/,
      ),
      one(
        "mcp-add-bad-env",
        { argv: ["mcp", "add", "probe", "-e", "NOEQUALS", "--", "echo"] },
        /Invalid environment variable format/,
      ),
      // The program drops a known draft `$schema` before the MCP validator. The unknown URL is the case that would reach the dialect guard.
      ...[
        ["draft-07", "http://json-schema.org/draft-07/schema#"],
        ["unknown-dialect", "https://example.test/dialect"],
      ].map(([id, url]) => mcpOutputSchema(id as string, url as string)),
      // A character above Latin-1: the HTTP runtime takes control bytes such as \x01 but refuses this.
      one(
        "custom-headers-bad-authorization",
        {
          args: ["--debug-file", "{CFG}/d.log"],
          env: { ANTHROPIC_CUSTOM_HEADERS: "Authorization: a\u0100b" },
        },
        /Invalid Authorization header value/,
      ),
      // A stand-in pwsh: the quote check runs before the command is spawned.
      one(
        "powershell-tmpdir-quote",
        {
          setup: (sb) => {
            mkdirSync(`${sb.home}/bin`);
            writeFileSync(`${sb.home}/bin/pwsh`, "#!/bin/sh\nexit 0\n");
            chmodSync(`${sb.home}/bin/pwsh`, 0o755);
            mkdirSync(`${sb.home}/t\u2018mp`);
          },
          env: {
            CLAUDE_CODE_USE_POWERSHELL_TOOL: "1",
            CLAUDE_CODE_TMPDIR: "{HOME}/t\u2018mp",
            PATH: "{HOME}/.probe-bin:{HOME}/bin:/usr/bin:/bin",
          },
          allowOverride: ["PATH"],
          args: [
            "--permission-mode",
            "bypassPermissions",
            "--tools",
            "PowerShell",
          ],
          stub: {
            seq: [
              { name: "PowerShell", input: { command: "Write-Output hi" } },
            ],
          },
        },
        /Cannot safely quote|PowerShell/,
      ),
      // The argument check takes any `-\S+` suffix; the version check takes only [0-9A-Za-z.-] after the `-`.
      one(
        "install-version-underscore",
        { argv: ["install", "1.2.3-a_b"] },
        /Invalid version string|Invalid channel/,
      ),
      // `..` passes the argument check and fails the well-formed check, as `_` does.
      one(
        "install-version-dotdot",
        { argv: ["install", "1.2.3-a..b"] },
        /Invalid version string|Invalid channel/,
      ),
      one(
        "runner-secret-file-missing",
        {
          argv: [
            "self-hosted-runner",
            "--api-url",
            "http://127.0.0.1:9",
            "--environment-secret-file",
            "{HOME}/missing",
          ],
        },
        /Failed to read environment secret file/,
      ),
      // A stand-in `open` plays the browser: it calls the program's localhost callback with the state of the sign-in URL. A local TLS stub answers the token exchange with no inference scope, and create_api_key with no key.
      {
        name: "console-login-no-key",
        run: async (ctx) => {
          const mitm = await startMitm({
            tunnelOthers: false,
            hosts: ["platform.claude.com"],
            upstream: async (req, url) => {
              if (url.pathname === "/v1/oauth/token")
                return Response.json({
                  access_token: "probe-access",
                  refresh_token: "probe-refresh",
                  expires_in: 3600,
                  token_type: "Bearer",
                  scope: "org:create_api_key user:profile",
                  account: {
                    uuid: "probe-account",
                    email_address: "probe@example.invalid",
                  },
                  organization: { uuid: "probe-org", name: "probe" },
                });
              if (url.pathname.endsWith("/create_api_key"))
                return Response.json({});
              return Response.json(
                { path: url.pathname, method: req.method },
                { status: 404 },
              );
            },
          });
          try {
            return await withRun(
              ctx,
              {
                auth: "none",
                setup: (sb) => {
                  const open = join(sb.home, ".probe-bin", "open");
                  writeFileSync(
                    open,
                    `#!/bin/sh\nfor a in "$@"; do case "$a" in http*) u="$a";; esac; done\nr=$(printf %s "$u" | sed -n 's/.*redirect_uri=\\([^&]*\\).*/\\1/p' | sed 's/%3A/:/g;s/%2F/\\//g')\ns=$(printf %s "$u" | sed -n 's/.*[?&]state=\\([^&]*\\).*/\\1/p')\ncurl -s --noproxy '*' "$r?code=probe-code&state=$s" >/dev/null &\nexit 0\n`,
                  );
                  chmodSync(open, 0o755);
                },
                env: {
                  NODE_EXTRA_CA_CERTS: mitm.caFile,
                  HTTPS_PROXY: mitm.proxyUrl,
                  BROWSER: "{HOME}/.probe-bin/open",
                },
                allowOverride: ["HTTPS_PROXY"],
                argv: ["auth", "login", "--console"],
                timeoutMs: 30_000,
              },
              (r) => ({
                from: r,
                data: {
                  exit: r.code,
                  timedOut: r.timedOut,
                  tlsPaths: mitm
                    .log()
                    .map((l) => `${l.method} ${l.path} ${l.status}`)
                    .join(", "),
                },
                samples: {
                  text: grep(r, /Unable to create API key|rror|^err: \S/),
                },
              }),
            );
          } finally {
            mitm.stop();
          }
        },
      },
      // The runner tool spawns the program's own file. The case runs a copy, and a PreToolUse hook deletes the copy before the tool call.
      {
        name: "runner-spawn-missing-binary",
        run: (ctx) => {
          const dir = mkdtempSync(join(tmpdir(), "probe-bin-"));
          const bin = join(dir, "claude");
          copyFileSync(ctx.bin, bin);
          const spec: Spec = {
            env: { PROBE_BIN: bin },
            cfgFiles: {
              "settings.json": JSON.stringify({
                hooks: {
                  PreToolUse: [
                    {
                      matcher: "self_hosted_runner_spawn_local",
                      hooks: [
                        { type: "command", command: 'rm -f "$PROBE_BIN"' },
                      ],
                    },
                  ],
                },
              }),
            },
            args: [
              "--permission-mode",
              "bypassPermissions",
              "--tools",
              "self_hosted_runner_spawn_local",
            ],
            stub: {
              seq: [
                {
                  name: "self_hosted_runner_spawn_local",
                  input: { secret_file_path: "{HOME}/secret" },
                },
              ],
            },
          };
          return withRun({ ...ctx, bin }, spec, (r) => ({
            from: r,
            data: { exit: r.code, requests: msgs(r).length },
            samples: { text: grep(r, /Failed to spawn runner|^tool_result/) },
          })).finally(() => rmSync(dir, { recursive: true, force: true }));
        },
      },
      // A `.invalid` name never resolves (RFC 6761), so the host check fails before a socket opens.
      one(
        "monitor-ws-unresolvable",
        {
          args: [
            "--permission-mode",
            "bypassPermissions",
            "--tools",
            "Monitor",
          ],
          stub: {
            seq: [
              {
                name: "Monitor",
                input: {
                  description: "probe",
                  ws: { url: "ws://cc-probe.invalid/" },
                },
              },
            ],
          },
        },
        /could not resolve/,
      ),
    ]),
};
