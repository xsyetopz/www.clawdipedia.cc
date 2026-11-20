import type { Source } from "./relocate.ts";

const MIN_WINDOW = 40;

// The cleaner names a declaration, and a chunk, by a hash of its code, so changed code has another name in each build.
const HASH_NAME = /\$[\da-f]{6}\b|chunk@[\da-f]{8}\.js/gu;
const cleanLines = new WeakMap<Source, string[]>();
export const linesOf = (s: Source): string[] | undefined => {
	if (s.clean === undefined) {
		return undefined;
	}
	const lines =
		cleanLines.get(s) ??
		s.clean.split("\n").map((l) => l.trim().replaceAll(HASH_NAME, "$"));
	cleanLines.set(s, lines);
	return lines;
};

/** Where line `n` (1-based) of `a` sits in `b`: the nearest place with the same lines around it. A window of little text could match anywhere, so it is skipped. */
export const sameLine = (
	a: string[],
	b: string[],
	n: number
): number | undefined => {
	for (const radius of [4, 2, 1]) {
		const before = Math.min(radius, n - 1);
		const want = a.slice(n - 1 - before, n + radius);
		if (want.join("").length >= MIN_WINDOW) {
			for (let k = 0; k < Math.max(a.length, b.length); k += 1) {
				const to = [n - k, n + k].find((line) => {
					const at = line - 1 - before;
					return at >= 0 && want.every((l, i) => b[at + i] === l);
				});
				if (to !== undefined) {
					return to;
				}
			}
		}
	}
	return undefined;
};
