---
title: Headless and Print Mode
description: Run Claude Code without the screen with -p, choose text, json, or stream-json output, and the flags that only work in print mode.
sidebar_position: 1
---

Print mode runs one prompt, prints the answer, and exits.
Use it in scripts, pipes, and CI. It is also the base of the Agent SDK.
Add `-p` (or `--print`) to start it. For example, `claude -p "Summarize README.md" --output-format json` prints one JSON result.
Send the prompt as an argument or on stdin.
Print mode still saves the session to `~/.claude/projects/`. Add `--no-session-persistence` to save nothing.

:::warning
Print mode skips the workspace trust dialog.
This also happens when stdout is not a terminal, such as when you pipe or redirect output.
Use it only in folders you trust.
:::

## Print Mode Flags

Source: [Run Claude Code Programmatically](https://code.claude.com/docs/en/headless), [CLI Reference](https://code.claude.com/docs/en/cli-reference), and `claude --help`.
These flags have their rows, with status and details, on [CLI Flags](../../configure/cli/flags.md).

- Output and input: `-p, --print`, `--output-format`, `--input-format`, `--include-partial-messages`, `--include-hook-events`, `--forward-subagent-text`, and `--replay-user-messages`.
- Checks and limits: `--json-schema` and `--max-budget-usd`.
- Prompts and permissions: `--prompt-suggestions` and `--permission-prompts`.
- Lean runs: `--no-session-persistence`, `--bare`, and `--restricted`.
- Tools, models, sessions, and MCP: `--allowedTools`, `--disallowedTools`, `--tools` (see [CLI Flags](../../configure/cli/flags.md)), `--fallback-model` (see [Models](../../how-it-works/models.md)), `--resume`, `--continue`, `--fork-session`, `--session-id` (see [Sessions and Storage](../../how-it-works/sessions-and-storage.md)), and `--mcp-config` with `--strict-mcp-config` (see [MCP Settings and Policy](../mcp/settings.md#files-and-flags)).

## Example

```bash title="One JSON answer, with a budget and a schema"
claude -p "List the three biggest files in this repo" \
  --output-format json \
  --max-budget-usd 1 \
  --json-schema '{"type":"object","properties":{"files":{"type":"array","items":{"type":"string"}}},"required":["files"]}'
```

```bash title="Watch the answer grow, line by line"
claude -p "Explain this repo" --output-format stream-json --verbose --include-partial-messages \
  | while read -r line; do echo "$line" | jq -r '.type'; done
```

The second command prints a `system` line for `init`, then `stream_event` lines, then one `result` line.

## How It Works

```mermaid
flowchart TD
  A["<code>claude -p prompt</code>"] --> B[Skip trust dialog]
  B --> C[Run the agent loop]
  C --> D{"<code>--output-format</code>"}
  D -->|"<code>text</code>"| E["Final text on <code>stdout</code>"]
  D -->|"<code>json</code>"| F[One result object]
  D -->|"<code>stream-json</code>"| G[One JSON object per line]
  H["<code>stdin</code> stream-json"] -.->|messages and control requests| C
```

The loop is the same as in interactive mode. See [Agent Loop](../../how-it-works/agent-loop.md).
Permission prompts have no screen to appear on, so a host program (or `--permission-prompts none`) must decide.

## Pages in This Section

| Page | What It Covers |
| --- | --- |
| [Stream JSON Messages](stream-json.md) | Every message type that print mode writes |
| [Control Protocol](control-protocol.md) | Every control request a host can send on the same stream |

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | **Agent SDK.** The Agent SDK or the control protocol refused an option or a request. | A skill name is not valid. The caller used `sessionStore` with an option that it cannot work with. With `persistSession: false` the error says that the storage adapter needs local writes to mirror from. It tells you to pass `env: { ...process.env, CLAUDE_CONFIG_DIR: dir }`, where `dir` is a new private directory such as one from `fs.mkdtempSync(path.join(os.tmpdir(), 'claude-'))`, and to delete `dir` when the query ends. Version 2.1.314 told you to use `CLAUDE_CONFIG_DIR=/tmp` instead. The caller did not provide a callback such as `canUseTool` or `getOAuthToken`. A control request subtype is not supported. A value has the wrong type. Claude Code did not find the native CLI binary. |
| `Error: Claude Code could not save` | <Undocumented /> | **Lost writes.** Print mode could not write the transcript lines or the config changes of the run, because the disk is full or the disk quota is used up. | Since `2.1.321` (on Linux, per the [2.1.321 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)), the program prints one line to `stderr` at the end of the run and sets the exit code to 1 in `text` and `json` output. The line reads `Error: Claude Code could not save all of this session's transcript under <folder> because the disk is full (ENOSPC).` It can name `changes this run made to <config file>` too. With a lost transcript it adds `If you resume this session, part of the conversation may be missing.` For `EDQUOT` it says `your disk quota is used up (EDQUOT)` and ends with `Free up space, or ask for a larger quota, before the next run.` With `stream-json` the exit code stays as it was, and the program also writes a `system` message with subtype `session_writes_lost`, `error_code` (`ENOSPC` or `EDQUOT`), and `lost` (`transcript`, `global_config`) (the program: `chunk-d47h4m8y.js:113865` and `:115191`; the schema text at `chunk-smzekmsg.js:560230`). |
| Various | <Undocumented /> | **Exporter variables.** An OpenTelemetry exporter setting is not known. | The protocol or exporter type set in an `OTEL_*` variable is not known, or the Cloud gateway session that named the collector ended. |

## Related Pages

- [CLI Flags](../../configure/cli/flags.md)
- [Transcript Format](../../reference/transcript-format.md)
- [SDK and Automation Env Vars](../../configure/env-vars/sdk-and-automation.md)
