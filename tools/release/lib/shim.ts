// Probe shim: the program shells out to `security` by bare name on macOS. With a temp HOME there is no
// keychain, and macOS shows a modal "Keychain Not Found" dialog. A shim first on PATH answers "not found".
import { chmod, mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

import { pathExists } from "./fs.ts";

export const SHIM_DIR = ".probe-bin";
/** errSecItemNotFound */
export const SHIM_NOT_FOUND = 44;

const SECURITY_SHIM = `#!/bin/sh
# Probe shim: no keychain access. 44 = errSecItemNotFound.
[ "$1" = "-i" ] && cat >/dev/null
exit 44
`;

/** Pure: the shim dir for a home. Env builders use this; they never touch the disk. */
export const shimDir = (home: string): string => join(home, SHIM_DIR);

/** Writes <home>/.probe-bin/security (executable), idempotent. Call where the temp home is created. */
export const writeSecurityShim = async (home: string): Promise<string> => {
	const dir = shimDir(home);
	await mkdir(dir, { recursive: true });
	const file = join(dir, "security");
	await Bun.write(file, SECURITY_SHIM);
	await chmod(file, 0o755);
	return dir;
};

/** Guard right before a spawn: the first PATH entry must be a shim dir holding `security`. */
export const assertShimReady = async (
	env: Record<string, string>,
): Promise<void> => {
	const first = (env["PATH"] ?? "").split(":")[0] ?? "";
	if (
		basename(first) !== SHIM_DIR ||
		!(await pathExists(join(first, "security")))
	) {
		throw new Error(
			`security shim missing: expected ${join(first === "" ? "<PATH entry>" : first, "security")}; refusing to spawn (macOS would show a Keychain dialog)`,
		);
	}
};
