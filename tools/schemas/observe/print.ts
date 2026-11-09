// Usage: bun tools/schemas/observe/print.ts <out-dir> [--to <version>]
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
if (outDir === undefined || outDir === "") {
	throw new Error("usage: <out-dir> [--to <version>]");
}
await mkdir(outDir, { recursive: true });

const runner = await createRunner(version);

// The cases run one after another: they share the stub and the counts.
const runInTurn = async (index = 0): Promise<void> => {
	const c = cases[index];
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
