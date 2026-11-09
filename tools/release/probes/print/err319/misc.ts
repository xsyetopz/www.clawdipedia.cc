import { chmod, mkdir } from "node:fs/promises";

import { SRV } from "../api319/beta.ts";
import { type CaseDef, json } from "../run/helpers.ts";
import { CONNECTED, OAUTH_CREDS, one } from "./one.ts";

const BYPASS = ["--permission-mode", "bypassPermissions"];
const LOGOUT = /logout|Logout|config file/u;

/** A stdio MCP tool whose outputSchema declares `url` as its `$schema`, called once. */
const mcpOutputSchema = ([id, url]: readonly [string, string]): CaseDef =>
	one(
		`mcp-output-schema-${id}`,
		{
			setup: async (sb) => {
				await Bun.write(
					`${sb.home}/m/srv.js`,
					SRV.replace(
						'inputSchema:{type:"object",properties:{}}}',
						`inputSchema:{type:"object",properties:{}},outputSchema:{$schema:${JSON.stringify(url)},type:"object",properties:{n:{type:"number"}}}}`,
					).replace(
						"else if(m.id!==undefined)s({});",
						String.raw`else if(m.method==="tools/call")s({content:[{type:"text",text:"{\"n\":1}"}],structuredContent:{n:1}});else if(m.id!==undefined)s({});`,
					),
				);
				await Bun.write(
					`${sb.home}/m/mcp.json`,
					json({
						mcpServers: {
							psrv: { command: "bun", args: [`${sb.home}/m/srv.js`] },
						},
					}),
				);
			},
			env: { ENABLE_TOOL_SEARCH: "false" },
			args: [
				"--mcp-config",
				"{HOME}/m/mcp.json",
				...BYPASS,
				"--debug-file",
				"{CFG}/d.log",
			],
			stub: { seq: [{ name: "mcp__psrv__ping", input: {} }] },
		},
		/unsupported dialect|"n":1|[Ss]chema|dialect/u,
	);

const SCHEMAS: (readonly [string, string])[] = [
	["draft-07", "http://json-schema.org/draft-07/schema#"],
	["unknown-dialect", "https://example.test/dialect"],
];

export const miscCases: CaseDef[] = [
	one(
		"chrome-no-extension",
		{
			...CONNECTED,
			cfgFiles: { ".credentials.json": OAUTH_CREDS },
			args: ["--chrome", "--debug-file", "{CFG}/d.log"],
			stub: {
				seq: [{ name: "mcp__claude-in-chrome__tabs_context_mcp", input: {} }],
			},
		},
		/hrome|xtension|bridge|browser|mcp__/u,
	),
	one(
		"auth-logout-dir",
		{ argv: ["auth", "logout"], cfgFiles: { ".claude.json/x": "1" } },
		LOGOUT,
	),
	one(
		"auth-logout-unwritable",
		{
			argv: ["auth", "logout"],
			cfgFiles: {
				".claude.json": json({
					primaryApiKey: "sk-ant-probe",
					hasCompletedOnboarding: true,
				}),
			},
			setup: async (sb) => {
				await chmod(sb.cfg, 0o555);
			},
			afterExit: async (sb) => {
				await chmod(sb.cfg, 0o755);
				return {};
			},
		},
		LOGOUT,
	),
	one(
		"grep-untraversable-dir",
		{
			setup: async (sb) => {
				await Bun.write(`${sb.proj}/locked/a.txt`, "needle\n");
				await chmod(`${sb.proj}/locked`, 0o600);
			},
			afterExit: async (sb) => {
				await chmod(`${sb.proj}/locked`, 0o755);
				return {};
			},
			args: [...BYPASS, "--tools", "Grep"],
			stub: {
				seq: [
					{
						name: "Grep",
						input: { pattern: "needle", path: "{PROJ}/locked" },
					},
				],
			},
		},
		/Cannot search|traversable/u,
	),
	one(
		"mcp-add-bad-env",
		{ argv: ["mcp", "add", "probe", "-e", "NOEQUALS", "--", "echo"] },
		/Invalid environment variable format/u,
	),
	// The program drops a known draft `$schema` before the MCP validator. The unknown URL is the case that would reach the dialect guard.
	...SCHEMAS.map((s) => mcpOutputSchema(s)),
	// A character above Latin-1: the HTTP runtime takes control bytes such as \x01 but refuses this.
	one(
		"custom-headers-bad-authorization",
		{
			args: ["--debug-file", "{CFG}/d.log"],
			env: { ANTHROPIC_CUSTOM_HEADERS: "Authorization: a\u0100b" },
		},
		/Invalid Authorization header value/u,
	),
	// A stand-in pwsh: the quote check runs before the command is spawned.
	one(
		"powershell-tmpdir-quote",
		{
			setup: async (sb) => {
				await Bun.write(`${sb.home}/bin/pwsh`, "#!/bin/sh\nexit 0\n");
				await chmod(`${sb.home}/bin/pwsh`, 0o755);
				await mkdir(`${sb.home}/t\u2018mp`);
			},
			env: {
				CLAUDE_CODE_USE_POWERSHELL_TOOL: "1",
				CLAUDE_CODE_TMPDIR: "{HOME}/t\u2018mp",
				PATH: "{HOME}/.probe-bin:{HOME}/bin:/usr/bin:/bin",
			},
			allowOverride: ["PATH"],
			args: [...BYPASS, "--tools", "PowerShell"],
			stub: {
				seq: [{ name: "PowerShell", input: { command: "Write-Output hi" } }],
			},
		},
		/Cannot safely quote|PowerShell/u,
	),
	// The argument check takes any `-\S+` suffix; the version check takes only [0-9A-Za-z.-] after the `-`.
	one(
		"install-version-underscore",
		{ argv: ["install", "1.2.3-a_b"] },
		/Invalid version string|Invalid channel/u,
	),
	// `..` passes the argument check and fails the well-formed check, as `_` does.
	one(
		"install-version-dotdot",
		{ argv: ["install", "1.2.3-a..b"] },
		/Invalid version string|Invalid channel/u,
	),
	one(
		"runner-secret-file-missing",
		{
			argv: [
				"self-hosted-runner",
				"--api-url",
				"http://127.0.0.1:9",
				"--environment-secret-file",
				"{HOME}/missing",
			],
		},
		/Failed to read environment secret file/u,
	),
];
