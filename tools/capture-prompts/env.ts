import { tmpdir } from "node:os";
import { join } from "node:path";

import { FAKE_KEY } from "./stub.ts";
import type { Variant } from "./variants.ts";

export const requireEnv = (name: string): string => {
	const v = process.env[name];
	if (v === undefined || v === "") {
		throw new Error(`${name} is not set`);
	}
	return v;
};

const gitEnv = (home: string): Record<string, string> => ({
	GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
	GIT_AUTHOR_NAME: "t",
	GIT_AUTHOR_EMAIL: "t@example.com",
	GIT_COMMITTER_NAME: "t",
	GIT_COMMITTER_EMAIL: "t@example.com",
});

const GIT_STEPS = [
	["init", "-q"],
	["add", "-A"],
	["commit", "-q", "--allow-empty", "-m", "initial"],
];

/** Run the git steps one after the other, because each one needs the one before it. */
const gitSteps = async (
	steps: string[][],
	proj: string,
	env: Record<string, string>,
): Promise<void> => {
	const [c, ...rest] = steps;
	if (c === undefined) {
		return;
	}
	await Bun.spawn(["git", ...c], { cwd: proj, env }).exited;
	await gitSteps(rest, proj, env);
};

export const initGit = async ({
	home,
	proj,
}: {
	home: string;
	proj: string;
}): Promise<void> => {
	await Bun.write(join(proj, "README.md"), "probe\n");
	await gitSteps(GIT_STEPS, proj, {
		PATH: requireEnv("PATH"),
		HOME: home,
		...gitEnv(home),
	});
	// untracked file so the status is not empty
	await Bun.write(join(proj, "dirty.txt"), "x\n");
};

/** The environment of the probed program: fake key, dead proxy and temp folders. */
export const probeEnv = (
	v: Variant,
	d: { home: string; cfg: string },
	shimDir: string,
	port: number,
): Record<string, string> => ({
	PATH: `${shimDir}:${requireEnv("PATH")}`,
	HOME: d.home,
	GIT_CONFIG_NOSYSTEM: "1",
	TMPDIR: tmpdir(),
	CLAUDE_CONFIG_DIR: d.cfg,
	ANTHROPIC_API_KEY: FAKE_KEY,
	ANTHROPIC_BASE_URL: `http://127.0.0.1:${port}`,
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
	DISABLE_TELEMETRY: "1",
	// fail-closed net: anything proxied or direct to the real API breaks
	HTTPS_PROXY: "http://127.0.0.1:9",
	HTTP_PROXY: "http://127.0.0.1:9",
	NO_PROXY: "127.0.0.1,localhost",
	...gitEnv(d.home),
	...v.env,
});
