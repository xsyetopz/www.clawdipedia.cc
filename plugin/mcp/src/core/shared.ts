// Types and helpers shared by the core/*.ts files: the result shape, the singletons, and the guard.

import { ClaudeResources } from "../claude-resources.ts";
import { Code } from "../code.ts";
import { ContentError } from "../content-error.ts";
import { Content } from "../content.ts";
import type { Source } from "../fetcher.ts";
import { Platform } from "../platform.ts";
import { present } from "../text.ts";

export const DEFAULT_PAGE_CHARS = 20_000;
export const MAX_PAGE_CHARS = 40_000;

/** The one list of source names. The server enum, the CLI flag, and the type all read it. */
export const DOC_SOURCES = [
	"clawdipedia",
	"platform",
	"code",
	"claude-resources",
] as const;
export type DocSourceName = (typeof DOC_SOURCES)[number];
export const isDocSource = (s: string): s is DocSourceName =>
	DOC_SOURCES.some((name) => name === s);

export interface Result {
	ok: boolean;
	/** Markdown or plain text for a reader. Ends with a "Source:" line on success. */
	text: string;
	/** The same answer as plain data (for `--json`). */
	data: Record<string, unknown>;
	/** Where the text came from. Undefined when nothing was read. */
	source: Source | undefined;
	/** True when `data` holds everything that `text` holds, so a front end may send only `data`. */
	complete: boolean;
}

export const content = new Content();
export const platform = new Platform();
export const code = new Code();
export const claudeResources = new ClaudeResources();

export const ok = (
	text: string,
	data: Record<string, unknown>,
	source: Source | undefined,
	complete = false,
): Result => ({ ok: true, text, data, source, complete });
export const fail = (text: string, source?: Source): Result => ({
	ok: false,
	text,
	data: { error: text },
	source,
	complete: false,
});

/** Network problems with nothing cached become a clean failed result. */
export const guarded = async (f: () => Promise<Result>): Promise<Result> => {
	try {
		return await f();
	} catch (error) {
		if (error instanceof ContentError) {
			return fail(error.message);
		}
		throw error;
	}
};

export const heading = async (): Promise<string> => {
	const v = await content.claudeCode();
	return present(v) ? `Claude Code Docs (Claude Code ${v})\n\n` : "";
};
