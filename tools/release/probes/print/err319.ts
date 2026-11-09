// Print probes for the 2.1.319 user-triggerable error texts (task err319).
// Each case records the lines that carry the text, so the docs quote what the program printed.
import { configCases } from "./err319/config.ts";
import { loginCases } from "./err319/login.ts";
import { miscCases } from "./err319/misc.ts";
import { writeCases } from "./err319/writes.ts";
import { runCases } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

export const err319: PrintGroup = {
	id: "err319",
	title: "Error texts a user can trigger (2.1.319)",
	run: (ctx) =>
		runCases(ctx, "err319", [
			...configCases,
			...writeCases,
			...miscCases,
			...loginCases,
		]),
};
