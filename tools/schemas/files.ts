// The published schema files: what each one describes and how to find its source in the program.

export const FILES = {
	"claude-code-settings.json": {
		title: "Claude Code settings.json",
		what: "settings.json (user, project, local)",
	},
	"claude-code-managed-settings.json": {
		title: "Claude Code managed-settings.json",
		what: "managed settings (settings.json keys plus managed-only keys)",
	},
	"claude-code-plugin-manifest.json": {
		title: "Claude Code plugin.json",
		what: ".claude-plugin/plugin.json",
	},
	"claude-code-marketplace.json": {
		title: "Claude Code marketplace.json",
		what: ".claude-plugin/marketplace.json",
	},
	"claude-code-plugin-hooks.json": {
		title: "Claude Code plugin hooks.json",
		what: "hooks/hooks.json inside a plugin",
	},
	"claude-code-keybindings.json": {
		title: "Claude Code keybindings.json",
		what: "~/.claude/keybindings.json",
	},
	"claude-code-mcp.json": {
		title: "Claude Code .mcp.json",
		what: ".mcp.json (project MCP servers)",
		anchor:
			'the schema module with the text "Command cannot be empty" and "authServerMetadataUrl must use https://" (the {mcpServers: record(string, server)} wrapper)',
	},
	"claude-code-hook-output.json": {
		title: "Claude Code hook output",
		what: "the JSON a classic command hook prints on stdout (common fields and one hookSpecificOutput variant per event)",
		anchor:
			'the SDK schema module, object with continue, suppressOutput, stopReason, decision, systemMessage and the description "A terminal escape sequence"',
	},
	"claude-code-tools.json": {
		title: "Claude Code built-in tool payloads",
		what: "the input and result of each built-in tool (definitions <Tool>Input and <Tool>Result)",
		anchor:
			"the tool factory that copies a tool definition's properties (getters included), read as inputSchema and outputSchema on each tool",
	},
	"claude-code-control-protocol.json": {
		title: "Claude Code control protocol",
		what: "the request and response of each control_request subtype in stream-json mode (definitions <subtype>Request and <subtype>Response, direction in x-direction)",
		anchor:
			'the SDK schema module, table of rows {request, originator, response}; the request union is described as "Control requests a client sends to drive the loop"',
	},
	"claude-code-stream-json.json": {
		title: "Claude Code stream-json messages",
		what: "each message type the CLI writes (<type>[_<subtype>]Output) and reads (<type>Input) in stream-json mode",
		anchor:
			'the SDK schema module, unions described as "Everything the CLI writes to its output stream" and "Everything a client may write to the CLI\'s input stream"',
	},
	"claude-code-agents-json.json": {
		title: "Claude Code --agents JSON entry",
		what: "one subagent definition of the --agents JSON (and the SDK agents option)",
		anchor:
			'the SDK schema module, object described as "Definition for a custom subagent that can be invoked via the Agent tool."',
	},
} as const;
const isKind = (k: string): k is keyof typeof FILES => k in FILES;
export const KINDS = Object.keys(FILES).filter((k) => isKind(k));
/** Schemas that tools/schemas/code.ts writes from the program's code (no zod validator to export). */
export const CODE_FILES = [
	"claude-code-status-line.json",
	"claude-code-transcript.json",
	"claude-code-otel.json",
	"claude-code-frontmatter.json",
	"claude-code-claude-json.json",
] as const;
