---
title: OpenTelemetry Events
description: The log events that Claude Code 2.1.321 emits through OpenTelemetry, with the attributes of each, read from the program.
sidebar_position: 7
---

Claude Code can send log events to an OpenTelemetry (OTEL) collector.
This page lists the 28 events that the program emits and the attributes each one carries.
The variables that turn telemetry on and set the exporters are on [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md).

## Events

Source: the program. The attribute names come from the call sites of the event emitter, read into [`claude-code-otel.json`](schemas.md).
A key that some call sites leave out may be missing from an event. So treat every attribute as optional.
The schema has the type of each attribute. The program sends some numbers as strings. So look a field up there before you rely on its type.
Only `tool_decision` is marked <Documented />, because earlier pages of this site name it. We did not check the other events against the official [Monitoring](https://code.claude.com/docs/en/monitoring-usage) page.

| Event | Status | What It Records | Attributes |
| --- | --- | --- | --- |
| `api_error` | <Undocumented /> | An API request failed. | `model`, `error`, `status_code`, `duration_ms`, `attempt`, `request_id`, `client_request_id`, `speed`, `query_source`, `effort`, `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `api_refusal` | <Undocumented /> | The API refused a request. | `model`, `request_id`, `speed`, `attempt`, `server_fallback_hop`, `query_source`, `effort`, `has_category`, `has_explanation`, `category`, `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `api_request` | <Undocumented /> | An API request finished, with token counts, cost, and timing. | `model`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_creation_tokens`, `cache_creation_5m_tokens`, `cache_creation_1h_tokens`, `cost_usd`, `cost_usd_micros`, `duration_ms`, `ttft_ms`, `request_id`, `client_request_id`, `speed`, `query_source`, `effort`, `agent.name`, `skill.name`, `plugin.name`, `marketplace.name`, `mcp_server.name`, `mcp_tool.name` |
| `api_retries_exhausted` | <Undocumented /> | An API request used all its retries. | `model`, `error`, `status_code`, `total_attempts`, `total_retry_duration_ms`, `speed`, `query_source`, `effort` |
| `assistant_response` | <Undocumented /> | A model response. The text is in `response` only when `OTEL_LOG_ASSISTANT_RESPONSES` or `OTEL_LOG_USER_PROMPTS` allows it. | `response_length`, `response`, `request_id`, `message.uuid`, `model`, `query_source` |
| `at_mention` | <Undocumented /> | An `@` mention was used. | `mention_type`, `success` |
| `auth` | <Undocumented /> | An auth action ran. | `action`, `success`, `auth_method`, `error_category`, `status_code` |
| `compaction` | <Undocumented /> | A context compaction ran. | `trigger`, `success`, `duration_ms`, `pre_tokens`, `post_tokens`, `error`, `precompute_reuse` |
| `feedback_survey` | <Undocumented /> | A step of the session quality survey. | `event_type`, `appearance_id`, `response`, `survey_type`, `enabled_via_override`, `event_origin`, `event_origin_server`, `trigger_type`, `plugin_id_hash`, `plugin.name` |
| `hook_execution_complete` | <Undocumented /> | The hooks of one hook event finished. Since `2.1.321`, in non-interactive sessions `num_hooks` and `num_success` leave out two built-in hooks after Bash and PowerShell calls ([2.1.321 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). The program writes both counts at `chunk-ne1755n5.js:3842889` (`num_hooks` is the length of the list of hooks it ran) after it starts the event at `:3804573`. Two built-in `internal: true` callback hooks match `Bash\|PowerShell` on `PostToolUse`: the post-commit hook at `chunk-ck0rzt81.js:5853` and the post-push hook at `chunk-mx7d8x49.js:9916`. The page did not trace which code drops them from the count in non-interactive sessions. | `hook_event`, `hook_name`, `num_hooks`, `num_success`, `num_blocking`, `num_non_blocking_error`, `num_cancelled`, `total_duration_ms`, `stdout_chars`, `additional_context_chars`, `system_message_chars`, `initial_user_message_chars`, `num_outputs_persisted`, `managed_only`, `hook_source`, `safe_mode`, `hook_definitions` |
| `hook_execution_start` | <Undocumented /> | The hooks of one hook event started. | `hook_event`, `hook_name`, `num_hooks`, `managed_only`, `hook_source`, `safe_mode`, `hook_definitions` |
| `hook_plugin_metrics` | <Undocumented /> | A hook event of a plugin. | `plugin_id`, `hook_event` |
| `hook_registered` | <Undocumented /> | A hook was registered. | `hook_event`, `hook_type`, `hook_source`, `safe_mode`, `hook_matcher`, `plugin.name`, `plugin_id_hash` |
| `internal_error` | <Undocumented /> | An internal error, with its name and code. | `error_name`, `error_code` |
| `managed_settings_resolved` | <Undocumented /> | Managed settings were resolved. `OTEL_LOG_MANAGED_SETTINGS` adds the redacted settings. | `managed_settings.trigger`, `managed_settings.sources`, `managed_settings.source_behavior`, `managed_settings.helper.state`, `managed_settings.helper.applied`, `managed_settings.helper.entry`, `managed_settings.helper.path`, `managed_settings.helper.script_sha256`, `managed_settings.resolved_sha256`, `managed_settings.settings`, `managed_settings.settings_truncated`, `error.type` |
| `mcp_server_connection` | <Undocumented /> | The result of an MCP server connection. | `status`, `transport_type`, `server_scope`, `duration_ms`, `is_plugin`, `plugin_id_hash`, `plugin.name`, `error_code`, `server_name`, `error` |
| `permission_mode_changed` | <Undocumented /> | The permission mode changed. | `from_mode`, `to_mode`, `trigger` |
| `plugin_installed` | <Undocumented /> | A plugin was installed. | `plugin.name`, `plugin.version`, `marketplace.name`, `marketplace.is_official`, `install.trigger`, `install.disabled_by_default` |
| `plugin_loaded` | <Undocumented /> | A plugin was loaded. | `plugin.name`, `marketplace.name`, `plugin.version`, `plugin.scope`, `enabled_via`, `plugin_id_hash`, `has_hooks`, `has_mcp`, `host_owned_mcp`, `skill_path_count`, `command_path_count`, `agent_path_count`, `safe_mode` |
| `retention_sweep` | <Undocumented /> | A cleanup of old session data ran, with counts. | `result`, `period_days`, `used_default`, `skip_reason`, `transcripts_deleted`, `transcripts_exempted_desktop`, `session_files_deleted`, `artifacts_deleted`, `files_retained_fresh`, `files_past_cutoff`, `error_count`, `history_entries_pruned` |
| `safety_event` | <Gated note="Server flag tengu_snoopy_creek, off by default since 2.1.312" /> | A permission or safety decision. Off by default since `2.1.312`, because the server-side gate `tengu_snoopy_creek` now defaults to `false`. In `2.1.311` it defaulted to `true`. The code that sends the event is still in the program, and both of its call sites test the gate, so a server-side flag can turn the event on again. | `category`, `decision`, `decision_source`, `reason_type`, `reason_code`, `rule_source`, `grant_scope`, `circuit_breaker`, `classifier_category`, `hook_event`, `tool_class`, `tool_name`, `tool_source`, `permission_mode`, `tool_use_id`, `sandbox_violation_count`, `sandbox_enabled` |
| `skill_activated` | <Undocumented /> | A skill was activated. | `skill.name`, `invocation_trigger`, `skill.source`, `skill.kind`, `plugin.name`, `marketplace.name` |
| `subagent_completed` | <Undocumented /> | A subagent finished, with token and tool-use counts. | `agent_type`, `agent.source`, `is_built_in`, `is_async`, `total_tokens`, `total_tool_uses`, `duration_ms`, `model`, `final_model`, `model_swapped`, `plugin_id_hash`, `plugin.name` |
| `system_prompt` | <Undocumented /> | The system prompt, or its hash. | `system_prompt_hash`, `system_prompt`, `system_prompt_length`, `system_prompt_truncated` |
| `tool` | <Undocumented /> | A tool definition, or its hash. | `tool_name`, `tool_hash`, `tool`, `tool_truncated` |
| `tool_decision` | <Documented /> | A tool use was accepted or rejected. `OTEL_LOG_TOOL_DETAILS` adds `classifier_category`. | `decision`, `source`, `tool_name`, `tool_use_id`, `tool_source`, `tool_parameters`, `classifier_verdict`, `classifier_category`, `permission_mode` |
| `tool_result` | <Undocumented /> | A tool call finished. After a git commit it also carries the `vcs.ref.head.*` fields. | `tool_name`, `tool_use_id`, `success`, `duration_ms`, `tool_parameters`, `tool_input`, `tool_input_size_bytes`, `tool_result_size_bytes`, `decision_source`, `decision_type`, `mcp_server_scope`, `vcs.ref.head.revision`, `vcs.ref.head.name`, `vcs.ref.head.type`, `error_type`, `error` |
| `user_prompt` | <Undocumented /> | A user prompt. The text is in `prompt` only when `OTEL_LOG_USER_PROMPTS` is on. | `prompt_length`, `prompt`, `prompt_text` |

## What Two Attributes Report

| Attribute | Status | What It Reports | Notes |
| --- | --- | --- | --- |
| `effort` | <Undocumented /> | The effort level in force for the request. | Since `2.1.312`. Before, it could name a newly picked level before the model applied it. The program takes the level from the last effort change that the conversation holds, and uses the new pick only when there is none. The `api_request` event reads it from `output_config.effort` of the request, and the refusal path passes the same level. We did not trace `api_error` and `api_retries_exhausted` one by one. |
| `mcp_server.name` | <Undocumented /> | The server name. For most servers that a plugin declares it reports `custom`. | Since `2.1.312`, it reports the real name for a remote MCP server with a fixed URL of type `http`, `sse`, or `ws` that a plugin declares, when the plugin comes from an official marketplace that the program vouches for. A server whose endpoint is a template still reports `custom`. |

Source: the program. The level in force is in `chunk-ne1755n5.js` lines 148959, 150468, and 155307. The server name is in `chunk-qfakytpa.js` lines 48128 to 48141 and 52520 to 52531, with `custom` at line 46109. The `safety_event` gate is in `chunk-ne1755n5.js` lines 203596, 203677, 203720, and 203781.

## Account and Provider Attributes

Since `2.1.318`, the program adds `anthropic.provider`, `anthropic.custom_base_url`, `anthropic.plan`, and `anthropic.seat_type` to OpenTelemetry metrics, events, and spans. The release notes say: "Added `anthropic.plan`, `anthropic.seat_type`, `anthropic.provider` and `anthropic.custom_base_url` to OTel metrics, events and spans".

| Attribute | Status | Value | When It Is Set |
| --- | --- | --- | --- |
| `anthropic.provider` | <Undocumented /> | `firstParty` or `bedrock` in the runs below | Always |
| `anthropic.custom_base_url` | <Undocumented /> | `true` or `false` (a boolean) | When the program can tell. `true` when the API base URL is not the default |
| `anthropic.plan` | <Undocumented /> | `pro`, `max`, `team`, or `enterprise` | With a claude.ai subscriber login. A `free` plan sets none |
| `anthropic.seat_type` | <Undocumented /> | `premium`, `standard`, `usage_based`, or `other` | With a claude.ai subscriber login and a stored seat tier. The program maps the tier name to one of the four values |

**Source:** the program. The set is built in `chunk-gntt3p4g.js` (function `$1d9e2a`, line 136). The plan list is on line 116, and the tier map follows it.

**Runs:** `bun run release:probe:print -- --from 2.1.319 --to 2.1.319 --only notes319.otel-attrs`. Each case exports metrics, logs, and traces to a local OTLP receiver (`tools/release/lib/otlp.ts`) with `http/json`.

**FAFO:**

- Hypothesis: all three signals carry the same four attributes, and the plan and seat type need a subscriber login.
  Prediction: with an API key, only `provider` and `custom_base_url` appear. With a max login, `plan` is `max`. A `team_tier_1` seat gives `premium`, and `enterprise_usage_based` gives `usage_based`.
  Command: cases `api-key`, `max-plan`, `team-premium`, `enterprise-usage-based`, `free-plan`.
  Result: as predicted on metrics, logs, and traces alike. `team-premium` gave `plan=team` and `seat_type=premium`. `enterprise-usage-based` gave `plan=enterprise` and `seat_type=usage_based`. `free-plan` gave neither.
- `custom_base_url` is `true` for the local stub URL, and `false` with `ANTHROPIC_BASE_URL=https://api.anthropic.com` (`default-api-url`). With `CLAUDE_CODE_USE_BEDROCK=1`, `provider` is `bedrock`, and `custom_base_url` is `false`, or `true` when `ANTHROPIC_BEDROCK_BASE_URL` is set (`bedrock`, `bedrock-custom-url`).

## Attributes on Every Event

Every event carries these base attributes: `user.id`, `user.email`, `user.groups`, `event.name`, `event.timestamp`, `event.sequence`, `prompt.id`, and `workspace.host_paths`.
When `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES` is set, the program also copies the keys of `OTEL_RESOURCE_ATTRIBUTES`.

## Related Pages

- [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md) lists the variables that control telemetry.
- [JSON Schemas](schemas.md) has the exact fields in `claude-code-otel.json`.
- [Undocumented Items](undocumented.md) indexes every undocumented item.
- [Monitoring](https://code.claude.com/docs/en/monitoring-usage) in the official docs.
