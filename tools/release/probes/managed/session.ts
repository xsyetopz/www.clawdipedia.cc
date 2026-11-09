import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { onCleanup } from "../../lib/cleanup.ts";
import type { Ctx } from "../../util.ts";
import { stopStub } from "../print/run.ts";
import { buildStage, type Phase, PHASES } from "./fixtures.ts";
import { type PhaseCtx, phaseSelected } from "./phases.ts";
import {
	cleanupCommand,
	installCommand,
	type Scripts,
	writeScripts,
} from "./script.ts";
import { folderState } from "./state.ts";

export interface Session {
	ctx: Ctx;
	stage: string;
	startedLog: string;
	scripts: Scripts;
	pctx: PhaseCtx;
	phases: Phase[];
	needsFolder: boolean;
	keepStage: boolean;
	total: number;
	invalid: number;
}

/** Builds the stage dir and the scripts; any exit tells the root script to stop and shows the cleanup command if needed. */
export const openSession = async (ctx: Ctx, bin: string): Promise<Session> => {
	const stage = await realpath(await mkdtemp(join(tmpdir(), "ccrel-managed-")));
	const startedLog = join(stage, "started.log");
	await Bun.write(startedLog, "");
	await buildStage(stage, startedLog);
	const scripts = await writeScripts(stage);
	const pctx: PhaseCtx = {
		version: ctx.to,
		bin,
		startedLog,
		...(ctx.only === null ? {} : { only: ctx.only }),
		dry: ctx.dry,
	};
	const phases = PHASES.filter((p) => phaseSelected(pctx, p));
	onCleanup(async () => {
		await writeFile(join(stage, "abort"), "").catch(() => {
			// stage already removed
		});
		if (!ctx.dry && (await folderState()) === "ours") {
			console.info(
				`\nThe managed folder is still installed. Remove it:\n\n  ${cleanupCommand(scripts)}\n`,
			);
		}
	});
	return {
		ctx,
		stage,
		startedLog,
		scripts,
		pctx,
		phases,
		needsFolder: phases.some((p) => p !== "baseline"),
		keepStage: false,
		total: 0,
		invalid: 0,
	};
};

export const signal = (s: Session, name: string): Promise<void> =>
	writeFile(join(s.stage, name), "");

export const printCommands = (s: Session): void => {
	console.info(
		`\nRun this in a second terminal (it asks for your password once; read ${s.scripts.install} first):\n\n  ${installCommand(s.scripts)}\n`,
	);
	console.info(
		`Cleanup (the script also does it when it ends; use it if the script was interrupted):\n\n  ${cleanupCommand(s.scripts)}\n`,
	);
};

export const finish = async (s: Session): Promise<void> => {
	const stray = await stopStub();
	if (stray.length > 0) {
		s.invalid++;
		console.info(
			`STRAY ${stray.length} request(s) reached the stub without a case id`,
		);
	}
	if (!s.ctx.dry && (await folderState()) === "ours") {
		s.keepStage = true;
	}
	if (!s.keepStage) {
		await rm(s.stage, { recursive: true, force: true });
	} else if (!s.ctx.dry) {
		console.info(`stage kept: ${s.stage}`);
	}
};
