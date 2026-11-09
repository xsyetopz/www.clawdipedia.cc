import { arr, obj } from "../run.ts";
import { type CaseDef, json, type Run, show, withRun } from "../run/helpers.ts";

/** A subcommand run: records the first lines the program prints. */
export const sub = (name: string, argv: string[]): CaseDef => ({
	name,
	run: (ctx) =>
		withRun(ctx, { argv }, (r) => ({
			from: r,
			data: { exit: r.code },
			samples: {
				out: r.stdout.split("\n").slice(0, 4).join("\n").slice(0, 600),
				err: r.stderr.split("\n").slice(0, 4).join("\n").slice(0, 600),
			},
		})),
});

const rpc = (id: number, method: string, params: unknown): string =>
	`${json({ jsonrpc: "2.0", id, method, params })}\n`;

const chromeOut = (r: Run) => {
	const replies = r.stdout
		.split("\n")
		.filter((l) => l.startsWith("{"))
		.map((l) => obj(JSON.parse(l)));
	const listed = obj(replies.find((m) => m["id"] === 2)?.["result"]);
	const names = arr(listed["tools"]).map((t) => show(obj(t)["name"]));
	return {
		from: r,
		data: {
			precondition: names.includes("tabs_context_mcp"),
			tools: names.join(","),
			shortcutsListed: names.some((n) => n.startsWith("shortcuts_")),
		},
		samples: {
			call: json(replies.find((m) => m["id"] === 3) ?? null).slice(0, 500),
		},
	};
};

/** The built-in browser server (`--claude-in-chrome-mcp`, the flag the program starts it with) over stdio, with no extension: its tool list, and the answer to one call. */
export const chromeTools = (tool: string): CaseDef => ({
	name: `chrome-tools.${tool}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				argv: ["--claude-in-chrome-mcp"],
				stdin: [
					rpc(1, "initialize", {
						protocolVersion: "2025-06-18",
						capabilities: {},
						clientInfo: { name: "probe", version: "0" },
					}),
					`${json({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`,
					rpc(2, "tools/list", {}),
					rpc(3, "tools/call", { name: tool, arguments: {} }),
				].join(""),
				stdinOpenMs: 8000,
				timeoutMs: 30_000,
			},
			chromeOut,
		),
});
