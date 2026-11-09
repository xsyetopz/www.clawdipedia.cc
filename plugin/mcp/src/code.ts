// code.claude.com docs as a model: the /docs/llms.txt index and the English markdown pages. All I/O goes through fetcher.ts.
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

export const CODE = "https://code.claude.com";
// Override for mirrors and tests: CODE_DOCS_BASE_URL (https; http only for localhost and 127.0.0.1).
export const codeBase = (): string => baseUrl("CODE_DOCS_BASE_URL", CODE);

const INDEX_TTL_MS = 10 * 60 * 1000;
const PAGE_TTL_MS = 6 * 60 * 60 * 1000;
const FILE_MAX = 2 * MB;

/** A page from llms.txt. `path` is the part after /docs/en/, e.g. "plugins/create". */
export interface CodeEntry {
	path: string;
	title: string;
	description: string;
	group: string;
	url: string;
}

const PATH_RE = /^[a-z0-9][a-z0-9/_-]*$/u;

/**
 * Normalizes input to a path under /docs/en/, or undefined when the rules reject it.
 * Accepts "a/b", "/docs/en/a/b", "a/b.md", and the full URL on the configured code host.
 * Rejects "..", other languages (docs/de/...), other hosts, and anything outside [a-z0-9/_-].
 */
export const normalizeCodePath = (input: string): string | undefined => {
	let r = input.trim();
	if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(r) || r.startsWith("//")) {
		const hosts = new Set([codeBase(), CODE]);
		const o = [...hosts].find((h) => r === h || r.startsWith(`${h}/`));
		if (o === undefined) {
			return undefined;
		}
		r = r.slice(o.length);
	}
	r = r.replace(/[?#].*$/u, "").replace(/\.md$/u, "");
	r = r.replaceAll(/^\/+|\/+$/gu, "");
	if (r === "docs" || r.startsWith("docs/")) {
		if (!r.startsWith("docs/en/")) {
			return undefined;
		}
		r = r.slice("docs/en/".length);
	}
	if (!PATH_RE.test(r) || r.includes("//")) {
		return undefined;
	}
	return r;
};

/**
 * Parses docs/llms.txt: `## Group` headings (deeper headings only nest and do not change the group),
 * `- [Title](url.md): description` lines. A path that repeats keeps its first entry.
 * Links that are not `<base>/docs/en/<slug>.md` (the `_llms/<code>.txt` indexes) are skipped.
 */
export const parseCodeLlms = (text: string, base = codeBase()): CodeEntry[] => {
	// Links on the real host and on the configured base (a mirror) both count; pages are always fetched from the base.
	const hosts = [...new Set([base, CODE])]
		.map((h) => h.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`))
		.join("|");
	const line = new RegExp(
		`^- \\[(.+?)\\]\\(((?:${hosts})/docs/en/[^)\\s]+?)\\.md\\)(?:: (.*))?$`,
		"u",
	);
	const out: CodeEntry[] = [];
	const seen = new Set<string>();
	let group = "";
	for (const raw of text.split(/\r?\n/u)) {
		const h = /^(#{2,6})\s+(.*?)\s*$/u.exec(raw);
		if (h) {
			if (h[1] === "##") {
				group = h[2] ?? "";
			}
			continue;
		}
		const m = line.exec(raw);
		if (!m) {
			continue;
		}
		const path = normalizeCodePath(`${m[2]}.md`);
		if (path === undefined || seen.has(path)) {
			continue;
		}
		seen.add(path);
		out.push({
			path,
			title: m[1] ?? path,
			description: m[3] ?? "",
			group,
			url: `${base}/docs/en/${path}`,
		});
	}
	return out;
};

export interface CodeHit {
	entry: CodeEntry;
	score: number;
	snippet: string;
}
export interface CodeIndex {
	entries: readonly CodeEntry[];
	source: Source;
	search: (query: string, limit: number, group?: string) => CodeHit[];
}

const asEntry = (p: CodeEntry): Entry => ({
	route: p.path,
	title: p.title,
	// URL path tokens count with the description weight.
	description: `${p.description} ${p.path.replaceAll(/[/_-]+/gu, " ")}`,
	section: p.group,
	md: "",
	url: p.url,
});

export class Code {
	private memo:
		{ body: string; entries: CodeEntry[]; idx: SearchIndex } | undefined;

	/** The page list from llms.txt. Throws ContentError when unreachable and nothing is cached. */
	async index(): Promise<CodeIndex> {
		const r = await getResource({
			url: `${codeBase()}/docs/llms.txt`,
			rel: "code/llms.txt",
			ttlMs: ttl(INDEX_TTL_MS),
			maxBytes: FILE_MAX,
			validate: (b) => parseCodeLlms(b).length > 0,
		});
		if (r.status !== "ok") {
			throw new ContentError(
				r.status === "error"
					? `code docs are offline and not cached yet: could not reach ${r.origin}`
					: `llms.txt was not found on ${r.origin}`,
			);
		}
		if (this.memo?.body !== r.body) {
			const entries = parseCodeLlms(r.body);
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
			search: searchByPath(idx, entries, (e) => e.description || e.title),
		};
	}

	/** Entries from the last llms.txt read, without any request. */
	known(): readonly CodeEntry[] | undefined {
		return this.memo?.entries;
	}

	/** Page markdown (no front matter) for a normalized path. The `.md` suffix is required: the bare path is HTML. */
	readPage(path: string): Promise<Resource> {
		return getResource({
			url: `${codeBase()}/docs/en/${path}.md`,
			rel: `code/pages/${path}.md`,
			deleteOn404: true,
			ttlMs: ttl(PAGE_TTL_MS),
			maxBytes: FILE_MAX,
		});
	}
}

/** Entries that share the most words with a path, for "not found" answers. */
export const nearCode = (
	path: string,
	entries: readonly CodeEntry[],
): string => {
	const want = new Set(tokenize(path.replaceAll(/[/_-]+/gu, " ")));
	const near = entries
		.map((e) => ({
			e,
			n: tokenize(`${e.path.replaceAll(/[/_-]+/gu, " ")} ${e.title}`).filter(
				(t) => want.has(t),
			).length,
		}))
		.filter((x) => x.n > 0 && x.e.path !== path)
		.toSorted((a, b) => b.n - a.n)
		.slice(0, 5)
		.map((x) => `  - ${x.e.path}`)
		.join("\n");
	return near ? `\nClosest matches:\n${near}` : "";
};
