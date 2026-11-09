// CLAUDE_CODE_PERFETTO_TRACE values (ported from p305-print/perf.ts): what the debug log says and which trace files appear.
import type { Data } from "../../lib/results.ts";
import {
	baseResult,
	dispose,
	listFiles,
	oneCase,
	readIf,
	runCase,
} from "./run.ts";
import { mapInOrder } from "./run/seq.ts";
import type { PrintCtx, PrintGroup } from "./types.ts";

const VALUES: [string, string][] = [
	["one", "1"],
	["path", "{HOME}/trace.pftrace"],
	["pathdir", "{HOME}/out/"],
];

const runOne = (ctx: PrintCtx, name: string, value: string) =>
	oneCase(ctx, `print.perfetto.${name}`, async () => {
		const r = await runCase(ctx.bin, {
			args: ["--debug-file", "{CFG}/debug.log"],
			env: {
				CLAUDE_CODE_PERFETTO_TRACE: value,
				CLAUDE_CODE_PERFETTO_WRITE_INTERVAL_S: "1",
			},
		});
		try {
			const dbg = await readIf(`${r.sb.cfg}/debug.log`);
			const lines = dbg.split("\n").filter((l) => /perfetto/iu.test(l));
			const allFiles = await listFiles(r.sb.root);
			const files = allFiles.filter((f) => /trace|perfetto|pftrace/iu.test(f));
			const data: Record<string, Data> = {
				precondition: r.code === 0 && dbg !== "",
				"init.called": lines.some((l) =>
					l.includes("initializePerfettoTracing called"),
				),
				"debug.lines": lines.length,
				"trace.files": files,
			};
			return baseResult(ctx, `print.perfetto.${name}`, r, {
				data,
				samples: { debug_lines: lines.map((l) => l.slice(0, 200)).join("\n") },
			});
		} finally {
			await dispose(r);
		}
	});

export const perfettoGroup: PrintGroup = {
	id: "perfetto",
	title: "Perfetto tracing env var",
	run: async (ctx) => {
		const groups = await mapInOrder(VALUES, ([n, v]) => runOne(ctx, n, v));
		return groups.flat();
	},
};
