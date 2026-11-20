// The cloud memory MCP server that the stub plays for the memory path of the program.
import { asRecord } from "./replies.ts";

const MEMORY_TOOLS = ["read", "write", "str_replace", "append"].map((t) => ({
	name: `memory_${t}`,
	description: `memory ${t}`,
	inputSchema: { type: "object", properties: {} }
}));

const memoryResult = (method: unknown, params: unknown): unknown => {
	if (method === "initialize") {
		const v = asRecord(params)["protocolVersion"];
		return {
			protocolVersion: typeof v === "string" ? v : "2025-06-18",
			capabilities: { tools: {} },
			serverInfo: { name: "memory", version: "1" }
		};
	}
	if (method === "tools/list") {
		return { tools: MEMORY_TOOLS };
	}
	if (method === "tools/call") {
		return { content: [{ type: "text", text: "ok" }] };
	}
	return {};
};

/** Minimal streamable-HTTP MCP server for the cloud memory path: lists the memory tools, answers each call with "ok". */
export const memoryMcp = (body: unknown): Response => {
	const q = asRecord(body);
	if (q["id"] === undefined) {
		return new Response(null, { status: 202 });
	}
	return Response.json({
		jsonrpc: "2.0",
		id: q["id"],
		result: memoryResult(q["method"], q["params"])
	});
};
