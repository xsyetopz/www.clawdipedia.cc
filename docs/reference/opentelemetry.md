---
title: OpenTelemetry Events
description: The log events that Claude Code 2.1.329 emits through OpenTelemetry, with the attributes of each, read from the program.
sidebar_position: 7
---

Claude Code can send log events to an OpenTelemetry (OTEL) collector. Use them to track API calls, tool decisions, and errors across your team. This page lists the 28 events that Claude Code emits and the attributes each one carries.

The variables that turn telemetry on and set the exporters are on [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md).

## Events

The attribute names come from the call sites of the event emitter, read into [`claude-code-otel.json`](schemas.md).[^events] A key that some call sites leave out may be missing from an event, so treat every attribute as optional. The schema has the type of each attribute. Claude Code sends some numbers as strings, so look a field up there before you rely on its type. Only `tool_decision` is marked <Documented />, because earlier pages of this site name it.

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
| `hook_execution_complete` | <Undocumented /> | The hooks of one hook event finished. In non-interactive sessions `num_hooks` and `num_success` leave out two built-in hooks after Bash and PowerShell calls.[^hook-complete] `num_hooks` is the length of the list of hooks that ran. Two built-in callback hooks match `Bash\|PowerShell` on `PostToolUse`: the post-commit hook and the post-push hook. | `hook_event`, `hook_name`, `num_hooks`, `num_success`, `num_blocking`, `num_non_blocking_error`, `num_cancelled`, `total_duration_ms`, `stdout_chars`, `additional_context_chars`, `system_message_chars`, `initial_user_message_chars`, `num_outputs_persisted`, `managed_only`, `hook_source`, `safe_mode`, `hook_definitions` |
| `hook_execution_start` | <Undocumented /> | The hooks of one hook event started. | `hook_event`, `hook_name`, `num_hooks`, `managed_only`, `hook_source`, `safe_mode`, `hook_definitions` |
| `hook_plugin_metrics` | <Undocumented /> | The `metrics` object of a hook answer from a plugin of an official Anthropic marketplace. Each number or boolean entry becomes one attribute with its own key, at most 20 entries. Other plugins send no event. A hook answer that passes the output schema loses `metrics`, because the schema has no such key. Only an async answer that fails the schema keeps it, and the next model request sends the event.[^plugin-metrics] | `plugin_id`, `hook_event`, one key for each metric entry |
| `hook_registered` | <Undocumented /> | A hook was registered. | `hook_event`, `hook_type`, `hook_source`, `safe_mode`, `hook_matcher`, `plugin.name`, `plugin_id_hash` |
| `internal_error` | <Undocumented /> | An internal error, with its name and code. | `error_name`, `error_code` |
| `managed_settings_resolved` | <Undocumented /> | Managed settings were resolved. `OTEL_LOG_MANAGED_SETTINGS` adds the redacted settings. | `managed_settings.trigger`, `managed_settings.sources`, `managed_settings.source_behavior`, `managed_settings.helper.state`, `managed_settings.helper.applied`, `managed_settings.helper.entry`, `managed_settings.helper.path`, `managed_settings.helper.script_sha256`, `managed_settings.resolved_sha256`, `managed_settings.settings`, `managed_settings.settings_truncated`, `error.type` |
| `mcp_server_connection` | <Undocumented /> | The result of an MCP server connection. | `status`, `transport_type`, `server_scope`, `duration_ms`, `is_plugin`, `plugin_id_hash`, `plugin.name`, `error_code`, `server_name`, `error` |
| `permission_mode_changed` | <Undocumented /> | The permission mode changed. | `from_mode`, `to_mode`, `trigger` |
| `plugin_installed` | <Undocumented /> | A plugin was installed. | `plugin.name`, `plugin.version`, `marketplace.name`, `marketplace.is_official`, `install.trigger`, `install.disabled_by_default` |
| `plugin_loaded` | <Undocumented /> | A plugin was loaded. | `plugin.name`, `marketplace.name`, `plugin.version`, `plugin.scope`, `enabled_via`, `plugin_id_hash`, `has_hooks`, `has_mcp`, `host_owned_mcp`, `skill_path_count`, `command_path_count`, `agent_path_count`, `safe_mode` |
| `retention_sweep` | <Undocumented /> | A cleanup of old session data ran, with counts. Print mode runs it 5 seconds after the start. An interactive session runs it only when the user is idle for 60 seconds, and else tries again 10 minutes later. All the counts are strings.[^retention-sweep] | `result`, `period_days`, `used_default`, `skip_reason`, `transcripts_deleted`, `transcripts_exempted_desktop`, `session_files_deleted`, `artifacts_deleted`, `files_retained_fresh`, `files_past_cutoff`, `error_count`, `history_entries_pruned` |
| `safety_event` | <Gated note="Server flag tengu_snoopy_creek, off by default" /> | A permission or safety decision. Off by default, because a server-side gate defaults to `false`. Both call sites of the code that sends the event test the gate, so a server-side flag can turn the event on.[^safety-gate] | `category`, `decision`, `decision_source`, `reason_type`, `reason_code`, `rule_source`, `grant_scope`, `circuit_breaker`, `classifier_category`, `hook_event`, `tool_class`, `tool_name`, `tool_source`, `permission_mode`, `tool_use_id`, `sandbox_violation_count`, `sandbox_enabled` |
| `skill_activated` | <Undocumented /> | A skill was activated. | `skill.name`, `invocation_trigger`, `skill.source`, `skill.kind`, `plugin.name`, `marketplace.name` |
| `subagent_completed` | <Undocumented /> | A subagent finished, with token and tool-use counts. | `agent_type`, `agent.source`, `is_built_in`, `is_async`, `total_tokens`, `total_tool_uses`, `duration_ms`, `model`, `final_model`, `model_swapped`, `plugin_id_hash`, `plugin.name` |
| `system_prompt` | <Undocumented /> | The system prompt, or its hash. | `system_prompt_hash`, `system_prompt`, `system_prompt_length`, `system_prompt_truncated` |
| `tool` | <Undocumented /> | A tool definition, or its hash. | `tool_name`, `tool_hash`, `tool`, `tool_truncated` |
| `tool_decision` | <Documented /> | A tool use was accepted or rejected. `OTEL_LOG_TOOL_DETAILS` adds `classifier_category`. | `decision`, `source`, `tool_name`, `tool_use_id`, `tool_source`, `tool_parameters`, `classifier_verdict`, `classifier_category`, `permission_mode`. A `PreToolUse` hook from managed settings that refuses a tool call also leaves a `tool_decision` event and an entry in `permission_denials`.[^managed-denial] |
| `tool_result` | <Undocumented /> | A tool call finished. After a git commit it also carries the `vcs.ref.head.*` fields. | `tool_name`, `tool_use_id`, `success`, `duration_ms`, `tool_parameters`, `tool_input`, `tool_input_size_bytes`, `tool_result_size_bytes`, `decision_source`, `decision_type`, `mcp_server_scope`, `vcs.ref.head.revision`, `vcs.ref.head.name`, `vcs.ref.head.type`, `error_type`, `error`, `request_id` |
| `user_prompt` | <Undocumented /> | A user prompt. The text is in `prompt` only when `OTEL_LOG_USER_PROMPTS` is on. A message sent while tool calls run also gives this event, with the attribute `delivery.mode` set to `mid_turn` .[^mid-turn] | `prompt_length`, `prompt`, `prompt_text` |

## What Two Attributes Report

| Attribute | Status | What It Reports | Notes |
| --- | --- | --- | --- |
| `effort` | <Undocumented /> | The effort level in force for the request. | The `api_request` event reads it from `output_config.effort` of the request. The `api_error` and `api_retries_exhausted` events pass the same level.[^effort-events] |
| `mcp_server.name` | <Undocumented /> | The server name when the server is in a set of loggable servers. Else it reports `custom`. A server joins the set when one of its tools is called and the server passes the checks below.[^mcp-name] | A server that a plugin declares passes only when all of these hold: the plugin comes from an official marketplace that Claude Code vouches for, the server has type `http`, `sse`, or `ws` with a `url`, and its endpoint is fixed (not a template). A server from an MCPB bundle never passes this way when the bundle comes from a URL, when its manifest has `user_config`, or when its settings use `${HOME}`, `${DESKTOP}`, `${DOCUMENTS}`, or `${DOWNLOADS}`. Some servers that Claude Code or Anthropic provides also pass, such as `claudeai-proxy` servers, URLs in the official MCP registry, and every server under the `local-agent` entry point. Every other server reports `custom`. For a plugin server that passes only by the plugin condition, `mcp_tool.name` also reports `custom`, because Claude Code withholds its tool names. |

These two rows and the `safety_event` gate come from the program.[^two-attrs]

## Account and Provider Attributes

Claude Code adds `anthropic.provider`, `anthropic.custom_base_url`, `anthropic.plan`, and `anthropic.seat_type` to OpenTelemetry metrics, events, and spans.

| Attribute | Status | Value | When It Is Set |
| --- | --- | --- | --- |
| `anthropic.provider` | <Undocumented /> | The API provider name, such as `firstParty` or `bedrock` | Always |
| `anthropic.custom_base_url` | <Undocumented /> | `true` or `false` (a boolean) | When Claude Code can tell. `true` when the API base URL is not the default |
| `anthropic.plan` | <Undocumented /> | `pro`, `max`, `team`, or `enterprise` | With a claude.ai subscriber login. A `free` plan sets none |
| `anthropic.seat_type` | <Undocumented /> | `premium`, `standard`, `usage_based`, or `other` | With a claude.ai subscriber login and a stored seat tier. Claude Code maps the tier name to one of the four values.[^attr-set] |

## Attributes on Every Event

Every event carries these base attributes: `user.id`, `user.email`, `user.groups`, `event.name`, `event.timestamp`, `event.sequence`, `prompt.id`, and `workspace.host_paths`. When `OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES` is set, Claude Code also copies the keys of `OTEL_RESOURCE_ATTRIBUTES`.

## Host Resource Attributes

Set `OTEL_RESOURCE_INCLUDE_HOST` to include `host.name` and `host.id` in OpenTelemetry resource attributes (off by default).[^host-check] Status: <Undocumented /> in the official docs.

Claude Code adds `host.name` and `host.id` to the resource only when `OTEL_RESOURCE_INCLUDE_HOST` is `true`.[^host-check] The same check also needs telemetry on and no OTEL exporter variable that names `console`. It does not apply to some hosted and remote runs.

## Export Behavior

| Case | Status | Behavior |
| --- | --- | --- |
| An `otlp` exporter has an endpoint but `OTEL_EXPORTER_OTLP_PROTOCOL` is not set | <Undocumented /> | The protocol is `http/protobuf`. |
| The endpoint host is a loopback host, such as the default `localhost:4318` | <Undocumented /> | The export does not go through a configured proxy. |
| One entry of `OTEL_RESOURCE_ATTRIBUTES` is malformed | <Undocumented /> | Claude Code keeps the other entries. |
| Export through a proxy that is slow to reach the collector | <Undocumented /> | The timeout is 25 seconds, and `OTEL_EXPORTER_OTLP_TIMEOUT` cannot raise it above 25 seconds. |

The rows above come from the program.[^export-code]

## Spans That Are Never Sent

The program names four more spans: `claude_code.bash.subprocess`, `claude_code.compaction`, `claude_code.mcp.rpc`, and `claude_code.subagent.spawn`. Claude Code never sends them. Each one starts only when a gate is on, and the gate always returns `false`. No setting or environment variable turns it on, so the OpenTelemetry schema does not list these spans.[^dead-spans]

## Related Pages

- [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md) lists the variables that control telemetry.
- [JSON Schemas](schemas.md) has the exact fields in `claude-code-otel.json`.
- [Undocumented Items](undocumented.md) indexes every undocumented item.
- [Monitoring](https://code.claude.com/docs/en/monitoring-usage) in the official docs.

## Sources

[^events]: The program, the event emitter at `chunk-4je1pw3n.js:1122` (the body `claude_code.` and the event name). A call site is `chunk-hg1yqkjk.js:195470` (`tool_decision`). The one call site of `tool_result` is `chunk-hg1yqkjk.js:199511`, which adds `request_id` when a request ID is known.
[^hook-complete]: The program writes `num_hooks` as the length of the hook list and `num_success` at `chunk-hg1yqkjk.js:271150`, after `hook_execution_complete` at `chunk-hg1yqkjk.js:271150`. The event starts at `chunk-hg1yqkjk.js:268639`. The two `internal: true` callback hooks are at `chunk-7xvyfah7.js:166` (post-commit) and `chunk-9vt18apk.js:358` (post-push).
[^safety-gate]: The program, `chunk-hg1yqkjk.js:195611` (the gate `tengu_snoopy_creek`) and its default `false` at `chunk-hg1yqkjk.js:195792`. The two call sites test it through `$d5d112` at `chunk-hg1yqkjk.js:195693` and `chunk-hg1yqkjk.js:195730`.
[^mid-turn]: The program, `chunk-wm04tzdx.js:4485`.
[^mcp-name]: The program. The set is `loggableMcpServers` (`chunk-aq3ms068.js:45940`). `chunk-w3gpg1a5.js:11334` and `chunk-w3gpg1a5.js:12363` add a server (`$43ba63`, `chunk-aq3ms068.js:45956`) when `$03fa37` (`chunk-aq3ms068.js:50260`) returns true. The plugin condition is `$224815` (`chunk-aq3ms068.js:50245`): a string `pluginSource`, `pluginOfficialSourceVouched` true, `pluginEndpointTemplated` not true, type `http`, `sse`, or `ws` with a `url`, and a marketplace name in a built-in list of official names (`$484f5e` at `chunk-t39fw2cy.js:4465`, list at `chunk-t39fw2cy.js:2156`). The vouched flag is set at `chunk-hg1yqkjk.js:242552` (`officialMarketplaceSourceVouched`; the plugin server gets `pluginOfficialSourceVouched` at `chunk-hg1yqkjk.js:200426`) when the marketplace name is on that list, its source is `github` or `git` with no `ref` and no `path`, and two more checks pass. An endpoint counts as templated (`chunk-hg1yqkjk.js:200451`) when expanding `${CLAUDE_PROJECT_DIR}`, an environment variable, or `${user_config.*}` changes its URL, when the URL holds `${CLAUDE_PROJECT_DIR}`, or when the expansion leaves a variable unset. An MCPB server gets `pluginEndpointTemplated` at `chunk-hg1yqkjk.js:200104` when its bundle source starts with `http` or `$27d541` (`chunk-hg1yqkjk.js:200141`) is true. The default is `custom` (`chunk-aq3ms068.js:45981` and `chunk-aq3ms068.js:46068`). The attribute is built at `chunk-aq3ms068.js:46150`, where a tool name stays `custom` when the server is withheld.
[^two-attrs]: The program. The level in force (`effort`) is in `chunk-hg1yqkjk.js:153018` and `chunk-hg1yqkjk.js:153334`. The server name (`mcp_server.name`) is in `chunk-aq3ms068.js:46150`, with `custom` at `chunk-aq3ms068.js:45981`. The `safety_event` gate is the flag `tengu_snoopy_creek` (`chunk-hg1yqkjk.js:195611`), which `$d5d112` reads (`chunk-hg1yqkjk.js:195791`). The event is sent at `chunk-hg1yqkjk.js:195812`. The gate is checked at `chunk-hg1yqkjk.js:195693` and `chunk-hg1yqkjk.js:195730` (`$d5d112`).
[^attr-set]: The program. The tier map (`usage_based`) is at `chunk-4je1pw3n.js:213`. The attribute set is built at `chunk-4je1pw3n.js:230`.
[^host-check]: The program, `chunk-prrpw8cm.js:1932`. The resource is built at `chunk-prrpw8cm.js:1932`.
[^export-code]: The program. The default protocol is at `chunk-prrpw8cm.js:2166` (`OTEL_EXPORTER_OTLP_PROTOCOL`) and `chunk-prrpw8cm.js:1881` (`http/protobuf`). The 25 second cap is at `chunk-prrpw8cm.js:2858` (`25000`) and `chunk-prrpw8cm.js:2859` (`OTEL_EXPORTER_OTLP_TIMEOUT`). The loopback check is at `chunk-1frwn5ry.js:45` (`$256390`), and the proxy choice that uses it is at `chunk-prrpw8cm.js:2849` (`$305f6d`). The resource attribute parser is at `chunk-4je1pw3n.js:273` (`$d3c933`) and `chunk-1thjhp1f.js:42` (`OTEL_RESOURCE_ATTRIBUTES`).
[^managed-denial]: The program, `chunk-hg1yqkjk.js:196752` (a refusal from a `PreToolUse` hook that managed settings run is kept as `managedDenial`) and `chunk-hg1yqkjk.js:207408` (that refusal calls `onPermissionDenial`; the `tool_decision` event is written at `chunk-hg1yqkjk.js:199421`).
[^effort-events]: The program, `chunk-hg1yqkjk.js:165236` (`output_config?.effort`), `chunk-hg1yqkjk.js:154076` (`api_request`), `chunk-hg1yqkjk.js:153334` (`api_error` takes `effort`) and `chunk-hg1yqkjk.js:153344` (`api_retries_exhausted` adds it when it is set).
[^dead-spans]: The program. The gate `$19297d` is `return !1` at `chunk-c76p2516.js:501`. The span wrapper `$6f0846` at `chunk-c76p2516.js:1135` and the subagent span `$3293be` at `chunk-c76p2516.js:1177` return first when it is `false`. Compaction calls the wrapper at `chunk-hg1yqkjk.js:143488`, the Bash tool at `chunk-hg1yqkjk.js:248880`, and an MCP tool call goes through `$246069` (`chunk-c76p2516.js:1152`) at `chunk-w3gpg1a5.js:14111`.
[^plugin-metrics]: The program. `$7cc807` (`chunk-hg1yqkjk.js:267294`) sends the event only when `$4dd9e9` (`chunk-hg1yqkjk.js:71404`) finds an official marketplace name (the names at `chunk-t39fw2cy.js:2156`, for example `claude-plugins-official`). A source outside the official GitHub organization cannot use an official name (`chunk-t39fw2cy.js:2253`, the text names `github.com/`). A valid answer logs "Hook JSON output had unrecognized keys (ignored): metrics" (`chunk-hg1yqkjk.js:68542`). The fallback that keeps `metrics` is at `chunk-hg1yqkjk.js:74353`, and the next request sends it at `chunk-hg1yqkjk.js:260811`. The check `$5297af()` (`chunk-zzhrwga7.js:22`) tests a host-set `door` value that the program never sets, so it is always false and the extra metrics paths stay off. Probe case `otel-hook-plugin-metrics` (`bun tools/schemas/observe/print.ts <dir> --only otel-hook-plugin-metrics`) sent `probe_count` as an integer and `probe_flag` as a boolean.
[^retention-sweep]: The program. Print mode starts the housekeeping (`startBackgroundHousekeeping`) at `chunk-txash88y.js:2492`. The scheduler `$aaac0f` is at `chunk-wxnsvrbv.js:279`. Its 5 second first run (`5000`) is defined at `chunk-wxnsvrbv.js:251` and used at `chunk-wxnsvrbv.js:350`. Its 10 minute retry (`600000`) is defined at `chunk-wxnsvrbv.js:250` and used at `chunk-wxnsvrbv.js:336`; a parked or failed spare session also causes it (`chunk-wxnsvrbv.js:294`). Its 60 second idle check (`60000`) is at `chunk-wxnsvrbv.js:335`. The event is sent at `chunk-4je1pw3n.js:1173` (`retention_sweep`). Probe case `otel-retention-sweep` sent a `complete` result with all counts as strings.
