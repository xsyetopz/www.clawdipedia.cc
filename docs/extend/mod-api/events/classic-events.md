---
title: Classic Events
description: How a mod gets each settings hook event as a classic event, with the fields and results of all 33 events.
sidebar_position: 16
---

Each settings hook event is also an event named `classic.<Event>` for a mod.
The event `e` is the `stdin` JSON of the settings hook, with the base fields.
The chain is the managed settings hooks, then the hooks modules, then the other settings hooks as core.
A managed block ends the chain above every module.

Remove the `on` call to turn a hook off. `disableAllHooks` stops installed mods. The same events come from `hooks` in settings.

Official pages: [Hooks Reference](https://code.claude.com/docs/en/hooks), [React to Events](https://code.claude.com/docs/en/plugins/mods/events). Source: the Mod API type file (the `*HookInput` types of `schemas/claude-code.d.ts`, from the 2.1.314 program). For what each event means, see [Hook Events](../../hooks/events.md).

## Example

```javascript
export const register = (on) => {
  on("classic.PreToolUse", { tool_name: "Bash" }, async ($, e, next) =>
    next(e),
  );
  on("classic.Stop", async ($, e, next) => next(e));
};
```

## Events

Most results include `block`, `preventContinuation`, and `stopReason`. The table lists extra result fields when there are any.

| Item | Status | Input type and fields | Result |
| --- | --- | --- | --- |
| `classic.ConfigChange` | <Documented /> | `ConfigChangeHookInput`: `hook_event_name`, `source`, `file_path` | Base |
| `classic.CwdChanged` | <Documented /> | `CwdChangedHookInput`: `hook_event_name`, `old_cwd`, `new_cwd` | Base |
| `classic.DirectoryAdded` | <Documented /> | `DirectoryAddedHookInput`: `hook_event_name`, `directory`, `source` | Base |
| `classic.Elicitation` | <Documented /> | `ElicitationHookInput`: `hook_event_name`, `mcp_server_name`, `message`, `mode`, `url`, `elicitation_id`, `requested_schema`. Fires when an MCP server asks for user input. Hooks can auto-respond (accept or decline) instead of showing the dialog. | Base |
| `classic.ElicitationResult` | <Documented /> | `ElicitationResultHookInput`: `hook_event_name`, `mcp_server_name`, `elicitation_id`, `mode`, `action`, `content`. Fires after the user answers an MCP elicitation. Hooks can observe or override the answer before it goes to the server. | Base |
| `classic.FileChanged` | <Documented /> | `FileChangedHookInput`: `hook_event_name`, `file_path`, `event` | Base |
| `classic.InstructionsLoaded` | <Documented /> | `InstructionsLoadedHookInput`: `file_path`, `memory_type`, `load_reason`, `globs`, `trigger_file_path`, `parent_file_path` | Base |
| `classic.MessageDisplay` | <Documented /> | `MessageDisplayHookInput`: `hook_event_name`, `turn_id`, `message_id`, `index`, `final`, `delta`. Fires with each batch of newly finished lines while an assistant message streams. It changes only what the person sees. The stored message and what the model sees stay as they are. | Base plus `displayContent` |
| `classic.Notification` | <Documented /> | `NotificationHookInput`: `hook_event_name`, `message`, `title`, `notification_type` | Base |
| `classic.PermissionDenied` | <Documented /> | `PermissionDeniedHookInput`: `hook_event_name`, `tool_name`, `tool_input`, `tool_use_id`, `reason`, `mcp_server` | Base plus `retry` |
| `classic.PermissionRequest` | <Documented /> | `PermissionRequestHookInput`: `hook_event_name`, `tool_name`, `tool_input`, `permission_suggestions`, `mcp_server` | Base plus `decision` |
| `classic.PostCompact` | <Documented /> | `PostCompactHookInput`: `hook_event_name`, `trigger`, `compact_summary` | Base |
| `classic.PostModelSwitch` | <Documented /> | `PostModelSwitchHookInput`: includes `from_model`, `to_model`, `context_tokens`, `pricing` | Base plus `additionalContext` |
| `classic.PostToolBatch` | <Documented /> | `PostToolBatchHookInput`: `hook_event_name`, `tool_calls`. Fires once after every tool call in a batch resolves, before the next model request. | Base plus `additionalContext` |
| `classic.PostToolUseFailure` | <Documented /> | `PostToolUseFailureHookInput`: includes `tool_name`, `tool_input`, `error`, `is_interrupt` | Base plus `additionalContext` |
| `classic.PostToolUse` | <Documented /> | `PostToolUseHookInput`: includes `tool_name`, `tool_input`, `tool_response`, `duration_ms` | Base plus `additionalContext`, `updatedToolOutput`, `updatedMCPToolOutput` |
| `classic.PreCompact` | <Documented /> | `PreCompactHookInput`: `hook_event_name`, `trigger`, `custom_instructions` | Base |
| `classic.PreModelSwitch` | <Documented /> | `PreModelSwitchHookInput`: includes `from_model`, `to_model`, `context_tokens`, `pricing` | Base plus `permissionDecision`, `permissionDecisionReason` |
| `classic.PreToolUse` | <Documented /> | `ToolCallEnvelope` (from `PreToolUseHookInput`) | `PreToolUseResult`: allow, ask, or deny |
| `classic.SessionEnd` | <Documented /> | `SessionEndHookInput`: `hook_event_name`, `reason` | Base |
| `classic.SessionStart` | <Documented /> | `SessionStartHookInput`: includes `source`, `agent_type`, `model` | Base plus `additionalContext`, `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` |
| `classic.Setup` | <Documented /> | `SetupHookInput`: `hook_event_name`, `trigger` | Base plus `additionalContext` |
| `classic.StopFailure` | <Documented /> | `StopFailureHookInput`: `hook_event_name`, `error`, `error_details`, `last_assistant_message` | Base |
| `classic.Stop` | <Documented /> | `StopHookInput`: includes `stop_hook_active`, `last_assistant_message` | Base plus `additionalContext` |
| `classic.SubagentStart` | <Documented /> | `SubagentStartHookInput`: `hook_event_name`, `agent_id`, `agent_type` | Base plus `additionalContext` |
| `classic.SubagentStop` | <Documented /> | `SubagentStopHookInput`: includes `agent_id`, `agent_type`, `last_assistant_message` | Base plus `additionalContext` |
| `classic.TaskCompleted` | <Documented /> | `TaskCompletedHookInput`: `hook_event_name`, `task_id`, `task_subject`, `task_description`, `teammate_name`, `team_name` | Base |
| `classic.TaskCreated` | <Documented /> | `TaskCreatedHookInput`: same fields as `TaskCompleted` | Base |
| `classic.TeammateIdle` | <Documented /> | `TeammateIdleHookInput`: `hook_event_name`, `teammate_name`, `team_name` | Base |
| `classic.UserPromptExpansion` | <Documented /> | `UserPromptExpansionHookInput`: includes `expansion_type`, `command_name`, `command_args`, `prompt` | Base plus `additionalContext`, `suppressOriginalPrompt` |
| `classic.UserPromptSubmit` | <Documented /> | `UserPromptSubmitHookInput`: includes `prompt`, `source`, `session_title` | Base plus `additionalContext`, `sessionTitle`, `suppressOriginalPrompt` |
| `classic.WorktreeCreate` | <Documented /> | `WorktreeCreateHookInput`: `hook_event_name`, `name` | Base plus `worktreePath` |
| `classic.WorktreeRemove` | <Documented /> | `WorktreeRemoveHookInput`: `hook_event_name`, `worktree_path` | Base |

In this table, "Base" means `block`, `preventContinuation`, and `stopReason`.

## Related Pages

- [Mod API Overview](../index.md)
- [Hooks and the Hook Chain](hooks.md)
- [Classic Event Types](../types/classic/index.md) (the full input and result types)
- [Hook Events](../../hooks/events.md)
