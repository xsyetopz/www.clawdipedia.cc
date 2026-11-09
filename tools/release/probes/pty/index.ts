// release:probe:pty - interactive probes through the pty driver, against the local stub with the fake key.
// Usage: bun tools/release/cli.ts probe:pty [--to V] [--only group,case] [--dry]
// --only matches dotted case ids by prefix, with or without the `pty.` prefix (e.g. hooks.precompact, statusline), or a bare case name (fork). Exit 2 when nothing matches.
// Run it when the machine is idle: the status line cases measure timing. Cases run one at a time.
// Exit is non-zero only when a case failed to run (precondition false); a changed result is not a failure.
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { binaryPath } from "../../lib/env.ts";
import { type CaseResult, openRun, writeCase } from "../../lib/results.ts";
import type { Ctx } from "../../util.ts";
import { pathExists } from "../print/run/files.ts";
import { eachInOrder } from "../print/run/seq.ts";
import { GROUPS } from "./groups.ts";
import {
	type PtyCtx,
	type PtyGroup,
	runPtyCase,
	selected,
	stopStub,
} from "./harness.ts";

interface Tally {
	total: number;
	invalid: number;
	seen: Set<string>;
}

/** A full run replaces the whole pty/ folder, so a stale file never reads as current. */
const clearStale = async (dir: string): Promise<void> => {
	if (await pathExists(dir)) {
		const names = await readdir(dir);
		await Promise.all(names.map((f) => rm(join(dir, f))));
	}
};

const report = async (pctx: PtyCtx, t: Tally, r: CaseResult): Promise<void> => {
	t.total++;
	if (pctx.dry) {
		console.info(`  ${r.id}`);
		return;
	}
	if (t.seen.has(r.id)) {
		t.invalid++;
		console.info(`  INVALID ${r.id} (duplicate case id, dropped)`);
		return;
	}
	t.seen.add(r.id);
	await writeCase(pctx.runDir, r);
	const bad = r.data["precondition"] === false;
	if (bad) {
		t.invalid++;
	}
	const flaky = r.data["flaky"] === true ? " FLAKY" : "";
	const why = bad
		? ` (${String(r.data["error"] ?? r.data["precondition.detail"] ?? "")})`
		: "";
	console.info(`  ${bad ? "INVALID" : "ok     "} ${r.id}${flaky}${why}`);
};

const runGroup = async (g: PtyGroup, pctx: PtyCtx, t: Tally): Promise<void> => {
	const cases = g.cases(pctx);
	if (!cases.some((c) => selected(pctx.only, `pty.${c.id}`))) {
		return;
	}
	console.info(`group ${g.id}: ${g.title}`);
	await eachInOrder(cases, async (c) => {
		const results = await runPtyCase(pctx, c);
		await eachInOrder(results, (r) => report(pctx, t, r));
	});
};

const stray = async (t: Tally): Promise<void> => {
	const reqs = await stopStub();
	if (reqs.length > 0) {
		t.invalid++;
		console.info(
			`STRAY ${reqs.length} request(s) reached the stub without a case id: ${[...new Set(reqs.map((r) => r.path))].join(", ")}`,
		);
	}
};

export const runProbePty = async (ctx: Ctx): Promise<number> => {
	if (ctx.to === "") {
		throw new Error("no --to given and no installed binary found");
	}
	const bin = binaryPath(ctx.to);
	if (!ctx.dry && !(await Bun.file(bin).exists())) {
		throw new Error(`binary missing: ${bin}`);
	}
	const pctx: PtyCtx = {
		version: ctx.to,
		bin,
		runDir: ctx.dry ? "" : await openRun(ctx.to),
		only: ctx.only,
		dry: ctx.dry,
	};
	if (!ctx.dry && ctx.only === null) {
		await clearStale(join(pctx.runDir, "pty"));
	}
	console.info(`release:probe:pty ${ctx.to}${ctx.dry ? " (dry)" : ""}`);

	const t: Tally = { total: 0, invalid: 0, seen: new Set() };
	try {
		await eachInOrder(GROUPS, (g) => runGroup(g, pctx, t));
	} finally {
		await stray(t);
	}
	if (ctx.only !== null && t.total === 0) {
		console.info(`no case matches --only ${ctx.only.join(",")}`);
		return 2;
	}
	console.info(
		`${t.total} case(s)${ctx.dry ? " planned" : `, ${t.invalid} invalid probe(s)`}`,
	);
	return t.invalid > 0 && !ctx.dry ? 1 : 0;
};
