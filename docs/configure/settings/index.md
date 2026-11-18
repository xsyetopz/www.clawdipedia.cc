---
title: Settings Files and Scopes
description: Where Claude Code settings live, which value wins, how managed settings arrive, and a map of every settings key page.
sidebar_position: 1
---

Settings are JSON files that change how Claude Code behaves. Use them to pick a model, add permission rules, turn off a feature, or share the same rules with a whole team. Create or edit a settings file, pass `--settings`, or use `/config` and `/model` for some keys. An administrator can deploy managed settings. Each key is its own switch. `disableAllHooks` turns off hooks, the status line, and file suggestions at once.

The managed schema of `2.1.327` lists 202 top-level keys. The user schema lists 178, and the other 24 are managed-only.[^schemas]

## Example

A project can share one small file with the whole team.

```json title=".claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "model": "opus",
  "permissions": {
    "allow": ["Bash(bun test)"]
  }
}
```

Every session in that folder starts on Opus and may run `bun test` without asking. A teammate can still override `model` in `.claude/settings.local.json`.

## Pages for Each Group of Keys

Each key has a row on one of these pages.

| Page | Keys |
| --- | --- |
| [Core Settings](core.md) | Compaction, memory, cleanup, shell, files, `env`, `sandbox`, updates |
| [Model Settings](model.md) | Model, effort, thinking, fast mode, cache lifetime, token reminders |
| [Auth Settings](auth.md) | Credential helpers, login rules, API provider limits |
| [Agents and Remote Settings](agents-and-remote.md) | `agent`, workflows, background work, Remote Control, peer sessions |
| [Hooks, Plugins, and Skills Settings](hooks-and-plugins.md) | Hooks, plugins, marketplaces, skills, `permissions`, `statusLine`, `outputStyle` |
| [MCP and Channels Settings](mcp-and-channels.md) | MCP servers, claude.ai connectors, channels |
| [Interface Settings](ui.md) | Theme, spinner, `tui`, voice, notices, feedback |
| [Enterprise Settings](enterprise.md) | How managed policy arrives, version limits |
| [Extra Keys and Global Config](extra-keys.md) | Keys the schema omits, and the keys of `~/.claude.json` |

## How to Read the Key Tables

- The `Status` column uses the badges from [How to Read These Docs](../../start/how-to-read.md).
- `Type` shows Unknown when neither the official docs nor the schema give a type. `Default` shows `-` when no default is known.
- `Where to Set It` says which files may set the key. `Any settings file` means the user, project, local, and managed files.
  `Settings files` means the settings files without a narrower scope in the source.
- Many boolean keys are written as the thing to switch off, such as `spinnerTipsEnabled`. Read the row before you pick a value.
- Items that are removed or do nothing in `2.1.326` are left out. See the end of this page.

## Where Settings Live

| Scope | File | Who it affects |
| --- | --- | --- |
| User | `~/.claude/settings.json` | You, in every project. `CLAUDE_CONFIG_DIR` moves `~/.claude`. |
| Shared project | `.claude/settings.json` | Everyone who works in the folder. Commit it so teammates get it. |
| Project local | `.claude/settings.local.json` | You, in this project only. Claude Code keeps the file out of git. |
| Command line | `--settings <file-or-json>` | One session. It cannot set managed or global config keys. |
| Managed | `managed-settings.json` and the other managed sources | Everyone your organization deploys it to. |
| Global config | `~/.claude.json` | You. Claude Code writes it. It holds sign-in data, MCP servers, per-project state, and a few keys. |

Official pages: [Settings Files and Precedence](https://code.claude.com/docs/en/settings) and [Explore the .claude Directory](https://code.claude.com/docs/en/claude-directory).

- Settings files are strict JSON. A comment or a trailing comma is a syntax error.
- Since `2.1.326`, when a settings file is not valid JSON, the error gives the line and the column of the first syntax error, for example `Invalid or malformed JSON (line 3, column 5)`. Both numbers start at 1.[^json-position]
- Claude Code reads the shared project file from the primary working directory.
  After `/cd`, it reads the new directory (v2.1.246 or later).
- In a git repository, the local file lives at the repository root. In a worktree, it lives at the main checkout root.
- Claude Code adds `**/.claude/settings.local.json` to your global git excludes file when it writes the local file.
  Since `2.1.323`, it does this also when the folder is not a git repository yet.[^gitignore]
- A write to a settings file reads the file from disk first, so a hand edit made moments before is kept. A file that was deleted starts again as a new file that holds only that change. Since `2.1.323`, a write seeds from the last parse only when the file is empty, broken, or locked, or when a `ConfigChange` hook blocked the latest change.[^seed]
- Claude Code watches the files and reloads them. It runs the `ConfigChange` hook for each change in a settings file.
- Managed settings from MDM or the console reach a running session on a schedule, not on save.
- A cloud session reads only the shared project file and server-managed settings.
- Run `/status` to see the `Setting sources` line. Run `claude doctor` to see the entries that Claude Code dropped.
- The flag `--setting-sources <sources>` loads only the sources you name (`user`, `project`, `local`).
  A source you leave out no longer supplies auto mode rules or saved permission consents (v2.1.314 or later).[^left-out]

Claude Code names the five sources `userSettings`, `projectSettings`, `localSettings`, `flagSettings`, and `policySettings`.[^sources]

## Which Value Wins

The highest level that sets a key wins. The `2.1.327` release notes say `/config` shows a note when other settings override a row.[^config-note]

Since `2.1.327`, a settings change from `/config` or a similar command that fails to save shows a line under the prompt that says so.[^save-fail]

1. Managed settings.
2. Command line (`--settings`).
3. Project local settings.
4. Shared project settings.
5. User settings.

```mermaid
flowchart TB
  M[Managed] --> C["<code>--settings</code>"]
  C --> L[Project local]
  L --> P[Shared project]
  P --> U[User]
  U --> D[Built-in default]
```

Read the chart from the top. The first level that sets the key decides its value.
Environment variables are not a level.
Each pair of key and variable decides alone, such as `ANTHROPIC_MODEL` over `model`.
See [Models and Effort Variables](../env-vars/models-and-effort.md) for examples. Official page: [Settings Files and Precedence](https://code.claude.com/docs/en/settings).

## How Lists and Model Keys Merge

- List keys such as `permissions.allow` merge across scopes.
- `allowManagedPermissionRulesOnly` stops that merge for permission rules.
- `fallbackModel` is an ordered chain. The whole value comes from the highest scope that sets it.
- `modelPicker` never merges. The whole value comes from managed settings, `--settings`, or user settings.
  Claude Code ignores project and local values (v2.1.242 or later).
- For `availableModels`, a managed list applies as it is. Across the other scopes, the arrays merge.
- `modelSettings` resolves one model at a time, together with `effortLevel`.
- Managed `env` blocks merge per key across admin sources. `CLAUDE_CODE_DISABLE_ADMIN_ENV_UNION=1` turns that off.

Official pages: [Settings Files and Precedence](https://code.claude.com/docs/en/settings) and [Environment Variables](https://code.claude.com/docs/en/env-vars).

## Managed Settings

An administrator puts managed settings on a machine in one of these ways. Official page: [Deploy Managed Settings](https://code.claude.com/docs/en/managed-settings).

| Platform | Where Claude Code looks |
| --- | --- |
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json`, and the `com.anthropic.claudecode` managed preferences domain |
| Linux and WSL | `/etc/claude-code/managed-settings.json` |
| Windows | `C:\Program Files\ClaudeCode\managed-settings.json`, and the registry keys `HKLM\SOFTWARE\Policies\ClaudeCode` and `HKCU\SOFTWARE\Policies\ClaudeCode` |
| WSL on Windows | The Windows sources, only when `wslInheritsWindowsSettings` is on |
| All | The `managed-settings.d/` folder next to the file, server-managed settings (cached in `~/.claude/remote-settings.json`), and the SDK `managedSettings` option or `--managed-settings` flag |

- Claude Code merges `managed-settings.json` first, then each `*.json` file of `managed-settings.d/` in alphabetical order.
  Number the files to set the order, such as `10-telemetry.json`.
- Since `2.1.323`, start-up reads a managed file again when the first read found it absent, empty, or not loadable, so a program that rewrites the file at that moment does not hide it. The re-read covers `managed-settings.json` and the files of `managed-settings.d/`. It has a limit of 5 seconds. When the limit passes, Claude Code keeps the managed settings it already read.[^managed-reread]
- `managedSourcesBehavior` decides how sources combine. `first-wins` uses the highest source alone. `merge` deep-merges them.
- `parentSettingsBehavior` does the same for the SDK parent tier.
- `policyHelper` and `policyHelpers` compute managed settings at startup.
- A file tool asks before it edits the local copy of server-managed settings, as it does for a user settings file (v2.1.314 or later).[^managed-edit-ask]

The keys are in [Enterprise Settings](enterprise.md).

## Exceptions to Managed Precedence

For a few keys, a lower scope may set a stricter value, and Claude Code honors it over the managed value. Official page: [Settings Files and Precedence](https://code.claude.com/docs/en/settings).

| Keys | Status | Value Claude Code honors | Where it can come from |
| --- | --- | --- | --- |
| `disableClaudeAiConnectors`, `isolatePeerMachines`, `permissions.blockReadsOutsideWorkingDirectories` | <Documented /> | `true` | Any scope |
| `enableArtifact`, `disableArtifact` | <Documented /> | `enableArtifact: false` or `disableArtifact: true` | Any scope |
| `autoMode.classifyAllShell` | <Documented /> | `true` | `~/.claude/settings.json` or `--settings`. Any `true` wins. `false` never turns it off |
| `remoteControlAtStartup` | <Documented /> | `false` | `.claude/settings.json` or `.claude/settings.local.json` |
| `crossSessionInbound` | <Documented /> | A stricter value on the ladder `accept`, `hold`, `refuse` | `.claude/settings.json` or `.claude/settings.local.json` |
| `useAutoModeDuringPlan`, `syncClaudeAiSkills`, `syncClaudeAiPlugins` | <Documented /> | `false` | Managed, `--settings`, `~/.claude/settings.json`, or `.claude/settings.local.json` |
| `maxEffortLevel` | <Documented /> | The lowest cap (v2.1.267 or later) | Any scope |
| `modelProposedGoals`, `feedbackDrafts`, `availableModelsMatch`, `askUserQuestionTimeout`, `dialogExpiry` | <Undocumented /> | A strict value | The docs do not list them here.[^strict] |

An app that runs Claude Code inside itself and sets `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` is also an exception.
Claude Code then takes the model keys of that app over the managed values.

## Left Out on Purpose

These keys do nothing in `2.1.326`, so the pages do not list them.

- `taskOutputMaxChars`: Claude Code removed the `TaskOutput` tool.
- `keybindingFlavor`: Word-editing keys always follow Bash (readline) rules now.
- `permissionExplainerEnabled`: Removed in v2.1.257.
- `teammateDefaultModel`: Removed in v2.1.234.

## Deep Nesting

Since `2.1.326`, a settings file with values nested more than 64 levels deep loads without them. Claude Code drops those values and shows a warning: "A value under "key" is nested more than 64 levels deep, so Claude Code ignores it. Reduce the nesting under "key"." For a file that Claude Code writes, the warning also says it leaves the value out when it saves a setting to that file. A `hooks` entry written as nested arrays is different: that case is a fatal error, and the text asks you to write `hooks` as an object of event names.[^nesting]

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `These settings files are not used: they are in a connector-downloads folder` | <Undocumented /> | Claude Code skipped the settings files in the project folder. | The folder is a `connector-downloads` folder that has a `.gitignore`. Claude Code saves files from claude.ai connectors there.[^connector] |
| `<file> has an error and didn't load` | <Undocumented /> | Since `2.1.326`, a settings file that you save with an error during a session gets a warning that names the file. It ends with `run claude doctor`. | The warning stays pinned. It covers a file that had no error when the session started or when the last change was read. Claude Code does not warn again for a file that already had an error, or for a file it cannot read.[^file-error] |

## Related Pages

- [Environment Variable Groups](../env-vars/features-and-toggles.md) list the variables that pair with some keys.
- [How to Read These Docs](../../start/how-to-read.md) explains the badges.
- [Undocumented Items](../../reference/undocumented.md) indexes every undocumented item.
- [Permissions](../permissions/index.md) covers `permissions`, `sandbox`, and `autoMode`.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) lists each key in the official docs.

## Sources

[^schemas]: The published schema files `schemas/claude-code-managed-settings.json` (202 keys under `properties`) and `schemas/claude-code-settings.json` (178 keys), counted for `2.1.327`. The 24 managed-only keys are the ones in the first file and not in the second.
[^config-note]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
[^save-fail]: The program, `chunk-cfxefa64.js:13838-13844` and `:13921-13925`, which show `Couldn't save this setting`. [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
[^gitignore]: The program, `chunk-bpr7n093.js:28842`, called from `chunk-bpr7n093.js:111930`.
[^seed]: The program, `chunk-bpr7n093.js:114282` (the write reads the file first and falls back to the last parse when it is "still empty, broken or locked") and `chunk-bpr7n093.js:115095-115468` (a `ConfigChange` hook that blocked the latest change, or is still deciding).
[^sources]: The program, `chunk-ytkczbf2.js:82772`.
[^managed-reread]: The program, `chunk-asj6f58y.js:581555` (the 5000 ms limit), `:581993`, and `:584320` (the timeout message "the managed settings already read are kept").
[^strict]: The program lists them as keys with a strict value, `chunk-ja5z738t.js:163892-164151`.
[^nesting]: The program, `chunk-ja5z738t.js:404141` (the limit of 64) and `chunk-ja5z738t.js:429221-429433` (the warning and the fatal `hooks` case).
[^file-error]: The program, `chunk-cfxefa64.js:122744-123311`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^connector]: Probe case `print.err319.settings-connector-downloads` ran this setup.
[^json-position]: The program, `chunk-ej8a0d5c.js:13258` and `chunk-ja5z738t.js:412580`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^left-out]: The program, `chunk-bpr7n093.js:93588` (reading a source that is not enabled returns nothing), with its use for auto mode rules at `chunk-bpr7n093.js:123378` and for the saved bypass-permissions consent at `chunk-bpr7n093.js:121482`.
[^managed-edit-ask]: The program, `chunk-jvme5rqc.js:159156` (the managed settings cache file is in the protected set), `:232070` and `:253150-253962` (a write to a protected settings file is not granted without a prompt).
