---
title: Bundled Skills
description: Skills that ship inside Claude Code, what each one does, and how to turn them off.
sidebar_position: 4
---

Bundled skills ship inside Claude Code, so you need no files to use them.
They are prompts that guide Claude through a common job.
For example, `/simplify` reviews changed code and fixes the problems it finds.

You cannot change a bundled skill. You can replace one with your own skill of the same name. Turn them off with the `disableBundledSkills` setting or `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1`.

## Example

```bash
claude -p "/debug the login test fails on CI"
```

`/debug` enables debug logging. It then investigates the issue that you describe.

## Controls

- The setting `disableBundledSkills` and the env var `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` remove them.
  The switch is on when the env var is set or the setting is exactly `true` (the program).
  It also empties the list of bundled workflows, so no bundled workflow remains for the `Workflow` tool to run (the program).
  The switch does not turn the `Workflow` tool itself off. Use `disableWorkflows` for that, and see [Agents and Remote Settings](../../configure/settings/agents-and-remote.md). Built-in commands that can be typed, such as `/doctor`, stay available to you.
  The model gets a refusal that names the setting and the env var. Skills from plugins, `.claude/skills`, and `.claude/commands` are not affected.
- Some skills have their own switch. `DISABLE_DOCTOR_COMMAND` hides `/doctor`, and the kill switch above does not remove `/doctor`.
  `CLAUDE_CODE_DISABLE_CLAUDE_API_SKILL` removes `/claude-api`, and `CLAUDE_CODE_DISABLE_CLAUDE_CODE_SKILL` removes the `claude-code` skill (the program, `chunk-ne1755n5.js`).
  `skillOverrides` can turn off any skill by name.
- When the policy `allow_bundled_skills` is not granted, only names in a fixed list stay.
  The list in the program is: `artifact-diagramming`, `batch`, `claude-code-docs`, `code-review`, `commit`, `dataviz`, `debug`, `explain-usage`, `fewer-permission-prompts`, `keybindings-help`, `loop`, `memory-types`, `plugin-authoring`, `pr`, `simplify`, `update-config`, `verify`, `workflow-authoring`.

## Skill Listing

Claude sees each skill as one line in a listing.
The total budget is on [Skills and Commands](index.md#loading-and-controls).
This table holds the size of one line and the order of the `skillOverrides` values.
Source: the program (`chunk-ne1755n5.js`).

| Item | Status | Rule |
| --- | --- | --- |
| Size of one line | <Undocumented /> | A full line is a dash and a space, the name, a colon and a space, and the text. That is the name length plus 4 characters, plus the text. The text is the `description`, then ` - ` and `when_to_use` if set. A newline joins two lines. |
| Cap on the text | <Documented /> | `skillListingMaxDescChars` (default 1,536) cuts the text, and the last character of the cut text is `…`. A cut text is never longer than the cap. |
| Name shown | <Undocumented /> | The name is the skill name. When its short name is not the full name and the short name is also a name that finds this skill, the line adds the short name in parentheses. This adds characters to the line. |
| Name-only line | <Documented /> | A dash, a space, and the name only. That is the name length plus 2 characters. A skill set to `name-only` always gets this form. |
| Order of `skillOverrides` values | <Undocumented /> | From shown most to shown least: `on`, `name-only`, `user-invocable-only`, `off`. When several keys of one skill match (its name, an alias, or its short name), the value that shows least wins. |

## Skills

| Skill | Status | What it does | Notes |
| --- | --- | --- | --- |
| `/doctor` (alias `/checkup`) | <Documented /> | Checks your setup: install, unused extensions, `CLAUDE.md`, hooks, permissions. `/doctor prompt-audit` audits instructions. | Hidden by env var `DISABLE_DOCTOR_COMMAND` or `skillOverrides` `"doctor": "off"`. Needs a workspace. Interactive. |
| `/claude-api` | <Documented /> | A reference for the Claude API and Managed Agents in your language. | Subcommands: `migrate`, `upgrade`, `api-version` (new in `2.1.307`: moves Claude API code to API version `2026-10-21`, per the [release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.307)), `managed-agents-onboard`, `prompt-audit`, `cost-optimize`, `build-eval`, `hillclimb`, `preserved-thinking-migration`, `managed-agents-secure`. Since `2.1.310`, when two server flags (`tengu_cosmic_sketch` and `tengu_typed_trinket`) turn it on, it also searches the project for deprecated or retired model IDs and lists them in a section "Deprecated or Retired Models in This Project" (the program). The `2.1.311` release diff lists `/claude-api` as removed, but the skill is still in `2.1.311`: the startup code still registers it and `CLAUDE_CODE_DISABLE_CLAUDE_API_SKILL` still turns it off (`chunk-g4nq5q2d.js:5257`), and its definition is in `chunk-h6wvrqqj.js:377`. Only the way the program registers it changed, so the diff tool missed it. The built-in plugin `cc-plugin-claude-platform` also offers the same skill, only when no bundled skill has that name, and adds a docs MCP server (`chunk-kx0zkpkp.js:548`, `chunk-kx0zkpkp.js:572`). |
| `/claude-api managed-agents-secure` | <Documented /> | Compares a Managed Agents agent's settings with Anthropic's published security guide. It changes nothing. | New in `2.1.304`. It is unavailable when Claude Code's check on its `ant` commands does not run. Source: the [release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.304) and the program. |
| `/debug` `[issue description]` | <Documented /> | Enables debug logging and investigates. | `disableModelInvocation`. Allowed tools: `Read`, `Grep`, `Glob`. |
| `/batch` `<instruction>` | <Documented /> | Plans a large change. Runs 5 to 30 worktree agents that open pull requests. | `disableModelInvocation`. |
| `/run` | <Documented /> | Launches your app so you can see a change work. | Reads a recorded `run-<name>` skill if one exists. |
| `/run-skill-generator` | <Documented /> | Records how to run the project as `.claude/skills/run-<name>/`. | `disableModelInvocation`. |
| `/verify` | <Documented /> | Tries your change and reports if it works. | Records its recipe in `.claude/skills/verify/SKILL.md`. Since `2.1.312`, `/help` and the `/` command menu show the short text "Try your change and report if it works" (`chunk-g4nq5q2d.js:5172`). Claude gets the long description (`chunk-g4nq5q2d.js:5166`). In `2.1.311` the menu showed the long description (`chunk-g4nq5q2d.js:5166`). Source: the [release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.312) and the program. |
| `/code-review` (alias `/review`), `/loop`, `/simplify`, `/workflow-authoring` | <Documented /> | Named in the docs. | `/workflow-authoring` needs dynamic workflows. |
| `/plugin-authoring` | <Documented /> | Helps you write and share a mod or plugin. | Since `2.1.304`, sharing no longer stops at the secret scan on machines with managed settings or on Team and Enterprise plans. Source: the [release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.304). |
| `/update-config` | <Documented /> | Edits `settings.json`: hooks, permissions, environment variables. | Registered as a bundled skill. |
| `/fewer-permission-prompts` | <Documented /> | Scans transcripts and adds a read-only allowlist to `.claude/settings.json`. | Needs a workspace. |
| `/security-review` | <Documented /> | Reviews pending branch changes for security risks. | A `prompt` command that Claude can also call through the `Skill` tool. Git repositories. |
| `/schedule` (alias `/routines`) | <Documented /> | Creates and manages scheduled remote agents. | A stub with a name, alias, and description. Needs claude.ai. |
| `/keybindings-help` | <Undocumented /> | Helps you edit `~/.claude/keybindings.json`. | `userInvocable:false`, so only Claude runs it. Allowed tool: `Read`. |
| `/claude-in-chrome` | <Gated note="Needs the Chrome extension, or a check passing." /> | Browser automation through the Chrome extension. | No allowed tools. |
| `/design-sync` `[<project hint>]` | <Gated note="Policy allow_design_sync." /> | Pushes design-system components to claude.ai/design. | `disableModelInvocation`. |
| `/commit` | <Undocumented /> <Gated note="An isEnabled check decides." /> | Creates a git commit. It gathers git context first. | A `prompt` command. |
| `/pr` | <Undocumented /> <Gated note="An isEnabled check decides." /> | Creates a GitHub pull request. It gathers branch context first. | A `prompt` command. |
| `/commit-push-pr` | <Undocumented /> | Makes a commit. Pushes it. Opens a pull request. | A `prompt` command. |
| `/dataviz` | <Undocumented /> | Guides Claude when it makes a chart, graph, plot, dashboard, or other data visualization. | A `prompt` command. |
| `/explain-usage` | <Undocumented /> <Gated note="An isEnabled check decides." /> | Explains where the tokens of this session went, with one simple chart. | A `prompt` command. |
| `/artifact-capabilities` | <Undocumented /> <Gated note="An isEnabled check decides." /> | A guide for Artifacts. The program gives no description. | A `prompt` command. |
| `/artifact-design` | <Undocumented /> <Gated note="An isEnabled check decides." /> | Design guidance and fundamentals for Artifacts. | A `prompt` command. |
| `/artifact-diagramming` | <Undocumented /> <Gated note="An isEnabled check decides." /> | Diagramming guidance for Artifacts: when a picture helps, and how to draw it with inline SVG in both themes. | A `prompt` command. |
| `/design` | <Undocumented /> <Gated note="An isEnabled check decides." /> | A design command. The program gives no description. | A `prompt` command. |
| `/claude-code-docs` | <Undocumented /> <Gated note="An isEnabled check decides, and it reads the server flag tengu_birch_kettle." /> | A command for questions about Claude Code. The program gives no description. | A `prompt` command. |
| `/cowork-plugin` | <Undocumented /> <Gated note="Shown in the `remote_cowork` entry point, or since `2.1.319` when `CLAUDE_CODE_COWORK_PLUGIN_SKILL` is set and neither `CLAUDE_CODE_CHILD_SESSION` nor `CLAUDECODE` is set. Cases: `print.cli319.cowork-plugin.none`, `.env`, `.env-child`: results: `.none` false, `.env` true, `.env-child` false (the skill shows in the request only for `.env`)." /> | Creates a new Cowork plugin from scratch, or customizes an installed plugin for an organization. | A `prompt` command. |
| `/setup-claude` (alias `/setup-cowork`) | <Undocumented /> <Gated note="An isEnabled check decides." /> | A guided setup. You pick a role, install a matching plugin, try a skill, and connect tools. | A `prompt` command. |

## Related Pages

- [Skills and Commands](index.md): where skills live and how to turn them off.
- [Slash Commands](slash-commands.md): the built-in commands.
- [Skill Frontmatter](frontmatter.md): the keys named above, such as `disable-model-invocation`.

Source: [Commands](https://code.claude.com/docs/en/commands), [Extend Claude with Skills](https://code.claude.com/docs/en/skills), and the program (the list of bundled skill names and the `allow_bundled_skills` key).
