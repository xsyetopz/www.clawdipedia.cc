// release:facts - finds version-labelled facts in docs/, maps each to a probe or a kind, writes facts.json.
// Design: openspec/changes/archive/2026-10-21-release-toolkit/design.md, section "Claim Map".
// The archive keeps the old term. A version-labelled sentence is now a fact, not a claim.
//   bun tools/release/cli.ts facts [--check] [--all] [--to V] [--remap [--base REF]]
import { join } from "node:path";

import {
	argValue,
	type Ctx,
	ROOT,
	toolEnv,
	versionDir,
	writeJson
} from "../util.ts";
import { applyMap, loadDiffNames, MAP_PATH, readMap } from "./apply.ts";
import { checkFacts, knownCases } from "./parts/check.ts";
import { readTexts, remap } from "./remap.ts";
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

const runCheck = async (
	facts: Fact[],
	found: Fact[],
	to: string
): Promise<number> => {
	const r = checkFacts(
		facts,
		await readMap(),
		await knownCases(undefined, to),
		found
	);
	for (const n of r.notes) {
		console.info(`  info: ${n}`);
	}
	for (const w of r.warnings) {
		console.info(`  warn: ${w}`);
	}
	for (const e of r.errors) {
		console.info(`  FAIL ${e}`);
	}
	console.info(r.errors.length > 0 ? "facts check failed" : "facts check ok");
	return r.errors.length > 0 ? 1 : 0;
};

// Rewrites map.json for edited sentences; it exits 1 while a fact has no source, so the uncited sentence gets fixed.
const runRemap = async (found: Fact[], ctx: Ctx): Promise<number> => {
	const map = await readMap();
	const texts = await readTexts(
		found,
		map,
		argValue(ctx.rest, "--base") ?? "HEAD"
	);
	const r = remap({ facts: found, map, ...texts });
	console.info(
		`  remap: ${r.renamed} renamed, ${r.sourced} sourced from citations, ${r.dropped} dropped`
	);
	for (const f of r.unsourced) {
		console.info(`  FAIL no source: ${f.id} (${f.file}:${f.line})`);
	}
	if (!ctx.dry) {
		// The repo formatter owns the layout of map.json, so the write goes through it and a no-op remap leaves no diff.
		await Bun.write(MAP_PATH, `${JSON.stringify(r.map, null, "\t")}\n`);
		// The pinned PATH of toolEnv holds no bun, so the running binary formats the file.
		const fmt = Bun.spawn([process.execPath, "fmt", MAP_PATH], {
			cwd: ROOT,
			env: toolEnv(),
			stdout: "ignore"
		});
		if ((await fmt.exited) !== 0) {
			console.info("  FAIL bun fmt could not format map.json");
			return 1;
		}
	}
	return r.unsourced.length > 0 ? 1 : 0;
};

export const runFacts = async (ctx: Ctx): Promise<number> => {
	const to = ctx.to === "" ? ctx.from : ctx.to;
	const diff = await loadDiffNames(to);
	const found = applyMap(await findFacts(), await readMap(), diff);
	const facts = ctx.rest.includes("--all")
		? found
		: found.filter((c) => c.class === "change");
	console.info(
		`release:facts: ${facts.length} facts (${count(facts, (c) => c.class)}); status: ${count(facts, (c) => c.status)}; kind: ${count(facts, (c) => c.kind ?? "none")}`
	);
	if (diff === null) {
		console.info("  no diff/*.json found: automatic kinds skipped");
	}
	if (ctx.rest.includes("--remap")) {
		return runRemap(found, ctx);
	}
	if (ctx.rest.includes("--check")) {
		return runCheck(facts, found, to);
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
			diffNames: c.diffNames
		}))
	);
	console.info(`  wrote ${path}`);
	return 0;
};
