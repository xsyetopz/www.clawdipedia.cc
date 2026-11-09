// Usage: bun tools/plugin/smoke.ts   (also: bun run plugin:smoke)
// Opt-in, needs network. Runs plugin/mcp/dist/server.js against the real sites with a temp cache:
// one search_docs, one read_page, one platform search_docs, one code search_docs, one claude-resources search_docs, and one clawdipedia search. Exits non-zero on any failure.
// Not part of verify. Run it after a deploy.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MCP = join(import.meta.dir, "..", "..", "plugin", "mcp");
const sdk = (p: string) =>
	join(MCP, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", p);

interface ToolResult {
	isError?: unknown;
	content?: unknown;
}
interface McpClient {
	connect: (transport: unknown) => Promise<void>;
	callTool: (call: {
		name: string;
		arguments: Record<string, unknown>;
	}) => Promise<ToolResult>;
	close: () => Promise<void>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null;

const isClient = (v: unknown): v is McpClient =>
	isRecord(v) &&
	typeof v["connect"] === "function" &&
	typeof v["callTool"] === "function" &&
	typeof v["close"] === "function";

/** Construct the named class exported by an SDK module. */
const construct = async (
	file: string,
	name: string,
	args: unknown[],
): Promise<unknown> => {
	const mod: unknown = await import(sdk(file));
	const ctor = isRecord(mod) ? mod[name] : undefined;
	if (typeof ctor !== "function") {
		throw new TypeError(`${file} has no ${name}`);
	}
	return Reflect.construct(ctor, args);
};

/** The text of the first content block of a tool result. */
const firstText = (r: ToolResult): string => {
	const first: unknown = Array.isArray(r.content) ? r.content[0] : undefined;
	return isRecord(first) && typeof first["text"] === "string"
		? first["text"]
		: "";
};

const cache = await mkdtemp(join(tmpdir(), "clawdipedia-docs-smoke-"));
const DROPPED = new Set([
	"CLAWDIPEDIA_BASE_URL",
	"PLATFORM_DOCS_BASE_URL",
	"CLAUDE_PLUGIN_DATA",
]);
const env: Record<string, string> = {
	...Object.fromEntries(
		Object.entries(process.env).filter(
			(e): e is [string, string] =>
				typeof e[1] === "string" && !DROPPED.has(e[0]),
		),
	),
	CLAWDIPEDIA_CACHE_DIR: cache,
};

const failures: string[] = [];

const step = async (
	client: McpClient,
	label: string,
	name: string,
	args: Record<string, unknown>,
) => {
	const t0 = Date.now();
	try {
		const r = await client.callTool({ name, arguments: args });
		const text = firstText(r);
		const ok = r.isError !== true && /Source:/u.test(text);
		console.info(`${ok ? "ok  " : "FAIL"} ${label} (${Date.now() - t0} ms)`);
		if (!ok) {
			failures.push(`${label}: ${text.slice(0, 300)}`);
		}
	} catch (error) {
		console.info(`FAIL ${label}`);
		failures.push(`${label}: ${String(error)}`);
	}
};

const steps: [label: string, name: string, args: Record<string, unknown>][] = [
	["search_docs", "search_docs", { query: "statusLine" }],
	["read_page", "read_page", { route: "configure/status-line" }],
	[
		"search_docs platform",
		"search_docs",
		{ query: "messages api", source: "platform" },
	],
	["search_docs code", "search_docs", { query: "hooks", source: "code" }],
	[
		"search_docs claude-resources",
		"search_docs",
		{ query: "agents", source: "claude-resources" },
	],
];

const runSteps = async (
	client: McpClient,
	rest: typeof steps,
): Promise<void> => {
	const [head, ...tail] = rest;
	if (head === undefined) {
		return;
	}
	await step(client, ...head);
	await runSteps(client, tail);
};

const cliStep = async (): Promise<void> => {
	const t0 = Date.now();
	const cli = Bun.spawn(
		[
			"bun",
			join(MCP, "..", "..", "cli", "bin", "clawdipedia"),
			"search",
			"hooks",
		],
		{ env, stdout: "pipe", stderr: "pipe" },
	);
	const [out, err, exitCode] = await Promise.all([
		new Response(cli.stdout).text(),
		new Response(cli.stderr).text(),
		cli.exited,
	]);
	const ok = exitCode === 0 && out.includes("Source:");
	console.info(
		`${ok ? "ok  " : "FAIL"} clawdipedia search (${Date.now() - t0} ms)`,
	);
	if (!ok) {
		failures.push(`clawdipedia search: ${(out + err).slice(0, 300)}`);
	}
};

const main = async (): Promise<void> => {
	const client = await construct("client/index.js", "Client", [
		{ name: "plugin-smoke", version: "0" },
	]);
	if (!isClient(client)) {
		throw new TypeError("the SDK Client has no connect, callTool, or close");
	}
	try {
		const transport = await construct(
			"client/stdio.js",
			"StdioClientTransport",
			[{ command: "bun", args: [join(MCP, "dist", "server.js")], env }],
		);
		await client.connect(transport);
		await runSteps(client, steps);
		await cliStep();
	} catch (error) {
		failures.push(`connect: ${String(error)}`);
	} finally {
		await client.close().catch(() => null);
		await rm(cache, { recursive: true, force: true });
	}
	if (failures.length > 0) {
		console.error(failures.join("\n"));
		process.exitCode = 1;
		return;
	}
	console.info("smoke passed");
};

await main();
