"""Pty driver for interactive probes. Stdlib only (no pyte, no tmux). Run with `python3 -I`.

  driver.py --cwd D --out RAW --secs N --env ENV.json [--schedule S.json] [--rows 50] [--cols 200] -- BIN [args...]

BIN must be an absolute path to an existing file. ENV.json (a JSON object of strings) is read and deleted before the
fork; the program is started with execve and exactly that env (nothing inherited, nothing in argv).

Schedule: JSON list of steps, run in order.
  {"t": 8.0, "send": "text\\r", "label": "x"}                         time-based: fires once N s have passed since start
  {"wait_for": "regex", "timeout": 20, "send": "...", "label": "x"}  output-based: regex on the rendered (ANSI-stripped)
                                                                       output produced since the previous step fired
                                                                       (matches output since the previous step);
                                                                       on timeout the step is logged as "<label>:timeout"
                                                                       and nothing is sent
`send` is used as decoded from JSON (no extra escape handling). When it is text followed by CR/LF, the text is sent,
the driver pumps output for 0.4 s, then sends the line end (prompt text, short pause, Enter).

Outputs: RAW (bytes), RAW.idx ("<epoch> <byte offset>" per read), RAW.sent ("<epoch> <label>" per send),
RAW.screen.txt (rendered text), RAW.pid (child pid, written right after fork).
The driver kills only its own child pid and that child's process group (the child is a session leader).
"""
import argparse
import fcntl
import json
import os
import pty
import re
import select
import signal
import struct
import sys
import termios
import time

ANSI = re.compile(
    r"\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\x1b[PX^_][^\x1b]*(?:\x1b\\)?|\x1b[=>()][A-Z0-9]?|\x1b[78MDEHc]"
)
CSI_FWD = re.compile(r"\x1b\[(\d*)C")
# Stands in for one cursor-forward step until the line is built: a terminal moves over the cells and leaves them as they are.
FWD = "\x1c"
# The full-screen UI moves down with CSI n B and jumps with CSI H / CSI r;c H: each becomes line breaks so rows stay apart.
CSI_DOWN = re.compile(r"\x1b\[(\d*)B")
CSI_HOME = re.compile(r"\x1b\[\d*(?:;\d*)?[Hf]")


def render(data: bytes) -> str:
    """Readable text: cursor-forward moves over the line (spaces past its end), cursor-down and home become line breaks, CR overwrites the line, other escapes are dropped, spaces collapse."""
    s = data.decode("utf8", "replace")
    s = CSI_FWD.sub(lambda m: FWD * int(m.group(1) or 1), s)
    s = CSI_DOWN.sub(lambda m: "\n" * min(int(m.group(1) or 1), 3), s)
    s = CSI_HOME.sub("\n", s)
    s = ANSI.sub("", s)
    lines = []
    cur = []
    col = 0
    for ch in s:
        if ch == "\n":
            lines.append("".join(cur))
            cur, col = [], 0
        elif ch == "\r":
            col = 0
        elif ch == "\b":
            col = max(0, col - 1)
        elif ch == FWD:
            if col >= len(cur):
                cur.append(" ")
            col += 1
        elif ch < " " and ch != "\t":
            continue
        else:
            if col < len(cur):
                cur[col] = ch
            else:
                cur.append(ch)
            col += 1
    lines.append("".join(cur))
    out = [re.sub(r"[ \t]+", " ", ln).strip() for ln in lines]
    return "\n".join(out)


stop = False


def on_term(_sig, _frm):
    global stop
    stop = True


def fail(msg: str) -> int:
    print(msg, file=sys.stderr)
    return 2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cwd", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--secs", type=float, required=True)
    ap.add_argument("--env", required=True)
    ap.add_argument("--schedule")
    ap.add_argument("--rows", type=int, default=50)
    ap.add_argument("--cols", type=int, default=200)
    ap.add_argument("cmd", nargs=argparse.REMAINDER)
    a = ap.parse_args()
    cmd = a.cmd[1:] if a.cmd and a.cmd[0] == "--" else a.cmd
    if not cmd:
        return fail("no command")
    if not os.path.isabs(cmd[0]) or not os.path.isfile(cmd[0]):
        return fail("bin must be an absolute path to an existing file: " + cmd[0])
    try:
        sched = json.load(open(a.schedule)) if a.schedule else []
        # Compile every regex before anything is spawned.
        rxs = [re.compile(st["wait_for"]) if "wait_for" in st else None for st in sched]
    except (OSError, ValueError, re.error, TypeError) as e:
        return fail("bad schedule: %s" % e)
    try:
        with open(a.env) as f:
            env = json.load(f)
    except (OSError, ValueError) as e:
        return fail("bad env file: %s" % e)
    finally:
        try:
            os.unlink(a.env)
        except OSError:
            pass
    if not isinstance(env, dict) or not all(isinstance(v, str) for v in env.values()):
        return fail("env must be an object of strings")

    signal.signal(signal.SIGTERM, on_term)
    signal.signal(signal.SIGINT, on_term)

    pid, fd = pty.fork()
    if pid == 0:
        try:
            os.chdir(a.cwd)
            os.execve(cmd[0], cmd, env)
        finally:
            os._exit(127)
    env = None
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", a.rows, a.cols, 0, 0))
    with open(a.out + ".pid", "w") as f:
        f.write(str(pid))

    raw = open(a.out, "wb")
    idx = open(a.out + ".idx", "w")
    sent = open(a.out + ".sent", "w")
    t0 = time.monotonic()
    buf = bytearray()
    eof = False
    code = None

    def record(d: bytes) -> None:
        raw.write(d)
        raw.flush()
        buf.extend(d)
        idx.write("%.3f %d\n" % (time.time(), raw.tell()))
        idx.flush()

    def pump(dt: float) -> bool:
        """Read output for up to dt seconds. Returns True if new data arrived."""
        nonlocal eof
        got = False
        end = time.monotonic() + dt
        while not eof and not stop:
            left = end - time.monotonic()
            if left <= 0:
                break
            r, _, _ = select.select([fd], [], [], min(0.02, left))
            if r:
                try:
                    d = os.read(fd, 65536)
                except OSError:
                    eof = True
                    break
                if not d:
                    eof = True
                    break
                got = True
                record(d)
        return got

    def log(label: str) -> None:
        sent.write("%.3f %s\n" % (time.time(), label))
        sent.flush()

    def send(txt: str, label: str) -> None:
        nonlocal eof
        body = txt.rstrip("\r\n")
        tail = txt[len(body):]
        try:
            if body and tail:
                os.write(fd, body.encode())
                log(label)
                pump(0.4)
                os.write(fd, tail.encode())
            else:
                os.write(fd, txt.encode())
                log(label)
        except OSError:
            eof = True

    def safe_mark(n: int) -> int:
        """Boundary for the next window: never inside a UTF-8 sequence or an unfinished escape."""
        while 0 < n < len(buf) and (buf[n] & 0xC0) == 0x80:
            n -= 1
        e = buf.rfind(b"\x1b", max(0, n - 64), n)
        if e >= 0 and not ANSI.match(buf[e:n].decode("latin1")):
            n = e
        return n

    try:
        mark = 0  # byte offset in buf where the current wait_for window starts
        for step, rx in zip(sched, rxs):
            if eof or stop:
                break
            label = step.get("label", "")
            if rx is not None:
                limit = time.monotonic() + float(step.get("timeout", 20))
                hit = False
                seen = -1
                while not eof and not stop:
                    if len(buf) != seen:  # re-render only when new data arrived
                        seen = len(buf)
                        if rx.search(render(bytes(buf[mark:]))):
                            hit = True
                            break
                    if time.monotonic() >= limit or time.monotonic() - t0 >= a.secs:
                        break
                    pump(0.05)
                if not hit:
                    log(label + ":timeout")
                    continue
            else:
                while not eof and not stop and time.monotonic() - t0 < float(step.get("t", 0)):
                    if time.monotonic() - t0 >= a.secs:
                        break
                    pump(0.02)
                if time.monotonic() - t0 >= a.secs:
                    break
            if eof or stop:
                break
            if step.get("rebase"):
                t0 = time.monotonic()  # later "t" and the "secs" deadline count from here (the READY screen)
            if "send" in step:
                send(step["send"], label)
            else:
                log(label)
            mark = safe_mark(len(buf))

        if not eof and not stop:
            pump(max(0.0, a.secs - (time.monotonic() - t0)))
    finally:
        # The schedule ends with /exit, so give the program a moment to leave on its own (it writes files on exit).
        # macOS holds an exiting process while the pty still has unread output: keep draining the master (into buf and
        # .idx, so the last frames reach screen.txt) until the child is reaped.
        def reap(limit: float) -> bool:
            nonlocal code
            end = time.monotonic() + limit
            while True:
                try:
                    wpid, st = os.waitpid(pid, os.WNOHANG)
                except OSError:
                    return True
                if wpid:
                    code = os.waitstatus_to_exitcode(st)
                    return True
                if time.monotonic() >= end:
                    return False
                try:
                    r, _, _ = select.select([fd], [], [], 0.05)
                    if r:
                        d = os.read(fd, 65536)
                        if d:
                            record(d)
                except OSError:
                    time.sleep(0.05)

        # Kill only our own child and its group (the child is a session leader, pgid == pid).
        def kill_own(sig: int) -> None:
            for kill in (lambda s: os.killpg(pid, s), lambda s: os.kill(pid, s)):
                try:
                    kill(sig)
                except OSError:
                    pass

        if not reap(0.0 if stop else 2.0):
            kill_own(signal.SIGTERM)
            if not reap(3.0):
                kill_own(signal.SIGKILL)
                reap(10.0)
        raw.close()
        idx.close()
        sent.close()
        with open(a.out + ".screen.txt", "w") as f:
            f.write(render(bytes(buf)) + "\n")
    print(json.dumps({"pid": pid, "elapsed": round(time.monotonic() - t0, 3), "exit": code, "eof": eof}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
