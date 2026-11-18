// Usage: bun tools/schemas/observe/print.ts <out-dir> [--to <version>] [--only <id>,<id>] [--keep <dir>]
// Runs print-mode cases against the local stub (fake key, temp HOME and CLAUDE_CONFIG_DIR, no real network:
// the proxy variables point at a closed port) and records, value-free, the key paths and JSON types of:
//   print-otel.json         OTLP/JSON that the program posts to a local collector (logs, metrics, traces)
//   print-transcripts.json  the transcript lines the program wrote
//   print-claude-json.json  the .claude.json the program wrote in the temp config dir
// Roots: `event:<event.name>`, `metric:<name>`, `span:<name>`; the transcript `type`; `$root`.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";
import type { Tally } from "../observe.ts";
import { cases } from "./print/cases.ts";
import { claudeJson, counts, otel, transcripts } from "./print/ingest.ts";
import { createRunner } from "./print/runcase.ts";

const outDir = process.argv[2];
const ti = process.argv.indexOf("--to");
const version =
	ti === -1
		? CLAUDE_CODE_VERSION
		: (process.argv[ti + 1] ?? CLAUDE_CODE_VERSION);
const oi = process.argv.indexOf("--only");
// --only runs a subset of the cases, for work on one case; a full observe run needs every case.
const only =
	oi === -1 ? undefined : new Set((process.argv[oi + 1] ?? "").split(","));
// --keep copies each sandbox (transcripts, request log, output) to <dir>/<case id>, to read why a case wrote no row.
const ki = process.argv.indexOf("--keep");
const keep = ki === -1 ? undefined : process.argv[ki + 1];
const chosen = cases.filter((c) => only === undefined || only.has(c.id));
if (outDir === undefined || outDir === "") {
	throw new Error("usage: <out-dir> [--to <version>]");
}
await mkdir(outDir, { recursive: true });

const runner = await createRunner(version, keep);

// The cases run one after another: they share the stub and the counts.
const runInTurn = async (index = 0): Promise<void> => {
	const c = chosen[index];
	if (c === undefined) {
		return;
	}
	await runner.run(c);
	await runInTurn(index + 1);
};

try {
	await runInTurn();
} finally {
	await runner.stop();
}
const stats = (t: Tally) => ({ counts, paths: t.toJSON() });
await Bun.write(
	join(outDir, "print-otel.json"),
	`${JSON.stringify(stats(otel), null, 1)}\n`,
);
await Bun.write(
	join(outDir, "print-transcripts.json"),
	`${JSON.stringify(stats(transcripts), null, 1)}\n`,
);
await Bun.write(
	join(outDir, "print-claude-json.json"),
	`${JSON.stringify(stats(claudeJson), null, 1)}\n`,
);
console.info(JSON.stringify(counts));
