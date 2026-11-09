// Result types and I/O: captures/<version>/<group>/<case>.json. Redaction and normalisation live here.
import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";

import { factsForProbe } from "../facts/map.ts";
import { versionDir } from "../util.ts";
import { FAKE_KEY } from "./env.ts";
import { pathExists } from "./fs.ts";

export type Data = string | number | boolean | null | string[];
export interface CaseResult {
	schema: 1;
	/** Stable across versions, e.g. "print.hooks.posttooluse.edit". */
	id: string;
	group: "print" | "pty" | "managed" | "live" | "diff";
	version: string;
	prompt: string;
	args: string[];
	/** Names only. */
	envSet: string[];
	exit: number | null;
	timedOut: boolean;
	data: Record<string, Data>;
	samples?: Record<string, string>;
	/** Earlier program launches of a case that was rerun (timing rerun, or retry of an invalid run), oldest first. The case's own data is the last launch. */
	attempts?: {
		data: Record<string, Data>;
		samples?: Record<string, string>;
	}[];
	requests?: {
		count: number;
		paths: string[];
		betas?: string[];
		bodyKeys?: string[];
	};
	cacheWarm?: boolean;
	facts: string[];
	notes?: string;
}

const SAMPLE_MAX = 3000;
const secrets = new Set<string>();
/** Register a live secret value so redact/writeCase catch it. */
export const registerSecret = (v: string): void => {
	if (v.length >= 8) {
		secrets.add(v);
	}
};

const SECRET_RE = /sk-ant-[A-Za-z0-9_-]+|Bearer\s+[A-Za-z0-9._~+/=-]{8,}/giu;
const isFake = (s: string): boolean => s === FAKE_KEY;

const mapStrings = (v: unknown, f: (s: string) => string): unknown => {
	if (typeof v === "string") {
		return f(v);
	}
	if (Array.isArray(v)) {
		return v.map((x) => mapStrings(x, f));
	}
	if (typeof v === "object" && v !== null) {
		return Object.fromEntries(
			Object.entries(v).map(([k, x]) => [f(k), mapStrings(x, f)]),
		);
	}
	return v;
};

const redactString = (s: string): string => {
	let out = s;
	for (const sec of secrets) {
		out = out.split(sec).join("<redacted>");
	}
	return out.replaceAll(SECRET_RE, (m) => (isFake(m) ? m : "<redacted>"));
};

/** Replace secret-shaped strings (and any registered secret) with <redacted>. The fake key is kept. */
export function redact<T>(obj: T): T;
export function redact(obj: unknown): unknown {
	return mapStrings(obj, redactString);
}

const findSecret = (obj: unknown): string | null => {
	let hit: string | null = null;
	mapStrings(obj, (s) => {
		for (const sec of secrets) {
			if (s.includes(sec)) {
				hit ??= "registered secret";
			}
		}
		for (const m of s.matchAll(SECRET_RE)) {
			if (!isFake(m[0])) {
				hit ??= m[0].slice(0, 12);
			}
		}
		return s;
	});
	return hit;
};

const normaliseString = (s: string): string =>
	s
		.replaceAll(
			/\/(?:private\/)?(?:var\/folders\/[^\s"']*?\/T|tmp)\/ccrel-[A-Za-z0-9]+/gu,
			"<TMP>",
		)
		.replaceAll(/\/(?:private\/)?var\/folders\/[^\s"']+/gu, "<TMP>")
		// the program's dash-encoded project slug: -private-var-folders-xx-yyyy-T-ccrel-AbC123-proj
		.replaceAll(
			/-(?:private-)?(?:var-folders-[A-Za-z0-9-]+?-T|tmp)-ccrel-[A-Za-z0-9]+/gu,
			"<TMP>",
		)
		.replaceAll(
			/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu,
			"<uuid>",
		)
		// clock times the screen prints ("done 5:02 AM")
		.replaceAll(/\b\d{1,2}:\d{2}\s?[AP]M\b/gu, "<time>")
		.replaceAll(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/gu, "<ts>")
		.replaceAll(/\b\d{4}-\d{2}-\d{2}\b/gu, "<date>")
		.replaceAll(/\b(?:req|msg|toolu)_[A-Za-z0-9]{6,}/gu, "<id>")
		.replaceAll(/(127\.0\.0\.1|localhost):\d+/gu, "$1:<port>")
		.replaceAll(/(cc_version=\d+\.\d+\.\d+)\.[0-9a-f]+/gu, "$1.<build>");

/** Drop what changes between runs: temp paths, request ids, timestamps, uuids, ports, cc_version build suffix. */
export function normalise<T>(obj: T): T;
export function normalise(obj: unknown): unknown {
	return mapStrings(obj, normaliseString);
}

/** The build suffix of `cc_version=2.1.305.abc`, kept as its own field. */
export const ccVersion = (
	s: string,
): { version: string; build: string } | null => {
	const m = /cc_version=(\d+\.\d+\.\d+)(?:\.([0-9a-f]+))?/u.exec(s);
	const version = m?.[1];
	return version === undefined || version === ""
		? null
		: { version, build: m?.[2] ?? "" };
};

const dirOf = (version: string, base?: string): string =>
	base === undefined || base === "" ? versionDir(version) : join(base, version);

/** Run dir for a version (default captures/<version>). `base` is for tests. */
export const openRun = async (
	version: string,
	base?: string,
): Promise<string> => {
	const dir = dirOf(version, base);
	await mkdir(dir, { recursive: true });
	return dir;
};

const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const caseFile = (r: CaseResult): string =>
	`${r.id.startsWith(`${r.group}.`) ? r.id.slice(r.group.length + 1) : r.id}.json`;

const assertNoSecret = (id: string, x: unknown): void => {
	const hit = findSecret(x);
	if (hit !== null) {
		throw new Error(
			`refusing to write ${id}: secret-shaped string (${hit}...)`,
		);
	}
};

/** Adds the map.json facts of the case, normalises samples, then fails the write if any secret-shaped string remains. */
export const writeCase = async (
	runDir: string,
	r: CaseResult,
): Promise<string> => {
	if (!ID_RE.test(r.id) || r.id.includes("..")) {
		throw new Error(`bad case id: ${r.id}`);
	}
	assertNoSecret(r.id, r);
	const samples =
		r.samples === undefined
			? undefined
			: Object.fromEntries(
					Object.entries(normalise(r.samples)).map(([k, v]) => [
						k,
						v.slice(0, SAMPLE_MAX),
					]),
				);
	const facts = [...new Set([...r.facts, ...factsForProbe(r.id)])];
	const out: CaseResult = {
		...r,
		facts,
		...(samples === undefined ? {} : { samples }),
	};
	assertNoSecret(r.id, out);
	const dir = join(runDir, r.group);
	await mkdir(dir, { recursive: true });
	const path = join(dir, caseFile(r));
	await Bun.write(path, `${JSON.stringify(out, null, 2)}\n`);
	return path;
};

export const isCaseResult = (x: unknown): x is CaseResult => {
	if (typeof x !== "object" || x === null) {
		return false;
	}
	return (
		"schema" in x &&
		x.schema === 1 &&
		"id" in x &&
		typeof x.id === "string" &&
		x.id !== ""
	);
};

const readGroup = async (dir: string, group: string): Promise<CaseResult[]> => {
	const d = join(dir, group);
	if (!(await pathExists(d))) {
		return [];
	}
	const names = await readdir(d);
	const files = names.filter((n) => n.endsWith(".json"));
	const parsed = await Promise.all(
		files.map((f): Promise<unknown> => Bun.file(join(d, f)).json()),
	);
	return parsed.filter((j) => isCaseResult(j));
};

export const readRun = async (
	version: string,
	base?: string,
): Promise<CaseResult[]> => {
	const dir = dirOf(version, base);
	const groups = await Promise.all(
		["print", "pty", "managed", "live"].map((g) => readGroup(dir, g)),
	);
	return groups.flat().toSorted((a, b) => a.id.localeCompare(b.id));
};
