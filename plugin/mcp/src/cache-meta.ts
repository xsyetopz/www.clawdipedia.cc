// Helpers for the disk cache: types, size cap, root folder, path check, and prune order.
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

export interface Meta {
	url: string;
	etag?: string;
	lastModified?: string;
	fetchedAt: string;
	status: 200;
	bytes: number;
	sha256: string;
}

export interface Cached {
	body: string;
	meta: Meta | undefined;
}

export const CACHE_CAP_BYTES = 60 * 1024 * 1024;

/** Total cache cap. CLAWDIPEDIA_CACHE_CAP_BYTES overrides it (a user setting; tests also use it). */
export const capBytes = (): number => {
	const n = Number(process.env["CLAWDIPEDIA_CACHE_CAP_BYTES"]);
	return process.env["CLAWDIPEDIA_CACHE_CAP_BYTES"] !== undefined &&
		Number.isFinite(n) &&
		n >= 0
		? n
		: CACHE_CAP_BYTES;
};

const nonEmpty = (v: string | undefined): string | undefined =>
	v === undefined || v === "" ? undefined : v;

/** Cache root, first match wins: CLAWDIPEDIA_CACHE_DIR, ${CLAUDE_PLUGIN_DATA}/cache, then the XDG cache dir. */
export const cacheRoot = (): string => {
	const env = process.env;
	const dir = nonEmpty(env["CLAWDIPEDIA_CACHE_DIR"]);
	if (dir !== undefined) {
		return resolve(dir);
	}
	const data = nonEmpty(env["CLAUDE_PLUGIN_DATA"]);
	if (data !== undefined) {
		return resolve(data, "cache");
	}
	return join(
		nonEmpty(env["XDG_CACHE_HOME"]) ?? join(homedir(), ".cache"),
		"clawdipedia",
	);
};

/** Joins and checks that the result stays inside base. Returns undefined otherwise. */
export const inside = (
	base: string,
	...parts: string[]
): string | undefined => {
	const root = resolve(base);
	const p = resolve(root, ...parts);
	return p.startsWith(root + sep) ? p : undefined;
};

export const sha = (b: Buffer | string): string =>
	createHash("sha256").update(b).digest("hex");

export const isMeta = (m: unknown): m is Meta => {
	if (typeof m !== "object" || m === null) {
		return false;
	}
	return (
		typeof Reflect.get(m, "url") === "string" &&
		typeof Reflect.get(m, "fetchedAt") === "string" &&
		typeof Reflect.get(m, "bytes") === "number" &&
		typeof Reflect.get(m, "sha256") === "string"
	);
};

/** Files pruned first to last when the cache is over the cap. Index files are never pruned. */
const pruneRank = (relPath: string): number => {
	const rel = relPath.replaceAll("\\", "/");
	if (
		rel.startsWith("platform/pages/") ||
		rel.startsWith("code/pages/") ||
		rel.startsWith("claude-resources/pages/")
	) {
		return 0;
	}
	if (rel.startsWith("site/pages/") || rel.startsWith("site/schemas/")) {
		return 1;
	}
	return 2;
};

export interface FileInfo {
	rel: string;
	size: number;
	at: number;
}

/** The files to delete, in order, until the total size is at or under the cap. Index files and `keep` stay. */
export const pickVictims = (all: FileInfo[], keep: string): FileInfo[] => {
	let size = all.reduce((n, f) => n + f.size, 0);
	const out: FileInfo[] = [];
	const ordered = all
		.filter((f) => pruneRank(f.rel) < 2 && f.rel !== keep)
		.toSorted((a, b) => pruneRank(a.rel) - pruneRank(b.rel) || a.at - b.at);
	for (const f of ordered) {
		if (size <= capBytes()) {
			break;
		}
		out.push(f);
		size -= f.size;
	}
	return out;
};
