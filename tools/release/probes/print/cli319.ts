// 2.1.319 probes: disableReplyCheck, the theme.set and theme.clear calls of a mod.
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  type CaseDef,
  json,
  msgs,
  readCfg,
  runCases,
  withRun,
} from "./run/helpers.ts";
import { listFiles } from "./run.ts";
import type { PrintGroup } from "./types.ts";

/** A reply gate policy the program accepts (fields from the schema in the program). */
const POLICY = json({
  terminal_tools: ["reply"],
  ask_text: "Reply please.",
  max_asks_after_person: 1,
  max_asks_after_server_event: 1,
});
/** The machine-wide managed file. Only this path (or the root-owned plist) is a vouched tier on macOS in this build. */
const ROOT_FILE =
  "/Library/Application Support/ClaudeCode/managed-settings.json";
const replyCheck = (where: "user" | "managed-root"): CaseDef => ({
  name: `reply-check.${where}`,
  ...(where === "managed-root"
    ? {
        requires: {
          path: ROOT_FILE,
          reason: "needs the root-owned managed file (create it with sudo)",
        },
      }
    : {}),
  run: (ctx) =>
    withRun(
      ctx,
      {
        env: { CLAUDE_CODE_REPLY_GATE_POLICY: POLICY },
        cfgFiles:
          where === "user"
            ? { "settings.json": json({ disableReplyCheck: true }) }
            : {},
        args: ["--debug-file", "{CFG}/d.log"],
      },
      (r) => {
        const d = readCfg(r, "d.log");
        const lines = d.split("\n").filter((l) => /reply|Reply/.test(l));
        return {
          from: r,
          data: {
            precondition: msgs(r).length > 0 && d.length > 0,
            rootFileHolds: where === "managed-root" && existsSync(ROOT_FILE),
            accepted: /CLAUDE_CODE_REPLY_GATE_POLICY accepted/.test(d),
            ignoredWarning: /disableReplyCheck is ignored in/.test(d),
            gateSkipped: /Reply gate: verdict=skip why=disableReplyCheck/.test(
              d,
            ),
          },
          samples: {
            replyLines: lines
              .slice(0, 6)
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 300))
              .join("\n"),
          },
        };
      },
    ),
});

/** A mod that calls the four theme functions at session.start and logs each answer to the debug log. */
const THEME_MOD = `export const register = (on) => {
  on("session.start", async ($, e, next) => {
    const t = async (label, f) => {
      let out;
      try { out = { ok: await f() }; } catch (x) { out = { err: String(x && x.message) }; }
      $.ui.log("THEME " + label + " " + JSON.stringify(out), { to: "debug" });
    };
    await t("clear-first", () => $.theme.clear());
    await t("set", () => $.theme.set({ backdrop: { id: "lagoon", glass: { blur: 14, opacity: 0.55 }, colorScheme: "dark" } }));
    await t("set-again", () => $.theme.set({ backdrop: { id: "lagoon", glass: { blur: 14, opacity: 0.55 }, colorScheme: "dark" } }));
    await t("clear", () => $.theme.clear());
    await t("clear-twice", () => $.theme.clear());
    await t("bad-attr", () => $.theme.set({ palette: {} }));
    await t("no-backdrop", () => $.theme.set({}));
    await t("bad-blur", () => $.theme.set({ backdrop: { id: "a", glass: { blur: 99 } } }));
    await t("bad-scheme", () => $.theme.set({ backdrop: { id: "a", colorScheme: "grey" } }));
    await t("bad-id", () => $.theme.set({ backdrop: { id: "a b" } }));
    return next(e);
  });
};
`;

const themeMod = (): CaseDef => ({
  name: "theme.engine",
  run: (ctx) =>
    withRun(
      ctx,
      {
        homeFiles: {
          "plug/.claude-plugin/plugin.json": json({
            name: "themeprobe",
            version: "1.0.0",
          }),
          "plug/hooks/hooks.json": json({ modules: ["./register.ts"] }),
          "plug/hooks/register.ts": THEME_MOD,
        },
        args: ["--plugin-dir", "{HOME}/plug", "--debug-file", "{CFG}/d.log"],
      },
      (r) => {
        const d = readCfg(r, "d.log");
        const lines = d.split("\n").filter((l) => /THEME |themeprobe/.test(l));
        return {
          from: r,
          data: {
            precondition:
              msgs(r).length > 0 && lines.some((l) => /THEME /.test(l)),
          },
          samples: {
            lines: lines
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 400))
              .join("\n"),
          },
        };
      },
    ),
});

/** A `--plugin-dir` mod in print mode: the files the program adds to the mod's folder, and its watch and type-root debug lines. */
const dirWatch = (v: string | undefined): CaseDef => ({
  name: `plugin-dir-watch.${v === undefined ? "unset" : `v${v}`}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        env: v === undefined ? {} : { CLAUDE_CODE_PLUGIN_DIR_WATCH: v },
        homeFiles: {
          "plug/.claude-plugin/plugin.json": json({
            name: "watchprobe",
            version: "1.0.0",
          }),
          "plug/hooks/hooks.json": json({ modules: ["./register.ts"] }),
          "plug/hooks/register.ts": "export const register = () => {};\n",
        },
        args: ["--plugin-dir", "{HOME}/plug", "--debug-file", "{CFG}/d.log"],
      },
      (r) => {
        const d = readCfg(r, "d.log");
        const added = listFiles(join(r.sb.home, "plug")).filter(
          (f) => !/^(\.claude-plugin\/plugin\.json|hooks\/.*)$/.test(f),
        );
        return {
          from: r,
          data: {
            precondition: msgs(r).length > 0 && d.length > 0,
            added,
            typeRootLine: /type root of watchprobe at /.test(d),
            watchLine: /plugin-dir watch: watching /.test(d),
          },
          samples: {
            lines: d
              .split("\n")
              .filter((l) => /type root of|plugin-dir watch/.test(l))
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 400))
              .join("\n"),
          },
        };
      },
    ),
});

const cowork = (name: string, env: Record<string, string>): CaseDef => ({
  name: `cowork-plugin.${name}`,
  run: (ctx) =>
    withRun(ctx, { env }, (r) => {
      const listed = r.reqs.some((q) =>
        /cowork-plugin/.test(JSON.stringify(q.body)),
      );
      return {
        from: r,
        data: {
          precondition: r.reqs.length > 0,
          env: Object.keys(env).join(","),
          listed,
        },
      };
    }),
});

/** A subcommand run: records the first lines the program prints. */
const sub = (name: string, argv: string[]): CaseDef => ({
  name,
  run: (ctx) =>
    withRun(ctx, { argv }, (r) => ({
      from: r,
      data: { exit: r.code },
      samples: {
        out: r.stdout.split("\n").slice(0, 4).join("\n").slice(0, 600),
        err: r.stderr.split("\n").slice(0, 4).join("\n").slice(0, 600),
      },
    })),
});

/** A run with settings in the user file; records the debug lines that match `re` and the request count. */
const st = (
  name: string,
  settings: unknown,
  re: RegExp,
  more: {
    env?: Record<string, string>;
    cfgFiles?: Record<string, string>;
  } = {},
): CaseDef => ({
  name,
  run: (ctx) =>
    withRun(
      ctx,
      {
        cfgFiles: { "settings.json": json(settings), ...(more.cfgFiles ?? {}) },
        ...(more.env ? { env: more.env } : {}),
        args: ["--debug-file", "{CFG}/d.log"],
      },
      (r) => {
        const d = readCfg(r, "d.log");
        return {
          from: r,
          data: { precondition: msgs(r).length > 0 && d.length > 0 },
          samples: {
            lines: d
              .split("\n")
              .filter((l) => re.test(l))
              .slice(0, 8)
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 400))
              .join("\n"),
          },
        };
      },
    ),
});

/** Two transcripts, one 40 days old and one new; cleanupPeriodDays 7 removes the old one. */
const sweep = (days: number | undefined): CaseDef => ({
  name: `cleanup.sweep-${days ?? "default"}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        cfgFiles:
          days === undefined
            ? {}
            : { "settings.json": json({ cleanupPeriodDays: days }) },
        // The sweep starts 5 s after launch, so a tool call that sleeps keeps the run alive.
        args: ["--debug-file", "{CFG}/d.log", "--allowedTools", "Bash"],
        stub: { seq: [{ name: "Bash", input: { command: "sleep 9" } }] },
        setup: (sb) => {
          const dir = `${sb.cfg}/projects/${realpathSync(sb.proj).replace(/[^A-Za-z0-9]/g, "-")}`;
          mkdirSync(dir, { recursive: true });
          for (const [n, age] of [
            ["old", 40],
            ["new", 0],
          ] as const) {
            const f = `${dir}/${n === "old" ? "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f41" : "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f42"}.jsonl`;
            writeFileSync(
              f,
              '{"type":"user","message":{"role":"user","content":"hi"},"uuid":"u1","sessionId":"x"}\n',
            );
            const t = new Date(Date.now() - age * 86400000);
            utimesSync(f, t, t);
          }
        },
      },
      (r) => {
        const dir = `${r.sb.cfg}/projects/${realpathSync(r.sb.proj).replace(/[^A-Za-z0-9]/g, "-")}`;
        const left = readdirSync(dir).filter((f) =>
          /41\.jsonl$|42\.jsonl$/.test(f),
        );
        const d = readCfg(r, "d.log");
        return {
          from: r,
          data: {
            precondition: msgs(r).length > 0,
            oldKept: left.some((f) => f.endsWith("41.jsonl")),
            newKept: left.some((f) => f.endsWith("42.jsonl")),
          },
          samples: {
            lines: d
              .split("\n")
              .filter((l) => /cleanup|retention|sweep/i.test(l))
              .slice(0, 8)
              .map((l) => l.replace(/^\S+\s/, "").slice(0, 300))
              .join("\n"),
          },
        };
      },
    ),
});

/** The built-in browser server (`--claude-in-chrome-mcp`, the flag the program starts it with) over stdio, with no extension: its tool list, and the answer to one call. */
const rpc = (id: number, method: string, params: unknown): string =>
  `${json({ jsonrpc: "2.0", id, method, params })}\n`;
const chromeTools = (tool: string): CaseDef => ({
  name: `chrome-tools.${tool}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        argv: ["--claude-in-chrome-mcp"],
        stdin:
          rpc(1, "initialize", {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "probe", version: "0" },
          }) +
          `${json({ jsonrpc: "2.0", method: "notifications/initialized" })}\n` +
          rpc(2, "tools/list", {}) +
          rpc(3, "tools/call", { name: tool, arguments: {} }),
        stdinOpenMs: 8000,
        timeoutMs: 30_000,
      },
      (r) => {
        const replies = r.stdout
          .split("\n")
          .filter((l) => l.startsWith("{"))
          .map(
            (l) =>
              JSON.parse(l) as {
                id?: number;
                result?: { tools?: { name: string }[] };
                error?: unknown;
              },
          );
        const names = (
          replies.find((m) => m.id === 2)?.result?.tools ?? []
        ).map((t) => t.name);
        return {
          from: r,
          data: {
            precondition: names.includes("tabs_context_mcp"),
            tools: names.join(","),
            shortcutsListed: names.some((n) => n.startsWith("shortcuts_")),
          },
          samples: {
            call: json(replies.find((m) => m.id === 3) ?? null).slice(0, 500),
          },
        };
      },
    ),
});

export const cli319: PrintGroup = {
  id: "cli319",
  title: "2.1.319: disableReplyCheck, theme calls",
  run: (ctx) =>
    runCases(ctx, "cli319", [
      themeMod(),
      dirWatch(undefined),
      dirWatch("1"),
      dirWatch("0"),
      chromeTools("shortcuts_list"),
      chromeTools("tabs_context_mcp"),
      cowork("none", {}),
      cowork("env", { CLAUDE_CODE_COWORK_PLUGIN_SKILL: "1" }),
      cowork("env-child", {
        CLAUDE_CODE_COWORK_PLUGIN_SKILL: "1",
        CLAUDECODE: "1",
      }),
      replyCheck("user"),
      replyCheck("managed-root"),
      st(
        "dwb.user",
        { disableWindowsBashCommandSplit: true },
        /isableWindowsBash|only honored|ignored/,
      ),
      st(
        "dwb.bad-type",
        { disableWindowsBashCommandSplit: "yes" },
        /isableWindowsBash|nvalid|expected/,
      ),
      st(
        "attr.claude-proj",
        { attributionProject: "claude_proj_01abc" },
        /ttribution|nvalid|expected/,
      ),
      st(
        "attr.chan",
        { attributionProject: "chan_abc" },
        /ttribution|nvalid|expected/,
      ),
      st(
        "attr.bad-prefix",
        { attributionProject: "foo_123" },
        /ttribution|nvalid|expected/,
      ),
      st(
        "attr.number",
        { attributionProject: 123 },
        /ttribution|nvalid|expected/,
      ),
      st(
        "cleanup.zero",
        { cleanupPeriodDays: 0 },
        /cleanupPeriodDays|nvalid|too_small|at least/,
      ),
      st(
        "cleanup.float",
        { cleanupPeriodDays: 1.5 },
        /cleanupPeriodDays|nvalid|integer/,
      ),
      sweep(7),
      sweep(365),
      sweep(undefined),
      st(
        "plugin-sugg.user",
        { pluginSuggestionMarketplaces: ["acme"] },
        /uggestion|only honored|ignored/,
      ),
      st(
        "plugin-sugg.bad-type",
        { pluginSuggestionMarketplaces: "acme" },
        /uggestion|nvalid|expected/,
      ),
      st(
        "ssh.valid",
        { sshHostCommands: [{ id: "a", name: "A", command: "/usr/bin/true" }] },
        /sshHost|nvalid|expected/,
      ),
      st(
        "ssh.bad",
        { sshHostCommands: [{ id: "a", name: "A" }] },
        /sshHost|nvalid|expected|required/,
      ),
      st("ssh.not-array", { sshHostCommands: "x" }, /sshHost|nvalid|expected/),
      sub("ultrareview-max-cost", ["ultrareview", "--max-cost", "1"]),
      sub("ultrareview-list", ["ultrareview", "--list", "prs.txt"]),
      sub("ultrareview-output", ["ultrareview", "--output", "out.json"]),
      sub("mcp-add-web", [
        "mcp",
        "add",
        "--web",
        "probe",
        "https://probe.invalid/mcp",
      ]),
    ]),
};
