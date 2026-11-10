import { basename } from "node:path";

/** One citation of a program chunk in a Markdown file. */
export interface Citation {
	file: string;
	/** 1-based line of the citation in the file. */
	line: number;
	/** The text as written: `chunk-x.js`, `chunk-x.js:N`, `chunk-x.js@N`, or `chunk-x.js lines A to B`. */
	citation: string;
	/** The chunk file name. */
	chunk: string;
}

const CITATION = /(chunk-[\da-z]+\.js)(?:[:@]\d+|`? lines \d+ to \d+)?/gu;

/** The chunk citations in Markdown `text`, in order, with the 1-based line of each. */
export const findCitations = (file: string, text: string): Citation[] =>
	text.split("\n").flatMap((lineText, i) =>
		[...lineText.matchAll(CITATION)].map((m) => ({
			file,
			line: i + 1,
			citation: m[0],
			chunk: m[1] ?? m[0],
		})),
	);

/**
 * The chunk citations in `files` (file name to Markdown text) whose chunk is not among `moduleNames`.
 * A module name may be a path, as in the program; only its last part is compared.
 */
export const staleCitations = (
	files: Record<string, string>,
	moduleNames: Iterable<string>,
): Citation[] => {
	const known = new Set([...moduleNames].map((n) => basename(n)));
	return Object.entries(files)
		.flatMap(([file, text]) => findCitations(file, text))
		.filter((c) => !known.has(c.chunk));
};
