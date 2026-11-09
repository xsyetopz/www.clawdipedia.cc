// Entry executed INSIDE tools/release/secret-runner.sh (or with the fake token for --dry). Do not run it by hand.
// Reads the token from its own env (liveToken), runs the selected live cases one at a time, writes
// captures/<v>/live/<case>.json. One attempt per case, no retry. Prints one line per case and no secret.
import { rm } from "node:fs/promises";

import { maybeWarm, recordLiveRun } from "../../lib/cache.ts";
import { redact } from "../../lib/results.ts";
import { parseCtx } from "../../util.ts";
import { eachInOrder } from "../print/run/seq.ts";
import { pick } from "./cases.ts";
import { scrubResult } from "./harness.ts";
import { makeCtx, preflight } from "./run/ctx.ts";
import { markWarm, messageOf, record, runSafely } from "./run/report.ts";

const main = async (): Promise<number> => {
	const ctx = await parseCtx(process.argv.slice(2));
	const { token, bin } = await preflight(ctx);
	const cases = pick(ctx.only);
	if (cases.length === 0) {
		console.info(`no case matches --only ${ctx.only?.join(",")}`);
		return 2;
	}
	const suspectWarm = !ctx.dry && (await maybeWarm(ctx.to));
	const { x, tmp } = await makeCtx(ctx, token, bin);
	console.info(
		`release:probe:live ${ctx.to}${ctx.dry ? " (dry, fake token, local stub)" : ""}`,
	);
	let invalid = 0;
	// Record before the first real case so an abort still counts as a run (the cache may be warm after it).
	if (!ctx.dry) {
		await recordLiveRun(ctx.to);
	}
	try {
		await eachInOrder(cases, async (c) => {
			const results = await runSafely(c, x);
			await eachInOrder(results, async (r00) => {
				const r = markWarm(scrubResult(r00), c, suspectWarm);
				if (await record(x.runDir, r, ctx.dry)) {
					invalid++;
				}
			});
		});
	} finally {
		await x.stub?.stop();
		if (tmp !== "") {
			await rm(tmp, { recursive: true, force: true });
		}
	}
	if (!ctx.dry) {
		await recordLiveRun(ctx.to);
	}
	console.info(
		`${cases.length} case(s), ${invalid} invalid probe(s)${ctx.dry ? " (dry: invalid cases only show the fake token is not a real login)" : ""}`,
	);
	if (ctx.dry || invalid === 0) {
		return 0;
	}
	return 1;
};

try {
	process.exitCode = await main();
} catch (error) {
	console.error(`release:probe:live: ${redact(messageOf(error))}`);
	process.exitCode = 1;
}
