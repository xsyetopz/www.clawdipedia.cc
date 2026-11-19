---
title: Permission Modes
description: The six permission modes, how Claude Code picks one, the reasons it gives for a decision, and its built-in safety checks.
sidebar_position: 2
---

A permission mode sets which tool calls run without a prompt. The modes go from `plan`, which only reads, to `bypassPermissions`, which skips most checks. Pick a stricter mode when you want to review each action. Pick a looser mode for long tasks that you trust.

Run `/permissions` in the chat to change the mode. Start with `claude --permission-mode acceptEdits` to set the mode for one session. Set `permissions.defaultMode` to choose the mode that new sessions start in. Set `permissions.disableBypassPermissionsMode: "disable"` to remove `bypassPermissions`. Set `permissions.disableAutoMode: "disable"` to remove `auto`.

## Example

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "permissions": {
    "defaultMode": "acceptEdits",
    "disableBypassPermissionsMode": "disable"
  }
}
```

New sessions start in `acceptEdits`. Nobody can switch the session to `bypassPermissions`.

## The Six Modes

Claude Code accepts `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, and `plan`. The word `manual` is an alias of `default`. Any other value gives the error `Cannot set permission mode: must be one of acceptEdits, auto, bypassPermissions, default, dontAsk, plan`.[^mode-names]
Official pages: [Configure Permissions](https://code.claude.com/docs/en/permissions) and [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes).
The advice that starts with "Use it" comes from the official page.[^mode-use]

| Item | Status | What it does | How it works | Where to set it |
| --- | --- | --- | --- | --- |
| `default` | <Documented /> | Standard behavior | Prompts for dangerous operations. The picker text is `default (ask each time)`. Use it to review each action yourself, for sensitive work | `--permission-mode`, `defaultMode`, `/permissions` |
| `acceptEdits` | <Documented /> | Auto-accepts file edits | The picker text is `accept edits (auto-approve file edits and common file commands)`. It allows edits inside the workspace. A Bash check says `would be allowed in acceptEdits mode`. Use it to iterate on code that you review | Same |
| `plan` | <Documented /> | Analysis only, no edits | The picker text is `plan mode (research and propose changes without making them)`. With auto mode available, plan mode uses auto mode semantics unless `useAutoModeDuringPlan` is `false`. Use it to explore a codebase before you change it | Same |
| `auto` | <Documented /> | A classifier screens each action | The picker text is `auto (no routine prompts, a reviewer model screens actions)`. See [Auto Mode](auto-mode.md). Use it for long tasks, to reduce prompt fatigue | Same. Project and local settings cannot set it as `defaultMode`[^project-default] |
| `dontAsk` | <Documented /> | Denies what would prompt | The picker text is `don't ask (auto-deny anything that would prompt)`. The deny reason says `Claude Code is running in don't ask mode`. Use it for locked-down CI and scripts | Same |
| `bypassPermissions` | <Documented /> <Caution /> | Skips permission checks | The picker text is `BYPASS PERMISSIONS (no further prompts)`. Explicit `deny` rules still apply. Safety checks marked bypass-immune still ask. Use it only in isolated containers and VMs | Needs `--dangerously-skip-permissions` or `--allow-dangerously-skip-permissions`. Project and local settings cannot set it as `defaultMode`[^project-default] |

Captured system prompts for some modes: [Plan](../../prompts/modes/mode-plan.md), [Accept Edits](../../prompts/modes/mode-acceptEdits.md), and [Don't Ask](../../prompts/modes/mode-dontAsk.md).

## Choosing and Cycling a Mode

- `permissions.defaultMode` sets the start mode. `--permission-mode` wins for one session.
- Project and local settings cannot set `auto` or `bypassPermissions` as the default.[^project-default]
- Since `2.1.323`, when the auto mode killswitch is active, `--permission-mode auto` and `defaultMode: auto` start the session in `default` (Manual), which asks first. The same fallback applies to an agent definition's `permissionMode: auto`.[^killswitch]
- `permissions.disableBypassPermissionsMode` stops `bypassPermissions`. So does a bypass dialog that you did not accept. The errors are `bypassPermissions mode is disabled by settings` and `Cannot set permission mode to bypassPermissions because the session was not launched with --dangerously-skip-permissions`.[^bypass-errors]
- A cloud session cannot use `bypassPermissions`.[^cloud-bypass]
- The IDE host cycles through `acceptEdits`, `plan`, `default`, and `auto`. The order in the terminal is not documented.

## Decision Reasons

Every permission decision carries a `decisionReason` with one of these types. Hooks and SDK hosts can see these types.[^reasons]

| Reason Type | Status | What it means | Text or detail | Seen In |
| --- | --- | --- | --- | --- |
| `rule` | <Undocumented /> | A permission rule decided | An example of the text is `Denied by a permission rule` | Each tool |
| `mode` | <Undocumented /> | The mode decided | For example `dontAsk` denies | Each tool |
| `subcommandResults` | <Undocumented /> | Parts of a compound command decided | Each sub-command has its own reason | `Bash`, `PowerShell` |
| `permissionPromptTool` | <Undocumented /> | An MCP permission prompt tool decided | Set with `--permission-prompt-tool` | Print mode |
| `hook` | <Undocumented /> | A hook decided | `PreToolUse` or `PermissionRequest` | Hooks |
| `asyncAgent` | <Undocumented /> | A background agent has no prompt surface | Denies with `no approval surface in this session` | Background agents |
| `sandboxOverride` | <Undocumented /> | A command runs outside the sandbox | The text is `Run outside of the sandbox` | `Bash` |
| `workingDir` | <Undocumented /> | The path is outside the working directories | The text is `Path is outside allowed working directories` | File tools |
| `safetyCheck` | <Undocumented /> | A built-in safety check fired | See the next table | Each tool |
| `classifier` | <Undocumented /> | The auto mode classifier decided | The text is `Denied by auto mode classifier` or `Allowed by auto mode classifier` | `auto` mode |
| `other` | <Undocumented /> | Anything else | For example a closed permission stream | Hosts |

## Path and Prompt Checks

These changes came in `2.1.327`.[^changes-327]

- Path checks refuse some symbolic links.
- The `2.1.327` release notes say that Claude Code changed what counts as inside a working directory, so some paths now ask for permission.
- A `Bash` command whose variables expand to very long text is denied. The message says: "This command's variables and substitutions expand to more text than the permission check reads, so it was not run. Use fewer or shorter ones, or put the long text in a file."[^long-vars]
- On a permission prompt whose list shows numbers and ends with the No answer, the Down key stops at No instead of wrapping around to the first answer. The release notes also say that a number past the last answer moves to No.
- The release notes say that Esc works on a permission prompt that has just appeared.

## Safety Checks

A `safetyCheck` reason carries a `circuitBreaker` name. Three flags describe the check.
`bypassImmune` means `bypassPermissions` cannot skip it. `classifierRouted` means [auto mode](auto-mode.md) sends it to the classifier.
`hostPersonOnly` means only a person can answer it.

| Check | Status | What it covers | Behavior | Seen In |
| --- | --- | --- | --- | --- |
| `dangerousRemoval` | <Undocumented /> | Critical-path `rm` prompts | Bypass-immune, classifier-routed. A time limit applies unless `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1`. Since `2.1.309`, in `bypassPermissions` mode in the desktop app and VS Code, a dangerous `rm` or `rmdir` is denied at once with a hint to rewrite it, so unattended sessions keep going.[^v309] Since `2.1.327`, when the check cannot parse a command that has no `rm`, the refusal message tells Claude that it can send a command that deletes nothing again in plain syntax that `bash` and `zsh` both read. It also tells Claude that a command that deletes anything needs the user.[^rm-unparsed] | `Bash` |
| `backgroundOperator` | <Undocumented /> | Background operator calls | Classifier-routed | Background sessions |
| `suspiciousWindowsPath` | <Undocumented /> | Odd Windows paths | Classifier-routed | Windows |
| `isolatePeerMachines` | <Documented /> | Peer machine isolation | Bypass-immune. Setting `isolatePeerMachines` | Managed |
| `restrictedMode` | <Undocumented /> | `--restricted` | Bypass-immune | CLI |
| `outsideReadsBlocked` | <Undocumented /> | `blockReadsOutsideWorkingDirectories` | Bypass-immune | File tools, `Bash` |
| `claudeSettingsFile` | <Undocumented /> | Writes to settings files | Only a person answers | File tools |
| `internalHardDeny` | <Undocumented /> | Built-in hard deny | Cannot be placed on a served classifier | Each tool |
| `unfinishedCheck` | <Undocumented /> | A check did not finish | Bypass-immune, person only | Each tool |

Since `2.1.326`, a tool call in `bypassPermissions` mode asks for approval when the permission check of its tool fails with an error. The check has the decision reason `permission_check_crashed`. The message says: "This call has not run: its permission check failed with an error, so it needs approval. Allow rules and bypass mode cannot give that approval." Where no one can be asked, the call is denied.[^crashed-check]

## How It Works

[Permission Flow](../../how-it-works/permission-flow.md) shows the order of the checks and where the mode decides.

## Related Pages

- [Permission Rules](rules.md) for the `allow`, `ask`, and `deny` lists.
- [Auto Mode](auto-mode.md) for the classifier behind `auto`.
- [Sandbox](sandbox.md) for the operating-system wall around `Bash`.
- [All Flags](../cli/flags.md) for the permission flags.

## Sources

[^mode-names]: The program, `chunk-rs68es1f.js:1570`.
[^project-default]: The program, `chunk-hscvkewq.js:6981-7056` and the picker text in `chunk-3h9amnsz.js:10412`.
[^killswitch]: The [`2.1.323` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.323). The program, `chunk-hscvkewq.js:4783` (the `--permission-mode` flag), `chunk-hscvkewq.js:5268` (an agent definition's `permissionMode: auto`), `chunk-hscvkewq.js:6485` (`defaultMode: auto` in an IDE session), and `chunk-hscvkewq.js:8004`. The program logs `auto mode killswitch active (override- or payload-served) — falling back to default`.
[^bypass-errors]: The program, `chunk-hscvkewq.js:8480` and `chunk-tew0988b.js:9837`.
[^cloud-bypass]: The program error text, `chunk-2v0j7fr6.js:24137`.
[^reasons]: The program, `chunk-rs68es1f.js:4373`.
[^changes-327]: The symbolic link refusals are in the program at `chunk-rq7vgh0h.js:1132-1149`, with the text "Refusing to read a file whose path could not be vetted". The list control stops the Down key at the last row in the program at `chunk-rmkp9aqw.js:3571` (`stopsAtLastRow`). The list turns this on at `chunk-rmkp9aqw.js:27998` when the permission prompt frame sets it, the numbers show, and the last answer is the decline answer. The permission prompt frame sets it at `chunk-nr1xrxn3.js:3108`. The other items in this list are from the [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
[^long-vars]: The program, `chunk-56bhcxay.js:87603`. [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
[^v309]: [`2.1.309` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.309).
[^mode-use]: Official page [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes), table "Available modes", column "Best for".
[^crashed-check]: The program, `chunk-56bhcxay.js:3724731` (the decision reason), `chunk-56bhcxay.js:3724997` (the message), `chunk-56bhcxay.js:3736639` (the crash becomes an ask before the mode decides), and `chunk-56bhcxay.js:3734494` (the refusal text where no one can be asked). [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^rm-unparsed]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-56bhcxay.js:1564037`. The `2.1.326` message ends after `This requires explicit approval.`
