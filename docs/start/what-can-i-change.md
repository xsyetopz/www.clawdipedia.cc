---
title: What Can I Change
description: A task map that links each thing you may want to change to the setting, flag, hook, skill, plugin, or other surface that changes it.
sidebar_position: 2
---

Claude Code has many places where you can change how it works. This page starts from what you want to do and points to the right place. Each row links to the page that lists every key, flag, or field.

## Example

You want Claude to run your formatter after each edit and to ask before it runs `git push`. Two small settings do both.

```json title=".claude/settings.json"
{
  "permissions": {
    "ask": ["Bash(git push:*)"]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "bunx prettier --write ." }]
      }
    ]
  }
}
```

The first part is a permission rule. The second part is a hook. Both live in the shared project settings file.

## The Surfaces

```mermaid
flowchart LR
  G[Your goal] --> C{Kind of change}
  C -->|A value| S[Settings key or env var]
  C -->|One run| F[CLI flag]
  C -->|"Run code<br/>on an event"| H[Hook]
  C -->|"Teach Claude<br/>a task"| K[Skill or command]
  C -->|Split off work| A[Subagent]
  C -->|"Add outside<br/>tools"| M[MCP server]
  C -->|"Change tone<br/>or layout"| O[Output style or status line]
  C -->|"Give standing<br/>advice"| R[Memory and rules]
  C -->|Bundle and share| P[Plugin]
  C -->|"Change the<br/>program itself"| X[Mod API]
```

| Surface | Use it when | Page |
| --- | --- | --- |
| Settings keys | You want a stored value that stays between sessions. | [Settings Files and Scopes](../configure/settings/index.md) |
| Environment variables | You want a value for a shell, a script, or a CI job. | [Environment Variables](../configure/env-vars/index.md) |
| CLI flags | You want a change for one run only. | [CLI Flags](../configure/cli/flags.md) |
| Hooks | You want your own code to run on an event, and maybe block it. | [Hooks](../extend/hooks/index.md) |
| Skills and commands | You want a reusable prompt or a `/name` shortcut. | [Skills and Commands](../extend/skills-and-commands/index.md) |
| Subagents | You want a helper with its own prompt, tools, and model. | [Subagents](../extend/subagents/index.md) |
| Plugins | You want to bundle and share several of these. | [Plugins](../extend/plugins/index.md) |
| MCP servers | You want Claude to use tools from another program or service. | [MCP](../extend/mcp/index.md) |
| Mod API | You want code that changes Claude Code itself, such as new UI or event handlers. | [Mod API Overview](../extend/mod-api/index.md) |

## Behavior and Safety

| I want to ... | Status | How | Page |
| --- | --- | --- | --- |
| Allow or block a tool call without a prompt | <Documented /> | `permissions.allow`, `permissions.deny`, and `permissions.ask` rules | [Permission Rules](../configure/permissions/rules.md) |
| Start in a different permission mode | <Documented /> | `--permission-mode` flag or the `permissions.defaultMode` setting | [Permission Modes](../configure/permissions/modes.md) |
| Let a classifier approve safe actions | <Documented /> | Auto mode and its rules | [Auto Mode](../configure/permissions/auto-mode.md) |
| Limit what shell commands can touch | <Documented /> | The `sandbox` settings | [Sandbox](../configure/permissions/sandbox.md) |
| Block a command with my own logic | <Documented /> | A `PreToolUse` hook | [Hook Events](../extend/hooks/events.md) |
| Understand why Claude Code allowed a call or asked about it | <Documented /> | Read the flow | [Permission Flow](../how-it-works/permission-flow.md) |
| Let managed policy lock a value | <Documented /> | Managed settings | [Enterprise Settings](../configure/settings/enterprise.md) |

## Models and Cost

| I want to ... | Status | How | Page |
| --- | --- | --- | --- |
| Pick the model | <Documented /> | `/model`, `--model`, the `model` setting, or `ANTHROPIC_MODEL` | [Model Settings](../configure/settings/model.md) |
| Change how hard the model thinks | <Documented /> | The effort and thinking settings | [Models and Effort Variables](../configure/env-vars/models-and-effort.md) |
| Use Bedrock, Vertex, or Foundry | <Documented /> | Provider variables | [Models and Providers](../configure/models-and-providers/index.md) |
| Change when Claude Code summarizes old messages | <Documented /> | Compaction settings and variables | [Context and Compaction Variables](../configure/env-vars/context-and-compaction.md) |
| Understand how Claude Code chooses a model | <Documented /> | Read the flow | [Models](../how-it-works/models.md) |
| Route requests through a proxy or custom CA | <Documented /> | Network variables | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md) |

## Instructions and Memory

| I want to ... | Status | How | Page |
| --- | --- | --- | --- |
| Give Claude standing project advice | <Documented /> | `CLAUDE.md` | [Memory and Rules](../configure/memory-and-rules.md) |
| Apply advice only to some files | <Documented /> | A rule file with `paths` in `.claude/rules/` | [Memory and Rules](../configure/memory-and-rules.md) |
| Turn off auto memory | <Documented /> | `autoMemoryEnabled: false` or `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | [Memory and Rules](../configure/memory-and-rules.md) |
| Change the tone or style of replies | <Documented /> | An output style | [Output Styles](../configure/output-styles.md) |
| See the real system prompt | <Undocumented /> | Captured prompts on this site | [Prompt Captures](../prompts/index.md) |
| Understand how Claude Code builds the prompt | <Documented /> | Read the build steps | [System Prompt](../how-it-works/system-prompt.md) |
| Add text to the system prompt | <Documented /> | `--append-system-prompt` | [CLI Flags](../configure/cli/flags.md) |

## Tools and Automation

| I want to ... | Status | How | Page |
| --- | --- | --- | --- |
| Run something after every file edit | <Documented /> | A `PostToolUse` hook | [Hooks](../extend/hooks/index.md) |
| Add my own `/command` | <Documented /> | A skill or a file in `.claude/commands/` | [Skills and Commands](../extend/skills-and-commands/index.md) |
| Start a helper for one kind of task | <Documented /> | A file in `.claude/agents/` | [Subagent Frontmatter](../extend/subagents/frontmatter.md) |
| Connect a database or an API | <Documented /> | `claude mcp add` or `.mcp.json` | [MCP Config](../extend/mcp/config.md) |
| Limit which MCP servers may run | <Documented /> | MCP allow and deny settings | [MCP Settings and Policy](../extend/mcp/settings.md) |
| Run Claude Code from a script | <Documented /> | Print mode with `-p` | [Headless Mode](../extend/headless/index.md) |
| Drive it from my own program | <Documented /> | Stream JSON and the control protocol | [Control Protocol](../extend/headless/control-protocol.md) |
| Share my setup with a team | <Documented /> | A plugin and a marketplace | [Plugin Marketplaces](../extend/plugins/marketplace.md) |

## Screen and Terminal

| I want to ... | Status | How | Page |
| --- | --- | --- | --- |
| Show my own status line | <Documented /> | The `statusLine` setting | [Status Line](../configure/status-line.md) |
| Change theme, spinner, or notices | <Documented /> | Interface settings | [Interface Settings](../configure/settings/ui.md) |
| Change terminal behavior with variables | <Documented /> | UI and terminal variables | [UI and Terminal Variables](../configure/env-vars/ui-and-terminal.md) |
| Change keyboard shortcuts | <Documented /> | `/keybindings` opens `~/.claude/keybindings.json` | [Slash Commands](../extend/skills-and-commands/slash-commands.md) |
| Add a screen element or dialog | <Documented /> | A mod that uses `$.ui` | [Mod API UI](../extend/mod-api/ui/ui.md) |

## Sessions, Files, and Privacy

| I want to ... | Status | How | Page |
| --- | --- | --- | --- |
| Continue or branch an old session | <Documented /> | `--continue`, `--resume`, `/branch` | [Sessions and Storage](../how-it-works/sessions-and-storage.md) |
| Keep sessions for a shorter time | <Documented /> | `cleanupPeriodDays` | [Core Settings](../configure/settings/core.md) |
| Stop Claude Code from saving anything | <Documented /> | `CLAUDE_CODE_SKIP_PROMPT_HISTORY` or `--no-session-persistence` | [Sessions and Storage](../how-it-works/sessions-and-storage.md) |
| Move the whole `~/.claude` folder | <Documented /> | `CLAUDE_CONFIG_DIR` | [Files on Disk](files-on-disk.md) |
| Turn off telemetry or debug output | <Documented /> | Telemetry variables | [Telemetry and Debug Variables](../configure/env-vars/telemetry-and-debug.md) |
| Know where a file lives | <Documented /> | The file map | [Files on Disk](files-on-disk.md) |

## What You Cannot Change

Claude Code fixes some parts. No setting edits the built-in tools, the permission engine, or the request format. You can still watch or shape them with a hook or a mod. The [Architecture](../how-it-works/architecture.md) and [Agent Loop](../how-it-works/agent-loop.md) pages show where each part sits.

:::warning
Do not use <Undocumented /> items in shared setups without a plan. They can change in any release without notice.
:::

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [Files on Disk](files-on-disk.md)
- [Environment Variable Groups](../configure/env-vars/features-and-toggles.md)
- [Undocumented Items](../reference/undocumented.md)
