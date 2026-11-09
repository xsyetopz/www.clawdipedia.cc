import { runFactsSelftest } from "../facts/selftest.ts";
import { runLiveSelftest } from "../lib/live/selftest.ts";
import { runPtySelftest } from "../lib/pty/selftest.ts";
import type { Step } from "./checks/util.ts";

/** The offline self-tests of the facts, the pty driver and the live pieces. */
export const runPartSelftests = async (step: Step): Promise<void> => {
	await runFactsSelftest(step);
	await runPtySelftest(step);
	await runLiveSelftest(step);
};
