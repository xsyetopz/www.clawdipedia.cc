// Usage: CC_INSPECT_CACHE=$PWD/captures bun tools/surface/audit.ts [--version <v>] [--root <dir>]   (also: bun run surface:audit)
// Runs every entry of tools/surface/exclusions.json through one check, chosen by the kind and the reason of the entry,
// and writes captures/<version>/exclusions-audit.json: key, reason, read site, check, result, evidence.
// An entry covers the items of surface.json that its key names (a trailing `*` is a prefix); it passes when each item does.
// Library checks fetch the published source of the library from the npm registry (cc-inspect `code` `npm`).
import { join } from "node:path";
import { parseArgs } from "node:util";

import { program } from "../../inspect/mcp/src/binary.ts";
import type { SurfaceItem } from "../../inspect/mcp/src/surface/common.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { pick } from "./audit-pick.ts";
import { type Ctx, eachOf, type Evidence } from "./audit-types.ts";
import { compare, docsNames, exclusionOf, isRecord } from "./coverage.ts";

const ROOT = join(import.meta.dir, "..", "..");

interface Entry {
	key: string;
	reason: string;
	site: string | null;
	check: string;
	result: "pass" | "fail";
	evidence: Evidence;
}

const isItems = (v: unknown): v is SurfaceItem[] => Array.isArray(v);

const isReasons = (v: unknown): v is Record<string, string> =>
	isRecord(v) && Object.values(v).every((r) => typeof r === "string");

const readJson = async (file: string): Promise<unknown> =>
	JSON.parse(await Bun.file(file).text());

const itemsOf = (surface: unknown) => {
	const items = new Map<string, SurfaceItem>();
	if (!isRecord(surface) || !isRecord(surface["kinds"])) {
		throw new Error("surface.json has no kinds");
	}
	for (const [kind, list] of Object.entries(surface["kinds"])) {
		if (!isItems(list)) {
			throw new Error(`surface.json kind ${kind} is not a list`);
		}
		for (const i of list) {
			items.set(`${kind}:${i.name}`, i);
		}
	}
	return items;
};

const sweepOf = (v: unknown): Record<string, unknown> => {
	if (!isRecord(v) || !isRecord(v["data"])) {
		throw new Error("sweep.json has no data");
	}
	return v["data"];
};

const at = (i: SurfaceItem) =>
	i.module === null ? null : `${i.module}@${i.offset}`;

const stale = (key: string, reason: string): Entry => ({
	key,
	reason,
	site: null,
	check: "stale",
	result: "fail",
	evidence: { note: "no item of surface.json matches the key" },
});

const entryOf = async (
	c: Ctx,
	key: string,
	reason: string,
	covered: SurfaceItem[],
): Promise<Entry> => {
	const [head] = covered;
	if (head === undefined) {
		return stale(key, reason);
	}
	let check = "";
	const bad: { item: string; evidence: Evidence }[] = [];
	let first: Evidence = {};
	await eachOf(covered, async (i) => {
		const [name, run] = pick(c, reason, i);
		check = name;
		const v = await run();
		if (!v.ok) {
			bad.push({ item: i.name, evidence: v.evidence });
		} else if (Object.keys(first).length === 0) {
			first = v.evidence;
		}
	});
	return {
		key,
		reason,
		site: at(head),
		check,
		result: bad.length > 0 ? "fail" : "pass",
		evidence: {
			items: covered.length,
			...(bad.length > 0
				? { failed: bad.length, firstFailed: bad.slice(0, 3) }
				: first),
		},
	};
};

const coveredBy = (
	items: Map<string, SurfaceItem>,
	key: string,
	reason: string,
) =>
	[...items]
		.filter(([k]) => exclusionOf(k, { [key]: reason }) !== undefined)
		.map(([, i]) => i);

/** Run every exclusion through its check; the entries come back sorted by key. */
export const audit = async (version: string, root: string) => {
	const exclusions = await readJson(
		join(root, "tools", "surface", "exclusions.json"),
	);
	if (!isReasons(exclusions)) {
		throw new Error("exclusions.json is not a map of reasons");
	}
	const items = itemsOf(
		await readJson(join(root, "captures", version, "surface.json")),
	);
	const p = await program(version);
	const c: Ctx = {
		version,
		root,
		bundle: await p.bundle(),
		items,
		sweep: sweepOf(
			await readJson(join(root, "captures", version, "print", "sweep.json")),
		),
		endpointRows: await docsNames(root, ["docs/reference/api/endpoints.md"]),
		libraries: {},
	};
	const entries: Entry[] = [];
	await eachOf(Object.entries(exclusions), async ([key, reason]) => {
		entries.push(await entryOf(c, key, reason, coveredBy(items, key, reason)));
	});
	entries.sort((a, b) => compare(a.key, b.key));
	const libraries = Object.entries(c.libraries);
	libraries.sort(([a], [b]) => compare(a, b));
	return { version, libraries: Object.fromEntries(libraries), entries };
};

const summary = (entries: Entry[]) => {
	const by = new Map<string, [number, number]>();
	for (const e of entries) {
		const name = `${e.check} | ${e.reason.slice(0, 70)}`;
		const g = by.get(name) ?? [0, 0];
		g[e.result === "pass" ? 0 : 1]++;
		by.set(name, g);
	}
	const rows = [...by];
	rows.sort(([a], [b]) => compare(a, b));
	return rows.map(([g, [p, f]]) => `pass ${p} fail ${f}  ${g}`);
};

const main = async () => {
	const { values: a } = parseArgs({
		options: { version: { type: "string" }, root: { type: "string" } },
	});
	const version = a.version ?? CLAUDE_CODE_VERSION;
	const result = await audit(version, a.root ?? ROOT);
	const file = join(
		a.root ?? ROOT,
		"captures",
		version,
		"exclusions-audit.json",
	);
	const body = `{\n"version": ${JSON.stringify(result.version)},\n"libraries": ${JSON.stringify(result.libraries)},\n"entries": [\n${result.entries.map((e) => JSON.stringify(e)).join(",\n")}\n]\n}\n`;
	await Bun.write(file, body);
	for (const line of summary(result.entries)) {
		console.info(line);
	}
	console.info(
		`${file}: ${result.entries.length} entries, ${result.entries.filter((e) => e.result === "fail").length} fail`,
	);
};

if (import.meta.main) {
	await main();
}
