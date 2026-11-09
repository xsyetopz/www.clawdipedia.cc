import { join } from "node:path";

import type { Sandbox } from "../../../lib/sandbox.ts";
import { SRV } from "../../print/api319.ts";
import { obj } from "../harness.ts";

type Reply = (result: unknown) => Response;

const answer = (m: Record<string, unknown>, reply: Reply): Response => {
	if (m["method"] === "initialize") {
		return reply({
			protocolVersion: "2025-06-18",
			capabilities: { tools: {} },
			serverInfo: { name: "p", version: "1" },
		});
	}
	if (m["method"] === "tools/list") {
		return reply({
			tools: [
				{
					name: "ping",
					description: "p",
					inputSchema: { type: "object", properties: {} },
				},
			],
		});
	}
	return m["id"] === undefined
		? new Response(null, { status: 202 })
		: reply({});
};

/** A local HTTP MCP server: the only kind with a server URL for ownership_metadata to name. */
export const httpServer = () =>
	Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: async (req) => {
			const m = obj(await req.json().catch(() => ({})));
			return answer(m, (result) =>
				Response.json({ jsonrpc: "2.0", id: m["id"], result }),
			);
		},
	});

/** Writes the stdio server script and the --mcp-config file; returns the config path. */
export const writeMcp = async (
	sb: Sandbox,
	http: ReturnType<typeof httpServer> | undefined,
): Promise<string> => {
	const cfg = join(sb.home, "m", "mcp.json");
	await Bun.write(join(sb.home, "m", "srv.js"), SRV);
	await Bun.write(
		cfg,
		JSON.stringify({
			mcpServers: {
				psrv:
					http === undefined
						? { command: "bun", args: [join(sb.home, "m", "srv.js")] }
						: { type: "http", url: `http://127.0.0.1:${http.port}/mcp` },
			},
		}),
	);
	return cfg;
};
