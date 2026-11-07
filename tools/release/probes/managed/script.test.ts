// Run: bun test tools/release/probes/managed/script.test.ts
import { expect, test } from "bun:test";
import { defsFor } from "./phases.ts";
import { installScript } from "./script.ts";

const ctx = { version: "0", bin: "claude", startedLog: "/dev/null", dry: true };

test("the owned variant gives the folder to the sudo user after the root chown", () => {
  const s = installScript("/tmp/stage");
  expect(s).toContain("for V in main true false owned; do");
  expect(s.indexOf('chown -R "${SUDO_USER:?')).toBeGreaterThan(
    s.indexOf("chown -R root:wheel"),
  );
  expect(s).toContain('if [ "$V" = owned ]; then');
});

test("the owned phase runs only the CLAUDE.md case that records the note", () => {
  expect(defsFor("owned", ctx).map((d) => d.name)).toEqual(["claudemd-order"]);
});
