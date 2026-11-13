// Status line timing probes.
// The helper logs one row per call into the sandbox; intervals come from those times and from RAW.idx read bursts.
// Out of tolerance is not a failure: the case reruns once and is marked flaky when the rerun disagrees.
import {
	ASK,
	ESC,
	gaps,
	keysOf,
	median,
	type Obj,
	obj,
	pre,
	type PtyCase,
	type PtyGroup,
	type PtyRun,
	round,
	screenAfter,
	sentAt,
	shows,
	TOUCH,
	WAIT,
} from "./harness.ts";

/** The status line row appears once the UI is up (the footer hint is replaced while a status line is set). */
const UP = { ...WAIT("SL-ROW1", "ready", 30), rebase: true };

const SL = (extra: Obj = {}): Obj => ({
	statusLine: {
		type: "command",
		command: "/bin/bash {HOME}/sl.sh main",
		padding: 1,
		...extra,
	},
});

interface Call {
	t: number;
	stdin: Obj;
}
const calls = (x: PtyRun, kind: string): Call[] => {
	const lines = x.file(`sllog/${kind}.log`).split("\n");
	const out: Call[] = [];
	for (let i = 0; i < lines.length; i++) {
		const m = lines[i]?.match(/^(\d+\.\d+) ENV/u);
		if (!m) {
			continue;
		}
		let stdin: Obj = {};
		try {
			stdin = obj(JSON.parse(lines[i + 1] ?? "{}"));
		} catch {
			// keep empty
		}
		out.push({ t: Number(m[1]), stdin });
	}
	return out;
};
const between = (c: Call[], from: number, to: number): number =>
	c.filter((k) => k.t >= from && k.t < to).length;

/** RAW.idx: gaps between output bursts (a read after more than 1 s of quiet). */
const idxBurstGaps = (x: PtyRun): number[] => {
	const t = x.pty.idx.map((i) => i.t);
	return gaps(t.filter((v, i) => i === 0 || v - (t[i - 1] ?? v) > 1));
};

/** Data for an interval: the tolerance verdict and a whole-second median. The raw numbers go to samples (intervalSamples). */
const interval = (
	c: Call[],
	expected: number,
): {
	expectedIntervalS: number;
	toleranceS: number;
	medianIntervalS: number | null;
	withinTolerance: boolean;
} => {
	const med = median(gaps(c.map((k) => k.t)));
	return {
		expectedIntervalS: expected,
		toleranceS: 1,
		medianIntervalS: round(med, 0),
		withinTolerance: med !== null && Math.abs(med - expected) <= 1,
	};
};
const intervalSamples = (c: Call[]): Record<string, string> => {
	const iv = gaps(c.map((k) => k.t));
	return {
		invocations: String(c.length),
		medianIntervalS: String(round(median(iv), 2)),
		minIntervalS: String(round(iv.length > 0 ? Math.min(...iv) : null, 2)),
		maxIntervalS: String(round(iv.length > 0 ? Math.max(...iv) : null, 2)),
	};
};

const refresh: PtyCase = {
	id: "statusline.refresh-interval",
	settings: SL({ refreshInterval: 3 }),
	schedule: [UP],
	secs: 26,
	facts: ["statusline.timing"],
	notes:
		"Idle session with refreshInterval 3: expected interval 3 s +-1 s (observed values are the data).",
	retryIf: (f) => f["withinTolerance"] === false,
	samples: (x) => ({
		...intervalSamples(calls(x, "main")),
		idxBurstMedianGapS: String(round(median(idxBurstGaps(x)), 2)),
	}),
	data: (x) => {
		const c = calls(x, "main");
		return {
			...pre(c.length > 0, "status line command never ran"),
			...interval(c, 3),
			rowShown: shows(x, "SL-ROW1"),
			stdinKeys: keysOf(c[0]?.stdin ?? {}),
		};
	},
};

const noTick: PtyCase = {
	id: "statusline.idle-no-tick",
	settings: SL(),
	schedule: [UP],
	secs: 32,
	facts: ["statusline.timing"],
	notes:
		"Idle session and no refreshInterval: the main status line is expected to run only at start (no periodic tick).",
	retryIf: (f) => f["withinTolerance"] === false,
	data: (x) => {
		const c = calls(x, "main");
		return {
			...pre(c.length > 0, "status line command never ran"),
			subInvocations: calls(x, "sub").length,
			withinTolerance: c.length <= 2,
		};
	},
	samples: (x) => ({ invocations: String(calls(x, "main").length) }),
};

const dialogPause: PtyCase = {
	id: "statusline.dialog-pause",
	settings: SL({ refreshInterval: 3 }),
	stub: TOUCH("ran-sl"),
	schedule: [UP, ASK(), WAIT("proceed?", "dialog"), ESC(26)],
	secs: 28,
	facts: ["statusline.timing"],
	notes:
		"refreshInterval 3 and a permission dialog held open for about 20 s; runs are expected to pause while it shows.",
	retryIf: (f) => f["withinTolerance"] === false,
	data: (x) => {
		const c = calls(x, "main");
		const d = sentAt(x, "dialog");
		const e = sentAt(x, "esc");
		const during = d !== null && e !== null ? between(c, d + 1, e) : -1;
		return {
			...pre(
				d !== null && c.length > 0,
				"dialog never opened or no status line calls",
			),
			pausedDuringDialog: during >= 0 && during <= 1,
			withinTolerance: during >= 0 && during <= 1,
		};
	},
	samples: (x) => {
		const c = calls(x, "main");
		const d = sentAt(x, "dialog");
		const e = sentAt(x, "esc");
		return {
			invocationsBeforeDialog: String(
				d === null ? -1 : c.filter((k) => k.t < d).length,
			),
			invocationsDuringDialog: String(
				d !== null && e !== null ? between(c, d + 1, e) : -1,
			),
			dialogSeconds: String(d !== null && e !== null ? round(e - d, 1) : ""),
		};
	},
};

const debounce: PtyCase = {
	id: "statusline.debounce",
	settings: SL(),
	schedule: [
		UP,
		ESC(10, "esc"),
		{ t: 12, send: "\u001B[Z", label: "to-manual" },
		{ t: 20, send: "\u001B[Z", label: "t20-1" },
		{ t: 20.1, send: "\u001B[Z", label: "t20-2" },
		{ t: 20.2, send: "\u001B[Z", label: "t20-3" },
		{ t: 30, send: "\u001B[Z\u001B[Z\u001B[Z", label: "t30-one-write" },
	],
	secs: 38,
	facts: ["statusline.debounce"],
	notes:
		"Shift+Tab (mode change) three times in 0.2 s, then three in one write; counts status line runs in the 3 s after each burst (expected 1 each).",
	retryIf: (f) => f["withinTolerance"] === false,
	data: (x) => {
		const c = calls(x, "main");
		const a = sentAt(x, "t20-1");
		const b = sentAt(x, "t30-one-write");
		const n1 = a === null ? -1 : between(c, a, a + 3);
		const n2 = b === null ? -1 : between(c, b, b + 3);
		// Shift+Tab must have changed the mode, or the burst tested nothing
		const modeShown = /(manual|plan|auto) mode on|accept edits on/iu.test(
			screenAfter(x, "to-manual").replaceAll(/\s+/gu, " "),
		);
		return {
			...pre(
				c.length > 0 && a !== null && n1 >= 1 && n2 >= 1 && modeShown,
				`no status line calls, no run after a burst (${n1}, ${n2}), or no mode label after Shift+Tab (${modeShown})`,
			),
			runsAfterThreeSpacedChanges: n1,
			runsAfterThreeInOneWrite: n2,
			modeLabelAfterShiftTab: modeShown,
			withinTolerance: n1 >= 1 && n1 <= 2 && n2 >= 1 && n2 <= 2,
		};
	},
	samples: (x) => ({ totalRuns: String(calls(x, "main").length) }),
};

export const statuslineGroup: PtyGroup = {
	id: "statusline",
	title: "status line timing",
	cases: () => [noTick, refresh, dialogPause, debounce],
};
