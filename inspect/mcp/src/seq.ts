// Async steps that run one after the other. The resolver's steps share caches, cycle guards, and a
// step budget, so the order of its steps decides its results; and a step can parse a module, so steps
// that run at once can hold many syntax trees at once. Each helper is one `for await` loop: a
// recursive chain of promises keeps every step alive until the last one ends, and `scan` can take a
// step for each node of a module.

// The items as an async iterable, so a `for await` loop can await inside its body.
const each = <T>(items: Iterable<T>): AsyncIterable<T> => ({
	[Symbol.asyncIterator]: () => {
		const it = items[Symbol.iterator]();
		return { next: () => Promise.resolve(it.next()) };
	},
});

// The promises that `run` gives for the items, in order. It runs the next items only when the loop asks
// for the next promise, so an item with no promise takes no turn of the event loop. Each promise is in an
// object, because the type of a loop item is the value that its promise gives.
const pending = <T>(
	items: Iterable<T>,
	run: (item: T) => void | Promise<void>,
): AsyncIterable<{ end: Promise<void> }> => ({
	[Symbol.asyncIterator]: () => {
		const it = items[Symbol.iterator]();
		return {
			next: () => {
				for (let r = it.next(); r.done !== true; r = it.next()) {
					const end = run(r.value);
					if (end instanceof Promise) {
						return Promise.resolve({ done: false, value: { end } });
					}
				}
				return Promise.resolve({ done: true, value: undefined });
			},
		};
	},
});

/** Runs `run` on each item in order, and waits for each promise that it gives before the next item. */
export const eachSeq = async <T>(
	items: Iterable<T>,
	run: (item: T) => void | Promise<void>,
): Promise<void> => {
	for await (const step of pending(items, run)) {
		await step.end;
	}
};

/** Runs `run` on each item in order, one after the other, and gives the results in the same order. */
export const mapSeq = async <T, R>(
	items: Iterable<T>,
	run: (item: T) => Promise<R>,
): Promise<R[]> => {
	const out: R[] = [];
	for await (const item of each(items)) {
		out.push(await run(item));
	}
	return out;
};

/** `mapSeq` that stops at the first undefined result and gives undefined. */
export const allSeq = async <T, R>(
	items: Iterable<T>,
	run: (item: T) => Promise<R | undefined>,
): Promise<R[] | undefined> => {
	const out: R[] = [];
	for await (const item of each(items)) {
		const r = await run(item);
		if (r === undefined) {
			return undefined;
		}
		out.push(r);
	}
	return out;
};

/** Runs `run` on each item in order, and gives the first result that is not undefined. */
export const firstSeq = async <T, R>(
	items: Iterable<T>,
	run: (item: T) => Promise<R | undefined>,
): Promise<R | undefined> => {
	for await (const item of each(items)) {
		const r = await run(item);
		if (r !== undefined) {
			return r;
		}
	}
	return undefined;
};

/** Whether `test` holds for some item; it stops at the first item that passes. */
export const someSeq = async <T>(
	items: Iterable<T>,
	test: (item: T) => Promise<boolean>,
): Promise<boolean> =>
	(await firstSeq(items, async (i) => ((await test(i)) ? true : undefined))) ===
	true;

/** Whether `test` holds for every item; it stops at the first item that fails. */
export const everySeq = async <T>(
	items: Iterable<T>,
	test: (item: T) => Promise<boolean>,
): Promise<boolean> => !(await someSeq(items, async (i) => !(await test(i))));
