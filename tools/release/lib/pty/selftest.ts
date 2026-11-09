// Pty driver self-test against a tiny /bin/sh program (never the real binary). Called from ../../selftest.ts.
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { childEnv } from "../env.ts";
import { pathExists } from "../fs.ts";
import { writeSecurityShim } from "../shim.ts";
import { runPty } from "./driver.ts";

type Step = (name: string, ok: boolean, detail?: string) => void;
interface Ctx {
	dir: string;
	env: Record<string, string>;
}

const PROGRAM = `#!/bin/sh
printf 'leak=[%s%s]\\r\\n' "\${CLAUDE_CODE_SELFTEST_LEAK-}" "\${ANTHROPIC_AUTH_TOKEN-}"
printf 'size=%s\\r\\n' "$(stty size)"
printf 'ready> '
read a
printf '\\033[31mgot:%s\\033[0m\\r\\n' "$a"
printf 'progress 10%%\\rprogress 100%%\\r\\n'
printf 'a\\033[3Cb\\r\\n'
read b
printf 'second:%s\\r\\n' "$b"
sleep 30
`;

const script = async (path: string, body: string): Promise<void> => {
	await Bun.write(path, body);
	await chmod(path, 0o755);
};

const alive = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

const mainChecks = async (step: Step, c: Ctx): Promise<void> => {
	const prog = join(c.dir, "prog.sh");
	await script(prog, PROGRAM);
	const r = await runPty({
		cwd: c.dir,
		env: c.env,
		bin: prog,
		secs: 6,
		rows: 30,
		cols: 100,
		out: join(c.dir, "RAW"),
		schedule: [
			{ wait_for: "ready>", timeout: 5, send: "hello\r", label: "one" },
			{ wait_for: "never-appears", timeout: 0.5, send: "x", label: "miss" },
			{ t: 1.5, send: "x\r", label: "two" },
		],
	});
	const s = r.screen;
	step("pty: exact env (no parent leak)", s.includes("leak=[]"), "");
	step("pty: size 30x100", s.includes("size=30 100"));
	step("pty: wait_for send reached the program", s.includes("got:hello"));
	step("pty: ANSI stripped", !s.includes("\u001B") && !s.includes("[31m"));
	step(
		"pty: CR overwrite and cursor-forward",
		s.split("\n").includes("progress 100%") &&
			!s.split("\n").some((l) => l.includes("progress 10%progress")) &&
			s.includes("a b"),
	);
	step("pty: time step sent", s.includes("second:x"));
	step(
		"pty: sent log order and timeout label",
		r.sent.map((x) => x.label).join(",") === "one,miss:timeout,two",
		r.sent.map((x) => x.label).join(","),
	);
	step(
		"pty: idx monotonic",
		r.idx.length > 0 &&
			r.idx.every((x, i) => i === 0 || x.off >= (r.idx[i - 1]?.off ?? 0)),
		`${r.idx.length} reads`,
	);
	return rebaseCheck(step, c, r.pid);
};

/** A slow start (2 s of silence) must not eat the "t" of a later step. */
const rebaseCheck = async (
	step: Step,
	c: Ctx,
	firstPid: number,
): Promise<void> => {
	const slow = join(c.dir, "slow.sh");
	await script(
		slow,
		"#!/bin/sh\nsleep 2\nprintf 'up> '\nread a\nprintf 'got:%s\\r\\n' \"$a\"\nsleep 30\n",
	);
	const rb = await runPty({
		cwd: c.dir,
		env: c.env,
		bin: slow,
		secs: 3,
		out: join(c.dir, "RAWSLOW"),
		schedule: [
			{ wait_for: "up>", timeout: 10, label: "up", rebase: true },
			{ t: 1, send: "x\r", label: "after" },
		],
	});
	const up = rb.sent.find((x) => x.label === "up")?.t ?? 0;
	const after = rb.sent.find((x) => x.label === "after")?.t ?? 0;
	step(
		"pty: rebase counts t from the rebased step",
		up > 0 && after - up >= 0.9 && rb.screen.includes("got:x"),
		`after - up = ${(after - up).toFixed(2)}s`,
	);
	step(
		"pty: program killed at the end",
		!alive(firstPid) && firstPid > 1,
		`pid ${firstPid}`,
	);
};

const rejects = async (run: () => Promise<unknown>): Promise<boolean> => {
	try {
		await run();
		return false;
	} catch {
		return true;
	}
};

const guardChecks = async (step: Step, c: Ctx): Promise<void> => {
	const marker = join(c.dir, "started");
	const sleeper = join(c.dir, "sleeper.sh");
	await script(
		sleeper,
		`#!/bin/sh\ntouch '${marker}'\ntrap '' HUP TERM INT\nsleep 30\n`,
	);
	const badThrew = await rejects(() =>
		runPty({
			cwd: c.dir,
			env: c.env,
			bin: sleeper,
			secs: 2,
			out: join(c.dir, "BAD"),
			schedule: [{ wait_for: "(unclosed", send: "x" }],
		}),
	);
	step(
		"pty: bad wait_for regex fails cleanly, nothing spawned",
		badThrew &&
			!(await pathExists(marker)) &&
			!(await pathExists(join(c.dir, "BAD.pid"))),
	);
	const relBinThrew = await rejects(() =>
		runPty({
			cwd: c.dir,
			env: c.env,
			bin: "sh",
			secs: 1,
			out: join(c.dir, "REL"),
		}),
	);
	step("pty: relative bin rejected", relBinThrew);
	const h = await runPty({
		cwd: c.dir,
		env: c.env,
		bin: sleeper,
		secs: 1.5,
		out: join(c.dir, "HUP"),
	});
	step(
		"pty: signal-ignoring program is killed",
		(await pathExists(marker)) && h.pid > 1 && !alive(h.pid),
		`pid ${h.pid}`,
	);
};

export const runPtySelftest = async (step: Step): Promise<void> => {
	const dir = await realpath(await mkdtemp(join(tmpdir(), "ccrel-ptyself-")));
	try {
		await writeSecurityShim(dir);
		const env = childEnv({
			home: dir,
			configDir: dir,
			baseUrl: "http://127.0.0.1:1/x",
			tty: true,
		});
		await mainChecks(step, { dir, env });
		await guardChecks(step, { dir, env });
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
};
