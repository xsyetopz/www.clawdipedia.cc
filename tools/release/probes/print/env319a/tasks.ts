import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";

import { BASE } from "../misc/shared.ts";
import type { Run } from "../run.ts";
import { obj } from "../run.ts";
import {
	type CaseDef,
	initEvent,
	msgs,
	toolResultTexts,
	withRun,
} from "../run/helpers.ts";

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// A stdio MCP server that advertises the tasks capability and logs each request it gets.
const TASK_SRV = `const fs=require("fs");const L=process.env.LOG;let buf="";
process.stdin.on("data",c=>{buf+=c;let i;while((i=buf.indexOf("\\n"))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}fs.appendFileSync(L,l+"\\n");const s=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");
if(m.method==="server/discover")s({ttlMs:0,cacheScope:"private",supportedVersions:["2026-07-28"],capabilities:{tools:{},tasks:{requests:{tools:{call:{}}},list:{},cancel:{}}},serverInfo:{name:"ms",version:"1"}});
else if(m.method==="initialize")s({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{},tasks:{requests:{tools:{call:{}}},list:{},cancel:{}}},serverInfo:{name:"ms",version:"1"}});
else if(m.method==="tools/list")s({tools:[{name:"ping",description:"p",inputSchema:{type:"object",properties:{}},execution:{taskSupport:"optional"}}]});
else if(m.method==="tools/call")s(process.env.TASK&&m.params._meta["io.modelcontextprotocol/clientCapabilities"].extensions?{resultType:"task",taskId:"t1",status:"working"}:{content:[{type:"text",text:"pong"}]});
else if(m.method==="tasks/get")s({taskId:"t1",status:"completed",result:{content:[{type:"text",text:"pong"}]}});
else if(m.id!==undefined)s({});}});process.stdin.on("end",()=>process.exit(0));`;
// Only a call that may become a task keeps the tasks extension in its `_meta`. A single-shot `-p "prompt"` run strips it,
// and so does a run whose input has ended, so the background cases use stream-json input held open past the call.
const STREAM_USER = `${JSON.stringify({ type: "user", message: { role: "user", content: "Reply with 'OK'." } })}\n`;
const PING = { seq: [{ name: "mcp__ms__ping", input: {} }] };
const label = (v?: string): string => (v === undefined ? "unset" : `v${v}`);

const TASK_ENV = {
	ENABLE_TOOL_SEARCH: "false",
	CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1",
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "0",
	DISABLE_TELEMETRY: "0",
	HTTPS_PROXY: "http://127.0.0.1:9",
	NO_PROXY: "127.0.0.1,localhost",
};

const taskSetup = async (cfg: string, stream: boolean): Promise<void> => {
	await Bun.write(`${cfg}/srv.js`, TASK_SRV);
	await Bun.write(
		`${cfg}/.claude.json`,
		JSON.stringify({ cachedGrowthBookFeatures: { tengu_glowing_lark: true } }),
	);
	await Bun.write(
		`${cfg}/mcp.json`,
		JSON.stringify({
			mcpServers: {
				ms: {
					command: "bun",
					args: [`${cfg}/srv.js`],
					env: { LOG: `${cfg}/srv.log`, ...(stream && { TASK: "1" }) },
				},
			},
		}),
	);
};

const taskData = (r: Run) => {
	const log = str(r.after["log"]);
	const rows = log
		.split("\n")
		.filter(Boolean)
		.map((l) => obj(JSON.parse(l)));
	const init = rows.find(
		(x) => x["method"] === "initialize" || x["method"] === "server/discover",
	);
	const call = rows.find((x) => x["method"] === "tools/call");
	return {
		precondition: rows.length > 0 && call !== undefined,
		methods: rows.map((x) => str(x["method"])).join(","),
		initCapabilities: JSON.stringify(obj(init?.["params"])["_meta"]),
		callParams: JSON.stringify(call?.["params"]),
		callHasTasksExtension: JSON.stringify(call).includes(
			"io.modelcontextprotocol/tasks",
		),
		toolResult: toolResultTexts(r)[0] ?? "",
		taskEvents: r.stdout
			.split("\n")
			.filter((l) => /"subtype":"(task_|background_tasks)/u.test(l))
			.map((l) => l.slice(0, 160))
			.slice(0, 5),
	};
};

export const mcpTasks = (
	envName: string,
	v?: string,
	extra: Record<string, string> = {},
	stream = false,
): CaseDef => ({
	name: `${envName
		.replace(/^CLAUDE_CODE_/u, "")
		.toLowerCase()
		.replaceAll("_", "-")}.${label(v)}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				...(stream
					? { noPrompt: true, stdin: STREAM_USER, stdinOpenMs: 15_000 }
					: {}),
				args: [
					...(stream ? ["-p", "--input-format", "stream-json"] : []),
					...BASE,
					"--mcp-config",
					"{CFG}/mcp.json",
					"--strict-mcp-config",
				],
				env: {
					...TASK_ENV,
					...extra,
					...(v === undefined ? {} : { [envName]: v }),
				},
				allowOverride: [
					"ENABLE_TOOL_SEARCH",
					"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
					"DISABLE_TELEMETRY",
					"HTTPS_PROXY",
					"NO_PROXY",
				],
				stub: PING,
				setup: ({ cfg }) => taskSetup(cfg, stream),
				afterExit: async ({ cfg }) => {
					const log = Bun.file(`${cfg}/srv.log`);
					return { log: (await log.exists()) ? await log.text() : "" };
				},
			},
			(r) => ({ from: r, data: taskData(r) }),
		),
});

const DEFER_HOOK =
	'echo \'{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"defer"}}\'';

const deferSetup = async (cfg: string): Promise<void> => {
	await Bun.write(`${cfg}/srv.js`, TASK_SRV);
	await Bun.write(
		`${cfg}/mcp.json`,
		JSON.stringify({
			mcpServers: {
				ms: {
					command: "bun",
					args: [`${cfg}/srv.js`],
					env: { LOG: `${cfg}/srv.log` },
				},
			},
		}),
	);
	await Bun.write(
		`${cfg}/settings.json`,
		JSON.stringify({
			hooks: {
				PreToolUse: [
					{
						matcher: "mcp__ms__ping",
						hooks: [{ type: "command", command: DEFER_HOOK }],
					},
				],
			},
		}),
	);
};

// Run 1 defers an MCP tool call with a PreToolUse hook and ends with the call open. Run 2 resumes that session without the server, so the tool is gone.
const encodeDir = (p: string) => p.replaceAll(/[^A-Za-z0-9]/gu, "-");
const terminal = (out: string): string =>
	/"terminal_reason":"([^"]*)"/u.exec(out)?.[1] ?? "";

const resumeData = (r: Run, first: Run, sid: string) => {
	const q = msgs(r)[0];
	const m = q === undefined ? "" : JSON.stringify(q.body);
	return {
		precondition: sid.length > 0 && first.stdout.includes("tool_deferred"),
		firstTerminal: terminal(first.stdout),
		exit: r.code,
		requests: msgs(r).length,
		requestHasPing: m.includes("ping"),
		terminal: terminal(r.stdout),
		notice: (r.stdout + r.stderr).includes(
			"isn't available, so its deferred call",
		),
	};
};

export const dropDeferred = (v?: string): CaseDef => ({
	name: `drop-unavailable-deferred-tool.${label(v)}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [
					...BASE,
					"--mcp-config",
					"{CFG}/mcp.json",
					"--strict-mcp-config",
				],
				env: { ENABLE_TOOL_SEARCH: "false" },
				allowOverride: ["ENABLE_TOOL_SEARCH"],
				stub: PING,
				setup: ({ cfg }) => deferSetup(cfg),
			},
			(first) => {
				const sid = str(initEvent(first)?.["session_id"]);
				return withRun(
					ctx,
					{
						args: ["--resume", sid],
						env:
							v === undefined
								? {}
								: { CLAUDE_CODE_DROP_UNAVAILABLE_DEFERRED_TOOL: v },
						setup: async ({ cfg, proj }) => {
							const src = join(first.sb.cfg, "projects");
							const [old] = await readdir(src);
							if (old !== undefined) {
								await cp(
									join(src, old),
									join(cfg, "projects", encodeDir(proj)),
									{
										recursive: true,
									},
								);
							}
						},
					},
					(r) => ({
						from: r,
						data: resumeData(r, first, sid),
						samples: { out: (r.stdout + r.stderr).slice(-400) },
					}),
				);
			},
		),
});
