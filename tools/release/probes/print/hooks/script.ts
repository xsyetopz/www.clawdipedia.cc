// `type: "script"` hook entries (ported from p305-print/script.ts): does the program accept them, and which hooks still run?
import type { Data } from "../../../lib/results.ts";
import { baseResult, dispose, oneCase, runCase, toolResults } from "../run.ts";
import { readCfg } from "../run/helpers.ts";
import { mapInOrder } from "../run/seq.ts";
import type { PrintCtx, PrintGroup } from "../types.ts";

const cmd = (n: string) => ({
	type: "command",
	command: `cat >> {CFG}/${n}.log; echo >> {CFG}/${n}.log`,
});
const script = { type: "script", script: "echo x >> {CFG}/script.log" };
const VARIANTS: Record<string, Record<string, unknown>> = {
	"pre-script": {
		PreToolUse: [{ matcher: "Bash", hooks: [script] }],
		PostToolUse: [{ hooks: [cmd("post")] }],
		SessionStart: [{ hooks: [cmd("ss")] }],
	},
	"post-script": {
		PostToolUse: [{ hooks: [script, cmd("post")] }],
		SessionStart: [{ hooks: [cmd("ss")] }],
	},
	"pre-script-only": { PreToolUse: [{ matcher: "Bash", hooks: [script] }] },
	"no-script": {
		PreToolUse: [{ matcher: "Bash", hooks: [cmd("pre")] }],
		PostToolUse: [{ hooks: [cmd("post")] }],
		SessionStart: [{ hooks: [cmd("ss")] }],
	},
};

const debugLines = (dbg: string): string[] =>
	dbg
		.split("\n")
		.filter((l) =>
			/script|Unknown hook|hook.*ignored|Invalid|settings.*(skip|invalid)/iu.test(
				l,
			),
		)
		.slice(0, 4);

const runOne = (ctx: PrintCtx, name: string, hooks: Record<string, unknown>) =>
	oneCase(ctx, `print.hooks.script.${name}`, async () => {
		const r = await runCase(ctx.bin, {
			tool: "Bash",
			toolInput: { command: "echo hi" },
			args: ["--allowedTools", "Bash", "--debug-file", "{CFG}/debug.log"],
			cfgFiles: { "settings.json": JSON.stringify({ hooks }) },
		});
		try {
			const dbg = await readCfg(r, "debug.log");
			const logs = await mapInOrder(
				["script", "pre", "post", "ss"],
				async (x) => ({ x, on: (await readCfg(r, `${x}.log`)) !== "" }),
			);
			const ran = logs.filter((l) => l.on).map((l) => l.x);
			const data: Record<string, Data> = {
				precondition:
					r.code === 0 &&
					dbg !== "" &&
					toolResults(r) >= 1 &&
					(name !== "no-script" ||
						["pre", "post", "ss"].every((x) => ran.includes(x))),
				"tool.results": toolResults(r),
				ran,
				"script.rejected": dbg.includes('Unknown hook type "script"'),
				"settings.skipped": dbg.includes("Invalid setting skipped"),
			};
			return baseResult(ctx, `print.hooks.script.${name}`, r, {
				data,
				samples: {
					debug_lines: debugLines(dbg)
						.map((l) => l.slice(0, 300))
						.join("\n"),
				},
			});
		} finally {
			await dispose(r);
		}
	});

export const scriptGroup: PrintGroup = {
	id: "hooks.script",
	title: "Script hook type acceptance",
	run: async (ctx) => {
		const all = await mapInOrder(Object.entries(VARIANTS), ([n, h]) =>
			runOne(ctx, n, h),
		);
		return all.flat();
	},
};
