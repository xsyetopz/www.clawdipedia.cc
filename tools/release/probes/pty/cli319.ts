// 2.1.319 interactive probes: the SessionTabs keybinding context, the gated /project and /use-case commands, the tmux teammate errors, and the /loop keepalive.
import { join } from "node:path";

import { lines, log, tail, writeExec } from "./cli319/common.ts";
import { gatewayLogin, NOTICE } from "./cli319/gateway.ts";
import {
	ASK,
	ESC,
	PROMPT,
	type PtyCase,
	type PtyGroup,
	READY,
	shows,
	toolResultText,
} from "./harness.ts";

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
		keybindingLines: lines(x, /eybinding/u),
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
		screenTail: tail(x, 8),
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
		screenTail: tail(x, 6),
	}),
});

/** Only an interactive session builds the session team (print mode skips it), so a named Agent call reaches the tmux backend here. The stand-in tmux sits in the shim folder, first on PATH, and skips the `-L <socket>` the program puts before each command; `has` is the exit code of `has-session`. */
const tmuxSwarm = (name: string, has: number): PtyCase => ({
	id: `cli319.tmux-swarm-${name}`,
	setup: (sb) =>
		writeExec(
			join(sb.home, ".probe-bin", "tmux"),
			`#!/bin/sh\n[ "$1" = -L ] && shift 2\ncase "$1" in\n-V) echo "tmux 3.4";;\nhas-session) exit ${has};;\nnew-session|new-window) echo "probe: refused" >&2; exit 1;;\nesac\nexit 0\n`,
		),
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
		swarmLines: lines(x, /swarm|TmuxBackend|[Tt]eammate/u),
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
		{ t: 5, send: "\u001B[B", label: "down to Console" },
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
		keylessLines: lines(x, /Keyless|Cannot locate|config directory/u),
		screenTail: tail(x, 10),
	}),
};

/** The interactive side of the print case `cli319.plugin-dir-watch.*`: a `--plugin-dir` mod and its watch and type-root debug lines. */
const pluginDirWatch = (v?: string): PtyCase => ({
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
		typeRootLine: log(x).includes("type root of watchprobe at "),
		watchLine: log(x).includes("plugin-dir watch: watching "),
		lines: lines(x, /type root of|plugin-dir watch/u),
	}),
});

/** The keepalive arms only on a turn that a scheduled tick started, so the stub schedules one wakeup (60 s is the floor) and answers that tick with text only. */
const loopKeepalive = (v?: string): PtyCase => ({
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
		precondition: log(x).includes("[loop] dynamic wakeup scheduled"),
		keepaliveArmed: log(x).includes("[loop] keepalive armed"),
		loopLines: lines(x, /\[loop\]|loop_ended|ScheduleWakeup/u),
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
		loopKeepalive(),
		loopKeepalive("1"),
		loopKeepalive("0"),
		gatewayLogin(),
		gatewayLogin(NOTICE),
		pluginDirWatch(),
		pluginDirWatch("0"),
	],
};
