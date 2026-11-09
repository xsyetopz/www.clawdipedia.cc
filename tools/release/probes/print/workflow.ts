// Workflow subagent model order (ported from p305-print wf.ts).
import {
	bodyOf,
	type CaseDef,
	json,
	msgs,
	runCases,
	toolNames,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const S = "claude-sonnet-5-5";
const H = "claude-haiku-5-5";
const script = (
	opt: string,
) => `export const meta = { name: 'p', description: 'probe', phases: [{ title: 'A' }] }
const r = await agent("PROBEMARK Reply with 'OK'.", { label: 'x', phase: 'A'${opt} })
return { r }`;

const ROWS: [string, string, Record<string, string>][] = [
	["none", "", {}],
	["opt-haiku", "model: 'haiku'", {}],
	[
		"wf-sonnet-opt-haiku",
		"model: 'haiku'",
		{ CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL: S },
	],
	["sub-haiku-no-opt", "", { CLAUDE_CODE_SUBAGENT_MODEL: H }],
	[
		"sub-haiku-opt-sonnet",
		"model: 'sonnet'",
		{ CLAUDE_CODE_SUBAGENT_MODEL: H },
	],
	[
		"wf-sonnet-sub-haiku",
		"",
		{ CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL: S, CLAUDE_CODE_SUBAGENT_MODEL: H },
	],
	[
		"wf-inherit-sub-haiku",
		"",
		{
			CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL: "inherit",
			CLAUDE_CODE_SUBAGENT_MODEL: H,
		},
	],
	[
		"wf-sonnet-sub-haiku-force",
		"",
		{
			CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL: S,
			CLAUDE_CODE_SUBAGENT_MODEL: H,
			CLAUDE_CODE_SUBAGENT_MODEL_FORCE: "1",
		},
	],
];

const rowCase = ([name, opt, env]: (typeof ROWS)[number]): CaseDef => ({
	name: `model-order.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				env,
				args: ["--permission-mode", "bypassPermissions"],
				stub: {
					seq: [
						{
							name: "Workflow",
							input: { script: script(opt ? `, ${opt}` : "") },
						},
					],
				},
			},
			(r) => {
				const ms = msgs(r);
				const main = ms[0];
				const sub = ms.filter(
					(q) =>
						json(bodyOf(q).messages).includes("PROBEMARK") &&
						!toolNames(q).includes("Workflow"),
				);
				return {
					from: r,
					data: {
						precondition:
							main !== undefined &&
							toolNames(main).includes("Workflow") &&
							sub.length > 0,
						messages: ms.length,
						mainModel: main ? (bodyOf(main).model ?? null) : null,
						subagentModels: [...new Set(sub.map((q) => bodyOf(q).model ?? ""))],
					},
				};
			},
		),
});

export const workflow: PrintGroup = {
	id: "workflow",
	title: "Workflow subagent model order",
	run: (ctx) =>
		runCases(
			ctx,
			"workflow",
			ROWS.map((row) => rowCase(row)),
		),
};
