---
title: What Changed
description: What changed in Claude Code 2.1.321, the release this site covers, against 2.1.319, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.321`, the release this site covers, against `2.1.319`, the release before it.
It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.321`, the version shown in the navbar.

## Version 2.1.321

Sources: the release notes of [`2.1.321`](https://github.com/anthropics/claude-code/releases/tag/v2.1.321) (November 9, 2026), and a comparison of the `2.1.319` and `2.1.321` programs. There is no `2.1.320`. Rows marked with the program, or with a case id, come from the program and not from release notes.

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Fable 5.2 (`claude-fable-5-2`) | <Documented /> | A new model, and the model that `fable` now resolves to. `best` is the same model as `opus` now. A saved `claude-fable-5-1` or `claude-fable-5-1[1m]` model in user settings moves to `fable` or `fable[1m]` on a first-party plan: at once on Pro and Max, and on Team and Enterprise once the organization allows it. `/model claude-fable-5-1` switches back ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Model Catalog](../configure/models-and-providers/model-catalog.md) |
| `/model` picker and fast mode labels | <Undocumented /> | "More models" is an unnumbered row below the others. The fast mode labels in `/fast`, `/config`, and `/model` name your current model when it supports fast mode ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Model Catalog](../configure/models-and-providers/model-catalog.md) |
| `claude plugin restore-set-aside <plugin>` | <Undocumented /> | A new plugin command. It gives back the options and secrets that Claude Code set aside when managed settings took over a marketplace. | [Plugin CLI](../extend/plugins/cli.md) |
| Managed `extraKnownMarketplaces` take-over | <Documented /> | A declared name cannot be added from another source, an entry from elsewhere is hidden, and the plugins the declared marketplace lists are installed again from it. Saved data stays set aside for `cleanupPeriodDays` ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Hooks and Plugins Settings](../configure/settings/hooks-and-plugins.md), [Marketplaces](../extend/plugins/marketplace.md) |
| Mod reload in print mode | <Documented /> | A print-mode session reloads mods in `.claude/skills` when their files change. `CLAUDE_CODE_PLUGIN_DIR_WATCH=0` turns it off. `--plugin-dir` folders still reload only with `1` ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321); case `print.cli319.plugin-dir-watch.unset`). | [Plugin Loading](../extend/plugins/loading.md), [Plugins and MCP](../configure/env-vars/plugins-and-mcp.md) |
| Mods that Claude writes | <Documented /> | They turn on without a question in `auto` and `bypassPermissions` modes, and do not load in `dontAsk` mode ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Nouns and Gates](../extend/mod-api/nouns-and-gates.md) |
| `$.tool.call` and `$.mcp.call` | <Documented /> | A mod's own tool calls raise no permission prompt, also in `dontAsk` and `-p` runs. Deny rules and organization policy still apply ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Tool, Command, and Config Calls](../extend/mod-api/calls/tool-command-config.md) |
| Nested `.claude/skills` in `~/.claude/plugins` | <Documented /> | These folders do not load when Claude works on files there ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Skills and Commands](../extend/skills-and-commands/index.md) |
| `TaskStop` and background command notices | <Documented /> | A command over 1,000 characters shows Claude only its first 500 and last 300 characters ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Shell and Web Tools](../reference/tools/shell-and-web.md) |
| `AskUserQuestion` and `afkTimeoutMs` | <Documented /> | In `claude -p` and SDK sessions the tool refuses a permission answer that sets `afkTimeoutMs`, except a bare allow answer ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Agent and Task Tools](../reference/tools/agents-and-tasks.md) |
| `PreToolUse` `mcp_tool` hooks | <Documented /> | An answer over 16 MiB now makes Claude Code refuse the tool call ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Hook Handlers](../extend/hooks/handlers.md) |
| Skill names with Bamum letters | <Documented /> | Claude Code refuses these names ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Skill Frontmatter](../extend/skills-and-commands/frontmatter.md) |
| `num_hooks` in OpenTelemetry | <Undocumented /> | In non-interactive sessions, two built-in hooks no longer count after Bash and PowerShell calls ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [OpenTelemetry Events](../reference/opentelemetry.md) |
| `claude remote-control --settings <file>` | <Undocumented /> | A settings file that applies to every session the command starts. A changed file starts no new session until you restart the command ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321); cases `print.cli321.rc-settings-*`). | [Remote Control](../configure/cli/remote-control.md) |
| Self-hosted runner exit code | <Documented /> | An on-demand runner that the server refuses as not needed exits with code 0, not 1 ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md) |
| Hand-parsed subcommand probes | <Undocumented /> | The `cli321` probe group runs `remote-control`, `self-hosted-runner`, and the hidden `daemon` subcommands. | [Release Probes](../reference/probes.md) |
| `claude purge` | <Documented /> | A command that deletes the state of a project. | [Subcommands](../configure/cli/subcommands.md) |
| Error texts | <Undocumented /> | New texts for the Claude apps gateway Claude Desktop overlay, `$.http.fetch`, `WebFetch`, and plugin marketplaces, each on the page the diff names. | [Settings](../configure/settings/index.md), [Marketplaces](../extend/plugins/marketplace.md) |

The release notes list many more fixes, such as the Desktop Code tab message limit, and the changes for VS Code, Cloud sessions, Claude Tag, and Remote Control. The site states one only after a check in the program or a probe, so a fix that no page here reaches is left out.

## Earlier Releases

This site keeps no page for an older release. The official [Changelog](https://code.claude.com/docs/en/changelog) lists every release.

## Example

You update to `2.1.321` and keep a mod in `.claude/skills`.
A `claude -p` run then reloads the mod when its file changes. Set `CLAUDE_CODE_PLUGIN_DIR_WATCH=0` to stop that.
Check the mod row. Then check your version:

```bash
claude --version
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
