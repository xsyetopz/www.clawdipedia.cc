// Run: bun test inspect/mcp/test/server-cli.test.ts   (needs inspect/mcp/dist/server.js; part of plugin:check)
// A fake install 9.9.7 sends one Messages request per stdin line (or one for `-p`), and writes its args to a relative debug file.
import { expect, test } from "bun:test";
import { chmod, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { startServer, structured } from "./server-harness.ts";

const { tmp, call } = startServer();

const install = async () => {
	const bin = join(tmp, "versions", "9.9.7");
	await writeFile(
		bin,
		`#!/usr/bin/env bun
const args = process.argv.slice(2);
const lines = args.includes("--input-format") ? (await Bun.stdin.text()).trim().split("\\n") : ['{"message":{"content":"p"}}'];
await Bun.write("d.log", JSON.stringify(args));
for (const l of lines)
  await fetch(process.env.ANTHROPIC_BASE_URL + "/v1/messages", {
    method: "POST",
    headers: { "x-api-key": "sk-ant-fake-probe", "content-type": "application/json" },
    body: JSON.stringify({
      system: [{ type: "text", text: "Budget: 7d 42%", cache_control: { type: "ephemeral" } }],
      tools: [{ name: "Ask", description: "d", input_schema: {} }],
      messages: [{ role: "user", content: JSON.parse(l).message.content }],
    }),
  }).then((r) => r.text());
`,
	);
	await chmod(bin, 0o755);
};

test("code cli sends prompts in one run, matches a regex query, and shows a request, a tool, and a project file", async () => {
	await install();
	const r = await call("code", {
		action: "cli",
		version: "9.9.7",
		prompts: ["one", "two"],
		query: String.raw`Budget: \w+ \d+%`,
		regex: true,
		request: 2,
		offset: 0,
		length: 20,
		tool: "Ask",
		show: "d.log",
	});
	const s = structured(r);
	expect(s["requests"]).toHaveLength(2);
	expect(s["found"]).toEqual([
		"request 1 POST /v1/messages",
		"request 2 POST /v1/messages",
	]);
	expect(s["body"]).toMatchObject({
		request: 2,
		cacheControl: ["system[0]"],
		offset: 0,
		end: 20,
		text: '{"system":[{"type":"',
	});
	expect(s["tool"]).toEqual({
		name: "Ask",
		description: "d",
		input_schema: {},
	});
	expect(r.content[0]?.text).toContain(
		'd.log: ["-p","--input-format","stream-json","--output-format","stream-json","--verbose"]',
	);
	const none = await call("code", {
		action: "cli",
		version: "9.9.7",
		args: ["-p", "x"],
		query: String.raw`Budget: \d+%`,
		regex: true,
		tool: "Write",
	});
	expect(none.structuredContent?.["found"]).toEqual([]);
	expect(none.structuredContent?.["tool"]).toBeNull();
});
