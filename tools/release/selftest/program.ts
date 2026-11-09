// The program run of release:check --selftest: the real binary against the stub.
import { join } from "node:path";

import { childEnv, PROMPT } from "../lib/env.ts";
import { runChild } from "../lib/proc.ts";
import { assertShimReady } from "../lib/shim.ts";
import { readLog } from "../lib/stub.ts";
import { dumpChecks, type ProgramRun, resultCheck } from "./after.ts";

/** Runs the program once against the stub. Returns the run dir of the results round trip. */
export const programChecks = async (p: ProgramRun): Promise<string> => {
	const { step, sb, stub, bin } = p;
	const log = join(sb.root, "requests.jsonl");
	const baseUrl = await stub.register("selftest", { log });
	const progEnv = childEnv({ home: sb.home, configDir: sb.cfg, baseUrl });
	await assertShimReady(progEnv);
	const res = await runChild(
		[
			bin,
			"-p",
			PROMPT,
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			"claude-opus-5-5",
		],
		{ cwd: sb.proj, env: progEnv, timeoutMs: 90_000 },
	);
	const reqs = await readLog(log);
	step(
		"program exits 0 against the stub",
		res.code === 0 && !res.timedOut,
		`code ${res.code}`,
	);
	step(
		"stub saw requests, fake key only",
		reqs.length > 0 && reqs.every((r) => !r.bad),
		`${reqs.length} requests`,
	);
	step(
		"reply is OK",
		res.stdout.includes('"result":"OK"') ||
			/"result"\s*:\s*"OK"/u.test(res.stdout),
	);
	await dumpChecks(p);
	return resultCheck(p, res, reqs);
};
