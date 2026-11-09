import type { LoggedRequest } from "../../../lib/stub.ts";
import { arr, obj } from "../run.ts";
import {
	bodyOf,
	type CaseDef,
	json,
	msgs,
	toolNames,
	withRun,
} from "../run/helpers.ts";

const BETAS = [
	"tool-provenance-2026-10-26",
	"program-use-case-ids-2026-09-17",
	"claude-code-side-query-2026-09-29",
	"request-tags-2026-08-21",
];
// The harness turns off telemetry, which also turns off the feature flag client; the cached flags in .claude.json need it on.
const GB_ON = {
	DISABLE_TELEMETRY: "",
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
};
export const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };

export const SRV = `let b="";process.stdin.on("data",c=>{b+=c;let i;while((i=b.indexOf("\\n"))>=0){const l=b.slice(0,i);b=b.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}const s=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");if(m.method==="initialize")s({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"p",version:"1"}});else if(m.method==="tools/list")s({tools:[{name:"ping",description:"p",inputSchema:{type:"object",properties:{}}}]});else if(m.id!==undefined)s({});}});process.stdin.on("end",()=>process.exit(0));`;

const hasMcp = async (sb: { home: string }): Promise<void> => {
	await Bun.write(`${sb.home}/m/srv.js`, SRV);
	await Bun.write(
		`${sb.home}/m/mcp.json`,
		JSON.stringify({
			mcpServers: { psrv: { command: "bun", args: [`${sb.home}/m/srv.js`] } },
		}),
	);
};

export interface Opt {
	env?: Record<string, string>;
	mcp?: boolean;
	args?: string[];
	gb?: Record<string, boolean>;
	title?: boolean;
	user?: Record<string, unknown>;
}

const TITLE = {
	noPrompt: true,
	argv: [
		"-p",
		"--input-format",
		"stream-json",
		"--output-format",
		"stream-json",
		"--verbose",
	],
	stdin: `${json({ type: "control_request", request_id: "t1", request: { subtype: "generate_session_title", description: "Fix the login bug" } })}\n`,
};

const TOOL_NAMES =
	/^(WrapUp|ReadWidgetContext|ExitPlanMode|EnterPlanMode|AskUserQuestion|propose_skills|enable__|request_computer|mcp__)/u;

const perRequest = (q: LoggedRequest) => {
	const betas = (q.headers["anthropic-beta"] ?? "").split(",");
	const body = bodyOf(q);
	const tools = arr(body.tools).map((t) => obj(t));
	return {
		has: BETAS.filter((b) => betas.includes(b)),
		nBetas: betas.length,
		nTools: tools.length,
		tools: toolNames(q).filter((t) => TOOL_NAMES.test(t)),
		ownership: tools
			.filter((t) => "ownership_metadata" in t)
			.map((t) => `${String(t["name"])}=${json(t["ownership_metadata"])}`),
		deferred: json(body.messages ?? []).includes("ExitPlanMode"),
		useCaseId: body["program_use_case_id"] ?? null,
		tags: "tags" in body,
		teamInContext: json([body.system, body.messages]).includes("probe@team"),
	};
};

export const betaCase = (name: string, o: Opt): CaseDef => ({
	name,
	run: (ctx) =>
		withRun(
			ctx,
			{
				env: { ...(o.gb === undefined ? {} : GB_ON), ...o.env },
				allowOverride: Object.keys(GB_ON),
				args: [
					...(o.mcp === true ? ["--mcp-config", "{HOME}/m/mcp.json"] : []),
					...(o.args ?? []),
				],
				...(o.user === undefined
					? {}
					: { cfgFiles: { "settings.json": json(o.user) } }),
				setup: async (sb) => {
					await hasMcp(sb);
					if (o.gb !== undefined) {
						await Bun.write(
							`${sb.cfg}/.claude.json`,
							JSON.stringify({ cachedGrowthBookFeatures: o.gb }),
						);
					}
				},
				...(o.title === true ? TITLE : {}),
				timeoutMs: 60_000,
			},
			(r) => {
				const qs = msgs(r);
				return {
					from: r,
					data: {
						precondition: qs.length > 0,
						requests: qs.length,
						perRequest: json(qs.map((q) => perRequest(q))),
					},
				};
			},
		),
});
