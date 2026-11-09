/** Self-hosted runner API the stub plays for one case. */
export interface StubOrchestrator {
	secret: string;
	/** The first spawn-hints poll returns these hints, later polls none. */
	hints: Record<string, unknown>[];
	/** Runner mode: every work poll assigns this session id. */
	assignment?: string;
	/** Runner mode: every session config fetch after the second gets a 400 with an error type. */
	refuseRemote?: boolean;
	/** Runner mode: the runner token is a JWT that expires in this many seconds, and POST /v1/code/auth/refresh issues the next one. */
	runnerTokenTtlS?: number;
}

export interface StubCase {
	/** JSONL request log. */
	log: string;
	/** Default "OK". */
	text?: string;
	tool?: string;
	/** One tool_use on the first turn. */
	toolInput?: unknown;
	/** Several tool turns. */
	seq?: { name: string; input: unknown }[];
	respHeaders?: Record<string, string>;
	/** Server-side auto mode verdict for each tool call. */
	safeguard?: "flagged" | "not_flagged";
	orchestrator?: StubOrchestrator;
	/** Answer the Nth POST /v1/messages with HTTP 400 "prompt is too long", as a full context does. */
	tooLongOn?: number;
	/** Wait this long between SSE events of a streamed reply. */
	gapMs?: number;
	/** Split a text block into this many text_delta events. */
	deltas?: number;
	/** HTTP 400 for requests with the dangerous-tool-use beta, as a gateway that does not know it. */
	refuseServerCheck?: boolean;
}

export interface LoggedRequest {
	id: string;
	method: string;
	path: string;
	authIsFakeKey: boolean | null;
	/** A different key was sent: the runner fails the case. */
	bad: boolean;
	/** Allow-listed only. */
	headers: Record<string, string>;
	/** Every header name sent (names only, no values). */
	headerNames?: string[];
	body: unknown;
}
