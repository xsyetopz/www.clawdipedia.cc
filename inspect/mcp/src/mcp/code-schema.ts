import { ARGS, P } from "./app.ts";

/** The description of the `code` tool. */
export const CODE_DESCRIPTION = `Read the code inside a Claude Code binary: list installs or modules, search literal text, find code by plain words, read a module slice, prepare a cleaned index for release diffs, run a prompt in an installed version against a local fake API to see the text it sends, or run it with other args (cli), list the chunk citations in the Markdown files of a folder that name no module of the build (citations), such as a subcommand; check with \`npm\` whether a text (\`query\`, with \${…} holes) is in the published source of the npm package in \`name\`; with \`query\`, cli names each request, stream, and transcript file that holds that text.`;

/** The arguments the `code` tool lists, with the description of each. */
export const CODE_SHAPE = {
	version: P.version,
	query: P.query,
	regex: P.regex,
	name: P.name,
	module: P.module,
	offset: P.offset,
	limit: P.limit,
	context: ARGS.context.describe(
		"Characters shown around a search hit (default 150). A hit's `offset` is where the match starts in the module, the offset `read` takes; the snippet starts up to `context` characters before it.",
	),
	view: ARGS.view.describe(
		'With read: "readable" gives the module through Wakaru (the first call per module runs it, then it is cached).',
	),
	length: ARGS.length.describe(
		"Characters to read (default 4000); with cli and `request`, of the body JSON from `offset`.",
	),
	prompt: ARGS.prompt.describe(
		'With run: the prompt or slash command, such as "/verify ARG". `name` is the text that picks the user turn (default: the command tag).',
	),
	env: ARGS.env.describe(
		'With run or cli: extra environment variables, such as {"CLAUDE_CODE_USE_BEDROCK": "1"}. Names that run fixes (key, base URL, proxies, folders), and names or values that could carry a credential or route a request, are refused.',
	),
	args: ARGS.args.describe(
		'With cli: the program args, such as ["--settings", "<project-dir>/s.json", "auto-mode", "config"]. `<project-dir>` and `<config-dir>` become the temp project and config folders.',
	),
	files: ARGS.files.describe(
		'With cli: files to write in the temp project folder first, by relative path, such as {"s.json": "{}"}.',
	),
	replies: ARGS.replies.describe(
		'With cli: JSON replies of the stub by "METHOD /path", such as {"GET /api/oauth/profile": {...}}. "<stub>" in an env value becomes the stub URL.',
	),
	dir: ARGS.dir.describe(
		"With citations: the folder whose `**/*.md` files are checked for `chunk-xxxxxxxx.js` citations (`:N`, `@N`, or `lines A to B` after the name) that name no module of the build.",
	),
	packageVersion: ARGS.packageVersion.describe(
		"With npm: the version of the package in `name`; default: the latest, looked up once and kept.",
	),
	login: ARGS.login.describe(
		'With cli: "key" (default) sets the fake API key; "oauth" writes a fake claude.ai login to .credentials.json instead.',
	),
	show: ARGS.show.describe(
		'With cli: a .json, .jsonl, or .log file of the config folder, else of the project folder, to print at exit, such as ".claude.json", or "d.log" after `--debug-file d.log`.',
	),
	apiHost: ARGS.apiHost.describe(
		"With cli: the stub also answers https://api.anthropic.com (through a local proxy and a throw-away CA), for requests that ignore ANTHROPIC_BASE_URL, such as GET /api/oauth/profile.",
	),
	baseUrl: ARGS.baseUrl.describe(
		"With cli: false leaves ANTHROPIC_BASE_URL unset, so that with apiHost the Messages API requests also go to https://api.anthropic.com, as on a direct connection.",
	),
	calls: ARGS.calls.describe(
		'With cli: the model calls these tools in order, one per turn, such as [{"name": "Bash", "input": {"command": "echo hi"}}], then answers OK after the last result. safeguard ("flagged" or "not_flagged") adds the server-side auto mode verdict for that call.',
	),
	prompts: ARGS.prompts.describe(
		'With cli: prompts sent in one session, as stream-json user messages on stdin; cli adds "-p --input-format stream-json --output-format stream-json --verbose" before `args`, so a hook that acts from the second prompt on runs.',
	),
	request: ARGS.request.describe(
		"With cli: the number of a request in `requests`; gives the UTF-8 bytes of its body as compact JSON and of its tools, system, and messages, the path of each block with a cache_control, and the body JSON from `offset` for `length` characters.",
	),
	tool: ARGS.tool.describe(
		'With cli: a tool name; gives its entry (name, description, input_schema, ...) from the last Messages API request that sends it, and its size in bytes. A deferred tool is sent only after a ToolSearch call, such as calls [{"name": "ToolSearch", "input": {"query": "select:WebFetch"}}]. In print mode the program sends AskUserQuestion only with "--permission-prompt-tool" (such as "stdio") in `args`.',
	),
};
