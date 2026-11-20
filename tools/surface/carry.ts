// Pairs an unmapped item key with the stale entry key that it most likely replaces: the same item reworded in a new release.
// A pair is carried only when the match is mutual-best and the score reaches CARRY_THRESHOLD.

/**
 * The lowest word score at which a stale key carries to an unmapped key.
 * The real pairs of release 2.1.31x that are rewordings score 0.64 and up; the best false pair that is still mutual scores 0.5.
 */
export const CARRY_THRESHOLD = 0.6;

/** Fewest real words that a key needs before it can pair: a shorter text matches by chance. */
const MIN_WORDS = 3;

const kindOf = (key: string): string =>
	key.slice(0, Math.max(key.indexOf(":"), 0));

/** The set of real words of a key. A `${…}` placeholder, the kind, and punctuation count for nothing. */
export const wordsOf = (key: string): Set<string> => {
	const text = key
		.slice(key.indexOf(":") + 1)
		.replaceAll(`\${…}`, " ")
		.toLowerCase();
	return new Set([...text.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => m[0]));
};

/** The Jaccard score of the real words of two keys. A key with too few words scores 0. */
export const score = (a: string, b: string): number => {
	const wa = wordsOf(a);
	const wb = wordsOf(b);
	if (wa.size < MIN_WORDS || wb.size < MIN_WORDS) {
		return 0;
	}
	const shared = [...wa].filter((w) => wb.has(w)).length;
	return shared / (wa.size + wb.size - shared);
};

const bestOf = (key: string, others: string[]): string | undefined => {
	let best: string | undefined;
	let top = 0;
	for (const other of others) {
		if (kindOf(other) !== kindOf(key)) {
			continue;
		}
		const s = score(key, other);
		if (s > top) {
			top = s;
			best = other;
		}
	}
	return top >= CARRY_THRESHOLD ? best : undefined;
};

/** The `[old, new]` pairs to carry. A prefix key (ending in `*`) never pairs; a tie for best does not pair either way. */
export const carryPairs = (
	unmapped: string[],
	stale: string[]
): [string, string][] => {
	const fresh = unmapped.filter((k) => !k.endsWith("*"));
	const old = stale.filter((k) => !k.endsWith("*"));
	const pairs: [string, string][] = [];
	for (const key of fresh) {
		const match = bestOf(key, old);
		if (match !== undefined && bestOf(match, fresh) === key) {
			pairs.push([match, key]);
		}
	}
	return pairs;
};
