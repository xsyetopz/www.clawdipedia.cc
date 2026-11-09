// Spawn with timeout and an own-PID registry. Kills only PIDs this process spawned (or their verified children);
// no pkill, no name matching. Children run detached in their own process group; the group is killed with them.
import { onCleanup } from "./cleanup.ts";

export interface ChildResult {
	stdout: string;
	stderr: string;
	code: number | null;
	timedOut: boolean;
	pid: number;
}

/** Spawned by runChild; removed as soon as the child is reaped. */
const pids = new Set<number>();
/** Registered by pid (pty driver child); verified before every signal. */
const extra = new Set<number>();
export const ownPids = (): number[] => [...pids, ...extra];

const alive = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

const psField = async (field: string, pid: number): Promise<number> => {
	const p = Bun.spawn(["/bin/ps", "-o", `${field}=`, "-p", String(pid)], {
		env: { PATH: "/bin:/usr/bin" },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out] = await Promise.all([new Response(p.stdout).text(), p.exited]);
	return Number(out.trim()) || 0;
};

const ppidOf = (pid: number): Promise<number> => psField("ppid", pid);
const pgidOf = (pid: number): Promise<number> => psField("pgid", pid);

/** Register a PID spawned by one of our children (the pty driver's child). Refused unless its parent is ours. */
export const registerPid = async (pid: number): Promise<boolean> => {
	const pp = await ppidOf(pid);
	if (pp !== process.pid && !pids.has(pp)) {
		return false;
	}
	extra.add(pid);
	return true;
};

export const unregisterPid = (pid: number): void => void extra.delete(pid);

const signal = (pid: number, sig: NodeJS.Signals, group: boolean): void => {
	try {
		process.kill(group ? -pid : pid, sig);
	} catch {
		// already gone
	}
};

export const killOwn = async (): Promise<void> => {
	const groups = [...pids];
	// Registered extras: only if still our descendant (guards against PID reuse).
	const parents = await Promise.all([...extra].map((p) => ppidOf(p)));
	const singles = [...extra].filter((_, i) => {
		const pp = parents[i] ?? 0;
		return pp === process.pid || pids.has(pp);
	});
	for (const p of groups) {
		signal(p, "SIGTERM", true);
	}
	// A registered pid that leads its own group (a pty session leader) is signalled as a group.
	const groupIds = await Promise.all(singles.map((p) => pgidOf(p)));
	const lead = new Set(singles.filter((p, i) => groupIds[i] === p));
	for (const p of singles) {
		signal(p, "SIGTERM", lead.has(p));
	}
	if (groups.some((p) => alive(p)) || singles.some((p) => alive(p))) {
		await Bun.sleep(300);
	}
	for (const p of groups) {
		if (alive(p)) {
			signal(p, "SIGKILL", true);
		}
	}
	for (const p of singles) {
		if (alive(p)) {
			signal(p, "SIGKILL", lead.has(p));
		}
	}
	pids.clear();
	extra.clear();
};
onCleanup(killOwn);

interface RunOpts {
	cwd: string;
	env: Record<string, string>;
	stdin?: string;
	/** Close stdin this long after writing it, so the child does not see the input end at once. */
	stdinOpenMs?: number;
	timeoutMs?: number;
	/** After the child exited, before its process group is signalled. */
	beforeReap?: () => Promise<void> | void;
}

const stdinFor = (
	text: string | undefined,
	ms: number | undefined,
): "ignore" | Blob | ReadableStream => {
	if (text === undefined) {
		return "ignore";
	}
	if (ms === undefined) {
		return new Blob([text]);
	}
	return new ReadableStream({
		start(c) {
			c.enqueue(new TextEncoder().encode(text));
			setTimeout(() => {
				c.close();
			}, ms);
		},
	});
};

const drain = async (
	reader: ReadableStreamDefaultReader<Uint8Array>,
	cut: Promise<null>,
	dec: TextDecoder,
	acc: string,
): Promise<string> => {
	const c = await Promise.race([reader.read(), cut]);
	if (!c || c.done) {
		return acc;
	}
	return drain(reader, cut, dec, acc + dec.decode(c.value, { stream: true }));
};

/** Read a pipe until it ends; a grandchild may hold it open after the child exits, so stop shortly after exit. */
const readPipe = async (
	s: ReadableStream<Uint8Array>,
	exited: Promise<number>,
): Promise<string> => {
	const reader = s.getReader();
	let stop = false;
	void (async () => {
		await exited;
		setTimeout(() => {
			stop = true;
		}, 500);
	})();
	const cut = new Promise<null>((resolve) => {
		const i = setInterval(() => {
			if (stop) {
				clearInterval(i);
				resolve(null);
			}
		}, 50);
	});
	const out = await drain(reader, cut, new TextDecoder(), "");
	void (async () => {
		try {
			await reader.cancel();
		} catch {
			// empty
		}
	})();
	return out;
};

export const runChild = async (
	argv: string[],
	o: RunOpts,
): Promise<ChildResult> => {
	const p = Bun.spawn(argv, {
		cwd: o.cwd,
		// exactly this; Bun does not merge process.env when env is given
		env: o.env,
		stdin: stdinFor(o.stdin, o.stdinOpenMs),
		stdout: "pipe",
		stderr: "pipe",
		detached: true,
	});
	const pid = p.pid;
	pids.add(pid);
	let timedOut = false;
	void (async () => {
		await p.exited;
		pids.delete(pid);
	})();
	const timer = setTimeout(() => {
		timedOut = true;
		signal(pid, "SIGTERM", true);
		setTimeout(() => {
			signal(pid, "SIGKILL", true);
		}, 2000).unref();
	}, o.timeoutMs ?? 60_000);
	const [stdout, stderr] = await Promise.all([
		readPipe(p.stdout, p.exited),
		readPipe(p.stderr, p.exited),
	]);
	const code = await p.exited;
	clearTimeout(timer);
	try {
		await o.beforeReap?.();
	} finally {
		// grandchildren (MCP servers, hooks) must not outlive the run
		signal(pid, "SIGTERM", true);
		setTimeout(() => {
			signal(pid, "SIGKILL", true);
		}, 1000).unref();
	}
	return { stdout, stderr, code: timedOut ? null : code, timedOut, pid };
};
