// Offline self-test for the live pieces: env guards, planning, the mitm CA and fault replies, the pty live-token path.
// Uses a fake token only. Never reads .env and never touches the network. Called from ../selftest.ts.
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { cacheMarker, planLive } from "../cache.ts";
import { childEnv } from "../env.ts";
import { writeSecurityShim } from "../shim.ts";
import { assertLiveEnv, DRY_TOKEN, liveEnv } from "./env.ts";
import { runMitmSelftest } from "./selftest/mitm.ts";
import { probeChecks, ptyChecks } from "./selftest/probes.ts";

type Step = (name: string, ok: boolean, detail?: string) => void;

const throws = (f: () => unknown): boolean => {
	try {
		f();
		return false;
	} catch {
		return true;
	}
};

const planChecks = (step: Step): void => {
	const marker1 = cacheMarker("x");
	const marker2 = cacheMarker("x");
	const planned = planLive([
		{ id: "a" },
		{ id: "b", coldSensitive: true },
		{ id: "c" },
	]).map((c) => c.id);
	step(
		"planLive: cold-sensitive first, markers unique",
		planned.join(",") === "b,a,c" && marker1 !== marker2,
	);
};

const envChecks = (step: Step, dir: string): void => {
	const env = liveEnv({ home: dir, configDir: dir, token: DRY_TOKEN });
	step(
		"liveEnv: token only, no base url, no api key, no proxy",
		env["CLAUDE_CODE_OAUTH_TOKEN"] === DRY_TOKEN &&
			!("ANTHROPIC_BASE_URL" in env) &&
			!("ANTHROPIC_API_KEY" in env) &&
			!("HTTPS_PROXY" in env),
	);
	const gates = liveEnv({
		home: dir,
		configDir: dir,
		token: DRY_TOKEN,
		featureGates: true,
	});
	step(
		"liveEnv: featureGates keeps telemetry and nonessential traffic on",
		env["DISABLE_TELEMETRY"] === "1" &&
			!("DISABLE_TELEMETRY" in gates) &&
			!("CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC" in gates),
	);
	step(
		"assertLiveEnv rejects other credentials and a different token",
		throws(() => {
			assertLiveEnv({ GH_TOKEN: "x" }, DRY_TOKEN);
		}) &&
			throws(() => {
				assertLiveEnv({ ANTHROPIC_API_KEY: "x" }, DRY_TOKEN);
			}) &&
			throws(() => {
				assertLiveEnv({ CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-other" }, DRY_TOKEN);
			}) &&
			throws(() => {
				assertLiveEnv({ FOO: DRY_TOKEN }, DRY_TOKEN);
			}),
	);
	step(
		"childEnv still refuses the OAuth token",
		throws(() =>
			childEnv({
				home: dir,
				configDir: dir,
				baseUrl: "http://127.0.0.1:1/x",
				extra: { CLAUDE_CODE_OAUTH_TOKEN: DRY_TOKEN },
			}),
		),
	);
};

export const runLiveSelftest = async (step: Step): Promise<void> => {
	const dir = await mkdtemp(join(await realpath(tmpdir()), "ccrel-livesel-"));
	try {
		await writeSecurityShim(dir);
		envChecks(step, dir);
		planChecks(step);
		probeChecks(step);
		await ptyChecks(step, dir);
		await runMitmSelftest(step);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
};
