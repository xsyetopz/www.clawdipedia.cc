// Usage: bun tools/schemas/generate.ts [--bin <path-to-claude-binary>]
// Regenerates schemas/*.json from the zod validators embedded in the Claude Code binary (design D1, method A).
// Safety: the binary is only read. Its embedded modules are written to a temp dir, a capture line is appended to
// four of them, and a child bun process imports them with a fake key, a dead proxy, no real HOME, and no network.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { buildFiles } from "./build.ts";
import { findBinary, runCapture } from "./capture.ts";
import { CAPTURES } from "./captures.ts";
import { formatJson } from "./format.ts";
import { PAYLOAD_CAPTURES } from "./payloads/capture.ts";

const ROOT = join(import.meta.dir, "..", "..");
const SCHEMAS = join(ROOT, "schemas");

const { raw, lossy, found } = await runCapture(await findBinary(), [
	...CAPTURES,
	...PAYLOAD_CAPTURES
]);
await mkdir(SCHEMAS, { recursive: true });
const files = buildFiles(raw, CLAUDE_CODE_VERSION);
// Format as `bun fmt` does so regenerating leaves a clean diff.
await Promise.all(
	Object.entries(files).map(async ([name, json]) => {
		const path = join(SCHEMAS, name);
		await Bun.write(path, await formatJson(json, path));
	})
);
for (const l of lossy) {
	console.info(`  not representable (emitted as {}): ${l}`);
}
console.info(`wrote ${Object.keys(files).length} schemas to ${SCHEMAS}`);
for (const [kind, mod] of found) {
	console.info(`  ${kind}: captured from ${mod}`);
}
