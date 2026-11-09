// Offline checks of the stub's Messages API replies: ids, safeguard verdicts, spacing, too-long, refused betas, memory MCP.
import { join } from "node:path";

import { readLog, type Stub } from "../../lib/stub.ts";
import { asRecord } from "../../lib/stub/replies.ts";
import { jsonOf, post, rejects, type Step } from "./util.ts";

const SG_VERDICT = JSON.stringify([
	{
		type: "dangerous_tool_use",
		status: {
			type: "available",
			tool_uses: { toolu_probe0: { type: "evaluated", outcome: "flagged" } },
		},
	},
]);

export interface StubEnv {
	step: Step;
	stub: Stub;
	stubPort: number;
	root: string;
}

const idChecks = async ({ step, stub, stubPort, root }: StubEnv) => {
	const dotted = !(await rejects(() =>
		stub.register("print.a.b", { log: join(root, "d.jsonl") }),
	));
	const dots = await rejects(() =>
		stub.register("a..b", { log: join(root, "e.jsonl") }),
	);
	await post(`http://127.0.0.1:${stubPort}/nope/v1/messages`, "{}");
	const strayLog = await readLog(stub.strayLog);
	const stray = strayLog.some((r) => r.bad);
	step(
		"stub: dotted ids ok, '..' rejected, stray requests logged bad",
		dotted && dots && stray,
	);
};

const safeguardCheck = async ({ step, stub, root }: StubEnv) => {
	const url = await stub.register("sg", {
		log: join(root, "sg.jsonl"),
		seq: [{ name: "Bash", input: { command: "true" } }],
		safeguard: "flagged",
	});
	const ask = async (stream: boolean): Promise<string> => {
		const r = await post(`${url}/v1/messages`, {
			stream,
			tools: [{ name: "Bash" }],
			messages: [],
		});
		return r.text();
	};
	const plain = await ask(false);
	const streamed = await ask(true);
	const delta =
		streamed
			.split("\n")
			.find((l) => l.includes("message_delta") && l.startsWith("data:")) ?? "";
	const inDelta = asRecord(asRecord(JSON.parse(delta.slice(5)))["delta"]);
	step(
		"stub: safeguard puts the auto mode verdict on the tool call, in plain and streamed replies",
		JSON.stringify(asRecord(JSON.parse(plain))["safeguard_results"]) ===
			SG_VERDICT &&
			JSON.stringify(inDelta["safeguard_results"]) === SG_VERDICT &&
			streamed.split("safeguard_results").length === 2,
	);
};

const gapCheck = async ({ step, stub, root }: StubEnv) => {
	const url = await stub.register("gap", {
		log: join(root, "gap.jsonl"),
		text: "abcdef",
		deltas: 3,
		gapMs: 150,
	});
	const start = Date.now();
	const r = await post(`${url}/v1/messages`, { stream: true, messages: [] });
	const text = await r.text();
	step(
		"stub: gapMs spaces the events of a streamed reply and deltas splits the text",
		Date.now() - start >= 150 * 7 &&
			text.split("event: content_block_delta").length === 4 &&
			text.includes('"text":"ab"') &&
			text.includes('"text":"ef"'),
	);
};

const tooLongCheck = async ({ step, stub, root }: StubEnv) => {
	const url = await stub.register("tl", {
		log: join(root, "tl.jsonl"),
		tooLongOn: 2,
	});
	const ask = async () => {
		const r = await post(`${url}/v1/messages`, { messages: [] });
		return { status: r.status, text: await r.text() };
	};
	const tl1 = await ask();
	const tl2 = await ask();
	const tl3 = await ask();
	const message = asRecord(asRecord(JSON.parse(tl2.text))["error"])["message"];
	step(
		"stub: tooLongOn answers only the Nth messages request with the prompt-is-too-long 400",
		tl1.status === 200 &&
			tl2.status === 400 &&
			typeof message === "string" &&
			/^prompt is too long: \d+ tokens > \d+ maximum$/u.test(message) &&
			tl3.status === 200,
	);
};

const refuseCheck = async ({ step, stub, root }: StubEnv) => {
	const url = await stub.register("rf", {
		log: join(root, "rf.jsonl"),
		refuseServerCheck: true,
	});
	const askBeta = async (beta: string): Promise<number> => {
		const r = await post(
			`${url}/v1/messages`,
			{ messages: [] },
			{ "anthropic-beta": beta },
		);
		return r.status;
	};
	step(
		"stub: refuseServerCheck answers 400 only to the dangerous-tool-use beta",
		(await askBeta("oauth-2025-04-20,dangerous-tool-use-2026-09-03")) === 400 &&
			(await askBeta("oauth-2025-04-20")) === 200,
	);
	const mcp = (body: unknown) =>
		post(`${new URL(url).origin}/v2/ccr-sessions/rf/memory/mcp`, body);
	const listed = await mcp({ jsonrpc: "2.0", id: 1, method: "tools/list" });
	const body = await jsonOf(listed);
	const tools = asRecord(body["result"])["tools"];
	const names = Array.isArray(tools)
		? tools.map((t) => asRecord(t)["name"])
		: [];
	const note = await mcp({
		jsonrpc: "2.0",
		method: "notifications/initialized",
	});
	step(
		"stub: the cloud memory path of a case lists the memory tools and takes notifications",
		names.includes("memory_write") && note.status === 202,
	);
};

export const stubChecks = async (env: StubEnv): Promise<void> => {
	await idChecks(env);
	await safeguardCheck(env);
	await gapCheck(env);
	await tooLongCheck(env);
	await refuseCheck(env);
};
