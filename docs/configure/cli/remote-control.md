---
title: Remote Control Server
description: Every option of claude remote-control in 2.1.323, with the hidden and removed flags and each error the option parser prints.
sidebar_position: 4
---

`claude remote-control` (alias `claude rc`) starts a server on your computer. You control its sessions from `claude.ai/code` or the Claude app.
Claude runs on this computer. Keep the computer awake and the command running, or the sessions stop.
The [official page](https://code.claude.com/docs/en/remote-control#start-a-remote-control-session) covers the server mode, the spawn modes, and resume. This page adds the options that the official page does not list, and the exact errors.

## Example

```bash
claude remote-control --name "API work" --spawn worktree --capacity 4
claude rc --settings ~/.config/claude/rc-settings.json --permission-mode acceptEdits
claude rc --continue    # bring back the session the last server here started with
```

## Options

Source: the text of `claude remote-control --help` in `2.1.323`, and the option parser of the program (`chunk-2dg5mr3x.js:109786`).
The command has its own parser. It does not use the parser of the root `claude` command, so a root flag such as `--model` is not an option here.

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--name <name>` | <Documented /> | Sets the session title that `claude.ai/code` shows. Also `--name=<name>`. With no value after it, the parser ignores it. | A generated name |
| `--remote-control-session-name-prefix <prefix>` | <Documented /> | Sets the prefix of generated session names. The variable `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` does the same. | The host name |
| `-c`, `--continue` | <Documented /> | Brings back the session that the last server in this folder (or in one of its git worktrees) started with. It fails when nothing was recorded here in about the last 4 hours. Since `2.1.323`, a server restarted in the same folder, on the same computer and account, keeps its saved identity for up to 30 days ([2.1.323 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.323); the program, `chunk-jgdw2xgs.js:2101`). | Off |
| `--session-id <id>` | <Documented /> | Brings back one session by its ID. An empty value fails. | Off |
| `--permission-mode <mode>` | <Documented /> | Sets the permission mode of the sessions the server starts: `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, or `plan`. | The mode of your settings |
| `--settings <file>` | <Undocumented /> | Gives the sessions the server starts a JSON settings file. The server reads the file once, at start. If the file changes, no session starts until you restart the server. Keep the file where sessions cannot write. With this option, a session started from a project does not get the auto-compact and auto mode that Remote Control otherwise turns on for it ahead of this computer's own settings. New in `2.1.321`. | Off |
| `--chrome`, `--no-chrome` | <Documented /> | Turns Claude in Chrome on or off for the sessions the server starts. A session started from a project follows the `/chrome` setting of this computer. The program refuses `--chrome` when a policy blocks Chrome ("Start Remote Control without --chrome."). | Off |
| `-d`, `--debug[=<filter>]` | <Documented /> | Turns on debug logs for this process. Give a filter only in the `=` form, such as `--debug=api,hooks`. | Off |
| `--debug-file <path>` | <Documented /> | Writes debug logs to the file. Also `--debug-file=<path>`. | Off |
| `-v`, `--verbose` | <Documented /> | Shows detailed connection and session logs. The official page names only `--verbose`. | Off |
| `-h`, `--help` | <Documented /> | Prints the help text. | |
| `--spawn <mode>` | <Documented /> | Sets how the server makes sessions: `same-dir`, `worktree`, or `session` (one session; the server exits when it ends). Give it only once. Press `w` while the server runs to switch between `same-dir` and `worktree`. | `same-dir`, or the mode saved for this project |
| `--capacity <N>` | <Documented /> | Sets the maximum number of sessions at the same time in `same-dir` or `worktree` mode. Give it only once. | `32` |
| `--create-session-in-dir`, `--no-create-session-in-dir` | <Documented /> | Makes one session in the current folder when the server starts. In `worktree` mode, this session stays in the current folder and the other sessions get worktrees. A session keeps the folder it started in: a connected client cannot move it to another folder. The program refuses with "This Remote Control session stays in the folder it was started in. To work in another folder, start a new session there." (changed in `2.1.321`, per the [2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321); the program, `chunk-mqjkssvg.js:9083`, behind the `tengu_idempotent_blossom` gate). | On |
| `--allow-unattended-tool-calls` | <Undocumented /> | A hidden option. The help text shows it only when a condition in the program holds (`chunk-qhjgwj5g.js:3413`). See [Unattended Tool Calls](#unattended-tool-calls). | Off |
| `--enable-live-preview`, `--preview-port <port>` | <Undocumented /> | Hidden options for a preview tunnel. In `2.1.323` the parser always refuses them with `--enable-live-preview and --preview-port are not available in this build.` | Not available |
| `--sandbox`, `--no-sandbox` | <Documented /> <Deprecated note="Removed in 2.1.300" /> | Removed. The server does not start. See [Errors](#errors). To sandbox the sessions, set `sandbox.enabled` to `true` in settings. | |

### Unattended Tool Calls

`--allow-unattended-tool-calls` is in the parser of `2.1.323` (the program, `chunk-2dg5mr3x.js:109786`). The official docs do not show it.
Use it only from your own terminal. The program does these checks:

1. The parser refuses it with `--spawn=session`, `--session-id`, or `--continue`.
2. When the server starts, stdin and stdout must be a terminal, and the process must not be a child of a Claude Code session. Else it stops with `Error: --allow-unattended-tool-calls needs you at a terminal: it cannot start from a script, a pipe, or a Claude Code session.`
3. The program writes an unattended run grant under `~/.claude/state` (export `writeUnattendedRunGrant`, `chunk-r2hcfdng.js`). If the write fails, it stops with a message that says it `could not write to ~/.claude/state. Start it from your own terminal; a sandbox cannot write there.`
4. The program gives the grant to the tool host for cloud sessions that use this folder. If that host does not start, the server prints `Cloud sessions cannot use this folder: --allow-unattended-tool-calls could not start. Remote Control runs without it.` and goes on without it.

This page does not say what tool calls the grant allows, because no run on this site has used it.

## How the Server Starts

The program does these steps before the server takes sessions (the program, `chunk-78cr37t4.js`, the run-time code after `Ai`):

- The first time, the server explains Remote Control and asks `Enable Remote Control? (y/n)`. The answer goes to the config key `remoteDialogSeen`.
- In a folder that you did not trust yet, the server asks whether to trust it. With no terminal to ask on, run `claude` in the folder once first.
- If you do not give `--spawn` and no mode is saved, the server asks `Spawn mode for this project:`. It saves the answer as `remoteControlSpawnMode` in the project config.
- `worktree` mode needs a git repository or `WorktreeCreate` and `WorktreeRemove` hooks.
- The server refuses an `http://` API base URL that is not `localhost`.
- You must sign in with a Claude account that has a subscription. The account checks run before the options are read; see [Order of the Checks](#order-of-the-checks).

## Errors

### Order of the Checks

The program checks your account and setup before it reads the options (the program, `chunk-t7eewwh2.js`, the `remote-control` entry, and `chunk-j6jad9hj.js`, function `Knn`, exported as `getBridgeDisabledDiagnosis`). So a bad option shows its error only when these checks pass. Each failed check prints `Error: <message>` and stops the command with exit code 1. The checks run in this order:

1. The managed setting `disableRemoteControl` is `true`: ``Remote Control is disabled by your organization's policy (managed setting `disableRemoteControl`).``
2. No stored login: ``You must be logged in to use Remote Control.`` and ``Remote Control is only available with claude.ai subscriptions. Run `claude auth login` to sign in with your claude.ai account.``
3. The process is not a `claude.ai` session to the first-party API: a provider variable is set (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_USE_MANTLE`, `CLAUDE_CODE_USE_ANTHROPIC_AWS`, or `CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD`), the session uses a cloud gateway, `ANTHROPIC_BASE_URL` does not point at `api.anthropic.com`, or `ANTHROPIC_UNIX_SOCKET` is set. Each message starts with `Remote Control is only available when using Claude via api.anthropic.com.` and names the cause. `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL` does not change this check; the message says so when it is set.
4. The process runs inside a cloud session: `Remote Control is not available inside a cloud session.`
5. The login has no `user:profile` scope: ``Remote Control requires a claude.ai subscription. Run `claude auth login` to sign in with your claude.ai account.``
6. An API key or a token takes precedence over the login: `Remote Control requires claude.ai subscription auth. ANTHROPIC_API_KEY is set, so this session is using API-key auth — unset it (or run in a shell without it) to use Remote Control.` The message names the source that won.
7. The token is inference-only, such as one from `claude setup-token` or `CLAUDE_CODE_OAUTH_TOKEN`: ``Remote Control requires a full-scope login token. ... Run `claude auth login` to use Remote Control.``
8. The stored account has no organization: ``Unable to determine your organization for Remote Control eligibility. Run `claude auth login` to refresh your account information.``
9. The organization policy `allow_remote_control` cannot be read (``Couldn't verify your organization's Remote Control policy. Retry, or run `claude doctor` for details.``) or turns Remote Control off (`Remote Control was turned off by your organization's policy.`).
10. The feature flag `tengu_ccr_bridge`. With `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` set, the check fails with `Remote Control requires feature-flag evaluation, which is disabled because CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set. Unset it (or run in a shell without it) to use Remote Control.` When the flag service cannot be reached, it fails with `Couldn't verify Remote Control eligibility — the feature-flag service was unreachable (offline or blocked).` When the flag is off, it fails with `Remote Control isn't enabled for this account.` The program does not fetch the flag, and the check passes with no network, when all of these are true: `DISABLE_TELEMETRY` is set, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is not set, the stored login has a `pro`, `max`, `team`, or `enterprise` plan and an organization, and the organization does not require trusted devices. A probe run confirmed this with a `max` plan.
11. The minimum version of Claude Code for Remote Control, and the temp folder of the program.
12. A trusted device, when your organization requires one.

The [official page](https://code.claude.com/docs/en/remote-control#troubleshooting) explains how to fix the sign-in, policy, and connection errors.

The probe group `cli321` (`rc-*` cases) ran each option error below with a fake `max` login, only `DISABLE_TELEMETRY` set, and no network. Each run printed `Error: <message>` on stderr and exited with code 1.

### Option Errors

Source: the program, in its option parser (`chunk-78cr37t4.js:103038`, function `Ai`), and the `cli321` probe runs.

| Message | Status | When |
| --- | --- | --- |
| `--sandbox is not supported by claude remote-control. The flag had no effect and was removed. To sandbox sessions, set sandbox.enabled to true in settings.` | <Documented /> | You give `--sandbox`. The [official errors page](https://code.claude.com/docs/en/errors#sandbox-is-not-supported-by-claude-remote-control) has this error. |
| `--no-sandbox is not supported by claude remote-control. The flag had no effect and was removed. Remove it from the command.` | <Documented /> | You give `--no-sandbox`. |
| `--settings requires the path of a JSON settings file.` | <Undocumented /> | `--settings` has no value, or `--settings=` is empty. |
| `--settings takes the path of a JSON settings file, not a JSON string.` | <Undocumented /> | The value starts with `{`. The root `claude --settings` takes a JSON string, but this option does not. |
| `--session-id requires a value` | <Undocumented /> | The value is empty. |
| `--spawn may only be specified once` | <Undocumented /> | You give `--spawn` twice. |
| `--spawn requires one of: session, same-dir, worktree (got: <value>)` | <Undocumented /> | The mode is not valid. `<missing>` means no value. |
| `--capacity may only be specified once` | <Undocumented /> | You give `--capacity` twice. |
| `--capacity requires a positive integer (got: <value>)` | <Undocumented /> | The value is not an integer of 1 or more. |
| `--capacity cannot be used with --spawn=session (single-session mode has fixed capacity 1).` | <Documented /> | You give both. |
| `--session-id and --continue cannot be used with --spawn, --capacity, or --create-session-in-dir.` | <Documented /> | You give a resume option with a spawn option. |
| `--session-id and --continue cannot be used together.` | <Documented /> | You give both. |
| `--allow-unattended-tool-calls cannot be used with --spawn=session, --session-id, or --continue.` | <Undocumented /> | You give a single-session or resume option with it. |
| `--enable-live-preview and --preview-port are not available in this build.` | <Undocumented /> | You give either option. The checks that follow it in the parser (`--preview-port requires an integer in [1024, 65535]`, and the pairing of the two options) do not run in `2.1.323`, except the port range check, which runs first while the parser reads `--preview-port`. |
| `Unknown argument: <arg>` and `Run 'claude remote-control --help' for usage.` | <Undocumented /> | Any other argument. |
| `Error: No recent session found in this directory or its worktrees...` | <Documented /> | `--continue` finds no record. |

## Related Pages

- [Subcommands](subcommands.md)
- [All Flags](flags.md) has `--remote-control` and `--rc` for an interactive session.
- [Agents and Remote Settings](../settings/agents-and-remote.md)
- [Remote and Cloud Session Variables](../env-vars/remote-and-cloud-sessions.md)
