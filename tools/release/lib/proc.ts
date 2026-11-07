// Spawn with timeout and an own-PID registry. Kills only PIDs this process spawned (or their verified children);
// no pkill, no name matching. Children run detached in their own process group; the group is killed with them.
import { onCleanup } from "./cleanup.ts";

export type ChildResult = {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
  pid: number;
};

const pids = new Set<number>(); // spawned by runChild (removed as soon as the child is reaped)
const extra = new Set<number>(); // registered by pid (pty driver child); verified before every signal
export const ownPids = (): number[] => [...pids, ...extra];

const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const ppidOf = (pid: number): number => {
  const r = Bun.spawnSync(["/bin/ps", "-o", "ppid=", "-p", String(pid)], {
    env: { PATH: "/bin:/usr/bin" },
  });
  return Number(r.stdout.toString().trim()) || 0;
};

/** Register a PID spawned by one of our children (the pty driver's child). Refused unless its parent is ours. */
export const registerPid = (pid: number): boolean => {
  const pp = ppidOf(pid);
  if (pp !== process.pid && !pids.has(pp)) return false;
  extra.add(pid);
  return true;
};

const pgidOf = (pid: number): number => {
  const r = Bun.spawnSync(["/bin/ps", "-o", "pgid=", "-p", String(pid)], {
    env: { PATH: "/bin:/usr/bin" },
  });
  return Number(r.stdout.toString().trim()) || 0;
};

export const unregisterPid = (pid: number): void => void extra.delete(pid);

const signal = (pid: number, sig: NodeJS.Signals, group: boolean): void => {
  try {
    process.kill(group ? -pid : pid, sig);
  } catch {
    // already gone
  }
};

export const killOwn = (): void => {
  const groups = [...pids];
  // Registered extras: only if still our descendant (guards against PID reuse).
  const singles = [...extra].filter((p) => {
    const pp = ppidOf(p);
    return pp === process.pid || pids.has(pp);
  });
  for (const p of groups) signal(p, "SIGTERM", true);
  // A registered pid that leads its own group (a pty session leader) is signalled as a group.
  const lead = new Set(singles.filter((p) => pgidOf(p) === p));
  for (const p of singles) signal(p, "SIGTERM", lead.has(p));
  if (groups.some(alive) || singles.some(alive)) Bun.sleepSync(300);
  for (const p of groups) if (alive(p)) signal(p, "SIGKILL", true);
  for (const p of singles) if (alive(p)) signal(p, "SIGKILL", lead.has(p));
  pids.clear();
  extra.clear();
};
onCleanup(killOwn);

export const runChild = async (
  argv: string[],
  o: {
    cwd: string;
    env: Record<string, string>;
    stdin?: string;
    stdinOpenMs?: number; // close stdin this long after writing it, so the child does not see the input end at once
    timeoutMs?: number;
    beforeReap?: () => void; // after the child exited, before its process group is signalled
  },
): Promise<ChildResult> => {
  const text = o.stdin;
  const ms = o.stdinOpenMs;
  const p = Bun.spawn(argv, {
    cwd: o.cwd,
    env: o.env, // exactly this; Bun does not merge process.env when env is given
    stdin:
      text === undefined
        ? "ignore"
        : ms === undefined
          ? new Blob([text])
          : new ReadableStream({
              start(c) {
                c.enqueue(new TextEncoder().encode(text));
                setTimeout(() => c.close(), ms);
              },
            }),
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  const pid = p.pid;
  pids.add(pid);
  let timedOut = false;
  void p.exited.then(() => pids.delete(pid));
  const timer = setTimeout(() => {
    timedOut = true;
    signal(pid, "SIGTERM", true);
    setTimeout(() => signal(pid, "SIGKILL", true), 2000).unref();
  }, o.timeoutMs ?? 60_000);
  const read = async (s: ReadableStream<Uint8Array>): Promise<string> => {
    // A grandchild may hold the pipe open after the child exits: stop reading shortly after exit.
    const reader = s.getReader();
    const dec = new TextDecoder();
    let out = "";
    let stop = false;
    void p.exited.then(() => setTimeout(() => (stop = true), 500));
    const cut = new Promise<null>((r) => {
      const i = setInterval(() => {
        if (stop) {
          clearInterval(i);
          r(null);
        }
      }, 50);
    });
    for (;;) {
      const c = await Promise.race([reader.read(), cut]);
      if (!c || c.done) break;
      out += dec.decode(c.value, { stream: true });
    }
    reader.cancel().catch(() => undefined);
    return out;
  };
  const [stdout, stderr] = await Promise.all([read(p.stdout), read(p.stderr)]);
  const code = await p.exited;
  clearTimeout(timer);
  try {
    o.beforeReap?.();
  } finally {
    // grandchildren (MCP servers, hooks) must not outlive the run
    signal(pid, "SIGTERM", true);
    setTimeout(() => signal(pid, "SIGKILL", true), 1000).unref();
  }
  return { stdout, stderr, code: timedOut ? null : code, timedOut, pid };
};
