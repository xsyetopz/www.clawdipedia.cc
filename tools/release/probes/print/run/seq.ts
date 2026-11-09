// Ordered async iteration: each step starts after the previous one finished.
// Probes spawn the program and record results, so the order must stay fixed.
export const mapInOrder = async <T, R>(
	items: readonly T[],
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
	const out: R[] = [];
	const it = items.entries();
	const step = async (): Promise<void> => {
		const n = it.next();
		if (n.done === true) {
			return;
		}
		out.push(await fn(n.value[1], n.value[0]));
		await step();
	};
	await step();
	return out;
};

export const eachInOrder = async <T>(
	items: readonly T[],
	fn: (item: T, index: number) => Promise<void>,
): Promise<void> => {
	await mapInOrder(items, fn);
};
