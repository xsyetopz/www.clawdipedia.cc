---
title: What Changed
description: What changed in Claude Code 2.1.319, the release this site covers, against 2.1.316, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.319`, the release this site covers, against `2.1.316`, the release before it.
It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.319`, the version shown in the navbar.

## Version 2.1.319

Sources: the release notes of [`2.1.317`](https://github.com/anthropics/claude-code/releases/tag/v2.1.317) (November 3, 2026), [`2.1.318`](https://github.com/anthropics/claude-code/releases/tag/v2.1.318) (November 4, 2026), and [`2.1.319`](https://github.com/anthropics/claude-code/releases/tag/v2.1.319) (November 6, 2026), and a comparison of the `2.1.316` and `2.1.319` programs.
The official [Changelog](https://code.claude.com/docs/en/changelog) ends at `2.1.318`, as of November 6, 2026. Rows marked with the program, or with a case id, come from the program and not from release notes.
In that comparison the hook events, models, OpenTelemetry events, permission rules, and files are the same in both versions.
The `ultrareview` command is not run live on this site. For its behavior, read the official [Ultrareview](https://code.claude.com/docs/en/ultrareview) page.

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `claude mcp add --web` | <Undocumented /> <Gated /> | A new flag that adds the server as a claude.ai connector, not to the local config. A build without the gate `tengu_twinkling_aurora` answers `--web isn't available yet` and exits with code 1 (case `print.cli319.mcp-add-web`). | [MCP CLI](../extend/mcp/cli.md) |
| `ultrareview --list`, `--max-cost`, `--output` | <Undocumented /> <Gated /> | Three hidden options of an eval mode that the gate `tengu_review_bughunter_config.eval_enabled` controls. Without it the program exits with code 1 and `error: unknown option` (cases `print.cli319.ultrareview-*`). The [official page](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively) does not list them. | [Subcommands](../configure/cli/subcommands.md#ultrareview-eval-flags) |
| `/project` and `/use-case` | <Undocumented /> <Gated /> | New slash commands. `/project` sets the claude.ai Project that the session names in usage reports. `/use-case` chooses the Life Sciences use case. Both need a claude.ai login and a server flag (cases `pty.cli319.slash.project` and `.use-case`). | [Slash Commands](../extend/skills-and-commands/slash-commands.md) |
| `/claim-credit` and `/memory-types` | <Undocumented /> | The program no longer registers either command. The name `memory-types` stays in the fixed list of bundled skills that remain when `allow_bundled_skills` is not granted. | [Slash Commands](../extend/skills-and-commands/slash-commands.md), [Bundled Skills](../extend/skills-and-commands/bundled-skills.md) |
| `/upgrade` text | <Undocumented /> <Gated /> | The description now reads `Upgrade your plan for higher rate limits and more Opus`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md) |
| `disableReplyCheck` | <Undocumented /> | A managed setting that turns off the reply check in Claude Tag sessions on a self-hosted runner. It is not a hook, so `disableAllHooks` does not affect it. | [Enterprise Settings](../configure/settings/enterprise.md) |
| `disableWindowsBashCommandSplit` | <Undocumented /> | A managed setting for Windows. `true` keeps each Bash command in one argument to bash, for endpoint security tools that match text in process command lines. | [Enterprise Settings](../configure/settings/enterprise.md) |
| Changed setting text | <Documented /> | `attributionProject` also takes IDs that start with `chan_`. `sshHostCommands` is no longer limited to macOS and Linux in its text. `cleanupPeriodDays` and `pluginSuggestionMarketplaces` have new schema text. | [Core Settings](../configure/settings/core.md), [Agents and Remote](../configure/settings/agents-and-remote.md), [Hooks and Plugins](../configure/settings/hooks-and-plugins.md) |
| `$.theme.set` and `$.theme.clear` | <Undocumented /> | New Mod API calls with the events `theme.set` and `theme.clear`. The one attribute is `backdrop`. A `-p` run draws nothing and reports `isDrawn: false` (case `print.cli319.theme.engine`). | [UI Calls](../extend/mod-api/ui/ui.md), [UI Events](../extend/mod-api/ui/ui-events.md) |
| `SessionTabs` and `app:closeSession` | <Gated /> | A new keybinding context and action, with no default key. A plain terminal session never makes the context active (cases `pty.cli319.keybinding.*`). | [Unbound and Reserved](../configure/keybindings/unbound-and-reserved.md) |
| Four new betas | <Undocumented /> | `tool-provenance-2026-10-26`, `program-use-case-ids-2026-09-17`, and `claude-code-side-query-2026-09-29` are sent by the client under conditions. `request-tags-2026-08-21` is for the `claude gateway` server only: with `admin.billing_group_tag` set, the gateway removes the beta and the `tags` field before it sends the request upstream (cases `print.api319.gateway.request-tags-*`, which need Docker). `2.1.316` refuses `admin.billing_group_tag` at start (`Unrecognized key(s)`). | [API Betas](../reference/api/betas.md) |
| Cost route of the gateway | <Undocumented /> | `GET /v1/organizations/analytics/cost` is a route of the `claude gateway` admin API. It reads past spend for a date range ([2.1.317 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.317)). | [API Endpoints and Headers](../reference/api/endpoints.md) |
| Gateway `assume_role` and `admin.identity_retention_days` | <Undocumented /> | `assume_role` on a `mantle` or `bedrock` upstream makes the gateway call `sts:AssumeRole` and sign upstream requests with the assumed key. A denied or unreachable STS call gives HTTP 502, and the gateway's own keys are not used instead. `identity_retention_days` is a number above 0 (default 90) that sets how long the daily record of IdP groups stays (cases `print.api319.gateway.assume-role-*` and `identity-retention-*`; the [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)). | [Subcommands](../configure/cli/subcommands.md#gateway-role-and-retention-options) |
| `effort` option of `$.model.fork` | <Undocumented /> | A mod can name `low`, `medium`, `high`, `xhigh`, or `max` for one fork. A model with per-turn effort gets the level in the request. The result reports the effort sent (cases `print.fork319.model-fork.*`; the [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)). | [Model, Audio, and MCP Calls](../extend/mod-api/calls/model-audio-mcp.md), [Model Types](../extend/mod-api/types/model.md) |
| `loginExpiresAt` and `credential_expires_at` | <Undocumented /> | `claude auth status` and the `result` of `claude -p` JSON give the end date of a stored claude.ai sign-in. The key is `null` or absent when the program has no such date. `claude -p` warns on stderr within 10 days of the end (cases `print.notes319.login-expiry.*`; the [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)). | [Subcommands](../configure/cli/subcommands.md#claude-auth-status-sign-in-date), [Stream JSON Messages](../extend/headless/stream-json.md#field-new-in-21318) |
| `anthropic.*` OpenTelemetry attributes | <Undocumented /> | `anthropic.provider`, `anthropic.custom_base_url`, `anthropic.plan`, and `anthropic.seat_type` are on metrics, logs, and traces. The last two need a claude.ai subscriber login (cases `print.notes319.otel-attrs.*`; the [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)). | [OpenTelemetry Events](../reference/opentelemetry.md#account-and-provider-attributes) |
| `NODE_EXTRA_CA_CERTS` file faults | <Documented /> | A file that is empty, is not PEM, or starts with a damaged certificate no longer stops every connection. The program uses the certificates it can read and warns on stderr. On `2.1.316`, a file that started with a damaged certificate left the run hanging (cases `print.cacerts319.extra-ca*`; the [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)). | [Network and Proxy](../configure/env-vars/network-and-proxy.md#node_extra_ca_certs-file-faults) |
| Other new endpoints | <Undocumented /> | `/v1/code`, `/api/oauth/org`, `/api/mcp/claude_ai`, `/api/cowork/widgets_mcp`, and `/v1/code/mcp/cowork`. `/api/oauth/org` serves the managed setting `forceLoginOrgUUID`. | [API Endpoints and Headers](../reference/api/endpoints.md) |
| New tools `WrapUp` and `ReadWidgetContext` | <Undocumented /> <Gated /> | `WrapUp` offers a next step when a turn ends and needs `CLAUDE_CODE_ENABLE_WRAP_UP` and a server flag. `ReadWidgetContext` reads what an MCP App view shares, in a remote, non-interactive run behind a server flag. | [Gated and Other Tools](../reference/tools/gated-and-other.md) |
| Code Mode and the REPL tool | <Undocumented /> <Gated /> | `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` is new. Code Mode needs an interactive terminal and the server flag `tengu_rustling_blossom`. No print run listed a REPL tool, and the live account had no such flag (cases `print.env319a.code-mode.*` and `live.code-mode`). | [Surface Coverage](../reference/surface-coverage.md) |
| `ExitPlanMode` and `AskUserQuestion` | <Documented /> | A session that is not a teammate now also turns `ExitPlanMode` off when `permissions.denyInsteadOfPrompting` is `true`. `AskUserQuestion` goes off with it (cases `print.api319.tool.exit-plan.*`). | [Agent and Task Tools](../reference/tools/agents-and-tasks.md) |
| Server-side auto mode check | <Documented /> | With no verdict from the server, auto mode refuses the action and shows `Auto mode can't check actions in this session`. A `-p` run stops with `Error: auto mode could not check some actions Claude tried` (case `print.err319.auto-mode-print-refused`). A `flagged` verdict fires `PermissionDenied`, and the hook can answer with `retry: true`. | [Auto Mode](../configure/permissions/auto-mode.md), [Hook Events](../extend/hooks/session-events.md) |
| Browser `shortcuts_list` and `shortcuts_execute` | <Undocumented /> | The built-in Chrome browser server no longer lists these two tools. A call gets `Unknown tool: shortcuts_list` with `isError: true`. On `2.1.316` the server lists both (case `print.cli319.chrome-tools.shortcuts_list` on both versions, which asks the server started with `--claude-in-chrome-mcp` for `tools/list`). | [Changelog](https://code.claude.com/docs/en/changelog) |
| Gateway `login_notice`, `admin.blocked_message`, `admin.pooled_conflict_rule`, `admin.pooled_priority_order` | <Documented /> <Undocumented /> | A sign-in notice on the device page and on the `/login` gateway sign-in screen (case `pty.cli319.gateway-login-notice.*`; `2.1.316` shows none), an own text for a blocked request, and the order in which pooled group budgets pay (cases `api319.gateway.*`; [2.1.319 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.319)). Only `blocked_message` is on the official page. | [Subcommands](../configure/cli/subcommands.md) |
| `CLAUDE_CODE_LOOP_KEEPALIVE` default | <Undocumented /> | Unset now follows a server flag whose default is off, so the `/loop` keepalive is off by default. `1` arms it, with a fallback wakeup of 1200 s. On `2.1.316`, unset armed it (cases `pty.cli319.loop-keepalive.*` on both versions). | [Agents and Teams](../configure/env-vars/agents-and-teams.md) |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` from settings | <Documented /> | When `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` is set, the program ignores this variable in a settings file `env` (cases `print.env319a.proxy-resolves-hosts-from-settings.*`). | [Network and Proxy](../configure/env-vars/network-and-proxy.md) |
| Auto mode server check with betas off | <Documented /> | `CLAUDE_CODE_AUTO_MODE_SERVER=1` keeps `safeguards` also with `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`. Then a reply with no verdict moves the session to the local classifier (cases `print.automode.classifier-server.*`). | [Auto Mode](../configure/permissions/auto-mode.md#the-server-side-check) |
| `CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND` | <Undocumented /> | Set `1` to keep MCP tool calls in the foreground instead of background tasks (cases `print.env319a.disable-mcp-task-background.*`). | [Plugins and MCP](../configure/env-vars/plugins-and-mcp.md) |
| `CLAUDE_CODE_DISABLE_NESTED_SESSION_ID` | <Documented /> | In a remote session, `claude -p` now gets its own session ID. Set `1` to share the ID of the remote session, as before ([2.1.317 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.317)). | [Sessions and Storage](../configure/env-vars/sessions-and-storage.md) |
| OpenTelemetry export timeouts | <Undocumented /> | `OTEL_EXPORTER_OTLP_TIMEOUT` and the three per-signal variables (`..._LOGS_`, `..._METRICS_`, `..._TRACES_TIMEOUT`) set the export timeout, `10000` ms by default and `30000` at most ([2.1.317 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.317)). | [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md) |
| `CLAUDE_CODE_CONFIG_LOCK_WAIT_MS` and `CLAUDE_RUNNER_SPAWN_REASON` | <Undocumented /> | The first sets how long `claude mcp add` and `remove` wait for a held config lock (case `env319a.config-lock-wait.*`; the [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318) say they now wait or exit with code 1). The second gives the spawn-runner hook the reason for a spawn request. | [Sessions and Storage](../configure/env-vars/sessions-and-storage.md), [Remote and Cloud Sessions](../configure/env-vars/remote-and-cloud-sessions.md) |
| Fifty-three new environment variables | <Undocumented /> | Each has a row, among them `CLAUDE_CODE_REPLY_GATE_POLICY`, `CLAUDE_CODE_DISABLE_FEATURE_FLAGS`, `CLAUDE_CODE_DISABLE_SUBAGENT_HANDBACK`, and `CLAUDE_GATEWAY_LOG_FORMAT`. Two are gone: `CLAUDE_CODE_LAZY_ENV_GETTERS` and `CLIPBOARD_NAPI_NODE_PATH`. `CLAUDE_CODE_MEMORY_PUSH_DELETE_MODE` gains the value `recorded`. A plugin eval run that grants Bash now hides the credential paths of many tools (case group `evalcreds`). | [Environment Variables](../configure/env-vars/index.md) |
| Error texts | <Undocumented /> | 90 new texts and 49 gone, each on the page the diff names. Examples: `Cannot change .mcp.json here` in a `connector-downloads` folder, and the `Logout failed` text when the config file cannot be cleared. | [Settings](../configure/settings/index.md), [CLI Flags](../configure/cli/flags.md) |
| Server gates | <Undocumented /> | 181 new and 29 gone. They are server-side flags that you cannot set. A page names a gate only where it changes a documented behavior. | [Undocumented Features](../reference/undocumented.md) |

The release notes list many more fixes. The site states one only after a check in the program or a probe, so a fix that no page here reaches is left out. The notes also list items for VS Code, Cloud sessions, the self-hosted runner, Claude Tag, Remote Control, and Code Review. This site does not cover them.

## Earlier Releases

This site keeps no page for an older release. The official [Changelog](https://code.claude.com/docs/en/changelog) lists every release.

## Example

You update to `2.1.319` and set `CLAUDE_CODE_DISABLE_NESTED_SESSION_ID=1` in a remote session.
A `claude -p` run in that session then uses the session ID of the remote session again.
Check the first row. Then check your version:

```bash
claude --version
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
