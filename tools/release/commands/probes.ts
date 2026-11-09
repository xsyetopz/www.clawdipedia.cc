import { runProbeLive } from "../probes/live/index.ts";
import { runProbeManaged } from "../probes/managed/index.ts";
import { runProbePrint } from "../probes/print/index.ts";
import { runProbePty } from "../probes/pty/index.ts";
import type { Ctx } from "../util.ts";

export interface Command {
	run: (ctx: Ctx) => Promise<number>;
	summary: string;
}

export const PROBE_COMMANDS: Record<string, Command> = {
	"probe:print": {
		run: runProbePrint,
		summary: "print-mode probes against the local stub (--only, --dry)",
	},
	"probe:pty": {
		run: runProbePty,
		summary: "interactive probes through the pty driver (--only, --dry)",
	},
	"probe:live": {
		run: runProbeLive,
		summary:
			"subscription probes via the secret runner; asks first (--only, --dry, --yes)",
	},
	"probe:managed": {
		run: runProbeManaged,
		summary: "managed-folder probes; prints the sudo command (--only, --dry)",
	},
};
