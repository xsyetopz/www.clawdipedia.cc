// The /v1/messages route of the stub: refusals, scripted errors, and the reply, as JSON or as a stream.
import {
	type ApiReq,
	type Msg,
	parseApi,
	pickTurn,
	reply,
	slowStream,
	stream,
	verdict,
} from "./replies.ts";
import type { StubCase } from "./types.ts";

const apiError = (message: string): Response =>
	Response.json(
		{ type: "error", error: { type: "invalid_request_error", message } },
		{ status: 400 },
	);

// The error a server with no dangerous-tool-use beta gives, when the case asks for it.
const refusedBeta = (req: Request, o: StubCase): Response | null => {
	const beta = req.headers.get("anthropic-beta") ?? "";
	const refused = beta
		.split(",")
		.find((b) => b.trim().startsWith("dangerous-tool-use"));
	if (o.refuseServerCheck !== true || refused === undefined) {
		return null;
	}
	return apiError(
		`Unexpected value(s) \`${refused.trim()}\` for the \`anthropic-beta\` header. Please consult our documentation at docs.claude.com or try again without the header.`,
	);
};

// The scripted turn for this request; an error turn marked `once` is sent only the first time, so the retry succeeds.
const takeTurn = (
	api: ApiReq,
	o: StubCase,
	id: string,
	calls: Map<string, number>,
): ReturnType<typeof pickTurn> => {
	const turn = pickTurn(api, o);
	if (turn?.kind !== "error" || turn.once !== true) {
		return turn;
	}
	const usedKey = `${id}#turn${api.toolResults}`;
	const used = calls.has(usedKey);
	calls.set(usedKey, 1);
	return used ? null : turn;
};

const send = (msg: Msg, api: ApiReq, o: StubCase): Response => {
	const extra = o.respHeaders ?? {};
	if (!api.stream) {
		const { open: _, ...plain } = msg;
		return Response.json(plain, { headers: extra });
	}
	const text = stream(msg, o.deltas);
	return new Response(
		o.gapMs !== undefined && o.gapMs > 0 ? slowStream(text, o.gapMs) : text,
		{ headers: { "content-type": "text/event-stream", ...extra } },
	);
};

/** The answer to one /v1/messages request of a case: a scripted error, a scripted turn, or the default reply. */
export const messagesRoute = (
	req: Request,
	id: string,
	o: StubCase,
	body: unknown,
	calls: Map<string, number>,
): Response => {
	const refusal = refusedBeta(req, o);
	if (refusal !== null) {
		return refusal;
	}
	const nth = (calls.get(id) ?? 0) + 1;
	calls.set(id, nth);
	if (o.tooLongOn === nth) {
		return apiError("prompt is too long: 250000 tokens > 200000 maximum");
	}
	const api = parseApi(body);
	const turn = takeTurn(api, o, id, calls);
	if (turn?.kind === "error") {
		return Response.json(turn.body, {
			status: turn.status,
			headers: o.respHeaders ?? {},
		});
	}
	return send(verdict(reply(api, o, turn), o), api, o);
};
