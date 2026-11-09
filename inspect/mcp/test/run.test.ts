// Run: bun test inspect/mcp/test/run.test.ts
// A fake "Claude Code" script sends one Messages request to ANTHROPIC_BASE_URL, as the program does in print mode.
import { afterAll, expect, test } from "bun:test";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPrompt, userText } from "../src/run.ts";

const tmp = mkdtempSync(join(tmpdir(), "cc-run-test-"));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

let n = 0;
const fakeProgram = (
  o: {
    key?: string;
    host?: string;
    hang?: boolean;
    say?: string;
    big?: boolean;
  } = {},
) => {
  const bin = join(tmp, `claude-${n++}`);
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
${o.say ? `process.stderr.write(${JSON.stringify(o.say)});` : ""}
${o.hang ? 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);' : ""}
console.log(JSON.stringify({ type: "system", subtype: "init" }));
${o.big ? 'const b = Buffer.from(JSON.stringify({ type: "assistant", text: "é".repeat(300000) }) + "\\n" + JSON.stringify({ type: "result" }) + "\\n"); await Bun.write(Bun.stdout, b.subarray(0, 1001)); await Bun.sleep(300); await Bun.write(Bun.stdout, b.subarray(1001));' : ""}
const prompt = process.argv[process.argv.indexOf("-p") + 1];
const sec = Bun.spawnSync(["security", "find-generic-password"]).exitCode;
const skill = process.env.TMPDIR.replace(/\\/$/, "") + "/bundled-skills/9.9.9/abc123/x";
const env = Object.keys(process.env).filter((k) => /^(ANTHROPIC|PROBE|AWS)_/.test(k)).sort().join(",");
await fetch(process.env.ANTHROPIC_BASE_URL + "/v1/messages?beta=true", {
  method: "POST",
  headers: { "x-api-key": ${JSON.stringify(o.key ?? "sk-ant-fake-probe")}, "content-type": "application/json"${o.host ? `, host: ${JSON.stringify(o.host)}` : ""} },
  body: JSON.stringify({ stream: true, messages: [{ role: "user", content: [
    { type: "text", text: "<system-reminder>left out</system-reminder>" },
    { type: "text", text: "<command-name>/x</command-name>\\n" + prompt + "\\n" },
    { type: "text", text: "Base: " + skill + " cwd: " + process.cwd() + " home: " + process.env.HOME + " security: " + sec + " env: " + env },
  ] }] }),
}).then((r) => r.text());
`,
  );
  chmodSync(bin, 0o755);
  return bin;
};
const runDirs = () =>
  readdirSync(tmpdir()).filter((d) => d.startsWith("cc-run-"));

test("run keeps the user turn from the marked block, with temp folders as placeholders", async () => {
  process.env["ANTHROPIC_AUTH_TOKEN"] = "not-for-the-program";
  try {
    const r = await runPrompt(fakeProgram(), "/x ARG");
    expect(r.exit).toBe(0);
    expect(r.requests.map((q) => q.path)).toEqual(["/v1/messages?beta=true"]);
    expect(r.events).toEqual([{ type: "system", subtype: "init" }]);
    expect(userText(r, "<command-name>/x</command-name>")).toBe(
      "<command-name>/x</command-name>\n/x ARG\n\nBase: <bundled-skill-dir>/x cwd: <project-dir> home: <home> security: 44 env: ANTHROPIC_API_KEY,ANTHROPIC_BASE_URL,AWS_EC2_METADATA_DISABLED",
    );
    for (const d of Object.values(r.dirs)) expect(existsSync(d)).toBe(false);
  } finally {
    delete process.env["ANTHROPIC_AUTH_TOKEN"];
  }
});

test("userText is null when no user turn holds the mark", async () => {
  const r = await runPrompt(fakeProgram(), "/x ARG");
  expect(userText(r, "<command-name>/y</command-name>")).toBeNull();
});

test("run fails on another key or host, and removes its folders", async () => {
  const before = runDirs();
  await expect(
    runPrompt(fakeProgram({ key: "sk-ant-other-key" }), "/x ARG"),
  ).rejects.toThrow("another host or key");
  await expect(
    runPrompt(fakeProgram({ host: "127.0.0.1.attacker.test" }), "/x ARG"),
  ).rejects.toThrow("another host or key");
  expect(runDirs()).toEqual(before);
});

test("run kills a program that ignores SIGTERM and reports the timeout with its stderr", async () => {
  await expect(
    runPrompt(
      fakeProgram({ hang: true, say: "stuck at step 3" }),
      "/x ARG",
      undefined,
      1500,
    ),
  ).rejects.toThrow(
    /did not end in 1500 ms; events: system\/init.*stuck at step 3/s,
  );
});

test("run passes extra env to the program", async () => {
  const r = await runPrompt(fakeProgram(), "/x ARG", undefined, undefined, {
    PROBE_FLAG: "1",
  });
  expect(userText(r, "<command-name>/x</command-name>")).toContain(
    "env: ANTHROPIC_API_KEY,ANTHROPIC_BASE_URL,AWS_EC2_METADATA_DISABLED,PROBE_FLAG",
  );
});

test("run refuses extra env that would undo the safety setup or carry a credential", async () => {
  for (const k of [
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_BEDROCK_BASE_URL",
    "ANTHROPIC_CUSTOM_HEADERS",
    "AWS_ENDPOINT_URL",
    "HTTPS_PROXY",
    "https_proxy",
    "ALL_PROXY",
    "NODE_OPTIONS",
    "BUN_OPTIONS",
    "DYLD_INSERT_LIBRARIES",
    "HOME",
    "AWS_SECRET_ACCESS_KEY",
    "CLAUDE_CODE_OAUTH_TOKEN",
  ])
    await expect(
      runPrompt(fakeProgram(), "/x ARG", undefined, undefined, { [k]: "1" }),
    ).rejects.toThrow(`env ${k}`);
});

test("run refuses an env value shaped like an Anthropic key", async () => {
  await expect(
    runPrompt(fakeProgram(), "/x ARG", undefined, undefined, {
      PROBE_X: "sk-ant-api03-zzz",
    }),
  ).rejects.toThrow("env PROBE_X");
});

test("run keeps every stdout event, with multibyte text split across chunks intact", async () => {
  const r = await runPrompt(fakeProgram({ big: true }), "/x ARG");
  expect(r.events.map((e) => e["type"])).toEqual([
    "system",
    "assistant",
    "result",
  ]);
  expect(r.events[1]?.["text"]).toBe("é".repeat(300000));
});

test("resultText is the text of the last result event, or null", async () => {
  const { resultText } = await import("../src/requests.ts");
  expect(
    resultText({
      events: [
        { type: "system" },
        { type: "result", result: "first" },
        { type: "result", subtype: "success", result: "Set model to x" },
      ],
    }),
  ).toBe("Set model to x");
  expect(resultText({ events: [{ type: "result" }] })).toBeNull();
  expect(resultText({ events: [] })).toBeNull();
});

const argsProgram = () => {
  const bin = join(tmp, `claude-args-${n++}`);
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
const f = process.argv.at(-1);
console.log(JSON.stringify(process.argv.slice(2)) + " " + (await Bun.file(f).text()).trim());
process.stderr.write("cwd=" + process.cwd());
process.exit(3);
`,
  );
  chmodSync(bin, 0o755);
  return bin;
};

test("runArgs passes the args, writes files in the project, and keeps plain stdout", async () => {
  const { runArgs } = await import("../src/run.ts");
  const r = await runArgs(
    argsProgram(),
    ["auto-mode", "<project-dir>/s.json"],
    {
      files: { "s.json": '{"a":1}' },
    },
  );
  expect(r.exit).toBe(3);
  const p = r.dirs.project;
  expect(r.stdout.trim()).toBe(`["auto-mode","${p}/s.json"] {"a":1}`);
  expect(r.stderr).toBe(`cwd=${p}`);
  expect(existsSync(p)).toBe(false);
});

test("runArgs writes input to stdin and keeps the files the run wrote in the project", async () => {
  const { runArgs } = await import("../src/run.ts");
  const bin = join(tmp, `claude-stdin-${n++}`);
  writeFileSync(
    bin,
    '#!/usr/bin/env bun\nawait Bun.write("d.log", await Bun.stdin.text());\n',
  );
  chmodSync(bin, 0o755);
  const r = await runArgs(bin, [], {
    input: "one\ntwo\n",
    files: { "s.json": "{}" },
  });
  expect(r.projectFiles).toEqual({ "d.log": "one\ntwo\n", "s.json": "{}" });
  expect(r.files["d.log"]).toBeUndefined();
});

test("runArgs refuses a file path outside the project", async () => {
  const { runArgs } = await import("../src/run.ts");
  for (const name of ["/etc/x", "../x", "a/../../x"])
    await expect(
      runArgs(argsProgram(), ["x"], { files: { [name]: "" } }),
    ).rejects.toThrow("outside the project");
});

// Reads the stored login, asks `PROBE_URL` and api.anthropic.com for the profile, and logs what it got.
const profileProgram = () => {
  const bin = join(tmp, `claude-profile-${n++}`);
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
const cfg = process.env.CLAUDE_CONFIG_DIR;
const token = (await Bun.file(cfg + "/.credentials.json").json()).claudeAiOauth.accessToken;
const ask = async (url) => {
  try {
    const r = await fetch(url, { headers: { authorization: "Bearer " + token } });
    return r.status + " " + r.headers.get("request-id") + " " + JSON.stringify(await r.json());
  } catch (e) {
    return "failed";
  }
};
const lines = [
  "args " + JSON.stringify(process.argv.slice(2)),
  "apiKey " + (process.env.ANTHROPIC_API_KEY ?? "unset"),
  "stub " + (await ask(process.env.PROBE_URL + "/api/oauth/profile")),
  "api " + (await ask("https://api.anthropic.com/api/oauth/profile")),
  "other " + (await ask("https://probe.invalid/")),
];
await Bun.write(cfg + "/out.log", lines.join("\\n"));
`,
  );
  chmodSync(bin, 0o755);
  return bin;
};

test("runArgs with an oauth login, stub replies, and <stub> and <config-dir> placeholders", async () => {
  const { runArgs } = await import("../src/run.ts");
  const r = await runArgs(profileProgram(), ["<config-dir>/x"], {
    login: "oauth",
    env: { PROBE_URL: "<stub>" },
    replies: { "GET /api/oauth/profile": { account: { uuid: "u" } } },
  });
  expect(r.exit).toBe(0);
  expect(r.files["out.log"]?.split("\n")).toEqual([
    `args ["${r.dirs.config}/x"]`,
    "apiKey unset",
    'stub 200 req_probe {"account":{"uuid":"u"}}',
    "api failed",
    "other failed",
  ]);
  expect(r.requests.map((q) => `${q.method} ${q.path} ${q.fakeKey}`)).toEqual([
    "GET /api/oauth/profile true",
  ]);
});

test("runArgs with apiHost answers api.anthropic.com and still refuses other hosts", async () => {
  const { API_HOST, runArgs } = await import("../src/run.ts");
  const r = await runArgs(profileProgram(), [], {
    login: "oauth",
    env: { PROBE_URL: "<stub>" },
    replies: { "GET /api/oauth/profile": { ok: 1 } },
    apiHost: true,
  });
  expect(r.files["out.log"]?.split("\n").slice(2)).toEqual([
    'stub 200 req_probe {"ok":1}',
    'api 200 req_probe {"ok":1}',
    "other failed",
  ]);
  expect(r.requests.map((q) => q.host)).toEqual([
    expect.stringMatching(/^127\.0\.0\.1:\d+$/),
    API_HOST,
  ]);
});

// Sends a main turn with Read and Bash, a side request without tools, the turns after one and two tool results, then a streamed main turn.
const toolProgram = () => {
  const bin = join(tmp, `claude-tool-${n++}`);
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
const ask = (stream, tools, content) =>
  fetch(process.env.ANTHROPIC_BASE_URL + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": "sk-ant-fake-probe", "content-type": "application/json" },
    body: JSON.stringify({ stream, tools, messages: [{ role: "user", content }] }),
  }).then((r) => r.text());
const tools = [{ name: "Read" }, { name: "Bash" }];
const result = { type: "tool_result", tool_use_id: "toolu_probe", content: "hi" };
const lines = [
  await ask(false, tools, "hi"),
  await ask(false, [], "title"),
  await ask(false, tools, [result]),
  await ask(false, tools, [result, result]),
  (await ask(true, tools, "hi")).split("\\n").filter((l) => l.includes("tool_use") || l.includes("json_delta")).join("\\n"),
];
await Bun.write(process.env.CLAUDE_CONFIG_DIR + "/out.log", lines.join("\\n"));
`,
  );
  chmodSync(bin, 0o755);
  return bin;
};

test("runArgs with calls makes the main turn call them in order, in plain and streamed replies", async () => {
  const { runArgs } = await import("../src/run.ts");
  const read = { name: "Read", input: { file_path: "a.txt" } };
  const bash = { name: "Bash", input: { command: "echo hi" } };
  const r = await runArgs(toolProgram(), [], { calls: [read, bash] });
  const [first, side, second, after, ...stream] =
    r.files["out.log"]?.split("\n") ?? [];
  expect(JSON.parse(first ?? "")).toMatchObject({
    content: [{ type: "tool_use", id: "toolu_probe_0", ...read }],
    stop_reason: "tool_use",
  });
  expect(JSON.parse(side ?? "").content).toEqual([
    { type: "text", text: "OK" },
  ]);
  expect(JSON.parse(second ?? "").content).toMatchObject([
    { id: "toolu_probe_1", ...bash },
  ]);
  expect(JSON.parse(after ?? "").stop_reason).toBe("end_turn");
  expect(stream.join("\n")).toContain(
    '"partial_json":"{\\"file_path\\":\\"a.txt\\"}"',
  );
  expect(stream.join("\n")).toContain('"stop_reason":"tool_use"');
});

test("runArgs with a call safeguard adds the auto mode verdict for that call id", async () => {
  const { runArgs } = await import("../src/run.ts");
  const bash = { name: "Bash", input: { command: "echo hi" } };
  const r = await runArgs(toolProgram(), [], {
    calls: [{ ...bash, safeguard: "flagged" }],
  });
  const [first, , , , ...stream] = r.files["out.log"]?.split("\n") ?? [];
  const verdict = [
    {
      type: "dangerous_tool_use",
      status: {
        type: "available",
        tool_uses: { toolu_probe_0: { type: "evaluated", outcome: "flagged" } },
      },
    },
  ];
  expect(JSON.parse(first ?? "").safeguard_results).toEqual(verdict);
  const delta = stream.find((l) => l.includes("message_delta")) ?? "";
  expect(
    JSON.parse(delta.replace(/^data: /, "")).delta.safeguard_results,
  ).toEqual(verdict);
});

test("runArgs with baseUrl false leaves ANTHROPIC_BASE_URL unset", async () => {
  const { runArgs } = await import("../src/run.ts");
  const bin = join(tmp, `claude-base-${n++}`);
  writeFileSync(
    bin,
    "#!/usr/bin/env bun\nconsole.log(String(process.env.ANTHROPIC_BASE_URL));\n",
  );
  chmodSync(bin, 0o755);
  expect((await runArgs(bin, [], { baseUrl: false })).stdout.trim()).toBe(
    "undefined",
  );
  expect((await runArgs(bin, [])).stdout.trim()).toMatch(
    /^http:\/\/127\.0\.0\.1:\d+$/,
  );
});
