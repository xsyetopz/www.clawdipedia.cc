// claude.com/resources as a model: the sitemap as the page list and the HTML pages. All I/O goes through fetcher.ts.
// The site has no llms.txt and no markdown variant, so titles come from slugs and pages are converted by html.ts.
// claude.com/sitemap.xml lists the whole site and its locale copies, so only paths whose first segment is "resources" are kept.
import { parseXml, type XmlDocument, XmlElement } from "@rgrove/parse-xml";

import { ContentError } from "./content-error.ts";
import {
	baseUrl,
	getResource,
	MB,
	type Resource,
	type Source,
	ttl,
} from "./fetcher.ts";
import type { Entry } from "./manifest.ts";
import { searchByPath, SearchIndex, tokenize } from "./search.ts";
import { present } from "./text.ts";

export const CLAUDE_RESOURCES = "https://claude.com";
// Override for mirrors and tests: CLAUDE_RESOURCES_BASE_URL (https; http only for localhost and 127.0.0.1).
export const claudeResourcesBase = (): string =>
	baseUrl("CLAUDE_RESOURCES_BASE_URL", CLAUDE_RESOURCES);

const INDEX_TTL_MS = 60 * 60 * 1000;
const PAGE_TTL_MS = 6 * 60 * 60 * 1000;
const SITEMAP_MAX = 2 * MB;
const PAGE_MAX = 4 * MB;

/** The first path segment of every page in scope. The route "resources" is the hub page. */
const SCOPE = "resources";

/** A page from the sitemap. `path` is the part after the host, e.g. "resources/articles/claude-duet". */
export interface ClaudeResourcesEntry {
	path: string;
	title: string;
	section: string;
	lastmod: string;
	url: string;
}

const PATH_RE = /^[a-z0-9][a-z0-9/_.-]*$/u;

/**
 * Normalizes input to a page path, or undefined when the rules reject it.
 * Accepts "resources/articles/x", "/resources/articles/x", and the full URL on the configured host.
 * Accepts a path only when its first segment is "resources", which drops the locale copies
 * ("/ja/resources/...") and the other sections of the site with no list of locale codes.
 * Rejects "..", dot-leading segments, other hosts, and anything outside [a-z0-9/_.-].
 */
export const normalizeClaudeResourcesPath = (
	input: string,
): string | undefined => {
	let r = input.trim();
	if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(r) || r.startsWith("//")) {
		const hosts = new Set([claudeResourcesBase(), CLAUDE_RESOURCES]);
		const o = [...hosts].find((h) => r === h || r.startsWith(`${h}/`));
		if (o === undefined) {
			return undefined;
		}
		r = r.slice(o.length);
	}
	r = r.replace(/[?#].*$/u, "").replaceAll(/^\/+|\/+$/gu, "");
	if (!PATH_RE.test(r) || r.includes("//") || /(^|\/)\./u.test(r)) {
		return undefined;
	}
	return r.split("/")[0] === SCOPE ? r : undefined;
};

/** "resources/articles/claude-duet" -> "Claude Duet". */
const titleOfSlug = (path: string): string => {
	const last = path.split("/").pop() ?? path;
	return last
		.split(/[-_.]+/u)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");
};

// Prefixed names ("ns:loc") match too.
const localName = (name: string): string => name.slice(name.indexOf(":") + 1);

const childText = (el: XmlElement, name: string): string | undefined => {
	const child = el.children.find(
		(c): c is XmlElement =>
			c instanceof XmlElement && localName(c.name) === name,
	);
	return child?.text.trim();
};

const urlElements = (node: XmlElement): XmlElement[] =>
	node.children.flatMap((c) => {
		if (!(c instanceof XmlElement)) {
			return [];
		}
		return localName(c.name) === "url" ? [c] : urlElements(c);
	});

/** Parses a flat <urlset>: every <url> with its <loc> and <lastmod>. A repeated path keeps its first entry. Malformed XML gives []. */
export const parseSitemap = (
	xml: string,
	base = claudeResourcesBase(),
): ClaudeResourcesEntry[] => {
	let doc: XmlDocument;
	try {
		doc = parseXml(xml);
	} catch {
		return [];
	}
	const out: ClaudeResourcesEntry[] = [];
	const seen = new Set<string>();
	for (const url of doc.root ? urlElements(doc.root) : []) {
		const loc = childText(url, "loc");
		const path = present(loc) ? normalizeClaudeResourcesPath(loc) : undefined;
		if (path === undefined || seen.has(path)) {
			continue;
		}
		seen.add(path);
		out.push({
			path,
			title: titleOfSlug(path),
			// The first segment is always "resources", so the second names the section. The hub "resources" is its own.
			section: path.split("/")[1] ?? SCOPE,
			lastmod: childText(url, "lastmod") ?? "",
			url: `${base}/${path}`,
		});
	}
	return out;
};

export interface ClaudeResourcesHit {
	entry: ClaudeResourcesEntry;
	score: number;
	snippet: string;
}
export interface ClaudeResourcesIndex {
	entries: readonly ClaudeResourcesEntry[];
	source: Source;
	search: (
		query: string,
		limit: number,
		section?: string,
	) => ClaudeResourcesHit[];
}

const asEntry = (p: ClaudeResourcesEntry): Entry => ({
	route: p.path,
	title: p.title,
	// The sitemap has no descriptions: the slug words of the whole path are what a query can match.
	description: p.path.replaceAll(/[/_.-]+/gu, " "),
	section: p.section,
	md: "",
	url: p.url,
});

const snippetOf = (e: ClaudeResourcesEntry): string =>
	e.lastmod === ""
		? e.section
		: `${e.section}, updated ${e.lastmod.slice(0, 10)}`;

export class ClaudeResources {
	private memo:
		| { body: string; entries: ClaudeResourcesEntry[]; idx: SearchIndex }
		| undefined;

	/** The page list from the sitemap. Throws ContentError when unreachable and nothing is cached. */
	async index(): Promise<ClaudeResourcesIndex> {
		const r = await getResource({
			url: `${claudeResourcesBase()}/sitemap.xml`,
			rel: "claude-resources/sitemap.xml",
			ttlMs: ttl(INDEX_TTL_MS),
			maxBytes: SITEMAP_MAX,
			validate: (b) => parseSitemap(b).length > 0,
		});
		if (r.status !== "ok") {
			throw new ContentError(
				r.status === "error"
					? `claude-resources site is offline and not cached yet: could not reach ${r.origin}`
					: `sitemap.xml was not found on ${r.origin}`,
			);
		}
		if (this.memo?.body !== r.body) {
			const entries = parseSitemap(r.body);
			const asE = entries.map((e) => asEntry(e));
			const idx = new SearchIndex({
				entries: () => asE,
				text: () => "",
				extra: (e) => e.section,
			});
			this.memo = { body: r.body, entries, idx };
		}
		const { entries, idx } = this.memo;
		return {
			entries,
			source: r.source,
			search: searchByPath(idx, entries, snippetOf),
		};
	}

	/** Entries from the last sitemap read, without any request. */
	known(): readonly ClaudeResourcesEntry[] | undefined {
		return this.memo?.entries;
	}

	/** Page HTML for a normalized path. */
	readPage(path: string): Promise<Resource> {
		return getResource({
			// No trailing slash: the host answers 308 for "/resources/".
			url: `${claudeResourcesBase()}/${path}`,
			rel: `claude-resources/pages/${path}.html`,
			deleteOn404: true,
			ttlMs: ttl(PAGE_TTL_MS),
			maxBytes: PAGE_MAX,
		});
	}
}

const words = (s: string): string[] => tokenize(s.replaceAll(/[/_.-]+/gu, " "));

/** Entries that share the most words with a path, for "not found" answers. */
export const nearClaudeResources = (
	path: string,
	entries: readonly Pick<ClaudeResourcesEntry, "path" | "title">[],
): string => {
	const want = new Set(words(path));
	const near = entries
		.map((e) => ({
			e,
			n: words(`${e.path} ${e.title}`).filter((t) => want.has(t)).length,
		}))
		.filter((x) => x.n > 0 && x.e.path !== path)
		.toSorted((a, b) => b.n - a.n)
		.slice(0, 5)
		.map((x) => `  - ${x.e.path}`)
		.join("\n");
	return near ? `\nClosest matches:\n${near}` : "";
};
