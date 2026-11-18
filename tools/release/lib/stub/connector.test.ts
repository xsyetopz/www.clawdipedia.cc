import { afterEach, expect, test } from "bun:test";

import {
	CONNECTOR_ID,
	CONNECTOR_URL,
	type ConnectorMock,
	startConnectorMock,
} from "./connector.ts";

let mock: ConnectorMock | undefined;
afterEach(async () => {
	await mock?.stop();
	mock = undefined;
});

const viaProxy = (
	m: ConnectorMock,
	url: string,
	init: RequestInit = {},
): Promise<Response> => {
	const env = m.env();
	// Bun's fetch accepts `proxy` and `tls`, which RequestInit does not declare.
	const bunInit: BunFetchRequestInit = {
		...init,
		proxy: env["HTTPS_PROXY"],
		tls: { ca: Bun.file(env["NODE_EXTRA_CA_CERTS"] ?? "") },
	};
	return fetch(url, bunInit);
};

const rpc = (id: number | undefined, method: string): RequestInit => ({
	method: "POST",
	headers: { "content-type": "application/json" },
	body: JSON.stringify({
		jsonrpc: "2.0",
		method,
		...(id === undefined ? {} : { id }),
	}),
});

test("lists one reportable connector on api.anthropic.com", async () => {
	// Arrange
	mock = await startConnectorMock();

	// Act
	const r = await viaProxy(
		mock,
		"https://api.anthropic.com/v1/mcp_servers?limit=1000",
	);

	// Assert
	expect(await r.json()).toMatchObject({
		data: [{ id: CONNECTOR_ID, url: CONNECTOR_URL, url_reportable: true }],
	});
});

test("answers MCP on the proxy host: a tool list, and 202 for a notification", async () => {
	// Arrange
	mock = await startConnectorMock();
	const url = `https://mcp-proxy.anthropic.com/v1/mcp/${CONNECTOR_ID}`;

	// Act
	const list = await viaProxy(mock, url, rpc(2, "tools/list"));
	const note = await viaProxy(
		mock,
		url,
		rpc(undefined, "notifications/initialized"),
	);

	// Assert
	expect(await list.json()).toMatchObject({
		id: 2,
		result: { tools: [{ name: "ping" }] },
	});
	expect(note.status).toBe(202);
	expect(mock.requests.map((q) => q.host)).toEqual([
		"mcp-proxy.anthropic.com",
		"mcp-proxy.anthropic.com",
	]);
});

test("any other path is 404", async () => {
	// Arrange
	mock = await startConnectorMock();

	// Act
	const r = await viaProxy(mock, "https://api.anthropic.com/api/oauth/profile");

	// Assert
	expect(r.status).toBe(404);
});
