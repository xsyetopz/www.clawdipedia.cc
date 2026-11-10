import { basename } from "node:path";

/** A module of a build: its name and its text. */
export interface Source {
	name: string;
	text: string;
}

/** Where the code at an old offset sits in another build. */
export interface Relocation {
	module: string;
	offset: number;
	/** The text that tied the two builds together. */
	anchor: string;
	/** The share (0 to 1) of the words around the old offset that also surround the new one. */
	score: number;
	/** Whether the 100 characters around the two offsets are the same, but for the names of short (minified) identifiers. */
	same: boolean;
}

const WINDOW = 200;
const MAX_HITS = 300;
const MAX_ANCHORS = 6;
const WORD = /[A-Za-z_$][\w$]{3,}/gu;

const SAME = 50;
const shape = (s: string): string =>
	s.replaceAll(/[A-Za-z_$][\w$]{0,2}(?![\w$])/gu, "_");
// Shape first, then cut: a short name is a different number of characters in each build, so a cut before shaping would not line up.
const frame = (text: string, at: number): string =>
	`${shape(text.slice(Math.max(0, at - 2 * SAME), at)).slice(-SAME)}|${shape(text.slice(at, at + 2 * SAME)).slice(0, SAME)}`;

const words = (s: string): Set<string> =>
	new Set([...s.matchAll(WORD)].map((m) => m[0]));

/** The words and quoted strings of a claim that could name code: not chunk citations, at least 5 characters. */
export const claimTerms = (claim: string): string[] => {
	const plain = claim.replaceAll(
		/chunk-[\da-z]+\.js(?:[:@]\d+|`? lines \d+ to \d+)?/gu,
		" ",
	);
	const found = plain.match(/[\w$][\w$.-]{4,}/gu) ?? [];
	return [...new Set(found.map((t) => t.replaceAll(/[.-]+$/gu, "")))].filter(
		(t) => t.length >= 5,
	);
};

/** String literals of at least 8 characters around `offset`, for a claim that names no code. */
const literalsAround = (text: string, offset: number): string[] =>
	(
		text
			.slice(Math.max(0, offset - WINDOW), offset + WINDOW)
			.match(/"[^"\\\n]{8,}"/gu) ?? []
	).map((l) => l.slice(1, -1));

const rank = (r: Relocation): number => r.score + (r.same ? 1 : 0);

const occurrences = (text: string, needle: string): number[] => {
	const out: number[] = [];
	for (
		let i = text.indexOf(needle);
		i !== -1 && out.length < MAX_HITS;
		i = text.indexOf(needle, i + 1)
	) {
		out.push(i);
	}
	return out;
};

/**
 * Finds the code that `oldText` holds at `offset` in the modules of another build. The anchors are the terms of the claim
 * (and the string literals near the offset) that stand within 200 characters of the offset; each place that holds an anchor in
 * `sources` is scored by the words around it (a place with the same code around it comes first), and the offset keeps its distance from the anchor. Best match first, at most
 * `limit` of them, one for each module.
 */
export const relocate = (
	oldText: string,
	offset: number,
	terms: string[],
	sources: Iterable<Source>,
	limit = 3,
): Relocation[] => {
	const lo = Math.max(0, offset - WINDOW);
	const around = oldText.slice(lo, offset + WINDOW);
	const known = words(around);
	const near = [...terms, ...literalsAround(oldText, offset)]
		.map((term) => ({ term, at: oldText.indexOf(term, lo) }))
		.filter((a) => a.at !== -1 && a.at < offset + WINDOW)
		.toSorted((a, b) => Math.abs(a.at - offset) - Math.abs(b.at - offset))
		.slice(0, MAX_ANCHORS);
	const mods = [...sources];
	const best = new Map<string, Relocation>();
	for (const { term, at } of near) {
		for (const m of mods) {
			for (const i of occurrences(m.text, term)) {
				const here = words(
					m.text.slice(
						Math.max(0, i - (at - lo)),
						i - (at - lo) + around.length,
					),
				);
				const score =
					known.size === 0
						? 0
						: [...known].filter((w) => here.has(w)).length / known.size;
				const to = Math.max(0, i + offset - at);
				const found = {
					module: basename(m.name),
					offset: to,
					anchor: term,
					score,
					same: frame(m.text, to) === frame(oldText, offset),
				};
				const prior = best.get(found.module);
				if (prior === undefined || rank(found) > rank(prior)) {
					best.set(found.module, found);
				}
			}
		}
	}
	return [...best.values()]
		.toSorted((a, b) => rank(b) - rank(a))
		.slice(0, limit);
};
