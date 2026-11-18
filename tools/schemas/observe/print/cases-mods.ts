// Print-mode cases driven by a mod: a plugin loaded with --plugin-dir whose hooks/hooks.json names a module.
import type { Case } from "./case.ts";

/** The files of a mod under mod/ whose `register(on)` body is `body`. */
const mod = (body: string[]): Record<string, string> => ({
	"mod/.claude-plugin/plugin.json": JSON.stringify({
		name: "probe-mod",
		version: "1.0.0",
		description: "Probe mod.",
	}),
	"mod/hooks/hooks.json": JSON.stringify({ modules: ["./register.js"] }),
	"mod/hooks/register.js": [
		"export const register = (on) => {",
		...body.map((l) => `\t${l}`),
		"};",
		"",
	].join("\n"),
});

const MOD_ARGS = ["--plugin-dir", "{PROJ}/mod"];

// A whole Messages API answer, as an http.fetch hook gives it in place of the request.
const ANSWER = JSON.stringify({
	id: "msg_hook",
	type: "message",
	role: "assistant",
	model: "claude-opus-5-5",
	content: [{ type: "text", text: "OK" }],
	stop_reason: "end_turn",
	stop_sequence: null,
	usage: { input_tokens: 1, output_tokens: 1 },
});

/** The cases whose effect comes from a mod hook. */
export const MOD_CASES: Case[] = [
	{
		// a plugin model call: the cost-state row adds modelCallCostUSD
		id: "mod-model-call",
		projFiles: mod([
			'on("classic.UserPromptSubmit", async ($) => {',
			'\tawait $.model.complete({ model: "claude-sonnet-4-5", prompt: "probe" });',
			"\treturn {};",
			"});",
		]),
		args: MOD_ARGS,
	},
	{
		// a command answered by a hook as display-only text: system.isDisplayOnly
		id: "mod-display-only",
		projFiles: mod([
			'on("command.run", () => ({ text: "probe", isTextDisplayOnly: true }));',
		]),
		args: MOD_ARGS,
		prompt: "/context",
	},
	{
		// a model request answered by an http.fetch hook: assistant.requestHookChanged.what = ["answered"]
		id: "mod-fetch-answer",
		projFiles: mod([
			'on("http.fetch", () => ({',
			`\tvalue: { status: 200, headers: { "content-type": "application/json" }, text: ${JSON.stringify(ANSWER)} },`,
			"}));",
		]),
		args: MOD_ARGS,
	},
	{
		// a plugin's own row: the plugin_note attachment with plugin and rowUuid
		id: "mod-session-note",
		projFiles: mod([
			'on("classic.UserPromptSubmit", async ($) => {',
			'\tawait $.session.append({ message: { type: "user", content: [{ type: "text", text: "probe" }] } });',
			"\treturn {};",
			"});",
		]),
		args: MOD_ARGS,
		seq: [{ name: "Bash", input: { command: "true" } }],
	},
	{
		// a tool.call hook that refuses while the tool runs, before it has a result: user.toolDenialAfterRun.
		// A refusal after the result exists withholds the result instead, with no denial kind.
		id: "mod-deny-after-run",
		projFiles: mod([
			'on("tool.call", async ($, e, next) => {',
			"\tnext(e).catch(() => undefined);",
			"\tawait new Promise((r) => setTimeout(r, 500));",
			'\treturn { deny: "probe" };',
			"});",
		]),
		args: [...MOD_ARGS, "--allowedTools", "Bash"],
		seq: [{ name: "Bash", input: { command: "sleep 2" } }],
	},
];
