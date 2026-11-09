// One HTTP GET with the fetch rules: timeout, size cap, same-origin redirects, conditional headers.
import pkg from "../package.json" with { type: "json" };

export const FETCH_TIMEOUT_MS = 8000;
export const MAX_REDIRECTS = 3;
const UA = `clawdipedia-docs-mcp/${pkg.version} (+https://github.com/xsyetopz/www.clawdipedia.cc)`;
const ACCEPT = "text/markdown, text/plain, application/json;q=0.9";

export type Got =
	| { kind: "ok"; body: string; etag?: string; lastModified?: string }
	| { kind: "not-modified" }
	| { kind: "notfound" }
	| { kind: "fail"; message: string };

const fail = (message: string): Got => ({ kind: "fail", message });

const readCapped = async (
	res: Response,
	max: number,
): Promise<string | undefined> => {
	const len = Number(res.headers.get("content-length"));
	if (Number.isFinite(len) && len > max) {
		await res.body?.cancel();
		return undefined;
	}
	if (!res.body) {
		return "";
	}
	const chunks: Uint8Array[] = [];
	let size = 0;
	// Leaving the loop early cancels the stream.
	for await (const value of res.body) {
		size += value.length;
		if (size > max) {
			return undefined;
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks).toString("utf8");
};

const finish = async (res: Response, maxBytes: number): Promise<Got> => {
	if (res.status === 304) {
		await res.body?.cancel();
		return { kind: "not-modified" };
	}
	if (res.status === 404) {
		await res.body?.cancel();
		return { kind: "notfound" };
	}
	if (!res.ok) {
		await res.body?.cancel();
		return fail(`HTTP ${res.status}`);
	}
	const body = await readCapped(res, maxBytes);
	if (body === undefined) {
		return fail(`response over ${maxBytes} bytes`);
	}
	const etag = res.headers.get("etag");
	const lastModified = res.headers.get("last-modified");
	return {
		kind: "ok",
		body,
		...(etag !== null && etag !== "" ? { etag } : {}),
		...(lastModified !== null && lastModified !== "" ? { lastModified } : {}),
	};
};

/** The next URL to fetch, or a failure when the redirect is not allowed. */
const redirectTarget = (
	res: Response,
	cur: string,
	hop: number,
	origin: string,
): string | Got => {
	const loc = res.headers.get("location");
	if (loc === null || loc === "") {
		return fail("redirect without Location");
	}
	if (hop >= MAX_REDIRECTS) {
		return fail("too many redirects");
	}
	const next = new URL(loc, cur);
	return next.origin === origin
		? next.href
		: fail("redirect to another origin");
};

const conditionalHeaders = (validators: {
	etag?: string;
	lastModified?: string;
}): Record<string, string> => {
	const headers: Record<string, string> = {
		"User-Agent": UA,
		Accept: ACCEPT,
	};
	if (validators.etag !== undefined && validators.etag !== "") {
		headers["If-None-Match"] = validators.etag;
	} else if (
		validators.lastModified !== undefined &&
		validators.lastModified !== ""
	) {
		headers["If-Modified-Since"] = validators.lastModified;
	}
	return headers;
};

interface Ctx {
	origin: string;
	maxBytes: number;
	headers: Record<string, string>;
	signal: AbortSignal;
}

const step = async (cur: string, hop: number, ctx: Ctx): Promise<Got> => {
	// No cookies are sent or kept: plain fetch with manual redirects.
	const res = await fetch(cur, {
		headers: ctx.headers,
		signal: ctx.signal,
		redirect: "manual",
	});
	if (res.status >= 300 && res.status < 400 && res.status !== 304) {
		await res.body?.cancel();
		const next = redirectTarget(res, cur, hop, ctx.origin);
		return typeof next === "string" ? step(next, hop + 1, ctx) : next;
	}
	return finish(res, ctx.maxBytes);
};

/** GET with conditional headers. Never throws: network errors become a "fail" result. */
export const httpGet = async (
	url: string,
	maxBytes: number,
	validators: { etag?: string; lastModified?: string },
): Promise<Got> => {
	try {
		return await step(url, 0, {
			origin: new URL(url).origin,
			maxBytes,
			headers: conditionalHeaders(validators),
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		});
	} catch (error) {
		return fail(error instanceof Error ? error.message : String(error));
	}
};
