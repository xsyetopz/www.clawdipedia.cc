import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { extractEnv } from "../../../diff/extract.ts";
import { dumpStrings } from "../../../diff/strings.ts";
import { assertSafeEnv } from "../../../lib/env.ts";
import { arr, obj } from "../run.ts";

/** Names the sweep cannot set safely: fixed child env keys, and anything childEnv refuses (credentials). */
export const unsettable = (name: string, fixed: Set<string>): string | null => {
	if (fixed.has(name)) {
		return "fixed by childEnv";
	}
	try {
		assertSafeEnv({ [name]: "1" });
	} catch {
		return "credential-shaped name";
	}
	return null;
};

// The strings extractor misses names that only the AST finds (helper chains, tables), so the surface list joins it.
export const sweepNames = async (version: string): Promise<string[]> => {
	const file = join(
		import.meta.dir,
		"../../../../..",
		"captures",
		version,
		"surface.json",
	);
	const surface: unknown = await Bun.file(file).json();
	const surfaceNames = arr(obj(obj(surface)["kinds"])["env"])
		.map((i) => obj(i)["name"])
		.filter((n) => typeof n === "string");
	const dump = await dumpStrings(version);
	return [
		...new Set([
			...extractEnv(await readFile(dump, "latin1")).keys(),
			...surfaceNames,
		]),
	];
};
