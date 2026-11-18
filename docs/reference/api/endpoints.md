---
title: Endpoints and Headers
description: The paths Claude Code calls, the headers it sends and reads, and the attribution block in the system prompt.
sidebar_position: 2
---

An endpoint is a URL path on a server, and a header is a named value that a request carries. Claude Code calls the model server and a few account servers, and it adds headers to each request. If you run Claude Code behind a proxy, the proxy must pass `anthropic-version` and `anthropic-beta` on without a change.

Base URL variables pick the server, and `ANTHROPIC_CUSTOM_HEADERS` adds headers. The switches are `CLAUDE_CODE_GATEWAY_HINT_HEADERS`, `CLAUDE_CODE_ATTRIBUTION_HEADER=0`, and `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`. The model list is cached in `~/.claude/cache/gateway-models.json`.

## Example

Keep the hint headers on a custom gateway and read them there.

```bash title="Send hint headers to a gateway"
export ANTHROPIC_BASE_URL=https://gateway.example.com
export CLAUDE_CODE_GATEWAY_HINT_HEADERS=1
claude -p "hi"
```

The gateway then sees `x-claude-code-request-class: main` and the other hint headers on each request.

## Model Endpoints

See [Gateway Compatibility Guide](https://code.claude.com/docs/en/llm-gateway-protocol), and [Probes](../probes.md) for `cache_touch`.

| Path | Status | What It Does |
| --- | --- | --- |
| `/v1/messages?beta=true` | <Documented /> | Sends the model request. |
| `/v1/messages/count_tokens` | <Documented /> | Counts tokens. Without it, Claude Code estimates from the number of characters. |
| `/v1/messages/cache_touch` | <Undocumented /> | Claude Code calls it every 30 seconds (10 to 120) to keep the prompt cache warm. It needs a subscriber login and the `cache-keepalive-2026-09-03` beta. |
| `/v1/models` | <Documented /> | Lists the models for the `/model` picker, only with `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`. |
| `HEAD /api/hello` | <Documented /> | Warms up the connection. Claude Code skips it when an HTTP proxy or a client certificate is set. |
| `/model/{model}/invoke` and `/model/{model}/invoke-with-response-stream` | <Documented /> | The Amazon Bedrock format, chosen with `ANTHROPIC_BEDROCK_BASE_URL`. |
| `:rawPredict` and `:streamRawPredict` | <Documented /> | The Google Cloud Agent Platform format, chosen with `ANTHROPIC_VERTEX_BASE_URL`. |

Since `2.1.326`, Claude Code resends a refused model request with a lower `max_tokens`. It does so on an API error that is not a 401 and that has no other retry path, when the error text says `max_tokens: <n> > <limit>, which is the maximum allowed number of output tokens for <model>` with a limit of 4096 or more. The program checks no other status. The error can be any API error whose text matches. When the text names no limit, or a limit below 4096, a model with no entry in the model list uses 32,000 instead. Claude Code resends only when that limit is lower than the `max_tokens` it sent. The new value is the limit that the server names. After the resend works, Claude Code logs a warning, and it keeps the lower cap for this model until the next `/clear`, compaction, resume, or provider change. Set `CLAUDE_CODE_MAX_OUTPUT_TOKENS` to pick a different limit.[^max-tokens-retry]

## Account and Service Endpoints

The docs do not describe these paths, except the OpenTelemetry row. The Use column comes from the code that calls each path.[^account-paths]

| Path | Status | Use |
| --- | --- | --- |
| `/v1/oauth/token`, `/api/oauth/profile`, `/api/oauth/usage`, `/api/oauth/account/settings` | <Undocumented /> | `/v1/oauth/token` is the OAuth token URL. `/api/oauth/profile` returns the sign-in profile and organization. `/api/oauth/usage` returns plan usage (the `/usage` data). `/api/oauth/account/settings` is read and patched for the `grove_enabled` choice and for artifact pins. |
| `/api/oauth/usage?skip_spend=1` | <Undocumented /> | Since `2.1.325`, the usage read adds `skip_spend=1` for each read kind except the plain one. The same read can also add `cedar_ember=1`, `at_wall=1`, or `starry_waterfall=<surface>`.[^usage-params] |
| `/api/oauth/account/settings?opt_in_only_if_unset=grove_enabled` | <Undocumented /> | Claude Code sends a `PATCH` with the body `{ "grove_enabled": true }` when you accept the opt-in in the Grove notice. It reads `grove_enabled` back from the reply when that value is a boolean. No source states what the query parameter does.[^grove] |
| `/api/claude_code/policy_limits` | <Undocumented /> | The limits of your organization, cached in `policy-limits.json`. |
| `/api/claude_code/organizations/metrics_enabled`, `/api/claude_code/notification/preferences`, `/api/claude_code/skills` | <Undocumented /> | The metrics opt-out check (`metrics_logging_enabled`), the notification preferences, and the skill health data, which Claude Code fetches only when a server-side flag is on.[^skills-flag] |
| `/api/event_logging/v2/batch` | <Undocumented /> | Event logging by Anthropic. |
| `/v1/metrics`, `/v1/logs`, `/v1/traces` | <Documented /> | OpenTelemetry export. See [Monitoring](https://code.claude.com/docs/en/monitoring-usage). |
| `/api/claude_cli_feedback`, `/api/claude_code_shared_session_transcripts` | <Undocumented /> | Feedback and shared transcripts. |
| `/v1/code/sessions`, `/v1/code/triggers`, `/v1/code/github/*`, `/v1/code/agent-proxy` | <Undocumented /> | Cloud sessions, routines (`/v1/code/triggers`), GitHub pull request and review comment helpers, and the relay that the agent proxy uses. |
| `/v1/code` | <Undocumented /> | The bare prefix in the list of paths that the agent proxy relays. A path is relayed when it is this prefix or below it. The other entries are `/v1/sessions`, `/api/organizations/:orgUUID/claude_code/onboarding`, `/api/organizations/:orgUUID/cowork/remote_devices`, and `/api/organizations/:orgUUID/dust/generate_title_and_branch`. Claude Code holds the list and does not call the bare prefix.[^agent-proxy] |
| `/v1/organizations/analytics/cost` | <Undocumented /> | A route of the `claude gateway` admin API, not a path that the client calls. `GET` only, with an admin credential in `x-api-key`. It reads past spend for a date range in total, per developer, per day, or per IdP group.[^cost-notes] `starting_at` is required (RFC 3339 with an offset). `ending_at` defaults to now, and the range is at most 31 days. `time_bucket_width` takes `1d` and needs `ending_at`. `group_by[]` takes `actor` or `rbac_group_id`. `actor_ids[]` and `rbac_group_ids[]` take at most 100 values each. `actor_types[]` takes `user_actor`. `exclude_deleted_users` needs `group_by[]=actor`. `order_by` takes `amount`, `list_amount`, or `time`. `order` takes `asc` or `desc` (default `desc`). `limit` is 1 to 1000 (default 20). `page` is a token, and the route refuses it for a range that includes today or ended less than 5 minutes ago. The gateway needs a `listen` object and a Postgres store.[^cost-run] |
| `/v1/me` | <Undocumented /> | The API auth warm. Claude Code sends `GET /v1/me` with a 3000 ms limit (`auth warm timed out`) to refresh the credential cache before a model call. It runs only for a first-party host that is not in gateway mode, when the credential lifetime is known (120000 ms for the `remote_cowork` entrypoint with `CLAUDE_CODE_REMOTE` on, or the tenant lifetime), and when the policy gate `allow_api_auth_warm` is not denied (HIPAA denies it). The triggers are `turn_start`, `lapse_timer`, and `owner_present`. A fresh full check inside the lifetime skips it, and a failure pauses it for 60000 ms. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` turns it off (`DISABLE_TELEMETRY` and `DO_NOT_TRACK` do not), and so does a missing claude.ai login with the right scopes.[^auth-warm] |
| `/v1/ultrareview/quota`, `/v1/ultrareview/preflight` | <Undocumented /> | The quota check and the preflight check for an ultrareview cloud run. |
| `/api/model_selector/{id}`, `/api/organization/claude_code_first_token_date` | <Undocumented /> | Model picker data, and a one-time fetch of the date of first use that is kept as `claudeCodeFirstTokenDate`. |
| `/api/ws/speech_to_text/voice_stream` | <Undocumented /> | Voice dictation. |
| `/api/frame/*`, `/v1/design/*` | <Undocumented /> | Artifact frames (`/api/frame/*`, through the agent proxy) and Claude Design MCP servers (`/v1/design/*`). |

Claude Code also holds an Anthropic SDK client with paths such as `/v1/agents`, `/v1/skills`, `/v1/vaults`, and `/v1/organizations/*`. They belong to the SDK code, and the Claude Code loop does not call them. Claude Code names these hosts: `code.claude.com`, `claude.ai`, `claude.com`, `api.anthropic.com`, `platform.claude.com`, `www.anthropic.com`, `support.claude.com`, `downloads.claude.ai`, and `mcp-proxy.anthropic.com`.

## Self-Hosted Runner Paths

`claude self-hosted-runner` calls these paths under `/v1/code/runners/self-hosted/` and `/v1/code/auth/refresh`. The Use column comes from the code and from stub runs.[^runner-runs] Each log line quoted here comes from the debug log of that run.

| Path | Status | Use |
| --- | --- | --- |
| `runners/register` | <Undocumented /> | The runner starts here. The reply holds the runner ID.[^reg] |
| `runners/{id}/poll` | <Undocumented /> | The runner polls for work orders. The log shows `PollWork -> 200 assignments=1`. Each order starts one session. A second poll that returns the same order logs `Ignoring duplicate assignment`. |
| `sessions/{id}/release` | <Undocumented /> | The runner gives a session slot back with an empty `POST` body and a 15 s limit. The log shows `ReleaseSession -> 200 released=true`. The triggers are `--release-idle-session-min` (no user input for that many minutes), `--retire-at <epoch-seconds>`, and the stop drain. With `--retire-at` 7 s ahead, the child got `SIGTERM`, then `release`, then `deregister reason=retire_at`.[^retire] |
| `sessions/{id}/report-failure` | <Undocumented /> | Reports a failed session. The body is `{reason, setup_failure_kind?, failure_kind?}`, with a 15 s limit. When the child exits with 1, the log shows `reason=child exited 1: cause=SESSION_FAILURE_KIND_RUNNER_CRASH` and `ReportSessionFailure -> 200 excluded_count=0 stuck=false`. When the child exits with 0, Claude Code makes no call.[^report-fail] |
| `deregister` | <Undocumented /> | The runner leaves the pool when it exits. The body has an optional `reason` and `drain_hold`, with a 10 s limit. The log shows `DeregisterRunner -> 200`. A `--retire-at` run sends `reason=retire_at`. |
| `spawn-hints/poll` | <Undocumented /> | Orchestrator mode polls for spawn hints. The log shows `dispatching 1 hint(s)`, then the spawn-runner hook runs with `CLAUDE_RUNNER_SPAWN_REASON` set.[^spawn-poll] |
| `spawn-hints/nack` | <Undocumented /> | Orchestrator mode sends a refusal for a hint, with the failure cause and the error cut to 512 characters. It fires when the spawn-runner hook exits with a non-zero code, times out, or is stopped by the shutdown drain. It also fires when the server returns more hints than the limit. When the hook prints `boom` and exits 1, the log shows `POST .../spawn-hints/nack ... retryable=true cause=SESSION_FAILURE_KIND_SPAWN_HOOK_ERROR`.[^nack] |
| `/v1/code/auth/refresh` | <Undocumented /> | Swaps the runner token (or a session token) for a new one before it expires. It is a `POST` with an empty body, the old token as bearer, and a 15 s limit. The reply needs a `token` field. Without it Claude Code throws `RefreshToken: response missing token`. With a runner token that ends after 8 s, the log shows `RefreshToken -> 200` and `runner_token refreshed`.[^refresh] |

## Sign-In and Account Paths

No source states the rules of these paths, so the Use column comes from the code that calls each path.[^signin-paths] Where the code does not show the purpose, the row says so.

| Path | Status | Use |
| --- | --- | --- |
| `/api/claude_cli/bootstrap` | <Undocumented /> | A startup fetch with a 5 second timeout. Claude Code skips it on third-party providers. |
| `/api/claude_code/settings` | <Undocumented /> | The URL that the remote managed settings are read from. |
| `/api/claude_code/metrics` | <Undocumented /> | The target of the first-party metrics exporter, with a 5 second timeout. |
| `/api/claude_cli_profile` | <Undocumented /> | Reads a profile with an API key and the account UUID. |
| `/api/claude_code_grove`, `/api/oauth/account/grove_notice_viewed` | <Undocumented /> | The Grove notice. The first path returns the config with a `grove_enabled` flag. The second is named for the notice-viewed event. |
| `/api/claude_code_penguin_mode` | <Undocumented /> | The fast mode status of your organization. Claude Code emits `orgFastModeChange` when it changes. On Vertex, Claude Code skips this check (see [Fast Mode](../../configure/models-and-providers/fast-mode.md#controls)). |
| `/api/auth/trusted_devices` | <Undocumented /> | Enrolls the device with your OAuth token. The body holds a display name such as `Claude Code on` and the host. |
| `/api/oauth/validate` | <Undocumented /> | Part of the Claude in Chrome check. The OAuth token needs a scope that this path accepts (`user:profile`, `user:office`, or `user:ccr_inference`), or Claude Code turns the feature off. |
| `/api/oauth/org` | <Undocumented /> | A `POST` with the OAuth token as bearer. The reply holds `organization_uuid`. Claude Code calls it for the managed setting `forceLoginOrgUUID`, with a 10 second timeout. It skips the call when the token has the scope `user:profile`, `user:office`, or `user:ccr_inference`, and falls back to `/api/oauth/validate`. With the hidden flag `--managed-settings '{"forceLoginOrgUUID":"…"}'`, Claude Code calls `POST /api/oauth/org` (answer 200) after `GET /api/claude_code/policy_limits` and `GET /api/claude_code/settings`, and exits 1 with no `/v1/messages` request.[^org-pin] |
| `/api/oauth/claude_cli/create_api_key`, `/api/oauth/claude_cli/roles`, `https://api.anthropic.com/api/oauth/claude_cli/create_api_key`, `https://api.anthropic.com/api/oauth/claude_cli/roles` | <Undocumented /> | The `API_KEY_URL` and `ROLES_URL` of the OAuth config. |
| `/api/oauth/organizations/${…}`, `/api/oauth/organizations/${…}/code/repos/${…}/${…}`, `/api/oauth/organizations/${…}/code/repos/resync`, `/api/oauth/organizations/${…}/sync/github/auth` | <Undocumented /> | Organization paths for the GitHub app. `/code/repos/<owner>/<repo>` checks whether the app is installed, `/code/repos/resync` asks the server to resync that status, and `/sync/github/auth` checks whether the GitHub token is synced by web setup. Other calls also use the first path as a prefix. |
| `/api/organizations/${…}/reset_rate_limits` | <Undocumented /> | Posts a rate limit reset claim for your OAuth organization. |
| `/api/oauth/file_upload`, `/api/oauth/files/${…}/content` | <Undocumented /> | File upload with your OAuth token (scope `user:file_upload`), and file content. The content URL ends with `?model_copy=inference_highres` when the caller asks for the model copy of the file, and with nothing otherwise.[^file-upload] |
| `/api/oauth/cri`, `https://api.anthropic.com/api/oauth/cri` | <Undocumented /> | The base of an issuer for `cri+jwt` tokens (ES256), with its keys at `/jwks.json` below it. No source states what it is for. |
| `/api/oauth/local_pairing` | <Undocumented /> | The issuer for local pairing. Claude Code builds `/attest` and `/jwks.json` below it. |
| `/v1/oauth/hello` | <Undocumented /> | The startup preflight checks `/api/hello` on the API host and `/v1/oauth/hello` on the OAuth host, with a 10 second timeout. |
| `/v1/code/environments/${…}/host_requests` | <Undocumented /> | A `GET` that long-polls for folder requests from claude.ai. The query is `wait_ms`, and the request limit is `wait_ms` plus 10 s. The headers are the bridge headers with `anthropic-client-feature: ccr`. The Remote Control environment code runs it while claude.ai browses the folders of this computer, so that it can start a session. It starts on a wake item, and it stops after a period with no requests, when folder browsing is off, or after repeated failures. Claude Code reads `requests` from the reply, an array of objects. Each object needs `request_id` (a string that fits in a URL), `kind` (only `list_directory` is answered, others are dropped), and `path`. A status of 401, 403, 404, 410, or 429 raises an error named `PollHostRequests`.[^host-req] |
| `/v1/code/environments/${…}/host_requests/${…}/result` | <Undocumented /> | A `POST` that answers one folder request, with a 10 s limit. The same listener sends it once for each `list_directory` request. The body is either `{ entries: [{ name, git_root }], truncated }` or `{ refusal }`, where `refusal` is `unreadable` or a code for a read error. Claude Code reads `delivered` from the reply and counts the answer as sent only when it is `true`. A status of 401, 403, 404, 410, or 429 raises an error named `AnswerHostRequest`.[^host-result] |
| `/v1/privacy-consents`, `/v1/privacy-consents/check` | <Undocumented /> | Since `2.1.325`, Claude Code reads and saves the consent for the type `training.consumer_consent` with your claude.ai sign-in. It sends a `PUT` to `/v1/privacy-consents` to save a choice and a `POST` to `/v1/privacy-consents/check` to read the state. Its entry points are the settings control, the training update notice, and the onboarding notice. It does not send either request when the sign-in changed or may not use the consent service.[^consents] |
| `/v1/privacy-consents/checkup` | <Undocumented /> | A `GET`, with a 10 s limit, that asks whether the account owes a privacy checkup. The privacy checkup refresh calls it. It runs only for a claude.ai sign-in, and only when a server-side gate (default on) is true. Claude Code asks again no sooner than one hour (`waitMs` is clamped to 1 hour to 7 days), and it stays quiet for 10 minutes after it showed a checkup. The reply is `{ show: false }`, or `{ show: true, checkup_id, ends_at }` where `checkup_id` matches `[a-z0-9-]{1,128}` and `ends_at` is a date with offset. A shown checkup may also carry `text` (1 to 200 characters), `url` (an `https` link, up to 300 characters), and `link_text`, and a reply may carry `next_check_after_seconds`. Claude Code saves the answer in `privacyCheckupCache` of the global config. The same code `POST`s `…/checkup/shown` with `{ checkup_id, surface, event_id, dismissed? }` after it shows or dismisses the checkup.[^checkup] |

## OAuth URLs and Hosts

The URLs below are part of the production OAuth config. Set `CLAUDE_CODE_CUSTOM_OAUTH_URL` to change them.[^oauth-config]

| URL | Status | Use |
| --- | --- | --- |
| `https://platform.claude.com/oauth/authorize` | <Undocumented /> | The Console sign-in page (`CONSOLE_AUTHORIZE_URL`). |
| `https://claude.com/cai/oauth/authorize` | <Undocumented /> | The claude.ai sign-in page (`CLAUDE_AI_AUTHORIZE_URL`). |
| `https://platform.claude.com/v1/oauth/token` | <Undocumented /> | The token URL (`TOKEN_URL`). |
| `https://platform.claude.com/oauth/code/callback` | <Undocumented /> | The redirect for the manual code flow (`MANUAL_REDIRECT_URL`). |
| `https://platform.claude.com/oauth/code/success?app=claude-code`, `https://platform.claude.com/buy_credits?returnUrl=/oauth/code/success%3Fapp%3Dclaude-code` | <Undocumented /> | The success pages (`CLAUDEAI_SUCCESS_URL` and `CONSOLE_SUCCESS_URL`) where the local callback server sends the browser. |
| `https://claude.ai/oauth/claude-code-client-metadata` | <Undocumented /> | Held next to the OAuth config. No source states its use. |
| `https://api.anthropic.com`, `https://claude.ai`, `https://mcp-proxy.anthropic.com` | <Undocumented /> | `BASE_API_URL`, `CLAUDE_AI_ORIGIN`, and `MCP_PROXY_URL`. |

## MCP Paths

| Path | Status | Use |
| --- | --- | --- |
| `/v1/mcp_servers?limit=1000` | <Undocumented /> | Lists your claude.ai MCP connectors. It needs the `user:mcp_servers` scope, and Claude Code adds `include_additional_installs=true`. |
| `/v1/mcp/{server_id}`, `/v1/toolbox/shttp/mcp/{server_id}` | <Undocumented /> | The `MCP_PROXY_PATH` on `https://mcp-proxy.anthropic.com`, and the one of the local OAuth config at `http://localhost:8205`. |
| `/api/organizations/${…}/mcp/start-auth/${…}?product_surface=${…}` | <Undocumented /> | A claude.ai URL that starts the sign-in of a connector. `product_surface` is the entrypoint, such as `cli`. |
| `/api/directory/servers?${…}`, `/api/directory/plugins` | <Undocumented /> | `servers` is read without credentials, with a 5 second timeout, in pages of 500, and Claude Code keeps the URLs of the remote servers. `plugins` is a constant, and no source states its use. |
| `/api/directory/server-urls` | <Undocumented /> | A `GET` without credentials, with no redirects. Claude Code expects status 200 and a body with a list of `urls`, and it keeps them as the official MCP server URLs. If the list of sources is empty, it makes no request. Any other answer is logged as a failed registry fetch.[^dir-urls] |
| `https://platform.claude.com/settings/billing` | <Undocumented /> | A web page, not an API call. Claude Code puts this link in its "Credit balance is too low" error text, in the `Or add funds:` hint.[^billing] |
| `/v1/pages/mcp`, `/api/artifacts/mcp`, `/v1/code/mcp/ccr-artifacts`, `/v1/code/mcp/hearthbot`, `/v1/claudeai-agents/mcp` | <Undocumented /> | Paths of built-in MCP servers that Claude Code holds as constants. It names the servers `Claude_Pages`, `Claude_Docs`, and `claude-artifacts`. No source states the use of each path. |
| `/api/mcp/claude_ai`, `/api/cowork/widgets_mcp`, `/v1/code/mcp/cowork` | <Undocumented /> | Paths that tool provenance uses to tell an Anthropic connector from another MCP server in a remote session. `/api/mcp/claude_ai` and `/api/cowork/widgets_mcp` are the `at` paths of two built-in connectors. In a remote session, an MCP server whose URL is `https://<Anthropic host>` plus this path counts as a known connector, and then `server_url` may go into its `ownership_metadata`. `/v1/code/mcp/cowork` is the path of the cowork server, compared with the URL path without the query. Claude Code does not call these paths itself.[^provenance-paths] |
| `https://platform.claude.com/docs/mcp` | <Undocumented /> | The `docs` HTTP MCP server of the built-in plugin `cc-plugin-claude-platform`. It is for building with the Claude API. The plugin is available only when a server-side gate is on and the other checks pass.[^platform-plugin] |
| `https://microsoft365.mcp.claude.com/mcp` | <Undocumented /> | The URL of the managed MCP preset "Microsoft 365" (name `m365`, HTTP transport). Since `2.1.327`, Claude Code also treats the origin `https://microsoft365.mcp.claude.com` with no path, `/mcp/v1`, or `/personal/mcp` as the same connector, for the file reference in `sharepoint_upload_file` and `sharepoint_update_file` (`contentBase64` set to `sha256:<hex>:<absolute path>`, files up to 4 MB).[^m365-origins] |

## Flags, Environments, and Files

| Path | Status | Use |
| --- | --- | --- |
| `/api/features/${…}`, `/api/eval/${…}`, `/api/eval-authed/${…}`, `https://api.anthropic.com/` | <Undocumented /> | The GrowthBook client that delivers the server-side flags (`tengu_*` gates). It reads the feature list, evaluates remotely, and evaluates with your auth headers (it falls back to `/api/eval` on an error). `${…}` is the client key, and `https://api.anthropic.com/` is the host. Set `DISABLE_GROWTHBOOK` to turn the fetch off. |
| `/v1/environments/bridge`, `/v1/environments/bridge/${…}`, `/v1/environments/bridge/${…}/offline`, `/v1/environments/${…}/bridge/reconnect` | <Undocumented /> | The bridge client of Remote Control. `POST /v1/environments/bridge` registers the environment. The other paths are named for the environment, going offline, and reconnecting. |
| `/v1/environments/${…}/work/poll`, `/v1/environments/${…}/work/${…}/ack`, `/v1/environments/${…}/work/${…}/heartbeat`, `/v1/environments/${…}/work/${…}/stop` | <Undocumented /> | Work item calls of the same bridge client, named for polling, acknowledging, heartbeat, and stop. |
| `/v1/environment_providers`, `/v1/environment_providers/cloud/create` | <Undocumented /> | `cloud/create` posts a new cloud environment of kind `anthropic_cloud` with the description "Default - trusted network access". |
| `/v1/sessions`, `/v1/sessions/${…}`, `/v1/sessions/${…}${…}`, `/v1/sessions/${…}/archive`, `/v1/sessions/${…}/events` | <Undocumented /> | Session paths without `beta=true`. Claude Code posts events to `/v1/sessions/<id>/events`, and to `/v1/code/sessions/<id>/events` for a cloud session. |
| `/v1/files`, `/v1/files/${…}`, `/v1/files/${…}/content` | <Undocumented /> | Files API paths without `beta=true`. Both Claude Code and the SDK client hold them. |
| `/v1/filestore/fs/listDirectory`, `/v1/filestore/fs/readFile` | <Undocumented /> | File store calls. `readFile` posts a `filesystem_id` and a `path` with a JWT, and stops after 60 seconds without bytes. |
| `/v1/code/local/memory/mounts`, `/v1/code/local/memory/credential` | <Undocumented /> | Organization memory stores. Claude Code caches the discovery answer in `org-memory-discovery.json`. |
| `/v1/code/channels` | <Undocumented /> | Creates a private Claude Project (`POST`). The body holds `name`, `icon` (`Code` by default), and the optional `color`, `topic`, `system_prompt_addendum`, `default_environment_id`. Claude Code calls a channel a project. The `/send-to-project` command and its tools use these project routes. |
| `/v1/code/channels?${…}` | <Undocumented /> | Lists the projects that you joined (`GET`, query `scope=joined`, `limit`, and `cursor`). |
| `/v1/code/channels/${…}${…}` | <Undocumented /> | One builder for the routes of one project. The id must look like `chan_…`. With no suffix, `GET` looks up the project, and `?include_members=true` adds the members. `PATCH …/config` updates the default source URLs, and `POST …/setup-proposals` submits a setup proposal. |
| `/v1/code/channels/${…}/messages` | <Undocumented /> | Sends a message to a project (`POST`). The body holds `body`, `client_message_id`, and an optional `reply_to_message_id`. The answer holds `message_id` and `thread_root_id`. |
| `/v1/code/memory/channel/${…}/memories` | <Undocumented /> | The memory files of a project. Claude Code lists them (`GET`, 100 for each page) and saves a new file with `POST` (it fails if the path exists). |
| `/v1/code/mcp/meta` | <Undocumented /> | A JSON-RPC `tools/call` of `send_message` with a `session_id`, a `message`, and the priority `now`. Claude Code uses it to hand a summary to a project. |
| `/v1/filestore/fs/readFileMetadata` | <Undocumented /> | File store call. It posts a `filesystem_id` and a `path` with a JWT, and reads the `size` and `md5` of the file. Claude Code accepts at most 65,536 bytes of answer. |

## Hosts and Downloads

| URL | Status | Use |
| --- | --- | --- |
| `https://downloads.claude.ai/claude-code-releases` | <Undocumented /> | The base URL for release downloads, next to the update errors (`update_apply_*`). |
| `https://downloads.claude.ai/claude-code-releases/plugins/claude-plugins-official` | <Undocumented /> | Where Claude Code fetches the official plugin marketplace. It is cached under `marketplaces/claude-plugins-official/`. |
| `https://downloads.claude.ai/model-catalog/v1/catalog.json`, `https://downloads.claude.ai/model-catalog/v1/schema.json` | <Undocumented /> | The signed model catalog (the signature is a `.raw-sig.json` file, key `claude-code-release-signing-key`), and the `$schema` of its entries. |
| `https://anthropic.com/claude-code/plugin.schema.json` | <Undocumented /> | The URL of the plugin manifest schema, by its name. |
| `https://code.claude.com/docs/en/claude_code_docs_map.md`, `https://platform.claude.com/llms.txt`, `https://claude.com/docs/llms.txt`, `https://claude.com/docs/claude-tag/overview.md` | <Undocumented /> | Doc sources that Claude Code holds next to the `claude-code-guide` agent. |
| `https://status.claude.com` | <Undocumented /> | Named next to the "Repeated 529 Overloaded errors" message. |
| `https://preview.claude.ai` | <Undocumented /> | A host that Claude Code accepts for a Claude Project link, in place of `https://claude.ai`, when the claude.ai origin is the staging one. It also names the host in the hint that tells the model to read artifact links with the Artifact tool. |

## Request Headers

See [Gateway Compatibility Guide](https://code.claude.com/docs/en/llm-gateway-protocol#request-headers). Header names are not case-sensitive.

| Header | Status | Meaning |
| --- | --- | --- |
| `Authorization`, `x-api-key` | <Documented /> | The credential. |
| `anthropic-version` | <Documented /> | The API version, `2023-06-01`. |
| `anthropic-beta` | <Documented /> | The list of beta values. See [Betas](betas.md). |
| `x-claude-code-session-id` | <Documented /> | One value for each session. |
| `x-claude-code-agent-id`, `x-claude-code-parent-agent-id` | <Documented /> | The subagent that sent the request, and its parent. |
| `x-claude-code-request-class` | <Documented /> | The kind of request: `main`, `subagent`, `workflow`, `compaction`, or `auxiliary`. |
| `x-claude-code-agent-type` | <Documented /> | The kind of agent: `Explore`, `Plan`, `general-purpose`, `custom`, `teammate`, or `fork`. |
| `x-claude-code-compaction`, `x-claude-code-context-compacted` | <Documented /> | Marks a compaction request, and the first request after one. |
| `x-claude-code-prev-tool-durations` | <Documented /> | The run time of the last tool batch, such as `Bash=742;Read=9`, with at most 32 entries and 4 KB. |
| `x-claude-code-prompt-id` | <Documented /> | A random UUID for the user prompt, from `2.1.283`. |
| `x-claude-code-managed-settings-checksum` | <Undocumented /> | A checksum of the managed settings that Claude Code loaded. Sent from `2.1.327` only when all of these are true: hint headers are on, `CLAUDE_CODE_GATEWAY_HINT_HEADERS` is set to a true value in the `env` block of managed settings, managed settings exist, the provider is a gateway, or the Anthropic API at a base URL whose host is not `api.anthropic.com`, and `ANTHROPIC_UNIX_SOCKET` is not set.[^checksum] |
| `anthropic-workspace-id` | <Documented /> | Needed on Claude Platform on AWS. |
| `ANTHROPIC_CUSTOM_HEADERS` | <Documented /> | An env var for extra headers, one `Name: value` on each line. It is not a header itself. |
| `x-app`, `anthropic-client-platform`, `X-Stainless-*`, `X-Trusted-Device-Token`, `x-organization-uuid` | <Undocumented /> | Names in the program. No source states their rules. |

The hint headers (`x-claude-code-request-class` and the next four rows) go out on a direct connection to the Anthropic API. On a custom base URL they need `CLAUDE_CODE_GATEWAY_HINT_HEADERS=1`. Set it to `0` to stop them everywhere.

## Response Headers Claude Code Reads

| Header | Status | Use |
| --- | --- | --- |
| `retry-after` | <Documented /> | A number of seconds. A value above 60 stops the retries unless `CLAUDE_CODE_RETRY_WATCHDOG` is set. |
| `x-should-retry` | <Documented /> | `true` or `false`. It is one input to the retry decision. |
| `anthropic-ratelimit-unified-*` | <Documented /> | Plan usage and limits for `claude.ai` sign-ins. |
| `content-type` | <Documented /> | `text/event-stream`, or `application/vnd.amazon.eventstream` on Bedrock. |

## Attribution Block

The first block of `system` is a text line that starts with `x-anthropic-billing-header:`. The docs say the block holds the client version and a fingerprint of the conversation ([Gateway Compatibility Guide](https://code.claude.com/docs/en/llm-gateway-protocol#system-prompt-attribution-block)). The field names below come from the program.[^attr-fields]

| Field | Status | Meaning |
| --- | --- | --- |
| `cc_version` | <Undocumented /> | The client version. |
| `cc_entrypoint` | <Undocumented /> | Where Claude Code runs, such as `cli`, `sdk-cli`, or `claude-vscode`. |
| `cc_workload`, `cc_is_subagent` | <Undocumented /> | The workload tag (`--workload`), and a flag for subagents. |
| `cc_prev_req`, `cc_prompt_id`, `cc_turn_origin`, `cc_prompt_index`, `cc_turn_index` | <Undocumented /> | Request and turn tracking, only on the Anthropic API. |
| `cc_gateway`, `cc_project`, `cc_project_src` | <Undocumented /> | Tags for the gateway and the project. |

Set `CLAUDE_CODE_ATTRIBUTION_HEADER=0` to remove the block. The `api.anthropic.com` server strips it when it is the first and only block of its entry.

## How It Works

```mermaid
sequenceDiagram
  participant C as Claude Code
  participant G as Gateway
  participant M as Model server
  C->>G: POST /v1/messages?beta=true<br/>(anthropic-version, anthropic-beta,<br/>x-claude-code-*)
  G->>M: Same headers, same body
  M-->>G: text/event-stream
  G-->>C: Stream, retry-after on errors
```

## Related Pages

- [Betas](betas.md)
- [Request and Cache](../../how-it-works/request-and-cache.md)
- [Environment Variables](../../configure/env-vars/index.md)
- [Gateway Compatibility Guide](https://code.claude.com/docs/en/llm-gateway-protocol)

## Sources

[^checksum]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-18d5r2hb.js:319068` (the header name), `chunk-18d5r2hb.js:238176` (hint headers on) `chunk-18d5r2hb.js:319837` (the conditions), `chunk-enmznns5.js:685` (the direct `api.anthropic.com` test that stops the header), and `chunk-f892tj2r.js:36390` (the host test).
[^m365-origins]: The program, `chunk-eyze44ee.js:6777`.
[^max-tokens-retry]: The program, `chunk-m14bt1pz.js:3109407` (the text pattern and the limit of 4096), `chunk-m14bt1pz.js:3109862` (`lowerAfter`: the limit from the text, 32,000 for a model with no list entry, a resend only when the limit is lower, and `onReplyBegun` with the warning and the cap), and `chunk-m14bt1pz.js:3327124` (the retry rule, which excludes status 401). The [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326) list the fix.
[^account-paths]: The program. The paths are strings in the program code, for example `chunk-asj6f58y.js:360405` (profile), `chunk-8b50zmfk.js:30412` (usage), `chunk-fjqvkwj2.js:246` (policy limits), `chunk-asj6f58y.js:1076778` (event logging), `chunk-rj3e7agr.js:203508` (triggers), `chunk-p47p1nn1.js:22103` (feedback), `chunk-z8m162ec.js:1190` (ultrareview quota) and `chunk-ptjfa0wc.js:858` (voice stream).
[^usage-params]: The program, `chunk-8b50zmfk.js:30373` (the read kinds `plain`, `windows`, `cedar_ember`, `at_wall`, and `starry_waterfall`). The `windows` kind is in `2.1.325` and not in `2.1.323`.
[^grove]: The program, `chunk-k4dm91ea.js:2131`.
[^skills-flag]: The program, `chunk-xstndjzk.js:121170`. The flag is `tengu_skills_dashboard_enabled`.
[^agent-proxy]: The program, read site `chunk-asj6f58y.js:966704`.
[^cost-notes]: [`2.1.317` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.317).
[^cost-run]: The program, read sites `chunk-5z0ytfrt.js:1462474` (the route) and `chunk-5z0ytfrt.js:1446751` (the handler). Probe cases `print.api319.gateway.cost-route-admin`, `print.api319.gateway.cost-route-no-key`, and `print.api319.gateway.no-postgres` start the gateway with a Postgres container (none for the last). `GET /v1/organizations/analytics/cost?starting_at=…&ending_at=…&time_bucket_width=1d` and an admin read key in `x-api-key` answered 200 with `{"data":[],"has_more":false,"next_page":null,"data_refreshed_at":…}`. Without the key it answered 401 "missing or invalid admin credentials". Without a reachable Postgres the gateway exits with code 1 and a "could not connect to Postgres" message, and never listens, so the route never starts.
[^auth-warm]: The program, `chunk-p47p1nn1.js:37141`. Run: with the real sign-in in a temporary `HOME`, `CLAUDE_CODE_REMOTE=1`, `CLAUDE_CODE_ENTRYPOINT=remote_cowork`, `DISABLE_TELEMETRY=1`, and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` unset, one `-p` turn sent `GET /v1/me` (answer 404, which the program counts as a passed check) before `POST /v1/messages`. With `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1`, the same run sent no `/v1/me`. Probe case `live.api319.auth-warm`.
[^runner-runs]: The program, `chunk-e8yeh7g4.js:10144` (register `chunk-e8yeh7g4.js:10225`, poll `chunk-e8yeh7g4.js:12245`, spawn-hints poll `chunk-e8yeh7g4.js:10583`, spawn-hints nack `chunk-e8yeh7g4.js:11644`, report `chunk-e8yeh7g4.js:14018`, release `chunk-e8yeh7g4.js:14521`, deregister `chunk-e8yeh7g4.js:15071`, refresh `chunk-e8yeh7g4.js:15404`), and the release probe cases `env319b.runner.*` and `env319b.orchestrator.*`.
[^reg]: Probe case `env319b.runner.base` made this the first call. The run used the runner ID `runner-probe`.
[^retire]: Probe case `env319b.runner.retire-at`.
[^report-fail]: Probe cases `env319b.runner.child-exits-1` and `env319b.runner.child-exits-0`.
[^spawn-poll]: Probe case `env319b.orchestrator.reason-set` used only this path.
[^nack]: Probe case `env319b.orchestrator.hook-fails`.
[^refresh]: Probe case `env319b.runner.token-ttl-8`.
[^signin-paths]: The program. The paths are strings in the program code, for example `chunk-bqztnpjh.js:8455` (bootstrap), `chunk-rd5tcjx6.js:28444` (metrics), `chunk-asj6f58y.js:359763` (profile), `chunk-seq3br5j.js:10463` (trusted devices), `chunk-asj6f58y.js:363576` (validate), `chunk-jp340sez.js:17848` (file upload), `chunk-w4a21zqk.js:13807` (local pairing) and `chunk-v03c8cf5.js:28077` (hello).
[^org-pin]: The program, read sites `chunk-asj6f58y.js:361866` (the call) and `chunk-asj6f58y.js:686790` (the check). Run with the real sign-in in a temporary `HOME`. Probe case `live.api319.org-pin`.
[^file-upload]: The program, `chunk-hq2rt42h.js:3004`.
[^host-req]: The program, client `chunk-cw9a0k5b.js:10609`, caller `chunk-0tqcm9e3.js:38625`.
[^host-result]: The program, `chunk-cw9a0k5b.js:11300`, `chunk-0tqcm9e3.js:41016`.
[^consents]: The program, `chunk-swqbc88x.js:20866` (the `PUT`), `chunk-swqbc88x.js:21126` (the `POST`), and `chunk-swqbc88x.js:18824` (the type and the entry points). The type is in `2.1.325` and not in `2.1.323`.
[^checkup]: The program, read site `chunk-pmrfk28m.js:7382` (the path is the constant at `chunk-pmrfk28m.js:5478`). The gate is `tengu_quiet_almanac`.
[^oauth-config]: The program, `chunk-p5kfs9w9.js:1561` (the production config) and `chunk-p5kfs9w9.js:3869` (the `CLAUDE_CODE_CUSTOM_OAUTH_URL` check).
[^dir-urls]: The program, `chunk-asj6f58y.js:981984`.
[^billing]: The program, `chunk-m14bt1pz.js:2021886` and `chunk-m14bt1pz.js:1910654`.
[^provenance-paths]: The program, read sites `chunk-re437d7z.js:1153` and `chunk-re437d7z.js:1307`. In the run `print.api319.beta.provenance.fake-key` (first-party stub URL, one MCP server) the only request path was `/v1/messages?beta=true`. In the live runs `live.api319.provenance` and `live.api319.startup` (real sign-in, nonessential traffic on) the program made no call to these paths or to `/v1/code`. Startup calls were `/api/claude_code/policy_limits`, `/api/claude_code/settings`, `/api/claude_cli/bootstrap`, and `/mcp-registry/v0/servers`.
[^platform-plugin]: The program, `chunk-5hejrm7d.js:673` (the server) and `chunk-5hejrm7d.js:689` (the checks).
[^attr-fields]: The program, `chunk-asj6f58y.js:1005400`.
