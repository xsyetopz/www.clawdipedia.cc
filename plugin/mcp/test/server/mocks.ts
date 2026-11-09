// Mock docs hosts for the server tests: the docs site, platform, code, and claude-resources.
import { join } from "node:path";

import { searchIndexJson } from "../../src/search.ts";

const SITE = join(import.meta.dir, "..", "fixtures", "site");
const FIX = join(import.meta.dir, "..", "fixtures", "platform");
const LM = "Wed, 21 Oct 2026 07:28:00 GMT";

const text = (path: string): Promise<string> => Bun.file(path).text();
const notFound = (): Response => new Response("no", { status: 404 });
const notModified = (): Response => new Response(null, { status: 304 });
const stopper =
	(srv: { stop: (force: boolean) => Promise<void> }) => async () => {
		await srv.stop(true);
	};
const slugFile = (m: RegExpExecArray, dir: string, ext: string): string =>
	join(dir, `${m[1]?.replaceAll("/", "__")}.${ext}`);

/** Mock site switches. Tests flip these. `hits` records every request with its If-None-Match. */
export interface SiteState {
	llms404: boolean;
	/** llms-search-index.json answers 404, like a site built before the index existed. */
	noIndex: boolean;
	/** Paths that answer 404. */
	gone: Set<string>;
	/** Paths that answer with a body over the size cap. */
	huge: Set<string>;
	/** Send an ETag on pages and the index, and answer 304 to a matching If-None-Match. */
	etag: boolean;
	hits: { path: string; inm: string | null }[];
}
export const newState = (): SiteState => ({
	llms404: false,
	noIndex: false,
	gone: new Set(),
	huge: new Set(),
	etag: false,
	hits: [],
});

interface ManifestEntry {
	route: string;
	title: string;
	description: string;
}

const isEntry = (v: unknown): v is ManifestEntry =>
	typeof v === "object" &&
	v !== null &&
	typeof Reflect.get(v, "route") === "string" &&
	typeof Reflect.get(v, "title") === "string" &&
	typeof Reflect.get(v, "description") === "string";

const fixtureEntries = (raw: string): ManifestEntry[] => {
	const v: unknown = JSON.parse(raw);
	if (!Array.isArray(v) || !v.every((e) => isEntry(e))) {
		throw new TypeError("fixture manifest is not a list of entries");
	}
	return v;
};

/** llms-search-index.json for the fixture site (what the site build writes). */
const fixtureIndex = async (): Promise<string> => {
	const entries = fixtureEntries(await text(join(SITE, "manifest.json")));
	const pages = await Promise.all(
		entries.map(async (e) => ({
			route: e.route,
			title: e.title,
			description: e.description,
			text: await text(
				join(SITE, e.route === "/" ? "index.md" : `${e.route.slice(1)}.md`),
			),
		})),
	);
	return searchIndexJson("test", pages);
};

const siteIndex = async (state: SiteState, inm: string | null) => {
	if (state.noIndex) {
		return notFound();
	}
	const tag = '"i1"';
	if (state.etag && inm === tag) {
		return notModified();
	}
	return new Response(await fixtureIndex(), {
		headers: state.etag ? { etag: tag } : {},
	});
};

const sitePage = async (state: SiteState, path: string, inm: string | null) => {
	if (state.gone.has(path)) {
		return notFound();
	}
	if (state.huge.has(path)) {
		return new Response("x".repeat(3 * 1024 * 1024));
	}
	const file = join(SITE, path.slice(1));
	if (path.includes("..") || !(await Bun.file(file).exists())) {
		return notFound();
	}
	if (state.etag && path.endsWith(".md")) {
		const tag = '"v1"';
		return inm === tag
			? notModified()
			: new Response(Bun.file(file), { headers: { etag: tag } });
	}
	return new Response(Bun.file(file));
};

const siteRoute = async (state: SiteState, req: Request) => {
	const { pathname, origin } = new URL(req.url);
	const inm = req.headers.get("if-none-match");
	state.hits.push({ path: pathname, inm });
	if (pathname === "/llms-manifest.json") {
		const manifest = await text(join(SITE, "manifest.json"));
		return new Response(manifest.replaceAll("https://clawdipedia.cc", origin));
	}
	if (pathname === "/llms.txt") {
		return state.llms404
			? notFound()
			: new Response("# T\n\n> Docs for Claude Code 2.1.305.\n");
	}
	if (pathname === "/llms-search-index.json") {
		return siteIndex(state, inm);
	}
	return sitePage(state, pathname, inm);
};

/** Mock site that serves fixtures/site/ (manifest, pages, schemas) with the manifest URLs rewritten to the mock. */
export const mockSite = (state: SiteState = newState(), port = 0) => {
	const srv = Bun.serve({
		port,
		hostname: "127.0.0.1",
		fetch: (req) => siteRoute(state, req),
	});
	return {
		url: `http://127.0.0.1:${srv.port}`,
		port: srv.port ?? port,
		stop: stopper(srv),
	};
};

interface PHit {
	path: string;
	ims: string | null;
}

/** Mock platform.claude.com: llms.txt (Last-Modified, no ETag) and two pages. Records every request. */
export const mockPlatform = (rewriteLinks = true) => {
	const hits: PHit[] = [];
	const srv = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(req) {
			const { pathname, origin } = new URL(req.url);
			const ims = req.headers.get("if-modified-since");
			hits.push({ path: pathname, ims });
			if (pathname === "/llms.txt") {
				if (ims === LM) {
					return notModified();
				}
				const body = await text(join(FIX, "llms.txt"));
				return new Response(
					body.replaceAll(
						"https://platform.claude.com",
						rewriteLinks ? origin : "https://platform.claude.com",
					),
					{ headers: { "last-modified": LM } },
				);
			}
			const m = /^\/docs\/en\/([a-z0-9/-]+)\.md$/u.exec(pathname);
			const file = m ? slugFile(m, FIX, "md") : "";
			return m && (await Bun.file(file).exists())
				? new Response(Bun.file(file))
				: notFound();
		},
	});
	return {
		url: `http://127.0.0.1:${srv.port}`,
		hits,
		stop: stopper(srv),
	};
};

/** Mock code.claude.com: /docs/llms.txt (Last-Modified) and /docs/en/<slug>.md pages. Records every request. */
export const mockCode = () => {
	const dir = join(import.meta.dir, "..", "fixtures", "code");
	const hits: PHit[] = [];
	const srv = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(req) {
			const { pathname, origin } = new URL(req.url);
			const ims = req.headers.get("if-modified-since");
			hits.push({ path: pathname, ims });
			if (pathname === "/docs/llms.txt") {
				if (ims === LM) {
					return notModified();
				}
				const body = await text(join(dir, "llms.txt"));
				return new Response(
					body.replaceAll("https://code.claude.com", origin),
					{ headers: { "last-modified": LM } },
				);
			}
			// The bare path (no .md) is HTML on the real host; the mock has none.
			const m = /^\/docs\/en\/([a-z0-9/-]+)\.md$/u.exec(pathname);
			const file = m ? slugFile(m, join(dir, "pages"), "md") : "";
			return m && (await Bun.file(file).exists())
				? new Response(Bun.file(file))
				: notFound();
		},
	});
	return {
		url: `http://127.0.0.1:${srv.port}`,
		hits,
		stop: stopper(srv),
	};
};

/** Mock claude.com: /sitemap.xml (Last-Modified) and HTML pages at /<path>. A path with a trailing slash answers 308, like the real host. Records every request. */
export const mockClaudeResources = () => {
	const dir = join(import.meta.dir, "..", "fixtures", "claude-resources");
	const hits: PHit[] = [];
	const srv = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		async fetch(req) {
			const { pathname, origin } = new URL(req.url);
			const ims = req.headers.get("if-modified-since");
			hits.push({ path: pathname, ims });
			if (pathname === "/sitemap.xml") {
				if (ims === LM) {
					return notModified();
				}
				const body = await text(join(dir, "sitemap.xml"));
				return new Response(body.replaceAll("https://claude.com", origin), {
					headers: { "last-modified": LM },
				});
			}
			if (pathname.length > 1 && pathname.endsWith("/")) {
				return new Response(null, {
					status: 308,
					headers: { location: pathname.slice(0, -1) },
				});
			}
			const m = /^\/([a-z0-9/-]+)$/u.exec(pathname);
			const file = m ? slugFile(m, join(dir, "pages"), "html") : "";
			return m && (await Bun.file(file).exists())
				? new Response(Bun.file(file), {
						headers: { "content-type": "text/html" },
					})
				: notFound();
		},
	});
	return {
		url: `http://127.0.0.1:${srv.port}`,
		hits,
		stop: stopper(srv),
	};
};
