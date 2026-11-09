// Shared by run.test.ts and run-args.test.ts: fake "Claude Code" programs in a temp folder, and small readers.
import { chmod, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

/** A temp folder of its own for one test file, with a writer for executable `bun` scripts in it. */
export const createTmp = async () => {
	const dir = await mkdtemp(join(tmpdir(), "cc-run-test-"));
	let n = 0;
	return {
		cleanup: () => rm(dir, { recursive: true, force: true }),
		/** Write `body` as an executable script named `<prefix>-<n>` and return its path. */
		script: async (prefix: string, body: string) => {
			const bin = join(dir, `${prefix}-${n++}`);
			await writeFile(bin, body);
			await chmod(bin, 0o755);
			return bin;
		},
	};
};

/** The message the promise rejects with, or "resolved" when it does not reject. */
export const rejection = async (p: Promise<unknown>): Promise<string> => {
	try {
		await p;
		return "resolved";
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
};

/** True when the path exists. */
export const exists = async (path: string): Promise<boolean> => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

/** The JSON object in `line`. */
export const parsed = (line: string | undefined): Record<string, unknown> =>
	z.record(z.string(), z.unknown()).parse(JSON.parse(line ?? ""));

/** The lines of the `out.log` file the run wrote in the config folder. */
export const outLog = (r: { files: Record<string, string> }): string[] =>
	(r.files["out.log"] ?? "").split("\n");

/** The members of an object value. */
export const member = (value: unknown, key: string): unknown =>
	z.record(z.string(), z.unknown()).parse(value)[key];
