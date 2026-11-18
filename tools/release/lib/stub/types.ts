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

/**
 * A scripted answer to one main-loop POST /v1/messages: an assistant message with the given content and stop
 * fields, or an HTTP error with a JSON body.
 */
export type StubReply =
	| {
			kind: "message";
			content: { type: string; [k: string]: unknown }[];
			stop_reason: string;
			stop_details?: unknown;
			/** The stream sends no content_block_stop for the last block, as a reply cut at the output limit. */
			open?: boolean;
	  }
	| {
			kind: "error";
			status: number;
			body: unknown;
			/** Answer only the first request at this index; a retry gets the default reply. */
			once?: boolean;
	  };

/** A scripted answer for any main-loop request whose last message contains `match`. */
export interface StubRule {
	match: string;
	reply: StubReply;
}

export interface StubCase {
	/**
	 * Scripted answers by the text of the last message, checked before `turns`. An agent's requests start at
	 * zero tool results, as the main loop does; a rule tells them apart by the prompt the agent got.
	 */
	rules?: StubRule[];
	/**
	 * Scripted answers, indexed by the number of `tool_result` blocks in the request, as `seq` is. An entry
	 * replaces the `seq` turn at its index. Requests without tools (side queries) get the default reply.
	 */
	turns?: (StubReply | null)[];
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
	/** The `input_tokens` that POST /v1/messages/count_tokens answers (default 10); a large value makes a file read exceed its token limit. */
	countTokens?: number;
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
