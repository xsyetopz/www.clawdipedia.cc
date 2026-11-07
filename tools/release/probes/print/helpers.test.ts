// Run: bun test tools/release/probes/print/helpers.test.ts
import { expect, test } from "bun:test";
import { olderThan } from "./run/helpers.ts";
import type { PrintCtx } from "./types.ts";

const at = (version: string): PrintCtx => ({
  version,
  bin: "",
  runDir: "",
  dry: true,
});

test("an older version may accept a missing feature; the first version with it and later may not", () => {
  expect(olderThan(at("2.1.316"), "2.1.319")).toBe(true);
  expect(olderThan(at("2.1.319"), "2.1.319")).toBe(false);
  expect(olderThan(at("2.1.320"), "2.1.319")).toBe(false);
});

test("versions compare by number, not by text", () => {
  expect(olderThan(at("2.1.99"), "2.1.317")).toBe(true);
  expect(olderThan(at("2.1.1000"), "2.1.317")).toBe(false);
});
