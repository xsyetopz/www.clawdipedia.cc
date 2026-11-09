// clawdipedia-docs MCP server (stdio). Read-only. No telemetry.
// A thin front end on core.ts, which reads four sources live (clawdipedia, platform, code, claude-resources) and caches every fetch on disk for offline use.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import pkg from "../package.json" with { type: "json" };
import {
	DEFAULT_PAGE_CHARS,
	DOC_SOURCES,
	list,
	MAX_PAGE_CHARS,
	read,
	type Result,
	schema,
	search,
} from "./core.ts";
import { present } from "./text.ts";

const READ_ONLY = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: true,
} as const;

// Claude Code shows the model only structuredContent when a reply has it (design D7), so send it
// only when it holds everything that the text holds. Pages and schemas send text only.
const reply = (r: Result) =>
	r.ok
		? {
				content: [{ type: "text" as const, text: r.text }],
				...(r.complete ? { structuredContent: r.data } : {}),
			}
		: { isError: true, content: [{ type: "text" as const, text: r.text }] };

const source = z
	.enum(DOC_SOURCES)
	.default("clawdipedia")
	.describe(
		"clawdipedia: these unofficial Claude Code docs. platform: platform.claude.com/docs. code: code.claude.com/docs (official Claude Code docs). claude-resources: claude.com/resources (articles, guides, webinars).",
	);

const SECTION = "Top-level section (clawdipedia) or group/section (others)";

const server = new McpServer({
	name: "clawdipedia-docs",
	version: pkg.version,
});

server.registerTool(
	"search_docs",
	{
		description:
			"Full-text search over one docs source (see source). Returns routes, titles, and snippets.",
		inputSchema: {
			query: z.string().min(1).max(200).describe("Keywords or an identifier"),
			source,
			limit: z.number().int().min(1).max(25).default(8),
			section: z.string().optional().describe(SECTION),
		},
		annotations: READ_ONLY,
	},
	async (a) => reply(await search(a)),
);

server.registerTool(
	"read_page",
	{
		description:
			"Read one page of a docs source as markdown (claude-resources pages are converted from HTML).",
		inputSchema: {
			route: z.string().min(1).describe("Route from search_docs or list_pages"),
			source,
			section_heading: z.string().optional().describe("Return only this H2"),
			offset: z.number().int().min(0).default(0),
			max_chars: z
				.number()
				.int()
				.min(1000)
				.max(MAX_PAGE_CHARS)
				.default(DEFAULT_PAGE_CHARS),
		},
		annotations: READ_ONLY,
	},
	async ({ route, source: docSource, section_heading, offset, max_chars }) =>
		reply(
			await read({
				route,
				source: docSource,
				...(present(section_heading) ? { heading: section_heading } : {}),
				offset,
				maxChars: max_chars,
			}),
		),
);

server.registerTool(
	"list_pages",
	{
		description:
			"List the pages of one docs source (see source) with routes and titles. Without a section, remote sources list their groups.",
		inputSchema: {
			source,
			section: z.string().optional().describe(SECTION),
		},
		annotations: READ_ONLY,
	},
	async (a) => reply(await list(a)),
);

server.registerTool(
	"get_schema",
	{
		description:
			"Exact fields of a Claude Code config file or payload, from a JSON Schema or the Mod API types.",
		inputSchema: {
			name: z.string().min(1).describe("E.g. settings, tools, or types"),
			property: z.string().optional().describe("Dotted path or type name"),
			offset: z.number().int().min(0).default(0),
		},
		annotations: READ_ONLY,
	},
	async (a) => reply(await schema(a)),
);

await server.connect(new StdioServerTransport());
