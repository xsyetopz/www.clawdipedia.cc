---
title: What Changed
description: What changed in Claude Code 2.1.323, the release this site covers, against 2.1.322, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.323`, the release this site covers, against `2.1.322`, the release before it.
It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.323`, the version shown in the navbar.

## Version 2.1.323

Sources: the release notes of [`2.1.323`](https://github.com/anthropics/claude-code/releases/tag/v2.1.323), and a comparison of the `2.1.322` and `2.1.323` programs. A row lists only what the program or a probe confirmed. Rows marked with the program, or with a case id, come from the program and not from the release notes. The notes items for VS Code, the web, cloud sessions, and Remote Control are not on this site.

### Plugins and Mods

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `engines["claude-code"]` in `plugin.json` | <Documented /> | A plugin outside its stated version range is not installed, updated, or loaded. Install and update pick the newest version that fits. | [Plugin Manifest](../extend/plugins/manifest.md#top-level-keys) |
| `claude plugin validate` checks more | <Documented /> | It type-checks a TypeScript hooks module (a warning; `--strict` fails on it), lists the `$` nouns that `engine.create` adds, withholds, or replaces, and fails a mod whose `engine.create` hook is not in the accepted form. | [Plugin CLI](../extend/plugins/cli.md#subcommands) |
| `engine.create` by name only | <Documented /> | A `*`, namespace, or negated hook on `engine.create` only observes. To add or withhold a noun, hook `engine.create` by name. | [Plugin and Engine](../extend/mod-api/calls/plugin.md#events) |
| `unsetOptionCount` in `claude plugin install --json` | <Documented /> | The result counts the `userConfig` options that are not set yet (cases `print.cli323.plugin-install-json`, `.plugin-install-config-one`). | [Plugin CLI](../extend/plugins/cli.md#subcommands) |
| `isPromptCovered` pane prop | <Documented /> | A mod's pane learns when a dialog or a field covers the prompt. | [UI Elements](../extend/mod-api/ui/ui-elements.md) |
| A plugin's `agent` setting is deprecated | <Documented /> | It still applies. It now warns at startup, in `claude plugin list`, and in `claude plugin validate`. | [Plugin Manifest](../extend/plugins/manifest.md#top-level-keys) |
| Plugin load and install errors | <Documented /> | A plugin that only a repository's settings enable now says it is not installed. A failed language server names itself. A git submodule off its recorded commit fails the install. A version list in `enabledPlugins` says why the plugin stays off. | [Plugin Loading](../extend/plugins/loading.md#errors), [Marketplace](../extend/plugins/marketplace.md#errors) |
| Marketplace names `npm`, `pip`, `uv`, `cargo`, `github`, `gh` | <Documented /> | These names are no longer refused as reserved. One bad entry in `renames` no longer hides the other renames. | [Marketplace](../extend/plugins/marketplace.md#top-level-keys) |
| `.mcp.json` approvals match the exact name | <Documented /> | An approval written in another spelling asks again. | [MCP and Channels Settings](../configure/settings/mcp-and-channels.md) |
| `/mcp` shows left-out tools | <Documented /> | It counts the tools of a server that the API would refuse for their input schema, and says why. | [MCP Runtime](../extend/mcp/runtime.md) |
| `MCP_SDK_GENERATION=v1` | <Differs /> | It now runs the v2 MCP client in a compatibility mode. The v1 client is gone. | [Plugins and MCP Variables](../configure/env-vars/plugins-and-mcp.md) |
| `cli323` probe group | <Undocumented /> | Release probes for `unsetOptionCount`, `claude workspace-trust`, `subagentStatusLine`, and the `claude mcp add --help` examples. | [Release Probes](../reference/probes.md) |

### Settings, Permissions, and Startup

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `subagentStatusLine` removed | <Differs /> | The key has no effect. A settings file that holds it still loads, also with a wrong type (cases `print.cli323.subagent-status-line-*`). | [Status Line](../configure/status-line.md) |
| `permissions.blockFileToolReadsOutsideWorkingDirectories` | <Undocumented /> | A new nested setting key (the program). A refused file reference names the setting that blocked it. | [Permission Rules](../configure/permissions/rules.md#the-permissions-keys), [File Tools](../reference/tools/files.md#errors) |
| Start-up warning for `*` in a variable value | <Documented /> | A Bash allow rule such as `Bash(PORT=* npm run dev)` gives a warning at start-up. | [Permission Flow](../how-it-works/permission-flow.md#the-order-of-checks) |
| Bash permission fixes | <Documented /> | Several Bash rule cases now ask: attached wildcards, `sudo` and `env` wrappers, combined `sudo` flags, and writes to `.git` or `.claude`. | [Permission Rules](../configure/permissions/rules.md#rule-syntax) |
| Auto mode falls back to Manual | <Documented /> | When auto mode is not available, `--permission-mode auto` and `defaultMode: auto` start in Manual mode. | [Permission Modes](../configure/permissions/modes.md#choosing-and-cycling-a-mode) |
| `plansDirectory` stays in the project | <Documented /> | A plan write that the program cannot show to stay inside the project is refused. | [Core Settings](../configure/settings/core.md) |
| "Don't ask again" for secrets | <Documented /> | An allow rule that seems to hold a secret, or that would go to a `settings.local.json` that git tracks, lasts for the session only. | [Permission Rules](../configure/permissions/rules.md) |
| Settings files and managed settings | <Documented /> | A settings write reads the file from disk first. Start-up reads a managed settings file a second time when the first read fails. `.claude/settings.local.json` is ignored globally also outside a git repository. | [Settings Files and Scopes](../configure/settings/index.md#where-settings-live) |
| `cleanupPeriodDays` errors | <Documented /> | The cleanup counts a folder it cannot read as an error. | [Core Settings](../configure/settings/core.md) |
| `clawdFileProgressEnabled`, `precomputeArmTokens` | <Undocumented /> | Two new settings in the program. | [UI Settings](../configure/settings/ui.md), [Core Settings](../configure/settings/core.md) |
| Misspelled keybinding modifiers | <Documented /> | A binding such as `ctl+k` is ignored. It no longer binds the bare key. | [Keybindings](../configure/keybindings/index.md) |

### CLI, Sessions, and Accounts

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `claude workspace-trust --json` | <Undocumented /> | A hidden command that reports whether the folder holds a saved workspace trust record. `--ignore-persisted-trust` counts only before the subcommand (cases `print.cli323.workspace-trust-*`). | [Subcommands](../configure/cli/subcommands.md) |
| `claude drop-worktree-registrations` and `claude plugin install --registry` | <Differs /> | The program no longer has them. | [Subcommands](../configure/cli/subcommands.md) |
| `claude rm` wording | <Documented /> | It says the session is removed from the list, not deleted. `claude --resume` still lists it. | [Subcommands](../configure/cli/subcommands.md) |
| Ended claude.ai login warning | <Undocumented /> | The print-mode warning now says that `claude auth logout` also removes saved MCP server logins and plugin secrets. The warning itself was already in `2.1.322`. | [Subcommands](../configure/cli/subcommands.md#errors) |
| `/usage` flags long sessions | <Documented /> | `/usage` names sessions with requests in 8 or more separate hours, and `f` starts a fix for them. | [How `/usage` and `/artifacts` Work](../extend/skills-and-commands/slash-commands.md#how-usage-and-artifacts-work) |
| `/terminal-setup` and `/diff` texts | <Documented /> | After setup on Terminal.app, a note says which characters the Option key no longer types and how to undo it. The `/diff` panel says `/diff to close`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/stickers` checks availability | <Differs /> | The command checks whether stickers are available. It no longer orders them. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#account-cloud-and-other-commands) |
| `/team-onboarding` gate | <Gated note="Flag tengu_logical_nebula." /> | The command is hidden when the server turns the flag off. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#account-cloud-and-other-commands) |
| Self-hosted runner exit code | <Documented /> | A superseded on-demand runner exits with `1` again. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md) |
| Claude in Chrome setup | <Documented /> | Setup tells you to restart with `claude --chrome --resume`, not to run `/chrome`. | [Flags](../configure/cli/flags.md) |
| Usage limit menu | <Documented /> | At a usage limit, a menu offers usage credits, an upgrade, or a stop. When the current spend limit cannot load, the menu does not offer a lower limit. | [Account and Access](../how-it-works/account-and-access.md#the-usage-limit-menu) |
| New environment variables | <Documented /> | `CLAUDE_CODE_PERFORCE_MODE` gets a one-time notice, `CLAUDE_CODE_RESUME_HINT_COMMAND` names a host's resume command, and `CLAUDE_CODE_AUTOMOUNT_ROOTS` names autofs map roots on Linux. | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md), [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md) |
| `CLAUDE_CODE_HOOK_HEARTBEAT_INTERVAL_MS` | <Undocumented /> | Sets the hook heartbeat interval, 100 to 30000 ms. The heartbeat itself is in the release notes. | [SDK and Automation Variables](../configure/env-vars/sdk-and-automation.md) |

### Models, Network, and Telemetry

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Unknown model IDs get 1M context | <Differs /> | The program assumes 1M, not 200K. Set `CLAUDE_CODE_DISABLE_1M_CONTEXT=1` to keep 200K. | [Model Catalog](../configure/models-and-providers/model-catalog.md) |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` accepts up to 300000 | <Documented /> | You can set a longer wait after a `529`. | [Fallback and Retries](../configure/models-and-providers/effort-thinking-and-fallback.md#fallback-and-retries) |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_WAIT_MS` | <Undocumented /> | A new variable behind `tengu_steady_heron`, 300000 to 3600000, read by the main thread only (the program). | [Fallback and Retries](../configure/models-and-providers/effort-thinking-and-fallback.md#fallback-and-retries) |
| `ALL_PROXY` and organization requests | <Differs /> | Organization settings and policy requests no longer use a proxy set only by `ALL_PROXY`. Set `HTTPS_PROXY`. | [System and Third-Party Variables](../configure/env-vars/system-and-third-party.md) |
| Certificate name-constraint errors | <Documented /> | The message says what to fix. | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#certificate-name-constraint-errors) |
| OpenTelemetry export | <Documented /> | An `otlp` exporter with no protocol uses `http/protobuf`. The default `localhost:4318` endpoint skips the proxy. One bad `OTEL_RESOURCE_ATTRIBUTES` entry no longer drops the others. The export timeout is at most 25 seconds. | [OpenTelemetry](../reference/opentelemetry.md#export-behavior) |
| Hook and stream fields | <Documented /> | Compaction hooks of a subagent get `agent_id` and `agent_type`. Long hooks in print mode send `tool_progress` heartbeats. | [Hook Input and Output](../extend/hooks/input-and-output.md), [Stream JSON](../extend/headless/stream-json.md) |
| Code Mode | <Documented /> | An experimental opt-in in which Claude writes JavaScript to call its tools. | [Gated and Other Tools](../reference/tools/gated-and-other.md#code-mode) |
| Tool error texts | <Undocumented /> | `ExitWorktree` can stop before it changes anything. Worktree creation refuses link-based checkouts. A subagent stopped by safeguards gets new text. WebFetch checks its switch and the `allow_web_fetch` policy again at call time. | [File Tools](../reference/tools/files.md#errors), [Agents and Tasks](../reference/tools/agents-and-tasks.md#errors), [Subagent Runtime](../extend/subagents/runtime.md#limits-and-switches), [Shell and Web Tools](../reference/tools/shell-and-web.md#errors) |

The comparison of the two programs also lists 163 added and 39 removed gates, 69 added and 29 removed error texts, and one removed environment variable, `CLAUDE_CODE_GB_REFRESH_INTERVAL_MS`. [Surface Coverage](../reference/surface-coverage.md) maps each name to its page.

## Earlier Releases

This site keeps no page for an older release. The official [Changelog](https://code.claude.com/docs/en/changelog) lists every release.

## Example

You update to `2.1.323` and keep `subagentStatusLine` in your settings.
The file still loads, and subagent rows use the default look.
Check that your file loads with no error:

```bash
claude --version
claude -p --settings '{"subagentStatusLine":{"type":"command","command":"echo hi"}}' "Reply with 'OK'."
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
