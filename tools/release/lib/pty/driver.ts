// TS wrapper for driver.py. Launches the program in a pty with exactly `env` (a 0600 JSON file the driver reads and deletes,
// then execve: nothing inherited, no values in argv). The driver's child pid is registered with proc.ts so killOwn covers it.
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

import { assertSafeEnv } from "../env.ts";
import { assertLiveEnv } from "../live/env.ts";
import { registerPid, runChild, unregisterPid } from "../proc.ts";
import { assertShimReady } from "../shim.ts";

/** `rebase: true` restarts the clock when the step is reached: later `t` values and `secs` count from there (spawn otherwise). */
export type PtyStep = {
	label?: string;
	send?: string;
	rebase?: boolean;
} & (
	| { t: number; wait_for?: undefined; timeout?: undefined }
	| { wait_for: string; timeout?: number; t?: undefined }
);
export interface PtyOpts {
	cwd: string;
	/** The full child env (childEnv with tty: true). */
	env: Record<string, string>;
	bin: string;
	args?: string[];
	schedule?: PtyStep[];
	secs: number;
	/** Default 50. */
	rows?: number;
	/** Default 200. */
	cols?: number;
	/** RAW path; default a fresh temp dir (caller owns it). */
	out?: string;
	/** Live runs only: allows exactly CLAUDE_CODE_OAUTH_TOKEN === this value. */
	liveToken?: string;
}
export interface PtyResult {
	rawPath: string;
	/** Rendered text: ANSI stripped, CR overwrites, spaces collapsed. */
	screen: string;
	/** Epoch seconds; "<label>:timeout" when a wait_for never matched. */
	sent: { t: number; label: string }[];
	/** Epoch seconds and byte offset after each read. */
	idx: { t: number; off: number }[];
	/** The program's pid (already dead when this returns). */
	pid: number;
	/** Negative = killed by that signal. */
	exit: number | null;
}

const DRIVER = join(dirname(new URL(import.meta.url).pathname), "driver.py");
const PY_ENV = { PATH: "/usr/bin:/bin:/opt/homebrew/bin:/usr/local/bin" };

const pairs = async (file: string): Promise<[number, string][]> => {
	const f = Bun.file(file);
	if (!(await f.exists())) {
		return [];
	}
	const text = await f.text();
	return text
		.split("\n")
		.filter((l) => l !== "")
		.map((l) => {
			const i = l.indexOf(" ");
			return [Number(l.slice(0, i)), l.slice(i + 1)];
		});
};

const readPid = async (file: string): Promise<number> => {
	const f = Bun.file(file);
	return (await f.exists()) ? Number(await f.text()) : 0;
};

/** Registers the program's pid as soon as the driver writes it; killOwn then covers it even if we are interrupted. */
const watchPid = (pidFile: string): { stop: () => Promise<void> } => {
	let watched = 0;
	let inflight: Promise<void> | undefined;
	const tick = async (): Promise<void> => {
		const pid = await readPid(pidFile);
		if (pid > 1 && (await registerPid(pid))) {
			watched = pid;
			clearInterval(timer);
		}
	};
	const guarded = async (): Promise<void> => {
		try {
			await tick();
		} finally {
			inflight = undefined;
		}
	};
	const timer = setInterval(() => {
		// a slow ps must not let two ticks register twice
		inflight ??= guarded();
	}, 50);
	return {
		stop: async () => {
			clearInterval(timer);
			await inflight;
			if (watched !== 0) {
				unregisterPid(watched);
			}
		},
	};
};

const checkInputs = async (o: PtyOpts): Promise<string> => {
	await assertShimReady(o.env);
	if (o.liveToken !== undefined && o.liveToken !== "") {
		assertLiveEnv(o.env, o.liveToken);
	} else {
		assertSafeEnv(o.env);
	}
	if (!isAbsolute(o.bin) || !(await Bun.file(o.bin).exists())) {
		throw new Error(
			`bin must be an absolute path to an existing file: ${o.bin}`,
		);
	}
	const python = Bun.which("python3", { PATH: PY_ENV.PATH });
	if (python === null) {
		throw new Error("python3 not found");
	}
	return python;
};

const driverArgv = (
	o: PtyOpts,
	python: string,
	paths: { raw: string; env: string; schedule: string },
): string[] => [
	python,
	"-I",
	DRIVER,
	"--cwd",
	o.cwd,
	"--out",
	paths.raw,
	"--secs",
	String(o.secs),
	"--env",
	paths.env,
	"--schedule",
	paths.schedule,
	"--rows",
	String(o.rows ?? 50),
	"--cols",
	String(o.cols ?? 200),
	"--",
	o.bin,
	...(o.args ?? []),
];

const parseInfo = (
	res: Awaited<ReturnType<typeof runChild>>,
): { pid: number; exit: number | null } => {
	let parsed: unknown;
	try {
		parsed = JSON.parse(res.stdout.trim().split("\n").pop() ?? "{}");
	} catch {
		throw new Error(`pty driver failed: ${res.stderr.slice(0, 500)}`);
	}
	const r = typeof parsed === "object" && parsed !== null ? parsed : {};
	return {
		pid: "pid" in r && typeof r.pid === "number" ? r.pid : 0,
		exit: "exit" in r && typeof r.exit === "number" ? r.exit : null,
	};
};

export const runPty = async (o: PtyOpts): Promise<PtyResult> => {
	const python = await checkInputs(o);
	const out = o.out !== undefined && o.out !== "" ? o.out : undefined;
	const dir =
		out === undefined
			? await realpath(await mkdtemp(join(tmpdir(), "ccrel-pty-")))
			: dirname(out);
	const rawPath = out ?? join(dir, "RAW");
	const paths = {
		raw: rawPath,
		env: `${rawPath}.env.json`,
		schedule: `${rawPath}.schedule.json`,
	};
	await Bun.write(paths.schedule, JSON.stringify(o.schedule ?? []));
	await writeFile(paths.env, JSON.stringify(o.env), { mode: 0o600 });
	const watch = watchPid(`${rawPath}.pid`);
	let res: Awaited<ReturnType<typeof runChild>>;
	try {
		res = await runChild(driverArgv(o, python, paths), {
			cwd: dir,
			env: PY_ENV,
			timeoutMs: o.secs * 1000 + 45_000,
		});
	} finally {
		await watch.stop();
		await rm(paths.env, { force: true });
	}
	const info = parseInfo(res);
	if (res.code !== 0) {
		throw new Error(`pty driver exit ${res.code}: ${res.stderr.slice(0, 500)}`);
	}
	const screenFile = Bun.file(`${rawPath}.screen.txt`);
	const sent = await pairs(`${rawPath}.sent`);
	const idx = await pairs(`${rawPath}.idx`);
	return {
		rawPath,
		screen: (await screenFile.exists()) ? await screenFile.text() : "",
		sent: sent.map(([t, label]) => ({ t, label })),
		idx: idx.map(([t, off]) => ({ t, off: Number(off) })),
		pid: info.pid,
		exit: info.exit,
	};
};
