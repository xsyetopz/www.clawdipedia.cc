---
title: Classic Result, Config, and Elicitation Types
description: "Types of classic results, the base hook input, and the config, directory, elicitation, file, and message hook inputs."
sidebar_position: 1
---

These types describe the base hook input, the result of a classic hook, and the inputs of the config, directory, elicitation, file, instructions, and message events. Use `BaseHookInput` for the fields that every classic input has. Use `ClassicResultOf` for what a `classic.*` hook returns.

## Types with Fields

Each type below has its own table of fields.

### `BackgroundTaskSummary`

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | The ID of the background task. | Type: `string`. |
| `type` | <Documented /> | Friendly task-type label (for example 'shell', 'subagent', 'monitor', 'workflow'). It falls back to the raw discriminant for unknown types. | Type: `string`. |
| `status` | <Documented /> | The status of the background task. | Type: `string`. |
| `description` | <Documented /> | Free-text description. Capped at 1000 chars. Clipped values append an in-string "... [+N chars]" marker. | Type: `string`. |
| `command` | <Documented /> | Shell command line. Only present for 'shell' tasks. Capped at 1000 chars with the same "... [+N chars]" marker. | Type: `string`. Optional. |
| `agent_type` | <Documented /> | Subagent type name. Only present for 'subagent' tasks. | Type: `string`. Optional. |
| `server` | <Documented /> | MCP server name. Only present for 'monitor' / 'MCP task' tasks. | Type: `string`. Optional. |
| `tool` | <Documented /> | MCP tool name. Only present for 'monitor' / 'MCP task' tasks. | Type: `string`. Optional. |
| `name` | <Documented /> | Workflow name. Only present for 'workflow' tasks. | Type: `string`. Optional. |

### `BaseHookInput`

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `session_id` | <Documented /> | The ID of the current session. | Type: `string`. |
| `transcript_path` | <Documented /> | Path to the conversation JSONL file. See [Transcript Format](../../../../reference/transcript-format.md). | Type: `string`. |
| `cwd` | <Documented /> | The working directory when the hook fires. | Type: `string`. |
| `prompt_id` | <Documented /> | A UUID that ties a user prompt to all later events until the next prompt. It is also the `prompt.id` attribute on OpenTelemetry events. Absent until the first user input. | Type: `string`. Optional. |
| `permission_mode` | <Documented /> | The permission mode in force, such as `default`, `plan`, or `acceptEdits`. See [Input and Output](../../../hooks/input-and-output.md). | Type: `string`. Optional. |
| `agent_id` | <Documented /> | Subagent identifier. Present only when the hook fires inside a subagent. Absent on the main thread. Use it, not `agent_type`, to tell subagent calls apart. | Type: `string`. Optional. |
| `agent_type` | <Documented /> | Agent type name, such as `general-purpose`. Present inside a subagent, or on the main thread of a session started with `--agent`. | Type: `string`. Optional. |
| `effort` | <Documented /> | Reasoning effort of the current turn. Present for hooks in a tool-use context on a model that supports effort. Absent for session-lifecycle hooks. | Type: `object`. Optional. |

### `ClassicEventOf`

The classic (settings) hook events, one for each classic event name. `e` is the whole stdin input of the hook, with the base fields (`transcript_path`, `cwd`) included. Object. One key for each classic event. The chain is managed settings hooks, then hooks modules, then the other settings hooks. A managed block ends it, so no module above it runs.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `` [E in ClassicHookEvent as `classic.${E}`] `` | <Documented /> | The input of each `classic.*` event: the tool-call envelope for `classic.PreToolUse`, the hook input for the rest. | Type: `E extends 'PreToolUse' ? ToolCallEnvelope : ClassicHookInputs[E]`. |

### `ClassicResult`

Everything that the answer of a classic hook event can carry, named as the JSON output of the classic hook names it. Each event reads its subset (ClassicResultOf). The settings hooks fold into one of these. A field of the wrong shape fails the hook.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `block` | <Documented /> | `decision: "block"` with this text as `reason` (a command hook's exit code 2): the block, veto or re-prompt of the event. | Type: `string`. Optional. |
| `preventContinuation` | <Documented /> | `continue: false`: the session stops after this event. | Type: `true`. Optional. |
| `stopReason` | <Documented /> | Displayed when `preventContinuation` stops the session (`stopReason`). | Type: `string`. Optional. |
| `additionalContext` | <Documented /> | `hookSpecificOutput.additionalContext`, one entry for each hook: text handed to the model with the event. | Type: `string[]`. Optional. |
| `sessionTitle` | <Documented /> | `hookSpecificOutput.sessionTitle` (UserPromptSubmit, SessionStart). | Type: `string`. Optional. |
| `suppressOriginalPrompt` | <Documented /> | `hookSpecificOutput.suppressOriginalPrompt` (UserPromptSubmit, UserPromptExpansion). | Type: `true`. Optional. |
| `initialUserMessage` | <Documented /> | `hookSpecificOutput.initialUserMessage` (SessionStart). | Type: `string`. Optional. |
| `watchPaths` | <Documented /> | `hookSpecificOutput.watchPaths` (SessionStart). | Type: `string[]`. Optional. |
| `reloadSkills` | <Documented /> | `hookSpecificOutput.reloadSkills` (SessionStart). | Type: `true`. Optional. |
| `permissionDecision` | <Documented /> | `hookSpecificOutput.permissionDecision` (PreModelSwitch). | Type: `'allow' \| 'deny' \| 'ask'`. Optional. |
| `permissionDecisionReason` | <Documented /> | `hookSpecificOutput.permissionDecisionReason` (PreModelSwitch). | Type: `string`. Optional. |
| `decision` | <Documented /> | `hookSpecificOutput.decision` (PermissionRequest). | Type: `PermissionRequestDecision`. Optional. |
| `updatedToolOutput` | <Documented /> | `hookSpecificOutput.updatedToolOutput` (PostToolUse): replaces what the model sees of the result of the tool. | Type: `unknown`. Optional. |
| `updatedMCPToolOutput` | <Documented /> | `hookSpecificOutput.updatedMCPToolOutput` (PostToolUse, MCP tools only). | Type: `unknown`. Optional. |
| `retry` | <Documented /> | `hookSpecificOutput.retry` (PermissionDenied). | Type: `true`. Optional. |
| `displayContent` | <Documented /> | `hookSpecificOutput.displayContent` (MessageDisplay). | Type: `string`. Optional. |
| `worktreePath` | <Documented /> | `hookSpecificOutput.worktreePath` (WorktreeCreate, a command hook prints it): the worktree that the hook created, absolute or relative to its cwd. | Type: `string`. Optional. If unset, the session creates its git worktree as it would unhooked. Deprecated for a module: answer `vcs.isolate` instead. This field still works. |

### `ClassicResultFields`

The event-specific fields of ClassicResult that each classic event reads (its `hookSpecificOutput`), by event. An event absent here reads none of them. Every event has `block`, `preventContinuation` and `stopReason`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `UserPromptSubmit` | <Documented /> | The result fields of `classic.UserPromptSubmit`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext' \| 'sessionTitle' \| 'suppressOriginalPrompt'`. |
| `UserPromptExpansion` | <Documented /> | The result fields of `classic.UserPromptExpansion`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext' \| 'suppressOriginalPrompt'`. |
| `SessionStart` | <Documented /> | The result fields of `classic.SessionStart`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext' \| 'initialUserMessage' \| 'sessionTitle' \| 'watchPaths' \| 'reloadSkills'`. |
| `Setup` | <Documented /> | The result fields of `classic.Setup`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `PreModelSwitch` | <Documented /> | The result fields of `classic.PreModelSwitch`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'permissionDecision' \| 'permissionDecisionReason'`. |
| `PostModelSwitch` | <Documented /> | The result fields of `classic.PostModelSwitch`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `SubagentStart` | <Documented /> | The result fields of `classic.SubagentStart`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `PostToolUse` | <Documented /> | The result fields of `classic.PostToolUse`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext' \| 'updatedToolOutput' \| 'updatedMCPToolOutput'`. |
| `PostToolUseFailure` | <Documented /> | The result fields of `classic.PostToolUseFailure`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `PostToolBatch` | <Documented /> | The result fields of `classic.PostToolBatch`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `Stop` | <Documented /> | The result fields of `classic.Stop`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `SubagentStop` | <Documented /> | The result fields of `classic.SubagentStop`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'additionalContext'`. |
| `PermissionDenied` | <Documented /> | The result fields of `classic.PermissionDenied`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'retry'`. |
| `PermissionRequest` | <Documented /> | The result fields of `classic.PermissionRequest`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'decision'`. |
| `MessageDisplay` | <Documented /> | The result fields of `classic.MessageDisplay`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'displayContent'`. |
| `WorktreeCreate` | <Documented /> | The result fields of `classic.WorktreeCreate`, besides the `block`, `preventContinuation`, and `stopReason` that every event has. | Type: `'worktreePath'`. |

### `ClassicResultOf`

What the hook of each classic hook event returns and its `next(e)` resolves to: the subset of ClassicResult that the event reads. `classic.PreToolUse` keeps its `allow` / `ask` / `deny` result (PreToolUseResult).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `` [E in ClassicHookEvent as `classic.${E}`] `` | <Documented /> | The result of each `classic.*` event: `PreToolUseResult` for `classic.PreToolUse`, a pick of `ClassicResult` fields for the rest. | Type: `E extends 'PreToolUse' ? PreToolUseResult : Pick<ClassicResult, 'block' \| 'preventContinuation' \| 'stopReason' \| (E extends keyof ClassicResultFields ? ClassicResultFields[E] : never)>`. |

### `ConfigChangeHookInput`

Fields of `ConfigChangeHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `ConfigChange`. | Type: `'ConfigChange'`. |
| `source` | <Documented /> | Which settings source changed. | Type: `'user_settings' \| 'project_settings' \| 'local_settings' \| 'policy_settings' \| 'skills'`. |
| `file_path` | <Documented /> | The settings file that changed. | Type: `string`. Optional. |

### `CwdChangedHookInput`

Fields of `CwdChangedHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `CwdChanged`. | Type: `'CwdChanged'`. |
| `old_cwd` | <Documented /> | The working directory before the change. | Type: `string`. |
| `new_cwd` | <Documented /> | The working directory after the change. | Type: `string`. |

### `DirectoryAddedHookInput`

Fields of `DirectoryAddedHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `DirectoryAdded`. | Type: `'DirectoryAdded'`. |
| `directory` | <Documented /> | Absolute path of the directory that was added. | Type: `string`. |
| `source` | <Documented /> | How the directory was added: "slash_command" for /add-dir, "register_repo_root" for the SDK control_request. | Type: `'slash_command' \| 'register_repo_root'`. |

### `ElicitationHookInput`

Hook input for the Elicitation event. Fires when an MCP server requests user input. Hooks can auto-respond (accept/decline) instead of displaying the dialog. Fields of `ElicitationHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `Elicitation`. | Type: `'Elicitation'`. |
| `mcp_server_name` | <Documented /> | The name of the MCP server that asks for input. | Type: `string`. |
| `message` | <Documented /> | The text that the MCP server displays to ask for input. | Type: `string`. |
| `mode` | <Documented /> | Whether the MCP server asks with a `form` or with a `url`. | Type: `'form' \| 'url'`. Optional. |
| `url` | <Documented /> | The URL to open, in `url` mode. | Type: `string`. Optional. |
| `elicitation_id` | <Documented /> | The ID of the request. | Type: `string`. Optional. |
| `requested_schema` | <Documented /> | The schema of the form the server asks for, in `form` mode. | Type: `Record<string, unknown>`. Optional. |

### `ElicitationResultHookInput`

Hook input for the ElicitationResult event. Fires after the user responds to an MCP elicitation. Hooks can observe or override the response before the engine sends it to the server. Fields of `ElicitationResultHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `ElicitationResult`. | Type: `'ElicitationResult'`. |
| `mcp_server_name` | <Documented /> | The name of the MCP server that asked. | Type: `string`. |
| `elicitation_id` | <Documented /> | The ID of the request. | Type: `string`. Optional. |
| `mode` | <Documented /> | Whether the server asked with a `form` or with a `url`. | Type: `'form' \| 'url'`. Optional. |
| `action` | <Documented /> | The answer: `accept`, `decline`, or `cancel`. | Type: `'accept' \| 'decline' \| 'cancel'`. |
| `content` | <Documented /> | The values submitted with the answer. | Type: `Record<string, unknown>`. Optional. |

### `FileChangedHookInput`

Fields of `FileChangedHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `FileChanged`. | Type: `'FileChanged'`. |
| `file_path` | <Documented /> | The path of the file that changed. | Type: `string`. |
| `event` | <Documented /> | What happened to the file: `change`, `add`, or `unlink`. | Type: `'change' \| 'add' \| 'unlink'`. |

### `InstructionsLoadedHookInput`

Fields of `InstructionsLoadedHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `InstructionsLoaded`. | Type: `'InstructionsLoaded'`. |
| `file_path` | <Documented /> | The path of the instructions file that was loaded. | Type: `string`. |
| `memory_type` | <Documented /> | The kind of memory file: `User`, `Project`, `Local`, or `Managed`. | Type: `'User' \| 'Project' \| 'Local' \| 'Managed'`. |
| `load_reason` | <Documented /> | Why the file was loaded. This is the matcher. | Type: `'session_start' \| 'nested_traversal' \| 'path_glob_match' \| 'include' \| 'compact'`. |
| `globs` | <Documented /> | The path globs from the `paths:` frontmatter of the file. | Type: `string[]`. Optional. Present only when `load_reason` is `path_glob_match` ([InstructionsLoaded input](https://code.claude.com/docs/en/hooks#instructionsloaded-input)). |
| `trigger_file_path` | <Documented /> | The file whose access caused the load. | Type: `string`. Optional. |
| `parent_file_path` | <Documented /> | The file that includes this one. | Type: `string`. Optional. |

### `MessageDisplayHookInput`

Hook input for the MessageDisplay event. Fires with each batch of newly completed lines while an assistant message streams. Display-only: the stored message and what the model sees are untouched. Fields of `MessageDisplayHookInput` and `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `MessageDisplay`. | Type: `'MessageDisplay'`. |
| `turn_id` | <Documented /> | UUID of the current turn. | Type: `string`. |
| `message_id` | <Documented /> | UUID of the assistant message being displayed. Stable across every flush of the same message. Not the API msg_... id. | Type: `string`. |
| `index` | <Documented /> | Zero-based index of this delta within the message. Increments by one for each flush. | Type: `number`. |
| `final` | <Documented /> | True on the last flush of the message. Exactly one flush for each message has it. | Type: `boolean`. |
| `delta` | <Documented /> | The newly completed lines since the last flush. Always whole lines, except on the final flush. Treat `final` as the end-of-message signal. | Type: `string`. |

## Related Pages

- [Classic Event Types](index.md)
- [Mod API Types](../index.md)
