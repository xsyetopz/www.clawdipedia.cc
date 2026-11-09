/** Runs `f` over `items` one at a time, each call after the one before, and returns the results in order. For steps that depend on the earlier ones. */
export const mapSeq = <T, R>(
	items: readonly T[],
	f: (x: T, i: number) => Promise<R>,
): Promise<R[]> => {
	const it = items[Symbol.iterator]();
	const out: R[] = [];
	const next = async (i: number): Promise<R[]> => {
		const n = it.next();
		if (n.done === true) {
			return out;
		}
		out.push(await f(n.value, i));
		return next(i + 1);
	};
	return next(0);
};
