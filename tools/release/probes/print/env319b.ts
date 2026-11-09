// Print probes for the second half of the new 2.1.319 env names (task env319b).
// Each variable has an "unset" case and a "set" case, run with the same setup.
import { inertCases } from "./env319b/inertcases.ts";
import { runnerCases } from "./env319b/runnercases.ts";
import { streamCases } from "./env319b/streamcases.ts";
import { tailCases } from "./env319b/tailcases.ts";
import { runCases } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

export const env319b: PrintGroup = {
	id: "env319b",
	title: "New 2.1.319 env names, second half",
	run: (ctx) =>
		runCases(ctx, "env319b", [
			...streamCases,
			...inertCases,
			...runnerCases,
			...tailCases,
		]),
};
