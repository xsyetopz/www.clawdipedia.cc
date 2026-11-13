---
title: Permission Rules
description: The rule syntax for allow, ask, and deny lists, every permissions key, the flags and hooks that touch permissions, and permission updates.
sidebar_position: 3
---

A permission rule names a tool, and it can name a pattern for that tool.
Three lists hold the rules. `allow` runs a call with no prompt. `ask` always prompts. `deny` blocks the call.
For example, `Bash(git push:*)` in `deny` stops each `git push` command.

Add rules to `permissions.allow`, `permissions.ask`, or `permissions.deny` in a settings file. Or run `/permissions`. Or pass `--allowedTools` and `--disallowedTools` for one session. Remove a rule to turn it off. `allowManagedPermissionRulesOnly` turns off rules from every scope except managed settings.

## Example

```json title=".claude/settings.json"
{
  "permissions": {
    "allow": ["Bash(bun test)", "Bash(git diff *)", "Read(src/**)"],
    "ask": ["Bash(git commit *)"],
    "deny": ["Bash(git push:*)", "Read(.env)", "WebFetch"],
    "additionalDirectories": ["../shared-lib"]
  }
}
```

## The `permissions` Keys

Lists from all scopes merge. Official pages: [Configure Permissions](https://code.claude.com/docs/en/permissions) and [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes).

| Item | Status | What it does | How it works | Where to set it |
| --- | --- | --- | --- | --- |
| `permissions.allow` | <Documented /> | List of rules for allowed operations | Lists from all scopes merge. Project `allow` rules wait for workspace trust. `allowManagedPermissionRulesOnly` limits them to managed settings | Each settings scope |
| `permissions.ask` | <Documented /> | List of rules that always prompt | `ask` and `deny` rules apply at once, before trust. An `allow` rule in a local file does not outrank an `ask` rule from a project or managed file | Each settings scope |
| `permissions.deny` | <Documented /> | List of rules for denied operations | A bare tool name hides the tool from the model. See Tools | Each settings scope |
| `permissions.defaultMode` | <Documented /> | Default permission mode | `manual` is an alias of `default`. `auto` and `bypassPermissions` do not take effect from project or local settings | User, managed, `--settings` |
| `permissions.disableBypassPermissionsMode` | <Documented /> | Value `disable` removes `bypassPermissions` | Claude Code checks it when a session starts in that mode or can return to it | Mainly managed settings |
| `permissions.blockReadsOutsideWorkingDirectories` | <Documented /> | Refuses `Read`, `Grep`, `Glob`, and `LSP` reads outside the working directories in each mode | `true` from any scope wins, also over a managed `false`. No allow rule lifts it. Needs `2.1.257`. Since `2.1.323` it also binds shell commands: a command that names a path outside the working directories asks in every mode, and the sandbox, where it is on, denies such reads. A command whose path is computed at run time, or that the shell parser cannot analyze, also asks. The refusal text names the key | Each settings scope |
| `permissions.blockFileToolReadsOutsideWorkingDirectories` | <Undocumented /> | Refuses reads outside the working directories other than a shell command's, in every mode | Boolean. Same as `blockReadsOutsideWorkingDirectories` without its hold on the shell: it does not limit shell commands, sandboxed or not, nor what MCP servers and hook programs read by themselves. It covers the file tools (`Read`, `Grep`, `Glob`, `LSP`) and other built-in tools that send or publish a file, attachments, connectors' file inputs, Chrome uploads, memory recall, and the `CLAUDE.md` includes and memory of a project. No allow rule lifts it, and `blockReadsExemptPaths` applies to it. Only the starting directory, `--add-dir`, and the `additionalDirectories` of `--settings` (or of settings the host program sends later) count as working directories. Claude Code's own files in its configuration folder stay readable. It does not limit writes, but `Edit` and `Write` need a file read first, so only a shell command such as `cat` can do that. The refusal text is `Reads outside the working directories are blocked (permissions.blockFileToolReadsOutsideWorkingDirectories).` Source: the settings schema, marked `@internal` | Only `--settings` at launch, for the program that starts Claude Code. Other scopes and settings sent to a running session ignore it |
| `permissions.blockWritesOutsideWorkingDirectories` | <Documented /> | Refuses `Write`, `Edit`, and `NotebookEdit` writes outside the working directories in each mode | `true` from any scope wins. No allow rule lifts it. It also refuses a write to a Claude Code settings file inside the working directories. It removes `EnterWorktree` and `ExitWorktree` from the tools on offer. It does not limit shell commands, MCP tools, the programs that hooks run, or the memory tools. See [Files, Search, and Memory](../../reference/tools/files.md#write-and-edit-limits) | Each settings scope |
| `permissions.additionalDirectories` | <Documented /> | Extra directories in the permission scope | Applies after workspace trust. `--add-dir` and `/add-dir` do the same for one session | Each settings scope |
| `permissions.disableAutoMode` | <Documented /> | Value `disable` turns auto mode off | The reason text is `disableAutoMode in settings`. See [Auto Mode](auto-mode.md) | Settings, mainly managed |
| `permissions.blockReadsExemptPaths` | <Undocumented /> | Absolute paths that `blockReadsOutsideWorkingDirectories` and `blockFileToolReadsOutsideWorkingDirectories` let through beside the working directories | Array of strings. Each path is a folder with all below it, or one file. It allows nothing: allow rules, the permission mode, or the user still decide each read. The paths do not become working directories. Claude Code takes each path as written: it follows no link and expands no pattern. It ignores an entry that starts with `~`, has a `..` segment, has white space at either end, is a relative or network path, or is a filesystem root. It does not change what sandboxed commands read. Source: the settings schema | Only `--settings` and settings that the host program sends. Other scopes ignore it |
| `permissions.denyInsteadOfPrompting` | <Undocumented /> | Deny a tool call at once when it would wait for a permission prompt | Boolean. The model is told and the turn goes on. `--permission-prompts none` does the same for `-p`. Subagents and agent teams are included. Allow rules, the permission mode, auto mode's classifier, and `PermissionRequest` hooks decide first. The key only denies. It removes `AskUserQuestion` and the plan mode tools. A request for input from an MCP server is cancelled unless an `Elicitation` hook answers it. `canUseTool` and `--permission-prompt-tool` are not asked. `true` from any source wins. New in `2.1.319` ([v2.1.319 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.319)). Cases `print.api319.tool.exit-plan.direct-deny` and `.teammate-deny`: see [Agents and Tasks](../../reference/tools/agents-and-tasks.md) | User, managed, `--settings`. Project and local settings are ignored |
| `permissions.workingDirectoriesAsGiven` | <Undocumented /> | Absolute paths of working directories, spelled as passed | Array of strings. Claude Code takes each path as written, with letter case, and follows no link at it. List real paths. It adds no working directory and allows nothing. A listed path stays listed until the process ends. It ignores an entry that is not normalized: a relative path, a path that starts with `~`, a `..` segment, a trailing separator (except a filesystem root), forward slashes on Windows, or white space at either end. It does not change what sandboxed commands write. Source: the settings schema | Only `--settings` and settings that the host program sends. Other scopes ignore it |

## Related Top-Level Keys

| Item | Status | What it does | How it works | Where to set it |
| --- | --- | --- | --- | --- |
| `allowManagedPermissionRulesOnly` | <Documented /> | Only managed settings supply permission rules | Rules from other scopes are ignored with a notice that names this key. Since `2.1.305`, plugins that Claude Desktop mounts by path no longer keep their `allowed-tools` ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)) | Managed settings |
| `skipDangerousModePermissionPrompt` | <Documented /> | The user accepted the bypass dialog | Boolean | User settings |
| `skipAutoPermissionPrompt` | <Documented /> | The user accepted the auto mode opt-in dialog | Boolean | Settings |
| `useAutoModeDuringPlan` | <Documented /> | Plan mode uses auto mode semantics when auto mode is available | The default is `true`. A `false` from managed, `--settings`, user, or local settings wins | Settings |
| `autoMode` | <Documented /> | Classifier rules | See [Auto Mode](auto-mode.md) | User, `--settings`, managed |
| `sandbox` | <Documented /> | Bash sandbox | See [Sandbox](sandbox.md) | Each settings scope |

## Rule Syntax

A rule has the form `Tool` or `Tool(content)`.
The tool name is case-sensitive. The content has no space at its start or end inside the parentheses.
Source: the program text `tool name case-sensitive, non-empty content with no leading/trailing whitespace inside the parens`.

| Form | Status | What it matches | Notes |
| --- | --- | --- | --- |
| `Bash(bun test)`, `PowerShell(...)` | <Documented /> | Shell commands by pattern. | `*` is a wildcard. `\*` is a literal star. A pattern that ends in a space and one star also matches the bare command. |
| `Bash(git push:*)` | <Documented /> | The legacy prefix form. | The suffix `:*` matches the prefix before it. Use `Bash(git push *)` in new rules. |
| `Read(src/**)`, `Edit(...)` | <Documented /> | Files by glob. | `**` crosses folders. A rule that starts with `/` anchors at the primary working folder. |
| `WebFetch(domain:example.com)` | <Documented /> | One host. | Claude Code requires the prefix `domain:`. It allows `domain:*.example.com`. It rejects a full URL. |
| `WebSearch(terms)` | <Documented /> | Exact search terms. | Claude Code rejects the wildcards `*` and `?`. |
| `mcp__server`, `mcp__server__tool` | <Undocumented /> | All tools of one MCP server, or one tool. | The program pattern is `^mcp__[\w-]+(?:__(?:[\w.-]+\|\*))?$`. |
| `Skill(name)` | <Documented /> | One skill. | The program text is `Skill execution blocked by permission rules`. |
| `Bash` (no content) | <Documented /> | The whole tool. | In `deny`, a bare tool name hides the tool from the model. |
| `cp` and `mv` in a `Bash` command | <Documented /> | The path checks for `cp`, `mv`, `rm`, `rmdir`, and `tee`. | Since `2.1.321`, a command name spelled with a path, such as `/bin/cp`, gets the same path checks as `cp`. The program cuts the command name to the text after the last `/` or `\` and tests it against that list (`chunk-2x9ma4k7.js:1298309`, used at `:1294726` and `:1294726`). Also since `2.1.321`, deny rules and the protected-file prompt apply to the file that `cp` or `mv` writes when the last argument is a directory ([2.1.321 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). For `cp` and `mv`, the program counts every argument but the last as a path to read (`chunk-2x9ma4k7.js:1285399`). The page did not read the code that builds the written file for a directory target. |

:::tip
Explicit `deny` and `ask` rules apply before `allow` rules.
See [Permission Flow](../../how-it-works/permission-flow.md).
:::

## Flags and Hooks That Touch Permissions

| Item | Status | What it does | How it works | Where to set it |
| --- | --- | --- | --- | --- |
| `--permission-mode <mode>` | <Documented /> | Sets the mode for one session | Choices `acceptEdits`, `auto`, `bypassPermissions`, `manual`, `dontAsk`, `plan` | CLI |
| `--allowedTools`, `--disallowedTools` | <Documented /> | Allow or deny tool rules for one session | Comma or space separated, such as `"Bash(git *) Edit"` | CLI |
| `--dangerously-skip-permissions` | <Documented /> | Same as `--permission-mode bypassPermissions` | Use only in sandboxes with no internet | CLI |
| `--allow-dangerously-skip-permissions` | <Documented /> | Makes bypass available without enabling it | You can choose the mode later | CLI |
| `--permission-prompts <host\|none>` | <Documented /> | Who answers prompts with `--print` | `none` denies every prompt. The mode still decides the rest | CLI print mode |
| `--restricted` | <Documented /> | Restricted mode | It refuses `bypassPermissions`. It confines file tools to the working directories. Env `CLAUDE_CODE_RESTRICTED=1` | CLI |
| `PermissionRequest` hook | <Documented /> | Answers a prompt | Output `decision.behavior` is `allow` (with `updatedInput`, `updatedPermissions`) or `deny` (`message`, `interrupt`) | Hooks |
| `PermissionDenied` hook | <Documented /> | Fires on an auto mode denial | Output `retry` | Hooks |

## Permission Updates

A `PermissionUpdate` changes rules or the mode. Hooks and SDK hosts send and receive them.

| Field | Values |
| --- | --- |
| `type` | `addRules`, `replaceRules`, `removeRules`, `setMode`, `addDirectories`, `removeDirectories` |
| `destination` | `userSettings`, `projectSettings`, `localSettings`, `session`, `cliArg` |
| rule value | An object with `toolName` and `ruleContent`. |

Source: `PermissionUpdate` in the Mod API type file of the 2.1.322 program (`schemas/claude-code.d.ts`).

### Session-Only Allow Rules

Since `2.1.323`, an `addRules` or `replaceRules` update that adds an `allow` rule is split before it is saved. The program moves a rule to the `session` destination and does not save it when one of these holds. The destinations `session` and `cliArg` are not checked.

| Reason | Status | When it applies | Text shown |
| --- | --- | --- | --- |
| `holds_secret` | <Undocumented /> | The tool name and rule content match a secret pattern | `Allowed for this session only. The rule looks like it contains a secret, so it isn’t saved to settings.` |
| `scan_failed` | <Undocumented /> | The secret check threw an error | `Allowed for this session only. The rule couldn’t be checked for secrets, so it isn’t saved to settings.` |
| `tracked_by_git` | <Undocumented /> | The destination is `localSettings` and git tracks `.claude/settings.local.json` | `Allowed for this session only. Git tracks .claude/settings.local.json, so the rule isn’t saved there.` |

A rule that the `allow` list of the destination file already holds is not moved. A `removeRules` update for an `allow` rule in a saved destination also removes the rule from `session`.
Source: the program (`chunk-ny35jjxw.js:212300`).

## How It Works

[Permission Flow](../../how-it-works/permission-flow.md) shows how Claude Code walks the lists, the hooks, and the mode.

## Related Pages

- [Permission Modes](modes.md)
- [Sandbox](sandbox.md)
- [Auto Mode](auto-mode.md)
- [All Flags](../cli/flags.md)
