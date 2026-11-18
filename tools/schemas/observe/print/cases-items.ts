// Print-mode cases that write an array field with at least one item, so the item shape can be compared with the hand-typed schema.
import type { Case } from "./case.ts";

const settings = (o: object): Record<string, string> => ({
	"settings.json": JSON.stringify(o),
});

// A stdio MCP server with one permission tool, `perm`, that allows every call with the input it got.
const MCP_ALLOW = [
	'let buf = "";',
	'process.stdin.on("data", (d) => {',
	"\tbuf += d;",
	"\tfor (let i = buf.indexOf('\\n'); i >= 0; i = buf.indexOf('\\n')) {",
	"\t\tconst line = buf.slice(0, i);",
	"\t\tbuf = buf.slice(i + 1);",
	"\t\tif (line.trim() === '') continue;",
	"\t\tconst m = JSON.parse(line);",
	"\t\tif (m.id === undefined) continue;",
	"\t\tconst tools = [{ name: 'perm', description: 'd', inputSchema: { type: 'object', properties: {} } }];",
	"\t\tconst text = JSON.stringify({ behavior: 'allow', updatedInput: m.params?.arguments?.input ?? {} });",
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
const PERM_ARGS = [
	"--mcp-config",
	JSON.stringify({
		mcpServers: { s: { command: "bun", args: ["{PROJ}/mcp.js"] } },
	}),
	"--permission-prompt-tool",
	"mcp__s__perm",
];

/** The cases that fill the item types of transcript array fields. */
export const ITEM_CASES: Case[] = [
	{
		// system.hookErrors, failedHookErrorIndexes, hookAdditionalContext: Stop hooks that exit 2 once (a blocking
		// error), exit 1 (a non-blocking error: its index goes to failedHookErrorIndexes), and print additionalContext
		id: "item-stop-hook",
		cfgFiles: settings({
			hooks: {
				Stop: [
					{
						hooks: [
							{
								type: "command",
								command:
									"if [ -f {PROJ}/m ]; then exit 0; fi; touch {PROJ}/m; echo probe-err >&2; exit 2",
							},
						],
					},
					{
						hooks: [
							{ type: "command", command: "echo probe-fail >&2; exit 1" },
						],
					},
					{
						hooks: [
							{
								type: "command",
								command:
									'echo \'{"hookSpecificOutput":{"hookEventName":"Stop","additionalContext":"probe-ctx"}}\'',
							},
						],
					},
				],
			},
		}),
	},
	{
		// system.snapshotFiles: the plan snapshot is written only in a byoc or cloud environment, after ExitPlanMode saves a plan
		id: "item-plan-snapshot",
		env: { CLAUDE_CODE_ENVIRONMENT_KIND: "byoc" },
		// ExitPlanMode is a tool in print mode only when a permission prompt tool is set
		projFiles: { "mcp.js": MCP_ALLOW },
		args: ["--permission-mode", "plan", "--allowedTools", "Bash", ...PERM_ARGS],
		seq: [
			{
				name: "ToolSearch",
				input: { query: "select:ExitPlanMode", max_results: 3 },
			},
			// the first call names the plan file (a random name) in the transcript; the command writes it; the second call
			// snapshots it, because the tool input is normalized before the call runs
			{ name: "ExitPlanMode", input: {} },
			{
				name: "Bash",
				input: {
					command: String.raw`f=$(grep -ho "[^\" ]*/plans/[a-z-]*\.md" "$CLAUDE_CONFIG_DIR"/projects/*/*.jsonl | head -1); mkdir -p "$(dirname "$f")"; printf "# Probe plan\n" > "$f"`,
				},
			},
			{ name: "ExitPlanMode", input: {} },
		],
	},
	{
		// user.sandboxViolations: a sandboxed Bash that writes outside the allowed paths and connects to a closed port
		id: "item-sandbox-violation",
		cfgFiles: settings({
			sandbox: { enabled: true, autoAllowBashIfSandboxed: true },
		}),
		args: ["--allowedTools", "Bash"],
		seq: [
			{
				name: "Bash",
				input: {
					command:
						"touch ~/probe-outside.txt; echo x > /etc/probe-outside.txt; curl -s -m 3 http://example.invalid/; sleep 6; true",
				},
			},
		],
	},
	{
		// user.promptShellHandOff.commands: a forked skill (context: fork, no agent) whose body runs a shell injection in
		// auto mode; the handoff list is written only when the skill has no agent
		id: "item-shell-handoff",
		projFiles: {
			".claude/skills/hand/SKILL.md":
				"---\nname: hand\ndescription: probe\ncontext: fork\n---\nOutput: !`touch handoff-probe.txt`\n",
		},
		args: ["--permission-mode", "auto", "--allowedTools", "Skill"],
		seq: [{ name: "Skill", input: { skill: "hand" } }],
	},
];
