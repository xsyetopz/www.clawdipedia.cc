import { type CaseResult, writeCase } from "../../lib/results.ts";
import { eachInOrder } from "../print/run/seq.ts";
import { type Phase, VARIANTS } from "./fixtures.ts";
import { runPhase, selectedDefs } from "./phases.ts";
import { type Session, signal } from "./session.ts";
import { folderState, installedVariant, waitFor } from "./state.ts";

const report = async (
	s: Session,
	runDir: string,
	r: CaseResult,
): Promise<void> => {
	s.total++;
	if (s.ctx.dry) {
		console.info(`  ${r.id}`);
		return;
	}
	await writeCase(runDir, r);
	const bad = r.data["precondition"] === false;
	if (bad) {
		s.invalid++;
	}
	console.info(
		`  ${bad ? "INVALID" : "ok     "} ${r.id}${bad ? ` (${String(r.data["error"] ?? "")})` : ""}`,
	);
};

const guardFor = (p: Phase) => async (): Promise<string | null> => {
	const st = await folderState();
	if (p === "baseline") {
		return st === "absent"
			? null
			: `managed folder is ${st}, baseline needs it absent`;
	}
	const v = await installedVariant();
	return st === "ours" && v === p
		? null
		: `managed folder is ${st} (variant "${v}"), expected variant ${p}`;
};

export const doPhase = async (
	s: Session,
	p: Phase,
	runDir: string,
): Promise<void> => {
	console.info(`phase ${p}: ${selectedDefs(p, s.pctx).length} case(s)`);
	const results = await runPhase(
		p,
		s.pctx,
		async () => {
			await Bun.write(s.startedLog, "");
		},
		async () => {
			const text = await Bun.file(s.startedLog).text();
			return [
				...new Set(
					text
						.trim()
						.split("\n")
						.filter((l) => l !== "")
						.map((l) => l.split(" ")[0] ?? ""),
				),
			];
		},
		guardFor(p),
	);
	await eachInOrder(results, (r) => report(s, runDir, r));
};

const WAIT_MS = 10 * 60_000;

export const runVariants = async (
	s: Session,
	runDir: string,
): Promise<void> => {
	let stopped = false;
	await eachInOrder(VARIANTS, async (v) => {
		if (stopped) {
			return;
		}
		if (!s.phases.includes(v)) {
			// the script waits for done-V for every variant it installs
			await signal(s, `done-${v}`);
			return;
		}
		const ready = await waitFor(
			async () =>
				(await folderState()) === "ours" && (await installedVariant()) === v,
			WAIT_MS,
		);
		if (!ready) {
			console.error(`timed out waiting for variant ${v}`);
			s.invalid++;
			s.keepStage = true;
			await signal(s, "abort");
			stopped = true;
			return;
		}
		await doPhase(s, v, runDir);
		await signal(s, `done-${v}`);
	});
};
