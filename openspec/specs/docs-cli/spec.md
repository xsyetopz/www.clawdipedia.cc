# Docs-Cli Specification

## Purpose

Let people and agents query the four doc sources (clawdipedia, platform, code, and claude-resources) from a shell with one command, without the MCP server, through `bunx clawdipedia-docs` or the `clawdipedia-docs-cli` plugin.

## Requirements

### Requirement: Subcommands

The `clawdipedia` command SHALL have the subcommands `search <query>`, `read <route>`, `list [prefix]`, and `schema <name> [property]`.
`search`, `read`, and `list` SHALL take `--source clawdipedia|platform|code|claude-resources`, with `clawdipedia` as the default.
Any other value, including the old `docs` and the dropped `anthropic`, SHALL be a usage error.
`read` SHALL take `--section <heading>`.
`search` SHALL take `--limit <n>`.
Each subcommand SHALL print plain text by default and JSON with `--json`.
`clawdipedia --help` and `clawdipedia <subcommand> --help` SHALL print the usage.

#### Scenario: Search Then Read

- **WHEN** a user runs `clawdipedia search "PreToolUse timeout"` and then `clawdipedia read <route>` with a route from the first output
- **THEN** the first prints ranked hits with routes, and the second prints the page text, each ending with a `Source:` line

#### Scenario: JSON Output

- **WHEN** a user runs `clawdipedia search statusLine --json`
- **THEN** stdout is one JSON value that parses

#### Scenario: Old Source Value

- **WHEN** a user runs `clawdipedia search hooks --source docs`
- **THEN** it exits 2 and stderr names the four valid sources

### Requirement: Same Answers as the MCP Server

For the same query, route, or schema, the CLI SHALL return the same hits and text as the `clawdipedia-docs` MCP tools, because both use one search core.

#### Scenario: Agreement

- **WHEN** the same query runs through `clawdipedia search` and through `search_docs`
- **THEN** both list the same routes in the same order

### Requirement: Exit Codes

The CLI SHALL exit 0 on a result, 1 when a search, page, or schema property has no result, and 2 on a usage error, with the message on stderr.

#### Scenario: Unknown Page

- **WHEN** a user runs `clawdipedia read no/such/page`
- **THEN** it exits 1 and stderr names the closest routes

#### Scenario: Usage Error

- **WHEN** a user runs `clawdipedia frobnicate`
- **THEN** it exits 2 and stderr shows the usage

### Requirement: Runs with No Install Step

The CLI SHALL run as one bundled file on Bun, through `bunx clawdipedia-docs` and through the `bin/` of the `clawdipedia-docs-cli` plugin, with no install step.
It SHALL use the same disk cache rules as the MCP server.

#### Scenario: Plugin Bin

- **WHEN** the `clawdipedia-docs-cli` plugin is installed in Claude Code
- **THEN** the Bash tool can run `clawdipedia search hooks`

### Requirement: Light Plugin and Skill

The `clawdipedia-docs-cli` plugin SHALL have the `bin/` CLI and one skill, and no MCP server.
The skill SHALL tell the agent to use `clawdipedia` through Bash, and SHALL follow the answer rules of the `clawdipedia-docs` skill (version, badges, citations, payload fields from the schemas).
The plugin description SHALL say that it works only in Claude Code, not in claude.ai or Cowork.
`plugin:check` and `version:bump` SHALL cover the plugin.

#### Scenario: No MCP Server

- **WHEN** `bun run plugin:check` runs
- **THEN** it fails if the `clawdipedia-docs-cli` plugin has an `.mcp.json` or no `bin/clawdipedia`

### Requirement: Registry Package

The CLI SHALL be published to the registry as `clawdipedia-docs`, with a `bin` entry named `clawdipedia`, and its version SHALL match the `clawdipedia-docs-cli` plugin version.
Each publish SHALL happen only after the owner approves it.

#### Scenario: Version Agreement

- **WHEN** `bun run plugin:check` runs
- **THEN** it fails if the package version and the `clawdipedia-docs-cli` plugin version differ
