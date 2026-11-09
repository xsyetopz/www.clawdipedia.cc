import { expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	bodyOf,
	filesOf,
	placesOf,
	resultText,
	toolEntry,
	toolNames,
} from "../src/requests.ts";
import type { Sent } from "../src/run.ts";

const sent = (path: string, body: unknown): Sent => ({
	method: "POST",
	path,
	host: "127.0.0.1",
	fakeKey: true,
	body,
});

test("toolNames lists the tools of each messages request and skips other requests", () => {
	const names = toolNames({
		requests: [
			sent("/v1/messages?beta=true", {
				tools: [{ name: "Bash" }, { name: "Glob" }],
			}),
			sent("/v1/messages/count_tokens", { tools: [{ name: "Read" }] }),
			sent("/api/oauth/profile", null),
			sent("/v1/messages", { messages: [] }),
		],
	});
	expect(names).toEqual([["Bash", "Glob"], []]);
});

test("placesOf names each request, stream, and file that holds the text", () => {
	const places = placesOf(
		{
			requests: [
				sent("/v1/messages", { messages: [{ content: "a tok-123 b" }] }),
				sent("/v1/messages/count_tokens", { messages: [] }),
			],
			stdout: "x tok-123",
			stderr: "",
			files: { "projects/p/s.jsonl": '{"m":"tok-123"}', "other.jsonl": "{}" },
		},
		/tok-123/u,
	);
	expect(places).toEqual([
		"request 1 POST /v1/messages",
		"stdout",
		"file projects/p/s.jsonl",
	]);
});

test("placesOf with a regular expression matches the same places as a plain text", () => {
	const r = {
		requests: [
			sent("/v1/messages", { messages: [{ content: "x" }] }),
			sent("/v1/messages", { system: "Budget: seven-day 2% used" }),
		],
		stdout: "",
		stderr: "Budget: 5%",
		files: {},
	};
	expect(placesOf(r, /Budget: \S+ \d+%/u)).toEqual([
		"request 2 POST /v1/messages",
	]);
	expect(placesOf(r, /Budget: \d+%/u)).toEqual(["stderr"]);
});

test("bodyOf gives the JSON size of each part and where each cache_control is", () => {
	const body = {
		model: "m",
		system: [
			{ type: "text", text: "a" },
			{ type: "text", text: "b", cache_control: { type: "ephemeral" } },
		],
		tools: [
			{ name: "Read" },
			{ name: "Bash", cache_control: { type: "ephemeral" } },
		],
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: "é", cache_control: { type: "ephemeral" } },
				],
			},
		],
	};
	const b = bodyOf(body);
	expect(b).toEqual({
		bytes: Buffer.byteLength(JSON.stringify(body)),
		tools: Buffer.byteLength(JSON.stringify(body.tools)),
		system: Buffer.byteLength(JSON.stringify(body.system)),
		messages: Buffer.byteLength(JSON.stringify(body.messages)),
		cacheControl: ["system[1]", "tools[1]", "messages[0].content[0]"],
	});
	expect(bodyOf("not json")).toEqual({
		bytes: 8,
		tools: 0,
		system: 0,
		messages: 0,
		cacheControl: [],
	});
});

test("toolEntry gives the entry of a named tool from the last request that sends it", () => {
	const read1 = { name: "Read", description: "old" };
	const read2 = { name: "Read", description: "new", input_schema: {} };
	const r = {
		requests: [
			sent("/v1/messages", { tools: [read1] }),
			sent("/v1/messages", { tools: [read2, { name: "Bash" }] }),
			sent("/v1/messages/count_tokens", { tools: [{ name: "Read" }] }),
			sent("/v1/messages", { tools: [] }),
		],
	};
	expect(toolEntry(r, "Read")).toEqual(read2);
	expect(toolEntry(r, "Write")).toBeUndefined();
});

test("filesOf reads the JSONL files under a folder by relative path", async () => {
	const dir = await mkdtemp(join(tmpdir(), "files-of-"));
	try {
		await mkdir(join(dir, "projects", "p"), { recursive: true });
		await Bun.write(join(dir, "projects", "p", "s.jsonl"), "{}\n");
		await Bun.write(join(dir, "notes.txt"), "no");
		expect(await filesOf(dir)).toEqual({
			[join("projects", "p", "s.jsonl")]: "{}\n",
		});
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test("resultText reads the last result event", () => {
	expect(
		resultText({
			events: [
				{ type: "result", result: "a" },
				{ type: "result", result: "b" },
			],
		}),
	).toBe("b");
	expect(resultText({ events: [] })).toBeNull();
});
