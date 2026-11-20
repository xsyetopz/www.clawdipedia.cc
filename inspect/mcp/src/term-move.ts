// Places a citation number in a newer build by a term of its claim line, for code that changed around the cited place.

/** Lines on each side of a cleaned-module line that a term may sit in, as the term check reads one. */
export const NEAR_LINES = 10;

/** Lines on each side of a term line whose likeness tells two places of the term apart. */
const TERM_RADIUS = 3;
/** Characters on each side of a raw offset that a term may sit in, as the term check reads one. */
const TERM_WINDOW = 600;
/** Characters on each side of a term that tell two places of the same term apart. */
const CONTEXT = 200;
const WORDS = /[A-Za-z_$][\w$]{3,}/gu;

/** The shortest term that stands for code: a short word such as "The" sits near any code. */
const MIN_TERM = 5;
/** The share of alike surroundings that a place of a term needs: a term can sit in code that is not the cited one, such as a URL in a banner. */
const MIN_SCORE = 0.4;
/** The most places of one term in the new module: a term that is everywhere places nothing. */
const MAX_PLACES = 20;

interface Candidate {
	/** The new number. */
	to: number;
	/** How alike the surroundings are, 0 to 1. */
	score: number;
}

/** The terms that can stand for code, the longest first: a longer term names its code more exactly. */
const specificFirst = (terms: string[]): string[] =>
	terms
		.filter((t) => t.length >= MIN_TERM)
		.toSorted((a, b) => b.length - a.length);

/** The best candidate: the highest score, then the nearest to `n`. */
const bestCandidate = (found: Candidate[], n: number): Candidate | undefined =>
	found
		.filter((c) => c.score >= MIN_SCORE)
		.toSorted(
			(a, b) => b.score - a.score || Math.abs(a.to - n) - Math.abs(b.to - n),
		)[0];

/** Where line `n` of `a` sits in `b`, by a term of the claim that stands near line `n` in `a`: the offset from the term line stays. */
export const termLine = (
	a: string[],
	b: string[],
	n: number,
	terms: string[],
): number | undefined => {
	for (const t of specificFirst(terms)) {
		const found: Candidate[] = [];
		const lo = Math.max(0, n - 1 - NEAR_LINES);
		const hits = a
			.slice(lo, n + NEAR_LINES)
			.flatMap((l, k) => (l.includes(t) ? [lo + k] : []))
			.toSorted((x, y) => Math.abs(x - (n - 1)) - Math.abs(y - (n - 1)));
		const [i] = hits;
		if (i === undefined) {
			continue;
		}
		const places = b.flatMap((l, j) => (l.includes(t) ? [j] : []));
		for (const j of places.length > MAX_PLACES ? [] : places) {
			let same = 0;
			for (let k = -TERM_RADIUS; k <= TERM_RADIUS; k += 1) {
				same += a[i + k] !== undefined && a[i + k] === b[j + k] ? 1 : 0;
			}
			const to = j + 1 + (n - 1 - i);
			if (to >= 1 && to <= b.length) {
				found.push({ score: same / (2 * TERM_RADIUS + 1), to });
			}
		}
		const best = bestCandidate(found, n);
		if (best) {
			return best.to;
		}
	}
	return undefined;
};

const occurrences = (text: string, needle: string): number[] => {
	const out: number[] = [];
	for (
		let i = text.indexOf(needle);
		i !== -1 && out.length <= MAX_PLACES;
		i = text.indexOf(needle, i + 1)
	) {
		out.push(i);
	}
	return out;
};

/** The identifier-like words of `s`, to tell alike surroundings. */
export const wordSet = (s: string): Set<string> => new Set(s.match(WORDS));

/** Where raw offset `n` of `a` sits in `b`, by a term of the claim that stands near `n` in `a`: the offset from the term stays. */
export const termOffset = (
	a: string,
	b: string,
	n: number,
	terms: string[],
): number | undefined => {
	for (const t of specificFirst(terms)) {
		const found: Candidate[] = [];
		const hit = a.indexOf(t, Math.max(0, n - TERM_WINDOW));
		if (hit === -1 || hit + t.length > n + TERM_WINDOW) {
			continue;
		}
		const want = wordSet(
			a.slice(Math.max(0, hit - CONTEXT), hit + t.length + CONTEXT),
		);
		const places = occurrences(b, t);
		for (const at of places.length > MAX_PLACES ? [] : places) {
			const got = wordSet(
				b.slice(Math.max(0, at - CONTEXT), at + t.length + CONTEXT),
			);
			const shared = [...want].filter((w) => got.has(w)).length;
			const to = at + (n - hit);
			if (to >= 0 && to <= b.length) {
				found.push({
					score: shared / Math.max(1, want.size, got.size),
					to,
				});
			}
		}
		const best = bestCandidate(found, n);
		if (best) {
			return best.to;
		}
	}
	return undefined;
};
