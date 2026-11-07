import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { listInstalls } from "../../inspect/mcp/src/binary.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { audit } from "./audit.ts";

const installed = listInstalls().some((i) => i.version === CLAUDE_CODE_VERSION);

const item = (kind: string, name: string, detail?: string) => ({
  kind,
  name,
  module: "none",
  offset: null,
  detail,
  version: CLAUDE_CODE_VERSION,
});

/** A repo root with a three-item surface, a sweep, and the exclusions to audit. No network is used. */
const fixture = (exclusions: Record<string, string>) => {
  const root = mkdtempSync(join(tmpdir(), "audit-"));
  const put = (path: string, data: unknown) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(
      join(root, path),
      typeof data === "string" ? data : JSON.stringify(data),
    );
  };
  const v = `captures/${CLAUDE_CODE_VERSION}`;
  put(`${v}/surface.json`, {
    kinds: {
      env: [item("env", "QUIET_A", "listed"), item("env", "LOUD_B", "listed")],
      file: [item("file", "zzq-no-such-file.md")],
      tool: [item("tool", "zzq_listed"), item("tool", "zzq_unlisted")],
    },
  });
  put(`${v}/print/sweep.json`, {
    data: {
      skipped: [],
      "QUIET_A.A": [],
      "QUIET_A.B": [],
      "LOUD_B.A": ["x"],
      "LOUD_B.B": [],
    },
  });
  put(`${v}/print/tools.json`, { tools: JSON.stringify(["zzq_listed"]) });
  put("tools/surface/exclusions.json", exclusions);
  put("docs/reference/api/endpoints.md", "");
  return root;
};

test.skipIf(!installed)(
  "each entry gets the check of its kind and reason, and a rerun is identical",
  async () => {
    const root = fixture({
      "env:QUIET_A": "Named in the program's table",
      "env:LOUD_B": "Named in the program's table",
      "env:GONE_C": "Named in the program's table",
    });
    const first = await audit(CLAUDE_CODE_VERSION, root);
    const by = Object.fromEntries(first.entries.map((e) => [e.key, e]));
    expect(by["env:QUIET_A"]).toMatchObject({
      check: "env-listed",
      result: "pass",
    });
    expect(by["env:LOUD_B"]).toMatchObject({
      check: "env-listed",
      result: "fail",
    });
    expect(by["env:GONE_C"]).toMatchObject({ check: "stale", result: "fail" });
    expect(JSON.stringify(await audit(CLAUDE_CODE_VERSION, root))).toBe(
      JSON.stringify(first),
    );
  },
);

test.skipIf(!installed)(
  "a Changes reason needs a changed sweep, and a file reason needs the matching mention state",
  async () => {
    const root = fixture({
      "env:QUIET_A": "Changes the request when set.",
      "env:LOUD_B": "Changes the request when set.",
      "file:zzq-no-such-file.md": "Named in a message of the program.",
    });
    const by = Object.fromEntries(
      (await audit(CLAUDE_CODE_VERSION, root)).entries.map((e) => [e.key, e]),
    );
    expect(by["env:QUIET_A"]).toMatchObject({
      check: "env-sweep-changed",
      result: "fail",
    });
    expect(by["env:LOUD_B"]).toMatchObject({
      check: "env-sweep-changed",
      result: "pass",
    });
    expect(by["file:zzq-no-such-file.md"]).toMatchObject({
      check: "file-named-in-text",
      result: "fail",
    });
  },
);

test.skipIf(!installed)(
  "a tool that a print capture lists is defined, though no name literal builds it",
  async () => {
    const root = fixture({
      "tool:zzq_listed": "Not defined in the program.",
      "tool:zzq_unlisted": "Not defined in the program.",
    });
    const by = Object.fromEntries(
      (await audit(CLAUDE_CODE_VERSION, root)).entries.map((e) => [e.key, e]),
    );
    expect(by["tool:zzq_listed"]).toMatchObject({
      check: "tool-not-defined",
      result: "fail",
    });
    expect(by["tool:zzq_unlisted"]).toMatchObject({
      check: "tool-not-defined",
      result: "pass",
    });
  },
);
