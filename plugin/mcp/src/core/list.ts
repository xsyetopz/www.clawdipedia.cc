// list_pages: the pages of the docs site or the groups of a remote source (platform, code, claude-resources).

import { sourceData, sourceLine } from "../fetcher.ts";
import type { Entry } from "../manifest.ts";
import { matchesSection } from "../search.ts";
import { present } from "../text.ts";
import { listRemote } from "./remote.ts";
import {
	content,
	type DocSourceName,
	fail,
	guarded,
	heading,
	ok,
	type Result,
} from "./shared.ts";
import { remoteOf } from "./sources.ts";

export interface ListArgs {
	source?: DocSourceName;
	/** A top-level section of the docs, or a group of a remote source. */
	section?: string | undefined;
}

export const list = (args: ListArgs = {}): Promise<Result> =>
	guarded(async () => {
		const remote = remoteOf(args.source);
		if (remote) {
			return listRemote(remote, args);
		}
		const { section } = args;
		const { entries: all, source } = await content.manifest();
		const pages: readonly Entry[] = present(section)
			? all.filter((e) => matchesSection(e, section))
			: all;
		if (pages.length === 0) {
			const secs = [...new Set(all.map((e) => e.section))].join(", ");
			return fail(`No pages in section "${section}". Sections: ${secs}`);
		}
		const lines: string[] = [];
		let current = "";
		for (const e of pages) {
			if (e.section !== current) {
				current = e.section;
				lines.push(`\n## ${current}`);
			}
			lines.push(
				present(section)
					? `- \`${e.route}\`: ${e.title}. ${e.description}`
					: `- \`${e.route}\`: ${e.title}`,
			);
		}
		const version = await content.claudeCode();
		return ok(
			`${await heading()}${pages.length} page(s):${lines.join("\n")}\n\n${sourceLine(source)}`,
			{
				...(present(version) ? { claudeCode: version } : {}),
				pages: pages.map((e) =>
					present(section)
						? {
								route: e.route,
								title: e.title,
								section: e.section,
								description: e.description,
							}
						: { route: e.route, title: e.title, section: e.section },
				),
				source: sourceData(source),
			},
			source,
			true,
		);
	});
