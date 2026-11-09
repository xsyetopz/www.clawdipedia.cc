// search_docs: BM25 search of the docs site or a remote source (platform, code, claude-resources).

import { sourceData } from "../fetcher.ts";
import { present } from "../text.ts";
import { searchRemote } from "./remote.ts";
import {
	content,
	type DocSourceName,
	guarded,
	heading,
	ok,
	type Result,
} from "./shared.ts";
import { indexLine, indexSource, searchIndex } from "./site-index.ts";
import { remoteOf } from "./sources.ts";

export interface SearchArgs {
	query: string;
	source?: DocSourceName;
	limit?: number;
	/** A top-level section of the docs, or a group of a remote source. */
	section?: string | undefined;
}

export const search = (args: SearchArgs): Promise<Result> =>
	guarded(async () => {
		const remote = remoteOf(args.source);
		if (remote) {
			return searchRemote(remote, args);
		}
		const { query, limit = 8, section } = args;
		const b = await searchIndex();
		const hits = b.idx.search(query, limit, section).map((h) => ({
			route: h.entry.route,
			title: h.entry.title,
			url: h.entry.url,
			section: h.entry.section,
			score: Math.round(h.score * 100) / 100,
			snippet: h.snippet,
		}));
		const head = await heading();
		const line = indexLine(b);
		const src = indexSource(b);
		const version = await content.claudeCode();
		const data = {
			...(present(version) ? { claudeCode: version } : {}),
			query,
			hits,
			source: { ...sourceData(src), line },
		};
		if (hits.length === 0) {
			return ok(
				`${head}No pages match "${query}"${present(section) ? ` in section "${section}"` : ""}. Try fewer or different keywords, drop the section filter, or browse the page list.\n\n${line}`,
				data,
				src,
			);
		}
		const md = hits
			.map(
				(h, i) =>
					`${i + 1}. **${h.title}** (route \`${h.route}\`)\n   ${h.url}\n   ${h.snippet}`,
			)
			.join("\n");
		return ok(
			`${head}${hits.length} hit(s) for "${query}":\n\n${md}\n\n${line}`,
			data,
			src,
			true,
		);
	});
