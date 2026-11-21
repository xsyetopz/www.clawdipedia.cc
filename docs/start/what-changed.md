---
title: What Changed
description: What Claude Code 2.1.330, the release this site covers, changes against 2.1.329, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.330`, the release this site covers, against `2.1.329`, the release before it.
It lists nothing older. It is short on purpose. Each row rests on the program code and cites it in a footnote.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.330`, the version shown in the navbar.

## Version 2.1.330

Sources: the program, and the entry for `2.1.330` in the official [Changelog](https://code.claude.com/docs/en/changelog) as a second source. Each row states what the program code shows. A row is marked <Documented /> when that changelog entry states the same change. Items about other products (such as VS Code, Claude Desktop, and Remote Control), and fixes with no setting, key, or text that a page states, are not on this page.

### Permissions, Hooks, and Settings

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `requiredMinimumVersion` and three commands | <Undocumented /> | The version check of managed settings no longer blocks `update`, `install`, and `doctor`. These commands run on a version that is out of range.[^ver-skip] | [Enterprise Settings](../configure/settings/enterprise.md#require-a-version-range) |
| Second Bash deny check | <Undocumented /> | `CLAUDE_CODE_DISABLE_REDIRECT_DENY_RECHECK` turns off the second check of Bash deny rules for a command that has `<` or `>`. A server gate must be on for the variable to have an effect.[^redirect] | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| Host approval and the auto mode block count | <Undocumented /> | `CLAUDE_CODE_HOST_ALLOW_RESETS_DENIAL_STREAK` lets an approval of a host app reset the count of auto mode blocks in a row.[^streak] | [SDK and Automation Variables](../configure/env-vars/sdk-and-automation.md#variables) |
| Plugin display fields | <Undocumented /> | A plugin with a bad display field in `plugin.json` always loads without that field. No server flag can refuse the plugin now.[^pl-gate] | [Plugin CLI](../extend/plugins/cli.md#how-it-works) |

### CLI, Commands, and Sign-In

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Enterprise Admin Console sign-in | <Documented /> | `claude auth login` can sign in to an organization that the Enterprise Admin Console manages. A sign-in that cannot read the settings of the organization says "This sign-in didn't let Claude Code read your organization's settings".[^org] | [Subcommands](../configure/cli/subcommands.md#commands) |
| `CLAUDE_CODE_FULL_SIGN_IN_LINK` | <Documented /> | Set it to `1` to show the full sign-in URL. Without it, Claude Code shows a short link.[^full-link] | [Auth and Account Variables](../configure/env-vars/auth-and-accounts.md#variables) |
| `/access` | <Gated note="Availability claude-ai, the server flag tengu_gentle_sky, and not a remote session." /> | A new command. It opens a panel with the title "Your programs". It says "No programs to show" or "Couldn't check your programs".[^access] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#account-cloud-and-other-commands) |
| `/design-sync` description | <Undocumented /> | The description now reads "Sync a React design system to Claude Design". It bundles the real component code, from Storybook or a bare package, and uploads it.[^design-sync] | [Bundled Skills](../extend/skills-and-commands/bundled-skills.md#skills) |
| `claude plugin install --json` | <Documented /> | The result has `commandPrinted` when the source command of the plugin wrote to stderr. A failed result has `commandFailed` when that command exited with an error, was killed, or did not finish in time.[^install-json] | [Plugin CLI](../extend/plugins/cli.md#subcommands) |

### Self-Hosted Runner and Remote

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `--start-dir` | <Documented /> | `claude self-hosted-runner --start-dir <owner>/<repo>=<folder>`, or `SELF_HOSTED_RUNNER_START_DIR`, starts Claude in a folder of that repository.[^start-dir] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options) |
| Start folder notice | <Undocumented /> | When the runner cannot use the start folder, the session starts where it would without one. The runner adds a notice that starts "The start folder that this runner's operator set".[^start-dir-notice] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#start-folder-notice) |
| Runner start-up gauges | <Documented /> | `/metrics` gives `claude_code_self_hosted_runner_order_to_registered_seconds` and `claude_code_self_hosted_runner_order_to_first_session_seconds`.[^runner-metrics] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runner-metrics) |
| Unsafe repository URL | <Undocumented /> | The runner logs "refusing to pass unsafe repo URL to checkout hook" and does not give that URL to the hook.[^unsafe-url] | [Sessions and Storage](../how-it-works/sessions-and-storage.md#errors) |
| Runner and host variables | <Undocumented /> | The runner or Claude Code sets `CLAUDE_RUNNER_START_FOLDER`, `CLAUDE_CODE_RUNNER_START_NOTES`, `CLAUDE_CODE_MODEL_NOBODY_CHOSE`, `CLAUDE_CODE_PROJECTS_FEATURE_FLAGS`, and `CLAUDE_CODE_STARTER_MAY_HOLD_CONNECTOR_FILE` for a child session. `CLAUDE_CODE_COWORK_SHELL_CHECK` and `CLAUDE_CODE_HOST_READS_NO_BASH_EDIT_DIFF` are for host apps, behind a server gate.[^runner-vars] | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |

### Mods and MCP

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `$.vcs` calls | <Undocumented /> | A mod can call `$.vcs.detect`, `diff`, `isolate`, `list`, `release`, and `status`. Each call asks the `vcs.*` hooks first, so a mod can serve a system other than Git.[^vcs-calls] | [Version Control](../extend/mod-api/calls/vcs.md#members) |
| `vcs.*` hooks | <Undocumented /> | A hook on `vcs.isolate` makes the copy for a subagent with `isolation: "worktree"`, for EnterWorktree, and for `--worktree`. `vcs.list`, `vcs.status`, and `vcs.release` serve ExitWorktree and the exit dialog.[^vcs-events] | [Version Control](../extend/mod-api/calls/vcs.md#engine-events) |
| `worktreePath` of `WorktreeCreate` | <Undocumented /> | A module should answer `vcs.isolate` instead. The old answer still works.[^worktree-path] | [Version Control](../extend/mod-api/calls/vcs.md#how-a-hook-makes-a-copy) |
| Version control errors | <Undocumented /> | Claude Code can say "A vcs.isolate hook refused to make a copy:" or "no WorktreeCreate hook is enabled".[^vcs-errors] | [Version Control](../extend/mod-api/calls/vcs.md#errors) |
| `AbovePrompt` in VS Code | <Documented /> | `AbovePrompt` and `AbovePromptList` draw on the terminal, the desktop app, the mobile app, and VS Code. `claude plugin validate` no longer warns that the hook never runs in VS Code.[^above-prompt] | [Surfaces, Elements, and Render Sites](../extend/mod-api/ui/ui-elements.md#render-sites-and-props) |

### Tools and Sessions

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `ExitWorktree` and the exit dialog | <Documented /> | `ExitWorktree` with `remove` is refused, also with `discard_changes`, while another Claude Code session runs in the worktree. The exit dialog says "Worktree kept at …: another Claude Code session (…) is running in it, though it may be idle". A server flag controls the check.[^exit-worktree] | [Agents and Tasks Tools](../reference/tools/agents-and-tasks.md#tools) |
| `PushNotification` default | <Undocumented /> | The tool is on by default only when `CLAUDE_CODE_REMOTE` is set, the entry point is `remote_trigger` or `remote_cowork_trigger`, and a host check passes. A server value can change it.[^push] | [Gated and Other Tools](../reference/tools/gated-and-other.md#gated-tools) |
| `withdrawn_tools_v1` | <Undocumented /> | The `init` line of a headless session lists this new capability.[^withdrawn] | [Stream JSON Messages](../extend/headless/stream-json.md#capabilities-of-the-init-line) |

### Environment Variables

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `CLAUDE_AFTER_LAST_COMPACT` | <Undocumented /> | It is now on or off, so `0` turns it off.[^after-compact] | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| `API_FORCE_IDLE_TIMEOUT` | <Undocumented /> | It is now on, off, or unset. A number of seconds counts as unset.[^idle-timeout] | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#variables) |
| `CLAUDE_COWORK_MEMORY_INDEX_CONTENT` | <Undocumented /> | An empty value stays empty, so it turns the index off.[^memory-index] | [Context and Compaction Variables](../configure/env-vars/context-and-compaction.md#variables) |
| `SANDBOX_RUNTIME` | <Undocumented /> | When it is set, the switch from bypass permissions mode to auto mode at start skips with the reason `sandbox_runtime`.[^sandbox-runtime] | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| `BUF_BIGINT_DISABLE` | <Undocumented /> | Removed. The program no longer names it.[^buf-bigint] | [Bundled Library Variables](../configure/env-vars/bundled-libraries.md) |

## Example

In `2.1.330`, a script can read the full sign-in link again. Check the version, then sign in with the full link:

```bash
claude --version
CLAUDE_CODE_FULL_SIGN_IN_LINK=1 claude auth login
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)

## Sources

[^ver-skip]: The program, `chunk-amkshz08.js:13` (`update`, `install`, and `doctor`, which the version check skips) and `chunk-amkshz08.js:16` (`requiredMinimumVersion`).
[^redirect]: The program, `chunk-bzyb60p0.js:64715` (`tengu_sharded_acorn`) and `chunk-bzyb60p0.js:64723-64727` (`CLAUDE_CODE_DISABLE_REDIRECT_DENY_RECHECK` and `alwaysDenyRules`).
[^streak]: The program, `chunk-bzyb60p0.js:51100` (`CLAUDE_CODE_HOST_ALLOW_RESETS_DENIAL_STREAK`) and `chunk-52tptcsk.js:1556` (`denial_limit_host_reset`).
[^pl-gate]: The program, `chunk-bzyb60p0.js:49976` (the `plugin-json` check, which drops the bad display fields with no flag test). In `2.1.329`, the same check also tested the server flag `refusesDisplayFaults`.
[^org]: The program, `chunk-jcwhbkjz.js:365` (the text `This sign-in didn't let Claude Code read your organization's settings`) and `chunk-jcwhbkjz.js:410` (the text `It has not turned on Claude Code sign-in for you`).
[^full-link]: The program, `chunk-16b09bna.js:26-27` (`CLAUDE_CODE_FULL_SIGN_IN_LINK` and `-local-oauth`, which return the full URL).
[^access]: The program, `chunk-bzyb60p0.js:191568` (the command and its gate `tengu_gentle_sky`) and `chunk-4c3sbrwa.js:788` (the title "Your programs").
[^design-sync]: The program, `chunk-424x9gf0.js:3779` (the description "Sync a React design system to Claude Design").
[^install-json]: The program, `chunk-nppzf6gc.js:883` (`commandPrinted` in the `ok` result) and `chunk-nppzf6gc.js:424` (`commandFailed` in the `failed` result).
[^start-dir]: The program, `chunk-q0y1fm2x.js:16132` (the `--start-dir` case) and `chunk-q0y1fm2x.js:16414-16418` (the `SELF_HOSTED_RUNNER_START_DIR` fallback).
[^start-dir-notice]: The program, `chunk-q0y1fm2x.js:5839` (the text `The start folder that this runner's operator set`).
[^runner-metrics]: The program, `chunk-8yfas77b.js:956` (the text `order_to_registered_seconds`) and `chunk-8yfas77b.js:965` (the text `order_to_first_session_seconds`).
[^unsafe-url]: The program, `chunk-q0y1fm2x.js:9082` (the text "refusing to pass unsafe repo URL to checkout hook").
[^runner-vars]: The program, `chunk-q0y1fm2x.js:12068-12141` (the variables that the runner sets for a session), `chunk-bzyb60p0.js:275870` (`CLAUDE_CODE_COWORK_SHELL_CHECK`), and `chunk-3t7ve0wy.js:744-747` (`CLAUDE_CODE_HOST_READS_NO_BASH_EDIT_DIFF`).
[^vcs-calls]: The program, `chunk-bzyb60p0.js:217284` (`is not available in this mode`, the gate of the calls) and `chunk-bzyb60p0.js:217309` (the input check of `vcs.isolate`).
[^vcs-events]: The program, `chunk-bzyb60p0.js:8689` (the event `vcs.isolate`) and `chunk-bzyb60p0.js:93163` (the hook is asked first).
[^worktree-path]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-0yef3dc4.js:6`, published as `schemas/claude-code.d.ts`, `worktreePath` (`@deprecated from a module, answer vcs.isolate instead`).
[^vcs-errors]: The program, `chunk-2p0e1k2g.js:477` ("A vcs.isolate hook refused to make a copy:") and `chunk-4m3xfy89.js:692` ("no WorktreeCreate hook is enabled").
[^above-prompt]: The program, `chunk-0w2wb7gk.js:8804` (`AbovePrompt`).
[^exit-worktree]: The program, `chunk-aw5nczax.js:7925` (`validateInput`, error code 8), `chunk-aw5nczax.js:8098` (the refusal at removal, reason `other_live_session`), and `chunk-bzyb60p0.js:93748` (the check, behind the server flag `tengu_tingly_wall`).
[^push]: The program, `chunk-gys72mpb.js:266` (`isEnabled` reads `tengu_kairos_push_notifications` with the default `CLAUDE_CODE_REMOTE`) and `chunk-3t7ve0wy.js:63` (`remote_trigger` and `remote_cowork_trigger`).
[^withdrawn]: The program, `chunk-zd24r3fj.js:169` (`withdrawn_tools_v1`) and `chunk-d688kptq.js:5765` (`$9478fa` in the `capabilities` array).
[^after-compact]: The program, `chunk-c203g5kd.js:806` (`CLAUDE_AFTER_LAST_COMPACT`), `chunk-c203g5kd.js:2982` (its type, `bool()`), and `chunk-bzyb60p0.js:20103` (the read).
[^idle-timeout]: The program, `chunk-c203g5kd.js:1277` (`API_FORCE_IDLE_TIMEOUT`), `chunk-c203g5kd.js:3491` (its type, `triBool()`), and `chunk-3jjr3wje.js:6768` (the read).
[^memory-index]: The program, `chunk-c203g5kd.js:1161` (`CLAUDE_COWORK_MEMORY_INDEX_CONTENT`), `chunk-c203g5kd.js:3186` (its type, `rawStr()`), and `chunk-bzyb60p0.js:106326` (the read).
[^sandbox-runtime]: The program, `chunk-0rtj0bmp.js:4656` (`sandbox_runtime`) and `chunk-1ag56sne.js:491` (`SANDBOX_RUNTIME=1`).
[^buf-bigint]: A search of the `2.1.330` build finds no `BUF_BIGINT_DISABLE`. The `2.1.329` build named it.
