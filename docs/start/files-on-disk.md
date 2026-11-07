---
title: Files on Disk
description: Every file and folder that Claude Code reads or writes, with what it holds and the page that documents it.
sidebar_position: 3
---

Claude Code keeps its state in plain files.
Some you write, such as settings and `CLAUDE.md`. Others Claude Code writes, such as transcripts and caches.
This page lists them by place, says what each one is, and links to the page with the details.

Source: [Explore the .claude Directory](https://code.claude.com/docs/en/claude-directory) and the program.

:::warning
The files are not encrypted.
A secret that a tool prints goes into the transcript. Every prompt you type goes into `history.jsonl`.
:::

## The Big Picture

```mermaid
flowchart TB
  subgraph Project["Your project"]
    PS["<code>.claude/settings.json</code>,<br/><code>settings.local.json</code>"]
    PM["<code>CLAUDE.md</code>, <code>CLAUDE.local.md</code>,<br/><code>.claude/rules/</code>"]
    PX["<code>.claude/skills</code>, commands,<br/>agents, output-styles"]
    PJ["<code>.mcp.json</code>"]
  end
  subgraph Home["Your home folder"]
    UJ["<code>~/.claude.json</code>"]
    UC["<code>~/.claude/</code><br/>settings, memory, skills,<br/>agents, plugins"]
    UD["<code>~/.claude/</code><br/>transcripts, history, caches"]
  end
  subgraph Machine["The machine"]
    MS["Managed settings, <code>CLAUDE.md</code>,<br/>and <code>managed-mcp.json</code>"]
  end
  PS ~~~ PM ~~~ PX ~~~ PJ
  UJ ~~~ UC ~~~ UD
  Project --> CC[Claude Code]
  Home --> CC
  Machine --> CC
  CC --> UD
  CC --> UJ
```

## Files in a Project

You usually commit these files, except the ones marked local.

| Path | Status | You write? | What it is | Page |
| --- | --- | --- | --- | --- |
| `.claude/settings.json` | <Documented /> | ✅ | Shared project settings. | [Settings Files and Scopes](../configure/settings/index.md) |
| `.claude/settings.local.json` | <Documented /> | ✅ | Your private project settings. Claude Code adds it to your global git excludes. | [Settings Files and Scopes](../configure/settings/index.md) |
| `CLAUDE.md` or `.claude/CLAUDE.md` | <Documented /> | ✅ | Project instructions. Files in the working folder and each folder above it load at launch. | [Memory and Rules](../configure/memory-and-rules.md) |
| `CLAUDE.local.md` | <Documented /> | ✅ | Private project notes. Add it to `.gitignore`. | [Memory and Rules](../configure/memory-and-rules.md) |
| `AGENTS.md` or `.claude/AGENTS.md` | <Documented /> | ✅ | Claude Code reads it when no `CLAUDE.md` or `CLAUDE.local.md` is in or above the working folder. | [Memory and Rules](../configure/memory-and-rules.md) |
| `.claude/rules/**/*.md` | <Documented /> | ✅ | Rules. A `paths` key limits a rule to matching files. | [Memory and Rules](../configure/memory-and-rules.md) |
| `<subfolder>/CLAUDE.md` | <Documented /> | ✅ | Loads after Claude reads or edits a file in that subfolder. | [Memory and Rules](../configure/memory-and-rules.md) |
| `.claude/skills/<name>/SKILL.md` | <Documented /> | ✅ | A project skill. | [Skills and Commands](../extend/skills-and-commands/index.md) |
| `.claude/commands/<name>.md` | <Documented /> | ✅ | A project slash command. Skills replace this form, but it still loads. | [Slash Commands](../extend/skills-and-commands/slash-commands.md) |
| `.claude/agents/*.md` | <Documented /> | ✅ | A project subagent. The closest definition wins. | [Subagents](../extend/subagents/index.md) |
| `.claude/agent-memory/` | <Documented /> | ❌ | Memory of subagents that set `memory: project`. `memory: local` uses `.claude/agent-memory-local/`. | [Subagent Frontmatter](../extend/subagents/frontmatter.md) |
| `.claude/output-styles/*.md` | <Documented /> | ✅ | A project output style. | [Output Styles](../configure/output-styles.md) |
| `.mcp.json` | <Documented /> | ✅ | Project MCP servers. Claude Code asks you to approve them first. | [MCP Config](../extend/mcp/config.md) |

## Files in Your Home Folder

`CLAUDE_CONFIG_DIR` moves `~/.claude`. It does not move `~/.claude.json` unless you set the variable.

| Path | Status | You write? | What it is | Page |
| --- | --- | --- | --- | --- |
| `~/.claude.json` | <Documented /> | Mostly no | App state, sign-in data, personal and local MCP servers, and per-project state. Claude Code writes it. | [Extra Keys and Global Config](../configure/settings/extra-keys.md) |
| `~/.claude/settings.json` | <Documented /> | ✅ | Your user settings. | [Settings Files and Scopes](../configure/settings/index.md) |
| `~/.claude/CLAUDE.md` | <Documented /> | ✅ | Your personal instructions for every project. | [Memory and Rules](../configure/memory-and-rules.md) |
| `~/.claude/rules/*.md` | <Documented /> | ✅ | Your personal rules. They load before project rules. | [Memory and Rules](../configure/memory-and-rules.md) |
| `~/.claude/skills/<name>/SKILL.md` | <Documented /> | ✅ | Your personal skills. | [Skills and Commands](../extend/skills-and-commands/index.md) |
| `~/.claude/skills/synced/` | <Documented /> | ❌ | Skills from your claude.ai account. | [Skills and Commands](../extend/skills-and-commands/index.md) |
| `~/.claude/skills/.trash/`, `~/.claude/plugins/.trash/` | <Documented /> | ❌ | Removed synced items. They stay so you can recover them until the retention sweep deletes them. The sweep uses `cleanupPeriodDays`, which is 30 days by default. | [Skills and Commands](../extend/skills-and-commands/index.md) |
| `~/.claude/commands/` | <Documented /> | ✅ | Your personal slash commands. | [Slash Commands](../extend/skills-and-commands/slash-commands.md) |
| `~/.claude/agents/*.md` | <Documented /> | ✅ | Your personal subagents. | [Subagents](../extend/subagents/index.md) |
| `~/.claude/output-styles/*.md` | <Documented /> | ✅ | Your personal output styles. | [Output Styles](../configure/output-styles.md) |
| `~/.claude/keybindings.json` | <Documented /> | ✅ | Your keyboard shortcuts. Run `/keybindings` to open it. | [Slash Commands](../extend/skills-and-commands/slash-commands.md) |
| `~/.claude/agent-memory/` | <Documented /> | ❌ | Memory of subagents that set `memory: user`. | [Subagent Frontmatter](../extend/subagents/frontmatter.md) |

## Plugins and Marketplaces

Source: [Plugin Loading Reference](https://code.claude.com/docs/en/plugins/loading).

| Path | Status | What it is | Page |
| --- | --- | --- | --- |
| `~/.claude/plugins/` | <Documented /> | The plugin root. `CLAUDE_CODE_PLUGIN_CACHE_DIR` sets this parent folder. | [Plugin Loading](../extend/plugins/loading.md) |
| `plugins/cache/<marketplace>/<plugin>/<version>/` | <Undocumented /> | One copy of each installed version. | [Plugin Loading](../extend/plugins/loading.md) |
| `plugins/data/<id>/` | <Documented /> | The folder behind `${CLAUDE_PLUGIN_DATA}`. It survives updates. | [Plugin Loading](../extend/plugins/loading.md) |
| `plugins/installed_plugins.json` | <Undocumented /> | The install records. Claude Code may keep dated `set-aside` or `unreadable` copies. | [Plugin Loading](../extend/plugins/loading.md) |
| `plugins/known_marketplaces.json` | <Documented /> | The marketplace records. | [Plugin Loading](../extend/plugins/loading.md) |
| `plugins/marketplaces/<name>` | <Documented /> | A clone of each marketplace. | [Marketplaces](../extend/plugins/marketplace.md) |
| `plugins/synced` | <Documented /> | Plugins synced from claude.ai. The id is `<name>@synced`. | [Plugin Loading](../extend/plugins/loading.md) |
| `<plugin>/.claude-plugin/plugin.json` | <Documented /> | The manifest inside a plugin. | [Plugin Manifest](../extend/plugins/manifest.md) |
| `.claude-plugin/marketplace.json` | <Documented /> | The catalog inside a marketplace repository. | [Marketplaces](../extend/plugins/marketplace.md) |
| `<plugin>/hooks/hooks.json` | <Documented /> | Hooks and mod modules that a plugin ships. | [Hooks Configuration](../extend/hooks/configuration.md) |
| `.claude-plugin/types/` | <Documented /> | Type files that Claude Code writes for a mod that you load from a folder. | [Files, Nouns, and Gates](../extend/mod-api/nouns-and-gates.md) |

## Sessions and Transcripts

All paths here are under `~/.claude/`.
`<project>` is the project folder path. In it, `-` replaces every character other than a letter or digit.
Source: [Explore the .claude Directory](https://code.claude.com/docs/en/claude-directory).

| Path | Status | What it is | Cleaned by age? |
| --- | --- | --- | --- |
| `projects/<project>/<session>.jsonl` | <Documented /> | The transcript of one session. | ✅ |
| `projects/<project>/<session>/subagents/` | <Documented /> | Subagent transcripts. | ✅ |
| `projects/<project>/<session>/tool-results/` | <Documented /> | Large tool outputs and MCP images. | ✅ |
| `projects/<project>/memory/` | <Documented /> | Auto memory. `MEMORY.md` is the index. | ❌ |
| `file-history/<session>/` | <Documented /> | Snapshots from before edits, for rewind. | ✅ |
| `plans/` | <Documented /> | Plan files from plan mode. | ✅ |
| `tasks/` | <Documented /> | Task lists. | ✅ |
| `dev-mods/<session>/` | <Documented /> | Mods that Claude wrote during a session. | ✅ |
| `uploads/<session>/` | <Documented /> | Files attached from the web or mobile app. | ✅ |
| `debug/` | <Documented /> | Debug logs, written while debug logging is on. | ✅ |
| `paste-cache/` | <Documented /> | Large pastes. | ✅ |
| `shell-snapshots/`, `session-env/` | <Documented /> | Shell setup and per-session metadata. | ✅ |
| `backups/` | <Documented /> | Copies of `~/.claude.json`. The five newest stay. | ✅ |
| `sessions/` | <Documented /> | One small file for each running session. | ❌ |
| `history.jsonl` | <Documented /> | Every prompt you typed, for up-arrow and `Ctrl+R`. | Entries age out |
| `feedback-bundles/`, `feedback/drafts/` | <Documented /> | Feedback archives and drafts that you have not sent. | Drafts age out |
| `usage-data/` | <Documented /> | Reports from `/insights` and their cached data. | ❌ |

The full list, the retention rules, and the controls are on [Sessions and Storage](../how-it-works/sessions-and-storage.md).
The line format of a transcript is on [Transcript Format](../reference/transcript-format.md).

## Caches and Account Files

| Path | Status | What it is | Page |
| --- | --- | --- | --- |
| `~/.claude/.credentials.json` | <Documented /> | Your login credentials. On macOS, the Keychain holds them. Claude Code uses this file when the Keychain rejects the write. On Linux and Windows, Claude Code uses this file (mode `0600` on Linux). Keep it private and do not delete it. | [Sessions and Storage](../how-it-works/sessions-and-storage.md) |
| `~/.claude/stats-cache.json` | <Documented /> | Totals that `/usage` shows. | [Sessions and Storage](../how-it-works/sessions-and-storage.md) |
| `~/.claude/remote-settings.json` | <Documented /> | Cached server-managed settings, or `{}`. | [Enterprise Settings](../configure/settings/enterprise.md) |
| `~/.claude/policy-limits.json` | <Documented /> | Cached organization limits. Some account types only. | [Enterprise Settings](../configure/settings/enterprise.md) |
| `~/.claude/cache/changelog.md` | <Documented /> | A cached copy of the [changelog](https://code.claude.com/docs/en/changelog) for `/release-notes`. | [What Changed](what-changed.md) |
| `~/.claude/daemon/roster.json`, `~/.claude/jobs/<id>/state.json`, `~/.claude/jobs/<id>/tmp/` | <Documented /> | The list of running background sessions, the state of each session, and its scratch folder. Keep them. The official "Agent View" page describes them. | [Sessions and Storage](../how-it-works/sessions-and-storage.md) |
| `state/`, `mods/`, `bridge-spawn/`, `seed-admin/`, `downloads/`, `cache/model-catalog/` | <Undocumented /> | Present on a `2.1.305` machine (after `2.1.305` was installed, only `cache/model-catalog/` and a type file under `mods/handoff/` were written; `bridge-spawn/`, `seed-admin/`, and `downloads/` are empty and `state/` was last written before the install) or named in the program. No docs page describes them. The program describes `state/`, `seed-admin/`, `bridge-spawn/`, and `cache/model-catalog/`; see the link. | [Sessions and Storage](../how-it-works/sessions-and-storage.md) |

## Names in the Config Folder

The tables above show full paths. This table lists each name on its own, so you can look one up.
The paths are under `~/.claude/` unless the Where column says otherwise.
The program holds more names than this table lists. They are internal files, or names with a use that this page could not confirm.

| Name | Status | Where | What it is |
| --- | --- | --- | --- |
| `settings.json` | <Documented /> | `~/.claude/`, `.claude/` | Your user or project settings. |
| `keybindings.json` | <Documented /> | `~/.claude/` | Your keyboard shortcuts. The contexts and actions are on [Keybindings](../configure/keybindings/index.md). |
| `commands` | <Documented /> | `~/.claude/`, `.claude/` | Slash commands. |
| `skills` | <Documented /> | `~/.claude/`, `.claude/` | Skills. |
| `rules` | <Documented /> | `~/.claude/`, `.claude/` | Rules. |
| `output-styles` | <Documented /> | `~/.claude/`, `.claude/` | Output styles. |
| `plugins` | <Documented /> | `~/.claude/` | The plugin root. |
| `agent-memory` | <Documented /> | `~/.claude/`, `.claude/` | Memory of subagents. |
| `projects` | <Documented /> | `~/.claude/` | Transcripts and auto memory, one folder for each project. |
| `sessions` | <Documented /> | `~/.claude/` | One small file for each running session. |
| `tasks` | <Documented /> | `~/.claude/` | Task lists. |
| `plans` | <Documented /> | `~/.claude/` | Plan files from plan mode. |
| `debug` | <Documented /> | `~/.claude/` | Debug logs. |
| `paste-cache` | <Documented /> | `~/.claude/` | Large pastes. |
| `uploads` | <Documented /> | `~/.claude/` | Files attached from the web or mobile app. |
| `dev-mods` | <Documented /> | `~/.claude/` | Mods that Claude wrote during a session. |
| `shell-snapshots` | <Documented /> | `~/.claude/` | Shell setup. |
| `backups` | <Documented /> | `~/.claude/` | Copies of `~/.claude.json`. The five newest stay. |
| `usage-data` | <Documented /> | `~/.claude/` | Reports from `/insights` and their cached data. |
| `jobs` | <Documented /> | `~/.claude/` | The state of background sessions. |
| `daemon` | <Documented /> | `~/.claude/` | The list of running background sessions. |
| `cache` | <Documented /> | `~/.claude/` | Caches, such as `changelog.md`. |
| `changelog.md` | <Documented /> | `~/.claude/cache/` | A cached copy of the [changelog](https://code.claude.com/docs/en/changelog) for `/release-notes`. |
| `stats-cache.json` | <Documented /> | `~/.claude/` | Totals that `/usage` shows. |
| `remote-settings.json` | <Documented /> | `~/.claude/` | Cached server-managed settings. |
| `policy-limits.json` | <Documented /> | `~/.claude/` | Cached organization limits. |
| `feedback-bundles` | <Documented /> | `~/.claude/` | Feedback archives. |
| `drafts` | <Documented /> | `~/.claude/feedback/` | Feedback drafts that you have not sent. |
| `state` | <Undocumented /> | `~/.claude/` | Staged settings changes and consent records. See [Sessions and Storage](../how-it-works/sessions-and-storage.md). |
| `seed-admin` | <Undocumented /> | `~/.claude/` | The root for temp folders of cloud-session uploads. See [Sessions and Storage](../how-it-works/sessions-and-storage.md). |
| `model-catalog` | <Undocumented /> | `~/.claude/cache/` | Cached model catalog files and `masked-ids.json`. See [Sessions and Storage](../how-it-works/sessions-and-storage.md). |
| `.config.json` | <Undocumented /> | `~/.claude/` | The old place of the global config. The program uses it when it is a non-empty file. Otherwise it uses `~/.claude.json`. |
| `.last-cleanup` | <Undocumented /> | `~/.claude/` | Holds an ISO time. The program reads the age of the file to skip a new cleanup run. |
| `.deep-link-register-failed` | <Undocumented /> | `~/.claude/` | A marker that the deep-link registration failed. The program reads the age of the file. It does not try again for a while. |
| `.last-update-result.json` | <Undocumented /> | `~/.claude/` | The result of the last update, with the fields `outcome` (`success` or `failed`), `status`, `version_from`, `version_to`, and `error_code`. |
| `.update.lock` | <Undocumented /> | `~/.claude/` | The update lock. The program treats a lock younger than 5 minutes as held. |
| `active-time.json` | <Undocumented /> | `~/.claude/` | A ledger of active time, with `version` `1` and a `windows` list. |
| `asset-cache` | <Undocumented /> | `~/.claude/plugins/` | The cache of plugin binary assets. |
| `cowork_plugins` | <Undocumented /> | `~/.claude/` | The plugin root in place of `plugins` when `CLAUDE_CODE_USE_COWORK_PLUGINS` is on. |
| `daemon.lock` | <Undocumented /> | `~/.claude/` | The lock file of the daemon. |
| `daemon.log` | <Undocumented /> | `~/.claude/` | The log of the daemon. The older copy is `daemon.log.1`. |
| `daemon.status.json` | <Undocumented /> | `~/.claude/` | Status that the daemon supervisor writes. It holds the supervisor process id. |
| `daemon.scheduled.status.json` | <Undocumented /> | `~/.claude/` | Status that the scheduled-task worker writes. It holds the worker process id. |
| `gh-pr-status-cache.json` | <Undocumented /> | `~/.claude/` | A cache of pull request statuses from GitHub. |
| `mcp-needs-auth-cache.json` | <Undocumented /> | `~/.claude/` | The MCP needs-auth cache. |
| `my-closed-issues.json` | <Undocumented /> | `~/.claude/cache/` | A cached list of closed issues. Each entry has `number`, `title`, and `closedAt`. |
| `startup-perf` | <Undocumented /> | `~/.claude/` | A `.json` and a `.txt` file that `CLAUDE_CODE_PROFILE_STARTUP=1` writes. See [Probes](../reference/probes.md). |
| `daemon.json` | <Undocumented /> | `~/.claude/` | A file in the config folder that the file tools refuse to write. The program refuses the same writes to `daemon`, `jobs`, `shell-snapshots`, and `session-env`. |
| `local` | <Undocumented /> | `~/.claude/` | The folder of a local npm install. After a failed auto-update, the program tells you to run `cd ~/.claude/local && npm update`. |
| `loop.md` | <Undocumented /> | `.claude/`, `~/.claude/` | The task list of a `/loop` tick that has no prompt. The program reads the project file first, then the config folder file. It cuts the text to 25000 bytes and adds a warning. |
| `personal` | <Undocumented /> | `~/.claude/memory/` | The folder of the personal memory store (`memory/personal`). The store takes only Markdown files. The model reads and writes it through a memory store named `personal`, when memory stores are on. |
| `workflows` | <Undocumented /> | `.claude/` | Predefined workflows, as `.claude/workflows/<name>.js`. A workflow call that gives a `name` resolves it from here or from the built-in list. The save dialog writes a project workflow to this folder. |

## Managed Files

An administrator puts these on the machine. A user cannot override them.

| Path | Status | What it is | Page |
| --- | --- | --- | --- |
| `managed-settings.json` and `managed-settings.d/*.json` | <Documented /> | Organization settings. The folder is next to the file. Its files merge in alphabetical order. | [Settings Files and Scopes](../configure/settings/index.md) |
| Managed `CLAUDE.md` | <Documented /> | Organization instructions. A user cannot exclude it. | [Memory and Rules](../configure/memory-and-rules.md) |
| `managed-mcp.json` | <Documented /> | A fixed set of MCP servers. It gives the organization exclusive control. | [MCP Settings and Policy](../extend/mcp/settings.md) |
| Managed skills `<managed dir>/.claude/skills/` | <Documented /> | Skills for all users on a machine. They win over personal and project skills. | [Skills and Commands](../extend/skills-and-commands/index.md) |

The folder is `/Library/Application Support/ClaudeCode/` on macOS, `/etc/claude-code/` on Linux and WSL, and `C:\Program Files\ClaudeCode\` on Windows.

## Settings Precedence

When two settings files set the same key, the higher one wins.

```text
1. Managed settings
2. --settings (command line)
3. .claude/settings.local.json
4. .claude/settings.json
5. ~/.claude/settings.json
```

List keys such as `permissions.allow` merge across files.
The exceptions and the merge rules are on [Settings Files and Scopes](../configure/settings/index.md).

## Example

You want to find where Claude Code kept the last session in `/work/app`. Then you want to remove old ones.

```bash
ls ~/.claude/projects/-work-app/
claude purge --dry-run
```

The first command lists the transcripts of that project.
The second shows what `claude purge` would delete. It deletes nothing.

## Exact Fields

The exact fields of `~/.claude.json` are in this schema: `https://clawdipedia.cc/schemas/claude-code-claude-json.json`. The program builds this payload in code, not with a validator. So the schema comes from that code. A field marked `x-unverified` has a type that the code does not show. A field marked `x-observed` is a field that a probe saw.
It lists every field of this release. Build on the fields it names. Look each one up there before you rely on it.

## Related Pages

- [What Can I Change](what-can-i-change.md)
- [Sessions and Storage](../how-it-works/sessions-and-storage.md)
- [Settings Files and Scopes](../configure/settings/index.md)
- [Environment Variables for Sessions and Storage](../configure/env-vars/sessions-and-storage.md)
