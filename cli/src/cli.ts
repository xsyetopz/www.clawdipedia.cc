#!/usr/bin/env bun
// clawdipedia: four doc sources (clawdipedia, platform, code, claude-resources) from a shell. A front end on the same core as the MCP server.
// Exit codes: 0 a result, 1 no result (no hit, unknown page, unknown schema property), 2 a usage error.
import { parseArgs } from "node:util";

import {
	DOC_SOURCES,
	type DocSourceName,
	isDocSource,
	list,
	read,
	type Result,
	schema,
	search,
} from "../../plugin/mcp/src/core.ts";

const USAGE = `Usage: clawdipedia <command> [options]

Commands:
  search <query>             Rank pages for keywords or an identifier
  read <route>               Print one page as markdown
  list [prefix]              List pages, or the pages of one section
  schema <name> [property]   Print a JSON Schema outline, one property, or a Mod API type

Options:
  --source <name>            clawdipedia (default): unofficial Claude Code Docs. platform: platform.claude.com/docs.
                             code: code.claude.com/docs. claude-resources: claude.com/resources
  --section <heading>        read: print only the H2 section with this heading
  --limit <n>                search: most hits, 1 to 25 (default 8)
  --offset <n>               read, schema: character offset to continue a long output
  --json                     Print JSON in place of text
  --help                     Print this help (also: clawdipedia <command> --help)

Each text output ends with a "Source:" line (live, cache, or offline cache).
Exit codes: 0 a result, 1 no result, 2 usage error.
`;

const COMMANDS = {
	search:
		"Usage: clawdipedia search <query> [--source clawdipedia|platform|code|claude-resources] [--limit <n>] [--json]\n\nRanks pages for keywords or an identifier (clawdipedia search PreToolUse).\nPrints the route, title, URL, and a snippet for each hit.\nThe first search reads one prebuilt index file and caches it.\n",
	read: "Usage: clawdipedia read <route> [--source clawdipedia|platform|code|claude-resources] [--section <heading>] [--offset <n>] [--json]\n\nPrints one page as markdown. A route comes from search or list, for example configure/status-line.\n--section prints only the H2 section with that heading.\nA long page ends its header line with the offset for --offset.\n",
	list: "Usage: clawdipedia list [prefix] [--source clawdipedia|platform|code|claude-resources] [--json]\n\nLists pages in sidebar order. A prefix is a top-level section (clawdipedia) or a group or section (the other sources), for example configure.\n",
	schema:
		"Usage: clawdipedia schema <name> [property] [--offset <n>] [--json]\n\nPrints the outline of a JSON Schema (settings, tools, hook-output, ...), one property of it (hooks.PreToolUse), or a definition (BashInput.command).\nWith the name types, prints names of the Mod API type file, or the type, member, call, or event that the property names.\n",
} as const;
type Command = keyof typeof COMMANDS;
const isCommand = (s: string | undefined): s is Command =>
	s !== undefined && Object.hasOwn(COMMANDS, s);

class UsageError extends Error {}

const parse = (argv: string[]) => {
	try {
		return parseArgs({
			args: argv,
			allowPositionals: true,
			options: {
				source: { type: "string" },
				section: { type: "string" },
				limit: { type: "string" },
				offset: { type: "string" },
				json: { type: "boolean" },
				help: { type: "boolean", short: "h" },
			},
		});
	} catch (error) {
		throw new UsageError(
			error instanceof Error ? error.message : String(error),
		);
	}
};

type Values = ReturnType<typeof parse>["values"];

const int = (
	name: string,
	v: string | undefined,
	min: number,
	max: number,
): number | undefined => {
	const n = v === undefined ? undefined : Number(v);
	if (n !== undefined && (!Number.isInteger(n) || n < min || n > max)) {
		throw new UsageError(
			`--${name} needs a whole number from ${min} to ${max}`,
		);
	}
	return n;
};

const MAX_INT = Number.MAX_SAFE_INTEGER;

/** Throws when an option is set for a command it does not apply to. */
const checkOptions = (command: Command, values: Values) => {
	const only = (opt: keyof Values, ...on: Command[]) => {
		if (values[opt] !== undefined && !on.includes(command)) {
			throw new UsageError(`--${opt} does not apply to ${command}`);
		}
	};
	only("source", "search", "read", "list");
	only("section", "read");
	only("limit", "search");
	only("offset", "read", "schema");
};

const sourceOf = (values: Values): DocSourceName => {
	const source = values.source ?? "clawdipedia";
	if (!isDocSource(source)) {
		throw new UsageError(
			`--source needs one of ${DOC_SOURCES.join(", ")}, not "${source}"`,
		);
	}
	return source;
};

const present = (s: string | undefined): s is string =>
	s !== undefined && s !== "";

const need = (
	command: Command,
	args: string[],
	min: number,
	max: number,
	what: string,
) => {
	if (args.length < min || args.length > max) {
		throw new UsageError(`${command} needs ${what}`);
	}
};

interface Outcome {
	r: Result;
	empty: boolean;
}

const runSearch = async (
	args: string[],
	values: Values,
	source: DocSourceName,
): Promise<Outcome> => {
	need("search", args, 1, MAX_INT, "<query>");
	const limit = int("limit", values.limit, 1, 25);
	const r = await search({
		query: args.join(" "),
		source,
		...(limit === undefined || limit === 0 ? {} : { limit }),
	});
	const hits = r.data["hits"];
	return { r, empty: r.ok && Array.isArray(hits) && hits.length === 0 };
};

const runRead = async (
	args: string[],
	values: Values,
	source: DocSourceName,
): Promise<Outcome> => {
	need("read", args, 1, 1, "<route>");
	const offset = int("offset", values.offset, 0, MAX_INT);
	const [route = ""] = args;
	const r = await read({
		route,
		source,
		...(present(values.section) ? { heading: values.section } : {}),
		...(offset === undefined || offset === 0 ? {} : { offset }),
	});
	return { r, empty: false };
};

const runList = async (
	args: string[],
	source: DocSourceName,
): Promise<Outcome> => {
	need("list", args, 0, 1, "at most one [prefix]");
	const [prefix] = args;
	const r = await list({
		source,
		...(present(prefix) ? { section: prefix } : {}),
	});
	return { r, empty: false };
};

const runSchema = async (args: string[], values: Values): Promise<Outcome> => {
	need("schema", args, 1, 2, "<name> [property]");
	const offset = int("offset", values.offset, 0, MAX_INT);
	const [name = "", property] = args;
	const r = await schema({
		name,
		...(present(property) ? { property } : {}),
		...(offset === undefined || offset === 0 ? {} : { offset }),
	});
	return { r, empty: false };
};

const dispatch = (
	command: Command,
	args: string[],
	values: Values,
): Promise<Outcome> => {
	checkOptions(command, values);
	const source = sourceOf(values);
	if (command === "search") {
		return runSearch(args, values, source);
	}
	if (command === "read") {
		return runRead(args, values, source);
	}
	if (command === "list") {
		return runList(args, source);
	}
	return runSchema(args, values);
};

/** Runs a command. Returns the exit code. Output goes to stdout, messages and misses to stderr. */
const run = async (argv: string[]): Promise<number> => {
	const { values, positionals } = parse(argv);
	const [command, ...args] = positionals;
	if (command === undefined || command === "") {
		if (values.help === true) {
			process.stdout.write(USAGE);
			return 0;
		}
		throw new UsageError("missing command");
	}
	if (!isCommand(command)) {
		throw new UsageError(`unknown command "${command}"`);
	}
	if (values.help === true) {
		process.stdout.write(COMMANDS[command]);
		return 0;
	}
	const { r, empty } = await dispatch(command, args, values);
	const json = values.json === true;
	// A miss prints its message on stderr; with --json an empty search still prints its JSON.
	if (!r.ok || (empty && !json)) {
		process.stderr.write(`${r.text}\n`);
		return 1;
	}
	process.stdout.write(
		json ? `${JSON.stringify(r.data, null, 2)}\n` : `${r.text}\n`,
	);
	return empty ? 1 : 0;
};

try {
	process.exitCode = await run(process.argv.slice(2));
} catch (error) {
	if (!(error instanceof UsageError)) {
		throw error;
	}
	process.stderr.write(`clawdipedia: ${error.message}\n\n${USAGE}`);
	process.exitCode = 2;
}
