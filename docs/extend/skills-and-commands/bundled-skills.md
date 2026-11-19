---
title: Bundled Skills
description: Skills that ship inside Claude Code, what each one does, and how to turn them off.
sidebar_position: 4
---

Bundled skills ship inside Claude Code, so you need no files to use them. They are prompts that guide Claude through a common job. For example, `/simplify` reviews changed code and fixes the problems it finds.

You cannot change a bundled skill. You can replace one with your own skill of the same name. Turn them off with the `disableBundledSkills` setting or `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1`. Official pages: [Commands](https://code.claude.com/docs/en/commands) and [Extend Claude with Skills](https://code.claude.com/docs/en/skills).

## Example

```bash
claude -p "/debug the login test fails on CI"
```

`/debug` enables debug logging. It then investigates the issue that you describe.

## Controls

- The setting `disableBundledSkills` and the env var `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS` remove them.
  The switch is on when the env var is set or the setting is exactly `true`.[^switch]
  It also empties the list of bundled workflows, so no bundled workflow remains for the `Workflow` tool to run.[^switch-workflows]
  The switch does not turn the `Workflow` tool itself off. Use `disableWorkflows` for that, and see [Agents and Remote Settings](../../configure/settings/agents-and-remote.md). Built-in commands that can be typed, such as `/doctor`, stay available to you.
  The model gets a refusal that names the setting and the env var. Skills from plugins, `.claude/skills`, and `.claude/commands` are not affected.
- Some skills have their own switch. `DISABLE_DOCTOR_COMMAND` hides `/doctor`, and the kill switch above does not remove `/doctor`.
  `CLAUDE_CODE_DISABLE_CLAUDE_API_SKILL` removes `/claude-api`, and `CLAUDE_CODE_DISABLE_CLAUDE_CODE_SKILL` removes the `claude-code` skill.[^skill-switches]
  `skillOverrides` can turn off any skill by name.
- When the policy `allow_bundled_skills` is not granted, only names in a fixed list stay.
  The fixed list is: `artifact-diagramming`, `batch`, `claude-code-docs`, `code-review`, `commit`, `dataviz`, `debug`, `explain-usage`, `fewer-permission-prompts`, `keybindings-help`, `loop`, `memory-types`, `plugin-authoring`, `pr`, `simplify`, `update-config`, `verify`, `workflow-authoring`.[^allow-list]

## Skill Listing

Claude sees each skill as one line in a listing.
The total budget is on [Skills and Commands](index.md#loading-and-controls).
This table holds the size of one line and the order of the `skillOverrides` values.[^listing]

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
| `/claude-api` | <Documented /> | A reference for the Claude API and Managed Agents in your language. | Subcommands: `migrate`, `upgrade`, `api-version` (moves code to a newer API version, the `anthropic-version` header), `managed-agents-onboard`, `prompt-audit`, `cost-optimize`, `build-eval`, `hillclimb`, `preserved-thinking-migration`, `managed-agents-secure`. When server flags turn it on, it also searches the project for deprecated or retired model IDs and lists them in a section "Deprecated or Retired Models in This Project".[^claude-api] The startup code registers it, and `CLAUDE_CODE_DISABLE_CLAUDE_API_SKILL` turns it off.[^claude-api-311] The built-in plugin `claude-platform` also offers the same skill, only when no bundled skill has that name, and adds a docs MCP server.[^platform] |
| `/claude-api managed-agents-secure` | <Documented /> | Compares a Managed Agents agent's settings with Anthropic's published security guide. It changes nothing. | It is unavailable when Claude Code's check on its `ant` commands does not run.[^secure] |
| `/debug` `[issue description]` | <Documented /> | Enables debug logging and investigates. | `disableModelInvocation`. Allowed tools: `Read`, `Grep`, `Glob`. |
| `/batch` `<instruction>` | <Documented /> | Plans a large change. Runs 5 to 30 worktree agents that open pull requests. | `disableModelInvocation`. |
| `/run` | <Documented /> | Launches your app so you can see a change work. | Reads a recorded `run-<name>` skill if one exists. |
| `/run-skill-generator` | <Documented /> | Records how to run the project as `.claude/skills/run-<name>/`. | `disableModelInvocation`. |
| `/verify` | <Documented /> | Tries your change and reports if it works. | Records its recipe in `.claude/skills/verify/SKILL.md`. `/help` and the `/` command menu show the short text "Try your change and report if it works".[^verify] |
| `/code-review` (alias `/review`) | <Documented /> | Reviews the current diff, a pull request, a branch, or a path. | On most models it reports only bugs and `CLAUDE.md` violations. Run `/simplify` for reuse, simplification, and efficiency cleanups. On most models each finding is marked Important, Pre-existing, or Nit, and the summary ends with a suggested fix. A review with no findings reads "Code review found no issues."[^v328-review] |
| `/loop`, `/simplify`, `/workflow-authoring` | <Documented /> | Named in the docs. | `/workflow-authoring` needs dynamic workflows. |
| `/plugin-authoring` | <Documented /> | Helps you write and share a mod or plugin. | |
| `/update-config` | <Documented /> | Edits `settings.json`: hooks, permissions, environment variables. | Registered as a bundled skill. |
| `/fewer-permission-prompts` | <Documented /> | Scans transcripts and adds a read-only allowlist to `.claude/settings.json`. | Needs a workspace. |
| `/security-review` | <Documented /> | Reviews pending branch changes for security risks. | A `prompt` command that Claude can also call through the `Skill` tool. Git repositories. <Gated note="Server flag tengu_lexical_parnas" /> When the flag is on, the command pre-allows no tools, so its git commands ask first. Otherwise its own `allowed-tools` pre-allows `git diff`, `git status`, `git log`, `git show`, and `git remote show`.[^security] |
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
| `/cowork-plugin` | <Undocumented /> <Gated note="Shown in the `remote_cowork` entry point, or when `CLAUDE_CODE_COWORK_PLUGIN_SKILL` is set and neither `CLAUDE_CODE_CHILD_SESSION` nor `CLAUDECODE` is set. Cases: `print.cli319.cowork-plugin.none`, `.env`, `.env-child`: results: `.none` false, `.env` true, `.env-child` false (the skill shows in the request only for `.env`)." /> | Creates a new Cowork plugin from scratch, or customizes an installed plugin for an organization. | A `prompt` command. |
| `/setup-claude` (alias `/setup-cowork`) | <Undocumented /> <Gated note="An isEnabled check decides." /> | A guided setup. You pick a role, install a matching plugin, try a skill, and connect tools. | A `prompt` command. |

## Related Pages

- [Skills and Commands](index.md): where skills live and how to turn them off.
- [Slash Commands](slash-commands.md): the built-in commands.
- [Skill Frontmatter](frontmatter.md): the keys named above, such as `disable-model-invocation`.

## Sources

[^switch]: The program, `chunk-9r0p8kv9.js:14-18`.
[^switch-workflows]: The program, `chunk-79ch6edx.js:19-23`, which returns an empty list when the switch is on. The setting text in `chunk-jkpzhr7r.js:8931-8935` says that bundled skills and workflows are removed.
[^skill-switches]: The program, `chunk-tsfj8qb8.js:232518-232661`.
[^allow-list]: The program, list of bundled skill names and the `allow_bundled_skills` key, `chunk-4768tt7f.js:435` and `chunk-9r0p8kv9.js:492`.
[^listing]: The program, `chunk-56bhcxay.js:2904410`.
[^claude-api]: The program, `chunk-mjbk2ztg.js:9494` and `chunk-1wwg5b1a.js:11694`. The flags are `tengu_cosmic_sketch` and `tengu_typed_trinket`. The `api-version` text is in the skill file, `SKILL-b7341799.md.zst:9687`; the examples file `examples-27fba5c6.md.zst:394` sends `anthropic-version: 2026-10-21`.
[^claude-api-311]: The program, `chunk-tsfj8qb8.js:232518` (startup registration) and `chunk-2jfxv5rx.js:25833` (definition).
[^platform]: The program, `chunk-2jfxv5rx.js:24660` (the docs server), `chunk-2jfxv5rx.js:24922` (the checks), and `chunk-2jfxv5rx.js:25654` (the skill, enabled only when no bundled skill has its name).
[^secure]: The program, `chunk-mjbk2ztg.js:11740`.
[^verify]: The program, `chunk-tsfj8qb8.js:231265`.
[^security]: The program, `chunk-56bhcxay.js:2301394` and `chunk-56bhcxay.js:2301683`.
[^v328-review]: [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328). The program, severity labels `chunk-tsfj8qb8.js:1583`, empty result text `chunk-tsfj8qb8.js:1618`, command text `chunk-tsfj8qb8.js:2716`, and `/simplify` text `chunk-tsfj8qb8.js:4721`.
