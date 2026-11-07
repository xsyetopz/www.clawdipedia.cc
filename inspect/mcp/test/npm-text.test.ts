// Run: bun test inspect/mcp/test/npm-text.test.ts
// `findText` and `dependenciesOf` on an unpacked package laid out as the cache keeps it.
// biome-ignore-all lint/suspicious/noTemplateCurlyInString: the strings are package source text and the `${…}` search syntax
import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dependenciesOf, findText } from "../src/npm.ts";

const dir = mkdtempSync(join(tmpdir(), "cc-inspect-text-"));
mkdirSync(join(dir, "package", "lib"), { recursive: true });
writeFileSync(
  join(dir, "package", "package.json"),
  JSON.stringify({ dependencies: { "get-stream": "^9.0.0" } }),
);
writeFileSync(
  join(dir, "package", "lib", "a.js"),
  [
    "const MAX = 2 ** 32;",
    'const M = { NEED: `clientId is a required parameter. Set "ID".` };',
    "throw new RangeError(`value must be >= 0 and <= ${MAX - 1}. Received ${v}`);",
    "throw new Error(`${name}: is unavailable. ${M.NEED}`);",
    'throw new TypeError(`Offset direction, ${d}, must be "+" or "-"`);',
    'throw new TypeError("path must be absolute or specify root");',
  ].join("\n"),
);
afterAll(() => rmSync(dir, { recursive: true, force: true }));

test("a text whose fragments sit in order is a plain match", () => {
  const r = findText(dir, "${…}: is unavailable. ${…}");
  expect(r.file).toBe("package/lib/a.js");
  expect(r.loose).toBeUndefined();
});

test("a quoted plus sign is not taken for a string join", () => {
  expect(findText(dir, 'Offset direction, ${…}, must be "+" or "-"').file).toBe(
    "package/lib/a.js",
  );
});

test("a whole match needs the text to be a whole string of the file", () => {
  expect(findText(dir, "path must be absolute").file).toBe("package/lib/a.js");
  expect(findText(dir, "path must be absolute", true).file).toBeUndefined();
  expect(
    findText(dir, "path must be absolute or specify root", true).file,
  ).toBe("package/lib/a.js");
  expect(findText(dir, "${…}: is unavailable. ${…}", true).file).toBe(
    "package/lib/a.js",
  );
});

test("a number folded from a constant and an inlined string constant match by pieces", () => {
  expect(
    findText(dir, "value must be >= 0 and <= 4294967295. Received ${…}").loose,
  ).toBe(true);
  expect(
    findText(
      dir,
      '${…}: is unavailable. clientId is a required parameter. Set "ID".',
    ).loose,
  ).toBe(true);
});

test("a text with a sentence the file lacks does not match", () => {
  expect(
    findText(dir, "${…}: is unavailable. tenantId is a required parameter.")
      .file,
  ).toBeUndefined();
});

test("dependenciesOf reads the package.json of the unpacked package", () => {
  expect(dependenciesOf(dir)).toEqual({ "get-stream": "^9.0.0" });
});
