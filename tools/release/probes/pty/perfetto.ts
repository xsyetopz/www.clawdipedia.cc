// Interactive Perfetto trace: one standard prompt, then list trace files.
// Print mode wrote no trace file on 2.1.305; this records whether the interactive screen does.
import {
	ASK,
	type Data,
	ESC,
	pre,
	type PtyCase,
	type PtyGroup,
	type PtyRun,
	READY,
} from "./harness.ts";

const traceData = (x: PtyRun, value: string): Record<string, Data> => {
	const files = x.tree.filter((f) => /trace|perfetto|pftrace/iu.test(f));
	return {
		...pre(x.messages.length > 0, "the program never reached the stub"),
		value,
		traceFiles: files
			.map((f) => f.replaceAll(/ccrel-[A-Za-z0-9]+/gu, "<TMP>"))
			.toSorted(),
		traceFileCount: files.length,
	};
};

const perfetto = (name: string, value: string): PtyCase => ({
	id: `perfetto.interactive-${name}`,
	env: {
		CLAUDE_CODE_PERFETTO_TRACE: value,
		CLAUDE_CODE_PERFETTO_WRITE_INTERVAL_S: "1",
	},
	schedule: [READY, ASK(), ESC(12)],
	secs: 14,
	facts: ["env.CLAUDE_CODE_PERFETTO_TRACE"],
	notes: `CLAUDE_CODE_PERFETTO_TRACE=${value}, write interval 1 s, one interactive prompt.`,
	data: (x) => traceData(x, value),
});

export const perfettoGroup: PtyGroup = {
	id: "perfetto",
	title: "interactive Perfetto trace output",
	cases: () => [perfetto("one", "1"), perfetto("path", "{HOME}/trace.pftrace")],
};
