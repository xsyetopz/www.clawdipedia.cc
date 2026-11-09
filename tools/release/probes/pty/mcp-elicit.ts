// Minimal MCP stdio server for the Elicitation probes (ported from p305-pty/mcp-elicit.ts).
// Tools: echo, ask (form elicitation), askurl (URL-mode elicitation). Every message is logged to $ELICIT_LOG (a sandbox path).
import { appendFile } from "node:fs/promises";

import { show } from "../print/run/helpers.ts";
import { eachInOrder } from "../print/run/seq.ts";
import { type Obj, obj } from "../print/run/types.ts";

const LOG = process.env["ELICIT_LOG"] ?? "";
const log = async (s: string): Promise<void> => {
	if (LOG !== "") {
		await appendFile(LOG, `${s}\n`);
	}
};
const send = async (o: unknown): Promise<void> => {
	await log(`OUT ${JSON.stringify(o)}`);
	process.stdout.write(`${JSON.stringify(o)}\n`);
};
const reply = (id: unknown, result: unknown): Promise<void> =>
	send({ jsonrpc: "2.0", id, result });
const text = (t: string) => ({ content: [{ type: "text", text: t }] });

let nextId = 1000;
const pending = new Map<number, (r: unknown) => Promise<void>>();

const initialize = (m: Obj): Promise<void> =>
	reply(m["id"], {
		protocolVersion: obj(m["params"])["protocolVersion"] ?? "2025-06-18",
		capabilities: { tools: {} },
		serverInfo: { name: "probe", version: "1" },
	});

const toolsList = (m: Obj): Promise<void> =>
	reply(m["id"], {
		tools: ["echo", "askurl", "ask"].map((name) => ({
			name,
			description: name,
			inputSchema: { type: "object", properties: {} },
		})),
	});

const URL_ELICIT = {
	mode: "url",
	message: "PROBE-URL: sign in",
	// `.invalid` never resolves (RFC 2606 section 2), so accepting the dialog cannot reach a
	// third-party host. IANA says not to rely on example.com for testing.
	url: "https://probe.invalid/auth",
	elicitationId: "el-1",
};

const FORM_ELICIT = {
	message: "PROBE-ELICIT: pick a color",
	requestedSchema: {
		type: "object",
		properties: { color: { type: "string", title: "Color" } },
		required: ["color"],
	},
};

const ask = async (m: Obj, url: boolean): Promise<void> => {
	const id = nextId++;
	await send({
		jsonrpc: "2.0",
		id,
		method: "elicitation/create",
		params: url ? URL_ELICIT : FORM_ELICIT,
	});
	pending.set(id, async (r) => {
		if (url) {
			await send({
				jsonrpc: "2.0",
				method: "notifications/elicitation/complete",
				params: { elicitationId: "el-1" },
			});
		}
		await reply(
			m["id"],
			text(`${url ? "url" : "elicit"} result ${JSON.stringify(r)}`),
		);
	});
};

const toolCall = (m: Obj): Promise<void> => {
	const params = obj(m["params"]);
	const name = params["name"];
	if (name === "echo") {
		return reply(
			m["id"],
			text(`echo:${show(obj(params["arguments"])["text"] ?? "")}`),
		);
	}
	return ask(m, name === "askurl");
};

const handle = async (m: Obj): Promise<void> => {
	const { id, method } = m;
	if (method === "initialize") {
		await initialize(m);
	} else if (method === "tools/list") {
		await toolsList(m);
	} else if (method === "tools/call") {
		await toolCall(m);
	} else if (
		typeof id === "number" &&
		(method === undefined || method === "")
	) {
		const done = pending.get(id);
		if (done !== undefined) {
			pending.delete(id);
			await done(m["result"] ?? m["error"]);
		}
	} else if (id !== undefined && method !== undefined && method !== "") {
		await reply(id, {});
	}
};

const handleLine = async (line: string): Promise<void> => {
	if (line.trim() !== "") {
		await log(`IN ${line}`);
		await handle(obj(JSON.parse(line)));
	}
};

let buf = "";
let chain: Promise<void> = Promise.resolve();
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d: string) => {
	buf += d;
	const lines = buf.split("\n");
	buf = lines.pop() ?? "";
	const prev = chain;
	chain = (async () => {
		await prev;
		await eachInOrder(lines, handleLine);
	})();
});
