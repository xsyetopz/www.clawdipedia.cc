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
- Booleans accept `true`, `false`, `yes`, `no`, `on`, `off`, `1`, and `0` in any case.[^bool]
- A top-level `PreToolUse` or `PermissionRequest` key outside `hooks` is an error. The skill then loads with no hooks and no `allowed-tools`.
- If `description` is missing, Claude Code uses the first line of the body. It removes heading marks and cuts the text at 100 characters.

## Keys

| Key | Status | What it does | Notes |
| --- | --- | --- | --- |
| `name` | <Documented /> | The command name. | Defaults to the folder name. At most 256 characters. Skills and plugin skills only, not command files. Claude Code refuses a skill or command name with a Bamum letter, which some fonts draw as blank.[^bamum] |
| `description` | <Documented /> | Tells Claude when to use the skill. | Numbers and booleans become strings. The listing cuts it at 1,536 characters. |
| `when_to_use` | <Documented /> | More trigger text. | Claude Code adds it after `description`. Counts toward the 1,536 limit. The only documented key with an underscore. |
| `argument-hint` | <Documented /> | An autocomplete hint. | Text, for example `[issue-number]`. |
| `arguments` | <Documented /> | Names for `$name` placeholders. | A space-separated string or a YAML list. Claude Code drops names made only of digits. |
| `disable-model-invocation` | <Documented /> | Stops Claude from loading the skill by itself. | Also blocks preload into subagents and use by scheduled tasks. |
| `user-invocable` | <Documented /> | `false` hides the skill from the `/` menu. | Default `true`. |
| `allowed-tools` | <Documented /> | Tools allowed without a prompt for the turn. | A space or comma string, or a list. The grant clears at your next message. Ignored under `allowManagedPermissionRulesOnly`, except for managed and bundled skills and plugins from an admin-backed channel. Host-delivered `--plugin-dir` plugins in Claude Desktop keep their `allowed-tools` only while the organization's own managed settings do not set `allowManagedPermissionRulesOnly`.[^managed-tools] `${CLAUDE_SKILL_DIR}` works in Bash rules. |
| `disallowed-tools` | <Documented /> | Removes tools while the skill is active. | The same format. Claude Code also reads `disallowedTools`. |
| `model` | <Documented /> | The model for the turn. | `inherit` keeps the active model. A model outside `availableModels` is not used. With `context: fork` it sets the subagent model. |
| `effort` | <Differs note="Docs: low, medium, high, xhigh, max. The program also accepts an integer." /> | The effort level for the turn. | Claude Code warns `Valid options: ... or an integer`. |
| `context` | <Documented /> | `fork` runs the skill in a subagent. | Claude Code ignores any other value. |
| `agent` | <Documented /> | The subagent type for `context: fork`. | Default `general-purpose`. |
| `background` | <Documented /> | `false` waits for the forked result. | Default `true`.[^background] |
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

Claude Code finds per-directory skills and `paths` skills after a Bash command moves the working directory deeper into the same git repository.
When Claude Code reads or writes a file, it walks up from the file to a base directory and looks for `.claude/skills` on the way.
It also tests the `paths` globs of conditional skills against the file path, relative to that base.
The base is the directory where the session started when all of these are true:

- The working directory is not the directory where the session started.
- The working directory is inside that directory.
- Both directories are in the same git repository.

In any other case, the base is the working directory.
For a file outside the working directory, Claude Code skips a `.claude/skills` folder that git ignores or that it cannot confirm.[^discovery]

## Outside Claude Code

claude.ai uploads and the Skills API accept only `name`, `description`, `license`, `compatibility`, `metadata`, and `allowed-tools`.
Other keys fail the upload.

## Exact Fields

The exact fields are in the `skill` definition in `https://clawdipedia.cc/schemas/claude-code-frontmatter.json`. It comes from the frontmatter validators of Claude Code and lists every field of this release. Look a field up there before you rely on it.[^validators]

## Related Pages

- [Skills and Commands](index.md): where skills live.
- [Substitutions](substitutions.md): `$ARGUMENTS` and shell injection.
- [Hooks](../hooks/index.md): the `hooks` key.
- [Subagent Frontmatter](../subagents/frontmatter.md): the keys of an agent file.

## Sources

[^bamum]: The program, `chunk-hg1yqkjk.js:48543` (the name rule message, "blank-like characters") and `chunk-k936fbc4.js:584` (its pattern of blank-looking characters holds `\u{16910}`, a Bamum letter).
[^managed-tools]: The program, `chunk-t39fw2cy.js:8705-8710` (`allowManagedPermissionRulesOnly` and its `allowed-tools` text in the bundled settings schema).
[^bool]: The program, `chunk-32gs4rex.js:4032-4042` (the boolean reader `$c6b0fd`) and `chunk-cqahc80t.js:7-17` (the accepted words `1`, `true`, `yes`, `on`, `0`, `false`, `no`, and `off`, after lowercase and trim).
[^background]: The program, `chunk-hg1yqkjk.js:46556-46559` (`background` in the frontmatter schema).
[^discovery]: The program, `chunk-hg1yqkjk.js:281357-281358` for the base directory and the walk of `.claude/skills` folders (`while (c1.startsWith(a7 + $8ec263_7))`), and `chunk-hg1yqkjk.js:281376` and `chunk-hg1yqkjk.js:281381` for the skip ("Skipped gitignored or unconfirmed skills dir").
[^validators]: The program, the `skill` frontmatter schema, `chunk-hg1yqkjk.js:46530` (it extends the shared schema) and `chunk-hg1yqkjk.js:46588` (the fields for a `skill` only). See also [Extend Claude with Skills](https://code.claude.com/docs/en/skills) and [Settings Reference](https://code.claude.com/docs/en/settings-reference).
