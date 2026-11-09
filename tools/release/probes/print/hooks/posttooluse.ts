// PostToolUse / PostToolUseFailure hook input shapes per tool (ported from p305-print/ptu.ts).
// The stub asks for the tool(s); a command hook logs its stdin JSON; the data is the key sets.
import type { Data } from "../../../lib/results.ts";
import {
	arr,
	baseResult,
	type Case,
	dispose,
	msgs,
	obj,
	oneCase,
	type Run,
	runCase,
	type Seq,
	toolResults,
} from "../run.ts";
import { readCfg, show } from "../run/helpers.ts";
import { mapInOrder } from "../run/seq.ts";
import type { PrintCtx, PrintGroup } from "../types.ts";
import { failureData, hookData } from "./ptulog.ts";

const logHook = (name: string) => ({
	hooks: [
		{
			type: "command",
			command: `cat >> {CFG}/${name}.log; echo >> {CFG}/${name}.log`,
		},
	],
});
const SETTINGS = JSON.stringify({
	hooks: {
		PostToolUse: [logHook("ptu")],
		PostToolUseFailure: [logHook("ptuf")],
	},
});

const EDIT = {
	file_path: "{PROJ}/a.txt",
	old_string: "one",
	new_string: "two",
};
const READ = { name: "Read", input: { file_path: "{PROJ}/a.txt" } };
const AGENT = {
	description: "d",
	prompt: "say hi",
	subagent_type: "general-purpose",
};
const CASES: [string, Seq][] = [
	["bash", [{ name: "Bash", input: { command: "echo hi" } }]],
	["read", [READ]],
	[
		"write",
		[
			{
				name: "Write",
				input: { file_path: "{PROJ}/new.txt", content: "hello\n" },
			},
		],
	],
	["edit", [READ, { name: "Edit", input: EDIT }]],
	["edit-no-read", [{ name: "Edit", input: EDIT }]],
	[
		"toolsearch",
		[{ name: "ToolSearch", input: { query: "select:Read", max_results: 3 } }],
	],
	["agent", [{ name: "Agent", input: AGENT }]],
	[
		"agent-bg",
		[{ name: "Agent", input: { ...AGENT, run_in_background: true } }],
	],
	["listagents", [{ name: "ListAgents", input: {} }]],
	[
		"croncreate",
		[
			{
				name: "CronCreate",
				input: { cron: "*/5 * * * *", prompt: "x", recurring: true },
			},
		],
	],
	["cronlist", [{ name: "CronList", input: {} }]],
	["glob", [{ name: "Glob", input: { pattern: "*.txt" } }]],
	["grep", [{ name: "Grep", input: { pattern: "one" } }]],
	[
		"notebookedit",
		[
			{
				name: "NotebookEdit",
				input: {
					notebook_path: "{PROJ}/n.ipynb",
					new_source: "x",
					edit_mode: "insert",
					cell_type: "code",
				},
			},
		],
	],
	[
		"webfetch",
		[{ name: "WebFetch", input: { url: "http://127.0.0.1:9/x", prompt: "p" } }],
	],
	["websearch", [{ name: "WebSearch", input: { query: "x" } }]],
	[
		"edit-after-write",
		[
			{ name: "Write", input: { file_path: "{PROJ}/w.txt", content: "one\n" } },
			{ name: "Edit", input: { ...EDIT, file_path: "{PROJ}/w.txt" } },
		],
	],
	[
		"edit-after-bash",
		[
			{ name: "Bash", input: { command: "cat a.txt" } },
			{ name: "Edit", input: EDIT },
		],
	],
	[
		"edit-partial-read",
		[
			{
				name: "Read",
				input: { file_path: "{PROJ}/a.txt", offset: 1, limit: 1 },
			},
			{ name: "Edit", input: EDIT },
		],
	],
];

const outcomeOf = (offered: boolean, results: number, wanted: number) => {
	if (!offered) {
		return "not-offered";
	}
	return results >= wanted ? "ran" : "no-result";
};

const caseData = async (r: Run, seq: Seq): Promise<Record<string, Data>> => {
	const toolNames = arr(obj(msgs(r)[0]?.body)["tools"]).map((t) =>
		show(obj(t)["name"]),
	);
	const offered = toolNames.includes(seq[0]?.name ?? "");
	const results = toolResults(r);
	// not-offered is a recorded outcome (the tool is deferred or absent), not a broken probe
	const outcome = outcomeOf(offered, results, seq.length);
	const log = await readCfg(r, "ptu.log");
	const lines = log.split("\n").filter((l) => l !== "");
	return {
		precondition: r.code === 0 && msgs(r).length > 0 && outcome !== "no-result",
		outcome,
		"tool.offered": offered,
		"tool.results": results,
		"hook.calls": lines.length,
		...hookData(lines),
	};
};

const runOne = (ctx: PrintCtx, name: string, seq: Seq) =>
	oneCase(ctx, `print.hooks.posttooluse.${name}`, async () => {
		const c: Case = {
			seq,
			args: [
				"--permission-mode",
				"acceptEdits",
				"--allowedTools",
				"Bash,Read,Write,Edit,ToolSearch,Agent",
			],
			projFiles: { "a.txt": "one\ntwo\n" },
			cfgFiles: { "settings.json": SETTINGS },
			timeoutMs: 45_000,
		};
		const r = await runCase(ctx.bin, c);
		try {
			const data = await caseData(r, seq);
			const fail = await readCfg(r, "ptuf.log");
			Object.assign(data, failureData(fail));
			return baseResult(ctx, `print.hooks.posttooluse.${name}`, r, {
				data,
				samples: fail === "" ? undefined : { failure_hook: fail },
				notes: "Stub requests the tool; the hook logs its stdin.",
			});
		} finally {
			await dispose(r);
		}
	});

export const ptuGroup: PrintGroup = {
	id: "hooks.posttooluse",
	title: "PostToolUse hook input and tool_response shapes",
	run: async (ctx) => {
		const all = await mapInOrder(CASES, ([name, seq]) =>
			runOne(ctx, name, seq),
		);
		return all.flat();
	},
};
