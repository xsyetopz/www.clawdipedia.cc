---
title: Shell, Web, and Background Tasks
description: Every parameter of Bash, PowerShell, Monitor, WebFetch, WebSearch, and TaskStop.
sidebar_position: 3
---

These tools run shell commands, fetch web pages, search the web, and manage background tasks. They reach outside the project, so permission rules and the sandbox matter most for them. For example, `Bash` with `run_in_background` set to `true` starts a long command and returns at once.

You approve or deny each call by rule or by prompt. To change which tools exist, set `CLAUDE_CODE_USE_POWERSHELL_TOOL`, `CLAUDE_CODE_DISABLE_WEB_FETCH=1`, or `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, or add a deny rule. PowerShell and the WebFetch switch are gated. [Tools](index.md#how-to-read-the-tool-tables) explains the Yes and No columns.

## Example

Turn on the PowerShell tool and turn off web fetching for one project.

```json title=".claude/settings.json"
{
  "env": {
    "CLAUDE_CODE_USE_POWERSHELL_TOOL": "1",
    "CLAUDE_CODE_DISABLE_WEB_FETCH": "1"
  }
}
```

## Tools

Official pages: [Tools Reference](https://code.claude.com/docs/en/tools-reference), [Configure Permissions](https://code.claude.com/docs/en/permissions), and [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents).[^tools-source]

| Tool | Status | What It Does | How It Works | Available In | Read-Only | Parallel | Deferred |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Bash` | <Documented /> | Runs a shell command. | See [Bash Parameters](#bash-parameters). | Main session and subagents. Kept in background subagents. | ❌ | ❌ | ❌ |
| `PowerShell` | <Documented /> <Gated note="CLAUDE_CODE_USE_POWERSHELL_TOOL" /> | Runs a Windows PowerShell command. | Same parameters as `Bash`, but `command` is a PowerShell command and `description` has a shorter text. | Main session and subagents. Kept in background subagents. | ❌ | ❌ | ❌ |
| `Monitor` | <Documented /> | Streams the output of a background command or a WebSocket as notifications. | See [Monitor Parameters](#monitor-parameters). | Main session and subagents. Kept in background subagents. | ❌ | ✅ | ✅ |
| `WebFetch` | <Documented /> <Gated note="CLAUDE_CODE_DISABLE_WEB_FETCH=1 turns it off" /> | Fetches a URL and applies a prompt to the page text. | `url` (URL string, required), `prompt` (string, required), `offset` (int, 0 or more, optional, character offset for a long page). The off switch needs `2.1.285` or later. | Main session and subagents. Kept in background subagents. | ✅ | ✅ | ✅ |
| `WebSearch` | <Documented /> <Gated note="off for the gateway provider. Vertex depends on the model" /> | Searches the web. | `query` (string, at least 2 characters, required), `allowed_domains` (string array, optional), `blocked_domains` (string array, optional). | Main session and subagents. Kept in background subagents. | ✅ | ✅ | ✅ |
| `TaskStop` | <Documented /> | Stops a running background task. A command string over 1,000 characters in the stop result or the task notice keeps its first 500 and last 300 characters with a marker between them.[^taskstop-trunc] | `task_id` (string, optional). It also takes a teammate or named background agent by ID or name. `shell_id` (string, optional, deprecated). | Main session and subagents. Kept in background subagents. | ❌ | ✅ | ✅ |

## `Bash` Parameters

| Parameter | What It Does | Required |
| --- | --- | --- |
| `command` | The shell command to run. | ✅ |
| `timeout` | Time limit in milliseconds for a foreground command. | ❌ |
| `description` | A short note on what the command does. | ❌ |
| `run_in_background` | Starts the command as a background task and returns at once. | ❌ |
| `dangerouslyDisableSandbox` | Runs the command without the sandbox. | ❌ |
| `allowed_domains` | Network hosts that this command may reach. Offered only when the sandbox network lists are on. | ❌ |
| `machine` | Name of an attached machine to run the call on. Offered only when machines are attached. | ❌ |

`PowerShell` takes the same parameters, except that it has no `allowed_domains` unless the network lists are on.
[^bash-schema]

## `Monitor` Parameters

| Parameter | What It Does | Required |
| --- | --- | --- |
| `description` | Short note on what the monitor watches. Notifications show it. | ✅ |
| `command` | Shell command whose output lines become notifications. | ❌ |
| `ws` | WebSocket target to stream. Give exactly one of `command` or `ws`. | ❌ |
| `timeout_ms` | Kills the monitor after this time. At least 1000, with a default and a cap. | ❌ |
| `persistent` | Runs until `TaskStop` or the end of the session, with no timeout. | ❌ |
| `allowed_domains` | Network hosts for a `command` monitor, offered only when the sandbox network lists are on. | ❌ |

[^monitor-schema]

## How It Works

- Since `2.1.305`, when the disk is full, `Bash` does not start the command and says so: `The command was not started: this computer's disk is full (ENOSPC) on the volume holding <path> (Claude Code's temporary directory), so the file that captures command output could not be created there and nothing ran. Free space on that volume, or restart Claude Code with CLAUDE_CODE_TMPDIR set to a directory on another one, then retry. If this is the user's own computer, tell them before deleting anything to make room.` It no longer shows a raw `ENOSPC` file path alone.[^disk-full] In `2.1.327`, a branch for `EDQUOT` says `the user's disk quota is used up (EDQUOT)` and not `this computer's disk is full`.[^edquot]
- Since `2.1.310`, `Monitor` and plugin monitors no longer wait for a server-side flag that defaults to off. So they also work on Bedrock, Vertex, and Foundry, and with telemetry or nonessential traffic off, where that flag could not load. In `2.1.327` and `2.1.328`, `Monitor` is on everywhere except Windows. On Windows, it needs Git Bash, and it stays off when the build withholds `Bash`.[^monitor-flag]
- Since `2.1.326`, a watch that ends with no events and whose command wrote to stderr tells Claude so. The text says that stderr is not delivered as events and may mean the command failed. It names the file that holds the output. The same text covers a timeout with no events.[^monitor-stderr]
- `Bash` refuses a command that starts with a `sleep` of 25 seconds or more, while background tasks and their completion notices are on. The `Bash` prompt then tells Claude to poll with `Monitor` and an until-loop. Since `2.1.310`, this also applies where `Monitor` is newly on.[^sleep]
- Since `2.1.311`, a `Bash` or `PowerShell` result can carry `subagentCapApplied`, which is `true` or left out (`BashResult` and `PowerShellResult` in [`claude-code-tools.json`](../schemas.md)). Claude Code sets it when the caller is not the main agent and the timeout it used is shorter than the one asked for. A subagent cap shortens the timeout only when the command can move to the background. A cap of 0 or less means no cap, and the shortened timeout is never below 2000 ms. The background notice then reads `Command was moved to the background (ID: ...) after running for Ns` and not `Command did not complete within its Ns timeout`.[^cap]
- `2.1.323` removes `backgroundCalledBackWithinMs`, which `2.1.321` and `2.1.322` added to a `Bash` result for a backgrounded command. `BashResult` in [`claude-code-tools.json`](../schemas.md) no longer has the field, and the background notice no longer says `you will normally be called back`. `2.1.327` still has neither.[^called-back]
- Since `2.1.311`, when a `Bash` command runs past its timeout and moves to the background, the result holds the notice `Command did not complete within its Ns timeout and was moved to the background (ID: ...)`. The notice names the file that receives the output.[^bg-output]
- A hook whose matcher names `Bash` also runs for a `Monitor` call that has a `command`. The hook sees the call as a `Bash` call with the `command` and `description`. A hook `if` condition that names `Monitor` does not run when the matcher met the call only through `Bash`. A `Monitor` call with `ws` is not covered.[^bash-hook]
- Since `2.1.327`, `WebFetch` refuses a URL of more than 2,000 characters before any permission prompt. The error text is `URL is longer than 2000 characters`.[^fetch-long]
- Since `2.1.327`, the diff of changed files that `Bash` shows names each file that is binary, too large, or too many to show. The release notes also say that the diff is ready sooner in auto and bypass permissions modes.[^bash-diff]
- Since `2.1.327`, `PowerShell` asks before a command that may run `Get-Module` (or its alias `gmo`, or the name `module`), even when a rule names it. The ask needs a server flag to be on. The prompt says `This command may run Get-Module, which can load a module manifest, and a manifest can run any command. Approve only if you trust every module or path it names or receives from the pipeline`. It offers no rule to save. When nothing can answer, the call is refused, unless a whole-tool rule, auto mode, or bypass permissions mode allows it.[^ps-ask]
- Since `2.1.327`, the git guidance that Claude receives for `Bash` on newer models and for `PowerShell` says: `Do not commit files that likely contain secrets (.env, credentials.json, .claude/settings.local.json, etc). Warn the user if they specifically request to commit those files.`[^commit-secrets]
- On Windows, when `pwsh` is not on `PATH`, Claude Code looks in the standard places for PowerShell at the same time: `PowerShell\7\pwsh.exe` under the Program Files folder, `Microsoft\WindowsApps\pwsh.exe`, `.dotnet\tools\pwsh.exe`, and `System32\WindowsPowerShell\v1.0\powershell.exe`. Since `2.1.327`, this `powershell.exe` is used before any `powershell` found on `PATH`.[^ps-locate]
- Since `2.1.327`, a first `Bash` command may start your shell start-up files before you approve it, even if you then refuse it. Set `CLAUDE_CODE_DISABLE_SHELL_HEAD_START=1` to turn this off.[^head-start]
- When a server-side flag is on, the shell that `Bash` starts runs `unalias which` and `unset -f which` before your command, so an inherited `which` alias or function does not apply.[^which]
- On macOS, `Bash` adds a `git` shell function that runs `git grep` with `LC_ALL=C`. Claude Code adds it only when the command is at most 1000 characters, holds only ASCII, and has no variable assignment before `git`. It skips the function when `git grep` has an option that starts with `--p`, `--op`, or `--textc`, or a short option that holds `O`, `P`, or `f`. It also does not replace a `git` alias or function that already exists. The reason for the C locale is not stated.[^git-grep]
- The shell snapshot is a file that `Bash` sources before each command. Claude Code builds it from your `.bashrc` or `.zshrc`. Since `2.1.316`, for bash:[^snapshot]
  - A function whose name starts with `-` or `+` is written as `eval -- ...` and read with `declare -f -- name`, so `declare` does not take the name for an option. Other names keep the old rule, which skips names that start with one underscore and then a character that is not an underscore.
  - An alias is read with `\alias -p`, and only the line that starts with `alias` gets the `alias --` prefix. The lines of a value that holds line breaks stay whole. The zsh branch and the Git Bash (`msys` or `cygwin`) branch still prefix every line, and Git Bash also drops aliases of `winpty`. Every branch keeps the first `1000` lines.
  - The `set -o` step writes `set -o <name>` only for an option whose state is `on`, and for `monitor`. Version `2.1.314` wrote it for every line that held the text `on`, such as `onecmd off`. The release notes say that scripts started from `Bash` stopped after their first command when `SHELLOPTS` was exported.[^set-o]
- Background subagents keep `Bash`, `PowerShell`, `Monitor`, `TaskStop`, `WebFetch`, and `WebSearch`. See [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents).
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` also disables auto-backgrounding and the `Ctrl+B` key ([Environment Variables](https://code.claude.com/docs/en/env-vars)).
- A true value for `CLAUDE_AUTO_BACKGROUND_TASKS` gives the `Agent` tool a 120000 ms auto-background time. It is not in the saved docs, so it is <Undocumented />.[^auto-bg]

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | **Monitor.** `RunMonitorCommand` or a plugin monitor did not run a command. | A permission request or `monitor_input` does not match. The call sent no progress token. Another call changed the working directory. The environment already runs as many monitors as it allows. The same call was started before. A plugin monitor command references a value that a shell would parse. The host of a `ws` URL does not resolve: `could not resolve <host>: <error>`. Run: a `Monitor` call with `ws.url` `ws://cc-probe.invalid/` returned the tool result `could not resolve cc-probe.invalid: getaddrinfo ENOTFOUND`.[^monitor-ws] |
| Various | <Undocumented /> | **Shell and web tools.** A shell, search, or web tool call was refused. | A sed command is dangerous or has no arguments. A shell permission check failed or was interrupted for a pattern. A command contains an invisible character. Git Bash or PowerShell is not available. `WebFetch` cannot fetch localhost or a name with no dot. `ripgrep` was refused or failed. |
| Various | <Undocumented /> | **Built-in `gh api`.** The built-in `gh api` refused a call. | The endpoint, method, header, or field is not valid. `{owner}`, `{repo}`, or `{branch}` cannot be filled in. `--paginate` is used with a non-GET request. `--jq` needs `jq`. The session's GitHub proxy cannot set a header. Nonessential network traffic is disabled. |
| `Failed to execute PowerShell command: Cannot safely quote` | <Undocumented /> | **PowerShell paths.** `PowerShell` puts the temp-directory path in a single-quoted PowerShell string. A path with a character from U+2018 to U+201F stops the call before PowerShell starts, because PowerShell reads those characters as quotes. Set `CLAUDE_CODE_TMPDIR` to a path without them. | Run: with `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`, a `pwsh` on `PATH`, and `CLAUDE_CODE_TMPDIR` set to a folder whose name holds U+2018, a `PowerShell` call returned the tool result `Failed to execute PowerShell command: Cannot safely quote the temp-directory path (override with CLAUDE_CODE_TMPDIR) in a PowerShell single-quoted string literal: it contains U+2018, which PowerShell's tokenizer treats as a quote delimiter` on macOS.[^ps-quote] |
| `WebFetch was refused after its check had passed` | <Undocumented /> | **WebFetch.** At call time, `WebFetch` checks `CLAUDE_CODE_DISABLE_WEB_FETCH` and the `allow_web_fetch` org policy again, and one of them now refuses. | The tool was on when the call began, but the switch is set or the policy is off at call time. The error code is `web_fetch_refused`. The check text is `WebFetch is turned off by CLAUDE_CODE_DISABLE_WEB_FETCH.` for the variable, or the policy text for `allow_web_fetch`. New in `2.1.323`: `2.1.322` checks only when it lists the tool.[^fetch-refused] |
| `The small, fast model that reads the content gave no answer.` | <Undocumented /> | **WebFetch.** The small model that applies the prompt to the fetched page returned empty text. | The page was fetched, but the second step gave an empty answer. The text goes on: `Trying again may work.` Call `WebFetch` again, or word the prompt another way. The text is in `2.1.327`.[^fetch-empty] |
| `The search was cut off before any results arrived. Try again.` | <Undocumented /> | **WebSearch.** A `WebSearch` call ended with no results because the search was cut off. | The text appears in two cases. A search function that the session holds returned no results. Or the reply of the API stopped after it had begun. Call `WebSearch` again. Since `2.1.328`.[^search-cut] |
| `No task found with ID:` | <Undocumented /> | **TaskStop.** `TaskStop` found no task for the ID. | The text can add `Did you mean`, the running teammates, and the running named agents. A stop request from a client with an ID of the shape of a shell task ID, that no task holds, gets a shorter text: `An ID of this shape is not looked up as an agent's name: send the agent's task ID.` Use the task ID, not an agent name, in that case. The short form is in `2.1.327`.[^no-task] |

## Related Pages

- [Tools](index.md)
- [Permission Rules](../../configure/permissions/rules.md)
- [Sandbox](../../configure/permissions/sandbox.md)
- [Tools Reference](https://code.claude.com/docs/en/tools-reference)

## Sources

[^tools-source]: The program, `chunk-r1yxtgw6.js:201784`.
[^taskstop-trunc]: [`2.1.321` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321). The program, `chunk-y8xf3hk8.js:54556`.
[^bash-schema]: The program, the `Bash` input schema, `chunk-56bhcxay.js:5817629`.
[^monitor-schema]: The program, the `Monitor` input schema, `chunk-jd85xpd4.js:18243`.
[^disk-full]: [`2.1.305` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.305). The program, `chunk-56bhcxay.js:3842798` (the text) and `chunk-56bhcxay.js:363250` (the volume path).
[^edquot]: The program, `chunk-56bhcxay.js:3842798`.
[^monitor-flag]: [`2.1.310` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.310). The program, `chunk-jd85xpd4.js:940-942` (`isEnabled` calls the check) and `chunk-d0qhd3r0.js:116-120`. The check returns true off Windows. On Windows it returns false when the build withholds `Bash`, and else true only if Git Bash is found. It has no flag in `2.1.327` or `2.1.328`.
[^monitor-stderr]: The program, `chunk-b8ns6r8h.js:78`.
[^sleep]: The program, `chunk-56bhcxay.js:5822181`, `chunk-56bhcxay.js:3853975`, and `chunk-56bhcxay.js:5814673`.
[^cap]: The program, `chunk-eb9kp9gc.js:843`, `chunk-56bhcxay.js:5810462`, and `chunk-56bhcxay.js:3856388`.
[^called-back]: The program, `chunk-56bhcxay.js:3856092`. The `2.1.323`, `2.1.326`, and `2.1.327` programs hold neither the field name nor the old text; `2.1.322` holds both.
[^bg-output]: The program, `chunk-56bhcxay.js:3856092-3856435` and `chunk-56bhcxay.js:194514-194518`. The notice reads `Command did not complete within its Ns timeout and was moved to the background (ID: ...). Output is being written to: ...`.
[^bash-hook]: The program, `chunk-56bhcxay.js:1109965` (`Bash` is another name of `Monitor` for hook matchers), `chunk-56bhcxay.js:4280877` (the hook input is rewritten as a `Bash` call), and `chunk-56bhcxay.js:4315926` (the skipped `if` condition). The same code is at `chunk-56bhcxay.js:62539-62550`, `chunk-56bhcxay.js:214448-214453`, and `chunk-56bhcxay.js:230017-230027`.
[^fetch-long]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-56bhcxay.js:2779077` and the limit in `chunk-p9hbdxgr.js:400`.
[^bash-diff]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-h6ctx9dd.js:103-135`. The diff view lists the changed files that it cannot show, and its text for files that did not get a diff reads `... changed (binary, mode only or too large to show)`, followed by the file names.
[^ps-ask]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-cg4whsgy.js:3490` (the prompt text), `chunk-cg4whsgy.js:3959-3966` (the ask with `ruleProof`), `chunk-cg4whsgy.js:4050` (the names `get-module`, `gmo`, and `module`), `chunk-cg4whsgy.js:4615` (no saved-rule suggestion), and `chunk-sgx8zvyg.js:17433` (the server flag `bot_protected_tengu_sienna_grebe`).
[^head-start]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-56bhcxay.js:1151300`, `chunk-56bhcxay.js:3819604`, `chunk-2b3eg071.js:71530`.
[^which]: The program, `chunk-56bhcxay.js:3803438`. The flag is `tengu_swirling_koala`.
[^git-grep]: The program, `chunk-56bhcxay.js:3783614`.
[^snapshot]: The program, `chunk-56bhcxay.js:3788286`, `chunk-56bhcxay.js:3790840`, and `chunk-56bhcxay.js:3791809`.
[^set-o]: [`2.1.316` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.316).
[^auto-bg]: The program, `chunk-7fpae888.js:16383`.
[^monitor-ws]: Probe case `print.err319.monitor-ws-unresolvable`.
[^ps-quote]: The program, `chunk-y5jn7kpt.js:269` and `chunk-56bhcxay.js:1158896`. Probe case `print.err319.powershell-tmpdir-quote`.
[^fetch-refused]: The program, `chunk-56bhcxay.js:2780514`.
[^fetch-empty]: The program, `chunk-56bhcxay.js:2776673`.
[^no-task]: The program, `chunk-r1yxtgw6.js:43516` for the list form and `chunk-r1yxtgw6.js:44766` for the short form.
[^commit-secrets]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-56bhcxay.js:1909514` (the short git guidance of `Bash`) and `chunk-ws3ynpc3.js:6087` (the `PowerShell` text). The `2.1.326` `PowerShell` text has no such line.
[^ps-locate]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-pvg3xde6.js:3087`. In `2.1.326`, the `powershell` lookup on `PATH` ran before the `System32` file.
[^search-cut]: The program, `chunk-r1yxtgw6.js:3690` (no results) and `chunk-r1yxtgw6.js:3897` (the reply stopped after output began). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
