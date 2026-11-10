// The fake Messages API that `runArgs` (run.ts) points the program at: it keeps each request and answers with canned replies.
import { isRecord, recordsOf } from "./json.ts";

export const FAKE_KEY = "sk-ant-fake-probe";
export interface Sent {
	method: string;
	path: string;
	host: string;
	fakeKey: boolean | null;
	body: unknown;
}
export interface Tool {
	name: string;
	input: Record<string, unknown>;
	safeguard?: "flagged" | "not_flagged";
}
type Call = Tool & { id: string };

const sse = (ev: string, d: unknown) =>
	`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`;
const MESSAGE = {
	id: "msg_probe",
	type: "message",
	role: "assistant",
	content: [{ type: "text", text: "OK" }],
	stop_reason: "end_turn",
	stop_sequence: null,
	usage: { input_tokens: 10, output_tokens: 5 },
};

// The verdict of the server-side auto mode check, in the shape the program parses.
const safeguardOf = (call?: Call) =>
	call?.safeguard !== undefined && {
		safeguard_results: [
			{
				type: "dangerous_tool_use",
				status: {
					type: "available",
					tool_uses: {
						[call.id]: { type: "evaluated", outcome: call.safeguard },
					},
				},
			},
		],
	};

const streamOf = (tool?: Call) =>
	sse("message_start", {
		type: "message_start",
		message: { ...MESSAGE, content: [], stop_reason: null },
	}) +
	sse("content_block_start", {
		type: "content_block_start",
		index: 0,
		content_block: tool
			? { type: "tool_use", id: tool.id, name: tool.name, input: {} }
			: { type: "text", text: "" },
	}) +
	sse("content_block_delta", {
		type: "content_block_delta",
		index: 0,
		delta: tool
			? { type: "input_json_delta", partial_json: JSON.stringify(tool.input) }
			: { type: "text_delta", text: "OK" },
	}) +
	sse("content_block_stop", { type: "content_block_stop", index: 0 }) +
	sse("message_delta", {
		type: "message_delta",
		delta: {
			stop_reason: tool ? "tool_use" : "end_turn",
			stop_sequence: null,
			...safeguardOf(tool),
		},
		usage: { output_tokens: 5 },
	}) +
	sse("message_stop", { type: "message_stop" });

const countToolResults = (messages: Record<string, unknown>[]): number =>
	messages.flatMap((m) => {
		const content: unknown = m["content"];
		const blocks: unknown[] = Array.isArray(content) ? content : [];
		return blocks.filter(
			(c: unknown) => isRecord(c) && c["type"] === "tool_result",
		);
	}).length;

// Call k answers the main turn that holds k tool results; side requests (titles, classifiers) lack the tool.
// Each call has its own id: with one shared id, 2.1.319 looped on the second call.
const callOf = (body: unknown, calls: Tool[]): Call | undefined => {
	const b = isRecord(body) ? body : {};
	const done = countToolResults(recordsOf(b["messages"]));
	const call = calls[done];
	return call !== undefined &&
		recordsOf(b["tools"]).some((t) => t["name"] === call.name)
		? { id: `toolu_probe_${done}`, ...call }
		: undefined;
};

const jsonReply = (call: Call | undefined) =>
	call === undefined
		? MESSAGE
		: {
				...MESSAGE,
				content: [
					{ type: "tool_use", id: call.id, name: call.name, input: call.input },
				],
				stop_reason: "tool_use",
				...safeguardOf(call),
			};

const parseBody = (raw: string): unknown => {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
};

const messagesReply = (
	body: unknown,
	calls: Tool[] | undefined,
	fastRefusal: number | undefined,
): Response => {
	if (fastRefusal !== undefined && isRecord(body) && body["speed"] === "fast") {
		return Response.json(
			{
				type: "error",
				error: {
					type: "invalid_request_error",
					message: "Fast mode is not enabled for this model",
				},
			},
			{ status: fastRefusal },
		);
	}
	const call = calls && callOf(body, calls);
	return isRecord(body) && body["stream"] === true
		? new Response(streamOf(call), {
				headers: { "content-type": "text/event-stream" },
			})
		: Response.json(jsonReply(call));
};

const VERTEX_COUNT = "count-tokens";
/** The model in a Vertex path, `…/models/<model>:rawPredict` or `:streamRawPredict`, where the SDK moves it from the body; `count-tokens` for a token count. */
export const vertexModel = (path: string): string | undefined =>
	/\/models\/([^/:]+):(?:streamR|r)awPredict/u.exec(path)?.[1];

/** True for a Messages API call on the first-party path or the Vertex one, and false for a token count. */
export const isTurn = (path: string): boolean => {
	const model = vertexModel(path);
	return model === undefined
		? path.startsWith("/v1/messages") && !path.includes("count_tokens")
		: model !== VERTEX_COUNT;
};

/**
 * A `fetch` handler that pushes each request onto `requests` and answers: Messages API calls, token counts, then `replies` by `METHOD /path`, else 404.
 * With `fastRefusal`, a Messages API call that asks for `speed: "fast"` gets that HTTP status and the error "Fast mode is not enabled for this model".
 */
export const makeAnswer =
	(
		requests: Sent[],
		calls: Tool[] | undefined,
		replies: Record<string, unknown>,
		fastRefusal?: number,
	) =>
	async (req: Request): Promise<Response> => {
		const key =
			req.headers.get("x-api-key") ??
			req.headers.get("authorization")?.replace(/^Bearer /u, "");
		const body = parseBody(await req.text());
		const url = new URL(req.url);
		requests.push({
			method: req.method,
			path: url.pathname + url.search,
			host: req.headers.get("host") ?? "",
			fakeKey: key === undefined ? null : key === FAKE_KEY,
			body,
		});
		const model = vertexModel(url.pathname);
		if (
			req.method === "POST" &&
			(url.pathname === "/v1/messages" ||
				(model !== undefined && model !== VERTEX_COUNT))
		) {
			return messagesReply(body, calls, fastRefusal);
		}
		if (
			url.pathname === "/v1/messages/count_tokens" ||
			model === VERTEX_COUNT
		) {
			return Response.json({ input_tokens: 10 });
		}
		const reply = replies[`${req.method} ${url.pathname}`];
		// The program trusts a profile reply only with a `req_` request id, as the real API sends.
		if (reply !== undefined) {
			return Response.json(reply, { headers: { "request-id": "req_probe" } });
		}
		return Response.json({}, { status: 404 });
	};
