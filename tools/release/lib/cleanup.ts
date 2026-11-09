// One shared exit/signal hook for sandbox, ports and proc. Handlers run once, in registration order.
// Handlers are async (the sync fs calls are banned): `beforeExit` covers a normal end, the signal handlers cover SIGINT and SIGTERM,
// the crash handlers cover an uncaught error or rejection. An explicit `process.exit` skips cleanup.
const fns: (() => Promise<void> | void)[] = [];
let done = false;

const runFrom = async (i: number): Promise<void> => {
	const f = fns[i];
	if (f === undefined) {
		return;
	}
	try {
		await f();
	} catch {
		// best effort
	}
	await runFrom(i + 1);
};

/** Run every registered handler once, in registration order. */
export const runCleanup = async (): Promise<void> => {
	if (done) {
		return;
	}
	done = true;
	await runFrom(0);
};

process.on("beforeExit", () => {
	void runCleanup();
});
for (const sig of ["SIGINT", "SIGTERM"] as const) {
	process.on(sig, () => {
		void (async () => {
			await runCleanup();
			// Re-raise with no handler left, so the exit status is the usual 128 + signal number.
			process.removeAllListeners(sig);
			process.kill(process.pid, sig);
		})();
	});
}
// A handler here replaces the default crash report, so print the error, then clean up and exit 1.
for (const ev of ["uncaughtException", "unhandledRejection"] as const) {
	process.on(ev, (error: unknown) => {
		console.error(error);
		void (async () => {
			await runCleanup();
			process.exit(1);
		})();
	});
}

/** Register a handler that runs once when the process ends. */
export const onCleanup = (f: () => Promise<void> | void): void =>
	void fns.push(f);
