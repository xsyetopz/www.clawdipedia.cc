// release:probe:print - runs the print probe groups against the local stub with the fake key.
// Usage: bun tools/release/cli.ts probe:print [--to V] [--only group,case,sweep.NAME] [--dry]
// --only matches dotted case ids by prefix, with or without the `print.` prefix (e.g. hooks.posttooluse, request.baseline-a).
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { binaryPath, PROMPT } from "../../lib/env.ts";
import { type CaseResult, openRun, writeCase } from "../../lib/results.ts";
import type { Ctx } from "../../util.ts";
import { groupsA } from "./groups/a.ts";
import { groupsB } from "./groups/b.ts";
import { pathExists, selected, stopStub } from "./run.ts";
import { eachInOrder } from "./run/seq.ts";
import type { PrintCtx, PrintGroup } from "./types.ts";

const EMPTY = (c: PrintCtx): CaseResult => ({
	schema: 1,
	id: "",
	group: "print",
	version: c.version,
	prompt: PROMPT,
	args: [],
	envSet: [],
	exit: null,
	timedOut: false,
	data: {},
	facts: [],
});

const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/** A full run replaces the whole print/ folder, so a stale file never reads as current. */
const clearStale = async (dir: string): Promise<void> => {
	if (!(await pathExists(dir))) {
		return;
	}
	const names = await readdir(dir);
	const stale = names.filter((n) => n.endsWith(".json"));
	await Promise.all(stale.map((f) => rm(join(dir, f))));
};

/** Counts cases and prints one line per result; writes each result file unless the run is dry. */
const makeWriter = (ctx: Ctx, pctx: PrintCtx) => {
	const counts = { total: 0, invalid: 0 };
	const seen = new Set<string>();
	const write = async (r: CaseResult): Promise<void> => {
		counts.total += 1;
		if (ctx.dry) {
			console.info(`  ${r.id}`);
			return;
		}
		if (seen.has(r.id)) {
			counts.invalid += 1;
			console.info(
				`  INVALID ${r.id} (duplicate case id, second result dropped)`,
			);
			return;
		}
		seen.add(r.id);
		await writeCase(pctx.runDir, r);
		const bad = r.data["precondition"] === false;
		if (bad) {
			counts.invalid += 1;
		}
		const skipped = r.data["skipped"];
		if (typeof skipped === "string") {
			console.info(`  skipped ${r.id} (${skipped})`);
			return;
		}
		const detail = String(
			r.data["error"] ?? r.data["precondition.detail"] ?? "",
		);
		console.info(
			`  ${bad ? "INVALID" : "ok     "} ${r.id}${bad ? ` (${detail})` : ""}`,
		);
	};
	return { counts, write };
};

/** One invalid result per planned case, so no stale file stays behind. */
const failedGroup = async (
	g: PrintGroup,
	pctx: PrintCtx,
	error: unknown,
): Promise<CaseResult[]> => {
	console.info(`  group failed: ${messageOf(error)}`);
	let planned: CaseResult[] = [];
	try {
		planned = await g.run({ ...pctx, dry: true });
	} catch {
		// cannot plan: fall through to a group-level result
	}
	const base =
		planned.length > 0
			? planned
			: [{ ...EMPTY(pctx), id: `print.${g.id}.group-error` }];
	return base.map((r) =>
		Object.assign(r, {
			data: {
				precondition: false,
				error: `group failed: ${messageOf(error)}`,
			},
		}),
	);
};

const runGroup = async (
	g: PrintGroup,
	pctx: PrintCtx,
	write: (r: CaseResult) => Promise<void>,
): Promise<void> => {
	if (!selected(pctx, `print.${g.id}`)) {
		return;
	}
	console.info(`group ${g.id}: ${g.title}`);
	let results: CaseResult[];
	try {
		results = await g.run(pctx);
	} catch (error) {
		results = await failedGroup(g, pctx, error);
	}
	await eachInOrder(results, write);
};

export const runProbePrint = async (ctx: Ctx): Promise<number> => {
	if (ctx.to === "") {
		throw new Error("no --to given and no installed binary found");
	}
	const bin = binaryPath(ctx.to);
	if (!ctx.dry && !(await pathExists(bin))) {
		throw new Error(`binary missing: ${bin}`);
	}
	const pctx: PrintCtx = {
		version: ctx.to,
		bin,
		runDir: ctx.dry ? "" : await openRun(ctx.to),
		...(ctx.only ? { only: ctx.only } : {}),
		dry: ctx.dry,
	};
	if (!ctx.dry && !ctx.only) {
		await clearStale(join(pctx.runDir, "print"));
	}
	console.info(`release:probe:print ${ctx.to}${ctx.dry ? " (dry)" : ""}`);

	const { counts, write } = makeWriter(ctx, pctx);
	try {
		await eachInOrder([...groupsA, ...groupsB], (g) =>
			runGroup(g, pctx, write),
		);
	} finally {
		const stray = await stopStub();
		if (stray.length > 0) {
			counts.invalid += 1;
			console.info(
				`STRAY ${stray.length} request(s) reached the stub without a case id: ${[...new Set(stray.map((r) => r.path))].join(", ")}`,
			);
		}
	}
	console.info(
		`${counts.total} case(s)${ctx.dry ? " planned" : `, ${counts.invalid} invalid probe(s)`}`,
	);
	return 0;
};
