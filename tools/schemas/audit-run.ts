// Usage: bun tools/schemas/audit-run.ts --ref REF [--raw DIR] [--list]
// Audits the hand-read types of every field that was "x-unverified" in schemas/ at the git ref REF (see audit.ts).
// The program is the build of src/version.ts, loaded as tools/schemas/code.ts loads it. --raw DIR holds the counts
// from `bun run schemas:observe -- --raw DIR`; without it, each field has no samples. --list prints every row.
// A field the current schema no longer has is "removed". Sets exit code 1 when a field has no entry, an anchor the program lacks, or a payload type its entry does not allow.
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import {
	auditFields,
	auditPasses,
	type AuditRow,
	markRemoved,
	shareSamples,
} from "./audit.ts";
import { argv, isJson, mods, ROOT } from "./code/ctx.ts";
import { anchorIn, readManual } from "./manual.ts";
import { type Seen, unverifiedPaths, walkFields } from "./observed.ts";

const arg = (name: string): string | undefined =>
	argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined;
const ref = arg("--ref");
const rawDir = arg("--raw");
if (ref === undefined) {
	throw new Error(
		"audit: give --ref REF, the commit whose schemas still had x-unverified fields",
	);
}

const gitShow = async (path: string): Promise<string | undefined> => {
	const p = Bun.spawn(["git", "show", `${ref}:${path}`], {
		cwd: ROOT,
		stdout: "pipe",
		stderr: "ignore",
	});
	const text = await new Response(p.stdout).text();
	return (await p.exited) === 0 ? text : undefined;
};

const listing = await gitShow("schemas");
const files = (listing ?? "")
	.split("\n")
	.filter((f) => f.startsWith("claude-code-") && f.endsWith(".json"));
const has = anchorIn(mods.map((m) => m.text).join("\n"));

const isSeen = (v: unknown): v is Record<string, Seen> =>
	isJson(v) &&
	Object.values(v).every(
		(t) => isJson(t) && Object.values(t).every((c) => typeof c === "number"),
	);

/** The raw counts that `observe/run.ts --raw` wrote for a schema file, or none. */
const readSeen = async (file: string): Promise<Record<string, Seen>> => {
	const raw = rawDir === undefined ? undefined : Bun.file(`${rawDir}/${file}`);
	if (raw === undefined || !(await raw.exists())) {
		return {};
	}
	const json: unknown = await raw.json();
	if (!isSeen(json)) {
		throw new TypeError(
			`${rawDir}/${file} is not a map of path -> type counts`,
		);
	}
	return json;
};

const auditFile = async (file: string): Promise<AuditRow[]> => {
	const old: unknown = JSON.parse((await gitShow(`schemas/${file}`)) ?? "{}");
	const paths = isJson(old) ? unverifiedPaths(old) : [];
	if (paths.length === 0) {
		return [];
	}
	const manual = await readManual(file);
	const now: unknown = await Bun.file(`${ROOT}/schemas/${file}`).json();
	const present = new Set<string>();
	if (isJson(now)) {
		walkFields(now, (p) => present.add(p));
	}
	return markRemoved(
		shareSamples(auditFields(paths, manual, has, await readSeen(file)), manual),
		(p) => present.has(p),
	);
};

const perFile = await Promise.all(
	files.map(async (file) => ({ file, rows: await auditFile(file) })),
);
const all: AuditRow[] = [];
for (const { file, rows } of perFile) {
	if (rows.length === 0) {
		continue;
	}
	all.push(...rows);
	const by = Object.groupBy(rows, (r) => r.verdict);
	const counts = Object.entries(by).map(([v, rs]) => `${rs?.length ?? 0} ${v}`);
	console.info(
		`${file}: ${rows.length} fields x-unverified at ${ref}: ${counts.join(", ")}`,
	);
}
for (const r of all) {
	const bad = !auditPasses([r]);
	if (bad || argv.includes("--list")) {
		const extra = [
			...r.missing.map((a) => `missing ${a}`),
			...r.missed.map((t) => `seen ${t}`),
			...(r.via === undefined ? [] : [`via ${r.via}`]),
		];
		console.info(
			`  ${r.verdict}: ${r.path} (${r.samples} samples)${extra.length > 0 ? ` ${extra.join("; ")}` : ""}`,
		);
	}
}
console.info(
	`audit: ${all.length} fields against the ${CLAUDE_CODE_VERSION} program: ${auditPasses(all) ? "ok" : "FAIL"}`,
);
process.exitCode = auditPasses(all) ? 0 : 1;
