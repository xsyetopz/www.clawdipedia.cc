// release:diff - surface snapshots (design D4) of the old and new binary, diffed by kind.
// Writes captures/<v>/surface.json for both versions, captures/<to>/diff/<group>.json, and diff/report.md.
// The six files that facts and compare read keep their names (strings-env.json, flags.json, ...).
import { join } from "node:path";

import {
	docsOf,
	isMapRecord,
	isStringRecord,
	readJson,
} from "../../surface/coverage-cli.ts";
import { serializeCapture, snapshot } from "../../surface/snapshot.ts";
import { mapSeq } from "../lib/seq.ts";
import { type Ctx, ROOT, versionDir } from "../util.ts";
import { loadDocs } from "./diff/docs.ts";
import { type ByKind, groups } from "./diff/groups.ts";
import { renderReport } from "./diff/report.ts";
import { type Rules, writeGroup } from "./diff/write.ts";

const load = async (v: string): Promise<ByKind> => {
	const t0 = Date.now();
	const { byKind } = await snapshot(v);
	const file = join(versionDir(v), "surface.json");
	await Bun.write(file, serializeCapture(v, byKind));
	console.info(`  ${v}: ${file} (${Date.now() - t0} ms)`);
	return byKind;
};

export const runDiff = async (ctx: Ctx): Promise<number> => {
	const { from, to } = ctx;
	if (to === "") {
		throw new Error("no --to given and no installed binary found");
	}
	console.info(`release:diff ${from} -> ${to}`);
	if (ctx.dry) {
		console.info(
			`plan: surface snapshots of ${from} and ${to} (written to captures/<v>/surface.json)`,
		);
		console.info(`plan: write captures/${to}/diff/{<kind>.json,report.md}`);
		return 0;
	}
	const a = await load(from);
	const b = from === to ? a : await load(to);
	const gs = groups([...new Set([...Object.keys(a), ...Object.keys(b)])]);
	const surfaceDir = join(ROOT, "tools", "surface");
	const rules: Rules = {
		docs: await loadDocs(),
		names: await docsOf(
			ROOT,
			gs.flatMap((g) => g.kinds.map(([k]) => k)),
		),
		map: await readJson(join(surfaceDir, "map.json"), isMapRecord),
		exclusions: await readJson(
			join(surfaceDir, "exclusions.json"),
			isStringRecord,
		),
	};
	const dir = join(versionDir(to), "diff");
	const ds = await mapSeq(gs, (g) =>
		writeGroup(g, a, b, rules, { from, to, dir }),
	);
	const titles = Object.fromEntries(gs.map((g) => [g.key, g.title]));
	await Bun.write(join(dir, "report.md"), renderReport(from, to, ds, titles));
	console.info(`  report: ${join(dir, "report.md")}`);
	return 0;
};
