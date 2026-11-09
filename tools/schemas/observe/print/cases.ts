// The print-mode cases of observe/print.ts: the arguments, files, and scripted tool calls of each run.
import { PROMPT } from "../../../release/lib/env.ts";

export interface Case {
	id: string;
	args?: string[];
	env?: Record<string, string>;
	seq?: { name: string; input: unknown }[];
	cfgFiles?: Record<string, string>;
	projFiles?: Record<string, string>;
	git?: boolean;
	prompt?: string;
	/** Points the API base URL at a closed port: connection errors. */
	deadBase?: boolean;
}
const TOOLS = "Bash,Read,Write,Edit,Glob,Grep,Agent,Skill,TodoWrite";
const SEQ = [
	{ name: "Read", input: { file_path: "{PROJ}/a.txt" } },
	{ name: "Bash", input: { command: "echo hi" } },
	{ name: "Write", input: { file_path: "{PROJ}/b.txt", content: "x\n" } },
	{
		name: "Edit",
		input: { file_path: "{PROJ}/b.txt", old_string: "x", new_string: "y" },
	},
	{ name: "Glob", input: { pattern: "*.txt" } },
	{ name: "Grep", input: { pattern: "y", path: "{PROJ}" } },
	{ name: "Skill", input: { skill: "probe-skill" } },
	{
		name: "Agent",
		input: {
			description: "Probe task",
			prompt: PROMPT,
			subagent_type: "general-purpose",
		},
	},
];
const HOOKS = {
	hooks: Object.fromEntries(
		[
			"SessionStart",
			"UserPromptSubmit",
			"PreToolUse",
			"PostToolUse",
			"Stop",
		].map((e) => [e, [{ hooks: [{ type: "command", command: "echo ok" }] }]]),
	),
};
const FILES = {
	projFiles: { "a.txt": "a\n" },
	cfgFiles: {
		"settings.json": JSON.stringify(HOOKS),
		"skills/probe-skill/SKILL.md":
			"---\nname: probe-skill\ndescription: Probe skill.\n---\nBody.\n",
	},
};
const MCP = JSON.stringify({
	mcpServers: { bad: { command: "/usr/bin/false" } },
});
export const cases: Case[] = [
	{ id: "plain" },
	{ id: "api-error", deadBase: true, env: { CLAUDE_CODE_MAX_RETRIES: "1" } },
	{ id: "at-mention", prompt: "Read @a.txt", ...FILES },
	{ id: "compact", prompt: "/compact", seq: SEQ.slice(0, 1), ...FILES },
	{ id: "mcp", args: ["--mcp-config", MCP], ...FILES },
	{
		id: "commit",
		git: true,
		...FILES,
		args: ["--allowedTools", TOOLS],
		seq: [
			{
				name: "Bash",
				input: {
					command:
						"git -c user.name=t -c user.email=t@e.com commit --allow-empty -m x",
				},
			},
		],
	},
	{
		id: "tools-allowed",
		seq: SEQ,
		args: ["--allowedTools", TOOLS],
		...FILES,
		git: true,
	},
	{ id: "tools-denied", seq: SEQ, ...FILES },
	{
		id: "auto",
		seq: SEQ.slice(0, 3),
		args: ["--permission-mode", "auto"],
		...FILES,
	},
	{
		id: "traces",
		seq: SEQ.slice(0, 4),
		args: ["--allowedTools", TOOLS],
		...FILES,
		env: {
			CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
			OTEL_TRACES_EXPORTER: "otlp",
		},
	},
];
