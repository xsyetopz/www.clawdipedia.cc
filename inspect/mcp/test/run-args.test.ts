// Run: bun test inspect/mcp/test/run-args.test.ts
// Fake "Claude Code" scripts that `runArgs` starts with args, files, stdin, a login, and stub replies.
import { afterAll, expect, test } from "bun:test";

import { toolNames } from "../src/requests.ts";
import { API_HOST, runArgs } from "../src/run.ts";
import {
	createTmp,
	exists,
	member,
	outLog,
	parsed,
	rejection,
} from "./run-helpers.ts";

const tmp = await createTmp();
afterAll(tmp.cleanup);

const argsProgram = () =>
	tmp.script(
		"claude-args",
		`#!/usr/bin/env bun
const f = process.argv.at(-1);
console.log(JSON.stringify(process.argv.slice(2)) + " " + (await Bun.file(f).text()).trim());
process.stderr.write("cwd=" + process.cwd());
process.exit(3);
`,
	);

test("runArgs passes the args, writes files in the project, and keeps plain stdout", async () => {
	const r = await runArgs(
		await argsProgram(),
		["auto-mode", "<project-dir>/s.json"],
		{
			files: { "s.json": '{"a":1}' },
		},
	);
	expect(r.exit).toBe(3);
	const p = r.dirs.project;
	expect(r.stdout.trim()).toBe(`["auto-mode","${p}/s.json"] {"a":1}`);
	expect(r.stderr).toBe(`cwd=${p}`);
	expect(await exists(p)).toBe(false);
});

test("runArgs writes input to stdin and keeps the files the run wrote in the project", async () => {
	const bin = await tmp.script(
		"claude-stdin",
		'#!/usr/bin/env bun\nawait Bun.write("d.log", await Bun.stdin.text());\n',
	);
	const r = await runArgs(bin, [], {
		input: "one\ntwo\n",
		files: { "s.json": "{}" },
	});
	expect(r.projectFiles).toEqual({ "d.log": "one\ntwo\n", "s.json": "{}" });
	expect(r.files["d.log"]).toBeUndefined();
});

test.each(["/etc/x", "../x", "a/../../x"])(
	"runArgs refuses the file path %s outside the project",
	async (name) => {
		expect(
			await rejection(
				runArgs(await argsProgram(), ["x"], { files: { [name]: "" } }),
			),
		).toContain("outside the project");
	},
);

// Reads the stored login, asks `PROBE_URL` and api.anthropic.com for the profile, and logs what it got.
const profileProgram = () =>
	tmp.script(
		"claude-profile",
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

test("runArgs with an oauth login, stub replies, and <stub> and <config-dir> placeholders", async () => {
	const r = await runArgs(await profileProgram(), ["<config-dir>/x"], {
		login: "oauth",
		env: { PROBE_URL: "<stub>" },
		replies: { "GET /api/oauth/profile": { account: { uuid: "u" } } },
	});
	expect(r.exit).toBe(0);
	expect(outLog(r)).toEqual([
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
	const r = await runArgs(await profileProgram(), [], {
		login: "oauth",
		env: { PROBE_URL: "<stub>" },
		replies: { "GET /api/oauth/profile": { ok: 1 } },
		apiHost: true,
	});
	expect(outLog(r).slice(2)).toEqual([
		'stub 200 req_probe {"ok":1}',
		'api 200 req_probe {"ok":1}',
		"other failed",
	]);
	const hosts = r.requests.map((q) => q.host);
	expect(hosts).toHaveLength(2);
	expect(hosts[0]).toMatch(/^127\.0\.0\.1:\d+$/u);
	expect(hosts[1]).toBe(API_HOST);
});

// Sends a main turn with Read and Bash, a side request without tools, the turns after one and two tool results, then a streamed main turn.
const toolProgram = () =>
	tmp.script(
		"claude-tool",
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

test("runArgs with calls makes the main turn call them in order, in plain and streamed replies", async () => {
	const read = { name: "Read", input: { file_path: "a.txt" } };
	const bash = { name: "Bash", input: { command: "echo hi" } };
	const r = await runArgs(await toolProgram(), [], { calls: [read, bash] });
	const lines = outLog(r);
	expect(parsed(lines[0])).toMatchObject({
		content: [{ type: "tool_use", id: "toolu_probe_0", ...read }],
		stop_reason: "tool_use",
	});
	expect(parsed(lines[1])["content"]).toEqual([{ type: "text", text: "OK" }]);
	expect(parsed(lines[2])["content"]).toMatchObject([
		{ id: "toolu_probe_1", ...bash },
	]);
	expect(parsed(lines[3])["stop_reason"]).toBe("end_turn");
	const stream = lines.slice(4).join("\n");
	expect(stream).toContain(
		String.raw`"partial_json":"{\"file_path\":\"a.txt\"}"`,
	);
	expect(stream).toContain('"stop_reason":"tool_use"');
});

test("runArgs with a call safeguard adds the auto mode verdict for that call id", async () => {
	const bash = { name: "Bash", input: { command: "echo hi" } };
	const r = await runArgs(await toolProgram(), [], {
		calls: [{ ...bash, safeguard: "flagged" }],
	});
	const lines = outLog(r);
	const verdict = [
		{
			type: "dangerous_tool_use",
			status: {
				type: "available",
				tool_uses: { toolu_probe_0: { type: "evaluated", outcome: "flagged" } },
			},
		},
	];
	expect(parsed(lines[0])["safeguard_results"]).toEqual(verdict);
	const delta = lines.slice(4).find((l) => l.includes("message_delta"));
	expect(
		member(
			parsed(delta?.replace(/^data: /u, ""))["delta"],
			"safeguard_results",
		),
	).toEqual(verdict);
});

// A Vertex client: a fast turn, the same turn at standard speed, a streamed turn, and a token count, each on its Vertex path.
const vertexProgram = () =>
	tmp.script(
		"claude-vertex",
		`#!/usr/bin/env bun
const e = process.env;
const models = e.ANTHROPIC_VERTEX_BASE_URL + "/v1/projects/" + e.ANTHROPIC_VERTEX_PROJECT_ID + "/locations/global/publishers/anthropic/models/";
const ask = async (name, body) => {
  const r = await fetch(models + name, { method: "POST", body: JSON.stringify(body) });
  return r.status + " " + (await r.text()).replaceAll("\\n", " ");
};
const tools = [{ name: "Read" }];
const lines = [
  e.CLAUDE_CODE_USE_VERTEX + " " + e.CLAUDE_CODE_SKIP_VERTEX_AUTH,
  await ask("claude-fable-5-2:rawPredict", { speed: "fast", tools, messages: [] }),
  await ask("claude-fable-5-2:rawPredict", { tools, messages: [] }),
  await ask("claude-fable-5-2:streamRawPredict", { stream: true, tools, messages: [] }),
  await ask("count-tokens:rawPredict", { messages: [] }),
];
await Bun.write(e.CLAUDE_CONFIG_DIR + "/out.log", lines.join("\\n"));
`,
	);

test("runArgs with provider vertex answers the Vertex paths, and fastRefusal refuses a fast turn", async () => {
	const r = await runArgs(await vertexProgram(), [], {
		provider: "vertex",
		fastRefusal: 400,
	});
	const lines = outLog(r);
	expect(lines[0]).toBe("1 1");
	expect(lines[1]).toStartWith("400 ");
	expect(lines[1]).toContain("Fast mode is not enabled");
	expect(lines[2]).toStartWith('200 {"id":"msg_probe"');
	expect(lines[3]).toStartWith("200 event: message_start");
	expect(lines[4]).toBe('200 {"input_tokens":10}');
	expect(r.requests.map((q) => q.fakeKey)).toEqual([null, null, null, null]);
	expect(toolNames(r)).toEqual([["Read"], ["Read"], ["Read"]]);
});

test("runArgs without fastRefusal answers a fast turn", async () => {
	const r = await runArgs(await vertexProgram(), [], { provider: "vertex" });
	expect(outLog(r)[1]).toStartWith('200 {"id":"msg_probe"');
});

test("runArgs with provider vertex refuses an env name that it fixes", async () => {
	expect(
		await rejection(
			runArgs(await argsProgram(), ["x"], {
				provider: "vertex",
				env: { ANTHROPIC_VERTEX_PROJECT_ID: "mine" },
			}),
		),
	).toContain("is not allowed");
});

test("runArgs with baseUrl false leaves ANTHROPIC_BASE_URL unset", async () => {
	const bin = await tmp.script(
		"claude-base",
		"#!/usr/bin/env bun\nconsole.log(String(process.env.ANTHROPIC_BASE_URL));\n",
	);
	const without = await runArgs(bin, [], { baseUrl: false });
	expect(without.stdout.trim()).toBe("undefined");
	const withUrl = await runArgs(bin, []);
	expect(withUrl.stdout.trim()).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/u);
});
