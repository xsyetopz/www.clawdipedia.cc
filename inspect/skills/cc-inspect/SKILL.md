---
name: cc-inspect
description: Look into the user's Claude Code sessions and the installed program: what happened in a past session, what a transcript holds, and what the program really does in the version they run.
---

# Inspect Claude Code

The `cc-inspect` MCP server reads local files, except `release` `notes` (`gh release view`) and `code` `read` with `view: "readable"` (`bunx @wakaru/cli`). It writes only its cache of cleaned code, and the temp folders of `code` `run`, which it removes.
It has 4 tools, `sessions`, `code`, `surface`, and `release`. Each takes an `action` (or, for `surface`, a `kind`), and the same parameter names: `version` (a version or a binary path), `query`, `name`, `offset`, and `limit`.

## Sessions

Transcripts live in `<config dir>/projects/<project>/<session>.jsonl`. The config dir is `CLAUDE_CONFIG_DIR`, or `~/.claude`. The project folder is the project path with each `/` as `-`.

1. `sessions` `list` (with `project` to narrow it) to find a session id.
2. `sessions` `search` with a `query` to find a word, a file path, or a command across sessions.
3. `sessions` `read` with `session`, `type` (`user`, `assistant`, `system`, ...), and `offset` to page through one.
4. `sessions` `validate` to check each line against the transcript schema of the version the plugin was built for. A failing line means a field that version does not write: a newer version, a hand-edited file, or a gap in the schema. Say which version the schema is for.
5. `sessions` `tool-calls` to count the tool calls by name. With a `query` it also gives sample inputs, which shows how a tool is really called.

Transcripts can hold secrets and private text. Quote only what the user asks for.

## The Program

1. `code` `installs` shows the versions in `~/.local/share/claude/versions` and which one `claude` runs.
2. `surface` with a `kind` lists the items of that kind (environment variables, flags, settings, gates, slash commands, and more), each with its default, gate, module, and offset when the code shows them. Use `name` to filter and `offset` to page. Without `kind`, it lists every kind with its count. Use it before `code` `search` when the question is "which X does the program have" or "does it read X".
3. `code` `search` with a literal anchor as `query`: a string such as a setting key, an environment variable, or an event name. Minified names (`Cui`, `bi`) change between versions, so search one only in the version where you found it, and follow code across versions by its literal anchors.
4. `code` `read` with the `module` and `offset` of a hit to read the code around it. The `offset` of a hit is where the match starts, not where its snippet starts.
   Add `view: "readable"` for a version of the module that is easier to read. The first call for a module runs Wakaru (`bunx @wakaru/cli@1.14.0`, a few seconds on a large module), and later calls read the cache.
   When you have only plain words, such as a line of the release notes, `code` `find` with them as `query` ranks the functions of a prepared version by those words.
   `find` and each `release` action prepare a version on first use, which takes about 14 seconds and a few GB of memory for each version.
5. `surface` `object-keys` with the `module` and an `anchor` (or `offset`) gives the keys of an object literal, with spreads followed across functions and modules.
6. `surface` `event-keys` lists the OpenTelemetry events, and with `name` gives the attributes of one event.
7. `surface` `tool-gates` lists the built-in tools of a version, with the code that gates each one in the list, its own `isEnabled()` when it has one, and the source of the functions they call. It leaves out the per-session filters, which can turn a listed tool off: confirm with a probe before you say a tool is available.
8. `release` `diff` with `from` and `to` lists the functions that changed between two versions, with the changed lines. Use `name` to keep the changes that hold a text, such as a tool name or a gate.
9. `release` `explain` with `name` gives where a name's code is, who uses it, the gates and env reads that guard it, and whether each function is a no-op, a stub, or handled.
10. `code` `run` with a `prompt` such as `/verify ARG` runs an installed version once with `-p` against a local fake API (a fake key, a dead proxy, temp folders), and gives the user turn it sends. Use it for text the binary does not hold as plain text, such as a bundled skill. Add `env` (such as `{"CLAUDE_CODE_DISABLE_1M_CONTEXT": "1"}`) to see what a variable changes; it refuses credentials, proxies, base URLs, and the names it sets itself. A run that times out reports the events and stderr from before the hang.
11. `release` `notes` with `version` marks each release-notes line as matched, gated, or unmatched against the diff from the previous install. It runs `gh release view` once for each version. Read the code of each match before you state it.

When you report what the program does, call the source "the program" and name the version. A key ending in `?` is optional. A value shown as `unknown` is computed: read its code for the type.
