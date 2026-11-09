// Minimal stdio MCP server. Args: <name> <startedLog>. Appends "<name> pid=<pid>" to startedLog when it starts.
import { appendFile } from "node:fs/promises";

const name = process.argv[2] ?? "srv";
const startedLog = process.argv[3];
if (startedLog !== undefined && startedLog !== "") {
	await appendFile(startedLog, `${name} pid=${process.pid}\n`).catch(() => {
		// the log is best effort
	});
}

/** @param {object} o */
const send = (o) => process.stdout.write(`${JSON.stringify(o)}\n`);

/** @param {string} method @param {unknown} version */
const reply = (method, version) => {
	if (method === "initialize") {
		return {
			protocolVersion: typeof version === "string" ? version : "2025-06-18",
			capabilities: { tools: {} },
			serverInfo: { name, version: "1.0.0" },
		};
	}
	if (method === "tools/list") {
		return {
			tools: [
				{
					name: "ping",
					description: `ping from ${name}`,
					inputSchema: { type: "object", properties: {} },
				},
			],
		};
	}
	if (method === "tools/call") {
		return { content: [{ type: "text", text: "pong" }] };
	}
	return {};
};

/** @param {string} line */
const handle = (line) => {
	/** @type {unknown} */
	let m;
	try {
		m = JSON.parse(line);
	} catch {
		return;
	}
	if (typeof m !== "object" || m === null || !("id" in m)) {
		return;
	}
	const params =
		"params" in m && typeof m.params === "object" ? m.params : null;
	const version =
		params !== null && "protocolVersion" in params
			? params.protocolVersion
			: undefined;
	const method = "method" in m && typeof m.method === "string" ? m.method : "";
	send({ jsonrpc: "2.0", id: m.id, result: reply(method, version) });
};

let buf = "";
process.stdin.on("data", (d) => {
	buf += String(d);
	const lines = buf.split("\n");
	buf = lines.pop() ?? "";
	for (const raw of lines) {
		const line = raw.trim();
		if (line !== "") {
			handle(line);
		}
	}
});
process.stdin.on("end", () => {
	process.exitCode = 0;
	process.stdin.destroy();
});
