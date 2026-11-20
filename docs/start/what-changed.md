---
title: What Changed
description: What Claude Code 2.1.329, the release this site covers, changes against 2.1.328, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.329`, the release this site covers, against `2.1.328`, the release before it.
It lists nothing older. It is short on purpose. Each row rests on the program code and cites it in a footnote.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.329`, the version shown in the navbar.

## Version 2.1.329

Sources: the program, and the entry for `2.1.329` in the official [Changelog](https://code.claude.com/docs/en/changelog) as a second source. Each row states what the program code shows. A row is marked <Documented /> when that changelog entry states the same change. Items about other products (such as VS Code, Claude Desktop, and Remote Control), and fixes with no setting, key, or text that a page states, are not on this page.

### Permissions, Hooks, and Settings

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Trust dialog hooks warning | <Documented /> | The trust dialog now warns "This folder configures hooks that can run commands without asking, declared in" and lists the files.[^trust-hooks] | [Hook Configuration](../extend/hooks/configuration.md#settings-keys-and-trust) |
| Managed hooks that fail to load | <Documented /> | A warning in the conversation says "Some checks your organization set up (hooks) did not load, so they are not running in this session". It does not show when managed settings set `disableAllHooks`.[^managed-hooks] | [Hook Configuration](../extend/hooks/configuration.md#settings-keys-and-trust) |
| `PreToolUse` hooks in Code Mode | <Documented /> | A hook that errors no longer refuses a tool call from a script. Set `"onFailure": "block"` on a hook that must refuse.[^code-mode-hooks] | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#code-mode) |
| `background_tasks` in `Stop` hooks | <Documented /> | A Monitor script has the `type` `monitor`, not `shell`.[^bg-type] | [Session Events](../extend/hooks/session-events.md#stop) |
| `rm` of a symbolic link | <Documented /> | The safety check says "rm removes the link, not what it points to". The auto mode classifier can approve it, so auto mode does not ask you first.[^rm-symlink] | [Permission Flow](../how-it-works/permission-flow.md#symlink-removal) |
| `/auto-mode-setup` | <Documented /> | The scan now counts denial reasons that hold brackets, parentheses, slashes, or `&`. It can offer `allow` rules from recent denials.[^setup-denials] | [Auto Mode](../configure/permissions/auto-mode.md#auto-mode-setup-without-the-dialog) |
| `/sandbox` on Linux | <Documented /> | The panel warns "allowUnixSockets has no effect in the Linux sandbox" and no longer lists those entries as allowed.[^sandbox-unix] | [Sandbox](../configure/permissions/sandbox.md#core-keys) |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` removal | <Documented /> | When you remove the variable from settings `env` in a running session, Claude Code puts it back to its startup value, or removes it.[^pct-put-back] | [Context and Compaction Variables](../configure/env-vars/context-and-compaction.md#variables) |
| `cleanupPeriodDays` with managed settings | <Undocumented /> | When the program did not read managed settings in full, it skips the cleanup of old sessions. The debug log says "Skipping retention cleanup".[^cleanup-managed] | [Core Settings](../configure/settings/core.md#keys) |
| `/status` "Marketplace auto-update" row | <Documented /> | `/status` names each managed marketplace that gets no automatic updates, with the reason.[^status-marketplace] | [Marketplace](../extend/plugins/marketplace.md#settings-keys) |
| `additionalDirectoryConfigRoots` | <Undocumented /> | A host-only setting. It maps an added folder to the checkout whose `.claude` files that folder reads.[^dir-config-roots] | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) |
| `desktopMcpServersListScope` | <Undocumented /> | A managed-only key. It sets which tabs of the desktop app the MCP allow list and deny list govern. The CLI reads no value from it.[^desktop-mcp-scope] | [MCP and Channels Settings](../configure/settings/mcp-and-channels.md#keys) |
| `permissions.workingDirectoriesExclude` | <Undocumented /> | A host-only list of absolute paths. The three `block...OutsideWorkingDirectories` settings treat each path as outside every working directory. Claude Code ignores a relative path.[^wd-exclude] | [Permission Rules](../configure/permissions/rules.md#the-permissions-keys) |

### Skills and Slash Commands

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `/tasks` panel | <Documented /> | The panel adds sections for scheduled tasks, `/loop` wakeups, the goal, and forks. Press `x` to stop an item. Claude Code asks first, for example "Stop the goal?".[^tasks-panel] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| "Exit and stop tasks" | <Documented /> | The exit dialog "Background work is running" offers "Exit and stop tasks". It also stops scheduled tasks.[^tasks-exit] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/teleport` | <Documented /> | The description reads "Resume a cloud session here". Picking a session starts a new session, as `/clear` does. The old session stays in `/resume`.[^teleport] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#account-cloud-and-other-commands) |
| `/clear` | <Undocumented /> | The description says "loops carry over" to the new session.[^clear-loops] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/config` notice | <Documented /> | After you close the panel, a notice lists each setting that you changed, such as `Set theme to <name>`.[^config-notice] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/status` model line | <Documented /> | With `opusplan` or `haiku`, the line also names the model that plan mode uses, "in plan mode".[^status-plan] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/terminal-setup` on macOS 27 | <Documented /> | On macOS 27 and later, it does not turn on "Use Option as Meta key" in Terminal.app. It says "Shift+Return will now enter a newline."[^terminal-27] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/mcp` "Server message" row | <Documented /> | When a server needs authentication and its refusal has a message, `/mcp` shows that message in a "Server message" row.[^server-message] | [MCP CLI](../extend/mcp/cli.md#the-mcp-command) |
| `/code-review` targets | <Documented /> | A pull request number or URL is read with `gh pr diff`. If that fails, `--fix` and URL reviews stop. With no target on most models, it reviews the whole branch with `git diff origin/HEAD...HEAD`.[^review-target] | [Bundled Skills](../extend/skills-and-commands/bundled-skills.md#skills) |
| `/loops` command | <Undocumented /> | The disabled `/loops` command is gone. Use `/loop`.[^loops] | [Use With Agents](use-with-agents.md) |

### Tools and Code Mode

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Code Mode and OpenTelemetry | <Documented /> | Telemetry alone no longer refuses Code Mode. It refuses only when OpenTelemetry tracing is on through `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, `ENABLE_ENHANCED_TELEMETRY_BETA`, or `ENABLE_BETA_TRACING_DETAILED`.[^code-mode-otel] | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#code-mode) |
| Code Mode server flag | <Documented /> | A missing server flag no longer refuses Code Mode. Only an explicit off does, with the text "Anthropic has turned it off for now".[^code-mode-flag] | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#code-mode) |
| `CronCreate` and sign-in | <Documented /> | A saved task runs only in a session signed in to the organization that made it. Otherwise Claude Code skips it and tells you.[^cron-signin] | [Agents and Tasks Tools](../reference/tools/agents-and-tasks.md#tools) |
| `effort` for teammates | <Documented /> | The `effort` of an `Agent` call now applies to a teammate in agent teams. Claude Code passes it as `--effort`.[^teammate-effort] | [Agents and Tasks Tools](../reference/tools/agents-and-tasks.md#agent-parameters) |
| `CLAUDE_CODE_NEW_RENDERER` gate | <Gated /> | The server gate that picks the new renderer by terminal is now `tengu_robust_pine`. The variable still wins over it.[^new-renderer] | [UI and Terminal Variables](../configure/env-vars/ui-and-terminal.md#variables) |

### Flags and Self-Hosted Runner

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `claude auth login --organization-gateway` | <Undocumented /> | A hidden flag. It signs you in to your organization's gateway through its identity provider. You cannot combine it with another sign-in option.[^org-gateway] | [Subcommands](../configure/cli/subcommands.md#commands) |
| `claude gateway` start-up notice | <Documented /> | The gateway always prints a notice at start: it can push settings that run commands on developer machines, so never expose it to the public internet.[^gw-notice] | [Subcommands](../configure/cli/subcommands.md#commands) |
| `--agents-view-if-allowed` | <Undocumented /> | A hidden flag that the program now reads. It opens the agent view as `claude agents` does, unless `CLAUDE_CODE_DISABLE_AGENT_VIEW` or `disableAgentView` turns the agent view off. Then you get a normal session.[^agents-view-flag] | [Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) |
| `-n, --name` | <Undocumented /> | The name also names a new cloud session.[^name-cloud] | [Flags](../configure/cli/flags.md#sessions-and-worktrees) |
| `--repository-folder` | <Documented /> | At `--capacity 1`, a folder may lie in the base folder, with exceptions. Above 1, a folder there stops start-up.[^repo-folder] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options) |
| `--agent-proxy-url` check | <Undocumented /> | The runner tries for 5 seconds to connect to the proxy and complete a TLS handshake. `SELF_HOSTED_RUNNER_SKIP_AGENT_PROXY_CHECK=1` skips the check.[^skip-proxy] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#connection-options) |

### Environment Variables

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `CLAUDE_CODE_LINKED_SPINDLE` | <Undocumented /> | Set it to a false value so a subagent's effort step cannot reach the maximum level.[^spindle] | [Models and Effort Variables](../configure/env-vars/models-and-effort.md#variables) |
| `CLAUDE_CODE_AUTOUPDATER_DISABLED_BY_HOST` | <Undocumented /> | The new value `managed` makes plugin auto-update follow only the `autoUpdate` value in managed settings.[^autoupd-host] | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| `CLAUDE_RUNNER_DISABLE_START_HEARTBEATS` | <Undocumented /> | A true value stops the runner from sending start-up heartbeats while it prepares a session.[^runner-hb] | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |

### API, Account, and Request Behavior

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Output limit retry | <Differs /> | Claude Code no longer reads a limit from a `max_tokens` error. A refused request on an unrecognized model is resent once with 32,000 output tokens. Behind a gateway whose model takes fewer, set `CLAUDE_CODE_MAX_OUTPUT_TOKENS`.[^max-tokens] | [Request and Cache](../how-it-works/request-and-cache.md#output-limit-retry) |
| Keychain write test | <Documented /> | Before it renews the login on macOS, Claude Code tests that the Keychain takes a write, with an item named `Claude Code-write-check`. A refusal shows "Could not refresh your login: can't save to the Keychain".[^keychain-write] | [Account and Access](../how-it-works/account-and-access.md#where-claude-code-keeps-it) |
| Managed settings from an organization sign-in | <Undocumented /> | With an organization sign-in, Claude Code reads remote managed settings from `/v1/desktop/orgs/${…}/claude_code/bootstrap`. With any other credential it sends no request.[^hybrid-settings] | [Endpoints](../reference/api/endpoints.md#account-and-service-endpoints) |

### Mod API Calls

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `agent.report` | <Undocumented /> | A new event on `$.agent`. A hook can rewrite a subagent's report, or hold it back with `consumed`, before the parent gets it.[^agent-report] | [Agent](../extend/mod-api/calls/agent.md#engine-events) |

## Example

In `2.1.329`, Claude Code no longer reads a limit from a `max_tokens` error.
Behind a gateway whose model takes fewer output tokens, check the version, then set the limit for one run:

```bash
claude --version
CLAUDE_CODE_MAX_OUTPUT_TOKENS=<limit> claude
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)

## Sources

[^trust-hooks]: The program, `chunk-5tx611sw.js:1140` (the warning text).
[^managed-hooks]: The program, `chunk-6dccy31z.js:3683` (the warning text) and `chunk-6dccy31z.js:3664` (the `disableAllHooks` check).
[^code-mode-hooks]: The program, `chunk-hg1yqkjk.js:267214` (the `failuresToo` check) and `chunk-hg1yqkjk.js:73677` (the `onFailure` test).
[^bg-type]: The program, `chunk-496v3ed2.js:112` (the "monitor" label) and `chunk-496v3ed2.js:97` (`local_bash: "shell"`).
[^rm-symlink]: The program, `chunk-me64k7yy.js:684` (the reason text) and `chunk-me64k7yy.js:685` (`classifierApprovable`).
[^setup-denials]: The program, `chunk-vxsgd0n6.js:2054` (the list "Recent auto-mode denial reasons") and `chunk-vxsgd0n6.js:1887` (the pattern that reads the reasons).
[^sandbox-unix]: The program, `chunk-3yadgh2z.js:817` (the warning text).
[^pct-put-back]: The program, `chunk-tsby2qjm.js:1934` (the debug text "put back to its startup value, or removed").
[^cleanup-managed]: The program, `chunk-2xccqdyk.js:429` (the skip text).
[^status-marketplace]: The program, `chunk-tfqdysxa.js:170` (the "Marketplace auto-update" row label) and `chunk-tfqdysxa.js:132` (the four reasons).
[^dir-config-roots]: The program, `chunk-c9fmfd5h.js:379` (the check of `additionalDirectoryConfigRoots`).
[^desktop-mcp-scope]: The program, `chunk-t39fw2cy.js:8719` (the `desktopMcpServersListScope` schema text).
[^wd-exclude]: The program, `chunk-mtcj8wbs.js:1347` (the ignored-entry text for `permissions.workingDirectoriesExclude`).
[^tasks-panel]: The program, `chunk-zs9k1w9q.js:52281` ("Stop this scheduled task?", "Stop the goal?", "Stop this fork?") and `chunk-jhjdqtx5.js:80` (the "scheduled task" count text).
[^tasks-exit]: The program, `chunk-zs9k1w9q.js:117129` ("Exit and stop tasks") and `chunk-zs9k1w9q.js:117057` ("Background work is running").
[^teleport]: The program, `chunk-hg1yqkjk.js:178033` (the description "Resume a cloud session here") and `chunk-bjya12sm.js:94` (`clearConversation` before the pull) and `chunk-bjya12sm.js:326` (the picker text about `/resume`).
[^clear-loops]: The program, `chunk-hg1yqkjk.js:175946` (the description "loops carry over, and the old one stays in /resume").
[^config-notice]: The program, `chunk-vxkg9ahh.js:1326` (the `Set model to` text of a changed row) and `chunk-vxkg9ahh.js:2378` (`Set` and `to`).
[^status-plan]: The program, `chunk-fn9dv1zs.js:843` ("in plan mode") and `chunk-aq3ms068.js:22416` (`opusplan` and `haiku`).
[^terminal-27]: The program, `chunk-qqbf4af6.js:808` (the version test), `chunk-qqbf4af6.js:859` ("Use Option as Meta key"), and `chunk-qqbf4af6.js:870` ("Shift+Return will now enter a newline.").
[^server-message]: The program, `chunk-4g68nm9m.js:1680` (the "Server message" row) and `chunk-w3gpg1a5.js:6626` (`serverMessage` from the error body).
[^review-target]: The program, `chunk-z758pdbe.js:2599` (`gh pr diff`), `chunk-z758pdbe.js:2619` (the "was refused or failed" rule), and `chunk-z758pdbe.js:1554` (`git diff origin/HEAD...HEAD`).
[^loops]: The program, `chunk-hg1yqkjk.js:42858` (the `/loop` command name that remains). In `2.1.328`, `/loops` was a command with `isEnabled` always false. A search of `2.1.329` finds no command of that name.
[^code-mode-otel]: The program, `chunk-3y52b1p1.js:215` (the `otel` refusal) and `chunk-mjpt6p5c.js:73` (its text "OpenTelemetry tracing is on").
[^code-mode-flag]: The program, `chunk-3y52b1p1.js:200` (`$dd7fc8`, true only when the flag `tengu_rustling_blossom` is not true, default true) and `chunk-mjpt6p5c.js:95` ("Anthropic has turned it off for now").
[^cron-signin]: The program, `chunk-8mhvfm0f.js:804` (the "Skipped" notice for scheduled tasks) and `chunk-44sty588.js:363` (`createdUnderSignIn`).
[^teammate-effort]: The program, `chunk-2ry3tbza.js:1858` (the `effort` value goes to `spawnTeammate`) and `chunk-a4sw59pz.js:871` (the `--effort` argument of a pane teammate).
[^new-renderer]: The program, `chunk-0b3aev3g.js:26370` (the gate `tengu_robust_pine`, which was `tengu_functional_pebble` in `2.1.328`).
[^org-gateway]: The program, `chunk-rwevfvv3.js:2116` (the hidden `--organization-gateway` option and help text) and `chunk-f5q1yhhc.js:836` (the text "can't be used with another sign-in option").
[^gw-notice]: The program, `chunk-v9ek375d.js:47` (the notice text).
[^agents-view-flag]: The program, `chunk-txash88y.js:3972` (`agentsViewIfAllowed` and `agentsCommandHandler`) and `chunk-wtmc4k02.js:13` (the `CLAUDE_CODE_DISABLE_AGENT_VIEW` and `disableAgentView` checks). `2.1.328` has no reader of the flag.
[^name-cloud]: The program, `chunk-txash88y.js:3882` (the help text "Also names a new cloud session.").
[^repo-folder]: The program, `chunk-3kp5jwr6.js:3868` (the `--repository-folder` error text) and `chunk-3kp5jwr6.js:4000` (the error above `--capacity` 1).
[^skip-proxy]: The program, `chunk-3kp5jwr6.js:16609` (the help text of `SELF_HOSTED_RUNNER_SKIP_AGENT_PROXY_CHECK`) and `chunk-3kp5jwr6.js:4939` (the variable).
[^spindle]: The program, `chunk-2ry3tbza.js:2187` (`CLAUDE_CODE_LINKED_SPINDLE` sets `mayReachMax`).
[^autoupd-host]: The program, `chunk-aq3ms068.js:6325` (the `managed` value of `CLAUDE_CODE_AUTOUPDATER_DISABLED_BY_HOST`) and `chunk-hg1yqkjk.js:226529` (plugin auto-update).
[^runner-hb]: The program, `chunk-3kp5jwr6.js:10706` (the `CLAUDE_RUNNER_DISABLE_START_HEARTBEATS` check).
[^max-tokens]: The program, `chunk-hg1yqkjk.js:154443` (`lowerAfter` resends once with the cap), `chunk-hg1yqkjk.js:167204` (the call site), `chunk-aq3ms068.js:24313` (the unrecognized-model check with `CLAUDE_CODE_MAX_OUTPUT_TOKENS`).
[^keychain-write]: The program, `chunk-f7vjj23d.js:277` (the item name `Claude Code-write-check`) and `chunk-hg1yqkjk.js:118548` ("Could not refresh your login: can't save to the Keychain").
[^hybrid-settings]: The program, `chunk-76049qf7.js:78` (the `claude_code/bootstrap` path) and `chunk-7vfh1k4y.js:1281` ("Remote settings: request not sent").
[^agent-report]: The program, `chunk-nxwpaxwj.js:6265` (the hook raise and "not delivered") and `chunk-qsd8sbe8.js:9211` (the checked `consumed` field).
