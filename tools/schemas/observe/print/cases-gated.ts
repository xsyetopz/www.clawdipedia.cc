// Print-mode cases behind a cached feature flag, an environment variable, stream-JSON input, an MCP server, or a tool.
import type { Case } from "./case.ts";

// The disk cache of feature flags is read with telemetry off only when this variable is set.
const DISK_FLAGS = { CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1" };
const flags = (f: Record<string, boolean>): Record<string, unknown> => ({
	cachedGrowthBookFeatures: f,
});
const DATA_FLOW = flags({ tengu_pewter_grebe: true });

// A server_tool_use whose name fails the name check makes the data-flow recorder mark the loop incomplete.
const BAD_SERVER_TOOL = {
	kind: "message" as const,
	content: [
		{
			type: "server_tool_use",
			id: "srvtoolu_probe",
			name: "bad name",
			input: {},
		},
		{ type: "text", text: "done" },
	],
	stop_reason: "end_turn",
};

// A stdio MCP server with one tool and no annotations, and a permission tool that denies every call.
const MCP_JS = [
	'let buf = "";',
	'process.stdin.on("data", (d) => {',
	"\tbuf += d;",
	"\tfor (let i = buf.indexOf('\\n'); i >= 0; i = buf.indexOf('\\n')) {",
	"\t\tconst line = buf.slice(0, i);",
	"\t\tbuf = buf.slice(i + 1);",
	"\t\tif (line.trim() === '') continue;",
	"\t\tconst m = JSON.parse(line);",
	"\t\tif (m.id === undefined) continue;",
	"\t\tconst tools = [",
	"\t\t\t{ name: 't1', description: 'd', inputSchema: { type: 'object', properties: {} } },",
	"\t\t\t{ name: 'deny', description: 'd', inputSchema: { type: 'object', properties: {} } },",
	"\t\t];",
	"\t\tconst text = m.params?.name === 'deny' ? JSON.stringify({ behavior: 'deny', message: 'probe' }) : 'ok';",
	"\t\tconst result =",
	"\t\t\tm.method === 'initialize'",
	"\t\t\t\t? { protocolVersion: m.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 's', version: '1' } }",
	"\t\t\t\t: m.method === 'tools/list'",
	"\t\t\t\t\t? { tools }",
	"\t\t\t\t\t: m.method === 'tools/call'",
	"\t\t\t\t\t\t? { content: [{ type: 'text', text }] }",
	"\t\t\t\t\t\t: {};",
	"\t\tprocess.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: m.id, result }) + '\\n');",
	"\t}",
	"});",
	"",
].join("\n");
const MCP_ARGS = [
	"--mcp-config",
	JSON.stringify({
		mcpServers: { s: { command: "bun", args: ["{PROJ}/mcp.js"] } },
	}),
];

const SKILL = (extra: string): string =>
	`---\nname: x\ndescription: Probe skill.\n${extra}---\nSay OK.\n`;

const PROMPT_UUID = "11111111-1111-4111-8111-111111111111";

/** The cases that need a gate opened before the program writes their rows. */
export const GATED_CASES: Case[] = [
	{
		// data-flow-records with a record, and data-flow-incomplete for the main loop and for an agent
		id: "data-flow",
		claudeJson: DATA_FLOW,
		env: DISK_FLAGS,
		args: ["--dangerously-skip-permissions"],
		rules: [{ match: "SUBPROMPT", reply: BAD_SERVER_TOOL }],
		turns: [
			{
				kind: "message",
				content: [
					{
						type: "tool_use",
						id: "toolu_agent",
						name: "Agent",
						input: {
							description: "d",
							prompt: "SUBPROMPT",
							subagent_type: "general-purpose",
							run_in_background: false,
						},
					},
				],
				stop_reason: "tool_use",
			},
			BAD_SERVER_TOOL,
		],
	},
	{
		// derived-from: the sessions that launched this one, from the environment
		id: "derived-from",
		claudeJson: DATA_FLOW,
		env: {
			...DISK_FLAGS,
			CLAUDECODE: "1",
			CLAUDE_CODE_SESSION_ID: "11111111-2222-4333-8444-555555555555",
			CLAUDE_CODE_LAUNCHED_BY_SESSION_IDS:
				"clear:aaaaaaaa-2222-4333-8444-555555555555,bbbbbbbb-2222-4333-8444-555555555555,junk",
		},
	},
	{
		// a rewind by control request: last-prompt.explicit
		id: "rewind-explicit",
		stdin: [
			{
				type: "user",
				uuid: PROMPT_UUID,
				message: { role: "user", content: "hello one" },
			},
			{
				type: "control_request",
				request_id: "r1",
				request: {
					subtype: "rewind_conversation",
					target_message_uuid: PROMPT_UUID,
					last_seen_user_message_uuid: PROMPT_UUID,
					interrupt_if_running: true,
				},
			},
		],
	},
	{
		// an interrupt while one Bash call runs and a second waits its turn: user.toolDenialBeforeRun on the second
		id: "interrupt-queued-tool",
		args: ["--allowedTools", "Bash"],
		stdin: [
			{ type: "user", message: { role: "user", content: "hello" } },
			2500,
			{
				type: "control_request",
				request_id: "r1",
				request: { subtype: "interrupt" },
			},
		],
		turns: [
			{
				kind: "message",
				content: [
					{
						type: "tool_use",
						id: "toolu_slow",
						name: "Bash",
						input: { command: "sleep 5" },
					},
					{
						type: "tool_use",
						id: "toolu_queued",
						name: "Bash",
						input: { command: "touch b" },
					},
				],
				stop_reason: "tool_use",
			},
		],
	},
	{
		// two observer agents on the main agent: observer-ref.observerTaskIds
		id: "observer-agents",
		env: { CLAUDE_CODE_EXPERIMENTAL_OBSERVER_AGENTS: "1" },
		args: [
			"--agent",
			"obsmain",
			"--dangerously-skip-permissions",
			"--agents",
			JSON.stringify({
				obsmain: { description: "m", prompt: "main", observer: "oa,ob" },
				oa: { description: "a", prompt: "watch a" },
				ob: { description: "b", prompt: "watch b" },
			}),
		],
	},
	{
		// EnterWorktree from the project root: worktree-state.worktreeSession.extensionRoot
		id: "enter-worktree",
		git: true,
		// a worktree needs a commit to branch from
		commit: true,
		args: ["--dangerously-skip-permissions"],
		seq: [
			{
				name: "ToolSearch",
				input: { query: "select:EnterWorktree", max_results: 3 },
			},
			{ name: "EnterWorktree", input: { name: "wt1" } },
		],
	},
	{
		// an extra body the journal cannot record: assistant.requestNotRecorded
		id: "extra-body",
		env: { CLAUDE_CODE_EXTRA_BODY: JSON.stringify({ system: "x" }) },
	},
	{
		// an extra body key the journal can leave out of the row: api-request.withheld lists it
		id: "extra-body-withheld",
		env: { CLAUDE_CODE_EXTRA_BODY: JSON.stringify({ top_k: 5 }) },
	},
	{
		// a skill typed as a command: user.invokedSkill
		id: "invoked-skill",
		claudeJson: flags({ tengu_soft_spark: true }),
		env: DISK_FLAGS,
		projFiles: { ".claude/skills/x/SKILL.md": SKILL("") },
		prompt: "/x",
	},
	{
		// the model calls a skill only the user may type: user.toolResultTypedCommand
		id: "typed-command-skill",
		projFiles: {
			".claude/skills/x/SKILL.md": SKILL("disable-model-invocation: true\n"),
		},
		args: ["--allowedTools", "Skill"],
		seq: [{ name: "Skill", input: { skill: "x" } }],
	},
	{
		// an MCP tool with no read-only hint: user.mcpCallNotReadOnly
		id: "mcp-no-hint",
		projFiles: { "mcp.js": MCP_JS },
		args: [...MCP_ARGS, "--allowedTools", "mcp__s__t1"],
		// MCP tools are deferred: ToolSearch loads the tool first
		seq: [
			{
				name: "ToolSearch",
				input: { query: "select:mcp__s__t1", max_results: 3 },
			},
			{ name: "mcp__s__t1", input: {} },
		],
	},
	{
		// a permission tool that denies: user.holdsPersonsWords
		id: "permission-tool-deny",
		projFiles: { "mcp.js": MCP_JS },
		args: [...MCP_ARGS, "--permission-prompt-tool", "mcp__s__deny"],
		// a command that writes, so the program asks the permission tool
		seq: [{ name: "Bash", input: { command: "touch probe" } }],
	},
];
