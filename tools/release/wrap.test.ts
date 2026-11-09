import { expect, test } from "bun:test";

import { versionDir } from "./util.ts";
import { schemaGenerators } from "./wrap.ts";

test("release:schemas regenerates the code-derived schemas with the probes of --from", () => {
	const scripts = schemaGenerators("/bin/claude", "2.1.319");
	expect(scripts.map((a) => a[1])).toEqual([
		"tools/schemas/generate.ts",
		"tools/schemas/code.ts",
		"tools/schemas/types.ts",
	]);
	expect(scripts[1]).toEqual([
		process.execPath,
		"tools/schemas/code.ts",
		"--bin",
		"/bin/claude",
		"--captures",
		versionDir("2.1.319"),
	]);
});
