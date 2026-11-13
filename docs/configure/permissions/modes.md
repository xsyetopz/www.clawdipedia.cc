---
title: Permission Modes
description: The six permission modes, how Claude Code picks one, the reasons it gives for a decision, and its built-in safety checks.
sidebar_position: 2
---

A permission mode sets which tool calls run without a prompt.
The modes go from `plan`, which only reads, to `bypassPermissions`, which skips most checks.
For example, `claude --permission-mode acceptEdits` starts a session that edits files with no prompt.

Run `/permissions` in the chat. Or start with `--permission-mode`, which wins for one session. Set `permissions.defaultMode` for the start mode. `permissions.disableBypassPermissionsMode: "disable"` removes `bypassPermissions`. `permissions.disableAutoMode: "disable"` removes `auto`.

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

The program accepts `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, and `plan`.
The word `manual` is an alias of `default`.
The error text is `Cannot set permission mode: must be one of acceptEdits, auto, bypassPermissions, default, dontAsk, plan`.
Official pages: [Configure Permissions](https://code.claude.com/docs/en/permissions) and [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes).

| Item | Status | What it does | How it works | Where to set it |
| --- | --- | --- | --- | --- |
| `default` | <Documented /> | Standard behavior | Prompts for dangerous operations. The picker text is `default (ask each time)` | `--permission-mode`, `defaultMode`, `/permissions` |
| `acceptEdits` | <Documented /> | Auto-accepts file edits | The picker text is `accept edits (auto-approve file edits and common file commands)`. It allows edits inside the workspace. A Bash check says `would be allowed in acceptEdits mode` | Same |
| `plan` | <Documented /> | Analysis only, no edits | The picker text is `plan mode (research and propose changes without making them)`. With auto mode available, plan mode uses auto mode semantics unless `useAutoModeDuringPlan` is `false` | Same |
| `auto` | <Documented /> | A classifier screens each action | The picker text is `auto (no routine prompts, a reviewer model screens actions)`. See [Auto Mode](auto-mode.md) | Same. Not from project or local `defaultMode` |
| `dontAsk` | <Documented /> | Denies what would prompt | The picker text is `don't ask (auto-deny anything that would prompt)`. The deny reason says `Claude Code is running in don't ask mode` | Same |
| `bypassPermissions` | <Documented /> <Caution /> | Skips permission checks | The picker text is `BYPASS PERMISSIONS (no further prompts)`. Explicit `deny` rules still apply. Safety checks marked bypass-immune still ask | Needs `--dangerously-skip-permissions` or `--allow-dangerously-skip-permissions`. Not from project or local `defaultMode` |

Captured system prompts for some modes: [Plan](../../prompts/modes/mode-plan.md), [Accept Edits](../../prompts/modes/mode-acceptEdits.md), and [Don't Ask](../../prompts/modes/mode-dontAsk.md).

## Choosing and Cycling a Mode

- `permissions.defaultMode` sets the start mode. `--permission-mode` wins for one session.
- Project and local settings cannot set `auto` or `bypassPermissions` as the default. Source: the program.
- Since `2.1.323`, when the auto mode killswitch is active, `--permission-mode auto` and `defaultMode: auto` start the session in `default` (Manual), which asks first. The program logs `auto mode killswitch active (override- or payload-served) — falling back to default` (`chunk-2xn4gen7.js:4930`, `:8151`). The same fallback applies to an agent definition's `permissionMode: auto`.
- `permissions.disableBypassPermissionsMode` stops `bypassPermissions`. So does a bypass dialog that you did not accept.
  The program texts are `bypassPermissions mode is disabled by settings` and `Cannot set permission mode to bypassPermissions because the session was not launched with --dangerously-skip-permissions`.
- A cloud session cannot use `bypassPermissions`. Source: the program error text.
- The IDE host cycles through `acceptEdits`, `plan`, `default`, and `auto`. The order in the terminal is not documented.

## Decision Reasons

Every permission decision carries a `decisionReason` with one of these types.
Source: the program. Hooks and SDK hosts can see these types.

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

## Safety Checks

A `safetyCheck` reason carries a `circuitBreaker` name. Three flags describe the check.
`bypassImmune` means `bypassPermissions` cannot skip it. `classifierRouted` means [auto mode](auto-mode.md) sends it to the classifier.
`hostPersonOnly` means only a person can answer it.

| Check | Status | What it covers | Behavior | Seen In |
| --- | --- | --- | --- | --- |
| `dangerousRemoval` | <Undocumented /> | Critical-path `rm` prompts | Bypass-immune, classifier-routed. A time limit applies unless `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1`. Since `2.1.309`, in `bypassPermissions` mode in the desktop app and VS Code, a dangerous `rm` or `rmdir` is denied at once with a hint to rewrite it, so unattended sessions keep going ([v2.1.309 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.309)) | `Bash` |
| `backgroundOperator` | <Undocumented /> | Background operator calls | Classifier-routed | Background sessions |
| `suspiciousWindowsPath` | <Undocumented /> | Odd Windows paths | Classifier-routed | Windows |
| `isolatePeerMachines` | <Documented /> | Peer machine isolation | Bypass-immune. Setting `isolatePeerMachines` | Managed |
| `restrictedMode` | <Undocumented /> | `--restricted` | Bypass-immune | CLI |
| `outsideReadsBlocked` | <Undocumented /> | `blockReadsOutsideWorkingDirectories` | Bypass-immune | File tools, `Bash` |
| `claudeSettingsFile` | <Undocumented /> | Writes to settings files | Only a person answers | File tools |
| `internalHardDeny` | <Undocumented /> | Built-in hard deny | Cannot be placed on a served classifier | Each tool |
| `unfinishedCheck` | <Undocumented /> | A check did not finish | Bypass-immune, person only | Each tool |

## How It Works

[Permission Flow](../../how-it-works/permission-flow.md) shows the order of the checks and where the mode decides.

## Related Pages

- [Permission Rules](rules.md) for the `allow`, `ask`, and `deny` lists.
- [Auto Mode](auto-mode.md) for the classifier behind `auto`.
- [Sandbox](sandbox.md) for the operating-system wall around `Bash`.
- [All Flags](../cli/flags.md) for the permission flags.
