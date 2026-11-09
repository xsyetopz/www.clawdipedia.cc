// `strings -a` dump of a Claude Code binary, cached at captures/<version>/strings.txt (gitignored, tens of MB).
import { rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { pathExists } from "../lib/fs.ts";
import { binaryPath, toolEnv, versionDir } from "../util.ts";

export const stringsPath = (version: string): string =>
	join(versionDir(version), "strings.txt");

const statOf = async (path: string) =>
	(await pathExists(path)) ? stat(path) : undefined;

/** Dump (or reuse) the strings of one version. The binary is only read. Returns the dump path. */
export const dumpStrings = async (
	version: string,
	force = false,
): Promise<string> => {
	const bin = binaryPath(version);
	const out = stringsPath(version);
	const dump = await statOf(out);
	const binary = await statOf(bin);
	const cached = dump !== undefined && dump.size > 0;
	if (binary === undefined) {
		// an old binary may be gone while its dump is still on disk
		if (cached) {
			return out;
		}
		throw new Error(`no binary for ${version} at ${bin}`);
	}
	if (!force && cached && dump.mtimeMs >= binary.mtimeMs) {
		return out;
	}
	// a failed run never leaves a half dump under the real name
	const tmp = `${out}.tmp`;
	try {
		const p = Bun.spawn(["strings", "-a", bin], {
			env: toolEnv(),
			stdout: Bun.file(tmp),
			stderr: "pipe",
		});
		const stderr = await new Response(p.stderr).text();
		const code = await p.exited;
		if (code !== 0) {
			throw new Error(`strings failed (${code}): ${stderr}`);
		}
		await rename(tmp, out);
	} catch (error) {
		await rm(tmp, { force: true });
		throw error;
	}
	return out;
};
