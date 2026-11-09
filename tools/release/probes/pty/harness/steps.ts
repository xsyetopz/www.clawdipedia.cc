// Schedule pieces and helper scripts of the pty harness: hook and status line scripts, phrase matching, common steps.
import { join } from "node:path";

import { PROMPT } from "../../../lib/env.ts";
import type { PtyStep } from "../../../lib/pty/driver.ts";
import type { Files } from "../../../lib/sandbox.ts";
import type { Obj, PtyRun } from "./types.ts";

/** The hook logging helper. Writes <epoch.ms> <stdin JSON> into {HOME}/hooklog/<Event>.log (never /tmp). */
export const HOOK_SH = `#!/bin/bash
# hook.sh <Event>: log stdin JSON, print ctl/<Event> if present, exit with ctl/<Event>.exit
E=$1; D="$HOME/hooklog"; mkdir -p "$D/ctl"
IN=$(cat)
T=$(/usr/bin/perl -MTime::HiRes=time -e 'printf "%.3f", time')
printf '%s %s\\n' "$T" "$IN" >> "$D/$E.log"
[ -f "$D/ctl/$E" ] && cat "$D/ctl/$E"
[ -f "$D/ctl/$E.exit" ] && exit "$(cat "$D/ctl/$E.exit")"
exit 0
`;
/** Status line helper: logs one row per call (time, env, stdin) and prints rows. Kind "sub" prints one row per task. */
export const SL_SH = `#!/bin/bash
# sl.sh <kind>: log invocation (time, env, stdin) and print a row
K=$1; D="$HOME/sllog"; mkdir -p "$D"
IN=$(cat)
T=$(/usr/bin/perl -MTime::HiRes=time -e 'printf "%.3f", time')
printf '%s ENV COLUMNS=%s LINES=%s CLAUDECODE=%s CHILD=%s\\n%s\\n' "$T" "$COLUMNS" "$LINES" "$CLAUDECODE" "$CLAUDE_CODE_CHILD_SESSION" "$IN" >> "$D/$K.log"
if [ "$K" = sub ]; then
  echo "$IN" | /usr/bin/python3 -c 'import sys,json;d=json.load(sys.stdin);[print(json.dumps({"id":t["id"],"content":"SUBROW "+t["status"]})) for t in d.get("tasks",[])]'
else
  echo "SL-ROW1"; echo "SL-ROW2"
fi
`;

/** A hook entry that runs the helper for one event. */
export const hookCmd = (event: string, matcher?: string): Obj => ({
	...(matcher === undefined ? {} : { matcher }),
	hooks: [{ type: "command", command: `/bin/bash {HOME}/hook.sh ${event}` }],
});
export const hooks = (events: string[]): Obj => ({
	hooks: Object.fromEntries(events.map((e) => [e, [hookCmd(e)]])),
});

/** Regex text for a phrase on the rendered screen: the full-screen UI drops some spaces, so allow any between characters. */
export const looseSrc = (s: string): string =>
	s
		.replaceAll(/\s+/gu, "")
		.split("")
		.map((c) => (/[\\^$.*+?()[\]{}|/]/u.test(c) ? `\\${c}` : c))
		.join(String.raw`\s*`);
export const loose = (s: string): RegExp => new RegExp(looseSrc(s), "iu");
/** Regex for a phrase that also accepts one missing letter (phrases of 8 or more letters).
 * The screen text is every redraw in a row, and a redraw writes only the changed cells, so single letters go missing ("Inerrupted"). */
export const tolerant = (phrase: string, flags = "i"): RegExp => {
	const p = phrase.replaceAll(/\s+/gu, "");
	const alts = [looseSrc(p)];
	if (p.length >= 8) {
		for (let i = 0; i < p.length; i++) {
			alts.push(looseSrc(p.slice(0, i) + p.slice(i + 1)));
		}
	}
	return new RegExp(alts.join("|"), flags);
};
/** Does the screen (the whole rendered screen unless given) show this phrase? */
export const shows = (
	x: PtyRun,
	phrase: string,
	screen: string = x.screen,
): boolean => tolerant(phrase).test(screen);

/** Common schedule pieces. */
export const READY: PtyStep = {
	wait_for: String.raw`shortcuts|auto\s*mode`,
	timeout: 30,
	label: "ready",
	// every later `t` and the `secs` deadline count from the READY screen, not from spawn
	rebase: true,
};
export const ASK = (label = "prompt", t = 0): PtyStep => ({
	t,
	send: `${PROMPT}\r`,
	label,
});
export const WAIT = (phrase: string, label: string, timeout = 20): PtyStep => ({
	wait_for: looseSrc(phrase),
	timeout,
	label,
});
export const ESC = (t: number, label = "esc"): PtyStep => ({
	t,
	send: "\u001B",
	label,
});

/** A wait_for step that matches any of several phrases (spaces ignored, one missing letter accepted, see tolerant). */
export const waitAny = (
	phrases: string[],
	label: string,
	timeout = 20,
): PtyStep => ({
	wait_for: phrases.map((p) => tolerant(p).source).join("|"),
	timeout,
	label,
});
/** The Bash tool turn the stub sends: a harmless `touch` inside the sandbox home. */
export const TOUCH = (name: string, command?: string) => ({
	seq: [
		{
			name: "Bash",
			input: {
				command: command ?? `touch {HOME}/${name}`,
				description: `probe ${name}`,
			},
		},
	],
});
/** Project `.mcp.json` for the elicitation server (this repo's mcp-elicit.ts run by the same Bun as the toolkit). */
export const ELICIT_MCP: Files = {
	".mcp.json": JSON.stringify({
		mcpServers: {
			probe: {
				command: process.execPath,
				args: [join(import.meta.dir, "..", "mcp-elicit.ts")],
				env: { ELICIT_LOG: "{HOME}/mcp.log" },
			},
		},
	}),
};
