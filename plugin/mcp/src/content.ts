// Our docs site as a model: manifest, pages, schemas. All I/O goes through fetcher.ts (cache and network).
import { ContentError } from "./content-error.ts";
import { getResource, MB, type Resource, type Source, ttl } from "./fetcher.ts";
import {
	type Entry,
	normalizeRoute,
	parseManifest,
	parseSearchIndex,
	siteBase,
} from "./manifest.ts";
import { SEARCH_INDEX_FILE, SEARCH_INDEX_MAX } from "./search.ts";
import { isRecord, present } from "./text.ts";

const MANIFEST_TTL_MS = 10 * 60 * 1000;
const PAGE_TTL_MS = 60 * 60 * 1000;
export const INDEX_TTL_MS = 60 * 60 * 1000;
const MANIFEST_MAX = MB;
const PAGE_MAX = 2 * MB;
const SCHEMA_MAX = MB;

const STALE_OFFLINE_MEM_TTL_MS = 60 * 1000;

export const SCHEMA_NAMES = [
	"claude-code-settings",
	"claude-code-managed-settings",
	"claude-code-plugin-manifest",
	"claude-code-plugin-hooks",
	"claude-code-marketplace",
	"claude-code-keybindings",
	"claude-code-mcp",
	"claude-code-hook-output",
	"claude-code-tools",
	"claude-code-control-protocol",
	"claude-code-stream-json",
	"claude-code-agents-json",
	"claude-code-status-line",
	"claude-code-transcript",
	"claude-code-otel",
	"claude-code-frontmatter",
	"claude-code-claude-json",
] as const;

/** The Mod API type file the program ships; get_schema reads it with the names in TYPE_NAMES. */
export const TYPE_FILE = "claude-code.d.ts";
export const TYPE_NAMES = ["types", "claude-code", TYPE_FILE] as const;

export interface PagesLoad {
	texts: Map<string, string>;
	total: number;
	/** Pages that came from the cache because the network failed. */
	offline: number;
	/** Pages served from the cache (fresh, revalidated, or offline). */
	fromCache: number;
	oldest: string | undefined;
}

const asCached = (source: Source): Source => ({
	...source,
	state: source.state === "live" ? "cached" : source.state,
});

export class Content {
	private mem:
		| {
				entries: Entry[];
				byRoute: Map<string, Entry>;
				source: Source;
				at: number;
		  }
		| undefined;
	private ver: string | undefined;
	private verRetryAt = 0;

	/** Bumped when the page list changes, so derived indexes can rebuild. */
	version = 0;

	/** The page list. Cheap inside the TTL. Throws ContentError if the site is unreachable and nothing is cached. */
	async manifest(): Promise<{ entries: readonly Entry[]; source: Source }> {
		const m = this.mem;
		// A stale-offline copy is retried soon, so the page list recovers when the network returns.
		const memTtl =
			m?.source.state === "stale-offline"
				? STALE_OFFLINE_MEM_TTL_MS
				: MANIFEST_TTL_MS;
		if (m && Date.now() - m.at < ttl(memTtl)) {
			return { entries: m.entries, source: asCached(m.source) };
		}
		const r = await getResource({
			url: `${siteBase()}/llms-manifest.json`,
			rel: "site/llms-manifest.json",
			ttlMs: ttl(MANIFEST_TTL_MS),
			maxBytes: MANIFEST_MAX,
			validate: (b) => parseManifest(b).length > 0,
		});
		if (r.status !== "ok") {
			if (m) {
				return {
					entries: m.entries,
					source: { ...m.source, state: "stale-offline" },
				};
			}
			throw new ContentError(
				r.status === "error"
					? r.message
					: `the page list was not found on ${r.origin}`,
			);
		}
		const entries = parseManifest(r.body);
		const same =
			m !== undefined &&
			m.entries.length === entries.length &&
			m.entries.every((e, i) => e.route === entries[i]?.route);
		if (!same) {
			this.version++;
		}
		this.mem = {
			entries,
			byRoute: new Map(entries.map((e) => [e.route, e])),
			source: r.source,
			at: Date.now(),
		};
		return { entries, source: r.source };
	}

	async entryFor(input: string): Promise<Entry | undefined> {
		await this.manifest();
		return this.mem?.byRoute.get(normalizeRoute(input));
	}

	/** llms-search-index.json: every page in one file. A 404 means the site has none, and the caller reads pages instead. */
	searchIndex(): Promise<Resource> {
		return getResource({
			url: `${siteBase()}/${SEARCH_INDEX_FILE}`,
			rel: `site/${SEARCH_INDEX_FILE}`,
			deleteOn404: true,
			ttlMs: ttl(INDEX_TTL_MS),
			maxBytes: SEARCH_INDEX_MAX,
			validate: (b) => parseSearchIndex(b) !== undefined,
		});
	}

	/** Page text (with front matter) for an entry from the manifest. */
	readPage(e: Entry): Promise<Resource> {
		return getResource({
			url: `${siteBase()}/${e.route}.md`,
			rel: `site/pages/${e.route}.md`,
			deleteOn404: true,
			ttlMs: ttl(PAGE_TTL_MS),
			maxBytes: PAGE_MAX,
		});
	}

	/** Reads many pages (6 requests at once, cache first). Failed pages are left out. */
	async loadPages(entries: readonly Entry[]): Promise<PagesLoad> {
		const out: PagesLoad = {
			texts: new Map(),
			total: entries.length,
			offline: 0,
			fromCache: 0,
			oldest: undefined,
		};
		await Promise.all(
			entries.map(async (e) => {
				const r = await this.readPage(e);
				if (r.status !== "ok") {
					return;
				}
				out.texts.set(e.route, r.body);
				if (r.source.state !== "live") {
					out.fromCache++;
				}
				if (r.source.state === "stale-offline") {
					out.offline++;
				}
				if (!present(out.oldest) || r.source.fetchedAt < out.oldest) {
					out.oldest = r.source.fetchedAt;
				}
			}),
		);
		return out;
	}

	/** Short name or full name to the schema, parsed. "unknown" for names outside SCHEMA_NAMES. */
	async schema(
		name: string,
	): Promise<
		| "unknown"
		| { status: "ok"; schema: Record<string, unknown>; source: Source }
		| Exclude<Resource, { status: "ok" }>
	> {
		const n = name.replace(/\.json$/u, "");
		const full = n.startsWith("claude-code-") ? n : `claude-code-${n}`;
		if (!SCHEMA_NAMES.some((s) => s === full)) {
			return "unknown";
		}
		const r = await getResource({
			url: `${siteBase()}/schemas/${full}.json`,
			rel: `site/schemas/${full}.json`,
			deleteOn404: true,
			ttlMs: ttl(PAGE_TTL_MS),
			maxBytes: SCHEMA_MAX,
			validate: (b) => {
				try {
					return isRecord(JSON.parse(b));
				} catch {
					return false;
				}
			},
		});
		if (r.status !== "ok") {
			return r;
		}
		const parsed: unknown = JSON.parse(r.body);
		const schema = isRecord(parsed) ? parsed : {};
		// The schema title ends with "(Claude Code 2.1.305)": a second source for the version.
		this.ver ??= /\(Claude Code (\d+\.\d+\.\d+)\)/u.exec(
			String(schema["title"]),
		)?.[1];
		return {
			status: "ok",
			schema,
			source: r.source,
		};
	}

	/** The Mod API type file, schemas/claude-code.d.ts, as text. */
	typeFile(): Promise<Resource> {
		return getResource({
			url: `${siteBase()}/schemas/${TYPE_FILE}`,
			rel: `site/schemas/${TYPE_FILE}`,
			deleteOn404: true,
			ttlMs: ttl(PAGE_TTL_MS),
			maxBytes: SCHEMA_MAX,
			validate: (b) => b.includes("declare module"),
		});
	}

	/** "2.1.305" from llms.txt (line 3). Best effort: undefined when it cannot be read. Cached for the process. */
	async claudeCode(): Promise<string | undefined> {
		if (present(this.ver)) {
			return this.ver;
		}
		if (Date.now() < this.verRetryAt) {
			return undefined;
		}
		const r = await getResource({
			url: `${siteBase()}/llms.txt`,
			rel: "site/llms.txt",
			ttlMs: ttl(MANIFEST_TTL_MS),
			maxBytes: PAGE_MAX,
		});
		if (r.status !== "ok") {
			this.verRetryAt = Date.now() + ttl(MANIFEST_TTL_MS);
			return undefined;
		}
		const head = r.body.split("\n").slice(0, 6).join("\n");
		this.ver = /Claude Code (\d+\.\d+\.\d+)/u.exec(head)?.[1];
		return this.ver;
	}
}
