---
title: Classic Tool Use, Session, and Task Types
description: "Types of the pre tool use, session, setup, stop, subagent, task, teammate, prompt, and worktree hook inputs."
sidebar_position: 3
---

These types describe the input of the pre tool use, session, setup, stop, subagent, task, teammate, prompt, and worktree events, with the `PreToolUse` result. Use them to type the `e` of a `classic.*` hook for one of these events. `PreToolUseResult` lets a hook allow, ask, or deny a tool call.

## Types with Fields

Each type below has its own table of fields.

### `PreToolUseDecision`

The decision of a `classic.PreToolUse` result: `allow`, `ask`, `deny`, or none.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `allow` | <Documented /> | Lets the call run without a permission prompt. The managed-settings hooks ran first. A deny from them ended the chain above. | Type: `true`. |
| `ask` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `ask` | <Documented /> | Asks the user before the call runs. The engine displays the text as the reason. | Type: `string`. |
| `allow` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Refuses the call. The model receives the text as the reason. | Type: `string`. |
| `allow` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `ask` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `allow` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `ask` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `PreToolUseHookInput`

Fields of `PreToolUseHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PreToolUse`. | Type: `'PreToolUse'`. |
| `tool_name` | <Documented /> | The name of the tool. | Type: `string`. |
| `tool_input` | <Documented /> | The arguments the tool was called with. | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. |
| `mcp_server` | <Documented /> | The MCP server the tool comes from, for an `mcp__*` tool. | Type: `McpServerProvenance`. Optional. |

### `PreToolUseResult`

What a `classic.PreToolUse` hook returns: one of `allow`, `ask`, `deny`, or none of them. None passes the call on to the normal permission flow. The type is the intersection of `PreToolUseResult` and `PreToolUseDecision`. The event fires inside `tool.call`, beneath the `tool.call` hook of every plugin.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `updatedInput` | <Documented /> | Replaces the arguments of the tool. The engine checks them against the schema of the tool before the tool runs. | Type: `Record<string, unknown>`. Optional. |
| `additionalContext` | <Documented /> | Extra context handed to the model with the call, one entry for each note. | Type: `string[]`. Optional. |

### `SessionEndHookInput`

Fields of `SessionEndHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `SessionEnd`. | Type: `'SessionEnd'`. |
| `reason` | <Documented /> | Why the session ended. | Type: `ExitReason`. |

### `SessionStartHookInput`

Fields of `SessionStartHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `SessionStart`. | Type: `'SessionStart'`. |
| `source` | <Documented /> | How the session started: `startup`, `resume`, `clear`, `compact`, or `fork`. | Type: `'startup' \| 'resume' \| 'clear' \| 'compact' \| 'fork'`. |
| `agent_type` | <Documented /> | The agent type name, when the session started with `--agent`. | Type: `string`. Optional. |
| `model` | <Documented /> | The model in use at the start. | Type: `string`. Optional. |
| `session_title` | <Documented /> | The title of the session. | Type: `string`. Optional. |
| `seconds_since_last_response` | <Documented /> | resume/fork: seconds since the last assistant response of the resumed transcript | Type: `number`. Optional. |
| `context_tokens` | <Documented /> | resume/fork: the input + cache_read + cache_creation + output tokens of the last response of the resumed transcript. For a server-side tool loop, it is the window of its last iteration, not the summed totals. | Type: `number`. Optional. |
| `prompt_cache_likely_expired` | <Documented /> | resume/fork: seconds_since_last_response exceeds the prompt-cache TTL, so the first request re-caches context_tokens | Type: `boolean`. Optional. |
| `estimated_cache_write_usd` | <Documented /> | resume/fork: estimated cost of re-caching context_tokens on the session model. It uses the managed modelPricing when set, otherwise list price. It excludes the response | Type: `number`. Optional. |

### `SetupHookInput`

Fields of `SetupHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `Setup`. | Type: `'Setup'`. |
| `trigger` | <Documented /> | What ran setup: `init` or `maintenance`. | Type: `'init' \| 'maintenance'`. |

### `StopFailureHookInput`

Fields of `StopFailureHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `StopFailure`. | Type: `'StopFailure'`. |
| `error` | <Documented /> | The error that ended the turn. | Type: `SDKAssistantMessageError`. |
| `error_details` | <Documented /> | More detail about the error. | Type: `string`. Optional. |
| `last_assistant_message` | <Documented /> | The rendered API error text that the conversation displays, such as `API Error: Rate limit reached`. It is not text that Claude wrote. | Type: `string`. Optional. See [StopFailure input](https://code.claude.com/docs/en/hooks#stopfailure-input). |

### `StopHookInput`

Fields of `StopHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `Stop`. | Type: `'Stop'`. |
| `stop_hook_active` | <Documented /> | `true` when a stop hook already continued the turn. Check it to avoid loops. | Type: `boolean`. |
| `last_assistant_message` | <Documented /> | Text content of the last assistant message before stopping. You do not need to read and parse the transcript file. | Type: `string`. Optional. |
| `background_tasks` | <Documented /> | In-flight background work in this session. Lets a hook tell "session is done" from "session is paused for background work". Empty when nothing is in flight. | Type: `BackgroundTaskSummary[]`. Optional. |
| `session_crons` | <Documented /> | Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later. Empty array when none are scheduled. | Type: `SessionCronSummary[]`. Optional. |

### `SubagentStartHookInput`

Fields of `SubagentStartHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `SubagentStart`. | Type: `'SubagentStart'`. |
| `agent_id` | <Documented /> | The ID of the subagent. | Type: `string`. |
| `agent_type` | <Documented /> | The agent type name of the subagent. | Type: `string`. |

### `SubagentStopHookInput`

Fields of `SubagentStopHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `SubagentStop`. | Type: `'SubagentStop'`. |
| `stop_hook_active` | <Documented /> | `true` when a stop hook already continued the turn. Check it to avoid loops. | Type: `boolean`. |
| `agent_id` | <Documented /> | The ID of the subagent. | Type: `string`. |
| `agent_transcript_path` | <Documented /> | Path to the subagent transcript. `transcript_path` is the main one. | Type: `string`. |
| `agent_type` | <Documented /> | The agent type name, such as `general-purpose`. | Type: `string`. |
| `last_assistant_message` | <Documented /> | Text content of the last assistant message before stopping. You do not need to read and parse the transcript file. | Type: `string`. Optional. |
| `background_tasks` | <Documented /> | In-flight background work in this session. Lets a hook tell "session is done" from "session is paused for background work". Empty when nothing is in flight. | Type: `BackgroundTaskSummary[]`. Optional. |
| `session_crons` | <Documented /> | Session-scoped cron tasks (CronCreate, ScheduleWakeup, /loop) that will wake this session later. Empty array when none are scheduled. | Type: `SessionCronSummary[]`. Optional. |

### `TaskCompletedHookInput`

Fields of `TaskCompletedHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `TaskCompleted`. | Type: `'TaskCompleted'`. |
| `task_id` | <Documented /> | The ID of the task. | Type: `string`. |
| `task_subject` | <Documented /> | The title of the task. | Type: `string`. |
| `task_description` | <Documented /> | The longer text of the task. | Type: `string`. Optional. |
| `teammate_name` | <Documented /> | The name of the teammate. | Type: `string`. Optional. |
| `team_name` | <Documented /> | The name of the team. | Type: `string`. Optional. Deprecated: Sessions have a single implicit team. This carries the session-derived team name and will be removed in a future release. |

### `TaskCreatedHookInput`

Fields of `TaskCreatedHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `TaskCreated`. | Type: `'TaskCreated'`. |
| `task_id` | <Documented /> | The ID of the task. | Type: `string`. |
| `task_subject` | <Documented /> | The title of the task. | Type: `string`. |
| `task_description` | <Documented /> | The longer text of the task. | Type: `string`. Optional. |
| `teammate_name` | <Documented /> | The name of the teammate. | Type: `string`. Optional. |
| `team_name` | <Documented /> | The name of the team. | Type: `string`. Optional. Deprecated: Sessions have a single implicit team. This carries the session-derived team name and will be removed in a future release. |

### `TeammateIdleHookInput`

Fields of `TeammateIdleHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `TeammateIdle`. | Type: `'TeammateIdle'`. |
| `teammate_name` | <Documented /> | The name of the idle teammate. | Type: `string`. |
| `team_name` | <Documented /> | The name of the team. | Type: `string`. Deprecated: Sessions have a single implicit team. This carries the session-derived team name and will be removed in a future release. |

### `UserPromptExpansionHookInput`

Fields of `UserPromptExpansionHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `UserPromptExpansion`. | Type: `'UserPromptExpansion'`. |
| `expansion_type` | <Documented /> | What expanded: `slash_command` or `mcp_prompt`. | Type: `'slash_command' \| 'mcp_prompt'`. |
| `command_name` | <Documented /> | The name of the command. | Type: `string`. |
| `command_args` | <Documented /> | The arguments given to the command. | Type: `string`. |
| `command_source` | <Documented /> | Where the command came from, such as `plugin`. | Type: `string`. Optional. |
| `prompt` | <Documented /> | The prompt text. | Type: `string`. |

### `UserPromptSubmitHookInput`

Fields of `UserPromptSubmitHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `UserPromptSubmit`. | Type: `'UserPromptSubmit'`. |
| `prompt` | <Documented /> | The text the person submitted. | Type: `string`. |
| `source` | <Documented /> | Who wrote the prompt: `user` (interactive), `sdk` (`-p` or Agent SDK), `loop_wakeup`, `schedule_wakeup`, `system` (machine-injected), or `poll_event`. Payloads may omit it. | Type: `'user' \| 'sdk' \| 'system' \| 'loop_wakeup' \| 'schedule_wakeup' \| 'poll_event'`. Optional. |
| `session_title` | <Documented /> | The title of the session. | Type: `string`. Optional. |

### `WorktreeCreateHookInput`

Fields of `WorktreeCreateHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `WorktreeCreate`. | Type: `'WorktreeCreate'`. |
| `name` | <Documented /> | The name of the worktree to create. | Type: `string`. |

### `WorktreeRemoveHookInput`

Fields of `WorktreeRemoveHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `WorktreeRemove`. | Type: `'WorktreeRemove'`. |
| `worktree_path` | <Documented /> | The path of the worktree to remove. | Type: `string`. |

## Related Pages

- [Classic Event Types](index.md)
- [Mod API Types](../index.md)
