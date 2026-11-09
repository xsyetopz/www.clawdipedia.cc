// HTTP and cache orchestration. One entry point: getResource().
// Rules: 8 s timeout, size caps, same-origin redirects (max 3), 6 requests at once,
// identical in-flight requests share one promise, conditional requests from cache validators,
// stale cache is served when the network fails, a 404 deletes the cached copy.
import type { Cached, Meta } from "./cache-meta.ts";
import { DiskCache } from "./cache.ts";
import { type Got, httpGet } from "./http.ts";

const MAX_CONCURRENT = 6;

export const MB = 1024 * 1024;

/** TTL multiplier. Test-only: CLAWDIPEDIA_TTL_SCALE=0 makes every cached file stale at once. */
const ttlScale = (): number => {
	const n = Number(process.env["CLAWDIPEDIA_TTL_SCALE"]);
	return process.env["CLAWDIPEDIA_TTL_SCALE"] !== undefined &&
		Number.isFinite(n) &&
		n >= 0
		? n
		: 1;
};
export const ttl = (ms: number): number => ms * ttlScale();

/** Base URL from an env var. https only; http only for localhost and 127.0.0.1. Else the default. */
export const baseUrl = (envName: string, fallback: string): string => {
	const raw = process.env[envName];
	if (raw === undefined || raw === "") {
		return fallback;
	}
	try {
		const u = new URL(raw);
		const local = u.hostname === "localhost" || u.hostname === "127.0.0.1";
		if (u.protocol === "https:" || (u.protocol === "http:" && local)) {
			return raw.replace(/\/+$/u, "");
		}
	} catch {
		// Fall through to the default.
	}
	console.error(`clawdipedia-docs: ignoring ${envName} (needs https)`);
	return fallback;
};

export type SourceState = "live" | "cached" | "stale-offline";

export interface Source {
	/** Host, e.g. "clawdipedia.cc". */
	origin: string;
	state: SourceState;
	fetchedAt: string;
	/** True when a conditional request got 304. */
	revalidated: boolean;
}

export type Resource =
	| { status: "ok"; body: string; source: Source }
	| { status: "notfound"; origin: string }
	| { status: "error"; origin: string; message: string };

export interface Spec {
	/** Full URL to fetch. */
	url: string;
	/** Cache path under the cache root, e.g. "site/pages/index.md". */
	rel: string;
	ttlMs: number;
	maxBytes: number;
	/** A 404 deletes the cached copy (pages, schemas). Not for the manifest or llms.txt. */
	deleteOn404?: boolean;
	/** Optional check on a body (fresh or cached). A false result counts as corrupt/failed. */
	validate?: (body: string) => boolean;
}

let cache: Promise<DiskCache> | undefined;
const diskCache = (): Promise<DiskCache> => {
	cache ??= DiskCache.open();
	return cache;
};

// ---- semaphore ----
let active = 0;
const waiting: (() => void)[] = [];
const acquire = async (): Promise<void> => {
	if (active < MAX_CONCURRENT) {
		active++;
		return;
	}
	await new Promise<void>((resolve) => {
		waiting.push(resolve);
	});
};
const release = (): void => {
	const next = waiting.shift();
	if (next) {
		next();
	} else {
		active--;
	}
};

const inflight = new Map<string, Promise<Resource>>();

const okResource = (
	body: string,
	origin: string,
	state: SourceState,
	fetchedAt: string,
	revalidated: boolean,
): Resource => ({
	status: "ok",
	body,
	source: { origin, state, fetchedAt, revalidated },
});

/** The cached copy, or undefined when it is missing, from another URL, or fails validation. */
const lookup = async (
	dc: DiskCache,
	spec: Spec,
): Promise<Cached | undefined> => {
	const cached = await dc.get(spec.rel);
	// A copy fetched from another URL (other base URL, case-colliding route) is a miss.
	if (cached?.meta && cached.meta.url !== spec.url) {
		return undefined;
	}
	if (cached && spec.validate && !spec.validate(cached.body)) {
		await dc.delete(spec.rel);
		return undefined;
	}
	return cached;
};

const isFresh = (meta: Meta | undefined, ttlMs: number): meta is Meta =>
	meta !== undefined && Date.now() - Date.parse(meta.fetchedAt) < ttlMs;

const download = async (spec: Spec, meta: Meta | undefined): Promise<Got> => {
	await acquire();
	let got: Got;
	try {
		got = await httpGet(spec.url, spec.maxBytes, {
			...(meta?.etag !== undefined && meta.etag !== ""
				? { etag: meta.etag }
				: {}),
			...(meta?.lastModified !== undefined && meta.lastModified !== ""
				? { lastModified: meta.lastModified }
				: {}),
		});
	} finally {
		release();
	}
	if (got.kind === "ok" && spec.validate && !spec.validate(got.body)) {
		return { kind: "fail", message: "response is not valid" };
	}
	// Only pages and schemas can be "gone"; for the manifest and llms.txt a 404 is a failure (cache fallback).
	if (got.kind === "notfound" && spec.deleteOn404 !== true) {
		return { kind: "fail", message: "HTTP 404" };
	}
	return got;
};

const fromOk = async (
	dc: DiskCache,
	spec: Spec,
	got: Extract<Got, { kind: "ok" }>,
): Promise<Resource> => {
	await dc.put(spec.rel, got.body, {
		url: spec.url,
		...(got.etag === undefined ? {} : { etag: got.etag }),
		...(got.lastModified === undefined
			? {}
			: { lastModified: got.lastModified }),
	});
	return okResource(
		got.body,
		new URL(spec.url).host,
		"live",
		new Date().toISOString(),
		false,
	);
};

const fromNetwork = async (
	dc: DiskCache,
	spec: Spec,
	cached: Cached | undefined,
	got: Got,
): Promise<Resource> => {
	const origin = new URL(spec.url).host;
	if (got.kind === "notfound") {
		await dc.delete(spec.rel);
		return { status: "notfound", origin };
	}
	if (got.kind === "ok") {
		return fromOk(dc, spec, got);
	}
	if (got.kind === "not-modified" && cached) {
		await dc.touch(spec.rel);
		return okResource(
			cached.body,
			origin,
			"cached",
			new Date().toISOString(),
			true,
		);
	}
	if (cached) {
		return okResource(
			cached.body,
			origin,
			"stale-offline",
			cached.meta?.fetchedAt ?? new Date(0).toISOString(),
			false,
		);
	}
	const message =
		got.kind === "fail" ? got.message : "unexpected 304 without a cached copy";
	return {
		status: "error",
		origin,
		message: `could not reach ${origin} and nothing is cached (${message})`,
	};
};

const resolveResource = async (spec: Spec): Promise<Resource> => {
	const dc = await diskCache();
	const cached = await lookup(dc, spec);
	if (cached && isFresh(cached.meta, spec.ttlMs)) {
		return okResource(
			cached.body,
			new URL(spec.url).host,
			"cached",
			cached.meta.fetchedAt,
			false,
		);
	}
	const got = await download(spec, cached?.meta);
	return fromNetwork(dc, spec, cached, got);
};

const shared = async (spec: Spec, key: string): Promise<Resource> => {
	try {
		return await resolveResource(spec);
	} finally {
		inflight.delete(key);
	}
};

/** Cache first, then network, then stale cache. Concurrent identical calls share one promise. */
export const getResource = (spec: Spec): Promise<Resource> => {
	const key = `${spec.rel}\n${spec.url}`;
	let p = inflight.get(key);
	if (!p) {
		p = shared(spec, key);
		inflight.set(key, p);
	}
	return p;
};

/** "3 d ago" style age. */
export const ago = (iso: string): string => {
	const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
	if (s < 90) {
		return `${Math.round(s)} s ago`;
	}
	if (s < 5400) {
		return `${Math.round(s / 60)} min ago`;
	}
	if (s < 129_600) {
		return `${Math.round(s / 3600)} h ago`;
	}
	return `${Math.round(s / 86_400)} d ago`;
};

const describeSource = (s: Source): string => {
	if (s.state === "live") {
		return "live";
	}
	if (s.state === "stale-offline") {
		return `cache (fetched ${ago(s.fetchedAt)}, offline)`;
	}
	return s.revalidated
		? "cache (revalidated, 304)"
		: `cache (fetched ${ago(s.fetchedAt)})`;
};

/** One line for the end of a tool result. */
export const sourceLine = (s: Source): string =>
	`Source: ${s.origin}, ${describeSource(s)}`;

export const sourceData = (s: Source) => ({
	origin: s.origin,
	state: s.state,
	fetchedAt: s.fetchedAt,
});
