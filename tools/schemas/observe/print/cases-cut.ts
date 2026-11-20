// Print-mode cases whose api-request row carries a cut: an SDK MCP server with a connector address.
import type { Case } from "./case.ts";

// A made-up OAuth-shaped login file. The program reads it only when no API key is set, so the case sets `noKey`: with an
// API key the program turns the tool-provenance beta off.
const CREDENTIALS = JSON.stringify({
	claudeAiOauth: {
		accessToken: "fake-access",
		refreshToken: "fake-refresh",
		expiresAt: 4_102_444_800_000,
		scopes: ["user:inference", "user:profile", "user:mcp_servers"],
		subscriptionType: "max"
	}
});

// The SDK declares one in-process MCP server and hands over its MCP handshake in the initialize request.
// The server's capabilities carry the connector address; its tool is always loaded, so tools[] holds it.
const INITIALIZE = {
	type: "control_request",
	request_id: "init-1",
	request: {
		subtype: "initialize",
		sdkMcpServers: ["conn"],
		sdkMcpServerManifests: {
			conn: {
				initializeResult: {
					protocolVersion: "2025-11-25",
					capabilities: {
						tools: {},
						experimental: {
							"anthropic/claudeAiConnector": {
								serverId: "conn",
								serverUrl: "https://mcp.example.invalid/v1/conn"
							}
						}
					},
					serverInfo: { name: "conn", version: "1.0.0" }
				},
				toolsListResult: {
					tools: [
						{
							name: "ping",
							description: "Ping.",
							_meta: { "anthropic/alwaysLoad": true },
							inputSchema: { type: "object", properties: {} }
						}
					]
				}
			}
		}
	}
};

// Hides the connector tool through the flag-settings deny rules, so the first request leaves it out of tools[].
const denyTool = (id: string, deny: string[]) => ({
	type: "control_request",
	request_id: id,
	request: {
		subtype: "apply_flag_settings",
		settings: { permissions: { deny } }
	}
});

/** Cases whose api-request row carries a `cut`. They run with no API key (`noKey`), so the program reads CREDENTIALS. */
export const CUT_CASES: Case[] = [
	{
		// cut = { kind: "tool-mark-address", cuts: 1, placeholders: 1, messages: [] }
		id: "cut-tool-mark-address",
		noKey: true,
		env: {
			CLAUDE_CODE_ENTRYPOINT: "claude-desktop",
			_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1"
		},
		cfgFiles: { ".credentials.json": CREDENTIALS },
		stdin: [
			INITIALIZE,
			1500,
			{ type: "user", message: { role: "user", content: "Reply with OK." } }
		]
	},
	{
		// A tool that joins the pool after the first request goes into a later message as a tool_addition block
		// (needs ToolSearch off, so nothing is deferred, plus the mid-conversation and inline-tools betas).
		// cut = { kind: "tool-mark-address", cuts: 1, placeholders: 1, messages: [4] }; each item is a message index.
		id: "cut-tool-mark-address-message",
		noKey: true,
		args: ["--disallowedTools", "ToolSearch"],
		env: {
			CLAUDE_CODE_ENTRYPOINT: "claude-desktop",
			_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1",
			CLAUDE_CODE_INLINE_TOOLS: "1",
			CLAUDE_CODE_FORCE_MID_CONVERSATION_SYSTEM: "1"
		},
		cfgFiles: { ".credentials.json": CREDENTIALS },
		stdin: [
			INITIALIZE,
			1500,
			denyTool("deny-1", ["mcp__conn__ping"]),
			500,
			{ type: "user", message: { role: "user", content: "Reply with OK." } },
			4000,
			denyTool("deny-2", []),
			500,
			{
				type: "user",
				message: { role: "user", content: "Reply with OK again." }
			}
		]
	}
];
