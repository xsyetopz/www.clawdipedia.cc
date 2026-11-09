// search, list, and read for the remote sources (platform, code, claude-resources). The result shapes are the same for all three.
import { sourceData, sourceLine } from "../fetcher.ts";
import { present } from "../text.ts";
import { pageResult } from "./page.ts";
import { DEFAULT_PAGE_CHARS, fail, ok, type Result } from "./shared.ts";
import type { RemoteSource } from "./sources.ts";

export const searchRemote = async (
	s: RemoteSource,
	{
		query,
		limit = 8,
		section,
	}: { query: string; limit?: number; section?: string | undefined },
): Promise<Result> => {
	const ix = await s.index();
	const hits = ix.search(query, limit, section).map((h) => ({
		route: h.entry.path,
		title: h.entry.title,
		url: h.entry.url,
		section: h.entry.group,
		score: Math.round(h.score * 100) / 100,
		snippet: h.snippet,
	}));
	const line = sourceLine(ix.source);
	const src = { ...sourceData(ix.source), line };
	if (hits.length === 0) {
		return ok(
			`No ${s.name} pages match "${query}"${present(section) ? ` in ${s.groupWord} "${section}"` : ""}. Try fewer or different keywords, drop the ${s.groupWord} filter, or browse the page list.\n\n${line}`,
			{ query, hits, source: src },
			ix.source,
		);
	}
	const md = hits
		.map(
			(h, i) =>
				`${i + 1}. **${h.title}** (route \`${h.route}\`)\n   ${h.url}${present(h.snippet) ? `\n   ${h.snippet}` : ""}`,
		)
		.join("\n");
	return ok(
		`${hits.length} hit(s) for "${query}":\n\n${md}\n\n${line}`,
		{ query, hits, source: src },
		ix.source,
		true,
	);
};

const countGroups = (entries: readonly { group: string }[]) => {
	const groups = new Map<string, number>();
	for (const e of entries) {
		groups.set(e.group, (groups.get(e.group) ?? 0) + 1);
	}
	return groups;
};

export const listRemote = async (
	s: RemoteSource,
	{ section }: { section?: string | undefined },
): Promise<Result> => {
	const { entries, source } = await s.index();
	const line = sourceLine(source);
	const src = sourceData(source);
	const groups = countGroups(entries);
	if (!present(section)) {
		const rows = [...groups].map(
			([g, n]) => `- ${present(g) ? g : "(none)"}: ${n}`,
		);
		return ok(
			`${entries.length} page(s) in ${groups.size} ${s.groupWord}(s). Pass a ${s.groupWord} to list its pages:\n\n${rows.join("\n")}\n\n${line}`,
			{
				groups: [...groups].map(([group, count]) => ({ group, count })),
				source: src,
			},
			source,
			true,
		);
	}
	const want = section.trim().toLowerCase();
	const list = entries.filter((e) => e.group.toLowerCase() === want);
	if (list.length === 0) {
		return fail(
			`No ${s.groupWord} "${section}". ${s.groupWord[0]?.toUpperCase()}${s.groupWord.slice(1)}s: ${[...groups.keys()].join(", ")}`,
		);
	}
	const rows = list.map(
		(e) =>
			`- \`${e.path}\`: ${e.title}${present(e.description) ? `. ${e.description}` : ""}`,
	);
	return ok(
		`${list.length} page(s) in "${list[0]?.group}":\n\n${rows.join("\n")}\n\n${line}`,
		{
			pages: list.map(({ path, title, group, description }) => ({
				route: path,
				title,
				section: group,
				description,
			})),
			source: src,
		},
		source,
		true,
	);
};

const nearOf = async (s: RemoteSource, path: string): Promise<string> => {
	try {
		const ix = await s.index();
		return s.near(path, ix.entries);
	} catch {
		return "";
	}
};

export const readRemote = async (
	s: RemoteSource,
	{
		route: input,
		heading,
		offset = 0,
		maxChars = DEFAULT_PAGE_CHARS,
	}: {
		route: string;
		heading?: string | undefined;
		offset?: number;
		maxChars?: number;
	},
): Promise<Result> => {
	const path = s.normalize(input);
	if (path === undefined || path === "") {
		return fail(`Invalid path "${input}". ${s.invalidHint()}`);
	}
	const r = await s.readPage(path);
	if (r.status === "notfound") {
		const near = await nearOf(s, path);
		return fail(
			`No ${s.name} page "${path}" on ${r.origin}; any cached copy was removed.${near}`,
		);
	}
	if (r.status === "error") {
		return fail(r.message);
	}
	const known = s.known()?.find((e) => e.path === path)?.title;
	const own = s.titleOf(r.body);
	const title = (s.pageTitleFirst ? (own ?? known) : (known ?? own)) ?? path;
	const url = s.pageUrl(path);
	return pageResult(
		{ route: path, title, url },
		s.markdown(r.body, url),
		heading,
		offset,
		maxChars,
		r.source,
	);
};
