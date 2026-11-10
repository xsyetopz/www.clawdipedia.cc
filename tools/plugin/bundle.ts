import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exists, PLUGINS, ROOT } from "./plugins.ts";
import type { Plugin } from "./plugins.ts";

interface Run {
	exitCode: number;
	out: string;
	err: string;
}

const run = async (cmd: string[]): Promise<Run> => {
	const proc = Bun.spawn(cmd, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
	const [out, err, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { exitCode, out, err };
};

/** The claude CLI validates each plugin manifest offline when it is on PATH. No credentials are passed. */
export const validateProblems = async (): Promise<string[]> => {
	if (Bun.which("claude") === null) {
		console.warn(
			"plugin:check: claude CLI not on PATH, skipped claude plugin validate",
		);
		return [];
	}
	const targets = PLUGINS.map((p) => `./${p.dir}`);
	const runs = await Promise.all(
		targets.map((target) => run(["claude", "plugin", "validate", target])),
	);
	return runs.flatMap((r, i) =>
		r.exitCode === 0
			? []
			: [`claude plugin validate ${targets[i]}: ${(r.out + r.err).trim()}`],
	);
};

/** Compare the committed bundle with a fresh bundle of the sources. */
const freshnessProblems = async ({
	dir,
	src,
	out: dist,
	external,
}: Plugin): Promise<string[]> => {
	// bun build is deterministic for the same inputs and versions.
	const tmp = await mkdtemp(join(tmpdir(), "plugin-check-"));
	try {
		const bundle = join(tmp, "bundle.js");
		const b = await run([
			"bun",
			"build",
			src,
			"--target=bun",
			...external.map((x) => `--external=${x}`),
			`--outfile=${bundle}`,
		]);
		if (b.exitCode !== 0) {
			return [`bundle ${dir}: ${b.err.trim()}`];
		}
		if (!(await exists(dist))) {
			return [`${dist} is missing: run "bun run plugin:build"`];
		}
		const fresh = Buffer.from(await Bun.file(bundle).arrayBuffer());
		const committed = Buffer.from(
			await Bun.file(join(ROOT, dist)).arrayBuffer(),
		);
		return fresh.equals(committed)
			? []
			: [`${dist} is stale: run "bun run plugin:build"`];
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

/** Run the plugin tests against the committed bundle, then check that the bundle is fresh. */
export const bundleProblems = async (p: Plugin): Promise<string[]> => {
	const problems: string[] = [];
	if (await exists(p.out)) {
		const t = await run(["bun", "test", p.test]);
		if (t.exitCode !== 0) {
			problems.push(`bun test ${p.test} failed:\n${t.err.trim()}`);
		}
	}
	const stale = await freshnessProblems(p);
	return [...problems, ...stale];
};
