// The BM25 index of the docs site: built on first use, kept in this module.
import { INDEX_TTL_MS, type PagesLoad } from "../content.ts";
import { type Resource, type Source, sourceLine, ttl } from "../fetcher.ts";
import { type Entry, parseSearchIndex } from "../manifest.ts";
import { SearchIndex } from "../search.ts";
import { content } from "./shared.ts";

const PARTIAL_INDEX_TTL_MS = 60 * 1000;

export interface Built {
	builtFor: number;
	at: number;
	idx: SearchIndex;
	source: Source;
	pages: number;
	/** Hash of llms-search-index.json. Set only when the index came from that file. */
	hash?: string;
	/** Set only when the index was built from pages. */
	load?: PagesLoad;
	/** Why pages were read instead of llms-search-index.json. */
	fallback?: string;
}
let index: Built | undefined;
let building: Promise<Built> | undefined;

type OkResource = Extract<Resource, { status: "ok" }>;
type ParsedIndex = NonNullable<ReturnType<typeof parseSearchIndex>>;

const fromIndexFile = (
	builtFor: number,
	entries: readonly Entry[],
	got: OkResource,
	parsed: ParsedIndex,
): Built => {
	const byRoute = new Map(parsed.pages.map((p) => [p.route, p]));
	const have = entries.filter((e) => byRoute.has(e.route));
	const idx = new SearchIndex({
		entries: () => have,
		text: (e) => byRoute.get(e.route)?.body,
		extra: (e) => byRoute.get(e.route)?.extra,
	});
	return {
		builtFor,
		at: Date.now(),
		idx,
		source: got.source,
		pages: have.length,
		hash: parsed.hash,
	};
};

const fromPages = async (
	builtFor: number,
	entries: readonly Entry[],
	source: Source,
	got: Resource,
): Promise<Built> => {
	const load = await content.loadPages(entries);
	const idx = new SearchIndex({
		entries: () => entries,
		text: (e) => load.texts.get(e.route),
	});
	return {
		builtFor,
		at: Date.now(),
		idx,
		source,
		pages: load.texts.size,
		load,
		fallback:
			got.status === "notfound"
				? "no llms-search-index.json on the site"
				: "llms-search-index.json not available",
	};
};

const build = async (): Promise<Built> => {
	const builtFor = content.version;
	const { entries, source } = await content.manifest();
	const got = await content.searchIndex();
	const parsed = got.status === "ok" ? parseSearchIndex(got.body) : undefined;
	if (got.status === "ok" && parsed) {
		// The same hash is the same pages: keep the built index.
		if (index?.hash === parsed.hash && index.builtFor === builtFor) {
			index = { ...index, at: Date.now(), source: got.source };
			return index;
		}
		index = fromIndexFile(builtFor, entries, got, parsed);
		return index;
	}
	index = await fromPages(builtFor, entries, source, got);
	return index;
};

const runBuild = async (): Promise<Built> => {
	try {
		return await build();
	} finally {
		building = undefined;
	}
};

const buildIndex = (): Promise<Built> => {
	building ??= runBuild();
	return building;
};

const refreshInBackground = async (): Promise<void> => {
	try {
		await buildIndex();
	} catch {
		// The old index stays in use.
	}
};

/** The BM25 index. Built on first use from one file (or from every page when the site has no index file). An old index is refreshed in the background. */
export const searchIndex = async (): Promise<Built> => {
	await content.manifest();
	if (!index || index.builtFor !== content.version) {
		return buildIndex();
	}
	// A partial index (offline, some pages missing) is retried soon.
	const partial = index.load !== undefined && index.pages < index.load.total;
	if (
		Date.now() - index.at >
		ttl(partial ? PARTIAL_INDEX_TTL_MS : INDEX_TTL_MS)
	) {
		void refreshInBackground();
	}
	return index;
};

const pagesState = (load: PagesLoad, builtAt: number): Source["state"] => {
	if (load.offline > 0) {
		return "stale-offline";
	}
	return load.fromCache < load.texts.size && Date.now() - builtAt < 60_000
		? "live"
		: "cached";
};

/** Source of a search: the state of the index file, or the worst state of the pages it used. */
export const indexSource = (b: Built): Source => {
	const { load } = b;
	if (!load) {
		return {
			...b.source,
			state:
				b.source.state === "live" && Date.now() - b.at >= 60_000
					? "cached"
					: b.source.state,
		};
	}
	return {
		origin: b.source.origin,
		state: pagesState(load, b.at),
		fetchedAt: load.oldest ?? b.source.fetchedAt,
		revalidated: false,
	};
};

export const indexLine = (b: Built): string => {
	const { load } = b;
	if (!load) {
		return `${sourceLine(indexSource(b))}, search index of ${b.pages} pages`;
	}
	const cover =
		b.pages < load.total ? ` (${b.pages} of ${load.total} pages)` : "";
	return `Source: ${b.source.origin}, index built from ${b.pages} pages${cover}, ${load.fromCache} from cache${load.offline > 0 ? " (offline)" : ""}; ${b.fallback}`;
};
