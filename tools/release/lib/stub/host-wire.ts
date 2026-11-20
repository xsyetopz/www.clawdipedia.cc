// Wire shapes of the fake Remote Control service: SSE frames, the host announce, and the host's tool answer.

/** The name the fake machine announces; a model tool call picks it with `_host`. */
export const HOST_NAME = "testhost";

/** A frame payload the service delivers to the worker. */
export interface HostPayload {
	type: string;
	[key: string]: unknown;
}

/** Formats one worker event as a server-sent event frame. */
export const sse = (
	seq: number,
	payload: HostPayload,
	status: string
): string =>
	`event: client_event\nid: ${seq}\ndata: ${JSON.stringify({
		event_id: `ev${seq}`,
		sequence_num: seq,
		event_type: payload.type,
		source: "client",
		created_at: new Date().toISOString(),
		payload,
		device_attestation_status: status,
		host_frame_admitted: true
	})}\n\n`;

/** The host and its one tool, in the shapes of the program's announce schema. */
export const announce: HostPayload = {
	type: "control_request",
	request_id: "req-announce-1",
	request: {
		subtype: "remote_tools_announce",
		instance_id: "inst-0001abcd",
		worker_epoch: 1,
		host: {
			name: HOST_NAME,
			kind: "personal_machine",
			platform: "darwin",
			working_dir: "/tmp/hostwd",
			project_sync: "off",
			claude_code_version: "2.1.327",
			// A string: the schema rejects a number here.
			epoch: "e1",
			limits: {
				max_call_ms: 60_000,
				max_request_bytes: 1_048_576,
				max_in_flight: 4
			}
		},
		tools: [{ name: "Bash", refused_input_fields: [], protocol_versions: [1] }],
		passthrough: [],
		plumbing: []
	}
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null;

/** Picks the `remote_tool_call` control requests out of a POST /worker/events body. */
export const toolCalls = (body: string): Record<string, unknown>[] => {
	const parsed: unknown = JSON.parse(body);
	const events = isRecord(parsed) ? parsed["events"] : undefined;
	if (!Array.isArray(events)) {
		return [];
	}
	const out: Record<string, unknown>[] = [];
	const list: unknown[] = events;
	for (const e of list) {
		const payload = isRecord(e) ? e["payload"] : undefined;
		const request = isRecord(payload) ? payload["request"] : undefined;
		if (
			isRecord(payload) &&
			isRecord(request) &&
			request["subtype"] === "remote_tool_call"
		) {
			out.push(payload);
		}
	}
	return out;
};

/** Builds the host's control_response to a `remote_tool_call` payload. */
export const answerTo = (
	req: Record<string, unknown>,
	disposition: string
): HostPayload => {
	const request = isRecord(req["request"]) ? req["request"] : {};
	const env = isRecord(request["envelope"]) ? request["envelope"] : {};
	const content = `Host answer: ${disposition}.`;
	const isError = disposition !== "ran";
	const envelope = {
		v: 1,
		outcome: "completed",
		call_id: env["call_id"] ?? request["tool_use_id"],
		target: { name: HOST_NAME, working_dir: "/tmp/hostwd" },
		is_error: isError,
		content,
		disposition
	};
	return {
		type: "control_response",
		response: {
			subtype: "success",
			request_id: req["request_id"],
			response: {
				result: {
					content: [{ type: "text", text: content }],
					isError,
					structuredContent: { "anthropic/remoteToolExecution": envelope }
				}
			}
		}
	};
};
