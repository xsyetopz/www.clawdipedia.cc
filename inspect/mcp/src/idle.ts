// The server lives as long as its Claude Code session, and the syntax trees of one program are 1.5 GB of
// heap. A release during a call is not safe: the call holds modules, nodes, and variables of those trees.

/** Wraps each call so that `release` runs when no call ran for `ms`. It never runs during a call. */
export const idleRelease = (ms: number, release: () => void) => {
	let running = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	return async <T>(call: () => Promise<T>): Promise<T> => {
		clearTimeout(timer);
		running += 1;
		try {
			return await call();
		} finally {
			running -= 1;
			if (running === 0) {
				timer = setTimeout(release, ms);
				// A waiting release must not keep the server alive after its client goes away.
				timer.unref();
			}
		}
	};
};
