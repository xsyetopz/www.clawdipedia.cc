import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import pkg from "../../package.json" with { type: "json" };

export const READ_ONLY = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false,
} as const;
// `code` and `release` write the cache of cleaned code; `release` `notes` runs `gh release view`, and `code` `read`
// with `view: "readable"` runs `bunx @wakaru/cli`.
export const WRITES_CACHE = {
	...READ_ONLY,
	readOnlyHint: false,
} as const;
export const MAX_CHARS = 40_000;

export interface Out {
	[key: string]: unknown;
	content: { type: "text"; text: string }[];
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
}
export const text = (t: string, data?: Record<string, unknown>): Out => ({
	content: [{ type: "text", text: t }],
	...(data && { structuredContent: data }),
});
/** The message of a thrown value: an error's message, else the value as text. */
export const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
/** Whether an optional text argument holds some text: not missing and not empty. */
export const has = (s: string | undefined): s is string =>
	s !== undefined && s !== "";
/** Run a tool body; an error becomes a tool error with its message. */
export const run = async (f: () => Out | Promise<Out>): Promise<Out> => {
	try {
		return await f();
	} catch (error) {
		return {
			content: [{ type: "text", text: `Error: ${messageOf(error)}` }],
			isError: true,
		};
	}
};
export const clip = (s: string, n: number) =>
	s.length > n ? `${s.slice(0, n)}… (${s.length - n} more chars)` : s;
export const regex = (pattern: string, isRegex: boolean) =>
	new RegExp(
		isRegex
			? pattern
			: pattern.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`),
		"u",
	);

export const server = new McpServer({
	name: "cc-inspect",
	version: pkg.version,
});

/** Every argument a tool takes, by name. A tool lists the ones it takes (with its own descriptions); a handler gets them parsed. */
export const ARGS = {
	action: z.string().optional(),
	kind: z.string().optional(),
	version: z.string().optional(),
	query: z.string().min(1).optional(),
	regex: z.boolean().optional(),
	name: z.string().optional(),
	module: z.string().optional(),
	offset: z.number().int().min(0).optional(),
	limit: z.number().int().min(1).max(400).optional(),
	context: z.number().int().min(0).max(2000).optional(),
	length: z.number().int().min(1).max(MAX_CHARS).optional(),
	view: z.string().optional(),
	prompt: z.string().min(1).optional(),
	env: z.record(z.string(), z.string()).optional(),
	args: z.array(z.string()).optional(),
	files: z.record(z.string(), z.string()).optional(),
	replies: z.record(z.string(), z.unknown()).optional(),
	packageVersion: z.string().optional(),
	login: z.enum(["key", "oauth"]).optional(),
	show: z.string().optional(),
	apiHost: z.boolean().optional(),
	baseUrl: z.boolean().optional(),
	calls: z
		.array(
			z.object({
				name: z.string(),
				input: z.record(z.string(), z.unknown()),
				safeguard: z.enum(["flagged", "not_flagged"]).optional(),
			}),
		)
		.optional(),
	prompts: z.array(z.string()).min(1).optional(),
	request: z.number().int().min(1).optional(),
	tool: z.string().optional(),
	session: z.string().optional(),
	project: z.string().optional(),
	type: z.string().optional(),
	max_line_chars: z.number().int().min(100).max(MAX_CHARS).optional(),
	from: z.string().optional(),
	to: z.string().optional(),
	anchor: z.string().optional(),
};
const ARGS_SCHEMA = z.object(ARGS);
export type Args = z.infer<typeof ARGS_SCHEMA>;

// Shared parameters: the same name means the same thing in each tool.
export const P = {
	version: ARGS.version.describe(
		"Claude Code version or binary path; default: the current install.",
	),
	query: ARGS.query.describe("Text to find."),
	regex: ARGS.regex.describe("Treat query as a regular expression."),
	name: ARGS.name.describe("Name or filter (any case where it filters)."),
	module: ARGS.module.describe('Module name, e.g. "chunk-abc.js".'),
	offset: ARGS.offset,
	limit: ARGS.limit,
};

/** One tool whose operations are the values of `action`; each handler gets the parsed arguments. */
export const group = (
	tool: string,
	description: string,
	key: "action" | "kind",
	handlers: Record<string, (a: Args) => Out | Promise<Out>>,
	extra: Record<string, z.ZodType>,
	annotations: Record<string, boolean> = READ_ONLY,
) =>
	server.registerTool(
		tool,
		{
			description,
			inputSchema: {
				[key]: z
					.string()
					.optional()
					.describe(`One of: ${Object.keys(handlers).join(", ")}.`),
				...extra,
			},
			annotations,
		},
		(a: Record<string, unknown>) =>
			run(() => {
				const args = ARGS_SCHEMA.parse(a);
				const k = args[key] ?? "";
				const h = Object.hasOwn(handlers, k) ? handlers[k] : undefined;
				if (!h) {
					throw new Error(
						`unknown ${key} "${k}"; ${key}s: ${Object.keys(handlers).filter(Boolean).join(", ")}`,
					);
				}
				return h(args);
			}),
	);

export const need = (v: string | undefined, what: string): string => {
	if (!has(v)) {
		throw new Error(`give ${what}`);
	}
	return v;
};
