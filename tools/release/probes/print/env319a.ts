import { CHILD, derived, lockWait, replyHold, UUID } from "./env319a/misc.ts";
import { DBG, sweep } from "./env319a/sweep.ts";
import { crypticCases, handbackCases, summaryCases } from "./env319a/sweeps.ts";
import { dropDeferred, mcpTasks } from "./env319a/tasks.ts";
import {
	type CaseDef,
	evKinds,
	initEvent,
	msgs,
	readCfg,
	runCases,
	sysText,
	toolNames,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const WRAP_ENV = { CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1" };
const wrapSetup = async ({ cfg }: { cfg: string }): Promise<void> => {
	await Bun.write(
		`${cfg}/.claude.json`,
		JSON.stringify({ cachedGrowthBookFeatures: { tengu_merry_thunder: true } }),
	);
};

const plain: CaseDef[] = [
	"BUN_GC_TIMER_DISABLE",
	"CCR_AGENT_PROXY_MAX_BUSY_TUNNELS",
].flatMap((n) =>
	sweep(`plain.${n}`, n, [undefined, "1"], {}, (r) => {
		const q = msgs(r)[0];
		return {
			exit: r.code,
			tools: q === undefined ? 0 : toolNames(q).length,
			sys: q === undefined ? 0 : sysText(q).length,
			requests: msgs(r).length,
		};
	}),
);

const features: CaseDef[] = [
	...sweep(
		"wrap-up",
		"CLAUDE_CODE_ENABLE_WRAP_UP",
		[undefined, "1"],
		{ env: WRAP_ENV, setup: wrapSetup },
		(r) => {
			const q = msgs(r)[0];
			return {
				wrapUpTool: q === undefined ? null : toolNames(q).includes("WrapUp"),
				tools: q === undefined ? 0 : toolNames(q).length,
			};
		},
	),
	...sweep(
		"cowork-plugin-skill",
		"CLAUDE_CODE_COWORK_PLUGIN_SKILL",
		[undefined, "1"],
		{},
		(r) => {
			const body = JSON.stringify(msgs(r)[0]?.body ?? "");
			return {
				mentionsCowork: /cowork/iu.test(body),
				snippet: /.{80}cowork-plugin.{160}/iu.exec(body)?.[0] ?? "",
				bodyLen: body.length,
			};
		},
	),
	...sweep(
		"disable-feature-flags",
		"CLAUDE_CODE_DISABLE_FEATURE_FLAGS",
		[undefined, "1"],
		{
			env: { CLAUDE_CODE_ENABLE_WRAP_UP: "1", ...WRAP_ENV },
			setup: wrapSetup,
		},
		(r) => {
			const q = msgs(r)[0];
			return {
				wrapUpTool: q === undefined ? null : toolNames(q).includes("WrapUp"),
			};
		},
	),
];

const CODE_MODE = /code mode|repl_mode|opt.in/iu;

const settings: CaseDef[] = [
	...sweep(
		"code-mode",
		"CLAUDE_CODE_EXPERIMENTAL_CODE_MODE",
		[undefined, "1", "on", "bogus"],
		{ args: DBG },
		async (r) => {
			const q = msgs(r)[0];
			return {
				tools: q === undefined ? "" : toolNames(q).join(","),
				events: evKinds(r).slice(0, 80),
				exit: r.code,
				debugMentions: CODE_MODE.test(await readCfg(r, "d.log")),
			};
		},
		CODE_MODE,
	),
	// User settings set the proxy variable; the host-managed marker decides whether the program takes it.
	...sweep(
		"proxy-resolves-hosts-from-settings",
		"CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST",
		[undefined, "1"],
		{
			args: DBG,
			cfgFiles: {
				"settings.json": JSON.stringify({
					env: { CLAUDE_CODE_PROXY_RESOLVES_HOSTS: "1" },
				}),
			},
		},
		async (r) => ({
			ignored: /Ignoring \S*CLAUDE_CODE_PROXY_RESOLVES_HOSTS/u.test(
				await readCfg(r, "d.log"),
			),
			exit: r.code,
		}),
		/CLAUDE_CODE_PROXY_RESOLVES_HOSTS/u,
	),
];

const nestedId: CaseDef[] = sweep(
	"nested-session-id",
	"CLAUDE_CODE_DISABLE_NESTED_SESSION_ID",
	[undefined, "1"],
	{ env: CHILD },
	(r) => {
		const id = initEvent(r)?.["session_id"];
		return {
			sessionId: typeof id === "string" ? id : "",
			equalsRemoteId: id === derived(UUID),
		};
	},
);

export const env319a: PrintGroup = {
	id: "env319a",
	title: "New 2.1.319 env names, first half",
	run: (ctx) =>
		runCases(ctx, "env319a", [
			...plain,
			dropDeferred(),
			dropDeferred("1"),
			mcpTasks("CLAUDE_CODE_DISABLE_MCP_TASKS"),
			mcpTasks("CLAUDE_CODE_DISABLE_MCP_TASKS", "1"),
			...[undefined, "1"].map((v) =>
				mcpTasks(
					"CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND",
					v,
					{ CLAUDE_AUTO_BACKGROUND_TASKS: "1" },
					true,
				),
			),
			lockWait(),
			lockWait("60000"),
			replyHold(),
			replyHold("8000"),
			...nestedId,
			...summaryCases,
			...handbackCases,
			...crypticCases,
			...features,
			...settings,
		]),
};
