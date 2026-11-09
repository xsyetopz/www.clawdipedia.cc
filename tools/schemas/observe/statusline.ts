// Usage: bun tools/schemas/observe/statusline.ts <out-dir> [--to <version>]
// Runs the status line pty probes (fake key, local stub, temp HOME) and records the key paths and JSON types
// of the JSON that the program writes to the status line command's stdin. No value is kept.
// Roots: `$root` for the main status line, `subagentStatusLineInput` for the subagent panel.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";
import { binaryPath } from "../../release/lib/env.ts";
import {
	ASK,
	type PtyCase,
	type PtyRun,
	runPtyCase,
	stopStub,
	WAIT,
} from "../../release/probes/pty/harness.ts";
import { statuslineGroup } from "../../release/probes/pty/statusline.ts";
import { Tally } from "../observe.ts";

const out = process.argv[2];
const ti = process.argv.indexOf("--to");
const version =
	ti === -1
		? CLAUDE_CODE_VERSION
		: (process.argv[ti + 1] ?? CLAUDE_CODE_VERSION);
if (out === undefined || out === "") {
	throw new Error("usage: <out-dir> [--to <version>]");
}

const tally = new Tally();
const counts = { main: 0, sub: 0, runs: 0 };
const feed = (x: PtyRun, kind: "main" | "sub"): void => {
	const lines = x.file(`sllog/${kind}.log`).split("\n");
	for (let i = 0; i < lines.length; i++) {
		if (!/^\d+\.\d+ ENV/u.test(lines[i] ?? "")) {
			continue;
		}
		try {
			const parsed: unknown = JSON.parse(lines[i + 1] ?? "");
			tally.add(kind === "main" ? "$root" : "subagentStatusLineInput", parsed);
			counts[kind]++;
		} catch {
			// not JSON: skip
		}
	}
};
const watch = ({ retryIf: _r, ...c }: PtyCase): PtyCase => ({
	...c,
	data: (x) => {
		counts.runs++;
		feed(x, "main");
		feed(x, "sub");
		return c.data(x);
	},
});

// The cases run one after another: each one drives a real terminal.
const runInTurn = async (
	ctx: Parameters<typeof runPtyCase>[0],
	cases: PtyCase[],
	index = 0,
): Promise<void> => {
	const c = cases[index];
	if (c === undefined) {
		return;
	}
	const r = await runPtyCase(ctx, c);
	console.info(c.id, r[0]?.data["precondition"] === false ? "INVALID" : "ok");
	await runInTurn(ctx, cases, index + 1);
};

const runDir = await mkdtemp(join(tmpdir(), "obs-sl-"));
try {
	const ctx = {
		version,
		bin: binaryPath(version),
		runDir,
		only: null,
		dry: false,
	};
	const all = statuslineGroup.cases(ctx);
	const get = (id: string) => {
		const c = all.find((k) => k.id === id);
		if (!c) {
			throw new Error(`no case ${id}`);
		}
		return c;
	};
	const refresh = get("statusline.refresh-interval");
	const cases: PtyCase[] = [
		watch(refresh),
		watch(get("statusline.subagent-tick")),
		// a turn first, so the fields that need a finished request show up
		watch({
			...refresh,
			id: "statusline.obs-turn",
			schedule: [{ ...WAIT("SL-ROW1", "ready", 30), rebase: true }, ASK()],
			secs: 22,
		}),
	];
	await runInTurn(ctx, cases);
} finally {
	await stopStub();
	await rm(runDir, { recursive: true, force: true });
}
await mkdir(out, { recursive: true });
await Bun.write(
	join(out, "statusline.json"),
	`${JSON.stringify({ counts, paths: tally }, null, 1)}\n`,
);
console.info(JSON.stringify(counts));
