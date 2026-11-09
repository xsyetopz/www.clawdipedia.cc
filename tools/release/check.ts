// release:check - preflight. Writes captures/<to>/env.json. Exit 1 if a required item is missing.
import { arch, platform, release } from "node:os";
import { join } from "node:path";

import {
	capturesSizes,
	MANAGED_DIR,
	managedCheck,
	parentEnvCheck,
	portChecks,
} from "./check/host.ts";
import { binaryChecks, type Check, toolChecks } from "./check/tools.ts";
import { runSelftest } from "./selftest.ts";
import { type Ctx, installedVersions, versionDir, writeJson } from "./util.ts";

const CACHE_NOTE =
	"Live (subscription) runs share a 1 h prompt cache. If any session used the same prefix in the last hour the cache is warm and token counts are too low. Offline probes are not affected.";

const gather = async (from: string, to: string, installed: string[]) => {
	const bins = await binaryChecks(from, to, installed);
	const tools = await toolChecks();
	const ports = await portChecks();
	const managed = await managedCheck();
	const sizes = await capturesSizes();
	const checks: Check[] = [
		...bins,
		...tools.checks,
		...ports.checks,
		managed.check,
		...parentEnvCheck(),
		{ id: "cache.note", level: "ok", detail: CACHE_NOTE },
	];
	return { checks, tools, ports, managed, sizes };
};

export const runCheck = async (ctx: Ctx): Promise<number> => {
	if (ctx.rest.includes("--selftest")) {
		return runSelftest(ctx);
	}
	const { from, to } = ctx;
	if (ctx.dry) {
		console.info(
			"plan: binary for --to, binary for --from, python3, strings, openssl, free ports, managed folder, captures sizes",
		);
		console.info(`plan: write captures/${to === "" ? "<to>" : to}/env.json`);
		return 0;
	}
	if (to === "") {
		console.error("release:check: no --to given and no installed binary found");
		return 1;
	}
	const installed = await installedVersions();
	const g = await gather(from, to, installed);
	const fail = g.checks.filter((c) => c.level === "fail");
	await writeJson(join(versionDir(to), "env.json"), {
		version: to,
		from,
		checkedAt: new Date().toISOString(),
		host: {
			platform: platform(),
			arch: arch(),
			osRelease: release(),
			bun: Bun.version,
		},
		installedVersions: installed,
		python: g.tools.python,
		ports: { dynamic: g.ports.ports, fixedRangeBusy: g.ports.busy },
		managedFolder: { path: MANAGED_DIR, exists: g.managed.managed },
		capturesBytes: g.sizes,
		checks: g.checks,
		ok: fail.length === 0,
	});
	for (const c of g.checks) {
		console.info(`${c.level.toUpperCase().padEnd(4)} ${c.id}: ${c.detail}`);
	}
	for (const [v, n] of Object.entries(g.sizes)) {
		console.info(`     captures/${v}: ${(n / 1_048_576).toFixed(1)} MiB`);
	}
	console.info(fail.length > 0 ? `check failed (${fail.length})` : "check ok");
	return fail.length > 0 ? 1 : 0;
};
