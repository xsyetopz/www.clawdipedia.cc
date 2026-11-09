// release:probe:managed - managed-folder probes. Prints the single `sudo` command and the cleanup command; never runs sudo,
// never writes under /Library. The user runs the install script in a second terminal; this tool runs each phase as the
// calling user (fake key, local stub, childEnv) when the script signals that a variant is installed.
// Usage: bun tools/release/cli.ts probe:managed [--to V] [--only a,b] [--dry]
//   --only  phases (baseline, main, true, false), `phase.case`, or the bare case name (classify-neither); the `managed.` prefix is optional
//   --dry   builds the stage in a temp dir, prints the commands and the planned cases, spawns nothing, removes the stage
// Order: baseline phase first (no folder), then the sudo command is printed, then each variant phase as the install script signals it.
import { binaryPath } from "../../lib/env.ts";
import { openRun } from "../../lib/results.ts";
import type { Ctx } from "../../util.ts";
import { eachInOrder } from "../print/run/seq.ts";
import { MANAGED_DIR, MARKER } from "./fixtures.ts";
import { doPhase, runVariants } from "./phase-run.ts";
import { cleanupCommand } from "./script.ts";
import { finish, openSession, printCommands, type Session } from "./session.ts";
import { folderState, waitFor } from "./state.ts";

const runPhases = async (s: Session, runDir: string): Promise<void> => {
	if (s.ctx.dry) {
		if (s.needsFolder) {
			printCommands(s);
		}
		console.info(
			"dry: nothing started, nothing installed, stage removed at exit (the commands above only work without --dry). Planned cases:",
		);
		await eachInOrder(s.phases, (p) => doPhase(s, p, runDir));
		console.info(`${s.total} case(s) planned`);
		return;
	}
	if (s.phases.includes("baseline")) {
		await doPhase(s, "baseline", runDir);
	}
	if (s.needsFolder) {
		printCommands(s);
		console.info(
			"Waiting for the install script (it signals each variant; Ctrl-C to stop)...",
		);
		await runVariants(s, runDir);
		// give the script a moment to remove the folder
		await waitFor(async () => (await folderState()) !== "ours", 10_000);
	}
};

export const runProbeManaged = async (ctx: Ctx): Promise<number> => {
	if (ctx.to === "") {
		throw new Error("no --to given and no installed binary found");
	}
	const bin = binaryPath(ctx.to);
	if (!ctx.dry && !(await Bun.file(bin).exists())) {
		throw new Error(`binary missing: ${bin}`);
	}

	const state = await folderState();
	if (state === "foreign") {
		console.error(
			`${MANAGED_DIR} exists and has no ${MARKER} marker. It is not ours; refusing to continue.\nRemove or move it yourself, then rerun.`,
		);
		return 2;
	}

	const s = await openSession(ctx, bin);
	console.info(`release:probe:managed ${ctx.to}${ctx.dry ? " (dry)" : ""}`);
	console.info(`stage dir: ${s.stage}`);
	console.info(
		`managed folder: ${state === "absent" ? "absent" : "left over from an earlier run (ours)"}`,
	);
	if (state === "ours" && s.phases.includes("baseline")) {
		console.error(
			`A leftover managed folder of ours exists, so the baseline phase is not valid. Remove it first:\n  ${cleanupCommand(s.scripts)}`,
		);
		return 2;
	}

	const runDir = ctx.dry ? "" : await openRun(ctx.to);
	try {
		await runPhases(s, runDir);
	} finally {
		await finish(s);
	}
	if (ctx.dry) {
		return 0;
	}
	console.info(`${s.total} case(s), ${s.invalid} invalid probe(s)`);
	return s.invalid > 0 ? 1 : 0;
};
