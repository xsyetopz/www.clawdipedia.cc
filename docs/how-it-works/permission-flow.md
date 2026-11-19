---
title: Permission Flow
description: How Claude Code decides to allow, ask about, or deny a tool call, in order, with hooks, modes, the sandbox, and the auto mode classifier.
sidebar_position: 7
---

Before a tool runs, Claude Code decides one of three things: allow it, ask you, or deny it. Several parts take a turn: rules, hooks, the permission mode, safety checks, and sometimes a classifier model. This page shows the order, so you know which setting to change to stop or to allow a call.

## Example

You set `deny: ["Bash(git push:*)"]` and `allow: ["Bash(bun test)"]`. You run in `default` mode.

1. Claude asks to run `git push origin main`. The `deny` rule matches, so Claude Code denies the call. No prompt shows.
2. Claude asks to run `bun test`. No deny or ask rule matches. The `allow` rule matches, so it runs.
3. Claude asks to run `rm -rf build`. No rule matches. The mode is `default`, so you get a prompt.

## The Order of Checks

Official pages: [Configure Permissions](https://code.claude.com/docs/en/permissions) and [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes).
The steps below follow the program.[^order]

```mermaid
flowchart TD
  Call[Tool call] --> Deny{Explicit deny or ask rule?}
  Deny -->|deny| Denied[Denied]
  Deny -->|ask| Prompt
  Deny -->|none| Hook["<code>PreToolUse</code> hooks"]
  Hook -->|deny| Denied
  Hook -->|ask| Prompt
  Hook -->|allow or none| Allow{Allow rule, edit rule, read-only list, or sandbox auto-allow?}
  Allow -->|yes| Run[Allowed, tool runs]
  Allow -->|no| Mode{Permission mode}
  Mode -->|"<code>default</code>"| Prompt["<code>PermissionRequest</code> hooks, then the dialog"]
  Mode -->|"<code>dontAsk</code>"| Denied
  Mode -->|"<code>auto</code>"| Class[Auto mode classifier]
  Mode -->|"<code>bypassPermissions</code>"| Run
  Class -->|allow| Run
  Class -->|block| Fired["<code>PermissionDenied</code> hook"]
  Class -->|unsure| Prompt
  Fired --> Denied
  Prompt -->|you allow| Run
  Prompt -->|you deny| Denied
```

### Step by Step

1. **Explicit `deny` and `ask` rules** apply first, before workspace trust. See [Settings Reference](https://code.claude.com/docs/en/settings-reference).
2. **`PreToolUse` hooks** can allow, deny, or ask. A hook `allow` does not override a `deny` or `ask` rule.[^hook-allow]
3. **Allow sources** let the call run: `allow` rules, the rules of `acceptEdits`, and read-only command lists. The permission reason reads `Read-only command is allowed` or `Auto-allowed with sandbox (autoAllowBashIfSandboxed enabled)`.[^allow-texts]
4. **The mode decides the rest.** `default` prompts. `dontAsk` denies. `auto` asks the classifier. `bypassPermissions` allows. The other modes follow the rules on [Permission Modes](../configure/permissions/modes.md).
5. **A prompt runs `PermissionRequest` hooks first.** Then the dialog shows. `Notification` hooks fire for unanswered requests in SDK hosts. Set `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS=1` to stop that.
6. **An auto mode denial fires `PermissionDenied`.** The hook can ask for a retry.

The docs do not give the full order, so treat the exact order as unstable.

### Mounted Drive Check

A safety check covers `rm -r` on a mounted drive, the folder that holds mounted drives (`/Volumes`, `/media`, WSL `/mnt/c`), or a top-level file or folder of a drive. Since `2.1.304` this call "requires explicit approval and cannot be auto-allowed by permission rules".[^mounted] Set `CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT` to turn this prompt off. See [Tools and Bash](../configure/env-vars/tools-and-bash.md).

### Rule Warnings

Claude Code checks `deny` and `ask` rules at startup. It warns about a rule that matches no tool (`matches no tool · check for typos`). It also warns about a rule that gives a raw string where the tool needs its own matcher (`never matches`).[^rule-warn] Since `2.1.323` it also warns about a Bash `allow` rule that has `*` in a variable's value.[^star-warn]

Since `2.1.311`, a warning about a rule from a settings file shows once per user until the rule changes. Claude Code saves a key for each shown warning in the `seenSecurityWarnings` entry of the user config file (the last 256 keys). The key holds the source, the settings file, and the warning text.[^seen-warn]

### Untrusted Git Repositories

<Gated /> Since `2.1.326`, a read-only `git` command asks first if git would use a repository that Claude Code cannot match to the project or to one you trusted. The warning says "Its settings can make git run programs."[^git-trust] To run such commands without a prompt, name that folder with `--add-dir` at the start. This also loads its skills and commands. The `additionalDirectories` setting does not do this. If you trust a folder that holds no trust yet, start Claude Code there once and accept the trust dialog. When Claude Code cannot offer `--add-dir`, the text says "An allow rule for git would apply in every repository."[^git-text]

### Sign-In Files in Shell Commands

Since `2.1.326`, a `Bash` command can ask first when it reads a relative path after a `cd`. The prompt says that Claude Code cannot check the path against this computer's keys and sign-in files first.[^relative-cd]

### Folder Trust Prompt

Since `2.1.326`, the folder trust prompt at launch lists each settings file of the folder. A file that runs commands gets the tag `(runs commands)`. A file that sets environment variables gets the tag `(sets environment variables)`. The prompt shows the list under the header `Accessing workspace:`.[^trust-list] The prompt for a folder you enter with `/cd` lists its settings files in the same way, without the tags.[^cd-list] If you refuse the folder at launch, Claude Code prints `Claude Code didn't start because this folder isn't trusted.` and exits. It tells you to run `claude` again and choose Yes, or to run it in another folder.[^trust-exit]

### Circuit Breakers

Built-in safety checks, called circuit breakers, can also force a prompt. Some are immune to `bypassPermissions`. See [Permission Modes](../configure/permissions/modes.md#safety-checks). The diagram omits them because the program does not show where they run.

### Working Folders

A path outside the working folders gets the reason `workingDir` (`Path is outside allowed working directories`).

`permissions.blockReadsOutsideWorkingDirectories: true` refuses reads outside the working folders in every mode. Since `2.1.323` it also binds shell commands. They ask in every mode, the sandbox denies such reads, and a computed or unparseable command asks.[^block-reads] See [Permission Rules](../configure/permissions/rules.md).

## What You Can Change at Each Step

| Step | What you change |
| --- | --- |
| Rules | `permissions.allow`, `ask`, `deny`. See [Permission Rules](../configure/permissions/rules.md). |
| Hooks | `PreToolUse`, `PermissionRequest`, and `PermissionDenied` hooks. See the [Hooks](../extend/hooks/index.md) pages. |
| Safety checks | Mostly fixed. `blockReadsOutsideWorkingDirectories`, `blockFileToolReadsOutsideWorkingDirectories`, `--restricted`, and `isolatePeerMachines` enable some. |
| Mode | `permissions.defaultMode` and `--permission-mode`. See [Permission Modes](../configure/permissions/modes.md). |
| Sandbox | `sandbox.*` keys. See [Sandbox](../configure/permissions/sandbox.md). |
| Classifier | The `autoMode` setting. See [Auto Mode](../configure/permissions/auto-mode.md). |

## Where It Sits in a Turn

The check runs in the tool stage of every turn. See [The Agent Loop](agent-loop.md) for the stages around it and [Architecture](architecture.md) for the pieces.

## Related Pages

- [Permissions Overview](../configure/permissions/index.md)
- [Permission Modes](../configure/permissions/modes.md)
- [Permission Rules](../configure/permissions/rules.md)
- [Sandbox](../configure/permissions/sandbox.md)
- [Auto Mode](../configure/permissions/auto-mode.md)
- [Captured Plan Mode Prompt](../prompts/modes/mode-plan.md)

## Sources

[^order]: The program, `chunk-56bhcxay.js:3726922`. The official pages do not give the full order.
[^hook-allow]: The Mod API type file of the `2.1.327` program (`schemas/claude-code.d.ts`) and the program text `hook allows approve the command` (`chunk-56bhcxay.js:1392716`).
[^allow-texts]: The program texts `Read-only command is allowed` and `Auto-allowed with sandbox (autoAllowBashIfSandboxed enabled)` (`chunk-rs68es1f.js:4594`).
[^mounted]: The program, `chunk-56bhcxay.js:1420564`. [`2.1.304` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.304).
[^rule-warn]: The program, `chunk-tew0988b.js:22470` (`matches no tool`) and `chunk-tew0988b.js:22212` (`never matches`).
[^star-warn]: The program, `chunk-jkpzhr7r.js:194304`.
[^seen-warn]: The program, `chunk-tew0988b.js:23516` (the key holds the source, the file, and the text), `chunk-w8wanava.js:383` (the list of keys, 256 at most).
[^git-trust]: The program, `chunk-56bhcxay.js:1399711`. The check runs only when the server flag `bot_protected_tengu_frolicking_pelican` is on (`chunk-56bhcxay.js:1397578`, `chunk-56bhcxay.js:1399360`, and `chunk-56bhcxay.js:1399188`, the read with `safe: true`). The server sets the flag.
[^git-text]: The program, `chunk-56bhcxay.js:1399711`.
[^block-reads]: The program, `chunk-rs68es1f.js:5085` (the setting and its text), `chunk-rs68es1f.js:6522` and `chunk-56bhcxay.js:69625` (the ask that stays in every mode), `chunk-rs68es1f.js:6552` (the sandbox override), `chunk-rs68es1f.js:7145` (a computed path asks), and `chunk-rs68es1f.js:7299` (a command that the parser cannot read asks).
[^relative-cd]: The program, `chunk-56bhcxay.js:1461043-1461350`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^trust-list]: The program, `chunk-6heyrpzr.js:29628` (the tags) and `chunk-6heyrpzr.js:32701` (the header `Accessing workspace:`).
[^cd-list]: The program, `chunk-t5ty4t2x.js:4718` and `chunk-g2h4scbp.js:463` (the sentence `Trusting this directory loads <files>.`).
[^trust-exit]: The program, `chunk-6heyrpzr.js:26036`.
