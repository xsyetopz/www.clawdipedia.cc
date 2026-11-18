---
title: What Changed
description: What changed in Claude Code 2.1.327, the release this site covers, against 2.1.326, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.327`, the release this site covers, against `2.1.326`, the release before it.
It lists nothing older. It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.327`, the version shown in the navbar.

## Version 2.1.327

Sources: the [release notes of `2.1.327`](https://github.com/anthropics/claude-code/releases/tag/v2.1.327), and a comparison of the `2.1.326` and `2.1.327` programs and Mod API type files. Each row states what the linked page states. The notes items for VS Code, the web, cloud sessions, Remote Control, and artifacts are not all on this site.

### Plugins and Mods

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `claude plugin eval` | <Documented /> | Its deny rules win over a plugin's permission hook. It flags each call that the hook let through where the eval's own check did not allow it. | [Plugin CLI](../extend/plugins/cli.md#how-it-works) |
| `--agents` and plugin agents | <Documented /> | Agents from `--agents` stay after plugins load or reload. A plugin's agent stays when you resume from the `--resume` picker. | [Plugin Loading](../extend/plugins/loading.md#how-it-works) |
| `$.model.complete` and `$.model.classify` | <Documented /> | When a usage limit applies, the call gets the API error at once. A mod must handle that error. | [Model, Audio, and MCP Calls](../extend/mod-api/calls/model-audio-mcp.md#members) |
| Code Mode and mods that hook tool calls | <Documented /> | Code Mode starts when a mod hooks `tool.call`. An administrator can still keep Code Mode off in managed settings. | [Tool, Command, and Config Calls](../extend/mod-api/calls/tool-command-config.md#members), [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#code-mode) |

### Mod API Type File

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `Tier` of an organization plugin | <Documented /> | A plugin from a marketplace with a remote source takes the organization tier when managed settings set it true in `enabledPlugins` and declare the marketplace in `extraKnownMarketplaces`. It no longer needs `prependPlugins` or `appendPlugins`. Those lists set only the order. | [Hook Types](../extend/mod-api/types/hooks.md#types-without-fields) |
| `consent` in `tool.call` | <Documented /> | It counts as the request of the user only for a call that answers a press, input, or pick on the plugin's own element. | [Tool Call Types](../extend/mod-api/types/tool-command-config/tool-calls.md#toolcallreserved) |

### Settings, Permissions, and Startup

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Managed settings checksum header | <Undocumented /> | Claude Code sends `x-claude-code-managed-settings-checksum` to a gateway when managed settings turn on the gateway hint headers. | [Enterprise Settings](../configure/settings/enterprise.md#approval-of-server-managed-settings), [Request Headers](../reference/api/endpoints.md#request-headers) |
| `attributionProject` | <Undocumented /> | Behind a Claude apps gateway whose admin sets `admin.billing_group_tag`, it can name one of your billing groups. | [Core Settings](../configure/settings/core.md#keys) |
| `autoCompactWindow` | <Documented /> | The window has no upper limit. The minimum is 100000 tokens. The same applies to `modelSettings.*.autoCompactWindow`. | [Core Settings](../configure/settings/core.md#keys) |
| `autoCompactOfferAnswer` and `autoCompactRaisedForLoad` | <Undocumented /> | These are new internal keys. The program reads them for the Claude Desktop auto-compact offer. | [Core Settings](../configure/settings/core.md#keys) |
| `allowNestedModelAccessUnderForceLogin` | <Undocumented /> | This new key is for self-hosted runner hosts. It lets a nested Claude Code use the runner's model access when managed settings set `forceLoginOrgUUID` or `forceLoginMethod`. | [Authentication Settings](../configure/settings/auth.md#keys) |
| `forceLoginMethod` set to `console` | <Documented /> | Two sign-in error messages no longer point you to the Claude subscription option. | [Authentication Settings](../configure/settings/auth.md#keys) |
| `claudeMdExcludes` on Windows | <Documented /> | A pattern also matches a path whose drive letter is in the other case. | [Core Settings](../configure/settings/core.md#keys) |
| `/config` notes and failed saves | <Documented /> | `/config` shows a note when other settings override a row. A change that fails to save shows a line under the prompt. | [Settings Files and Scopes](../configure/settings/index.md#which-value-wins) |
| `permissions.blockReadsOutsideWorkingDirectories` | <Documented /> | It asks about more `Bash` commands in `bypassPermissions` and auto modes, and denies some in auto mode. It refuses more `Bash` commands that name a path under a `Read` or `Edit` deny rule, where it used to ask. | [Permission Rules](../configure/permissions/rules.md#the-permissions-keys) |
| Path and prompt checks | <Undocumented /> | Path checks refuse some symbolic links. Some paths now ask. A `Bash` command with very long expanded variables is denied. On a permission prompt, the Down key stops at No. | [Permission Modes](../configure/permissions/modes.md#path-and-prompt-checks) |
| Auto mode allow rules | <Undocumented /> | Auto mode ignores more package-runner rules such as `Bash(pnpm dlx *)`, and `PowerShell(.\scripts\build.ps1 *)` rules are no longer ignored in error. | [Auto Mode](../configure/permissions/auto-mode.md#broad-allow-rules-in-auto-mode) |
| Billed classifier notice | <Undocumented /> | The notice says that an upcoming release removes the fallback. Each action the classifier would have checked will be asked about or denied. | [Auto Mode](../configure/permissions/auto-mode.md#classifier-billing-notice) |
| Sandbox | <Undocumented /> | Claude sees a note when an exempt command stayed in the sandbox. The `/sandbox` lists are not numbered outside screen reader mode. | [Sandbox](../configure/permissions/sandbox.md#other-behavior) |
| `CLAUDE_CODE_DISABLE_LAYOUT_CHECK` | <Undocumented /> | This new variable turns off the layout check of the terminal screen. | [UI and Terminal Variables](../configure/env-vars/ui-and-terminal.md#variables) |

### Tools, Hooks, and MCP

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Failing hooks | <Documented /> | A failing background `SubagentStop` hook, `SessionEnd` at `/clear` and `/resume`, and `CwdChanged` and `FileChanged` in fullscreen now show the failure. A `Stop` hook that failed to run no longer shows as a reported problem. | [Hook Input and Output](../extend/hooks/input-and-output.md#where-a-failing-hook-shows) |
| `claude mcp add-json <name> -` | <Documented /> | It reads the server JSON from stdin, so a token stays off the command line. It is not available inside a session. | [MCP CLI](../extend/mcp/cli.md#subcommands) |
| `claude mcp add` and `remove` with `--scope project` | <Documented /> | They keep the other top-level keys of `.mcp.json`. `add` stops when the file lists servers at the top level with no `mcpServers` key. | [MCP CLI](../extend/mcp/cli.md#how-it-works) |
| Remote MCP servers after an outage | <Documented /> | Most remote servers that Claude Code reaches by hostname over `https` are retried in the background for about a day. | [MCP Runtime](../extend/mcp/runtime.md#how-it-works) |
| MCP server logs | <Documented /> | They record the mode, action, and field names of elicitation requests and hook answers, not their full contents. | [MCP Runtime](../extend/mcp/runtime.md#how-it-works) |
| Subagent resume | <Documented /> | A subagent started with no model keeps its model when resumed, also after `/model`. A subagent that a sibling's message resumes follows the session's permission settings. | [Subagent Runtime](../extend/subagents/runtime.md#limits-and-switches) |
| First subagent on a model | <Undocumented /> | It waits up to 1.5 seconds (10 seconds in `claude -p`) for that model's settings from Anthropic. | [Subagent Runtime](../extend/subagents/runtime.md#limits-and-switches) |
| `ListAgents` | <Documented /> | A long list comes in pages. Each page ends with a cursor line for the next page. | [Agents, Tasks, and Planning](../reference/tools/agents-and-tasks.md#tools) |
| `ExitWorktree` | <Documented /> | `remove` asks first when the worktree may hold unsaved work. It is refused when nobody can answer, unless an allow rule, auto mode, or bypass permissions mode allows it. | [Agents, Tasks, and Planning](../reference/tools/agents-and-tasks.md#tools) |
| `Grep`, `Read`, `NotebookEdit`, and `@` mentions | <Documented /> | `Grep` sorts `content` and `count` results by file path, and paging no longer repeats or skips results. `Read` opens notebooks with an output of an unknown type, and reports the real size of a file of 10 MB or more. `NotebookEdit` keeps the final newline. A message looks up only the first 100 `@` mentions. | [Files, Search, and Memory](../reference/tools/files.md#how-it-works) |
| `WebFetch` and `Bash` | <Documented /> | `WebFetch` refuses a URL over 2,000 characters before any permission prompt. The `Bash` diff of changed files names each file that is binary, too large, or too many to show. | [Shell, Web, and Background Tasks](../reference/tools/shell-and-web.md#how-it-works) |
| `PowerShell` | <Documented /> | It asks before a command that may run `Get-Module`, even when a rule names it. | [Shell, Web, and Background Tasks](../reference/tools/shell-and-web.md#how-it-works) |
| First `Bash` command and shell start-up files | <Undocumented /> | Your shell start-up files may run before you approve the first command. Set `CLAUDE_CODE_DISABLE_SHELL_HEAD_START=1` to turn this off. | [Shell, Web, and Background Tasks](../reference/tools/shell-and-web.md#how-it-works), [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| `Artifact` | <Documented /> <Gated /> | The tool refuses calls once settings turn Artifacts off. It reads an uploaded file by the address the artifact page shows. The publish prompt stops offering "don't ask again" in some cases. | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#how-it-works) |
| `Edit` after compaction | <Undocumented /> | `Edit` runs on an unchanged file outside the project that Claude read in full before a compaction. It no longer fails with `File has not been read yet`. | [Files, Search, and Memory](../reference/tools/files.md#write-and-edit-limits) |
| Commit guidance about secrets | <Undocumented /> | On newer models and in `PowerShell`, Claude is told not to commit files that likely contain secrets, such as `.env`. | [Shell, Web, and Background Tasks](../reference/tools/shell-and-web.md#how-it-works) |
| Refusal of a command that the `rm` check cannot parse | <Undocumented /> | For a command with no `rm`, the refusal tells Claude that it can send a command that deletes nothing again in plain syntax. | [Permission Modes](../configure/permissions/modes.md#safety-checks) |
| PowerShell lookup on Windows | <Undocumented /> | With no `pwsh` on `PATH`, Claude Code looks in the standard install folders at the same time. The `powershell.exe` in `System32` comes before one on `PATH`. | [Shell, Web, and Background Tasks](../reference/tools/shell-and-web.md#how-it-works) |

### CLI, Sessions, and Accounts

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `--initialize-fields` | <Undocumented /> | This new flag reads the named fields of the `initialize` request in place of their flags. It is for SDK use. | [All Flags](../configure/cli/flags.md#start-and-print-mode) |
| `--worktree` with a relative `--add-dir` | <Documented /> | A relative `--add-dir` beside the launch folder gives the Bash sandbox that folder. One above the launch folder gives the sandbox and a `--bg` session only the worktree, in some starts. | [All Flags](../configure/cli/flags.md#sessions-and-worktrees) |
| `--nested-model-*` flags | <Undocumented /> | `--nested-model-access`, `--nested-model-allow`, and `--nested-model-call-budget` let a command in a runner session start a Claude Code that uses the runner's model access. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options) |
| `--use-anthropic-git-proxy` and `GIT_CONFIG_GLOBAL` | <Documented /> | The runner keeps a non-empty directory that `GIT_CONFIG_GLOBAL` names, ignores the variable, and prints a warning. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options) |
| `remote-control` in `worktree` mode | <Documented /> | Stopping the server keeps the worktree of a session that may return, with its git-ignored files such as `.env`. | [Remote Control](../configure/cli/remote-control.md#how-the-server-starts) |
| `CLAUDE_CODE_OAUTH_SCOPES` | <Documented /> | Claude Code does not pass it to commands that do not get the session token. A nested `claude` with its own token is no longer refused by `forceLoginOrgUUID`. | [Auth and Accounts Variables](../configure/env-vars/auth-and-accounts.md#variables) |
| `/status` Unused API key row | <Undocumented /> | When an API key is set and not used, `/status` shows "Unused API key" with "claude -p uses it". | [Account and Access](../how-it-works/account-and-access.md#login-and-an-unused-api-key) |
| `/export` | <Documented /> | It asks before it overwrites a file. `/export <name>` keeps an existing file and tells you to run `/export`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/hooks`, `/mcp`, and `/plugin` | <Documented /> | `/hooks` lists hooks from `--settings`. `/mcp` pages share one layout and end in Back. `/plugin` says that removing a marketplace deletes its plugins' settings and saved data. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/tui`, `/status`, `/statusline`, and `/install-github-app` | <Documented /> | `/tui classic` names the non-fullscreen renderer, and `/tui default` still works. `/status` lists broken files and other problems. `/statusline` honors `CLAUDE_CONFIG_DIR`. `/install-github-app` asks before it changes a repository. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/resume` | <Documented /> | The list fills the room in the window. After most spend caps, Claude Code no longer shows `Resend your message to try again`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/config` theme notice | <Documented /> | After you change the theme and close the panel, the notice says `Set theme to <name>`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/artifacts` list | <Gated /> | When a request for more of the list fails, the panel shows `Couldn't load the whole list`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#how-usage-and-artifacts-work) |
| `claude agents` and `claude rm` | <Documented /> | A fully pushed session can be removed when its worktree has a file or folder named `HEAD` at the top level. | [Subcommands](../configure/cli/subcommands.md#commands) |
| Prompts after `fg` | <Undocumented /> | For a moment after the terminal resumes, most prompts ignore every answer except Esc. | [Subcommands](../configure/cli/subcommands.md#commands) |
| Exit from a worktree session | <Documented /> | The release notes say that exit now says when a worktree was kept. | [All Flags](../configure/cli/flags.md#sessions-and-worktrees) |
| `--chrome` and credential files | <Documented /> | Claude in Chrome refuses to upload some credential files, such as `.env` or a `.pem` file. Attach those to the page yourself. | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) |
| `claude -p` in a self-hosted runner session | <Undocumented /> | A `claude -p` that a script or hook of the session starts no longer waits out rate limits. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#retry-setting-of-a-session) |
| API key and Anthropic profile | <Undocumented /> | When both are set, the startup notice says which one is in use and how to switch to the profile. | [Auth and Accounts Variables](../configure/env-vars/auth-and-accounts.md#how-it-works) |
| `history.jsonl` | <Documented /> | Prompt history leaves out most launch prompts of sessions that another Claude Code session started, such as `claude --bg` run by Claude. | [Sessions and Storage](../how-it-works/sessions-and-storage.md#where-files-live) |

### Headless Mode and Transcripts

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Print and headless runs | <Documented /> | A resumed headless session keeps stored messages that were sent again with the same UUID. `claude -p` goes on after 10 seconds when the fetch of a model's settings stalls. Print mode runs fewer git commands before the first request. | [Headless Mode](../extend/headless/index.md#how-it-works) |
| `error_code` values | <Undocumented /> | An error `control_response` can carry `stale_root_id` or `stale_turn`. | [Stream-JSON](../extend/headless/stream-json.md#fields-new-in-21327) |
| `init` capability `slash_words_join_v1` | <Undocumented /> | This is a new name in the capabilities of the `init` line. | [Stream-JSON](../extend/headless/stream-json.md#capabilities-of-the-init-line) |
| New control request fields and subtypes | <Undocumented /> | `update_cloud_session`, `reload_connectors`, and `comparison_fork` are new. `can_use_tool` can carry `rule_usually_offered`, and `get_context_usage` can carry `loadRaise`. | [Control Protocol](../extend/headless/control-protocol.md#subtypes) |

### Models, Network, and Telemetry

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `web-search-results-only-2026-11-15` beta | <Undocumented /> | The `WebSearch` request carries this beta when a server setting asks for results only and the experimental betas are on. | [Betas](../reference/api/betas.md#registry) |
| Reply cut at 32,000 output tokens | <Undocumented /> | On an unrecognized model, the reply continues with a limit of 128,000 output tokens. Subagent answers cut twice more often come back whole or say that they are partial. | [Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) |
| Compaction | <Undocumented /> | A compaction right after a cut reply keeps that reply's tool call and its result. A teammate on another model compacts at its own limit and with its own model. | [Context and Compaction](../how-it-works/context-and-compaction.md#gates-and-retries) |
| Reminder about a completed subagent | <Documented /> | When Claude can message the agent, the reminder tells Claude to ask it with `SendMessage` if it cannot read the result. | [Context and Compaction](../how-it-works/context-and-compaction.md#what-survives) |
| `CLAUDE_CODE_AGENT_PROGRESS_SUMMARIES` | <Undocumented /> | On Amazon Bedrock, Google Vertex AI, and Microsoft Foundry, a terminal session writes a progress summary from short notes, not from the whole conversation. | [Agents and Teams Variables](../configure/env-vars/agents-and-teams.md#variables) |
| `https_proxy` as a bare `host:port` | <Undocumented /> | Startup no longer fails when neither stdin nor stdout is a terminal, such as in the desktop app, an SDK, or cron. | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#variables) |

## Earlier Releases

This site keeps no page for an older release. The official [Changelog](https://code.claude.com/docs/en/changelog) lists every release.

## Example

In `2.1.327`, `claude mcp add-json` can read the server JSON from stdin. The `2.1.326` help text has no such option.
Check the version, then read the help text of the command:

```bash
claude --version
claude mcp add-json --help
```

The help text of `2.1.327` ends the first line with "or - to read it from stdin".

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
