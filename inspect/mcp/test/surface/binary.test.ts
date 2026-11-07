import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listInstalls, program } from "../../src/binary.ts";
import { Resolver } from "../../src/resolve.ts";
import { surface } from "../../src/surface/index.ts";
import { baseTools } from "../../src/tools.ts";

const installs = listInstalls();
const has = installs.some((i) => i.version === "2.1.309");

describe.skipIf(!has)("installed binary 2.1.309", () => {
  const p = has ? program("2.1.309") : (undefined as never);
  const b = p?.bundle;
  const get = (kind: string) => surface(b, kind, p.modules).map((i) => i.name);

  test("tool: the names of tool-gates", () => {
    const n = get("tool");
    expect(n).toEqual(
      [
        ...new Set(baseTools(b, new Resolver()).tools.map((t) => t.name)),
      ].sort(),
    );
    expect(n).toContain("Bash");
    expect(n).toContain("Agent");
  }, 300_000);

  test("otel-event", () => {
    const n = get("otel-event");
    expect(n).toContain("tool_result");
    expect(n).toContain("api_error");
  }, 300_000);

  test("mod-api", () => {
    const n = get("mod-api");
    expect(n).toContain("$.agent.spawn");
    expect(n).toContain("tool.check");
    expect(n.filter((x) => x.startsWith("classic."))).toHaveLength(33);
  }, 300_000);

  test("env", () => {
    expect(get("env")).toContain("CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK");
  }, 300_000);

  test("hook-event", () => {
    const n = get("hook-event");
    expect(n).toContain("PreToolUse");
    expect(n).toContain("SessionStart");
    expect(n).toHaveLength(33);
  }, 300_000);

  test("setting", () => {
    const n = get("setting");
    expect(n).toContain("permissions");
    expect(n).toHaveLength(194);
  }, 300_000);

  test("gate", () => {
    const n = get("gate");
    expect(n).toContain("tengu_calm_eagle");
    expect(new Set(n).size).toBe(1101);
  }, 300_000);

  test("flag", () => {
    const n = get("flag");
    expect(n).toContain("--model");
    expect(n).toContain("--debug");
  }, 300_000);

  test("subcommand", () => {
    const n = get("subcommand");
    expect(n).toContain("mcp");
    expect(n).toContain("auth login");
  }, 300_000);

  test("slash-command", () => {
    const n = get("slash-command");
    expect(n).toContain("/compact");
    expect(n).toContain("/model");
  }, 300_000);

  test("keybinding", () => {
    const n = get("keybinding");
    expect(n).toContain("chat:cancel");
    expect(n).toContain("Global");
  }, 300_000);

  test("model", () => {
    const n = get("model");
    expect(n).toContain("claude-opus-4-6");
    expect(n).toContain("claude-sonnet-4-5");
    expect(n).toContain("opusplan");
  }, 300_000);

  test("beta: the names of the docs page", () => {
    const n = get("beta");
    for (const b of [
      "context-1m-2025-08-07",
      "claude-code-20250219",
      "oauth-2025-04-20",
      "interleaved-thinking-2025-05-14",
      "ccr-byoc-2025-07-29",
      "afk-mode-2026-01-31",
      "token-counting-2024-11-01",
    ])
      expect(n).toContain(b);
    expect(n).not.toContain("bedrock-2023-05-31");
    expect(
      surface(b, "beta", p.modules).find(
        (i) => i.name === "context-1m-2025-08-07",
      )?.detail,
    ).toBe("long_context");
  }, 300_000);

  test("endpoint", () => {
    const n = get("endpoint");
    expect(n).toContain("https://api.anthropic.com");
    expect(n).toContain("https://api.anthropic.com/api/event_logging/v2/batch");
    expect(n).toContain("/api/oauth/profile");
    expect(n).toContain("/api/hello");
    // Paths from the docs endpoint table (docs/reference/api/endpoints.md).
    for (const p of [
      "/v1/messages/count_tokens",
      "/api/oauth/usage",
      "/api/claude_code/policy_limits",
      "/api/event_logging/v2/batch",
      "/v1/traces",
    ])
      expect(n).toContain(p);
  }, 300_000);

  test("file", () => {
    const n = get("file");
    expect(n).toContain("keybindings.json");
    expect(n).toContain("history.jsonl");
    expect(n).toContain("policy-limits.json");
  }, 300_000);

  test("permission-rule: the modes of the docs page", () => {
    expect(get("permission-rule")).toEqual([
      "acceptEdits",
      "auto",
      "bypassPermissions",
      "default",
      "dontAsk",
      "plan",
    ]);
  }, 300_000);

  test("error", () => {
    const n = get("error");
    console.log(`error items on 2.1.309: ${n.length}`);
    expect(n).toContain("Not connected");
    expect(n.some((x) => x.startsWith("Cloud gateway"))).toBe(true);
    expect(n.every((x) => x.length >= 10 && x.includes(" "))).toBe(true);
  }, 300_000);
});

// The generated managed-settings schema comes from running the program's zod validators, so its nested
// property paths are an oracle for the `setting-key` walk of the same version's code.
const schema = JSON.parse(
  readFileSync(
    join(
      import.meta.dir,
      "../../../../schemas/claude-code-managed-settings.json",
    ),
    "utf8",
  ),
);
const schemaVersion = /Claude Code ([\d.]+)\)/.exec(schema.title)?.[1];
const hasSchema = installs.some((i) => i.version === schemaVersion);

describe.skipIf(!hasSchema)("setting-key against the generated schema", () => {
  test("names every nested leaf property path of the schema, and no other", () => {
    const paths = new Set<string>();
    type Node = {
      $ref?: string;
      anyOf?: Node[];
      oneOf?: Node[];
      allOf?: Node[];
      properties?: Record<string, Node>;
      additionalProperties?: Node | boolean;
    };
    const walk = (n: Node | undefined, path: string) => {
      if (!n || typeof n !== "object") return;
      const ref = n.$ref?.split("/").pop();
      if (ref) walk(schema.$defs?.[ref] ?? schema.definitions?.[ref], path);
      for (const x of [
        ...(n.anyOf ?? []),
        ...(n.oneOf ?? []),
        ...(n.allOf ?? []),
      ])
        walk(x, path);
      for (const [k, v] of Object.entries(n.properties ?? {})) {
        const q = path ? `${path}.${k}` : k;
        if (path) paths.add(q);
        walk(v, q);
      }
      if (typeof n.additionalProperties === "object")
        walk(n.additionalProperties, `${path}.*`);
    };
    walk(schema, "");
    const p = program(schemaVersion);
    const got = surface(p.bundle, "setting-key", p.modules).map((i) => i.name);
    const leaves = [...paths].filter(
      (q) => ![...paths].some((o) => o.startsWith(`${q}.`)),
    );
    expect(got).toEqual(leaves.sort());
  }, 300_000);
});
