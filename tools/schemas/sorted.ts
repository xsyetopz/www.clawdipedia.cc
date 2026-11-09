/**
 * A sorted copy of `items` (stable). `Array#sort` is banned by oxlint (`unicorn/no-array-sort`) and
 * `Array#toSorted` is not in the ES2022 lib of tsconfig.json; replace this with `toSorted` when the lib is raised.
 */
export const sorted = <T>(
	items: readonly T[],
	compare: (a: T, b: T) => number,
): T[] => {
	const out: T[] = [];
	for (const item of items) {
		let at = out.length;
		while (at > 0) {
			const prev = out[at - 1];
			if (prev === undefined || compare(prev, item) <= 0) {
				break;
			}
			at--;
		}
		out.splice(at, 0, item);
	}
	return out;
};

/** The strings ordered by code unit, as `Array#sort()` with no compare function orders them. */
export const sortedStrings = (items: readonly string[]): string[] =>
	sorted(items, (a, b) => {
		if (a < b) {
			return -1;
		}
		return a > b ? 1 : 0;
	});
