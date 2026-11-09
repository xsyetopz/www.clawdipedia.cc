// Calls one tool of the plugin MCP server over stdio, for the tests that compare it with the bundle.
import { join } from "node:path";

import { envOf, hitRoutesOf, isRecord, ROOT } from "./helpers.ts";

const SERVER = join(ROOT, "plugin", "mcp", "dist", "server.js");

interface ToolAnswer {
	routes: string[];
	text: string;
}

const answerOf = (result: unknown): ToolAnswer => {
	if (!isRecord(result) || !Array.isArray(result["content"])) {
		throw new TypeError("the tool result has no content");
	}
	const content: unknown[] = result["content"];
	const first = content[0];
	const text =
		isRecord(first) && typeof first["text"] === "string" ? first["text"] : "";
	const structured = result["structuredContent"];
	const routes = isRecord(structured) ? hitRoutesOf(structured["hits"]) : [];
	return { routes, text };
};

/** The tool result of a JSON-RPC line with id 2, or undefined for any other line. */
const resultOfLine = (line: string): { result: unknown } | undefined => {
	const m: unknown = line.startsWith("{") ? JSON.parse(line) : undefined;
	return isRecord(m) && m["id"] === 2 ? { result: m["result"] } : undefined;
};

const startServer = async (
	env: Record<string, string>,
	name: string,
	args: Record<string, unknown>,
) => {
	const p = Bun.spawn(["bun", SERVER], {
		env: envOf(env),
		stdin: "pipe",
		stdout: "pipe",
		stderr: "ignore",
	});
	const messages = [
		{
			jsonrpc: "2.0",
			id: 1,
			method: "initialize",
			params: {
				protocolVersion: "2025-06-18",
				capabilities: {},
				clientInfo: { name: "test", version: "0" },
			},
		},
		{ jsonrpc: "2.0", method: "notifications/initialized" },
		{
			jsonrpc: "2.0",
			id: 2,
			method: "tools/call",
			params: { name, arguments: args },
		},
	];
	await p.stdin.write(messages.map((m) => `${JSON.stringify(m)}\n`).join(""));
	await p.stdin.flush();
	return p;
};

const readAnswer = async (
	reader: ReadableStreamDefaultReader<Uint8Array>,
	decoder: TextDecoder,
	before: string,
): Promise<ToolAnswer> => {
	const { done, value } = await reader.read();
	if (done) {
		throw new Error("the server closed before it answered");
	}
	const buf = before + decoder.decode(value);
	for (const line of buf.split("\n")) {
		const found = resultOfLine(line);
		if (found) {
			return answerOf(found.result);
		}
	}
	return readAnswer(reader, decoder, buf);
};

/** Calls one tool of the MCP server over stdio (JSON-RPC lines) and returns the routes and the text. */
export const mcpCall = async (
	env: Record<string, string>,
	name: string,
	args: Record<string, unknown>,
): Promise<ToolAnswer> => {
	const p = await startServer(env, name, args);
	try {
		return await readAnswer(p.stdout.getReader(), new TextDecoder(), "");
	} finally {
		p.kill();
	}
};
