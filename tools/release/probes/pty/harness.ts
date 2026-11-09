// Shared runner for pty probes: one interactive program run per case, in a temp sandbox, against the local stub.
// Ports the p305-pty start.sh/launch.sh/sc.sh flow onto lib/* (env.ts, sandbox.ts, driver.ts, stub.ts).
// Nothing here uses OAuth, the macOS keychain, /tmp fixed paths, or a shell-launched child.
import type { CaseResult } from "../../lib/results.ts";
import { runOnce } from "./harness/once.ts";
import type { PtyCase, PtyCtx } from "./harness/types.ts";

export { PROMPT } from "../../lib/env.ts";
export type { Data } from "../../lib/results.ts";
export { stopStub } from "./harness/base.ts";
export * from "./harness/read.ts";
export * from "./harness/steps.ts";
export * from "./harness/types.ts";

const attemptOf = (
	f: CaseResult,
): NonNullable<CaseResult["attempts"]>[number] => ({
	data: f.data,
	...(f.samples === undefined ? {} : { samples: f.samples }),
});

const runTimed = async (ctx: PtyCtx, c: PtyCase): Promise<CaseResult[]> => {
	const first = await runOnce(ctx, c);
	const f = first[0];
	if (
		f === undefined ||
		ctx.dry ||
		c.retryIf === undefined ||
		f.data["precondition"] === false ||
		!c.retryIf(f.data)
	) {
		return first;
	}
	const second = await runOnce(ctx, c);
	const s = second[0];
	if (s === undefined || s.data["precondition"] === false) {
		return first;
	}
	s.data["rerun"] = true;
	// the first run was out of tolerance; true when the rerun disagrees
	s.data["flaky"] = !c.retryIf(s.data);
	s.data["firstOutOfTolerance"] = true;
	s.attempts = [attemptOf(f)];
	return [s];
};

/** Run one case. Never throws: a failure to run becomes `precondition: false`. Timing cases get one rerun when out of tolerance; an invalid run gets one retry; a case launches the program at most twice. */
export const runPtyCase = async (
	ctx: PtyCtx,
	c: PtyCase,
): Promise<CaseResult[]> => {
	const one = await runTimed(ctx, c);
	const f = one[0];
	if (f === undefined || ctx.dry || f.data["precondition"] !== false) {
		return one;
	}
	// An invalid run (a step timed out, or the case threw) is often a loaded machine: run it once more.
	// runOnce, not runTimed: an invalid first run never reaches the timing rerun, so one launch here keeps
	// the total at 2 launches per case (runTimed here could make it 3).
	const again = await runOnce(ctx, c);
	const s = again[0];
	if (s === undefined) {
		return one;
	}
	s.data["retried"] = true;
	s.attempts = [...(f.attempts ?? []), attemptOf(f)];
	return [s];
};
