import { expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { failureOf } from "../lib/failure.ts";
import { pathExists } from "../lib/fs.ts";
import type { CaseResult } from "../lib/results.ts";
import type { Ctx } from "../util.ts";
import { CAPTURES } from "../util.ts";
import { diffCase, runCompare } from "./compare.ts";
import { kase } from "./selftest/fixture.ts";

const run = (keys: string): CaseResult =>
	kase(
		"1.0.0",
		"print.request.baseline-a",
		{ evkeys: `sha1:${keys.length} len=${keys.length}` },
		{ evkeys: keys },
	);

test("hashed data that changed names the parts its samples gained and lost", () => {
	const d = diffCase(
		run("system:type,uuid|result:type,usage"),
		run("system:type,uuid|result:type,usage,model_usage_since_last_result"),
		false,
	);
	expect(d.changed["evkeys"]?.added).toEqual(["model_usage_since_last_result"]);
	expect(d.changed["evkeys"]?.removed).toEqual([]);
});

/**
 * `--from` falls back to the tracked version and `--to` to the installed one, so a bare
 * `release:compare` asked for `<v>..<v>`. That run found nothing and overwrote the real `compare.md`.
 * The captures folder exists here, so only the same-version guard can stop the run.
 */
test("compare refuses one version against itself and writes nothing", async () => {
	const v = "0.0.0-compare-test";
	const dir = join(CAPTURES, v);
	await mkdir(dir, { recursive: true });
	const ctx: Ctx = { from: v, to: v, only: null, dry: false, rest: [] };

	const failure = await failureOf(runCompare(ctx));

	expect(failure).toContain(v);
	expect(await pathExists(join(dir, "compare"))).toBe(false);
	await rm(dir, { recursive: true, force: true });
});
