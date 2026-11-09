import { chmod } from "node:fs/promises";

import type { PtyRun } from "../harness.ts";

/** The program's debug log, which the cases write to `{CFG}/d.log`. */
export const log = (x: PtyRun): string => x.cfgFile("d.log");

export const lines = (x: PtyRun, re: RegExp): string =>
	log(x)
		.split("\n")
		.filter((l) => re.test(l))
		.map((l) => l.replace(/^\S+\s/u, "").slice(0, 300))
		.join("\n");

/** The last `n` non-empty screen lines. */
export const tail = (x: PtyRun, n: number): string =>
	x.screen
		.split("\n")
		.filter((l) => l.trim())
		.slice(-n)
		.join("\n");

/** A stand-in command for the program to run from PATH or BROWSER. */
export const writeExec = async (path: string, text: string): Promise<void> => {
	await Bun.write(path, text);
	await chmod(path, 0o755);
};
