// Usage: bun run schemas:observe [-- --user] [--skip print,statusline]
// Refreshes tools/schemas/observed/*.json, the value-free fixtures of observed field types that code.ts adds
// to the schemas as "x-observed-type". Sources:
//   print       print-mode runs against the local stub with OTLP/JSON sent to a local collector (observe/print.ts)
//   statusline  the status line pty probes (observe/statusline.ts); about 90 s
//   --user      your own ~/.claude files, read-only (observe/user.ts): transcripts, .claude.json, frontmatter
// Each source writes raw key path -> type counts to a temp dir. This script keeps only paths that are fields of
// a schema in schemas/ that carry "x-unverified", and merges them into the fixtures: per path and type, the larger
// count wins, capped at COUNT_CAP. No value and no key outside the schemas reaches a fixture. The temp dir is removed.
// Run `bun run schemas` after it to write the schemas.
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";
import { formatJson } from "../format.ts";
import type { Observed, Stat } from "../observe.ts";
import {
	COUNT_CAP,
	type Fixture,
	fixturePath,
	OBSERVED_DIR,
	readFixture,
	unverifiedPaths,
} from "../observed.ts";
import { sorted, sortedStrings } from "../sorted.ts";

type Counts = Record<string, number>;
type Json = Record<string, unknown>;

const argv = process.argv.slice(2);
const skip = argv.includes("--skip")
	? new Set((argv[argv.indexOf("--skip") + 1] ?? "").split(",").filter(Boolean))
	: new Set<string>();
const withUser = argv.includes("--user");

const ROOT = join(import.meta.dir, "..", "..", "..");
const TRANSCRIPT = "claude-code-transcript.json";
const SOURCES: { source: string; file: string; schema: string }[] = [
	{ source: "print", file: "print-otel.json", schema: "claude-code-otel.json" },
	{ source: "print", file: "print-transcripts.json", schema: TRANSCRIPT },
	{
		source: "print",
		file: "print-claude-json.json",
		schema: "claude-code-claude-json.json",
	},
	{
		source: "statusline",
		file: "statusline.json",
		schema: "claude-code-status-line.json",
	},
	{ source: "user", file: "user-transcripts.json", schema: TRANSCRIPT },
	{
		source: "user",
		file: "user-claude-json.json",
		schema: "claude-code-claude-json.json",
	},
	{
		source: "user",
		file: "user-frontmatter.json",
		schema: "claude-code-frontmatter.json",
	},
];

const isJson = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const isStat = (v: unknown): v is Stat =>
	isJson(v) &&
	typeof v["n"] === "number" &&
	isJson(v["types"]) &&
	Object.values(v["types"]).every((c) => typeof c === "number");

const isRaw = (v: unknown): v is { paths: Observed } =>
	isJson(v) &&
	isJson(v["paths"]) &&
	Object.values(v["paths"]).every((x) => isStat(x));

const runScript = async (script: string, tmp: string): Promise<void> => {
	const p = Bun.spawn([process.execPath, join(import.meta.dir, script), tmp], {
		cwd: ROOT,
		stdout: "inherit",
		stderr: "inherit",
	});
	const code = await p.exited;
	if (code !== 0) {
		throw new Error(`${script} failed (${code})`);
	}
};

/** Run the sources one after another: they share the stub, the ports and the temp dir. */
const runEach = async <T>(
	items: readonly T[],
	run: (item: T) => Promise<void>,
): Promise<void> => {
	const [first, ...rest] = items;
	if (first === undefined) {
		return;
	}
	await run(first);
	await runEach(rest, run);
};

const runSources = (tmp: string): Promise<void> => {
	const scripts: [string, string][] = [
		["print", "print.ts"],
		["statusline", "statusline.ts"],
		...(withUser ? [["user", "user.ts"] satisfies [string, string]] : []),
	];
	return runEach(
		scripts.filter(([source]) => !skip.has(source)),
		([source, script]) => {
			console.info(`observe: ${source}`);
			return runScript(script, tmp);
		},
	);
};

/** The raw report of one source file, or undefined when that source was not run. */
const readRaw = async (path: string): Promise<Observed | undefined> => {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		return undefined;
	}
	const raw: unknown = await file.json();
	if (!isRaw(raw)) {
		throw new TypeError(`${path} is not an observation report`);
	}
	return raw.paths;
};

const addPaths = (into: Map<string, Counts>, paths: Observed): void => {
	for (const [key, stat] of Object.entries(paths)) {
		if (key === "$root") {
			continue;
		}
		const path = key.startsWith("$root.") ? key.slice("$root.".length) : key;
		const types = into.get(path) ?? {};
		for (const [t, c] of Object.entries(stat.types)) {
			types[t] = (types[t] ?? 0) + c;
		}
		into.set(path, types);
	}
};

/** Schema file -> path -> type -> count. */
const mergeSources = async (
	tmp: string,
): Promise<Map<string, Map<string, Counts>>> => {
	const reports = await Promise.all(
		SOURCES.map((s) => readRaw(join(tmp, s.file))),
	);
	const merged = new Map<string, Map<string, Counts>>();
	for (const [n, s] of SOURCES.entries()) {
		const paths = reports[n];
		if (paths === undefined) {
			continue;
		}
		const into = merged.get(s.schema) ?? new Map<string, Counts>();
		merged.set(s.schema, into);
		addPaths(into, paths);
	}
	return merged;
};

const sortedCounts = (counts: Counts): Counts =>
	Object.fromEntries(
		sortedStrings(Object.keys(counts)).map((k) => [k, counts[k] ?? 0]),
	);

/** Fold the counts seen for the schema's unverified fields into the old fields. Give the new fields and how many are new. */
const mergeFields = (
	old: Fixture["fields"],
	schema: Json,
	paths: Map<string, Counts>,
): { fields: Fixture["fields"]; added: number } => {
	const fields: Fixture["fields"] = { ...old };
	let added = 0;
	for (const path of unverifiedPaths(schema)) {
		const seen = paths.get(path);
		if (seen === undefined) {
			continue;
		}
		const cur: Counts = { ...fields[path] };
		for (const [t, c] of Object.entries(seen)) {
			cur[t] = Math.min(COUNT_CAP, Math.max(cur[t] ?? 0, c));
		}
		if (fields[path] === undefined) {
			added++;
		}
		fields[path] = sortedCounts(cur);
	}
	return { fields, added };
};

const writeFixture = async (
	schemaFile: string,
	paths: Map<string, Counts>,
): Promise<void> => {
	const parsed: unknown = await Bun.file(
		join(ROOT, "schemas", schemaFile),
	).json();
	if (!isJson(parsed)) {
		throw new TypeError(`${schemaFile} is not a JSON object`);
	}
	const old = await readFixture(schemaFile);
	const { fields, added } = mergeFields(old?.fields ?? {}, parsed, paths);
	const out: Fixture = {
		$comment:
			"Value-free. Field path -> JSON types seen in real payloads (stub probes and local files) with a count each, capped at 100. Built by tools/schemas/observe/run.ts; tools/schemas/code.ts reads it. Do not edit by hand.",
		version: CLAUDE_CODE_VERSION,
		fields: Object.fromEntries(
			sortedStrings(Object.keys(fields)).map((k) => [k, fields[k] ?? {}]),
		),
	};
	await Bun.write(
		fixturePath(schemaFile),
		await formatJson(out, fixturePath(schemaFile)),
	);
	console.info(
		`${schemaFile}: ${Object.keys(out.fields).length} fields (${added} new)`,
	);
};

const main = async (): Promise<void> => {
	const tmp = await mkdtemp(join(tmpdir(), "cc-observe-"));
	try {
		await runSources(tmp);
		const merged = await mergeSources(tmp);
		await mkdir(OBSERVED_DIR, { recursive: true });
		// One after another so the output lines keep their order.
		await runEach(
			sorted([...merged], ([a], [b]) => (a < b ? -1 : 1)),
			([schemaFile, paths]) => writeFixture(schemaFile, paths),
		);
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

await main();
