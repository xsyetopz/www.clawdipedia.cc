import { describe, expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { allocPort } from "../ports.ts";
import { startStub } from "../stub.ts";
import { type ApiReq, reply, stream } from "./replies.ts";
import type { StubCase, StubReply } from "./types.ts";

const api = (toolResults: number, tools = ["Bash"], last = ""): ApiReq => ({
	model: "m",
	stream: true,
	toolResults,
	toolNames: new Set(tools),
	last
});

const REFUSAL: StubReply = {
	kind: "message",
	content: [{ type: "text", text: "no" }],
	stop_reason: "refusal",
	stop_details: { cyber_verification: { type: "required" } }
};

describe("stub turns", () => {
	test("a message turn replaces the reply at its tool-result index", () => {
		// Arrange
		const o: StubCase = { log: "", turns: [null, REFUSAL] };

		// Act
		const first = reply(api(0), o);
		const second = reply(api(1), o);

		// Assert
		expect(first.stop_reason).toBe("end_turn");
		expect(second.stop_reason).toBe("refusal");
		expect(second.stop_details).toEqual({
			cyber_verification: { type: "required" }
		});
	});

	test("a rule whose text is in the last message wins over turns", () => {
		// Arrange
		const o: StubCase = {
			log: "",
			turns: [null],
			rules: [{ match: "SUBPROMPT", reply: REFUSAL }]
		};

		// Act
		const agent = reply(api(0, ["Bash"], '{"content":"SUBPROMPT"}'), o);
		const main = reply(api(0, ["Bash"], '{"content":"hi"}'), o);

		// Assert
		expect(agent.stop_reason).toBe("refusal");
		expect(main.stop_reason).toBe("end_turn");
	});

	test("a request without tools gets the default reply", () => {
		// Arrange
		const o: StubCase = { log: "", turns: [REFUSAL] };

		// Act
		const m = reply(api(0, []), o);

		// Assert
		expect(m.stop_reason).toBe("end_turn");
	});

	test("the stream carries stop_details in message_delta", () => {
		// Arrange
		const m = reply(api(0), { log: "", turns: [REFUSAL] });

		// Act
		const text = stream(m);

		// Assert
		expect(text).toContain('"stop_details":{"cyber_verification"');
	});

	test("an open turn leaves its last block without content_block_stop", () => {
		// Arrange
		const cut: StubReply = {
			kind: "message",
			content: [
				{ type: "text", text: "a" },
				{ type: "tool_use", id: "toolu_x", name: "Bash", input: {} }
			],
			stop_reason: "max_tokens",
			open: true
		};

		// Act
		const text = stream(reply(api(0), { log: "", turns: [cut] }));

		// Assert
		expect(text.match(/event: content_block_stop/gu)?.length).toBe(1);
		expect(text).toContain('"stop_reason":"max_tokens"');
		expect(text).not.toContain('"open"');
	});

	test("an error turn answers with its status and body", async () => {
		// Arrange
		const stub = await startStub(await allocPort());
		const body = { type: "error", error: { type: "overloaded_error" } };
		const log = join(tmpdir(), `stub-turns-${process.pid}.jsonl`);
		const base = await stub.register("err", {
			log,
			turns: [{ kind: "error", status: 529, body }]
		});

		// Act
		const res = await fetch(`${base}/v1/messages`, {
			method: "POST",
			body: JSON.stringify({ tools: [{ name: "Bash" }], messages: [] })
		});

		// Assert
		expect(res.status).toBe(529);
		expect(await res.json()).toEqual(body);
		await stub.stop();
		await rm(log, { force: true });
	});

	test("a once error turn answers only the first request at its index", async () => {
		// Arrange
		const stub = await startStub(await allocPort());
		const log = join(tmpdir(), `stub-once-${process.pid}.jsonl`);
		const base = await stub.register("once", {
			log,
			turns: [{ kind: "error", status: 400, once: true, body: {} }]
		});
		const post = () =>
			fetch(`${base}/v1/messages`, {
				method: "POST",
				body: JSON.stringify({ tools: [{ name: "Bash" }], messages: [] })
			});

		// Act
		const first = await post();
		const second = await post();

		// Assert
		expect(first.status).toBe(400);
		expect(second.status).toBe(200);
		await stub.stop();
		await rm(log, { force: true });
	});
});
