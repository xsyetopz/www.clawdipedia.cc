// 2.1.319 interactive probes: the SessionTabs keybinding context, the gated /project and /use-case commands, the tmux teammate errors, and the /loop keepalive.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  ASK,
  ESC,
  PROMPT,
  type PtyCase,
  type PtyGroup,
  type PtyRun,
  READY,
  shows,
  toolResultText,
  WAIT,
} from "./harness.ts";

const log = (x: PtyRun): string => {
  const f = join(x.sb.cfg, "d.log");
  return existsSync(f) ? readFileSync(f, "utf8") : "";
};
const lines = (x: PtyRun, re: RegExp): string =>
  log(x)
    .split("\n")
    .filter((l) => re.test(l))
    .map((l) => l.replace(/^\S+\s/, "").slice(0, 300))
    .join("\n");

const keybinding = (
  name: string,
  context: string,
  action: string,
): PtyCase => ({
  id: `cli319.keybinding.${name}`,
  cfgFiles: {
    "keybindings.json": JSON.stringify({
      bindings: [{ context, bindings: { "ctrl+g": action } }],
    }),
  },
  args: ["--debug-file", "{CFG}/d.log"],
  schedule: [
    READY,
    { t: 1, send: "\u0007", label: "ctrl+g" },
    { t: 2, send: "\u0007", label: "ctrl+g again" },
    ESC(4),
  ],
  secs: 6,
  notes: `keybindings.json binds ctrl+g to ${action} in context ${context}; ctrl+g is pressed twice in a plain terminal session.`,
  data: (x) => ({
    precondition: log(x).length > 0 && shows(x, "shortcuts"),
    context,
    action,
    keybindingLines: lines(x, /eybinding/),
  }),
});

const slash = (cmd: string): PtyCase => ({
  id: `cli319.slash.${cmd}`,
  schedule: [
    READY,
    { t: 1, send: `/${cmd}`, label: "type" },
    { t: 3, send: "\r", label: "run" },
    ESC(6),
  ],
  secs: 8,
  notes: `/${cmd} typed in a session with the fake API key.`,
  data: (x) => ({
    precondition: shows(x, "shortcuts"),
    unknown: shows(x, `Unknown command: /${cmd}`),
    screenTail: x.screen
      .split("\n")
      .filter((l) => l.trim())
      .slice(-8)
      .join("\n"),
  }),
});

/** Typed but not run: the typeahead shows the description of each command that is enabled. */
const typeahead = (cmd: string): PtyCase => ({
  id: `cli319.typeahead.${cmd}`,
  schedule: [READY, { t: 1, send: `/${cmd}`, label: "type" }, ESC(4)],
  secs: 6,
  notes: `/${cmd} typed, not run, in a session with the fake API key.`,
  data: (x) => ({
    precondition: shows(x, "shortcuts"),
    screenTail: x.screen
      .split("\n")
      .filter((l) => l.trim())
      .slice(-6)
      .join("\n"),
  }),
});

/** Only an interactive session builds the session team (print mode skips it), so a named Agent call reaches the tmux backend here. The stand-in tmux sits in the shim folder, first on PATH, and skips the `-L <socket>` the program puts before each command; `has` is the exit code of `has-session`. */
const tmuxSwarm = (name: string, has: number): PtyCase => ({
  id: `cli319.tmux-swarm-${name}`,
  setup: (sb) => {
    const dir = join(sb.home, ".probe-bin");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "tmux"),
      `#!/bin/sh\n[ "$1" = -L ] && shift 2\ncase "$1" in\n-V) echo "tmux 3.4";;\nhas-session) exit ${has};;\nnew-session|new-window) echo "probe: refused" >&2; exit 1;;\nesac\nexit 0\n`,
    );
    chmodSync(join(dir, "tmux"), 0o755);
  },
  settings: { teammateMode: "tmux" },
  env: { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" },
  args: ["--debug-file", "{CFG}/d.log"],
  stub: {
    seq: [
      {
        name: "Agent",
        input: { description: "probe", prompt: PROMPT, name: "worker" },
      },
    ],
  },
  schedule: [READY, ASK()],
  secs: 16,
  notes: `teammateMode tmux, agent teams on, a stand-in tmux whose has-session exits ${has} and whose new-session and new-window fail; the stub calls Agent with a name.`,
  data: (x) => ({
    precondition: x.messages.length > 0,
    toolResultHead: toolResultText(x).trim().slice(0, 300),
    swarmLines: lines(x, /swarm|TmuxBackend|[Tt]eammate/),
  }),
});

/** The keyless Console sign-in of /login stores a profile under ANTHROPIC_CONFIG_DIR, else XDG_CONFIG_HOME, else HOME. All three are empty here; the program keeps its own config in CLAUDE_CONFIG_DIR. */
const consoleProfileNoDir: PtyCase = {
  id: "cli319.login-console-profile-no-dir",
  env: {
    HOME: "",
    XDG_CONFIG_HOME: "",
    ANTHROPIC_CONFIG_DIR: "",
  },
  allowOverride: ["HOME"],
  auth: "none",
  args: ["--debug-file", "{CFG}/d.log"],
  schedule: [
    READY,
    { t: 1, send: "/login", label: "type" },
    { t: 3, send: "\r", label: "run" },
    { t: 5, send: "\u001b[B", label: "down to Console" },
    { t: 6, send: "\r", label: "pick Console" },
    { t: 8, send: "\r", label: "pick the keyless sign-in" },
    ESC(12),
  ],
  secs: 14,
  notes:
    "/login, then Anthropic Console account, then the first (recommended) sign-in, with HOME, XDG_CONFIG_HOME, and ANTHROPIC_CONFIG_DIR empty and no API key (a set key refuses the keyless sign-in first).",
  data: (x) => ({
    precondition: shows(x, "Anthropic Console account"),
    fallbackNotice: shows(x, "no Anthropic config directory was found"),
    keylessLines: lines(x, /Keyless|Cannot locate|config directory/),
    screenTail: x.screen
      .split("\n")
      .filter((l) => l.trim())
      .slice(-10)
      .join("\n"),
  }),
};

/**
 * The gateway sign-in of /login, against a stand-in gateway on localhost (plain HTTP is allowed there). It answers
 * discovery, then `device_authorization` with a `login_notice`, then keeps the token poll pending. BROWSER is a shim
 * that records the page the program opens. The real gateway's own answer is the print case `api319.gateway.login-notice-served`.
 */
const NOTICE = "Call IT now and ask for a code";
let gatewayStub: ReturnType<typeof Bun.serve> | undefined;
const gatewayLogin = (notice: string | undefined): PtyCase => ({
  id: `cli319.gateway-login-notice.${notice === undefined ? "unset" : "set"}`,
  auth: "none",
  args: ["--debug-file", "{CFG}/d.log"],
  setup: (sb) => {
    const hits: string[] = [];
    gatewayStub = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: (req) => {
        const u = new URL(req.url);
        hits.push(`${req.method} ${u.pathname}`);
        writeFileSync(join(sb.home, "gateway-hits.txt"), hits.join("\n"));
        if (u.pathname === "/oauth/device_authorization")
          return Response.json({
            device_code: "probe-device-code",
            user_code: "PRBE-CODE",
            verification_uri: `${u.origin}/device`,
            expires_in: 600,
            interval: 5,
            ...(notice === undefined ? {} : { login_notice: notice }),
          });
        if (u.pathname === "/oauth/token")
          return Response.json(
            { error: "authorization_pending" },
            { status: 400 },
          );
        return Response.json({});
      },
    });
    const bin = join(sb.home, ".probe-bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, "browser"),
      `#!/bin/sh\nprintf '%s\\n' "$@" >> "${sb.home}/browser-opened.txt"\n`,
    );
    chmodSync(join(bin, "browser"), 0o755);
    writeFileSync(
      join(sb.cfg, "settings.json"),
      JSON.stringify({
        forceLoginMethod: "gateway",
        forceLoginGatewayUrl: `http://127.0.0.1:${gatewayStub.port}`,
      }),
    );
  },
  env: { BROWSER: "{HOME}/.probe-bin/browser" },
  schedule: [
    READY,
    { t: 1, send: "/login", label: "type" },
    { t: 3, send: "\r", label: "run" },
    WAIT("gateway", "gateway sign-in", 10),
    { t: 1, send: "\r", label: "sign in" },
    { ...WAIT("Trust", "trust prompt", 10), rebase: true },
    // the prompt starts on "No, cancel login"
    { t: 1, send: "\u001b[A", label: "up to trust" },
    { t: 2, send: "\r", label: "trust" },
    { ...WAIT("PRBE-CODE", "code shown", 10), rebase: true },
    ESC(3),
  ],
  secs: 40,
  notes: `forceLoginMethod gateway and forceLoginGatewayUrl in user settings, no API key; /login, Enter on the gateway sign-in, Up and Enter on the trust prompt. The stand-in gateway's device_authorization ${notice === undefined ? "has no login_notice" : `has login_notice "${notice}"`}.`,
  data: (x) => {
    gatewayStub?.stop(true);
    return {
      precondition: shows(x, "PRBE-CODE"),
      noticeShown: shows(x, NOTICE),
      gatewayHits: x.file("gateway-hits.txt"),
      browserOpened: x
        .file("browser-opened.txt")
        .replace(/:\d+/, ":<port>")
        .trim(),
      screenTail: x.screen
        .split("\n")
        .filter((l) => l.trim())
        .slice(-14)
        .join("\n"),
      gatewayLines: lines(x, /\[gateway/),
    };
  },
  samples: (x) => ({
    screen: x.screen
      .split("\n")
      .filter((l) => l.trim())
      .join("\n")
      .slice(-2900),
  }),
});

/** The interactive side of the print case `cli319.plugin-dir-watch.*`: a `--plugin-dir` mod and its watch and type-root debug lines. */
const pluginDirWatch = (v: string | undefined): PtyCase => ({
  id: `cli319.plugin-dir-watch.${v === undefined ? "unset" : `v${v}`}`,
  env: v === undefined ? {} : { CLAUDE_CODE_PLUGIN_DIR_WATCH: v },
  homeFiles: {
    "plug/.claude-plugin/plugin.json": JSON.stringify({
      name: "watchprobe",
      version: "1.0.0",
    }),
    "plug/hooks/hooks.json": JSON.stringify({ modules: ["./register.ts"] }),
    "plug/hooks/register.ts": "export const register = () => {};\n",
  },
  args: ["--plugin-dir", "{HOME}/plug", "--debug-file", "{CFG}/d.log"],
  schedule: [READY, ESC(4)],
  secs: 6,
  notes: `An interactive session with --plugin-dir and CLAUDE_CODE_PLUGIN_DIR_WATCH ${v ?? "unset"}.`,
  data: (x) => ({
    precondition: shows(x, "shortcuts") && log(x).length > 0,
    typesWritten: x.file("plug/.claude-plugin/types/tsconfig.json") !== "",
    typeRootLine: /type root of watchprobe at /.test(log(x)),
    watchLine: /plugin-dir watch: watching /.test(log(x)),
    lines: lines(x, /type root of|plugin-dir watch/),
  }),
});

/** The keepalive arms only on a turn that a scheduled tick started, so the stub schedules one wakeup (60 s is the floor) and answers that tick with text only. */
const loopKeepalive = (v: string | undefined): PtyCase => ({
  id: `cli319.loop-keepalive.${v === undefined ? "unset" : `v${v}`}`,
  env: v === undefined ? {} : { CLAUDE_CODE_LOOP_KEEPALIVE: v },
  args: ["--debug-file", "{CFG}/d.log"],
  stub: {
    seq: [
      {
        name: "ScheduleWakeup",
        input: {
          delaySeconds: 60,
          reason: "Probe wakeup.",
          prompt: "/loop check the build",
          // 2.1.316 refuses the call without it; 2.1.319 makes it optional
          noop: false,
        },
      },
    ],
  },
  schedule: [
    READY,
    { t: 1, send: "/loop check the build", label: "type" },
    { t: 3, send: "\r", label: "run" },
    ESC(150),
  ],
  secs: 155,
  notes: `/loop with no interval (self-paced), CLAUDE_CODE_LOOP_KEEPALIVE ${v ?? "unset"}; the stub calls ScheduleWakeup once with 60 s, then replies with text only, also to the tick.`,
  data: (x) => ({
    precondition: /\[loop\] dynamic wakeup scheduled/.test(log(x)),
    keepaliveArmed: /\[loop\] keepalive armed/.test(log(x)),
    loopLines: lines(x, /\[loop\]|loop_ended|ScheduleWakeup/),
  }),
});

export const cli319Group: PtyGroup = {
  id: "cli319",
  title:
    "2.1.319 SessionTabs keybinding, /project and /use-case, tmux teammates, keyless Console sign-in, /loop keepalive",
  cases: () => [
    keybinding("session-tabs", "SessionTabs", "app:closeSession"),
    keybinding("control-bad-action", "SessionTabs", "app:noSuchAction"),
    keybinding("control-bad-context", "NoSuchContext", "app:closeSession"),
    slash("project"),
    slash("use-case"),
    slash("upgrade"),
    typeahead("upgrade"),
    typeahead("use-case"),
    tmuxSwarm("session", 1),
    tmuxSwarm("window", 0),
    consoleProfileNoDir,
    loopKeepalive(undefined),
    loopKeepalive("1"),
    loopKeepalive("0"),
    gatewayLogin(undefined),
    gatewayLogin(NOTICE),
    pluginDirWatch(undefined),
    pluginDirWatch("0"),
  ],
};
