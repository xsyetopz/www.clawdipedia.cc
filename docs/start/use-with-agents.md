---
title: Use These Docs with Agents
description: How an AI agent can read this site as plain text, and how to install the clawdipedia-docs plugin that adds an MCP server and a skill. It reads four sources.
sidebar_position: 5
---

An agent reads plain text better than a web page.
This site gives agents text files, a small manifest, and a plugin.
The plugin adds an MCP server (a program that gives an agent tools) and a skill that tells Claude when to use it.
The server reads the live site and keeps a copy on disk. So it still answers when you are offline (see [Live Fetch and Cache](#live-fetch-and-cache)). It has no telemetry and sends no data about you. It only requests public pages.
Source: [llms.txt Proposal](https://llmstxt.org/) and [Model Context Protocol Specification](https://modelcontextprotocol.io/specification).

## Text Files

Every build writes these files. The base URL is `https://clawdipedia.cc`.

| File | What it holds |
| --- | --- |
| `/llms.txt` | An index in the llmstxt.org format. One line per page, with its title, URL, and description. |
| `/llms-full.txt` | The text of every page in one file, in sidebar order. It is large. |
| `/<route>.md` | One page as clean Markdown. For example, `/configure/status-line.md`. |
| `/llms-manifest.json` | A list of pages with `route`, `title`, `description`, `section`, `md`, and `url`, in sidebar order. |
| `/schemas/` | The JSON Schemas of every config file and payload, and the Mod API type file `claude-code.d.ts`. See [JSON Schemas](../reference/schemas.md). |

An agent with a web fetch tool can start at `llms.txt`. It can pick a page and fetch its `.md` file.

## Install the Plugin

The plugin has the name `clawdipedia-docs`. Its display name is Anthropic Docs. The name `clawdipedia` is the marketplace.

```text
/plugin marketplace add xsyetopz/www.clawdipedia.cc
/plugin install clawdipedia-docs@clawdipedia
```

:::warning[Breaking Rename]
The plugin had the name `cc-docs`. Its marketplace had the name `claude-code-docs`. The old names are gone, with no alias.
Remove the old plugin. Then install the new one. The tool names change from `mcp__cc-docs__*` to `mcp__plugin_clawdipedia-docs_docs__*`.
If a `permissions.allow` list holds `mcp__cc-docs__*` (or `mcp__claude-code-docs__*`), change it to `mcp__plugin_clawdipedia-docs_docs__*`. The old rule matches nothing. So Claude asks before each call.
The cache folder moved to `~/.cache/clawdipedia`. The `CC_DOCS_*` variables are now `CLAWDIPEDIA_*`. So `CC_DOCS_CACHE_DIR` is now `CLAWDIPEDIA_CACHE_DIR`. The source value `docs` is now `clawdipedia`.
:::

The plugin adds two things.

| Part | What it does |
| --- | --- |
| The MCP server `docs` | Gives Claude four read-only tools, such as `mcp__plugin_clawdipedia-docs_docs__search_docs`. It runs with plain `bun`. You need no `bun install`. |
| The skill `clawdipedia-docs` | Tells Claude to look up settings, environment variables, hooks, and other Claude Code details here instead of from memory. It also tells Claude which of the four sources to use. It names the source, the version, and the badge meaning in each answer. |

The skill uses the MCP tools when they exist. If they do not, it fetches `llms.txt` and the page `.md` files.

## Use the Command Instead

The plugin `clawdipedia-docs-cli` (display name Anthropic Docs CLI) gives the same four sources as a command. It has no MCP server and adds no tool list to the context.
It works only in Claude Code. It needs Bun.

```text
/plugin install clawdipedia-docs-cli@clawdipedia
```

The command is `clawdipedia`. The Bash tool runs it. The skill `clawdipedia-docs-cli` tells Claude when.
The package is not on the npm registry, so `bunx clawdipedia-docs` does not work. Outside Claude Code, clone the repository and run `bun run cli/src/cli.ts`.

```text
clawdipedia search "PreToolUse timeout"
clawdipedia read configure/status-line
clawdipedia list configure --source code
clawdipedia schema settings hooks.PreToolUse
```

Install one of the two plugins, not both. They give the same answers.

## Sources

The first three tools take `source`. It is `"clawdipedia"` by default.

| `source` | What it reads | Use it for |
| --- | --- | --- |
| `clawdipedia` | This unofficial site. | How Claude Code really works: settings, environment variables, hooks, plugins, internals, and schemas. Only this source has badges and schemas. |
| `platform` | [platform.claude.com/docs](https://platform.claude.com/docs/en/home) | The Claude API, SDKs, models, and prompt caching. |
| `code` | [code.claude.com/docs](https://code.claude.com/docs/en/overview) | The official Claude Code docs. |
| `claude-resources` | [claude.com/resources](https://claude.com/resources) | Articles, guides, and webinars. The site has no Markdown. So the server converts each HTML page. |

The CLI takes the same values in `--source`. The old values `docs` and `anthropic` are errors in both. The error lists the valid values.
The old value `anthropic` has no alias. Use `claude-resources` instead.

## MCP Tools

All four tools only read. None changes a file or your settings.

| Tool | What it does |
| --- | --- |
| `search_docs` | Ranks pages for a query. Gives the route, title, URL, and a snippet for each hit. It takes `query`, `source`, `limit`, and `section`. The first search loads `llms-search-index.json` from the site in one request. If the site has no such file, it fetches every page once. With `source: "platform"` or `"code"`, it ranks pages by title, summary, path, and group from the `llms.txt` of that host. It does not search page text. With `source: "claude-resources"`, it ranks pages from the sitemap by the path and by a title that it derives from the path. For these three, `section` is a group. |
| `read_page` | Gives a page as Markdown, or one H2 section of it. It takes `route`, `source`, `section_heading`, `offset`, and `max_chars`. A long page comes in parts. Pass `offset` to read the next part. With `source: "platform"` or `"code"`, `route` is a path under `/docs/en/`. The tool reads only English pages. With `source: "claude-resources"`, `route` is a path of the site that starts with `resources`, such as `resources/articles/context-management`. |
| `list_pages` | Lists the pages in sidebar order. Pass `section` to see descriptions. With another source, it lists the groups with their page counts. `section` lists the pages of one group. |
| `get_schema` | Gives one JSON Schema of this site. With `name: "types"`, it gives the Mod API type file. A schema is large. So you get an outline first. Pass `property` for one key, such as `hooks.PreToolUse`, a definition such as `BashInput`, or a type such as `ToolCheckResult`. If it does not have the name, it returns the closest names it has. |

Every result ends with a `Source:` line. It names the host and says whether the text is live, from the cache, or from the cache while offline.

## Use the Server with Other Clients

The server speaks MCP over stdio. Any MCP client can run it.
Clone the repo. Then point the client at the built file.

```json title="MCP client config"
{
  "mcpServers": {
    "docs": {
      "command": "bun",
      "args": ["/path/to/clawdipedia/plugin/mcp/dist/server.js"]
    }
  }
}
```

In Claude Code, you can add it by hand with `claude mcp add clawdipedia-docs -- bun /path/to/clawdipedia/plugin/mcp/dist/server.js`.

## Live Fetch and Cache

The server has no bundled copy of the pages.
It fetches the manifest, pages, and schemas from the site when a tool needs them. It fetches the pages of the other three sources from their hosts.
The server saves each fetched file on disk. If the network fails, the server serves the saved copy. The `Source:` line says it is offline.
If the server saved nothing yet, the tool returns an error that says the host could not be reached.
The server starts without any network request.

### Settings

| Variable | What it does |
| --- | --- |
| `CLAWDIPEDIA_BASE_URL` | Fetches this site from a mirror instead of `https://clawdipedia.cc`. |
| `PLATFORM_DOCS_BASE_URL` | Fetches the platform docs from a mirror instead of `https://platform.claude.com`. |
| `CODE_DOCS_BASE_URL` | Fetches the official Claude Code docs from a mirror instead of `https://code.claude.com`. |
| `CLAUDE_RESOURCES_BASE_URL` | Fetches the Claude resources pages from a mirror instead of `https://claude.com`. |
| `CLAWDIPEDIA_CACHE_DIR` | Sets the cache folder. If it is unset, the server uses `$CLAUDE_PLUGIN_DATA/cache`, then `$XDG_CACHE_HOME/clawdipedia`, then `~/.cache/clawdipedia`. |
| `CLAWDIPEDIA_CACHE_CAP_BYTES` | Sets the size cap of the cache in bytes. The default is 60 MB (`62914560`). |
| `CLAWDIPEDIA_TTL_SCALE` | Multiplies the times to reuse a file in [Cache Rules](#cache-rules). The default is `1`. |

A base URL must use `https`. Plain `http` works only for `localhost` and `127.0.0.1`. The server ignores any other value. It writes a warning to stderr.

### Cache Rules

| Rule | Value |
| --- | --- |
| Time to reuse a file without a request | Site manifest, platform `llms.txt`, and code `llms.txt`: 10 minutes. Site pages and schemas, and the Claude resources sitemap: 1 hour. Pages of platform, code, and claude-resources: 6 hours. |
| After that time | The server asks again. It sends `If-None-Match` or `If-Modified-Since` when it has a saved validator. A `304` keeps the saved copy. |
| Request limits | 8 seconds per request, 6 requests at once, at most 3 redirects, and only to the same origin. A file over its size cap (1 to 2 MB) counts as a failure. |
| Failed request | The server serves the saved copy, if there is one. |
| `404` for a page or schema | The server deletes the saved copy. The tool says the page was not found. |
| `404` for the manifest or `llms.txt` | Counts as a failure. The server uses the saved copy. |
| Over the size cap | The server deletes the least recently fetched files, pages of platform, code, and claude-resources first. Then it deletes site pages and schemas. The server never deletes the index files. |
| Folder that cannot be written | The cache lives in memory until the server stops. |

The server ignores any manifest entry with an odd route or a URL outside the site.
It does not send or keep cookies.

## Inspect Sessions and the Program

The same marketplace has a second plugin, `cc-inspect`.
It reads your session transcripts and the installed Claude Code binary.
It makes two kinds of network request. `release` `notes` runs `gh release view` to get the release notes, once for each version. `code` `read` with `view: "readable"` runs `bunx @wakaru/cli@1.14.0`, once for each module.
It writes only its cache of cleaned code. The cache is under `CC_INSPECT_CACHE`. If that is unset, it is under `./captures` when that folder exists. Otherwise it is under `~/.cache/cc-inspect`.
`code` `run` also starts the program once, offline, with temp folders that it removes after the run.

```text
/plugin install cc-inspect@clawdipedia
```

It adds the MCP server `cc-inspect`. This server runs with plain `bun`. It also adds the skill `cc-inspect`. The skill tells Claude when to use the server.
The server has 4 tools. Each takes an `action` or a `kind` that picks what it does. Each also takes the same parameter names: `version` (a version or a binary path), `query`, `name`, `offset`, and `limit`.

| Tool | Choice | What it does |
| --- | --- | --- |
| `sessions` | `action: "list"` | Lists the transcripts in `projects/` of the config folder (`CLAUDE_CONFIG_DIR`, or `~/.claude`), newest first. Pass `project` to narrow it. |
| `sessions` | `action: "read"` | Gives the lines of one `session`. Pass `type` to keep one line type. Pass `offset` to page. A session id prefix works. |
| `sessions` | `action: "search"` | Finds a `query` (text, or a regular expression with `regex`) in one session or in all of them. |
| `sessions` | `action: "validate"` | Checks each line against the [transcript schema](../reference/schemas.md) of its `type`, and lists the lines that do not fit. The schema is the one for Claude Code `2.1.314`. |
| `sessions` | `action: "tool-calls"` | Counts the tool calls of assistant lines by tool name. Pass `query` (text, or a regular expression with `regex`) to keep matching names and to get up to `limit` sample inputs each. |
| `code` | `action: "installs"` | Lists the versions in `~/.local/share/claude/versions`. Marks the one that `~/.local/bin/claude` runs. |
| `code` | `action: "modules"` | Lists the files inside a binary. |
| `code` | `action: "search"` | Finds a `query` in the code of a binary, with the module and offset of each hit. |
| `code` | `action: "read"` | Gives a slice of one `module`. With `view: "readable"`, it gives the module after [Wakaru](https://github.com/wakaru-dev/wakaru) rewrote it for reading. The first call for a module runs `bunx @wakaru/cli@1.14.0`. It needs a network. It takes a few seconds on a large module. Later calls read the cache. |
| `code` | `action: "find"` | Finds code by plain words in a `query`, such as "sleep Monitor until-loop". It ranks the functions of a prepared version by the words in their strings, property names, and labels. It gives the top 10 with module, offset, and first lines. |
| `code` | `action: "prepare"` | Cleans each module of a version (stable local names, then `bun fmt`) and indexes its functions. It writes both into the cache. |
| `code` | `action: "run"` | Runs a `prompt`, such as `/verify ARG`, with `claude -p` in an installed `version` against a local fake API. It gives the user turn that the program sends, from the block that holds `name` (by default the command tag). It uses a fake key, a dead proxy, temp `HOME` and config folders, and a stub of the macOS `security` command on `PATH`. It fails when a request reaches the stub with another host or key. It also fails when the program runs longer than 60 seconds. Temp paths come back as `<home>`, `<config-dir>`, `<project-dir>`, `<bundled-skill-dir>`, and `<temp-dir>`. Page with `offset` and `length`. |
| `code` | `action: "cli"` | Runs an installed `version` with any `args`, such as a subcommand, in the same setup as `run`. In `args`, `<project-dir>` and `<config-dir>` become the temp folders. `files` are written in the project folder first. `env` adds variables, and `<stub>` in a value becomes the stub URL. `replies` gives JSON replies by `METHOD /path`, such as `GET /api/oauth/profile`, with the header `request-id: req_probe`. `login: "oauth"` writes a fake claude.ai login to `.credentials.json` in place of the fake key. `apiHost: true` makes the stub also answer `https://api.anthropic.com` through a local proxy and a throw-away CA, for requests that ignore `ANTHROPIC_BASE_URL`. The proxy refuses all other hosts. `calls`, such as `[{"name": "Bash", "input": {"command": "echo hi"}}]`, makes the model call those tools in order, one per main turn, then answer `OK` after the last result. A call with `"safeguard": "flagged"` or `"not_flagged"` also gets the server-side auto mode verdict. `baseUrl: false` leaves `ANTHROPIC_BASE_URL` unset, so that with `apiHost` the Messages API requests also go to `https://api.anthropic.com`, as on a direct connection. The output lists each request, the tool names sent, and the `.json`, `.jsonl`, and `.log` files the program wrote to the config folder. `show` prints one of those files. With `query`, it names each request, stream, and file that holds that text. |
| `surface` | `kind: "env"`, `"setting"`, and the other surface kinds | Lists the items of one kind, each with its default, gate, module, and offset when the code shows them. With no `kind`, it gives each kind with its count. |
| `surface` | `kind: "object-keys"` | Lists the keys of the object literal around an `offset` or an `anchor` text in a `module`. It follows spreads into the functions and modules they come from. |
| `surface` | `kind: "event-keys"` | Lists the OpenTelemetry events of a binary. With `name`, it merges the attribute keys of every place the program emits that event. |
| `surface` | `kind: "tool-gates"` | Lists the built-in tools of a binary. Each tool comes with the code in the tool list that turns it on or off. It also comes with its own `isEnabled()` check, when it has one. It also comes with the source of the functions they call. The list does not include the filters of each session. So a listed tool may still be off. |
| `release` | `action: "diff"` | Lists the functions changed, added, and gone between two versions (`from` and `to`), each with the changed lines of its cleaned code. Pass `name` to keep the changes that hold a text. |
| `release` | `action: "explain"` | For a `name` (a string, a command such as `/loops`, or a tool name), gives where its code is and who uses it. It also gives the gates and env reads that guard it, and whether each function is a no-op, a stub, or handled. |
| `release` | `action: "notes"` | Marks each line of the release notes of `version` as matched (a changed function or a `release:diff` item holds its code span or words), gated (the match reads a `tengu_` gate), or unmatched. It compares against `from` (else the newest older install). Read the code of each match before you state it. |

The server also has 2 MCP prompts. They give an agent the steps of a task. `release_review` (with `from` and `to`) runs `prepare`, `diff`, and `notes`. Then it runs `find` and `explain` for each gated or unmatched line. `explain_change` (with `name`) runs `find` and `explain` for one name.

In `object-keys` and `event-keys`, a key that ends in `?` is optional. A value shown as `unknown` comes from a computation. So its type is not known.
The code tools read the code with the [meriyah](https://github.com/meriyah/meriyah) parser and [eslint-scope](https://github.com/eslint/js/tree/main/packages/eslint-scope). So minified names do not matter.

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [Plugin Manifest](../extend/plugins/manifest.md)
- [Plugin Loading](../extend/plugins/loading.md)
- [Marketplaces](../extend/plugins/marketplace.md)
