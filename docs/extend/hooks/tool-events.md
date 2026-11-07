---
title: Tool Hook Events
description: The tool and tool result hook events, with their input, output, and the PostToolUse tool_response shapes.
sidebar_position: 5
---

## Tool Events

These events fire before a tool runs. They also fire when a permission prompt shows or auto mode denies a call.
They are the main place to approve, change, or block a tool call.
MCP tool names have the form `mcp__<server>__<tool>`.

### `PreToolUse`

Fires after Claude builds the tool input and before the tool runs.
It does not fire for `@` file mentions.
Exit 2 blocks the call, and `stderr` is the reason.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `tool_name` | <Documented /> | Input | The tool name. Any tool except `EndConversation`. |
| `tool_input` | <Documented /> | Input | The tool arguments. The shape depends on the tool (see below). File paths are absolute. |
| `tool_use_id` | <Documented /> | Input | The tool call ID. |
| `permissionDecision` | <Documented /> | Output, in `hookSpecificOutput` | `allow`, `deny`, `ask`, or `defer`. `allow` skips the prompt but not deny or ask rules. Order of strength: `deny`, then `defer`, then `ask`, then `allow`. `defer` works only in `-p` with one tool call. |
| `permissionDecisionReason` | <Documented /> | Output, in `hookSpecificOutput` | The reason text. For `ask` it shows in the prompt. For `deny` it goes to Claude. Otherwise it goes to the debug log. |
| `updatedInput` | <Documented /> | Output, in `hookSpecificOutput` | Replaces the whole tool input. Rules and background checks use the new input. Needed with `allow` for `AskUserQuestion` and `ExitPlanMode`. Claude Code ignores it with `defer`. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Text placed next to the tool result. Claude Code ignores it with `defer`. |
| `permissionDisplay` | <Undocumented /> | Output, in `hookSpecificOutput` | Words for a permission card. For the desktop host only. An object with `title` (200 characters), `description` (2000), and `displayName` (64). Claude Code ignores it, with a debug line, if it cannot show the text. |
| Top-level `decision` and `reason` | <Differs note="Deprecated for this event. The program schema accepts the enum on all events." /> | Output | `approve` maps to `allow`. `block` maps to `deny`. Use `permissionDecision` instead. |
| `ask` label | <Documented /> | Behavior | The prompt shows `[settings]`, `[plugin:<name>]`, or `[skill]`. An `ask` also forces a prompt in auto mode. |

#### Tool Input Shapes

The tool names link to [Tools](../../reference/tools/index.md), which holds the status and the full parameters of each tool.

| Tool | Status | Keys in `tool_input` |
| --- | --- | --- |
| [`Bash`](../../reference/tools/shell-and-web.md) | <Documented /> | `command`, `description`, `timeout` (milliseconds), `run_in_background` |
| [`PowerShell`](../../reference/tools/shell-and-web.md) | <Documented /> <Gated note="CLAUDE_CODE_USE_POWERSHELL_TOOL" /> | The same keys as `Bash`. Match with `Bash\|PowerShell`. |
| [`Write`](../../reference/tools/files.md) | <Documented /> | `file_path`, `content` |
| [`Edit`](../../reference/tools/files.md) | <Documented /> | `file_path`, `old_string`, `new_string`, `replace_all` |
| [`Read`](../../reference/tools/files.md) | <Documented /> | `file_path`, `offset`, `limit` |
| [`Glob`](../../reference/tools/files.md) | <Documented /> | `pattern`, `path` |
| [`Grep`](../../reference/tools/files.md) | <Documented /> | `pattern`, `path`, `glob`, `output_mode`, `-i`, `multiline` |
| [`WebFetch`](../../reference/tools/shell-and-web.md) | <Documented /> <Gated note="CLAUDE_CODE_DISABLE_WEB_FETCH=1 turns it off" /> | `url`, `prompt`, `offset` (2.1.290) |
| [`WebSearch`](../../reference/tools/shell-and-web.md) | <Documented /> <Gated note="off for the gateway provider. Vertex depends on the model" /> | `query`, `allowed_domains`, `blocked_domains` |
| [`Agent`](../../reference/tools/agents-and-tasks.md) | <Documented /> | `prompt`, `description`, `subagent_type`, `model` |
| [`AskUserQuestion`](../../reference/tools/agents-and-tasks.md) | <Documented /> | `questions`, and `answers` (set only through `updatedInput`) |
| [`ExitPlanMode`](../../reference/tools/agents-and-tasks.md) | <Documented /> <Gated note="internal enable check" /> | Claude Code adds `plan` and `planFilePath`. Claude Code accepts the old `allowedPrompts` key. It ignores the key. |

The docs name `Workflow` as a tool you can match, but give no input shape for it.

### `PermissionRequest`

Fires when a permission prompt would show, or when Claude Code would deny a call that cannot prompt.
This event does not honor exit 2. Deny with the `decision` object instead.
We checked this in the interactive screen. The hook fires before the dialog opens. `allow` skips the dialog. `deny` returns `message` to the model. Claude Code ignores a top-level `decision: "block"`. See [Input and Output](input-and-output.md#what-fires-and-what-is-honored-in-the-interactive-screen).
There is no event for a sandbox network request.
Handlers: `command`, `http`, `mcp_tool`, and `prompt`. Claude Code skips an `agent` hook.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `tool_name`, `tool_input` | <Documented /> | Input | The same as in `PreToolUse`. There is no `tool_use_id`. |
| `permission_suggestions` | <Documented /> | Input | Updates that Claude Code suggests. The same shape as `updatedPermissions`. A dialog may show other options. |
| `decision.behavior` | <Documented /> | Output, in `hookSpecificOutput` | `allow` or `deny`. Deny and ask rules still apply. |
| `decision.updatedInput` | <Documented /> | Output | New tool input. `allow` only. Checked again against deny and ask rules. |
| `decision.updatedPermissions` | <Documented /> | Output | Permission updates to apply. `allow` only. |
| `decision.message` | <Documented /> | Output | The reason for the denial. `deny` only. Goes to Claude. |
| `decision.interrupt` | <Documented /> | Output | Stops Claude. `deny` only. |

#### Permission Update Entries

`updatedPermissions` and `permission_suggestions` use these entries.

| Entry | Status | What it does | Fields |
| --- | --- | --- | --- |
| `addRules`, `replaceRules`, `removeRules` | <Documented /> | Change permission rules. | `rules` (each `{toolName, ruleContent?}`), `behavior` (`allow`, `deny`, `ask`), `destination` |
| `setMode` | <Documented /> | Change the permission mode. | `mode`: `default`, `auto`, `acceptEdits`, `dontAsk`, `bypassPermissions`, `plan`. `bypassPermissions` works only if bypass was on when Claude Code started. |
| `addDirectories`, `removeDirectories` | <Documented /> | Change working directories. | `directories` |
| `destination` | <Differs note="The docs list four values. The program type also includes cliArg." /> | Where Claude Code keeps the change. | `session`, `localSettings`, `projectSettings`, `userSettings` |

### `PermissionDenied`

Fires only when auto mode denies a call, including a denial with no classifier verdict.
It does not fire for manual denials, `PreToolUse` blocks, or deny rules.
Claude Code ignores the exit code and `stderr`.
We checked this in the interactive screen. An auto mode denial fired it. A manual "No" did not. On 2.1.319, the stub gave the server-side check a `flagged` verdict for a `curl` call (cases `pty.hooks.permissiondenied.auto` and `.retry`). The hook got `reason: "The server-side auto mode classifier judged this action dangerous (it gave no explanation)"`. The tool did not run, and the turn went on. With `retry: true`, the model's next request got the extra text `The PermissionDenied hook indicated you may retry this tool call.` after the denied tool result. Without `retry` that text was absent. `PermissionRequest` did not fire, and `systemMessage` was not shown. The program adds the text only when the denial has a verdict and does not end the turn (the program, `chunk-24jdhyyr.js@4197885`). With no verdict through a custom base URL, the program showed the dialog `Auto mode can't check actions in this session` and `PermissionDenied` did not fire.
This event accepts all five handler types. Claude Code drops output from `prompt` and `agent`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `tool_name`, `tool_input`, `tool_use_id`, `mcp_server` | <Documented /> | Input | As in `PreToolUse`. |
| `reason` | <Documented /> | Input | Why auto mode denied. From the local classifier, a rule name in brackets, such as `[Data Exfiltration]`. From the server-side check, `The server-side auto mode classifier judged this action dangerous (it gave no explanation)`. |
| `retry` | <Documented /> | Output, in `hookSpecificOutput` | `true` tells the model it may retry. The denial stands. Ignored for denials with no verdict and for denials that end the turn. |

## Tool Result Events

These events fire after a tool runs. `PostToolUse` and `PostToolUseFailure` match on tool name. `PostToolBatch` has no matcher.
All three accept the five handler types.

### `PostToolUse`

Fires after a tool call succeeds.
Exit 2 shows `stderr` to Claude but does not undo the tool.
It does not see writes made by `Bash` or by outside processes. Use `FileChanged` for those.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `tool_name`, `tool_input`, `tool_use_id`, `mcp_server` | <Documented /> | Input | As in `PreToolUse`. |
| `tool_response` | <Documented /> | Input | The structured tool output. The shape depends on the tool. |
| `duration_ms` | <Documented /> | Input | Run time in milliseconds. Excludes permission prompts and `PreToolUse` hooks. Optional. |
| `decision`, `reason` | <Documented /> | Output | `block` adds the reason next to the result. Claude still sees the original output. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Text next to the result. Claude Code does not deliver it for async hooks. |
| `updatedToolOutput` | <Documented /> | Output, in `hookSpecificOutput` | Replaces what Claude sees. Must match the tool output shape. For built-in tools, Claude Code ignores a bad shape. The tool already ran. |
| `updatedMCPToolOutput` | <Documented /> | Output, in `hookSpecificOutput` | The same, for MCP tools only. Prefer `updatedToolOutput`. |
| `classifierContext` | <Documented /> | Output, in `hookSpecificOutput` | A note for the auto mode classifier. Needs 2.1.236. At most 2,000 characters for one call. Dropped for async hooks and read-only calls. Treated as unverified context. |
| `tool_response.bashEditDiff` | <Documented /> | Input | Files that a `Bash` run changed. Needs 2.1.269, a public beta, and the setting `bashEditDiffEnabled`. Keys: `changedFiles` (200), `files` (5), `moreFiles`, `unavailable`, `skipped`, `shared`. |
| `tool_response` of `Agent` | <Documented /> | Input | `status` (`completed` or `async_launched`), `agentId`, `content`, `resolvedModel`, `modelsUsed`, `totalTokens`, `totalDurationMs`, `totalToolUseCount`, `usage`, and `outputFile` when the agent starts in the background. |
| `tool_response` of `ExitPlanMode` | <Documented /> | Input | `plan` and `filePath`. |
| `SubagentHandback` tool | <Documented /> | Matcher | The tool that carries a subagent report in auto mode. Match it to read `tool_input.message`. Needs 2.1.271. |

### `PostToolUseFailure`

Fires when a started tool fails, or an MCP tool returns an error.
It does not fire for unknown tools, schema errors, or permission denials.
Exit 2 shows `stderr` to Claude.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `tool_name`, `tool_input`, `tool_use_id`, `mcp_server` | <Documented /> | Input | As in `PostToolUse`. |
| `error` | <Documented /> | Input | What went wrong. The same text as the tool result. `Bash` and `PowerShell` errors start with `Exit code N`. |
| `is_interrupt` | <Documented /> | Input | `true` for an abort. Canceling a running tool does not fire this hook. |
| `duration_ms` | <Documented /> | Input | Run time in milliseconds. Optional. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Text next to the error. A top-level `decision: "block"` also works. |

### `PostToolBatch`

Fires once after all tool calls of a batch resolve, before the next model request.
Exit 2, `decision: "block"`, or `continue: false` stops the loop.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `tool_calls` | <Documented /> | Input | One entry per call, with `tool_name`, `tool_input`, `tool_use_id`, and `tool_response`. |
| `tool_calls[].tool_response` | <Documented /> | Input | What the model gets in the `tool_result`. A serialized string or content blocks. It is not the `PostToolUse` object. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Context for the next request. Claude Code sends it once. |

## `PostToolUse` `tool_response` Shapes

We logged the stdin of a `PostToolUse` command hook in `-p` on `2.1.305`, with one scripted call per tool. This is the `tool_response` you can read, and the shape `updatedToolOutput` replaces.

| Tool | Status | `tool_response` |
| --- | --- | --- |
| `Bash` | <Documented /> | `stdout`, `stderr`, `interrupted`, `isImage`, and `noOutputExpected`. |
| `Read` (text) | <Undocumented /> | `type` (`text`) and `file` with `filePath`, `content`, `numLines`, `startLine`, and `totalLines`. |
| `Write` (new file) | <Undocumented /> | `type` (`create`), `filePath`, `content`, `structuredPatch` (empty), `originalFile` (`null`), and `userModified`. |
| `Edit` | <Undocumented /> | `filePath`, `oldString`, `newString`, `originalFile`, `structuredPatch` (items with `oldStart`, `oldLines`, `newStart`, `newLines`, `lines`), `userModified`, `replaceAll`, and `contentNotInModelContext`. The last key shows only when the file had a partial `Read` (with `offset` and `limit`) or no `Read`. `tool_input` also has `replace_all`. |
| `ToolSearch` | <Undocumented /> | `matches` (tool names), `query`, and `total_deferred_tools`. `tool_input` also has `max_results`. |
| `Agent` | <Undocumented /> | First the async start: `isAsync`, `status` (`async_launched`), `agentId`, `description`, `resolvedModel`, `prompt`, `outputFile`, `canReadOutputFile`, and `canContinueAgent`. Then, for a finished subagent: `status` (`completed`), `prompt`, `agentId`, `agentType`, `content` (text blocks), `resolvedModel`, `totalDurationMs`, `totalTokens`, `totalToolUseCount`, `usage`, `canContinueAgent`, `harnessNoteCount`, `harnessTailCount`, and `harnessSectionHash`. |
| `ListAgents` | <Undocumented /> | `listing` (text), `sections`, and `notes`. |
| `CronCreate` | <Undocumented /> | `id`, `humanSchedule`, `recurring`, `durable`, and `nextFireAt`. |
| `CronList` | <Undocumented /> | `jobs`. |
| `Read` (notebook) | <Undocumented /> | `type` (`notebook`) and `file` with `filePath` and `cells` (items with `cellType`, `source`, `cell_id`, and `language`). Seen on 2.1.319. |
| `Glob` | <Undocumented /> | `filenames`, `durationMs`, `numFiles`, `truncated`, `totalMatches`, and `countIsComplete`. Seen on 2.1.319. |
| `Grep` (`files_with_matches`) | <Undocumented /> | `mode`, `filenames`, `numFiles`, and `totalFiles`. Seen on 2.1.319. |
| `NotebookEdit` | <Undocumented /> | `new_source`, `old_source`, `cell_type`, `language`, `edit_mode`, `cell_id`, `error` (empty), `notebook_path`, `original_file`, and `updated_file`. Seen on 2.1.319, after a `Read` of the notebook. |
| `WebSearch` | <Undocumented /> | `query`, `results`, `durationSeconds`, and `searchCount`. Seen on 2.1.319 against the stub, so `results` held the stub text and `searchCount` was `0`. |

A second probe ran the same hook in the interactive screen (2.1.305, `acceptEdits`, one scripted call per tool). It confirmed the shapes of `Bash`, `Read`, `Write`, and `Edit` above, with one difference: the `Edit` result after a `Read` had no `contentNotInModelContext` key. It also confirmed that an MCP tool's `tool_response` is the array of content blocks the server returned (`[{"type":"text","text":"echo:OK"}]`), and that the hook input has `mcp_server`. Every `PostToolUse` input had `hook_event_name`, `tool_name`, `tool_input`, `tool_response`, `tool_use_id`, and `duration_ms`. On `2.1.305` an `Edit` of a file that was never read was not an error, in `acceptEdits` and in the default mode. The file changed, `PostToolUse` fired, and no `PostToolUseFailure` fired. That `tool_response` had `contentNotInModelContext: true`, which the `Edit` after a `Read` did not have. See [Interactive Probes](../../reference/probes.md#interactive-probes).

A third probe (2.1.319, `-p`) ran `Read` of a notebook, `Glob`, `Grep`, `NotebookEdit`, `WebFetch`, and `WebSearch`, with `ENABLE_TOOL_SEARCH=false` so that no tool was deferred. The `Glob`, `Grep`, `NotebookEdit`, and `WebSearch` rows above come from it. These results do not show in the table:

- `WebFetch` of `example.com` failed the domain check, so only `PostToolUseFailure` fired, with `is_interrupt: false` and the `error` `Unable to verify if domain example.com is safe to fetch. This may be due to network restrictions or enterprise security policies blocking claude.ai.`
- `NotebookEdit` with no `Read` of the notebook first got the `tool_result` error `File has not been read yet. Read it first before writing to it.` Neither `PostToolUse` nor `PostToolUseFailure` fired.
- `--allowedTools Glob` added `Glob` and `Grep` to the request tool list. Without it, the `-p` tool list had neither.
- A `Glob` hook that returned `updatedToolOutput` with `filenames: ["REPLACED.txt"]`, `durationMs`, `numFiles`, and `truncated` changed the `tool_result` in the next request to `REPLACED.txt`. A hook that returned `{"bogus": "REPLACED"}` changed nothing: the model got `a.txt`, the real match. The ignored value was still written to the transcript.

## Related Pages

- [Hook Events](events.md): all 33 events and where each one is documented.
- [Input and Output](input-and-output.md): common fields, decisions, and exit codes.
- [Configuration](configuration.md): matchers and timeouts.
