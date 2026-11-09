// The env checks of release:check --selftest: the child env is built from scratch, the shim guards, the TMPDIR rule.
import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertSafeEnv, childEnv, FAKE_KEY } from "../lib/env.ts";
import { pathExists } from "../lib/fs.ts";
import type { Sandbox } from "../lib/sandbox.ts";
import { assertShimReady, shimDir, writeSecurityShim } from "../lib/shim.ts";
import { toolEnv } from "../util.ts";
import { rejects, type Step, throws } from "./checks/util.ts";

/** Set by the program for its own children (hooks); same value as a parent running inside Claude Code by design. */
export const PROGRAM_SET = new Set([
	"PWD",
	"SHLVL",
	"_",
	"CLAUDECODE",
	"CLAUDE_CODE_CHILD_SESSION",
	"NoDefaultCurrentDirectoryInExePath",
	"COREPACK_ENABLE_AUTO_PIN",
]);

export const LEAKS = {
	CLAUDE_CODE_SELFTEST_LEAK: "1",
	ANTHROPIC_AUTH_TOKEN: "leak-token",
	ANTHROPIC_MODEL: "leak-model",
};

/** The sandbox settings: a SessionStart hook that dumps the env the program gave it. */
export const SETTINGS = JSON.stringify({
	hooks: {
		SessionStart: [
			{
				hooks: [
					{
						type: "command",
						command: "/usr/bin/env > {PROJ}/../envdump.txt",
					},
				],
			},
		],
	},
});

/** A fresh temp dir for the results round trip. */
export const makeOut = async (): Promise<string> =>
	mkdtemp(join(await realpath(tmpdir()), "ccrel-self-"));

export interface Poisoned {
	parentLeaks: string[];
	parentValues: Record<string, string | undefined>;
	restore: () => void;
}

/** Puts the leak sentinels into this process env; `restore` puts the old values back. */
export const poisonEnv = (): Poisoned => {
	const saved = Object.fromEntries(
		Object.keys(LEAKS).map((k) => [k, process.env[k]]),
	);
	for (const [k, v] of Object.entries(LEAKS)) {
		process.env[k] = v;
	}
	return {
		parentLeaks: Object.keys(process.env).filter(
			(k) =>
				k.startsWith("CLAUDE_CODE_") ||
				k.startsWith("ANTHROPIC_") ||
				k === "CLAUDECODE",
		),
		parentValues: { ...process.env },
		restore: () => {
			for (const [k, v] of Object.entries(saved)) {
				if (v === undefined) {
					Reflect.deleteProperty(process.env, k);
				} else {
					process.env[k] = v;
				}
			}
		},
	};
};

const sh = async (argv: string[], env: Record<string, string>) => {
	const p = Bun.spawn(argv, { env, stdout: "pipe", stderr: "pipe" });
	const [stdout, exitCode] = await Promise.all([
		new Response(p.stdout).text(),
		p.exited,
	]);
	return { stdout: stdout.trim(), exitCode };
};

const ghostCheck = async (step: Step) => {
	const ghost = "/nonexistent-x";
	const pure = !throws(() =>
		childEnv({
			home: ghost,
			configDir: ghost,
			baseUrl: "http://127.0.0.1:1/x",
		}),
	);
	step(
		"childEnv: pure (no throw, creates nothing)",
		pure && !(await pathExists(ghost)),
	);
};

const shimChecks = async (
	step: Step,
	sb: Sandbox,
	env: Record<string, string>,
) => {
	await writeSecurityShim(sb.home);
	// idempotent
	await writeSecurityShim(sb.home);
	const which = await sh(["/bin/sh", "-c", "command -v security"], env);
	step(
		"childEnv: security shim first on PATH",
		which.stdout.startsWith(join(shimDir(sb.home), "security")),
		which.stdout,
	);
	const shim = await sh(
		["security", "find-generic-password", "-w", "-s", "x"],
		env,
	);
	const ghost = "/nonexistent-x";
	step(
		"assertShimReady refuses a missing shim",
		await rejects(() =>
			assertShimReady(childEnv({ home: ghost, configDir: ghost, baseUrl: "" })),
		),
	);
	step("security shim exits 44", shim.exitCode === 44, `${shim.exitCode}`);
};

/** A generator started with toolEnv() must make its temp dirs where the parent does, not in /tmp. */
const tmpCheck = async (step: Step, out: string) => {
	const saved = process.env["TMPDIR"];
	process.env["TMPDIR"] = out;
	const env = toolEnv();
	if (saved === undefined) {
		Reflect.deleteProperty(process.env, "TMPDIR");
	} else {
		process.env["TMPDIR"] = saved;
	}
	const tmp = await sh(
		[process.execPath, "-e", "console.log(require('os').tmpdir())"],
		env,
	);
	step(
		"toolEnv: child keeps the parent TMPDIR",
		tmp.stdout === out,
		tmp.stdout,
	);
};

/** Returns the names of the child env, for the leak check against the program's own env dump. */
export const envChecks = async (
	step: Step,
	sb: Sandbox,
	out: string,
	parentLeaks: string[],
): Promise<string[]> => {
	const env = childEnv({
		home: sb.home,
		configDir: sb.cfg,
		baseUrl: "http://127.0.0.1:1/x",
	});
	const names = Object.keys(env);
	step(
		"childEnv: no parent names",
		!parentLeaks.some((k) => names.includes(k)) &&
			!names.includes("CLAUDECODE"),
		`${names.length} names`,
	);
	await ghostCheck(step);
	await shimChecks(step, sb, env);
	step("childEnv: fake key only", env["ANTHROPIC_API_KEY"] === FAKE_KEY);
	step(
		"assertSafeEnv rejects CLAUDE_CODE_OAUTH_TOKEN",
		throws(() => {
			assertSafeEnv({ CLAUDE_CODE_OAUTH_TOKEN: "x" });
		}),
	);
	await tmpCheck(step, out);
	return names;
};
