// Run: bun test inspect/mcp/test/npm-text.test.ts
// `findText` and `dependenciesOf` on an unpacked package laid out as the cache keeps it.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dependenciesOf, findText } from "../src/npm.ts";

// The `${…}` search syntax and the template text of the package, built so no plain string holds a placeholder.
const D = "$";
const hole = `${D}{…}`;

let dir = "";
beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), "cc-inspect-text-"));
	await mkdir(join(dir, "package", "lib"), { recursive: true });
	await Bun.write(
		join(dir, "package", "package.json"),
		JSON.stringify({ dependencies: { "get-stream": "^9.0.0" } }),
	);
	await Bun.write(
		join(dir, "package", "lib", "a.js"),
		[
			"const MAX = 2 ** 32;",
			'const M = { NEED: `clientId is a required parameter. Set "ID".` };',
			`throw new RangeError(\`value must be >= 0 and <= ${D}{MAX - 1}. Received ${D}{v}\`);`,
			`throw new Error(\`${D}{name}: is unavailable. ${D}{M.NEED}\`);`,
			`throw new TypeError(\`Offset direction, ${D}{d}, must be "+" or "-"\`);`,
			'throw new TypeError("path must be absolute or specify root");',
		].join("\n"),
	);
});
afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

test("a text whose fragments sit in order is a plain match", async () => {
	const r = await findText(dir, `${hole}: is unavailable. ${hole}`);
	expect(r.file).toBe("package/lib/a.js");
	expect(r.loose).toBeUndefined();
});

test("a quoted plus sign is not taken for a string join", async () => {
	const r = await findText(
		dir,
		`Offset direction, ${hole}, must be "+" or "-"`,
	);
	expect(r.file).toBe("package/lib/a.js");
});

test("a whole match needs the text to be a whole string of the file", async () => {
	const plain = await findText(dir, "path must be absolute");
	expect(plain.file).toBe("package/lib/a.js");
	const whole = await findText(dir, "path must be absolute", true);
	expect(whole.file).toBeUndefined();
	const longer = await findText(
		dir,
		"path must be absolute or specify root",
		true,
	);
	expect(longer.file).toBe("package/lib/a.js");
	const holes = await findText(dir, `${hole}: is unavailable. ${hole}`, true);
	expect(holes.file).toBe("package/lib/a.js");
});

test("a number folded from a constant and an inlined string constant match by pieces", async () => {
	const folded = await findText(
		dir,
		`value must be >= 0 and <= 4294967295. Received ${hole}`,
	);
	expect(folded.loose).toBe(true);
	const inlined = await findText(
		dir,
		`${hole}: is unavailable. clientId is a required parameter. Set "ID".`,
	);
	expect(inlined.loose).toBe(true);
});

test("a text with a sentence the file lacks does not match", async () => {
	const r = await findText(
		dir,
		`${hole}: is unavailable. tenantId is a required parameter.`,
	);
	expect(r.file).toBeUndefined();
});

test("dependenciesOf reads the package.json of the unpacked package", async () => {
	expect(await dependenciesOf(dir)).toEqual({ "get-stream": "^9.0.0" });
});
