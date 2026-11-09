// 2.1.319 probes: disableReplyCheck, the theme.set and theme.clear calls of a mod.
import { chromeTools, sub } from "./cli319/chrome.ts";
import { cowork, dirWatch, themeMod } from "./cli319/plugins.ts";
import { replyCheck, st, sweep } from "./cli319/settings.ts";
import { type CaseDef, runCases } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const ATTR = /ttribution|nvalid|expected/u;

const CASES: CaseDef[] = [
	themeMod(),
	dirWatch(),
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
		/isableWindowsBash|only honored|ignored/u,
	),
	st(
		"dwb.bad-type",
		{ disableWindowsBashCommandSplit: "yes" },
		/isableWindowsBash|nvalid|expected/u,
	),
	st("attr.claude-proj", { attributionProject: "claude_proj_01abc" }, ATTR),
	st("attr.chan", { attributionProject: "chan_abc" }, ATTR),
	st("attr.bad-prefix", { attributionProject: "foo_123" }, ATTR),
	st("attr.number", { attributionProject: 123 }, ATTR),
	st(
		"cleanup.zero",
		{ cleanupPeriodDays: 0 },
		/cleanupPeriodDays|nvalid|too_small|at least/u,
	),
	st(
		"cleanup.float",
		{ cleanupPeriodDays: 1.5 },
		/cleanupPeriodDays|nvalid|integer/u,
	),
	sweep(7),
	sweep(365),
	sweep(),
	st(
		"plugin-sugg.user",
		{ pluginSuggestionMarketplaces: ["acme"] },
		/uggestion|only honored|ignored/u,
	),
	st(
		"plugin-sugg.bad-type",
		{ pluginSuggestionMarketplaces: "acme" },
		/uggestion|nvalid|expected/u,
	),
	st(
		"ssh.valid",
		{ sshHostCommands: [{ id: "a", name: "A", command: "/usr/bin/true" }] },
		/sshHost|nvalid|expected/u,
	),
	st(
		"ssh.bad",
		{ sshHostCommands: [{ id: "a", name: "A" }] },
		/sshHost|nvalid|expected|required/u,
	),
	st("ssh.not-array", { sshHostCommands: "x" }, /sshHost|nvalid|expected/u),
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
];

export const cli319: PrintGroup = {
	id: "cli319",
	title: "2.1.319: disableReplyCheck, theme calls",
	run: (ctx) => runCases(ctx, "cli319", CASES),
};
