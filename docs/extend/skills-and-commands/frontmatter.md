---
title: Skill Frontmatter
description: Every key you can set at the top of a SKILL.md file, with rules for how Claude Code reads them.
sidebar_position: 2
---

The frontmatter is the block of keys at the top of a `SKILL.md` file.
It sets the name, the description, the tools the skill may use, and who may call it.
For example, `disable-model-invocation: true` makes a skill that only you can start.

Use `disable-model-invocation` and `user-invocable`, or the `skillOverrides` setting, to turn a skill off.

## Example

```text title=".claude/skills/review/SKILL.md"
---
name: review
description: Review the current branch for bugs.
when_to_use: Use when the user asks for a code review.
argument-hint: "[path]"
allowed-tools: Read Grep Glob
model: inherit
effort: high
context: fork
agent: general-purpose
paths:
  - "src/**"
---

Review the changes under $ARGUMENTS and list the bugs you find.
```

## Rules

- Claude Code reads the frontmatter only when the first line is `---`.
- A YAML error loads the skill with no fields. You see the warning `[skills] YAML frontmatter ... failed to parse and was ignored`.
- Keys are case-sensitive. Claude Code ignores an unknown key with no error.
- Booleans accept `true`, `false`, `yes`, `no`, `on`, `off`, `1`, and `0` in any case (2.1.218 or later).
- A top-level `PreToolUse` or `PermissionRequest` key outside `hooks` is an error. The skill then loads with no hooks and no `allowed-tools`.
- If `description` is missing, Claude Code uses the first line of the body. It removes heading marks and cuts the text at 100 characters.

## Keys

| Key | Status | What it does | Notes |
| --- | --- | --- | --- |
| `name` | <Documented /> | The command name. | Defaults to the folder name. At most 256 characters. Skills and plugin skills only, not command files. Claude Code refuses a skill or command name with a Bamum letter, which some fonts draw as blank ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). The program's set of blank-looking characters holds `U+16910`, a Bamum letter (`chunk-d68rqgan.js:5943`). I did not trace the call from the skill name check. |
| `description` | <Documented /> | Tells Claude when to use the skill. | Numbers and booleans become strings. The listing cuts it at 1,536 characters. |
| `when_to_use` | <Documented /> | More trigger text. | Claude Code adds it after `description`. Counts toward the 1,536 limit. The only documented key with an underscore. |
| `argument-hint` | <Documented /> | An autocomplete hint. | Text, for example `[issue-number]`. |
| `arguments` | <Documented /> | Names for `$name` placeholders. | A space-separated string or a YAML list. Claude Code drops names made only of digits. |
| `disable-model-invocation` | <Documented /> | Stops Claude from loading the skill by itself. | Also blocks preload into subagents and use by scheduled tasks. |
| `user-invocable` | <Documented /> | `false` hides the skill from the `/` menu. | Default `true`. |
| `allowed-tools` | <Documented /> | Tools allowed without a prompt for the turn. | A space or comma string, or a list. The grant clears at your next message. Ignored under `allowManagedPermissionRulesOnly` (2.1.282). Since 2.1.305, plugins that Claude Desktop mounts by path no longer keep their `allowed-tools` when your organization's managed settings set it ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). `${CLAUDE_SKILL_DIR}` works in Bash rules. |
| `disallowed-tools` | <Documented /> | Removes tools while the skill is active. | The same format. The program also reads `disallowedTools`. |
| `model` | <Documented /> | The model for the turn. | `inherit` keeps the active model. A model outside `availableModels` is not used. With `context: fork` it sets the subagent model. |
| `effort` | <Differs note="Docs: low, medium, high, xhigh, max. The program also accepts an integer." /> | The effort level for the turn. | The program warns `Valid options: ... or an integer`. |
| `context` | <Documented /> | `fork` runs the skill in a subagent. | Claude Code ignores any other value. |
| `agent` | <Documented /> | The subagent type for `context: fork`. | Default `general-purpose`. |
| `background` | <Documented /> | `false` waits for the forked result. | Default `true`. 2.1.218 or later. |
| `hooks` | <Documented /> | Hooks that start when the skill runs. | They last for the session. See [Hooks](../hooks/index.md). |
| `paths` | <Documented /> | A glob limit for automatic loading. | Claude Code removes a trailing `/**`. A list of only `**` means no limit. Skills only. |
| `shell` | <Documented /> | The shell for `` !`cmd` `` blocks. | `bash` or `powershell`. Other values cause a warning. Claude Code then uses bash. |
| `metadata` | <Documented /> | A free map for your own tools. | Claude Code drops it when it is not a map. |
| `license` | <Documented /> | An Agent Skills spec field. | Claude Code accepts it. It has no effect. |
| `compatibility` | <Documented /> | An Agent Skills spec field. | A string up to 500 characters. No effect. |
| `version` | <Documented /> | Skill version text. | Claude Code reads it as a string. Not in the docs key table. For skills and plugin commands. |
| `fallback` | <Documented /> | A boolean that the loader reads. | The loader parses it with the boolean rule above. |
| `created_by`, `improved_by` | <Undocumented /> | Mark a skill as made by the `dream-proposal` flow. | Only the value `dream-proposal` counts. The env var `CLAUDE_CODE_SKILL_PROPOSALS` exists. |
| `experimental` | <Documented /> <Experimental /> | A map. Claude Code records its key names. | Only the key names go into `declaredFields`. |

## Skill Discovery with Bash `cd`

Since `2.1.312`, Claude Code finds per-directory skills and `paths` skills after a Bash command moves the working directory deeper into the same git repository.
When a file is read or written, the program walks up from the file to a base directory. It looks for `.claude/skills` on the way.
It also tests the `paths` globs of conditional skills against the file path, relative to that base.
The base is now the directory where the session started, when all of these are true:

- The working directory is not the directory where the session started.
- The working directory is inside that directory.
- Both directories are in the same git repository.

In any other case, the base is the working directory.
For a file outside the working directory, the program skips a `.claude/skills` folder that git ignores or that it cannot confirm.
Source: the program (`chunk-9r1hbf9p.js` lines 172206 to 172220 and 171993 to 172054).

## Outside Claude Code

claude.ai uploads and the Skills API accept only `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`.
Other keys fail the upload.

## Exact Fields

The exact fields are in the `skill` definition in `https://clawdipedia.cc/schemas/claude-code-frontmatter.json`. It comes from the program's frontmatter validators.
It lists every field of this release. Build on the fields that it names. Look each one up there before you rely on it.

## Related Pages

- [Skills and Commands](index.md): where skills live.
- [Substitutions](substitutions.md): `$ARGUMENTS` and shell injection.
- [Hooks](../hooks/index.md): the `hooks` key.
- [Subagent Frontmatter](../subagents/frontmatter.md): the keys of an agent file.

Source: [Extend Claude with Skills](https://code.claude.com/docs/en/skills), [Settings Reference](https://code.claude.com/docs/en/settings-reference), and the program (the frontmatter parser).
