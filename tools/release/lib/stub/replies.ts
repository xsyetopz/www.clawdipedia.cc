// Canned Messages API answers: the JSON message, its SSE form, and the cloud memory MCP server.
import type { StubCase } from "./types.ts";

/** An object read as a record, or an empty record for anything else (a raw-text body, null, a number). */
export const asRecord = (x: unknown): Record<string, unknown> =>
	typeof x === "object" && x !== null
		? Object.fromEntries(Object.entries(x))
		: {};

interface Block {
	type: string;
	text?: string;
	input?: unknown;
	[k: string]: unknown;
}
export interface Msg {
	id: string;
	type: "message";
	role: "assistant";
	model: string;
	content: Block[];
	stop_reason: string;
	stop_sequence: null;
	usage: Record<string, number>;
	safeguard_results?: unknown;
}

/** What the replies need from a POST /v1/messages body. */
export interface ApiReq {
	model: string | undefined;
	stream: boolean;
	/** `tool_result` blocks over all messages. */
	toolResults: number;
	toolNames: Set<string>;
}

const countResults = (messages: unknown[]): number => {
	let n = 0;
	for (const m of messages) {
		const content = asRecord(m)["content"];
		if (Array.isArray(content)) {
			n += content.filter((b) => asRecord(b)["type"] === "tool_result").length;
		}
	}
	return n;
};

export const parseApi = (body: unknown): ApiReq => {
	const r = asRecord(body);
	const messages: unknown[] = Array.isArray(r["messages"]) ? r["messages"] : [];
	const tools: unknown[] = Array.isArray(r["tools"]) ? r["tools"] : [];
	const model = r["model"];
	const toolNames = new Set<string>();
	for (const t of tools) {
		const name = asRecord(t)["name"];
		if (typeof name === "string") {
			toolNames.add(name);
		}
	}
	return {
		model: typeof model === "string" ? model : undefined,
		stream: r["stream"] === true,
		toolResults: countResults(messages),
		toolNames,
	};
};

const sse = (ev: string, d: unknown): string =>
	`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`;
const USAGE = {
	input_tokens: 10,
	output_tokens: 5,
	cache_creation_input_tokens: 0,
	cache_read_input_tokens: 0,
};

/** Adds the server-side safeguard verdict for each tool call when the case asks for one. */
export const verdict = (m: Msg, o: StubCase): Msg => {
	const ids = m.content.flatMap((b) => {
		const id = b["id"];
		return b.type === "tool_use" && typeof id === "string" ? [id] : [];
	});
	if (o.safeguard === undefined || ids.length === 0) {
		return m;
	}
	return {
		...m,
		safeguard_results: [
			{
				type: "dangerous_tool_use",
				status: {
					type: "available",
					tool_uses: Object.fromEntries(
						ids.map((id) => [id, { type: "evaluated", outcome: o.safeguard }]),
					),
				},
			},
		],
	};
};

type Base = Omit<Msg, "content" | "stop_reason">;

const toolTurn = (
	base: Base,
	id: string,
	name: string,
	input: unknown,
): Msg => ({
	...base,
	content: [{ type: "tool_use", id, name, input }],
	stop_reason: "tool_use",
});

export const reply = (api: ApiReq, o: StubCase): Msg => {
	const results = api.toolResults;
	const base: Base = {
		id: "msg_probe",
		type: "message",
		role: "assistant",
		model: api.model ?? "claude-sonnet-5-5",
		stop_sequence: null,
		usage: USAGE,
	};
	const nx = o.seq?.[results];
	if (nx !== undefined && api.toolNames.has(nx.name)) {
		return toolTurn(base, `toolu_probe${results}`, nx.name, nx.input);
	}
	if (
		o.seq === undefined &&
		o.tool !== undefined &&
		results === 0 &&
		api.toolNames.has(o.tool)
	) {
		return toolTurn(base, "toolu_probe1", o.tool, o.toolInput ?? {});
	}
	return {
		...base,
		content: [{ type: "text", text: o.text ?? "OK" }],
		stop_reason: "end_turn",
	};
};

const blockEvents = (b: Block, i: number, deltas: number): string => {
	const isText = b.type === "text";
	const start = isText ? { type: "text", text: "" } : { ...b, input: {} };
	const full = isText ? (b.text ?? "") : JSON.stringify(b.input);
	const n = isText ? Math.max(1, deltas) : 1;
	const size = Math.ceil(full.length / n) || 1;
	let out = sse("content_block_start", {
		type: "content_block_start",
		index: i,
		content_block: start,
	});
	for (let k = 0; k < n; k++) {
		const p = full.slice(k * size, (k + 1) * size);
		out += sse("content_block_delta", {
			type: "content_block_delta",
			index: i,
			delta: isText
				? { type: "text_delta", text: p }
				: { type: "input_json_delta", partial_json: p },
		});
	}
	return (
		out + sse("content_block_stop", { type: "content_block_stop", index: i })
	);
};

/** The reply as SSE events. */
export const stream = (m: Msg, deltas = 1): string => {
	const { safeguard_results: _, ...head } = m;
	let out = sse("message_start", {
		type: "message_start",
		message: { ...head, content: [], stop_reason: null },
	});
	for (const [i, b] of m.content.entries()) {
		out += blockEvents(b, i, deltas);
	}
	out += sse("message_delta", {
		type: "message_delta",
		delta: {
			stop_reason: m.stop_reason,
			stop_sequence: null,
			...(m.safeguard_results !== undefined && {
				safeguard_results: m.safeguard_results,
			}),
		},
		usage: { output_tokens: 5 },
	});
	return out + sse("message_stop", { type: "message_stop" });
};

/** The same events as `stream`, one every `gapMs` ms. */
export const slowStream = (
	text: string,
	gapMs: number,
): ReadableStream<Uint8Array> => {
	const events = text.split("\n\n").filter((e) => e !== "");
	const enc = new TextEncoder();
	let i = 0;
	return new ReadableStream({
		async pull(c) {
			const ev = events[i];
			if (ev === undefined) {
				c.close();
				return;
			}
			if (i > 0) {
				await Bun.sleep(gapMs);
			}
			i += 1;
			c.enqueue(enc.encode(`${ev}\n\n`));
		},
	});
};

const MEMORY_TOOLS = ["read", "write", "str_replace", "append"].map((t) => ({
	name: `memory_${t}`,
	description: `memory ${t}`,
	inputSchema: { type: "object", properties: {} },
}));

const memoryResult = (method: unknown, params: unknown): unknown => {
	if (method === "initialize") {
		const v = asRecord(params)["protocolVersion"];
		return {
			protocolVersion: typeof v === "string" ? v : "2025-06-18",
			capabilities: { tools: {} },
			serverInfo: { name: "memory", version: "1" },
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
		result: memoryResult(q["method"], q["params"]),
	});
};
