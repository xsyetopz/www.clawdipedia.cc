// Remaining one-off print probes from p305-print misc.ts, misc2.ts, misc3.ts:
// agent mcpServers, plugin validate, subprocess env scrub, /context, managed settings path, large CLAUDE.md.
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { bigClaudeMd, nestedClaudeMd } from "./misc/claudemd.ts";
import { scrubEnv, scrubPerm } from "./misc/scrub.ts";
import { BASE, MARK } from "./misc/shared.ts";
import { VALIDATE, validateCase } from "./misc/validate.ts";
import { pathExists } from "./run.ts";
import {
	type CaseDef,
	json,
	msgs,
	readCfg,
	runCases,
	toolNames,
	toolResultTexts,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const SRV = `const fs=require("fs");const d=process.env.MARK_DIR;fs.writeFileSync(d+"/started","1");process.on("exit",()=>fs.writeFileSync(d+"/stopped","1"));process.on("SIGTERM",()=>process.exit(0));
let buf="";process.stdin.on("data",c=>{buf+=c;let i;while((i=buf.indexOf("\\n"))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}const s=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");if(m.method==="initialize")s({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"p",version:"1"}});else if(m.method==="tools/list")s({tools:[{name:"ping",description:"p",inputSchema:{type:"object",properties:{}}}]});else if(m.id!==undefined)s({});}});process.stdin.on("end",()=>process.exit(0));`;

const agentSetup = async (
	where: "user" | "project",
	{ cfg, home, proj }: { cfg: string; home: string; proj: string },
): Promise<void> => {
	const d = `${home}/mark`;
	await Bun.write(`${d}/srv.js`, SRV);
	const p =
		where === "user" ? `${cfg}/agents/pa.md` : `${proj}/.claude/agents/pa.md`;
	await mkdir(dirname(p), { recursive: true });
	await Bun.write(
		p,
		`---\nname: pa\ndescription: probe agent\nmcpServers:\n  - agentsrv:\n      command: bun\n      args: ["${d}/srv.js"]\n      env:\n        MARK_DIR: "${d}"\n---\nHello.\n`,
	);
};

const agentMcp = (where: "user" | "project"): CaseDef => ({
	name: `agent-mcp-servers.${where}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: BASE,
				stub: {
					seq: [
						{
							name: "Agent",
							input: {
								description: "d",
								prompt: MARK,
								subagent_type: "pa",
								run_in_background: false,
							},
						},
					],
				},
				setup: (sb) => agentSetup(where, sb),
				afterExit: async ({ home }) => ({
					started: await pathExists(`${home}/mark/started`),
					stopped: await pathExists(`${home}/mark/stopped`),
				}),
			},
			(r) => ({
				from: r,
				data: {
					precondition: msgs(r).length >= 2,
					started: r.after["started"] === true,
					stopped: r.after["stopped"] === true,
					handBack: (toolResultTexts(r)[0] ?? "").includes(
						"[Subagent hand-back]",
					),
				},
			}),
		),
});

const contextCmd: CaseDef = {
	name: "context-slash-command",
	run: (ctx) =>
		withRun(
			ctx,
			{
				prompt: "/context",
				promptReason: "the slash command is the behaviour under test",
			},
			(r) => ({
				from: r,
				data: {
					precondition: r.code !== null,
					requests: r.reqs.length,
					paths: [...new Set(r.reqs.map((x) => x.path.split("?")[0] ?? ""))],
					countTokens: r.reqs.filter((x) => x.path.includes("count_tokens"))
						.length,
					messageRequests: msgs(r).length,
				},
			}),
		),
};

const managedPath: CaseDef = {
	name: "managed-settings-path",
	run: (ctx) =>
		withRun(
			ctx,
			{
				env: { CLAUDE_CODE_MANAGED_SETTINGS_PATH: "{HOME}/ms.json" },
				homeFiles: { "ms.json": json({ permissions: { deny: ["Bash"] } }) },
				args: ["--debug-file", "{CFG}/d.log"],
			},
			async (r) => {
				const q = msgs(r)[0];
				const d = await readCfg(r, "d.log");
				return {
					from: r,
					data: {
						precondition: q !== undefined && d.length > 0,
						bashToolPresent: q ? toolNames(q).includes("Bash") : null,
						defaultManagedFileChecked: d.includes("managed-settings.json"),
					},
					samples: {
						managedDebugLines: d
							.split("\n")
							.filter((l) => /managed/iu.test(l))
							.slice(0, 3)
							.map((l) => l.replace(/^\S+\s/u, "").slice(0, 200))
							.join("\n"),
					},
				};
			},
		),
};

export const misc: PrintGroup = {
	id: "misc",
	title:
		"Agent mcpServers, plugin validate, env scrub, /context, managed settings path, large CLAUDE.md",
	run: (ctx) =>
		runCases(ctx, "misc", [
			agentMcp("user"),
			agentMcp("project"),
			...VALIDATE.map((v) => validateCase(v)),
			scrubEnv,
			scrubPerm(false, "1"),
			scrubPerm(false, "0"),
			scrubPerm(true, "1"),
			scrubPerm(true, "0"),
			contextCmd,
			managedPath,
			bigClaudeMd,
			nestedClaudeMd("claude-opus-5-5"),
			nestedClaudeMd("claude-sonnet-4-5"),
		]),
};
