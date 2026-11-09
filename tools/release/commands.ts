// The commands of tools/release/cli.ts.
import { runAll } from "./all.ts";
import { runCheck } from "./check.ts";
import { runClean } from "./clean.ts";
import { type Command, PROBE_COMMANDS } from "./commands/probes.ts";
import { runDiff } from "./diff/diff.ts";
import { runCompare } from "./facts/compare.ts";
import { runFacts } from "./facts/facts.ts";
import { runPrompts, runSchemas } from "./wrap.ts";

export const COMMANDS: Record<string, Command> = {
	check: { run: runCheck, summary: "preflight; writes env.json" },
	diff: {
		run: runDiff,
		summary: "strings diff of --from and --to; writes diff/*",
	},
	clean: {
		run: runClean,
		summary:
			"cc-inspect clean of --from and --to; writes captures/<version>/clean/",
	},
	schemas: {
		run: runSchemas,
		summary: "wrap `bun run schemas`; writes schemas-diff.json",
	},
	prompts: { run: runPrompts, summary: "wrap tools/capture-prompts" },
	...PROBE_COMMANDS,
	facts: {
		run: runFacts,
		summary:
			"version-labelled facts in docs/ and their probes (--check, --all); writes facts.json",
	},
	compare: {
		run: runCompare,
		summary:
			"compare <from> <to> [--samples]; writes compare/<from>..<to>.json and compare.md",
	},
	all: {
		run: runAll,
		summary:
			"check, schemas, diff, clean, prompts, probe:print, probe:pty, facts, compare; lists managed/live as needs you",
	},
};
