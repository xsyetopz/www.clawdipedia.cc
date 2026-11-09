// release:probe:live - subscription probes. Usage: bun tools/release/cli.ts probe:live [--to V] [--only a,b] [--dry] [--yes]
// The parent (this file) never reads .env. It prints the plan, asks y/N on the TTY (default no; no TTY = refuse unless --yes),
// then runs `tools/release/secret-runner.sh oauth bun tools/release/probes/live/run.ts ...`: the whole live runner
// starts under `env -i` with the one secret. --dry runs the same pipeline with a FAKE token, the local stub and a dead
// proxy (no network at all) and never goes through the secret runner.

import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline/promises";

import { cacheNote } from "../../lib/cache.ts";
import { SYSTEM_PATH } from "../../lib/env.ts";
import { DRY_TOKEN } from "../../lib/live/env.ts";
import { type Ctx, ROOT } from "../../util.ts";
import { pick } from "./cases.ts";

const RUNNER = join(ROOT, "tools/release/secret-runner.sh");
const RUN_TS = join(ROOT, "tools/release/probes/live/run.ts");

const plan = async (ctx: Ctx): Promise<void> => {
	const cases = pick(ctx.only);
	console.info(`release:probe:live ${ctx.to}${ctx.dry ? " (dry)" : ""}`);
	console.info("Plan (in run order, one attempt each, no retry):");
	for (const c of cases) {
		console.info(
			`  live.${c.id.padEnd(24)} ${c.title}; requests: ${c.requests}`,
		);
		if (c.note !== undefined) {
			console.info(`      note: ${c.note}`);
		}
	}
	console.info(
		"Cost: runs use your subscription quota on the default model. Only the context-budget and OAuth-parity cases send a prompt ('Reply with OK'); the interactive /usage and /artifacts cases send no prompt, but startup makes a few small API requests each. Every sandbox denies the Artifact tool, so nothing is published.",
	);
	console.info(await cacheNote(ctx.to));
};

const ask = async (): Promise<boolean> => {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const a = await rl.question(
			"Run these cases with your subscription token? [y/N] ",
		);
		return /^y(es)?$/iu.test(a.trim());
	} finally {
		rl.close();
	}
};

/** An exit code when the run must not start (no TTY, or the answer was no); null to go on. */
const confirm = async (ctx: Ctx): Promise<number | null> => {
	if (ctx.rest.includes("--yes")) {
		return null;
	}
	if (!process.stdin.isTTY) {
		console.error(
			"Refusing: no TTY to ask on. Run it in a terminal, or pass --yes.",
		);
		return 3;
	}
	if (!(await ask())) {
		console.info("Not confirmed; nothing was run.");
		return 0;
	}
	return null;
};

export const runProbeLive = async (ctx: Ctx): Promise<number> => {
	if (ctx.to === "") {
		throw new Error("no --to given and no installed binary found");
	}
	if (pick(ctx.only).length === 0) {
		console.info(`no case matches --only ${ctx.only?.join(",")}`);
		return 2;
	}
	await plan(ctx);
	const childArgs = [
		"--to",
		ctx.to,
		...(ctx.only === null ? [] : ["--only", ctx.only.join(",")]),
	];
	if (ctx.dry) {
		// Fake token only in this child; nothing from our env, no secret runner.
		const p = Bun.spawn([process.execPath, RUN_TS, "--dry", ...childArgs], {
			cwd: ROOT,
			env: {
				PATH: `${SYSTEM_PATH}:${dirname(process.execPath)}`,
				CLAUDE_CODE_OAUTH_TOKEN: DRY_TOKEN,
			},
			stdio: ["ignore", "inherit", "inherit"],
		});
		return p.exited;
	}
	const stop = await confirm(ctx);
	if (stop !== null) {
		return stop;
	}
	const p = Bun.spawn(
		[RUNNER, "oauth", process.execPath, RUN_TS, ...childArgs],
		{
			cwd: ROOT,
			// only what the runner itself needs ($HOME for its PATH); it starts the child with env -i
			env: { PATH: "/usr/bin:/bin", HOME: homedir() },
			stdio: ["inherit", "inherit", "inherit"],
		},
	);
	return p.exited;
};
