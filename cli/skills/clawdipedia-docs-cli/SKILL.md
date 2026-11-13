---
name: clawdipedia-docs-cli
description: Look up Claude Code behavior, settings, env vars, flags, hooks, plugins, skills, and MCP with the clawdipedia command in Bash. Use it over memory, because the pages check the real program.
---

# Anthropic Docs From the Shell

The `clawdipedia` source describes what Claude Code 2.1.323 does, checked against the program as well as the official docs. Take each detail that the user may act on from these pages: a key name, a default, an environment variable, a hook field. Memory of these details is often stale or wrong. The other three sources cover official docs and Claude resources pages.

This plugin works only in Claude Code. It runs as a command: call `clawdipedia` with the Bash tool. It needs Bun. When the shell reports that `clawdipedia` is missing, run `"$CLAUDE_PLUGIN_ROOT/bin/clawdipedia"` in its place, because the plugin ships that file.

## Pick the Source

Four sources answer four kinds of question. Choose with `--source` (default `clawdipedia`).

| Source | Reads | Use it for |
| --- | --- | --- |
| `clawdipedia` | This unofficial site, checked against the program | How Claude Code really works: settings, environment variables, flags, hooks, plugins, internals, JSON Schemas, and undocumented or version-specific behavior. It has the badges. |
| `code` | code.claude.com/docs | What the official Claude Code docs say. Use it to compare with `clawdipedia`, or to cite the official page. |
| `platform` | platform.claude.com/docs | The Claude API, SDKs, models, and prompt caching. |
| `claude-resources` | claude.com/resources | Claude product articles, guides, and webinars: use cases, how-to advice, and product announcements. |

Only `clawdipedia` has badges and schemas. `schema` reads `clawdipedia` only.

## Find the Answer

- `clawdipedia search "PreToolUse timeout"`: ranked hits with a route, a title, a URL, and a snippet. Search an exact identifier (`CLAUDE_CODE_USE_BEDROCK`) or a few short keywords. `--limit <n>` (1 to 25, default 8) caps the hits.
- `clawdipedia read configure/status-line`: the page as markdown. `--section "Example"` prints only that H2 section. A long page ends its header line with `more: call again with offset=N`: pass `--offset N`.
- `clawdipedia list` shows every section and its pages. `clawdipedia list configure` shows one section with the description of each page.
- `clawdipedia schema settings` prints the outline of a JSON Schema. `clawdipedia schema settings hooks.PreToolUse` or `clawdipedia schema tools BashInput.command` prints one property or definition. The names are `settings`, `managed-settings`, `plugin-manifest`, `plugin-hooks`, `marketplace`, `keybindings`, `mcp`, `agents-json`, `hook-output`, `tools`, `control-protocol`, `stream-json`, `frontmatter`, `status-line`, `transcript`, `otel`, and `claude-json`.
- `clawdipedia schema types ToolCheckResult` prints the Mod API type file entry for a type, a member (`ToolCheckResult.plugin`), a call (`'$.tool.check'`), or an event (`tool.check`). `clawdipedia schema types` lists the names.
- Add `--source <name>` (`clawdipedia`, `platform`, `code`, or `claude-resources`) to `search`, `read`, or `list` to read another source. The default is `clawdipedia`. An old value such as `--source docs` is a usage error (exit code `2`).
- Add `--json` for JSON. `clawdipedia --help` and `clawdipedia <command> --help` print the usage.

Exit codes: `0` a result, `1` no result (no hit, unknown page, or unknown schema property; the message on stderr names the closest routes or properties), `2` a usage error.

Each text output ends with a `Source:` line. If it says offline, the text comes from the disk cache and may be old: say so.

## Cache

The command keeps a disk cache so it works offline. The folder is the first of these:

1. `CLAWDIPEDIA_CACHE_DIR`
2. `${CLAUDE_PLUGIN_DATA}/cache`
3. `~/.cache/clawdipedia`

When the command runs from the Bash tool, `CLAUDE_PLUGIN_DATA` is unset (probed on Claude Code 2.1.323: the plugin `bin/` is on the Bash PATH, and the variable is unset). So the cache is `~/.cache/clawdipedia` unless `CLAWDIPEDIA_CACHE_DIR` is set.

## Read the Badges

Tables have a Status column. State the badge when you report a fact, because it tells the user how far to trust it.

- Documented: an official docs page names the item.
- Undocumented: only the program shows it. It works today and can change without notice, so say so.
- Differs: the official docs and the program disagree. Report what the row says the program does.
- Gated: it works only behind a flag or a server gate. Name the gate.

## Answer

- Say which source the answer comes from. For `clawdipedia`, say which version it is for: Claude Code 2.1.323. If the user runs another version, say the page may not match it.
- Cite the page (its URL) next to each fact.
- Before you name a field of a payload (a `$` call, an event, a hook input or output, a tool input), look it up with `clawdipedia schema`, and name only the fields you found. When a lookup comes back empty, tell the user the field is unconfirmed for this version and give the closest names the lookup returned.
- When the pages leave the question open, say so. Label each part of the answer that comes from memory, so the user can tell it from a checked fact.
