// A fake claude.ai connector service: the connector list on api.anthropic.com and one MCP server behind the MCP
// proxy host. The program lists the connectors of a login with the user:mcp_servers scope, and talks MCP to each one
// through the MCP proxy, not through the connector's own address. A connector whose address the service marks as
// reportable lends that address to its tools as `ownership_metadata.server_url`.
import { startTlsProxy } from "./tls-proxy.ts";

/** The connector id; the program reaches its MCP server at `/v1/mcp/<id>` on the MCP proxy host. */
export const CONNECTOR_ID = "probeconn";

/** The address the connector list reports for the connector. The program never contacts it. */
export const CONNECTOR_URL = "https://mcp.example.invalid/v1/probe";

/** One request the mock received. */
export interface ConnectorRequest {
	method: string;
	host: string;
	path: string;
}

/** A running mock. */
export interface ConnectorMock {
	/** Every request received, in order. */
	requests: ConnectorRequest[];
	/** Env for the child: proxy and trusted certificate. */
	env: () => Record<string, string>;
	/** Stops the servers and removes the certificate. */
	stop: () => Promise<void>;
}

const LIST = {
	data: [
		{
			id: CONNECTOR_ID,
			display_name: "Probe",
			url: CONNECTOR_URL,
			url_reportable: true,
			directory_entry_id: "probe-directory-entry"
		}
	],
	next_page: null
};

// The tool is always loaded, so the first request lists it in tools[] even when tool search defers MCP tools.
const TOOLS = [
	{
		name: "ping",
		description: "Ping.",
		_meta: { "anthropic/alwaysLoad": true },
		inputSchema: { type: "object", properties: {} }
	}
];

const resultOf = (method: string): unknown => {
	if (method === "initialize") {
		return {
			protocolVersion: "2025-06-18",
			capabilities: { tools: {} },
			serverInfo: { name: "probe", version: "1.0.0" }
		};
	}
	return method === "tools/list" ? { tools: TOOLS } : {};
};

// Streamable HTTP with plain JSON replies. A notification (no id) gets 202 and no body.
const answerMcp = async (req: Request): Promise<Response> => {
	if (req.method !== "POST") {
		return new Response(null, { status: 405 });
	}
	const raw: unknown = await req.json();
	const msg: Record<string, unknown> =
		typeof raw === "object" && raw !== null
			? Object.fromEntries(Object.entries(raw))
			: {};
	if (msg["id"] === undefined) {
		return new Response(null, { status: 202 });
	}
	const method = typeof msg["method"] === "string" ? msg["method"] : "";
	return Response.json({
		jsonrpc: "2.0",
		id: msg["id"],
		result: resultOf(method)
	});
};

/** Starts the mock for api.anthropic.com and mcp-proxy.anthropic.com. Every other request gets 404. */
export const startConnectorMock = async (): Promise<ConnectorMock> => {
	const requests: ConnectorRequest[] = [];
	const server = await startTlsProxy(
		["api.anthropic.com", "mcp-proxy.anthropic.com"],
		(req) => {
			const u = new URL(req.url);
			const host = req.headers.get("host") ?? u.host;
			requests.push({ method: req.method, host, path: u.pathname });
			if (u.pathname === "/v1/mcp_servers") {
				return Response.json(LIST);
			}
			if (u.pathname === `/v1/mcp/${CONNECTOR_ID}`) {
				return answerMcp(req);
			}
			return new Response(null, { status: 404 });
		}
	);
	return { requests, env: () => server.env, stop: server.stop };
};
