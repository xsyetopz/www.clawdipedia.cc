// Run: bun test inspect/mcp/test/run.test.ts
// A fake "Claude Code" script sends one Messages request to ANTHROPIC_BASE_URL, as the program does in print mode.
import { afterAll, expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";

import { resultText } from "../src/requests.ts";
import { runPrompt, userText } from "../src/run.ts";
import { createTmp, exists, rejection } from "./run-helpers.ts";

const tmp = await createTmp();
afterAll(tmp.cleanup);

const fakeProgram = (
	o: {
		key?: string;
		host?: string;
		hang?: boolean;
		say?: string;
		big?: boolean;
	} = {},
) => {
	const say =
		o.say === undefined
			? ""
			: `process.stderr.write(${JSON.stringify(o.say)});`;
	const hang =
		o.hang === true
			? 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000);'
			: "";
	const big =
		o.big === true
			? String.raw`const b = Buffer.from(JSON.stringify({ type: "assistant", text: "é".repeat(300000) }) + "\n" + JSON.stringify({ type: "result" }) + "\n"); await Bun.write(Bun.stdout, b.subarray(0, 1001)); await Bun.sleep(300); await Bun.write(Bun.stdout, b.subarray(1001));`
			: "";
	const host = o.host === undefined ? "" : `, host: ${JSON.stringify(o.host)}`;
	return tmp.script(
		"claude",
		`#!/usr/bin/env bun
${say}
${hang}
console.log(JSON.stringify({ type: "system", subtype: "init" }));
${big}
const prompt = process.argv[process.argv.indexOf("-p") + 1];
const sec = Bun.spawnSync(["security", "find-generic-password"]).exitCode;
const skill = process.env.TMPDIR.replace(/\\/$/, "") + "/bundled-skills/9.9.9/abc123/x";
const env = Object.keys(process.env).filter((k) => /^(ANTHROPIC|PROBE|AWS)_/.test(k)).sort().join(",");
await fetch(process.env.ANTHROPIC_BASE_URL + "/v1/messages?beta=true", {
  method: "POST",
  headers: { "x-api-key": ${JSON.stringify(o.key ?? "sk-ant-fake-probe")}, "content-type": "application/json"${host} },
  body: JSON.stringify({ stream: true, messages: [{ role: "user", content: [
    { type: "text", text: "<system-reminder>left out</system-reminder>" },
    { type: "text", text: "<command-name>/x</command-name>\\n" + prompt + "\\n" },
    { type: "text", text: "Base: " + skill + " cwd: " + process.cwd() + " home: " + process.env.HOME + " security: " + sec + " env: " + env },
  ] }] }),
}).then((r) => r.text());
`,
	);
};
const runDirs = async () => {
	const names = await readdir(tmpdir());
	return names.filter((d) => d.startsWith("cc-run-"));
};

test("run keeps the user turn from the marked block, with temp folders as placeholders", async () => {
	process.env["ANTHROPIC_AUTH_TOKEN"] = "not-for-the-program";
	try {
		const r = await runPrompt(await fakeProgram(), "/x ARG");
		expect(r.exit).toBe(0);
		expect(r.requests.map((q) => q.path)).toEqual(["/v1/messages?beta=true"]);
		expect(r.events).toEqual([{ type: "system", subtype: "init" }]);
		expect(userText(r, "<command-name>/x</command-name>")).toBe(
			"<command-name>/x</command-name>\n/x ARG\n\nBase: <bundled-skill-dir>/x cwd: <project-dir> home: <home> security: 44 env: ANTHROPIC_API_KEY,ANTHROPIC_BASE_URL,AWS_EC2_METADATA_DISABLED",
		);
		const found = await Promise.all(
			[r.dirs.home, r.dirs.config, r.dirs.project].map((d) => exists(d)),
		);
		expect(found).toEqual([false, false, false]);
	} finally {
		delete process.env["ANTHROPIC_AUTH_TOKEN"];
	}
});

test("userText is null when no user turn holds the mark", async () => {
	const r = await runPrompt(await fakeProgram(), "/x ARG");
	expect(userText(r, "<command-name>/y</command-name>")).toBeNull();
});

test("run fails on another key or host, and removes its folders", async () => {
	const before = await runDirs();
	expect(
		await rejection(
			runPrompt(await fakeProgram({ key: "sk-ant-other-key" }), "/x ARG"),
		),
	).toContain("another host or key");
	expect(
		await rejection(
			runPrompt(
				await fakeProgram({ host: "127.0.0.1.attacker.test" }),
				"/x ARG",
			),
		),
	).toContain("another host or key");
	expect(await runDirs()).toEqual(before);
});

test("run kills a program that ignores SIGTERM and reports the timeout with its stderr", async () => {
	expect(
		await rejection(
			runPrompt(
				await fakeProgram({ hang: true, say: "stuck at step 3" }),
				"/x ARG",
				undefined,
				1500,
			),
		),
	).toMatch(/did not end in 1500 ms; events: system\/init.*stuck at step 3/su);
});

test("run passes extra env to the program", async () => {
	const r = await runPrompt(
		await fakeProgram(),
		"/x ARG",
		undefined,
		undefined,
		{ PROBE_FLAG: "1" },
	);
	expect(userText(r, "<command-name>/x</command-name>")).toContain(
		"env: ANTHROPIC_API_KEY,ANTHROPIC_BASE_URL,AWS_EC2_METADATA_DISABLED,PROBE_FLAG",
	);
});

test.each([
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
])(
	"run refuses extra env %s, which would undo the safety setup or carry a credential",
	async (k) => {
		expect(
			await rejection(
				runPrompt(await fakeProgram(), "/x ARG", undefined, undefined, {
					[k]: "1",
				}),
			),
		).toContain(`env ${k}`);
	},
);

test("run refuses an env value shaped like an Anthropic key", async () => {
	expect(
		await rejection(
			runPrompt(await fakeProgram(), "/x ARG", undefined, undefined, {
				PROBE_X: "sk-ant-api03-zzz",
			}),
		),
	).toContain("env PROBE_X");
});

test("run keeps every stdout event, with multibyte text split across chunks intact", async () => {
	const r = await runPrompt(await fakeProgram({ big: true }), "/x ARG");
	expect(r.events.map((e) => e["type"])).toEqual([
		"system",
		"assistant",
		"result",
	]);
	expect(r.events[1]?.["text"]).toBe("é".repeat(300_000));
});

test("resultText is the text of the last result event, or null", () => {
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
