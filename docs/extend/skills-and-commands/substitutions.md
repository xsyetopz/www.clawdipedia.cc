---
title: Substitutions and Invocation
description: Placeholders that Claude Code fills into a skill, shell injection, and the keys that control who can run a skill.
sidebar_position: 3
---

A skill body can hold placeholders that Claude Code fills in when the skill runs.
It can also run shell commands and insert their output.
For example, `$ARGUMENTS` in a `SKILL.md` file becomes the text that you type after the command.

`disableSkillShellExecution` disables shell injection. `disable-model-invocation` and `user-invocable` control who can run a skill.

## Example

```text title=".claude/skills/fix-issue/SKILL.md"
---
description: Fix a GitHub issue by number.
arguments: issue
allowed-tools: Bash(gh issue view *)
---

Issue details:
!`gh issue view $issue --json title,body`

Fix issue $issue. Session: ${CLAUDE_SESSION_ID}.
```

Type `/fix-issue 42`. Claude Code runs `gh issue view 42`. It inserts the output. It then sends the whole text to Claude.

## String Substitutions

| Placeholder | Status | What it becomes | Notes |
| --- | --- | --- | --- |
| `$ARGUMENTS` | <Documented /> | All arguments as typed. | With no placeholder in the skill, Claude Code appends `ARGUMENTS: <value>`. |
| `$ARGUMENTS[N]`, `$N` | <Documented /> | One argument by index, counting from 0. | Shell-style quotes group words. A missing index stays as text. |
| `$name` | <Documented /> | A named argument from the `arguments` key. | A missing value gives an empty string. |
| `\$1` | <Documented /> | The literal text `$1`. | One backslash before a token escapes it. `\\$1` still expands. |
| `${CLAUDE_SESSION_ID}` | <Documented /> | The session ID. | Claude Code does not replace it in synced skills. |
| `${CLAUDE_EFFORT}` | <Documented /> | The current effort level. | `low` to `max`. |
| `${CLAUDE_SKILL_DIR}` | <Documented /> | The folder of the `SKILL.md`. | Claude Code also replaces it in `allowed-tools` Bash rules. In a plugin it is the skill subfolder. |
| `${CLAUDE_PROJECT_DIR}` | <Documented /> | The project root. | Claude Code replaces it in the body and in `allowed-tools`. |
| `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` | <Documented /> | Plugin paths. | Plugin skills only. |
| `${user_config.KEY}` | <Documented /> | A saved plugin option. | Claude Code fills only non-sensitive values in skill and agent content. |
| Total size cap | <Undocumented /> | Stops huge fills. | The error says "This skill, command or hook and the arguments filled into it add up to more than N characters". Claude Code marks argument values, so a `$` inside them is not expanded.[^size-cap] |

## Shell Injection

| Syntax or setting | Status | What it does | Notes |
| --- | --- | --- | --- |
| `` !`command` `` | <Documented /> | Runs a command and inserts its output. | Only at the start of a line or after whitespace. Claude Code does not scan the output again. User, project, and plugin skills. |
| A fenced block with `!` after the opening backticks | <Documented /> | A multi-line command. | The same rules. |
| A failing command | <Documented /> | Aborts the whole invocation. | The error is `Shell command failed for pattern "..."`. Exit code 1 from search commands is a normal result. A permission failure says `Shell command permission check failed`. |
| `disableSkillShellExecution` | <Documented /> | Replaces each command with `[shell command execution disabled by policy]`. | The setting does not affect bundled and managed skills. |
| Synced skills | <Documented /> | Never run `!` commands. | Claude Code also does not expand `@` files or two placeholders. |

## Invocation Control

| Rule | Status | What it does | Notes |
| --- | --- | --- | --- |
| Default | <Documented /> | You and Claude can both run the skill. | The description is always in context. |
| `disable-model-invocation: true` | <Documented /> | Only you can run it. | The description is not in context. |
| `user-invocable: false` | <Documented /> | Only Claude can run it. | Claude Code hides the skill from the `/` menu. |
| A name at the start of a message | <Documented /> | Runs the skill. | After plain text it only grants permission. You can stack up to five more skills in a terminal prompt. |
| `Skill(name)` and `Skill(name *)` rules | <Documented /> | Permission rules for the `Skill` tool. | A deny on an alias blocks the bundled skill. Allow rules match the skill name only. |
| Lifecycle | <Documented /> | The skill text stays in the conversation. | An identical second run adds a short note. Compaction keeps 5,000 tokens for each skill and 25,000 in total. See [Context and Compaction](../../how-it-works/context-and-compaction.md). |
| `context: fork` | <Documented /> | Runs the skill in a subagent. | Background by default. It waits in `-p`, with `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, and for scheduled tasks. |
| Commit-time skills | <Undocumented /> | The skill names `verify`, `simplify`, and `code-review`. | When a skill of one of these names is loaded, the commit text tells Claude to run it right before `commit`: `/verify`, `/simplify`, and `/code-review medium`. A `simplify` skill counts only when it comes from your `skills` or `commands` files. `code-review` counts only when the `includeCodeReviewSuggestion` setting is `true`.[^commit-skills] |

## Related Pages

- [Skills and Commands](index.md): where skills live.
- [Skill Frontmatter](frontmatter.md): `arguments`, `allowed-tools`, `context`.
- [Subagent Runtime](../subagents/runtime.md): what a forked skill runs in.

## Sources

[^size-cap]: The program, the strings quoted in this table, `chunk-hg1yqkjk.js:48629` (the error text) and `chunk-hg1yqkjk.js:48594` (the limit, `4000000`).
[^commit-skills]: The program, the skill checks, `chunk-hg1yqkjk.js:107759` (`simplify`, from `skills` or `commands` files) and `chunk-hg1yqkjk.js:107768` (`includeCodeReviewSuggestion`), the text, `chunk-hg1yqkjk.js:107786` (`right before the` `commit` command), and the skill names, `chunk-dyvy28wy.js:14` (`verify`, `code-review`, and `simplify`).

Official pages: [Extend Claude with Skills](https://code.claude.com/docs/en/skills) and [Settings Reference](https://code.claude.com/docs/en/settings-reference).
