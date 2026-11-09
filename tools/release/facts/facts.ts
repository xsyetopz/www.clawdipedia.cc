// release:facts - finds version-labelled facts in docs/, maps each to a probe or a kind, writes facts.json.
// Design: openspec/changes/archive/2026-10-21-release-toolkit/design.md, section "Claim Map".
// The archive keeps the old term. A version-labelled sentence is now a fact, not a claim.
//   bun tools/release/cli.ts facts [--check] [--all] [--to V]
import { join } from "node:path";

import { type Ctx, versionDir, writeJson } from "../util.ts";
import { applyMap, loadDiffNames, readMap } from "./apply.ts";
import { checkFacts, knownCases } from "./parts/check.ts";
import { findFacts } from "./scan.ts";
import type { Fact } from "./types.ts";

const count = (facts: Fact[], f: (c: Fact) => string): string => {
	const m: Record<string, number> = {};
	for (const c of facts) {
		m[f(c)] = (m[f(c)] ?? 0) + 1;
	}
	return Object.entries(m)
		.map(([k, v]) => `${k} ${v}`)
		.join(", ");
};

const runCheck = async (facts: Fact[], found: Fact[]): Promise<number> => {
	const r = checkFacts(facts, await readMap(), await knownCases(), found);
	for (const w of r.warnings) {
		console.info(`  warn: ${w}`);
	}
	for (const e of r.errors) {
		console.info(`  FAIL ${e}`);
	}
	console.info(r.errors.length > 0 ? "facts check failed" : "facts check ok");
	return r.errors.length > 0 ? 1 : 0;
};

export const runFacts = async (ctx: Ctx): Promise<number> => {
	const to = ctx.to === "" ? ctx.from : ctx.to;
	const diff = await loadDiffNames(to);
	const found = applyMap(await findFacts(), await readMap(), diff);
	const facts = ctx.rest.includes("--all")
		? found
		: found.filter((c) => c.class === "change");
	console.info(
		`release:facts: ${facts.length} facts (${count(facts, (c) => c.class)}); status: ${count(facts, (c) => c.status)}; kind: ${count(facts, (c) => c.kind ?? "none")}`,
	);
	if (diff === null) {
		console.info("  no diff/*.json found: automatic kinds skipped");
	}
	if (ctx.rest.includes("--check")) {
		return runCheck(facts, found);
	}
	if (ctx.dry) {
		console.info(`plan: write captures/${to}/facts.json`);
		return 0;
	}
	const path = join(versionDir(to), "facts.json");
	await writeJson(
		path,
		facts.map((c) => ({
			id: c.id,
			file: c.file,
			line: c.line,
			text: c.text,
			kind: c.kind,
			probes: c.probes,
			status: c.status,
			class: c.class,
			diffNames: c.diffNames,
		})),
	);
	console.info(`  wrote ${path}`);
	return 0;
};
