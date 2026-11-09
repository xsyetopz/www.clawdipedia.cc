import { mkdir, realpath } from "node:fs/promises";

import { PROMPT } from "../../../lib/env.ts";
import { type CaseDef, json } from "../run/helpers.ts";
import { CONNECTED, GI, OAUTH_CREDS, one } from "./one.ts";

const GATEWAY_YAML = `listen:
  host: 127.0.0.1
  port: 18099
upstreams:
  - provider: mantle
    region: us-east-1
    models: [claude-opus-4-7]
    auth:
      aws_bearer_token: fake-bearer
    assume_role:
      role_arn: arn:aws:iam::123456789012:role/probe
`;
const SESSION = "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f40";
const DEBUG = ["--debug-file", "{CFG}/d.log"];
const ADD_PROJECT = ["mcp", "add", "--scope", "project", "probe", "--", "echo"];

export const configCases: CaseDef[] = [
	one(
		"hook-powershell",
		{
			args: DEBUG,
			projFiles: {
				".claude/settings.json": json({
					hooks: {
						PreToolUse: [
							{
								matcher: "Bash",
								hooks: [
									{ type: "command", command: "echo hi", shell: "powershell" },
								],
							},
						],
					},
				}),
			},
			stub: { seq: [{ name: "Bash", input: { command: "echo hi" } }] },
		},
		/PowerShell|powershell/u,
	),
	one(
		"mcp-add-connector-downloads",
		{ argv: ADD_PROJECT, cwdSub: "connector-downloads", projFiles: GI },
		/connector-downloads/u,
	),
	one(
		"mcp-add-connector-downloads-no-gitignore",
		{ argv: ADD_PROJECT, cwdSub: "connector-downloads" },
		/connector-downloads|Added|added/u,
	),
	one(
		"resume-damaged-transcript",
		{
			args: ["--resume", SESSION, ...DEBUG],
			setup: async (sb) => {
				const real = await realpath(sb.proj);
				const dir = `${sb.cfg}/projects/${real.replaceAll(/[^A-Za-z0-9]/gu, "-")}`;
				await mkdir(dir, { recursive: true });
				await Bun.write(
					`${dir}/${SESSION}.jsonl`,
					`{"type":"user","message":{"role":"user","content":"hi"},"uuid":"u1","sessionId":"${SESSION}"}\nnot json at all\n`,
				);
			},
		},
		/transcript|damaged|resume|No conversation/iu,
	),
	one(
		"settings-connector-downloads",
		{
			cwdSub: "connector-downloads",
			projFiles: {
				...GI,
				"connector-downloads/.claude/settings.json": json({ model: "x" }),
			},
			args: DEBUG,
		},
		/connector-downloads/u,
	),
	one(
		"auto-mode-print-refused",
		{
			argv: [
				"-p",
				PROMPT,
				"--permission-mode",
				"auto",
				"--model",
				"claude-opus-5-5",
			],
			stub: {
				seq: [
					{ name: "Bash", input: { command: "curl -s http://127.0.0.1:9/x" } },
				],
			},
			refuseServerCheck: true,
		},
		/auto mode|could not check|Exiting|result/u,
	),
	one(
		"gateway-assume-role-bearer",
		{
			argv: ["gateway", "--config", "{PROJ}/g.yaml"],
			projFiles: { "g.yaml": GATEWAY_YAML },
		},
		/assume_role/u,
	),
	one(
		"remote-trigger-bad-cursor",
		{
			...CONNECTED,
			cfgFiles: {
				".credentials.json": OAUTH_CREDS,
				".claude.json": json({
					hasCompletedOnboarding: true,
					cachedGrowthBookFeatures: { tengu_zippy_cocoa: true },
				}),
			},
			args: DEBUG,
			stub: {
				seq: [
					{
						name: "RemoteTrigger",
						input: {
							action: "get_run_log",
							session_id: "session_01ABCDEFGHJKLMNPQRSTUVWX",
							cursor: "bogus",
						},
					},
				],
			},
		},
		/RemoteTrigger|cursor|No such tool/u,
	),
];
