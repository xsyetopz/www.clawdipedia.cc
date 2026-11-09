// Local fake of the Messages API. Records every request body to a JSONL file.
// It never forwards anything, never stores credentials, and answers with canned text
// (or one canned tool_use block on the first turn, to trigger a subagent request).
import { appendFile } from "node:fs/promises";

export const FAKE_KEY = "sk-ant-fake-probe";
export interface StubOpts {
	port?: number;
	log: string;
	tool?: string | undefined;
	toolInput?: unknown;
	text?: string;
}

const sse = (ev: string, d: unknown) =>
	`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`;

interface Block {
	type: string;
	text?: string;
	input?: unknown;
	[k: string]: unknown;
}
interface ApiBody {
	model?: string;
	stream?: boolean;
	messages?: unknown[];
	tools?: unknown[];
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const hasToolResult = (m: unknown): boolean => {
	const content = isRec(m) ? m["content"] : undefined;
	return (
		Array.isArray(content) &&
		content.some((b: unknown) => isRec(b) && b["type"] === "tool_result")
	);
};

const toolName = (t: unknown): string =>
	isRec(t) && typeof t["name"] === "string" ? t["name"] : "";

const reply = (body: ApiBody | undefined, o: StubOpts) => {
	const hasResult = (body?.messages ?? []).some((m) => hasToolResult(m));
	const toolNames = (body?.tools ?? []).map((t) => toolName(t));
	const tool = o.tool ?? "";
	const useTool = tool !== "" && !hasResult && toolNames.includes(tool);
	const content: Block[] = useTool
		? [
				{
					type: "tool_use",
					id: "toolu_probe1",
					name: tool,
					input: o.toolInput ?? {},
				},
			]
		: [{ type: "text", text: o.text ?? "OK" }];
	return {
		id: "msg_probe",
		type: "message",
		role: "assistant",
		model: body?.model ?? "claude-sonnet-5-5",
		content,
		stop_reason: useTool ? "tool_use" : "end_turn",
		stop_sequence: null,
		usage: {
			input_tokens: 10,
			output_tokens: 5,
			cache_creation_input_tokens: 0,
			cache_read_input_tokens: 0,
		},
	};
};

const stream = (m: ReturnType<typeof reply>) => {
	let out = sse("message_start", {
		type: "message_start",
		message: { ...m, content: [], stop_reason: null },
	});
	for (const [i, b] of m.content.entries()) {
		if (b.type === "text") {
			out += sse("content_block_start", {
				type: "content_block_start",
				index: i,
				content_block: { type: "text", text: "" },
			});
			out += sse("content_block_delta", {
				type: "content_block_delta",
				index: i,
				delta: { type: "text_delta", text: b.text },
			});
		} else {
			out += sse("content_block_start", {
				type: "content_block_start",
				index: i,
				content_block: { ...b, input: {} },
			});
			out += sse("content_block_delta", {
				type: "content_block_delta",
				index: i,
				delta: {
					type: "input_json_delta",
					partial_json: JSON.stringify(b.input),
				},
			});
		}
		out += sse("content_block_stop", { type: "content_block_stop", index: i });
	}
	out += sse("message_delta", {
		type: "message_delta",
		delta: { stop_reason: m.stop_reason, stop_sequence: null },
		usage: { output_tokens: 5 },
	});
	out += sse("message_stop", { type: "message_stop" });
	return out;
};

const apiBody = (v: unknown): ApiBody | undefined => {
	if (!isRec(v)) {
		return undefined;
	}
	const out: ApiBody = {};
	if (typeof v["model"] === "string") {
		out.model = v["model"];
	}
	if (typeof v["stream"] === "boolean") {
		out.stream = v["stream"];
	}
	if (Array.isArray(v["messages"])) {
		out.messages = v["messages"];
	}
	if (Array.isArray(v["tools"])) {
		out.tools = v["tools"];
	}
	return out;
};

/** The request headers to log, with credentials redacted, and whether the credential is the fake key. */
const readHeaders = (req: Request) => {
	const headers: Record<string, string> = {};
	let authOk: boolean | null = null;
	for (const [k, v] of req.headers) {
		if (k === "x-api-key") {
			authOk = v === FAKE_KEY;
			headers[k] = "<redacted>";
		} else if (k === "authorization") {
			headers[k] = "<redacted>";
			authOk ??= v === `Bearer ${FAKE_KEY}`;
		} else {
			headers[k] = v;
		}
	}
	return { headers, authOk };
};

const parseBody = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

export const startStub = (o: StubOpts) =>
	Bun.serve({
		port: o.port ?? 0,
		hostname: "127.0.0.1",
		async fetch(req) {
			const url = new URL(req.url);
			const { headers, authOk } = readHeaders(req);
			const body = parseBody(await req.text());
			await appendFile(
				o.log,
				`${JSON.stringify({
					method: req.method,
					path: url.pathname + url.search,
					authIsFakeKey: authOk,
					headers,
					body,
				})}\n`,
			);
			if (url.pathname === "/v1/messages" && req.method === "POST") {
				const parsed = apiBody(body);
				const m = reply(parsed, o);
				if (parsed?.stream === true) {
					return new Response(stream(m), {
						headers: { "content-type": "text/event-stream" },
					});
				}
				return Response.json(m);
			}
			if (url.pathname === "/v1/messages/count_tokens") {
				return Response.json({ input_tokens: 10 });
			}
			return new Response("{}", {
				status: 404,
				headers: { "content-type": "application/json" },
			});
		},
	});
