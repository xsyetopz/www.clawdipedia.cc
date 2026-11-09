// Calls cc-inspect tools from a shell, through the built server, for sessions that do not load it as MCP.
// Usage: bun inspect/mcp/src/cli.ts <tool> '<json args>' [<tool> '<json args>' ...]
// One server serves every call, so the cache of a version loads once.
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { isRecord } from "./json.ts";

const USAGE =
	"usage: bun inspect/mcp/src/cli.ts <tool> '<json args>' [<tool> '<json args>' ...]\n";

interface Call {
	name: string;
	json: string;
	args: Record<string, unknown>;
}

const parseCalls = (args: string[]): Call[] | string => {
	const calls: Call[] = [];
	for (let i = 0; i < args.length; i += 2) {
		const [name = "", json = ""] = [args[i], args[i + 1]];
		let parsed: unknown;
		try {
			parsed = JSON.parse(json);
		} catch {
			return `argument ${i + 2} is not JSON: ${json}`;
		}
		if (!isRecord(parsed)) {
			return `argument ${i + 2} is not a JSON object: ${json}`;
		}
		calls.push({ name, json, args: parsed });
	}
	return calls;
};

const env: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
	if (v !== undefined) {
		env[k] = v;
	}
}

const runCalls = async (client: Client, calls: Call[]): Promise<boolean> => {
	const [c, ...rest] = calls;
	if (c === undefined) {
		return false;
	}
	process.stdout.write(`=== ${c.name} ${c.json}\n`);
	const r = await client.callTool(
		{ name: c.name, arguments: c.args },
		undefined,
		{ timeout: 600_000 },
	);
	const content: unknown = r.content;
	for (const p of Array.isArray(content) ? content : []) {
		if (isRecord(p) && typeof p["text"] === "string" && p["text"] !== "") {
			process.stdout.write(`${p["text"]}\n`);
		}
	}
	const failed = r.isError === true;
	return (await runCalls(client, rest)) || failed;
};

const main = async (): Promise<number> => {
	const args = process.argv.slice(2);
	if (args.length === 0 || args.length % 2 !== 0) {
		process.stderr.write(USAGE);
		return 2;
	}
	const calls = parseCalls(args);
	if (typeof calls === "string") {
		process.stderr.write(`${calls}\n${USAGE}`);
		return 2;
	}
	const client = new Client({ name: "cc-inspect-cli", version: "0" });
	await client.connect(
		new StdioClientTransport({
			command: process.execPath,
			args: [join(import.meta.dir, "..", "dist", "server.js")],
			env,
		}),
	);
	const failed = await runCalls(client, calls);
	await client.close();
	return failed ? 1 : 0;
};

process.exitCode = await main();
