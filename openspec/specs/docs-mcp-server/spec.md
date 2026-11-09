# Docs-Mcp-Server Specification

## Purpose

Serve four doc sources (clawdipedia, platform, code, and claude-resources) to agents over MCP with a small tool list, fast first answers, and an offline fallback.

## Requirements

### Requirement: Four Tools

The `clawdipedia-docs` MCP server SHALL offer exactly four tools: `search_docs`, `read_page`, `list_pages`, and `get_schema`.
The MCP server key in `plugin/.mcp.json` SHALL be `docs`, so the tool names at run time are `mcp__plugin_clawdipedia-docs_docs__<tool>`.
The tools `search_platform_docs`, `read_platform_page`, and `list_platform_pages` SHALL no longer exist.

#### Scenario: Old Tool Name

- **WHEN** a client lists the tools
- **THEN** no tool name contains `platform`

### Requirement: Source Argument

`search_docs`, `read_page`, and `list_pages` SHALL take an optional `source`: `"clawdipedia"` (the
default, the unofficial Claude Code Docs), `"platform"` (platform.claude.com/docs),
`"code"` (code.claude.com/docs), or `"claude-resources"` (the articles, guides, and webinars under
`https://claude.com/resources`). The values SHALL come from one list, `DOC_SOURCES`.

The server SHALL NOT serve `www.anthropic.com`, and SHALL NOT accept `"anthropic"` as a source or as
an alias. A call with a source that is not in `DOC_SOURCES` SHALL fail with the list of valid values.

#### Scenario: Platform Search Through Source

- **WHEN** an agent calls `search_docs` with `query: "prompt caching"` and `source: "platform"`
- **THEN** the reply lists platform.claude.com pages

#### Scenario: Other Sources

- **WHEN** an agent calls `search_docs` with `source: "code"` or `source: "claude-resources"`
- **THEN** the reply lists pages of that source

#### Scenario: Dropped Source

- **WHEN** an agent calls `search_docs` with `source: "anthropic"`
- **THEN** the call fails and the message lists `clawdipedia`, `platform`, `code`, and
  `claude-resources`

#### Scenario: Old Source Value

- **WHEN** an agent calls `search_docs` with `source: "docs"`
- **THEN** the call fails and the message names `clawdipedia`

### Requirement: Small Tool List

The `tools/list` reply of the server SHALL be at most 40% (proposed) of the 15,468 bytes measured on 2026-10-23 for the 7 tools.
A test SHALL measure it.

#### Scenario: Size Test

- **WHEN** the test starts the built server and requests `tools/list`
- **THEN** the reply size is at most 40% of 15,468 bytes

### Requirement: Answers Kept

Every question in `plugin/mcp/evaluation.xml` SHALL be answerable with the new tools, and the file SHALL name only the new tools.

#### Scenario: Evaluation File

- **WHEN** the evaluation questions run against the server
- **THEN** each expected answer appears in a tool reply

### Requirement: Prebuilt Index

The site build SHALL publish a search index file beside `llms-manifest.json`, with the site version and a content hash.
The first `search_docs` call with `source: "clawdipedia"` SHALL fetch that one file, and SHALL NOT fetch each page.
When the index file cannot be fetched and none is cached, the server SHALL fall back to building the index from pages, as it does today.

#### Scenario: First Search

- **WHEN** a fresh server with an empty cache answers its first `search_docs` call
- **THEN** it makes one request for the index file and no request for a page `.md` file

#### Scenario: Old Site without an Index

- **WHEN** the index file returns 404
- **THEN** the search still answers, from pages, and the `Source:` line says so

### Requirement: Source Line and Offline Cache

Each reply SHALL end with a `Source:` line that says whether the text is live, from the cache, or stale from the cache while offline.
When the cache is over its cap, the server SHALL delete pages of platform, code, and
claude-resources first, then site pages and schemas, and never the index files.
When the network fails, the server SHALL answer from the disk cache in `CLAWDIPEDIA_CACHE_DIR`, `CLAUDE_PLUGIN_DATA`, or `~/.cache/clawdipedia`, in that order.

#### Scenario: Offline Read

- **WHEN** the network is down and a page was read before
- **THEN** `read_page` returns the cached text and a `Source:` line that says offline

### Requirement: Claude Resources Scope

The `claude-resources` source SHALL index only pages whose first path segment is `resources` on
`https://claude.com`, taken from `https://claude.com/sitemap.xml`.
It SHALL leave out every localized copy, such as a path that starts with `ja` or `de`, and every
page of another section of the site.
The section of a page SHALL be its second path segment, such as `articles`, `guides`, or `webinars`.
A page directly under `resources`, such as the hub `resources/best-practices`, SHALL therefore be a
section of its own. The path `resources`, which has no second segment, SHALL be the section
`resources`.

#### Scenario: Locale Copy Left Out

- **WHEN** the sitemap holds `https://claude.com/ja/resources/articles/claude-duet`
- **THEN** no entry of the index has that path, because its first segment is `ja`

#### Scenario: Other Section Left Out

- **WHEN** the sitemap holds `https://claude.com/marketplace/connectors/x`
- **THEN** no entry of the index has that path

#### Scenario: Section From the Second Segment

- **WHEN** the sitemap holds `https://claude.com/resources/guides/claude-cowork-product-guide`
- **THEN** the entry's section is `guides`, and `list_pages` with `section: "guides"` lists it

### Requirement: No Bin Folder

The `clawdipedia-docs` plugin SHALL have no `bin/` folder, so claude.ai and Cowork can still install it.

#### Scenario: Plugin Check

- **WHEN** `bun run plugin:check` runs
- **THEN** it fails if `plugin/bin/` exists
