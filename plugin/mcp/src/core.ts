// Search core shared by the MCP server (server.ts) and the CLI (cli/src/cli.ts).
// search, read, list, and schema each return { text, data, source }. They never throw for a network problem or a miss:
// the reply has ok: false and a message that is safe to show.
// The code lives in core/*.ts; this file is the facade that re-exports it.
export { type ListArgs, list } from "./core/list.ts";
export { type ReadArgs, read } from "./core/read.ts";
export { type SchemaArgs, schema } from "./core/schema.ts";
export { type SearchArgs, search } from "./core/search.ts";
export {
	DEFAULT_PAGE_CHARS,
	DOC_SOURCES,
	type DocSourceName,
	isDocSource,
	MAX_PAGE_CHARS,
	type Result,
} from "./core/shared.ts";
