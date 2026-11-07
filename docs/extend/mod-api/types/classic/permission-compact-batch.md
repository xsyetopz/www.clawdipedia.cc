---
title: Classic Permission, Compact, and Tool Batch Types
description: "Types of the notification, permission, compact, model switch, tool batch, and post tool use hook inputs."
sidebar_position: 2
---

## Types with Fields

Each type below has its own table of fields.

### `NotificationHookInput`

Combines `NotificationHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `Notification`. | Type: `'Notification'`. |
| `message` | <Documented /> | The notification text. | Type: `string`. |
| `title` | <Documented /> | The notification title. | Type: `string`. Optional. |
| `notification_type` | <Documented /> | The kind of notification, such as `idle_prompt`. | Type: `string`. |

### `PermissionDeniedHookInput`

Combines `PermissionDeniedHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PermissionDenied`. | Type: `'PermissionDenied'`. |
| `tool_name` | <Documented /> | The name of the tool. | Type: `string`. |
| `tool_input` | <Documented /> | The arguments the tool was called with. | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. |
| `reason` | <Documented /> | Why the call was denied. | Type: `string`. |
| `mcp_server` | <Documented /> | The MCP server the tool comes from, for an `mcp__*` tool. | Type: `McpServerProvenance`. Optional. |

### `PermissionRequestDecision`

The `decision` of a `classic.PermissionRequest` answer, as the `hookSpecificOutput.decision` of the classic hook: allow (with a rewrite or rules) or deny.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `behavior` | <Documented /> | Allows the request: `allow`. | Type: `'allow'`. |
| `updatedInput` | <Documented /> | Replaces the tool input before the tool runs. | Type: `Record<string, unknown>`. Optional. |
| `updatedPermissions` | <Documented /> | Permission updates to apply with the decision. | Type: `PermissionUpdates`. Optional. |
| `behavior` | <Documented /> | Denies the request: `deny`. | Type: `'deny'`. |
| `message` | <Documented /> | Tells Claude why the request was denied. | Type: `string`. Optional. |
| `interrupt` | <Documented /> | `true` stops Claude after the denial. | Type: `true`. Optional. |

### `PermissionRequestHookInput`

Combines `PermissionRequestHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PermissionRequest`. | Type: `'PermissionRequest'`. |
| `tool_name` | <Documented /> | The name of the tool. | Type: `string`. |
| `tool_input` | <Documented /> | The arguments the tool was called with. | Type: `unknown`. |
| `permission_suggestions` | <Documented /> | The permission updates Claude Code suggests for this request, such as adding an allow rule or changing the permission mode. | Type: `PermissionUpdate[]`. Optional. Not an exact list of the dialog choices ([PermissionRequest input](https://code.claude.com/docs/en/hooks#permissionrequest-input)). |
| `mcp_server` | <Documented /> | The MCP server the tool comes from, for an `mcp__*` tool. | Type: `McpServerProvenance`. Optional. |

### `PermissionRuleValue`

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `toolName` | <Documented /> | The tool the rule is for. | Type: `string`. |
| `ruleContent` | <Documented /> | The part of the rule inside the parentheses. If absent, the rule covers the whole tool. | Type: `string`. Optional. |

### `PermissionUpdate`

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The kind of update: `addRules`. | Type: `'addRules'`. |
| `rules` | <Documented /> | The rules to add. | Type: `PermissionRuleValue[]`. |
| `behavior` | <Documented /> | What the rules do: allow, deny, or ask. | Type: `PermissionBehavior`. |
| `destination` | <Documented /> | Where the update is saved. | Type: `PermissionUpdateDestination`. |
| `type` | <Documented /> | The kind of update: `replaceRules`. | Type: `'replaceRules'`. |
| `rules` | <Documented /> | The rules that replace the existing ones. | Type: `PermissionRuleValue[]`. |
| `behavior` | <Documented /> | What the rules do: allow, deny, or ask. | Type: `PermissionBehavior`. |
| `destination` | <Documented /> | Where the update is saved. | Type: `PermissionUpdateDestination`. |
| `type` | <Documented /> | The kind of update: `removeRules`. | Type: `'removeRules'`. |
| `rules` | <Documented /> | The rules to remove. | Type: `PermissionRuleValue[]`. |
| `behavior` | <Documented /> | What the rules do: allow, deny, or ask. | Type: `PermissionBehavior`. |
| `destination` | <Documented /> | Where the update is saved. | Type: `PermissionUpdateDestination`. |
| `type` | <Documented /> | The kind of update: `setMode`. | Type: `'setMode'`. |
| `mode` | <Documented /> | The permission mode to set. | Type: `PermissionMode`. |
| `destination` | <Documented /> | Where the update is saved. | Type: `PermissionUpdateDestination`. |
| `type` | <Documented /> | The kind of update: `addDirectories`. | Type: `'addDirectories'`. |
| `directories` | <Documented /> | The directories to add. | Type: `string[]`. |
| `destination` | <Documented /> | Where the update is saved. | Type: `PermissionUpdateDestination`. |
| `type` | <Documented /> | The kind of update: `removeDirectories`. | Type: `'removeDirectories'`. |
| `directories` | <Documented /> | The directories to remove. | Type: `string[]`. |
| `destination` | <Documented /> | Where the update is saved. | Type: `PermissionUpdateDestination`. |

### `PostCompactHookInput`

Combines `PostCompactHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PostCompact`. | Type: `'PostCompact'`. |
| `trigger` | <Documented /> | What started the compaction: `manual` or `auto`. | Type: `'manual' \| 'auto'`. |
| `compact_summary` | <Documented /> | The conversation summary produced by compaction | Type: `string`. |

### `PostModelSwitchHookInput`

Combines `PostModelSwitchHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PostModelSwitch`. | Type: `'PostModelSwitch'`. |
| `from_model` | <Documented /> | Resolved model id the session was running before the switch | Type: `string`. |
| `to_model` | <Documented /> | Resolved model id the session runs after the switch | Type: `string`. |
| `requested_model` | <Documented /> | What was asked for (alias such as "opus", a full id, or null for "default") | Type: `string \| null`. |
| `source` | <Documented /> | Why the model changed: `command` (/model or the /config Model row), `picker`, `sdk` (headless `set_model`), `auto` (fallback or other change), or `resume`. | Type: `'command' \| 'picker' \| 'sdk' \| 'auto' \| 'resume'`. |
| `context_tokens` | <Documented /> | Prompt tokens that the next request re-sends: the input, cache read, cache creation, and output tokens of the last main-thread response. 0 before the first response. | Type: `number`. |
| `prompt_cache_warm` | <Documented /> | Whether the prompt cache of the current model is still warm, by the program's estimate (a switch then forfeits it) | Type: `boolean`. |
| `cache_ttl` | <Documented /> | How long the prompt cache lasts: `5m` or `1h`. | Type: `'5m' \| '1h'`. |
| `estimated_cache_write_usd` | <Documented /> | Estimated cost of re-caching context_tokens on to_model at its cache-write rate. It uses the managed modelPricing when set, otherwise list price. It excludes the response | Type: `number`. |
| `pricing` | <Documented /> | configured: priced at the managed modelPricing setting. catalog: list price. default: to_model unknown, so the default tier was assumed | Type: `'configured' \| 'catalog' \| 'default'`. |

### `PostToolBatchHookInput`

Hook input for `PostToolBatch`. Fires once after every tool call in a batch resolved, before the next model request. `PostToolUse` fires for each tool. Combines `PostToolBatchHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PostToolBatch`. | Type: `'PostToolBatch'`. |
| `tool_calls` | <Documented /> | The tool calls of the batch. | Type: `PostToolBatchToolCall[]`. |

### `PostToolBatchToolCall`

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_name` | <Documented /> | The name of the tool. | Type: `string`. |
| `tool_input` | <Documented /> | The arguments the tool was called with. | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. |
| `tool_response` | <Documented /> | What the tool returned. | Type: `unknown`. Optional. |

### `PostToolUseFailureHookInput`

Combines `PostToolUseFailureHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PostToolUseFailure`. | Type: `'PostToolUseFailure'`. |
| `tool_name` | <Documented /> | The name of the tool. | Type: `string`. |
| `tool_input` | <Documented /> | The arguments the tool was called with. | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. |
| `error` | <Documented /> | The error text of the failed call. | Type: `string`. |
| `is_interrupt` | <Documented /> | `true` when the failure was an abort, not an error the tool reported. | Type: `boolean`. Optional. |
| `duration_ms` | <Documented /> | Tool execution time in milliseconds. Excludes permission-prompt and hook time. | Type: `number`. Optional. |
| `mcp_server` | <Documented /> | The MCP server the tool comes from, for an `mcp__*` tool. | Type: `McpServerProvenance`. Optional. |

### `PostToolUseHookInput`

Combines `PostToolUseHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PostToolUse`. | Type: `'PostToolUse'`. |
| `tool_name` | <Documented /> | The name of the tool. | Type: `string`. |
| `tool_input` | <Documented /> | The arguments the tool was called with. | Type: `unknown`. |
| `tool_response` | <Documented /> | What the tool returned. | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. |
| `duration_ms` | <Documented /> | Tool execution time in milliseconds. Excludes permission-prompt and hook time. | Type: `number`. Optional. |
| `mcp_server` | <Documented /> | The MCP server the tool comes from, for an `mcp__*` tool. | Type: `McpServerProvenance`. Optional. |

### `PreCompactHookInput`

Combines `PreCompactHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PreCompact`. | Type: `'PreCompact'`. |
| `trigger` | <Documented /> | What started the compaction: `manual` or `auto`. | Type: `'manual' \| 'auto'`. |
| `custom_instructions` | <Documented /> | The instructions given to `/compact`, or `null` when there are none. | Type: `string \| null`. |

### `PreModelSwitchHookInput`

Combines `PreModelSwitchHookInput`, `BaseHookInput`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hook_event_name` | <Documented /> | The event name: always `PreModelSwitch`. | Type: `'PreModelSwitch'`. |
| `from_model` | <Documented /> | Resolved model id the session was running before the switch | Type: `string`. |
| `to_model` | <Documented /> | Resolved model id the session runs after the switch | Type: `string`. |
| `requested_model` | <Documented /> | What was asked for (alias such as "opus", a full id, or null for "default") | Type: `string \| null`. |
| `source` | <Documented /> | command: /model &lt;name>, the /config Model row, or enabling fast mode when that promotes the model. picker: an interactive model picker. sdk: headless set_model (SDK, Remote Control, IDE) | Type: `'command' \| 'picker' \| 'sdk'`. |
| `context_tokens` | <Documented /> | Prompt tokens that the next request re-sends: the input, cache read, cache creation, and output tokens of the last main-thread response. 0 before the first response. | Type: `number`. |
| `prompt_cache_warm` | <Documented /> | Whether the prompt cache of the current model is still warm, by the program's estimate (a switch then forfeits it) | Type: `boolean`. |
| `cache_ttl` | <Documented /> | How long the prompt cache lasts: `5m` or `1h`. | Type: `'5m' \| '1h'`. |
| `estimated_cache_write_usd` | <Documented /> | Estimated cost of re-caching context_tokens on to_model at its cache-write rate. It uses the managed modelPricing when set, otherwise list price. It excludes the response | Type: `number`. |
| `pricing` | <Documented /> | configured: priced at the managed modelPricing setting. catalog: list price. default: to_model unknown, so the default tier was assumed | Type: `'configured' \| 'catalog' \| 'default'`. |

## Related Pages

- [Classic Event Types](index.md)
- [Mod API Types](../index.md)
