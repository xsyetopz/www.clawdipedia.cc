---
title: Remote Control Server
description: Every option of claude remote-control in 2.1.329, with the hidden and removed flags and each error the option parser prints.
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

The command has its own parser. It does not use the parser of the root `claude` command, so a root flag such as `--model` is not an option here.[^parser]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--name <name>` | <Documented /> | Sets the session title that `claude.ai/code` shows. Also `--name=<name>`. As the last argument, with no value after it, it fails with `Unknown argument: --name`.[^needs-value] | A generated name |
| `--remote-control-session-name-prefix <prefix>` | <Documented /> | Sets the prefix of generated session names. The variable `CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX` does the same. | The host name |
| `-c`, `--continue` | <Documented /> | Brings back the session that the last server in this folder (or in one of its git worktrees) started with. It fails when nothing was recorded here in about the last 4 hours. A server restarted in the same folder, on the same computer and account, keeps its saved identity for up to 30 days.[^identity] | Off |
| `--session-id <id>` | <Documented /> | Brings back one session by its ID. An empty value fails. As the last argument, with no value after it, it fails with `Unknown argument: --session-id`.[^needs-value] | Off |
| `--permission-mode <mode>` | <Documented /> | Sets the permission mode of the sessions the server starts: `acceptEdits`, `auto`, `bypassPermissions`, `default`, `dontAsk`, or `plan`. The parser reads `manual` as `default`. Any other value fails after the checks of your account (see [Option Errors](#option-errors)).[^perm-mode] | The mode of your settings |
| `--settings <file>` | <Undocumented /> | Gives the sessions the server starts a JSON settings file. The server reads the file once, at start. If the file changes, no session starts until you restart the server. Keep the file where sessions cannot write. With this option, a session started from a project does not get the auto-compact and auto mode that Remote Control otherwise turns on for it ahead of this computer's own settings. | Off |
| `--chrome`, `--no-chrome` | <Documented /> | Turns Claude in Chrome on or off for the sessions the server starts. A session started from a project follows the `/chrome` setting of this computer. Claude Code refuses `--chrome` when a policy blocks Chrome ("Start Remote Control without --chrome."). | Off |
| `-d`, `--debug[=<filter>]` | <Documented /> | Turns on debug logs for this process. Give a filter only in the `=` form, such as `--debug=api,hooks`. | Off |
| `--debug-file <path>` | <Documented /> | Writes debug logs to the file. Also `--debug-file=<path>`. | Off |
| `-v`, `--verbose` | <Documented /> | Shows detailed connection and session logs. The official page names only `--verbose`. The session debug logs go to `~/.claude/child-logs/`, unless you set `--debug-file`. If Claude Code cannot use that folder, it shows `Session debug logs are off: <reason>`.[^child-logs] | Off |
| `-h`, `--help` | <Documented /> | Prints the help text. | |
| `--spawn <mode>` | <Documented /> | Sets how the server makes sessions: `same-dir`, `worktree`, or `session` (one session; the server exits when it ends). Give it only once. Press `w` while the server runs to switch between `same-dir` and `worktree`. | `same-dir`, or the mode saved for this project |
| `--capacity <N>` | <Documented /> | Sets the maximum number of sessions at the same time in `same-dir` or `worktree` mode. Give it only once. | `32` |
| `--create-session-in-dir`, `--no-create-session-in-dir` | <Documented /> | Makes one session in the current folder when the server starts. In `worktree` mode, this session stays in the current folder and the other sessions get worktrees. A session keeps the folder it started in: a connected client cannot move it to another folder. Claude Code refuses with "This Remote Control session stays in the folder it was started in. To work in another folder, start a new session there.".[^same-folder] | On |
| `--allow-unattended-tool-calls` | <Undocumented /> | A hidden option. The help text shows it only when an internal condition holds. Then it says: "Let your cloud sessions use this folder for this run. Their auto-mode commands run without asking, inside the sandbox only (choose a mode in /sandbox first); otherwise they ask."[^unattended-help] See [Unattended Tool Calls](#unattended-tool-calls). | Off |
| `--enable-live-preview`, `--preview-port <port>` | <Undocumented /> | Hidden options for a preview tunnel. The parser always refuses them with `--enable-live-preview and --preview-port are not available in this build.` | Not available |
| `--sandbox`, `--no-sandbox` | <Documented /> <Deprecated note="Removed" /> | Removed. The server does not start. See [Errors](#errors). To sandbox the sessions, set `sandbox.enabled` to `true` in settings.[^sandbox-flag] | |

### Unattended Tool Calls

`--allow-unattended-tool-calls` is in the parser. The official docs do not show it.[^parser]
Use it only from your own terminal. Claude Code does these checks:

1. The parser refuses it with `--spawn=session`, `--session-id`, or `--continue`.
2. When the server starts, stdin and stdout must be a terminal, and the process must not be a child of a Claude Code session. Else it stops with `Error: --allow-unattended-tool-calls needs you at a terminal: it cannot start from a script, a pipe, or a Claude Code session.`
3. Claude Code writes an unattended run grant under `~/.claude/state`.[^grant] If the write fails, it stops with a message that says it `could not write to ~/.claude/state. Start it from your own terminal; a sandbox cannot write there.`
4. Claude Code gives the grant to the tool host for cloud sessions that use this folder. If that host does not start, the server prints `Cloud sessions cannot use this folder: --allow-unattended-tool-calls could not start. Remote Control runs without it.` and goes on without it.

The help text says what the grant allows: auto-mode commands from your cloud sessions run without asking, inside the sandbox only, and they ask when you have not chosen a sandbox mode.[^unattended-help] This page does not state more than that, because no run on this site has used the option.

## How the Server Starts

Claude Code does these steps before the server takes sessions:[^startup]

- The first time, the server explains Remote Control and asks `Enable Remote Control? (y/n)`. The answer goes to the config key `remoteDialogSeen`.
- In a folder that you did not trust yet, the server asks whether to trust it. With no terminal to ask on, run `claude` in the folder once first.
- If you do not give `--spawn` and no mode is saved, the server asks `Spawn mode for this project:`. It saves the answer as `remoteControlSpawnMode` in the project config.
- `worktree` mode needs a git repository or `WorktreeCreate` and `WorktreeRemove` hooks. Stopping the server in `worktree` mode keeps the worktree of a session that may return, with its git-ignored files such as `.env`. This holds for worktrees that Claude Code makes, not for worktrees that a `WorktreeCreate` hook makes.[^rc-worktree]
- The server refuses an `http://` API base URL that is not `localhost`.
- You must sign in with a Claude account that has a subscription. The account checks run before the options are read; see [Order of the Checks](#order-of-the-checks).

## Errors

### Order of the Checks

Claude Code checks your account and setup before it reads the options.[^order] So a bad option shows its error only when these checks pass. Each failed check prints `Error: <message>` and stops the command with exit code 1, except the organization pin check, which can exit with `69`. The checks run in this order:

1. The managed setting `disableRemoteControl` is `true`: ``Remote Control is disabled by your organization's policy (managed setting `disableRemoteControl`).``
2. The session uses an organization sign-in:[^hybrid] `Remote Control needs a claude.ai login. It is not available under an organization sign-in.` The same check has two more messages: `Remote Control is not available until you restart Claude Code because this session still uses an organization's connection.` and `Remote Control is not available until you restart Claude Code because this session used an organization sign-in.`
3. No stored login: ``You must be logged in to use Remote Control.`` and ``Remote Control is only available with claude.ai subscriptions. Run `claude auth login` to sign in with your claude.ai account.``
4. The login fails the organization pin of the managed settings (`forceLoginOrgUUID` or `forceLoginMethod`). The message depends on the cause. The exit code is `69` when the policy cannot be read or the organization cannot be verified, and `1` for any other refusal.[^org-pin]
5. The process is not a `claude.ai` session to the first-party API: a provider variable is set (`CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_USE_MANTLE`, `CLAUDE_CODE_USE_ANTHROPIC_AWS`, or `CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD`), the session uses a cloud gateway, `ANTHROPIC_BASE_URL` does not point at `api.anthropic.com`, or `ANTHROPIC_UNIX_SOCKET` is set. Each message starts with `Remote Control is only available when using Claude via api.anthropic.com.` and names the cause. `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL` does not change this check; the message says so when it is set.
6. The process runs inside a cloud session: `Remote Control is not available inside a cloud session.`
7. The login has no `user:profile` scope: ``Remote Control requires a claude.ai subscription. Run `claude auth login` to sign in with your claude.ai account.``
8. An API key or a token takes precedence over the login: `Remote Control requires claude.ai subscription auth. ANTHROPIC_API_KEY is set, so this session is using API-key auth — unset it (or run in a shell without it) to use Remote Control.` The message names the source that won.
9. The token is inference-only, such as one from `claude setup-token` or `CLAUDE_CODE_OAUTH_TOKEN`: ``Remote Control requires a full-scope login token. ... Run `claude auth login` to use Remote Control.``
10. The stored account has no organization: ``Unable to determine your organization for Remote Control eligibility. Run `claude auth login` to refresh your account information.``
11. The organization policy `allow_remote_control` cannot be read (``Couldn't verify your organization's Remote Control policy. Retry, or run `claude doctor` for details.``) or turns Remote Control off (`Remote Control was turned off by your organization's policy.`).
12. The server-side feature flag for Remote Control.[^flag] With `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` set, the check fails with `Remote Control requires feature-flag evaluation, which is disabled because CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is set. Unset it (or run in a shell without it) to use Remote Control.` When the flag service cannot be reached, it fails with `Couldn't verify Remote Control eligibility — the feature-flag service was unreachable (offline or blocked).` When the flag is off, it fails with `Remote Control isn't enabled for this account.` Claude Code does not fetch the flag, and the check passes with no network, when all of these are true: `DISABLE_TELEMETRY` is set, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is not set, the stored login has a `pro`, `max`, `team`, or `enterprise` plan and an organization, and the organization does not require trusted devices. A probe run confirmed this with a `max` plan.[^flag]
13. The version of Claude Code is below the minimum for Remote Control: `Your version of Claude Code (<version>) is too old for Remote Control.` The message then names the required version and tells you to run `claude update`.[^floor]
14. The organization policy is read again once the policy limits are loaded. A denial prints its reason.[^policy-again]
15. The temp folder of the program cannot be used: the message is the error text of the folder check.[^temp]
16. A trusted device, when your organization requires one.[^trusted]

The [official page](https://code.claude.com/docs/en/remote-control#troubleshooting) explains how to fix the sign-in, policy, and connection errors.

### Exit Codes

The exit code tells a service manager, such as `systemd` or `launchd`, whether to start the server again.[^exit-codes]

| Code | When |
| --- | --- |
| `0` | You stop the server, for example with Ctrl+C, or a `--spawn session` server ends with its one session. |
| `4` | The server loop ends without a stop signal (`SIGINT`, `SIGTERM`, or `SIGHUP`) and the spawn mode is not the one-session mode, for example in `same-dir` or `worktree` mode.[^exit-codes] |
| `69` | The server cannot register with Remote Control. The error message prints first. |
| `1` | A check or an option fails. See [Order of the Checks](#order-of-the-checks) and [Option Errors](#option-errors). |

Each option error below prints `Error: <message>` on stderr and exits with code 1.[^cli321]

### Option Errors

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
| `--enable-live-preview and --preview-port are not available in this build.` | <Undocumented /> | You give either option. The checks that follow it in the parser (`--preview-port requires an integer in [1024, 65535]`, and the pairing of the two options) do not run, except the port range check, which runs first while the parser reads `--preview-port`. |
| `Unknown argument: <arg>` and `Run 'claude remote-control --help' for usage.` | <Undocumented /> | Any other argument. |
| `Error: No recent session found in this directory or its worktrees...` | <Documented /> | `--continue` finds no record. |
| `Unknown argument: <option>` | <Undocumented /> | `--name`, `--remote-control-session-name-prefix`, `--session-id`, `--permission-mode`, or `--debug-file` is the last argument and has no value after it.[^needs-value] |
| `Error: Unknown permission mode '<mode>'. Use one of: acceptEdits, auto, bypassPermissions, manual, dontAsk, plan` | <Undocumented /> | `--permission-mode` has a value that is not in the list. It prints after the account checks, not in the parser. The list shows `manual` in place of `default`.[^perm-mode] |
| ``Error: --settings follows `--` or an option that needs a value. Put it first.`` | <Undocumented /> | `--settings` comes after `--` or after an option that takes a value.[^settings-order] |
| `Error: Remote Control did not start, because sessions would skip part or all of the --settings file ...` | <Undocumented /> | The settings file has a parse error, or the program cannot read it as a pinned file.[^settings-order] |
| ``Error: <flags> before `remote-control` <is or are> not carried over to the sessions Remote Control starts, so Remote Control refuses to start rather than drop <it or them> — remove <it or them>, and give Remote Control's own options after the verb (see `claude remote-control --help`).`` | <Undocumented /> | A root option that Remote Control does not carry over comes before the `remote-control` verb. The message adds a hint for `--permission-mode` and for `--settings`.[^root-flags] |

## Related Pages

- [Subcommands](subcommands.md)
- [All Flags](flags.md) has `--remote-control` and `--rc` for an interactive session.
- [Agents and Remote Settings](../settings/agents-and-remote.md)
- [Remote and Cloud Session Variables](../env-vars/remote-and-cloud-sessions.md)

## Sources

[^parser]: The program, the text of `claude remote-control --help`, `chunk-vqcstapj.js:62`, and the option parser, `chunk-2kt0fcxt.js:6272`, `chunk-2kt0fcxt.js:6264`, and `chunk-2kt0fcxt.js:6286`.
[^identity]: The program, `chunk-5t5gx24m.js:54` (the 30 days, `$872486`), `chunk-5t5gx24m.js:124` (`$11f4c9` matches the folder, the computer, and the account to the saved identity), and `chunk-5t5gx24m.js:254` (`$eebcdf` keeps the saved identity when its age is within `$872486`).
[^same-folder]: The program, `chunk-yp0t53z2.js:455` and `chunk-yp0t53z2.js:455` (the message), behind the `tengu_idempotent_blossom` gate.
[^unattended-help]: The program, `chunk-vqcstapj.js:62` (the help text of `--allow-unattended-tool-calls`, shown when `isViolinWoodEnabledCached` holds at `chunk-vqcstapj.js:11`).
[^grant]: The program, export `writeUnattendedRunGrant`, `chunk-24z78kyr.js:45` (the `unattended-serving-runs` folder under `.claude/state`; the function is at line 50), exported from `chunk-rx7g78z7.js:48`, called at `chunk-2kt0fcxt.js:6863`.
[^startup]: The program, `chunk-2kt0fcxt.js:6668` (the question `Enable Remote Control? (y/n)`, with `remoteDialogSeen` at `chunk-2kt0fcxt.js:6656`), `chunk-2kt0fcxt.js:6738` (the question `Spawn mode for this project:`, with `remoteControlSpawnMode` at `chunk-2kt0fcxt.js:6723`), `chunk-2kt0fcxt.js:6705` (the `http://` check that allows `localhost`), and the help text, `chunk-vqcstapj.js:106` (the trust prompt) and `chunk-vqcstapj.js:108` (`WorktreeCreate` and `WorktreeRemove` hooks).
[^order]: The program, `chunk-k4y0gv1z.js:169` (`$234676`, the checks that run first: the managed setting, the organization sign-in, and the stored login), `chunk-k4y0gv1z.js:188` (`$9575c4`, the organization pin, the diagnosis, the version floor, and the second policy check), and `chunk-k4y0gv1z.js:229` (`$619ed9`, the temp folder and the trusted device). `chunk-k4y0gv1z.js:282-284` calls them in that order (`$234676`, `$9575c4`, `$619ed9`). The diagnosis is `chunk-4yjmbvsy.js:444` (`$c850cd`), the function exported as `getBridgeDisabledDiagnosis` (`chunk-fn1pyejt.js:252`).
[^hybrid]: The program, `chunk-k4y0gv1z.js:178-183` (`remoteControlHybridReason`, which `a6()` calls before the login check) and `chunk-4yjmbvsy.js:557-566` (`$79dd8a`, the three messages). The diagnosis runs the same function first at `chunk-4yjmbvsy.js:445`.
[^org-pin]: The program, `chunk-k4y0gv1z.js:196-205` (`orgPinRefusal`, then `$952745`, which is `69`, or `1`), `chunk-hpc03qzg.js:16-18` (`org_verify_failed` or `policyUnreadable` select the `69` path), and `chunk-aq3ms068.js:30743-30751` (`forceLoginOrgUUID` and `forceLoginMethod`, read from the policy settings). `chunk-s62pzgeb.js:6` sets `$27f994` to `69`.
[^floor]: The program, `chunk-k4y0gv1z.js:211-212` (`checkBridgeMinVersion`, then `"version_floor"`) and `chunk-ygp56hxw.js:140-141` (the message text).
[^policy-again]: The program, `chunk-k4y0gv1z.js:213-218` (`ensurePolicyLimitsLoadedForDiagnostic`, then `remoteControlPolicyDeniedReason`, then `"policy_denied"`).
[^temp]: The program, `chunk-k4y0gv1z.js:261-263` (`claudeTempDir`, then `"temp_dir_unusable"`).
[^trusted]: The program, `chunk-k4y0gv1z.js:273-278` (`"trusted_device_unenrolled"`, then `exitWithError`).
[^flag]: The program, flag `tengu_ccr_bridge`, `chunk-4yjmbvsy.js:366` and `chunk-4yjmbvsy.js:508`. Probe group `cli321`.
[^exit-codes]: The program, `chunk-s62pzgeb.js:5` holds the codes `78`, `75`, `69`, `4`, and `70` (`$4522de`, `$3271fc`, `$27f994`, `$91e482`, and `$a4f85c`). `chunk-2kt0fcxt.js:7112` exits with `69` (`$952745`) when registration fails. `chunk-2kt0fcxt.js:842` imports `4` (`$71b197`). `chunk-2kt0fcxt.js:7577` exits with it when no stop signal was received and the spawn mode is not `single-session`. `chunk-2kt0fcxt.js:7380` and `chunk-2kt0fcxt.js:7397` show that the `SIGINT`, `SIGTERM`, and `SIGHUP` signals stop the server.
[^cli321]: The program, the option parser, from `chunk-2kt0fcxt.js:6170` (the `--spawn` values) to `chunk-2kt0fcxt.js:6298` (`--enable-live-preview`). Probe group `cli321` (`rc-*` cases), run with a fake `max` login, only `DISABLE_TELEMETRY` set, and no network.
[^child-logs]: The program, `chunk-2kt0fcxt.js:6488` (`Session debug logs are off:`), and `chunk-f7fdz8jz.js:44593` (the folder name `child-logs`).
[^rc-worktree]: The program, `chunk-2kt0fcxt.js:4009` (`preserveOnShutdown`), `chunk-2kt0fcxt.js:5848` (the shutdown clean-up passes it as `sessionMayReturn`), and `chunk-2kt0fcxt.js:6123` (the worktree is kept when `sessionMayReturn` is set and no hook made it, `hookBased`).
[^sandbox-flag]: The program, `chunk-2kt0fcxt.js:6213-6216` (the error for both flags) and `chunk-bps6a3gp.js:9` (the `sandbox.enabled` text).
[^needs-value]: The program, `chunk-2kt0fcxt.js:6217`, `chunk-2kt0fcxt.js:6221`, `chunk-2kt0fcxt.js:6233`, `chunk-2kt0fcxt.js:6236`, and `chunk-2kt0fcxt.js:6242` (each option matches only when `b1 + 1 < a1.length`), and `chunk-2kt0fcxt.js:6271` (`Unknown argument:`).
[^perm-mode]: The program, `chunk-2kt0fcxt.js:6221` (the value goes through `$c47bda`, which is `eE` of `chunk-phb99ctz.js:101` and maps `manual` to `default`), `chunk-phb99ctz.js:89` (the six modes), and `chunk-2kt0fcxt.js:6583` ("Unknown permission mode").
[^settings-order]: The program, `chunk-2kt0fcxt.js:6519` ("--settings follows") and `chunk-2kt0fcxt.js:6538` ("would skip part or all").
[^root-flags]: The program, `chunk-k4y0gv1z.js:332` ("not carried over") and `chunk-rwevfvv3.js:2383` (the `remote-control` verb calls it before it starts the server).
