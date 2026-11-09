// Reads the user turn of a run that holds a mark, with the temp folders of the run replaced by names.
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";

import { isRecord, recordsOf } from "./json.ts";
import type { RunResult } from "./run.ts";

const REAL_TMP = await realpath(tmpdir());

const textBlocks = (content: unknown[]): string[] =>
	content.flatMap((b) =>
		isRecord(b) && b["type"] === "text" && typeof b["text"] === "string"
			? [b["text"]]
			: [],
	);

const textsOf = (m: Record<string, unknown>): string[] => {
	const content: unknown = m["content"];
	if (typeof content === "string") {
		return [content];
	}
	return Array.isArray(content) ? textBlocks(content) : [];
};

const maskDirs = (text: string, dirs: RunResult["dirs"]): string =>
	text
		.replaceAll(dirs.home, "<home>")
		.replaceAll(dirs.config, "<config-dir>")
		.replaceAll(dirs.project, "<project-dir>")
		.replaceAll(
			/\S*\/bundled-skills\/[^/\s]+\/[0-9a-f]+/gu,
			"<bundled-skill-dir>",
		)
		.replaceAll(REAL_TMP, "<temp-dir>")
		.replaceAll(tmpdir().replace(/\/$/u, ""), "<temp-dir>");

/**
 * The text blocks of the first user turn that holds `mark`, from the block that holds it to the end
 * (blocks the program puts before, such as reminders, are left out). Temp folders become `<home>`,
 * `<config-dir>`, `<project-dir>`, `<bundled-skill-dir>`, and `<temp-dir>`. Null when no request holds it.
 */
export const userText = (
	r: Pick<RunResult, "requests" | "dirs">,
	mark: string,
): string | null => {
	for (const q of r.requests) {
		if (!q.path.startsWith("/v1/messages") || q.path.includes("count_tokens")) {
			continue;
		}
		const messages = isRecord(q.body) ? recordsOf(q.body["messages"]) : [];
		for (const m of messages) {
			if (m["role"] !== "user") {
				continue;
			}
			const texts = textsOf(m);
			const i = texts.findIndex((t) => t.includes(mark));
			if (i !== -1) {
				return maskDirs(
					texts
						.slice(i)
						.map((t) => t.trimEnd())
						.join("\n\n"),
					r.dirs,
				);
			}
		}
	}
	return null;
};
