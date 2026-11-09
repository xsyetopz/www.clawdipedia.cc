---
title: Hook Handlers
description: The five hook handler types, command, http, mcp_tool, prompt, and agent, with every field.
sidebar_position: 3
---

A handler is the part of a hook that does the work.
It can run a command, call a URL, call an MCP tool, ask a model, or start a subagent.
The `type` key picks which one.
For example, `{"type": "command", "command": "./check.sh"}` runs a script.

To disable a handler, remove the entry or use `disableAllHooks`.

## Example

An HTTP hook that posts every `Stop` event to a local service.

```json title=".claude/settings.json"
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/claude-stop",
            "headers": { "Authorization": "Bearer $HOOK_TOKEN" },
            "allowedEnvVars": ["HOOK_TOKEN"],
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

Claude Code fills only names in `allowedEnvVars` into headers. Other references become empty strings.

## Handler Types

| Type | Status | What it does | Events it works on |
| --- | --- | --- | --- |
| `command` | <Documented /> | Runs a shell command or an executable. Input on `stdin`. Result by exit code, `stdout`, and `stderr`. | All 33 events. |
| `http` | <Documented /> | Sends the input as JSON in a POST to a URL. The result is the response body, and needs a 2xx status. | 31 events. Not `SessionStart` and not `Setup`. |
| `mcp_tool` | <Documented /> | Calls a tool on a configured MCP server. Claude Code reads the text result like `stdout`. A result with `isError: true` is a non-blocking error. A `PreToolUse` hook on a stdio or HTTP MCP server whose answer is over 16 MiB now makes Claude Code refuse the tool call, not skip the hook ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). The program has an MCP answer limit of `16777216` bytes (`chunk-fjwgd7a4.js:1108`), and the hook error path reports a message from the server that was too large (`chunk-ne1755n5.js:3692487`). | 33 events. Claude Code skips it on `Setup`, and on `SessionStart` when Claude Code starts. |
| `prompt` | <Documented /> | One model call that returns `ok`. | 12 events, plus `PermissionRequest`. |
| `agent` | <Documented /> <Experimental /> | A subagent that checks a condition. Up to 50 turns. Experimental, and the docs say it may change. | 12 events. Not `PermissionRequest`. |
| `callback` | <Undocumented /> | A function that an SDK host or a mod registers. | Events that run device hooks. It is not a config key. |
| `script` | <Differs note="Rejected in 2.1.305. Do not use." /> | Some text names this type. | `2.1.305` rejects it with `Unknown hook type "script"`. A `script` entry under `PreToolUse` also disables the whole settings file it sits in. |

The 12 events of `prompt` and `agent` are `PermissionDenied`, `PostToolBatch`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, `TeammateIdle`, `UserPromptExpansion`, and `UserPromptSubmit`.
`SessionStart` and `Setup` accept `command` and `mcp_tool` only.

:::warning
A `script` hook never runs in `2.1.305`. Worse, one `script` entry under `PreToolUse` turns off every hook in that settings file.
Source: a probe of the program (see [Probes](../../reference/probes.md)).
:::

## Common Fields

| Field | Status | What it does | Notes |
| --- | --- | --- | --- |
| `type` | <Documented /> | Picks the handler kind. | One of `command`, `http`, `mcp_tool`, `prompt`, `agent`. |
| `if` | <Documented /> | One permission rule that filters the handler. | Only tool events read it. See [Configuration](configuration.md#the-if-filter). |
| `timeout` | <Documented /> | Seconds before Claude Code cancels the hook. | A positive number. Defaults are on [Configuration](configuration.md#timeouts). |
| `statusMessage` | <Documented /> | Spinner text while the hook runs. | A string. |
| `once` | <Documented /> | Removes the hook after its first successful run. | A failure, exit 2, or timeout keeps it. Claude Code honors it only in skill frontmatter. |

## Command Fields

| Field | Status | What it does | Notes |
| --- | --- | --- | --- |
| `command` | <Documented /> | The command string, or the program to run when you set `args`. | Shell form uses `sh -c`, Git Bash, or PowerShell. |
| `args` | <Documented /> | An argument list for exec form. | No shell runs. Claude Code replaces placeholders in `command` and in each element. |
| `shell` | <Documented /> | `bash` or `powershell`. | Claude Code ignores it when you set `args`. With `powershell`, Claude Code adds `; if (-not $?) { if ($LASTEXITCODE -eq 2) { exit 2 } }` after the command, so exit code 2 blocks. It does not add it for `PermissionRequest`. It also does not add it when the command starts with `using`, `param(`, a `[type]` cast or attribute, or a named block, and also has a `begin`, `process`, `end`, `clean`, or `dynamicparam` block. Before `2.1.316`, any of those starts was enough to leave it out, so exit code 2 did not block (the program, `chunk-qd604jgh.js`). |
| `async` | <Documented /> | Runs in the background. | Claude Code does not enforce `timeout`. The hook cannot block. Output arrives on the next turn. |
| `asyncRewake` | <Documented /> | A background run that wakes the model on exit 2. | `stderr` (or `stdout` if `stderr` is empty) becomes a system reminder. `timeout` still applies. Implies `async`. |
| `onFailure` | <Documented /> | `continue` or `block`. | Needs 2.1.295. See [Configuration](configuration.md#failure-handling). Also works on `http`. |
| `rewakeMessage` | <Undocumented /> | A custom prefix for the system reminder of `asyncRewake`. | An internal field. |
| `rewakeSummary` | <Undocumented /> | A one-line summary that Claude Code shows to you for `asyncRewake`. | An internal field. Default text is `Stop hook feedback`. |
| `cloud` | <Undocumented /> | `device` or `skip` for cloud sessions that this machine drives. | An internal field. An unknown value reads as `skip`. Also works on `http`. |

## HTTP Fields

| Field | Status | What it does | Notes |
| --- | --- | --- | --- |
| `url` | <Documented /> | The POST target. | Must pass `allowedHttpHookUrls` when that setting exists. |
| `headers` | <Documented /> | Extra request headers. | Claude Code replaces `$VAR` and `${VAR}` only for names in `allowedEnvVars`. |
| `allowedEnvVars` | <Documented /> | Names that Claude Code may replace in headers. | Other references become empty strings. `httpHookAllowedEnvVars` narrows the list. |
| `onFailure` | <Documented /> | `continue` or `block`. | A non-2xx status or a connection error counts as a failure. |

## MCP Tool Fields

| Field | Status | What it does | Notes |
| --- | --- | --- | --- |
| `server` | <Documented /> | The name of a configured MCP server. | Plugin servers use `plugin:<plugin>:<server>`. |
| `tool` | <Documented /> | The tool to call. | A string. |
| `input` | <Documented /> | The tool arguments. | String values accept `${path}` from the hook input, such as `${tool_input.file_path}`. |

On events that can block, Claude Code waits for a server that is still connecting.
The wait lasts at most `MCP_TIMEOUT` and the hook `timeout`.
On observer events, it does not wait.

## Prompt and Agent Fields

| Field | Status | What it does | Notes |
| --- | --- | --- | --- |
| `prompt` | <Documented /> | The text to evaluate. | Claude Code replaces `$ARGUMENTS` with the input JSON. Without it, Claude Code appends the JSON. |
| `model` | <Differs note="Docs: the default is the background model for both types. Program: the agent default is Haiku." /> | The model for the check. | Applies to `prompt` and `agent`. |
| `continueOnBlock` | <Documented /> | Feeds an `ok: false` reason to Claude. Then it continues. | `prompt` only. Default `false`. Agent hooks always act as if `true`. |
| `ok` (model reply) | <Documented /> | `true` allows. `false` blocks. | The effect of `false` per event is in the Response schema section of the Hooks Reference. |
| `reason` (model reply) | <Documented /> | Why the model blocked. | Required when `ok` is `false`. |
| `impossible` (model reply) | <Documented /> | The condition can never be met. | On `Stop` and `SubagentStop` the turn ends. Agents ignore it. `prompt` only. |

## Prompt Hooks on `Stop` And `SubagentStop`

On `Stop` and `SubagentStop`, the program wraps the `prompt` as a stopping condition that the model judges on transcript evidence only (the program, `chunk-qd604jgh.js`).
The model must answer with a JSON object. `ok` and `reason` are required, and `impossible` is optional.
On a repeat block, the feedback to Claude holds the hook prompt in square brackets, then the `reason`.
Claude Code cuts the bracketed prompt to 500 characters on a repeat.

The turn ends after a number of consecutive blocks. The default is 8. `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` sets it, and a value of 0 or less removes the cap. The program prints a warning when the cap ends the turn (the program, `chunk-n6xbt9zz.js`).
When the cap ends the turn in a subagent or a teammate, Claude Code does not show the notice to you. Only the main session shows it (the program, `chunk-n6xbt9zz.js`). So a subagent can end with no sign in the parent.
A timeout, an API error, a reply that is not JSON, and a reply that fails the schema all leave the stop alone. The hook fails open. See the next section.

## Calls of `prompt` And `agent` Hooks

Source: the program (`chunk-qd604jgh.js`). All rows are <Undocumented />, except where a note says otherwise.

| Item | `prompt` hook | `agent` hook |
| --- | --- | --- |
| Model | The `model` field, else the background model. | The `model` field, else the background model. |
| Default timeout | 30 seconds. | 60 seconds. |
| Your `timeout` | Used as given, at least 1 second. | Used as given, at least 1 second. |
| Thinking | Off. | Off. |
| Reply | One JSON object. The request requires `ok` and `reason`. `impossible` is optional. | The agent returns the same object through a structured output tool. |
| Input | Your `prompt`, and for a stop event the transcript. | Your `prompt`. The system prompt names the transcript file, which the agent can read. |
| Tools | None. | The tools of the session, minus some, in `dontAsk` mode. A `Read` of the transcript file is allowed. |
| Turn cap | One call. | 50 assistant turns. Then the hook is `cancelled`, and it does not block. |

- On a stop event, the transcript is cut to fit. The program keeps the newest messages up to half of the window of the evaluator model. It puts a note first that says how many earlier messages it left out. The note tells the model to answer `insufficient evidence in transcript` when the proof may be in the part that was cut.
- If the evaluator says the prompt is too long, Claude Code tries once more with a smaller share of the window.
- An API error, a reply that is not JSON, a reply that fails the schema, and any other error give a non-blocking error. The stop or the tool call goes on.
- A timeout gives the outcome `cancelled`. Nothing blocks.
- An agent hook that returns no structured output is `cancelled`. If the model refused the request, Claude Code runs the agent hook again on the model of the session.
- `ok: false` blocks. The feedback is the prompt in square brackets, then a colon and the `reason`. An agent hook gives `Agent hook condition was not met:` and the `reason`.

## Prompt and Agent Concurrency

Since `2.1.312`, the program limits how many `prompt` and `agent` hooks run at the same time.
The limits do not cover `command`, `http`, or `mcp_tool` hooks.

| Limit | Status | What it does | Notes |
| --- | --- | --- | --- |
| 24 at a time | <Documented /> | At most 24 `prompt` and `agent` hooks run at once. | The program counts them per session host, not per agent. A hook over the limit waits for a free place. |
| 12 overdue | <Documented /> | At most 12 more run when they waited longer than the timeout of their event. | These hooks use a second count of 12. It is separate from the first. |
| 12 per event | <Undocumented /> | When one event starts several of these hooks, at most 12 start together. | The program also uses this number to size the time budget of the event. |

Source: the program (`chunk-ne1755n5.js:3658243` in `2.1.321`, the constants 12, 24, and 12 and the `model hooks` and `overdue model hooks` counts; older versions put them in `chunk-r5cyd28m.js`).
We did not trace that a subagent shares the session host of its parent.

## Related Pages

- [Hooks](index.md): the overview.
- [Configuration](configuration.md): matchers, `if`, timeouts, and failure handling.
- [Input and Output](input-and-output.md): what each handler can answer.

Source: [Hooks Reference](https://code.claude.com/docs/en/hooks) and the program (handler schemas for `command`, `prompt`, `mcp_tool`, `http`, and `agent`).
Cloud sessions forward only your own hooks of kind `command` and `http` from user settings, `settings.local.json`, or `--settings`. They never forward `prompt`, `agent`, or `mcp_tool` hooks, or plugin or managed hooks. A device client registers up to 128 hooks with a lease of 60 to 3600 seconds (600 by default). The cloud worker calls back with `hook_callback`. We read these rules in the program. We did not run them, because a cloud session needs a login (needs a cloud session, not run).
