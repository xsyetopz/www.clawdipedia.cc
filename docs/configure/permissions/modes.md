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
- When the auto mode killswitch is active, `--permission-mode auto` and `defaultMode: auto` start the session in `default` (Manual), which asks first. The same fallback applies to an agent definition's `permissionMode: auto`.[^killswitch]
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

- Path checks refuse some symbolic links.[^changes-327]
- A `Bash` command whose variables expand to very long text is denied. The message says: "This command's variables and substitutions expand to more text than the permission check reads, so it was not run. Use fewer or shorter ones, or put the long text in a file."[^long-vars]
- On a permission prompt whose list shows numbers and ends with the No answer, the Down key stops at No instead of wrapping around to the first answer.[^changes-327]

## Safety Checks

A `safetyCheck` reason carries a `circuitBreaker` name. Three flags describe the check.
`bypassImmune` means `bypassPermissions` cannot skip it. `classifierRouted` means [auto mode](auto-mode.md) sends it to the classifier.
`hostPersonOnly` means only a person can answer it.

| Check | Status | What it covers | Behavior | Seen In |
| --- | --- | --- | --- | --- |
| `dangerousRemoval` | <Undocumented /> | Critical-path `rm` prompts | Bypass-immune, classifier-routed. A time limit applies unless `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1`. When the check cannot parse a command that has no `rm`, the refusal message tells Claude that it can send a command that deletes nothing again in plain syntax that `bash` and `zsh` both read. It also tells Claude that a command that deletes anything needs the user.[^rm-unparsed] | `Bash` |
| `backgroundOperator` | <Undocumented /> | Background operator calls | Classifier-routed | Background sessions |
| `suspiciousWindowsPath` | <Undocumented /> | Odd Windows paths | Classifier-routed | Windows |
| `isolatePeerMachines` | <Documented /> | Peer machine isolation | Bypass-immune. Setting `isolatePeerMachines` | Managed |
| `restrictedMode` | <Undocumented /> | `--restricted` | Bypass-immune | CLI |
| `outsideReadsBlocked` | <Undocumented /> | `blockReadsOutsideWorkingDirectories` | Bypass-immune | File tools, `Bash` |
| `claudeSettingsFile` | <Undocumented /> | Writes to settings files | Only a person answers | File tools |
| `internalHardDeny` | <Undocumented /> | Built-in hard deny | Cannot be placed on a served classifier | Each tool |
| `unfinishedCheck` | <Undocumented /> | A check did not finish | Bypass-immune, person only | Each tool |

A tool call in `bypassPermissions` mode asks for approval when the permission check of its tool fails with an error. The check has the decision reason `permission_check_crashed`. The message says: "This call has not run: its permission check failed with an error, so it needs approval. Allow rules and bypass mode cannot give that approval." Where no one can be asked, the call is denied.[^crashed-check]

## How It Works

[Permission Flow](../../how-it-works/permission-flow.md) shows the order of the checks and where the mode decides.

## Related Pages

- [Permission Rules](rules.md) for the `allow`, `ask`, and `deny` lists.
- [Auto Mode](auto-mode.md) for the classifier behind `auto`.
- [Sandbox](sandbox.md) for the operating-system wall around `Bash`.
- [All Flags](../cli/flags.md) for the permission flags.

## Sources

[^mode-names]: The program, `chunk-phb99ctz.js:92`.
[^project-default]: The program, `chunk-xvh0qanc.js:421` (bypass), `chunk-xvh0qanc.js:442` (auto) and the picker text in `chunk-7rp6z1yt.js:616`.
[^killswitch]: The program, `chunk-xvh0qanc.js:306` (the `--permission-mode` flag), `chunk-xvh0qanc.js:332` (an agent definition's `permissionMode: auto`), `chunk-xvh0qanc.js:400` (`defaultMode: auto` in an IDE session), and `chunk-xvh0qanc.js:449`. The program logs `auto mode killswitch active (override- or payload-served) — falling back to default`.
[^bypass-errors]: The program, `chunk-xvh0qanc.js:472` and `chunk-0cw29n2z.js:573`.
[^cloud-bypass]: The program error text, `chunk-mjwpm8mh.js:2401`.
[^reasons]: The program, `chunk-phb99ctz.js:259` (the list of the 11 types, from `rule` to `other`, with `asyncAgent`).
[^changes-327]: The symbolic link refusals are in the program at `chunk-c2c9kwmh.js:1140` and `chunk-c2c9kwmh.js:1132`, with the text "Refusing to read a file whose path could not be vetted". The list control stops the Down key at the last row in the program at `chunk-4hvh0e00.js:168` (`stopsAtLastRow`). The list turns this on at `chunk-4hvh0e00.js:1883` (the function `$cbfd8c`) when the permission prompt frame sets it, the numbers show, and the last answer is the decline answer. The permission prompt frame sets it at `chunk-d2wnhh84.js:213`, where it gives the value true to the context that the list reads. The default kind of that frame is `permission` at `chunk-d2wnhh84.js:205`.
[^long-vars]: The program, `chunk-hg1yqkjk.js:63815` (the message) and `chunk-hg1yqkjk.js:63825` (the denial that uses it).
[^mode-use]: Official page [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes), table "Available modes", column "Best for".
[^crashed-check]: The program, `chunk-hg1yqkjk.js:277541` (the decision reason), `chunk-hg1yqkjk.js:277557` (the message), `chunk-hg1yqkjk.js:277710` (the crash becomes an ask, through the `crashIsObjection` option, before the mode decides), and `chunk-hg1yqkjk.js:273575` (the `asyncAgent` denial where no one can be asked, which adds the message at line 273587).
[^rm-unparsed]: The program, `chunk-hg1yqkjk.js:62039`.
