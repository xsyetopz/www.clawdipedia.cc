// Subscription prompt-cache helper for live runs. The cache has a 1 h TTL and is shared across sessions, so a
// result is "warm" if any session used the same prefix in the last hour. Warm counts must not become doc numbers.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { versionDir } from "../util.ts";

const TTL_MS = 60 * 60 * 1000;

export interface Plannable {
	id: string;
	coldSensitive?: boolean;
}

const lastRunFile = (version: string): string =>
	join(versionDir(version), "live", "last-run.json");

/** Milliseconds since the last live run of this version, or null when there is none. */
export const sinceLastRun = async (
	version: string,
	file = lastRunFile(version),
): Promise<number | null> => {
	const f = Bun.file(file);
	if (!(await f.exists())) {
		return null;
	}
	try {
		const last: unknown = await f.json();
		const raw =
			typeof last === "object" && last !== null && "at" in last
				? last.at
				: undefined;
		const at = Date.parse(String(raw));
		return Number.isFinite(at) ? Date.now() - at : null;
	} catch {
		return null;
	}
};

export const recordLiveRun = async (
	version: string,
	file = lastRunFile(version),
): Promise<void> => {
	await mkdir(dirname(file), { recursive: true });
	await Bun.write(
		file,
		`${JSON.stringify({ at: new Date().toISOString(), version })}\n`,
	);
};

/** True when the previous live run is under one hour old (the cache may still be warm). */
export const maybeWarm = async (
	version: string,
	file?: string,
): Promise<boolean> => {
	const ago = await sinceLastRun(version, file);
	return ago !== null && ago < TTL_MS;
};

/** Human text for the plan. */
export const cacheNote = async (
	version?: string,
	file?: string,
): Promise<string> => {
	const base =
		"The subscription prompt cache lasts 1 h and is shared by all sessions. Each case puts a unique marker in its project CLAUDE.md so its prefix is new; the system prompt and tools may still be cached. A warm cache lowers token counts, so a result with cacheWarm=true is not a doc number. No case is retried.";
	if (version === undefined || version === "") {
		return base;
	}
	const ago = await sinceLastRun(version, file);
	if (ago === null) {
		return `${base} No earlier live run of ${version} is recorded.`;
	}
	const min = Math.round(ago / 60_000);
	return ago < TTL_MS
		? `${base} WARNING: the last live run of ${version} was ${min} min ago (under 1 h): results may be marked cacheWarm.`
		: `${base} The last live run of ${version} was ${min} min ago (cache expired).`;
};

/** Cold-sensitive cases first (the cache is coldest at the start of a run); otherwise the given order. */
export const planLive = <T extends Plannable>(cases: T[]): T[] => [
	...cases.filter((c) => c.coldSensitive === true),
	...cases.filter((c) => c.coldSensitive !== true),
];

/** A fresh marker line for a project CLAUDE.md: a new marker means a new cache prefix for that case. */
export const cacheMarker = (id: string): string =>
	`<!-- release-probe marker ${id} ${crypto.randomUUID()} -->\n`;

interface Usage {
	cache_read_input_tokens?: unknown;
}
/** Warm when the first response usage read from the cache. Null when no usage was seen. */
export const warmFromUsage = (
	usage: Usage | null | undefined,
): boolean | null =>
	usage ? Number(usage.cache_read_input_tokens ?? 0) > 0 : null;
