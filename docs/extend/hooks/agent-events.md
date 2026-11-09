---
title: Agent, Task, and Other Hook Events
description: The agent, task, compaction, model switch, elicitation, and worktree hook events, with their input and output.
sidebar_position: 7
---

## Agent and Task Events

These events tell your hooks when a subagent, a task, or a teammate starts, stops, or goes idle.
Teammates belong to agent teams. See [Subagent Runtime](../subagents/runtime.md#agent-teams).

### `SubagentStart`

Fires when a subagent starts or resumes, and for each message of an in-process teammate.
The matcher is the agent type.
It cannot block. Exit 2 shows `stderr` in the subagent transcript only.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `agent_id`, `agent_type` | <Documented /> | Input | The subagent ID and type. A plugin agent type is `my-plugin:reviewer`. Anchor the matcher with `^` and `$`. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Context for the subagent before its first prompt. On a repeat run, Claude Code adds it only if the earlier copy is gone, to keep the cache. |

### `SubagentStop`

Fires when a subagent finishes.
The matcher is the agent type.
Exit 2 or `decision: "block"` keeps it running, and `reason` is its next instruction.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `stop_hook_active`, `last_assistant_message`, `background_tasks`, `session_crons` | <Documented /> | Input | As in `Stop`. The two arrays apply to the parent session. |
| `agent_id`, `agent_type` | <Documented /> | Input | The subagent ID and type. `agent_type` can be empty for internal agents, such as prompt suggestions and `/btw`. A named matcher does not match an empty type. |
| `agent_transcript_path` | <Documented /> | Input | The subagent transcript, in a nested `subagents/` folder. `transcript_path` is the main one. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Non-error feedback that keeps the subagent running. Same loop guards as `Stop`. |

### `TaskCreated`

Fires when `TaskCreate` makes a task.
It has no matcher. It does not fire in a session without the Task tools.
Exit 2 or `decision: "block"` removes the task. Claude gets the message.
Claude Code ignores `continue: false`.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `task_id`, `task_subject` | <Documented /> | Input | The task ID and title. |
| `task_description`, `teammate_name` | <Documented /> | Input | Optional detail and the creator. May be absent. |
| `team_name` | <Documented /> | Input | The session team name. Deprecated, to be removed. |
| `agent_id` | <Documented /> | Input | The creating subagent or teammate. Needs 2.1.290. May be absent. |

### `TaskCompleted`

Fires when a task changes to done, or when a teammate ends its turn with open tasks.
It has no matcher.
Exit 2 keeps the task open, and `stderr` goes to the model.
`continue: false` stops a teammate. Claude Code ignores it when `TaskUpdate` caused the event.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `task_id`, `task_subject`, `task_description`, `teammate_name` | <Documented /> | Input | As in `TaskCreated`. |
| `team_name`, `agent_id` | <Documented /> | Input | The deprecated team name, and the acting agent. `agent_id` needs 2.1.290. |

### `TeammateIdle`

Fires when an agent team teammate is about to go idle.
It has no matcher.
Exit 2 gives `stderr` to the teammate, and it keeps working. `continue: false` stops it.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `teammate_name`, `team_name` | <Documented /> | Input | The teammate and the deprecated team name. |
| `agent_id` | <Documented /> | Input | The in-process teammate. Needs 2.1.290. May be absent. |

## Other Events

These events cover compaction, model switches, MCP questions, and worktrees.
None of them accepts `prompt` or `agent` handlers.

### `PreCompact` And `PostCompact`

`PreCompact` fires before a compaction. `PostCompact` fires after it.
The matcher is `trigger`.
For `PreCompact`, exit 2 or `decision: "block"` blocks it. We checked this in the interactive screen. `continue: false` did not stop the compaction.
Blocking a proactive auto compaction skips it. Blocking a recovery compaction shows the API error.
`PostCompact` has no decision. Exit 2 shows `stderr` to you.
Handlers: `command`, `http`, `mcp_tool`.
For the compaction process, see [Context and Compaction](../../how-it-works/context-and-compaction.md).

| Field | Status | Event | What it does |
| --- | --- | --- | --- |
| `trigger` | <Documented /> | Both, input | `manual` or `auto`. `auto` includes idle compaction. |
| `custom_instructions` | <Documented /> | `PreCompact`, input | The text after `/compact`. `null` for `auto` or when empty. |
| `compact_summary` | <Documented /> | `PostCompact`, input | The summary that Claude Code made. |

### `PreModelSwitch` And `PostModelSwitch`

Both need 2.1.251.
The matcher is the canonical name of `to_model`.
Handlers: `command`, `http`, `mcp_tool`.
For how a model is chosen, see [Models](../../how-it-works/models.md).

`PreModelSwitch` fires before a requested switch: `/model`, the picker, `/config`, fast mode, or `set_model`.
It does not fire for automatic fallback or resume.
The timeout is 30 seconds, and a timeout blocks.
Exit 2 or `decision: "block"` cancels the switch.

`PostModelSwitch` fires after the model changes, also on fallback, `opusplan`, and resume.
It cannot block. It does not fire for a one-turn fallback chain.
Plain `stdout` is context. Exit 2 shows `stderr` as a notice.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `from_model`, `to_model`, `requested_model` | <Documented /> | Input | The model IDs and the name you asked for. `requested_model` is `null` for the default. |
| `source` | <Documented /> | Input | `command`, `picker`, or `sdk`. `PostModelSwitch` adds `auto` and `resume`. |
| `context_tokens`, `prompt_cache_warm`, `cache_ttl` | <Documented /> | Input | The cost of sending the context again. `cache_ttl` is `5m` or `1h`. |
| `estimated_cache_write_usd`, `pricing` | <Documented /> | Input | The estimate and its basis. `pricing` is `configured`, `catalog`, or `default`. |
| `permissionDecision`, `permissionDecisionReason` | <Documented /> | Output, `PreModelSwitch` | `allow`, `deny`, `ask`, and the reason. `ask` works only in interactive `/model`. Otherwise it is a refusal. No `defer`, `updatedInput`, or `additionalContext`. Strength order: `deny`, `ask`, `allow`. |
| `additionalContext` | <Documented /> | Output, `PostModelSwitch` | Text for the next request. If the hook is late by 5 seconds, it goes to the request after. |

### `Elicitation` And `ElicitationResult`

An elicitation is a question that an MCP server asks you.
The matcher for both events is the server name.
Handlers: `command`, `http`, `mcp_tool`.

`Elicitation` fires when the server asks. A hook can answer, so no dialog shows. Exit 2 declines.
Claude Code drops `reason`, `systemMessage`, and `continue`.
`ElicitationResult` fires after you answer, before the answer goes to the server. It also runs on decline and cancel.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `mcp_server_name`, `message` | <Documented /> | `Elicitation`, input | The server and the prompt text. |
| `mode`, `url`, `elicitation_id`, `requested_schema` | <Documented /> | `Elicitation`, input | `form` or `url` mode, the URL, the ID, and the form schema. Optional. |
| `action`, `content` | <Documented /> | `Elicitation`, output | `accept`, `decline`, `cancel`, and the form values. Read only on exit 0. A hook answer skips `ElicitationResult` hooks. A decline beats an accept. |
| `decision: "block"` | <Documented /> | `Elicitation`, output | Declines. Works from 2.1.284. Beats `action`. |
| `action`, `content`, `mode`, `elicitation_id` | <Documented /> | `ElicitationResult`, input | Your answer. `action` is `accept`, `decline`, or `cancel`. |
| `action`, `content` | <Documented /> | `ElicitationResult`, output | Change or block the answer. `content` replaces the whole object. Claude Code ignores an output with no `action`. `cancel` still sends your values. |

Both events fired in an interactive probe for an MCP server that asked for input in form mode and in URL mode. The `Elicitation` input had `mcp_server_name`, `message`, `mode`, and `requested_schema`. The `ElicitationResult` input had `action` and `content`. See [Interactive Probes](../../reference/probes.md#interactive-probes).

### `WorktreeCreate` And `WorktreeRemove`

`WorktreeCreate` replaces the default `git worktree` step.
It fires for `--worktree`, `EnterWorktree`, `isolation: "worktree"`, workflows, background sessions, and remote control.
It has no matcher. Any non-zero exit fails it.
Claude Code does not process `.worktreeinclude`.

`WorktreeRemove` removes a worktree that a `WorktreeCreate` hook made.
It has no matcher. Exit 0 counts as removed. A non-zero exit fails the removal if the folder still exists.
Claude Code keeps a subagent worktree. It drops JSON.

Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `name` | <Documented /> | `WorktreeCreate`, input | The slug of the new worktree, such as `bold-oak-a3f2`. |
| Path on `stdout` | <Documented /> | `WorktreeCreate`, output | A command hook prints the path as its last non-empty line. Claude Code strips ANSI codes. A relative path resolves against the hook folder. Claude Code refuses absolute paths with `.` or `..`, and paths through a repo symlink. |
| `worktreePath` | <Documented /> | `WorktreeCreate`, output | An HTTP hook returns the path here. A command hook cannot return JSON, so it cannot use `terminalSequence`. |
| `worktree_path` | <Documented /> | `WorktreeRemove`, input | The absolute path to remove. |

## Related Pages

- [Hook Events](events.md): all 33 events and where each one is documented.
- [Input and Output](input-and-output.md): common fields, decisions, and exit codes.
- [Configuration](configuration.md): matchers and timeouts.
