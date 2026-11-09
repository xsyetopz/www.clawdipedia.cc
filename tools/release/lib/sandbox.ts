// Temp HOME / config dir / project dir for one child run. Everything is under mkdtemp + realpath
// (macOS /var vs /private/var matters for trusted-project keys). cleanup() only removes what this process made.
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";

import { onCleanup } from "./cleanup.ts";
import { FAKE_KEY } from "./env.ts";
import { writeSecurityShim } from "./shim.ts";

export type Files = Record<string, string>;
export interface Sandbox {
	root: string;
	home: string;
	cfg: string;
	proj: string;
	cleanup: () => Promise<void>;
}
export interface SandboxOpts {
	cfgFiles?: Files;
	projFiles?: Files;
	/** {HOME} {CFG} {PROJ} placeholders in contents */
	homeFiles?: Files;
	git?: boolean;
	trusted?: boolean;
	seedOnboarding?: boolean;
	/** no pre-approved fake key in .claude.json (live runs use the OAuth env var) */
	live?: boolean;
}

const made = new Set<string>();
onCleanup(async () => {
	await Promise.all(
		[...made].map((p) => rm(p, { recursive: true, force: true })),
	);
});

export const subst = (
	s: string,
	sb: { home: string; cfg: string; proj: string },
): string =>
	s
		.split("{HOME}")
		.join(sb.home)
		.split("{CFG}")
		.join(sb.cfg)
		.split("{PROJ}")
		.join(sb.proj);

const writeFixtures = async (
	sb: { home: string; cfg: string; proj: string },
	opts: SandboxOpts,
): Promise<void> => {
	const targets: [string, string][] = [];
	for (const [base, files] of [
		[sb.cfg, opts.cfgFiles],
		[sb.proj, opts.projFiles],
		[sb.home, opts.homeFiles],
	] as const) {
		for (const [k, v] of Object.entries(files ?? {})) {
			const target = resolve(base, k);
			if (!target.startsWith(base + sep)) {
				throw new Error(`fixture path escapes its dir: ${k}`);
			}
			targets.push([target, subst(v, sb)]);
		}
	}
	await Promise.all(
		targets.map(async ([target, text]) => {
			await mkdir(dirname(target), { recursive: true });
			await Bun.write(target, text);
		}),
	);
};

const gitInit = async (home: string, proj: string): Promise<void> => {
	const g = Bun.spawn(["/usr/bin/git", "init", "-q"], {
		cwd: proj,
		env: {
			PATH: "/usr/bin:/bin",
			HOME: home,
			GIT_CONFIG_GLOBAL: join(home, ".gitconfig"),
		},
	});
	if ((await g.exited) !== 0) {
		throw new Error("git init failed in sandbox");
	}
};

/** Onboarding done, project trusted, fake key pre-approved. Never oauthAccount or any token. */
const claudeJson = (proj: string, opts: SandboxOpts): string => {
	const state: Record<string, unknown> = {
		hasCompletedOnboarding: true,
		theme: "dark",
		numStartups: 10,
		...(opts.live === true
			? {}
			: { customApiKeyResponses: { approved: [FAKE_KEY], rejected: [] } }),
	};
	if (opts.trusted === true) {
		state["projects"] = {
			[proj]: {
				hasTrustDialogAccepted: true,
				allowedTools: [],
				hasCompletedProjectOnboarding: true,
			},
		};
	}
	return `${JSON.stringify(state, null, 2)}\n`;
};

export const makeSandbox = async (opts: SandboxOpts = {}): Promise<Sandbox> => {
	const root = await realpath(await mkdtemp(join(tmpdir(), "ccrel-")));
	made.add(root);
	const home = join(root, "home");
	const cfg = join(root, "cfg");
	const proj = join(root, "proj");
	await Promise.all(
		[home, cfg, proj, join(home, "tmp")].map((d) =>
			mkdir(d, { recursive: true }),
		),
	);
	await writeSecurityShim(home);
	await writeFixtures({ home, cfg, proj }, opts);
	if (opts.git === true) {
		await gitInit(home, proj);
	}
	if (opts.seedOnboarding === true || opts.trusted === true) {
		await Bun.write(join(cfg, ".claude.json"), claudeJson(proj, opts));
	}
	return {
		root,
		home,
		cfg,
		proj,
		cleanup: async () => {
			await rm(root, { recursive: true, force: true });
			made.delete(root);
		},
	};
};
