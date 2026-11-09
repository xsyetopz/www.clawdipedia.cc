// Auto mode probes (ported from p305-print am_ok.ts, am3.ts, amc.ts).
// The stub answers "OK" to the classifier, which it cannot parse, so a classified call is blocked after retries;
// what matters is whether classifier requests appear (system prompt mentions the security monitor, no tool list).
import {
	bodyOf,
	type CaseDef,
	initEvent,
	json,
	msgs,
	readCfg,
	type Run,
	runCases,
	sysText,
	toolNames,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const CMD = "curl -s http://127.0.0.1:9/x";
const BASH = { seq: [{ name: "Bash", input: { command: CMD } }] };
const allow = { permissions: { allow: [`Bash(${CMD})`] } };
const as = (v: boolean | undefined) =>
	v === undefined ? {} : { autoMode: { classifyAllShell: v } };

interface Row {
	name: string;
	allow: boolean;
	user?: boolean;
	flag?: boolean;
	proj?: boolean;
	local?: boolean;
}
const ROWS: Row[] = [
	{ name: "no-allow-rule", allow: false },
	{ name: "allow-unset", allow: true },
	{ name: "allow-user-true", allow: true, user: true },
	{ name: "allow-settings-flag-true", allow: true, flag: true },
	{ name: "allow-user-false", allow: true, user: false },
	{ name: "allow-settings-flag-false", allow: true, flag: false },
	{ name: "user-false-flag-true", allow: true, user: false, flag: true },
	{ name: "user-true-flag-false", allow: true, user: true, flag: false },
	{ name: "project-true", allow: true, proj: true },
	{ name: "local-true", allow: true, local: true },
];

const classifierReqs = (r: Run) =>
	msgs(r).filter(
		(q) =>
			/classif|security monitor|auto mode/iu.test(json(bodyOf(q).system)) &&
			!(toolNames(q).length > 3),
	);

const classifyCase = (c: Row): CaseDef => ({
	name: `classify-all-shell.${c.name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [
					"--permission-mode",
					"auto",
					...(c.flag === undefined ? [] : ["--settings", json(as(c.flag))]),
				],
				cfgFiles: {
					"settings.json": json({ ...(c.allow ? allow : {}), ...as(c.user) }),
				},
				projFiles: {
					...(c.proj === undefined
						? {}
						: { ".claude/settings.json": json(as(c.proj)) }),
					...(c.local === undefined
						? {}
						: { ".claude/settings.local.json": json(as(c.local)) }),
				},
				stub: BASH,
				timeoutMs: 45_000,
			},
			(r) => {
				const m = msgs(r);
				const cls = classifierReqs(r);
				const first = m[0];
				const mode = initEvent(r)?.["permissionMode"];
				return {
					from: r,
					data: {
						// the first request must carry the Bash tool, else the stub never issues the call
						precondition:
							first !== undefined && toolNames(first).includes("Bash"),
						messages: m.length,
						classifierRequests: cls.length,
						classifierRan: cls.length > 0,
						initPermissionMode: typeof mode === "string" ? mode : null,
						toolCounts: m.map((x) => toolNames(x).length).join(","),
					},
				};
			},
		),
});

const SERVER_VARIANTS: [string, Record<string, string>][] = [
	["default", {}],
	["server-0", { CLAUDE_CODE_AUTO_MODE_SERVER: "0" }],
	["server-1", { CLAUDE_CODE_AUTO_MODE_SERVER: "1" }],
	["betas-off", { CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1" }],
	[
		"server-1-betas-off",
		{
			CLAUDE_CODE_AUTO_MODE_SERVER: "1",
			CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
		},
	],
	["two-stage-1", { CLAUDE_CODE_TWO_STAGE_CLASSIFIER: "1" }],
];

const serverCase = ([name, env]: [
	string,
	Record<string, string>,
]): CaseDef => ({
	name: `classifier-server.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				env,
				stub: BASH,
				args: ["--permission-mode", "auto", "--debug-file", "{CFG}/d.log"],
				timeoutMs: 45_000,
			},
			async (r) => {
				const d = await readCfg(r, "d.log");
				const stages = [...d.matchAll(/stage=(\w+) outcome/gu)].map(
					(x) => x[1],
				);
				const line = /\[server-classifier\][^\n]*/u.exec(d)?.[0] ?? "";
				const first = msgs(r)[0];
				const cq = classifierReqs(r)[0] ?? first;
				const cc = cq
					? /cc_version=\d+\.\d+\.\d+\.([0-9a-f]+)/u.exec(sysText(cq))
					: null;
				return {
					from: r,
					data: {
						precondition:
							d.length > 0 &&
							first !== undefined &&
							toolNames(first).includes("Bash"),
						messages: msgs(r).length,
						stages: stages.join(","),
						serverNoResult: d.includes("server_no_result"),
						safeguards: first ? "safeguards" in bodyOf(first) : null,
					},
					samples: {
						serverClassifierLine: line.slice(0, 300),
						classifierBuild: cc?.[1] ?? "",
					},
				};
			},
		),
});

interface Cfg {
	name: string;
	argv: string[];
	cfg?: Record<string, string>;
	proj?: Record<string, string>;
	marker: string;
}
const CFGS: Cfg[] = [
	{
		name: "user",
		argv: ["auto-mode", "config"],
		cfg: { "settings.json": json({ autoMode: { allow: ["ZZUSERALLOW"] } }) },
		marker: "ZZUSERALLOW",
	},
	{
		name: "settings-flag",
		argv: [
			"--settings",
			json({ autoMode: { allow: ["ZZFLAGALLOW"] } }),
			"auto-mode",
			"config",
		],
		marker: "ZZFLAGALLOW",
	},
	{
		name: "project",
		argv: ["auto-mode", "config"],
		proj: {
			".claude/settings.json": json({ autoMode: { allow: ["ZZPROJALLOW"] } }),
		},
		marker: "ZZPROJALLOW",
	},
	{
		name: "local",
		argv: ["auto-mode", "config"],
		proj: {
			".claude/settings.local.json": json({
				autoMode: { allow: ["ZZLOCALALLOW"] },
			}),
		},
		marker: "ZZLOCALALLOW",
	},
];

const configCase = (c: Cfg): CaseDef => ({
	name: `config.${c.name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				argv: c.argv,
				noPrompt: true,
				...(c.cfg === undefined ? {} : { cfgFiles: c.cfg }),
				...(c.proj === undefined ? {} : { projFiles: c.proj }),
			},
			(r) => ({
				from: r,
				data: {
					precondition: r.code !== null && !r.timedOut,
					seen: r.stdout.includes(c.marker),
					stderrHead: r.stderr.slice(0, 80).replaceAll(/\s+/gu, " "),
				},
			}),
		),
});

export const automode: PrintGroup = {
	id: "automode",
	title: "Auto mode (classifyAllShell, classifier server, auto-mode config)",
	run: (ctx) =>
		runCases(ctx, "automode", [
			...ROWS.map((row) => classifyCase(row)),
			...SERVER_VARIANTS.map((v) => serverCase(v)),
			...CFGS.map((c) => configCase(c)),
		]),
};
