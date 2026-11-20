import { afterEach, describe, expect, test } from "bun:test";

import {
	HOST_SESSION_ID,
	type HostMock,
	hostSdkUrl,
	startHostMock
} from "./host.ts";

let mock: HostMock | undefined;
afterEach(async () => {
	await mock?.stop();
	mock = undefined;
});

const viaProxy = (
	m: HostMock,
	path: string,
	init: RequestInit = {}
): Promise<Response> => {
	const env = m.env();
	// Bun's fetch accepts `proxy` and `tls`, which RequestInit does not declare.
	const bunInit: BunFetchRequestInit = {
		...init,
		proxy: env["HTTPS_PROXY"],
		tls: { ca: Bun.file(env["NODE_EXTRA_CA_CERTS"] ?? "") }
	};
	return fetch(`${hostSdkUrl()}${path}`, bunInit);
};

interface Frame {
	payload: Record<string, unknown>;
	device_attestation_status: string;
}

const toFrame = (line: string): Frame => {
	const raw: unknown = JSON.parse(line.slice(6));
	if (
		typeof raw === "object" &&
		raw !== null &&
		"payload" in raw &&
		"device_attestation_status" in raw &&
		typeof raw.payload === "object" &&
		raw.payload !== null &&
		typeof raw.device_attestation_status === "string"
	) {
		return {
			payload: Object.fromEntries(Object.entries(raw.payload)),
			device_attestation_status: raw.device_attestation_status
		};
	}
	throw new Error(`unexpected frame: ${line}`);
};

// Reads until `count` frames arrived; each read waits on the network, so the reads are sequential by nature.
const frames = async (
	reader: ReadableStreamDefaultReader<Uint8Array>,
	count: number,
	text = "",
	out: Frame[] = []
): Promise<Frame[]> => {
	if (out.length >= count) {
		return out;
	}
	const { value, done } = await reader.read();
	if (done) {
		return out;
	}
	const blocks = (text + new TextDecoder().decode(value)).split("\n\n");
	const rest = blocks.pop() ?? "";
	for (const block of blocks) {
		const line = block.split("\n").find((l) => l.startsWith("data: "));
		if (line !== undefined) {
			out.push(toFrame(line));
		}
	}
	return frames(reader, count, rest, out);
};

describe("host mock", () => {
	test("registers a worker for an Anthropic host name through the proxy", async () => {
		// Arrange
		mock = await startHostMock();
		// Act
		const res = await viaProxy(mock, "/worker/register", {
			method: "POST",
			body: "{}"
		});
		// Assert
		expect(await res.json()).toEqual({ worker_epoch: 1 });
		expect(mock.requests[0]?.path).toBe(
			`/v1/code/sessions/${HOST_SESSION_ID}/worker/register`
		);
	});

	test("announces a host, then answers a tool call with the chosen disposition", async () => {
		// Arrange
		mock = await startHostMock({ disposition: "denied_by_user" });
		const res = await viaProxy(mock, "/worker/events/stream");
		const reader = res.body?.getReader();
		if (reader === undefined) {
			throw new Error("no stream body");
		}
		// Act
		const first = await frames(reader, 2);
		await viaProxy(mock, "/worker/events", {
			method: "POST",
			body: JSON.stringify({
				events: [
					{
						payload: {
							type: "control_request",
							request_id: "r1",
							request: {
								subtype: "remote_tool_call",
								tool_use_id: "toolu_1",
								envelope: { call_id: "toolu_1" }
							}
						}
					}
				]
			})
		});
		const [answer] = await frames(reader, 1);
		await reader.cancel();
		// Assert
		expect(res.headers.get("x-ccr-session-writers")).toBe(
			"v=1;owner_account_only=true"
		);
		expect(first[0]?.payload["type"]).toBe("control_request");
		expect(first[1]?.payload["type"]).toBe("user");
		expect(answer?.device_attestation_status).toBe("VERIFIED_BY_GATE");
		expect(JSON.stringify(answer?.payload)).toContain(
			'"disposition":"denied_by_user"'
		);
		expect(mock.calls).toHaveLength(1);
	}, 20_000);
});
