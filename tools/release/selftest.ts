// release:check --selftest - proves the child env is built from scratch and the lib pieces work together.
// Steps: (1) childEnv ignores a poisoned parent env, (2) assertSafeEnv rejects credentials, (3) the program
// run against the stub dumps its env from a hook: no parent CLAUDE_CODE_* / ANTHROPIC_* leaked, (4) the
// result goes through results.ts (to a temp dir, not captures/).
import { rm } from "node:fs/promises";

import { pathExists } from "./lib/fs.ts";
import { allocPort } from "./lib/ports.ts";
import { makeSandbox } from "./lib/sandbox.ts";
import { startStub } from "./lib/stub.ts";
import { runResultChecks } from "./selftest/checks.ts";
import { envChecks, makeOut, poisonEnv, SETTINGS } from "./selftest/env.ts";
import { runPartSelftests } from "./selftest/parts.ts";
import { programChecks } from "./selftest/program.ts";
import { binaryPath, type Ctx } from "./util.ts";

const selftestSteps = async (
	ctx: Ctx,
	step: (name: string, ok: boolean, detail?: string) => void,
): Promise<number> => {
	const poisoned = poisonEnv();
	const sb = await makeSandbox({
		git: true,
		trusted: true,
		cfgFiles: { "settings.json": SETTINGS },
	});
	const out = await makeOut();
	const stubPort = await allocPort();
	const stub = await startStub(stubPort);
	try {
		const names = await envChecks(step, sb, out, poisoned.parentLeaks);
		await runPartSelftests(step);
		const bin = binaryPath(ctx.to);
		if (ctx.to === "" || !(await pathExists(bin))) {
			step("program run", false, `binary missing: ${bin}`);
			return 1;
		}
		const dir = await programChecks({
			ctx,
			step,
			sb,
			stub,
			out,
			bin,
			names,
			parentValues: poisoned.parentValues,
		});
		await runResultChecks({ ctx, step, sb, stub, stubPort, out, dir });
		return 0;
	} finally {
		poisoned.restore();
		await stub.stop();
		await sb.cleanup();
		await rm(out, { recursive: true, force: true });
	}
};

export const runSelftest = async (ctx: Ctx): Promise<number> => {
	let failed = 0;
	const step = (name: string, ok: boolean, detail = "") => {
		console.info(
			`${ok ? "PASS" : "FAIL"} ${name}${detail === "" ? "" : `: ${detail}`}`,
		);
		if (!ok) {
			failed++;
		}
	};
	const early = await selftestSteps(ctx, step);
	if (early !== 0) {
		return early;
	}
	console.info(failed === 0 ? "selftest ok" : `selftest failed (${failed})`);
	return failed === 0 ? 0 : 1;
};
