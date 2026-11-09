// read_page: one chunk of a docs page or a page of a remote source (platform, code, claude-resources).

import { type Entry, normalizeRoute } from "../manifest.ts";
import { tokenize } from "../search.ts";
import { pageResult } from "./page.ts";
import { readRemote } from "./remote.ts";
import {
	content,
	DEFAULT_PAGE_CHARS,
	type DocSourceName,
	fail,
	guarded,
	type Result,
} from "./shared.ts";
import { remoteOf } from "./sources.ts";

export interface ReadArgs {
	/** A docs route, or a path on a remote source. */
	route: string;
	source?: DocSourceName;
	/** Return only the H2 section with this heading. */
	heading?: string | undefined;
	offset?: number;
	maxChars?: number;
}

const nearList = (route: string, entries: readonly Entry[]): string => {
	const want = new Set(tokenize(route.replaceAll(/[/_-]+/gu, " ")));
	const near = entries
		.map((e) => ({
			e,
			n: tokenize(`${e.route.replaceAll(/[/_-]+/gu, " ")} ${e.title}`).filter(
				(t) => want.has(t),
			).length,
		}))
		.filter((x) => x.n > 0 && x.e.route !== route)
		.toSorted((a, b) => b.n - a.n)
		.slice(0, 5)
		.map((x) => `  - ${x.e.route}`)
		.join("\n");
	return near === "" ? "" : `\nClosest matches:\n${near}`;
};

export const read = (args: ReadArgs): Promise<Result> =>
	guarded(async () => {
		const remote = remoteOf(args.source);
		if (remote) {
			return readRemote(remote, args);
		}
		const { heading, offset = 0, maxChars = DEFAULT_PAGE_CHARS } = args;
		const entry = await content.entryFor(args.route);
		if (!entry) {
			const { entries } = await content.manifest();
			return fail(
				`No page with route "${normalizeRoute(args.route)}". Routes look like "configure/status-line" (list the pages to see them).${nearList(normalizeRoute(args.route), entries)}`,
			);
		}
		const r = await content.readPage(entry);
		if (r.status === "notfound") {
			const { entries } = await content.manifest();
			return fail(
				`Page "${entry.route}" is listed but no longer exists on ${r.origin}; any cached copy was removed.${nearList(entry.route, entries)}`,
			);
		}
		if (r.status === "error") {
			return fail(r.message);
		}
		return pageResult(
			{ route: entry.route, title: entry.title, url: entry.url },
			r.body,
			heading,
			offset,
			maxChars,
			r.source,
		);
	});
