// Compare part of the selftest: added/removed/changed, noise, and the invalid-run and one-sided cases.
import { join } from "node:path";

import { openRun, writeCase } from "../../lib/results.ts";
import {
	type CaseDiff,
	type Compare,
	compareResults,
	compareRuns,
	factResults,
	renderCompare,
} from "../compare.ts";
import { factRow, kase, type Step } from "./fixture.ts";

const changedKeys = (d: CaseDiff | undefined): string =>
	Object.keys(d?.changed ?? {}).join(",");

const writeFixtures = async (base: string): Promise<void> => {
	const a = await openRun("1.0.0", base);
	const b = await openRun("1.0.1", base);
	await writeCase(
		a,
		kase(
			"1.0.0",
			"print.one",
			{ x: 1, y: "a", gone: true },
			{ s: "same", t: "old" },
		),
	);
	await writeCase(
		b,
		kase(
			"1.0.1",
			"print.one",
			{ x: 2, y: "a", fresh: 3 },
			{ s: "same", t: "new" },
		),
	);
	await writeCase(a, kase("1.0.0", "print.same", { k: ["a"] }));
	await writeCase(b, kase("1.0.1", "print.same", { k: ["a"] }));
	await writeCase(a, kase("1.0.0", "print.old-only", { k: 1 }));
	await writeCase(b, kase("1.0.1", "print.new-only", { k: 1 }));
	await writeCase(
		a,
		kase("1.0.0", "print.sweep", { "FOO_BAR.A": ["h"], "OTHER.A": ["h"] }),
	);
	await writeCase(
		b,
		kase("1.0.1", "print.sweep", {
			"FOO_BAR.A": ["h"],
			"OTHER.A": ["h", "i"],
		}),
	);
};

const basicChecks = (step: Step, c1: Compare): void => {
	const one = c1.cases["print.one"];
	const x = one?.changed["x"];
	step(
		"compare: added/removed/changed",
		x?.old === 1 &&
			x.new === 2 &&
			"fresh" in (one?.added ?? {}) &&
			"gone" in (one?.removed ?? {}),
	);
	step(
		"compare: unchanged and one-sided cases",
		c1.cases["print.same"] === undefined &&
			c1.onlyFrom.join(",") === "print.old-only" &&
			c1.onlyTo.join(",") === "print.new-only",
	);
};

const invalidChecks = (step: Step): void => {
	const bad = kase("1.0.1", "pty.bad", {
		x: 2,
		precondition: false,
		"precondition.detail": "wait_for timed out: dialog",
		retried: true,
		startLagS: 5,
	});
	const ok = kase("1.0.0", "pty.bad", { x: 1, startLagS: 0.5 });
	const iv = compareResults("1.0.0", "1.0.1", [ok], [bad], false);
	const row = factRow("c.bad", ["pty.bad"], "pty", {
		file: "f.md",
		text: "t",
		status: "ok",
	});
	const facts = factResults([row], [ok], [bad], null);
	const cr = facts[0];
	const same = compareResults(
		"1.0.0",
		"1.0.1",
		[kase("1.0.0", "p.same", { x: 1, startLagS: 0.5 })],
		[kase("1.0.1", "p.same", { x: 1, startLagS: 7, retried: true })],
		false,
	);
	const md = renderCompare({ ...iv, facts });
	step(
		"compare: precondition=false is invalid-run, not changed; retried/startLagS never diff",
		iv.counts.invalid === 1 &&
			iv.counts.changed === 0 &&
			cr?.result === "invalid-run" &&
			same.counts.unchanged === 1 &&
			md.includes("1 invalid runs - re-run these cases") &&
			md.includes("invalid-run: `c.bad`") &&
			md.includes("wait_for timed out: dialog"),
		JSON.stringify([iv.counts, cr?.result]),
	);
};

const noiseChecks = (step: Step): void => {
	const nz = compareResults(
		"1.0.0",
		"1.0.1",
		[
			kase("1.0.0", "print.sweep", {
				"API_TIMEOUT_MS.A": ["nreq"],
				"FOO.A": ["cfgfiles"],
				"BAR.A": ["cfgfiles", "m0.ua"],
				changed: ["FOO"],
			}),
			kase("1.0.0", "print.request.v", {
				"m0.ua": "claude-cli/1.0.0 (x)",
				other: "a",
			}),
			kase("1.0.0", "print.request.w", { "m0.ua": "claude-cli/1.0.0 (x)" }),
		],
		[
			kase("1.0.1", "print.sweep", {
				"API_TIMEOUT_MS.A": ["nreq", "events"],
				"FOO.A": [],
				"BAR.A": ["m0.ua", "events"],
				changed: ["BAR"],
			}),
			kase("1.0.1", "print.request.v", {
				"m0.ua": "claude-cli/1.0.1 (x)",
				other: "b",
			}),
			kase("1.0.1", "print.request.w", { "m0.ua": "claude-cli/1.0.1 (x)" }),
		],
		false,
	);
	const md = renderCompare(nz);
	const noise = nz.noise ?? {};
	step(
		"compare: known noise and version-only changes are listed under Noise, not as changes",
		nz.counts.changed === 2 &&
			changedKeys(nz.cases["print.sweep"]) === "BAR.A" &&
			changedKeys(nz.cases["print.request.v"]) === "other" &&
			noise["print.sweep"]?.["FOO.A"] !== undefined &&
			noise["print.request.v"]?.["m0.ua"] === "version string only" &&
			// a case whose only difference is noise counts as unchanged
			nz.cases["print.request.w"] === undefined &&
			noise["print.request.w"]?.["m0.ua"] === "version string only" &&
			nz.counts.unchanged === 1 &&
			md.includes("## Noise (ignored)") &&
			md.includes("`print.sweep` `API_TIMEOUT_MS.A`"),
		JSON.stringify([nz.counts, nz.noise]),
	);
};

const MCP = "managed.baseline.mcp-config-flag";
const startedChanges = (from: string[], to: string[]): number =>
	compareResults(
		"1.0.0",
		"1.0.1",
		[kase("1.0.0", MCP, { started: from })],
		[kase("1.0.1", MCP, { started: to })],
		false,
	).counts.changed;

const observerChecks = (step: Step): void => {
	const OBS = "print.subagents.observer.on";
	const obs = (v: string, n: number, m: number) =>
		kase(v, OBS, {
			messages: n,
			observerReportToolIn: m,
			observerMessageIn: m,
		});
	const ok = compareResults(
		"1.0.0",
		"1.0.1",
		[
			obs("1.0.0", 10, 3),
			kase("1.0.0", "print.sweep", {
				"CLAUDE_CODE_USE_MANTLE.A": ["nreq", "code", "stderr"],
			}),
		],
		[
			obs("1.0.1", 12, 5),
			kase("1.0.1", "print.sweep", {
				"CLAUDE_CODE_USE_MANTLE.A": ["nreq", "cfgfiles", "code"],
			}),
		],
		false,
	);
	const swapped = startedChanges(["a", "b"], ["b", "a"]);
	const other = startedChanges(["a", "b"], ["a"]);
	step(
		"compare: MCP servers started in another order are noise; another set is a change",
		swapped === 0 && other === 1,
		JSON.stringify([swapped, other]),
	);
	const gone = compareResults(
		"1.0.0",
		"1.0.1",
		[obs("1.0.0", 10, 3)],
		[obs("1.0.1", 2, 0)],
		false,
	);
	const noise = ok.noise ?? {};
	step(
		"compare: observer counts within the seen range and Mantle stderr are noise; a lost observer is a change",
		ok.counts.changed === 0 &&
			noise[OBS]?.["observerReportToolIn"] !== undefined &&
			noise["print.sweep"]?.["CLAUDE_CODE_USE_MANTLE.A"] !== undefined &&
			gone.counts.changed === 1 &&
			Object.keys(gone.cases[OBS]?.changed ?? {}).length === 3,
		JSON.stringify([ok.counts, ok.noise, gone.counts]),
	);
};

const factNoiseChecks = (step: Step): void => {
	const rows = [
		factRow("c.noise", ["print.sweep"], "env", {
			file: "f.md",
			text: "t",
			status: "ok",
			diffNames: ["API_TIMEOUT_MS"],
		}),
		factRow("c.real", ["print.sweep"], "env", {
			file: "f.md",
			line: 2,
			text: "t",
			status: "ok",
			diffNames: ["FOO"],
		}),
	];
	const old = kase("1.0.0", "print.sweep", {
		"API_TIMEOUT_MS.A": ["nreq"],
		"FOO.A": ["x"],
	});
	const now = kase("1.0.1", "print.sweep", {
		"API_TIMEOUT_MS.A": ["nreq", "events"],
		"FOO.A": ["y"],
	});
	const crs = factResults(rows, [old], [now], null, null, ["1.0.0", "1.0.1"]);
	const cc = compareResults("1.0.0", "1.0.1", [old], [now], false);
	const md = renderCompare({ ...cc, facts: crs });
	step(
		"compare: a fact that differs only by noise says so and is listed under Noise",
		crs[0]?.result === "unchanged" &&
			crs[0].why ===
				"unchanged (noise ignored: print.sweep API_TIMEOUT_MS.A)" &&
			crs[1]?.result === "changed" &&
			crs[1].noise === undefined &&
			cc.noise?.["print.sweep"]?.["API_TIMEOUT_MS.A"] !== undefined &&
			md.includes("- fact `c.noise`: `print.sweep` `API_TIMEOUT_MS.A`"),
		JSON.stringify(crs.map((r) => [r.result, r.why])),
	);
};

export const runCompareChecks = async (
	step: Step,
	root: string,
): Promise<{ base: string; b: string }> => {
	const base = join(root, "caps");
	await writeFixtures(base);
	const c1 = await compareRuns("1.0.0", "1.0.1", base, false);
	basicChecks(step, c1);
	invalidChecks(step);
	noiseChecks(step);
	observerChecks(step);
	factNoiseChecks(step);
	const withSamples = await compareRuns("1.0.0", "1.0.1", base, true);
	step(
		"compare: samples only with --samples",
		c1.cases["print.one"]?.samples === undefined &&
			withSamples.cases["print.one"]?.samples?.["t"] !== undefined,
	);
	return { base, b: join(base, "1.0.1") };
};
