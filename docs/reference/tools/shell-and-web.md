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
| `WebFetch` | <Documented /> <Gated note="CLAUDE_CODE_DISABLE_WEB_FETCH=1 turns it off" /> | Fetches a URL and applies a prompt to the page text. | `url` (URL string, required), `prompt` (string, required), `offset` (int, 0 or more, optional, character offset for a long page). | Main session and subagents. Kept in background subagents. | ✅ | ✅ | ✅ |
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

- When the disk is full, `Bash` does not start the command and says so: `The command was not started: this computer's disk is full (ENOSPC) on the volume holding <path> (Claude Code's temporary directory), so the file that captures command output could not be created there and nothing ran. Free space on that volume, or restart Claude Code with CLAUDE_CODE_TMPDIR set to a directory on another one, then retry. If this is the user's own computer, tell them before deleting anything to make room.` For `EDQUOT`, the text says `the user's disk quota is used up (EDQUOT)` and not `this computer's disk is full`.[^disk-full][^edquot]
- `Monitor` and plugin monitors do not wait for a server-side flag. So they also work on Bedrock, Vertex, and Foundry, and with telemetry or nonessential traffic off. `Monitor` is on everywhere except Windows. On Windows, it needs Git Bash, and it stays off when the build withholds `Bash`.[^monitor-flag]
- A watch that ends with no events and whose command wrote to stderr tells Claude so. The text says that stderr is not delivered as events and may mean the command failed. It names the file that holds the output. The same text covers a timeout with no events.[^monitor-stderr]
- `Bash` refuses a command that starts with a `sleep` of 25 seconds or more, while background tasks and their completion notices are on. The `Bash` prompt then tells Claude to poll with `Monitor` and an until-loop.[^sleep]
- A `Bash` or `PowerShell` result can carry `subagentCapApplied`, which is `true` or left out (`BashResult` and `PowerShellResult` in [`claude-code-tools.json`](../schemas.md)). Claude Code sets it when the caller is not the main agent and the timeout it used is shorter than the one asked for. A subagent cap shortens the timeout only when the command can move to the background. A cap of 0 or less means no cap, and the shortened timeout is never below 2000 ms. The background notice then reads `Command was moved to the background (ID: ...) after running for Ns` and not `Command did not complete within its Ns timeout`.[^cap]
- When a `Bash` command runs past its timeout and moves to the background, the result holds the notice `Command did not complete within its Ns timeout and was moved to the background (ID: ...)`. The notice names the file that receives the output.[^bg-output]
- A hook whose matcher names `Bash` also runs for a `Monitor` call that has a `command`. The hook sees the call as a `Bash` call with the `command` and `description`. A hook `if` condition that names `Monitor` does not run when the matcher met the call only through `Bash`. A `Monitor` call with `ws` is not covered.[^bash-hook]
- `WebFetch` refuses a URL of more than 2,000 characters before any permission prompt. The error text is `URL is longer than 2000 characters`.[^fetch-long]
- The diff of changed files that `Bash` shows names each file that is binary, too large, or too many to show.[^bash-diff]
- `PowerShell` asks before a command that may run `Get-Module` (or its alias `gmo`, or the name `module`), even when a rule names it. The ask needs a server flag to be on. The prompt says `This command may run Get-Module, which can load a module manifest, and a manifest can run any command. Approve only if you trust every module or path it names or receives from the pipeline`. It offers no rule to save. When nothing can answer, the call is refused, unless a whole-tool rule, auto mode, or bypass permissions mode allows it.[^ps-ask]
- The git guidance that Claude receives for `Bash` on newer models and for `PowerShell` says: `Do not commit files that likely contain secrets (.env, credentials.json, .claude/settings.local.json, etc). Warn the user if they specifically request to commit those files.`[^commit-secrets]
- On Windows, when `pwsh` is not on `PATH`, Claude Code looks in the standard places for PowerShell at the same time: `PowerShell\7\pwsh.exe` under the Program Files folder, `Microsoft\WindowsApps\pwsh.exe`, `.dotnet\tools\pwsh.exe`, and `System32\WindowsPowerShell\v1.0\powershell.exe`. This `powershell.exe` is used before any `powershell` found on `PATH`.[^ps-locate]
- A first `Bash` command may start your shell start-up files before you approve it, even if you then refuse it. Set `CLAUDE_CODE_DISABLE_SHELL_HEAD_START=1` to turn this off.[^head-start]
- When a server-side flag is on, the shell that `Bash` starts runs `unalias which` and `unset -f which` before your command, so an inherited `which` alias or function does not apply.[^which]
- On macOS, `Bash` adds a `git` shell function that runs `git grep` with `LC_ALL=C`. Claude Code adds it only when the command is at most 1000 characters, holds only ASCII, and has no variable assignment before `git`. It skips the function when `git grep` has an option that starts with `--p`, `--op`, or `--textc`, or a short option that holds `O`, `P`, or `f`. It also does not replace a `git` alias or function that already exists. The reason for the C locale is not stated.[^git-grep]
- The shell snapshot is a file that `Bash` sources before each command. Claude Code builds it from your `.bashrc` or `.zshrc`. For bash:[^snapshot]
  - A function whose name starts with `-` or `+` is written as `eval -- ...` and read with `declare -f -- name`, so `declare` does not take the name for an option. Other names are skipped when they start with one underscore and then a character that is not an underscore.
  - An alias is read with `\alias -p`, and only the line that starts with `alias` gets the `alias --` prefix. The lines of a value that holds line breaks stay whole. The zsh branch and the Git Bash (`msys` or `cygwin`) branch still prefix every line, and Git Bash also drops aliases of `winpty`. Every branch keeps the first `1000` lines.
  - The `set -o` step writes `set -o <name>` only for an option whose state is `on`, and for `monitor`.
- Background subagents keep `Bash`, `PowerShell`, `Monitor`, `TaskStop`, `WebFetch`, and `WebSearch`. See [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents).
- `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` also disables auto-backgrounding and the `Ctrl+B` key ([Environment Variables](https://code.claude.com/docs/en/env-vars)).
- A true value for `CLAUDE_AUTO_BACKGROUND_TASKS` gives the `Agent` tool a 120000 ms auto-background time. It is not in the saved docs, so it is <Undocumented />.[^auto-bg]

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | **Monitor.** `RunMonitorCommand` or a plugin monitor did not run a command. | A permission request or `monitor_input` does not match. The call sent no progress token. Another call changed the working directory. The environment already runs as many monitors as it allows. The same call was started before. A plugin monitor command references a value that a shell would parse. The host of a `ws` URL does not resolve: `could not resolve <host>: <error>`.[^monitor-ws] |
| Various | <Undocumented /> | **Shell and web tools.** A shell, search, or web tool call was refused. | A sed command is dangerous or has no arguments. A shell permission check failed or was interrupted for a pattern. A command contains an invisible character. Git Bash or PowerShell is not available. `WebFetch` cannot fetch localhost or a name with no dot. `ripgrep` was refused or failed. |
| Various | <Undocumented /> | **Built-in `gh api`.** The built-in `gh api` refused a call. | The endpoint, method, header, or field is not valid. `{owner}`, `{repo}`, or `{branch}` cannot be filled in. `--paginate` is used with a non-GET request. `--jq` needs `jq`. The session's GitHub proxy cannot set a header. Nonessential network traffic is disabled. |
| `Failed to execute PowerShell command: Cannot safely quote` | <Undocumented /> | **PowerShell paths.** `PowerShell` puts the temp-directory path in a single-quoted PowerShell string. A path with a character from U+2018 to U+201F stops the call before PowerShell starts, because PowerShell reads those characters as quotes. Set `CLAUDE_CODE_TMPDIR` to a path without them. | The tool result reads `Failed to execute PowerShell command: Cannot safely quote the temp-directory path (override with CLAUDE_CODE_TMPDIR) in a PowerShell single-quoted string literal: it contains U+2018, which PowerShell's tokenizer treats as a quote delimiter`.[^ps-quote] |
| `WebFetch was refused after its check had passed` | <Undocumented /> | **WebFetch.** At call time, `WebFetch` checks `CLAUDE_CODE_DISABLE_WEB_FETCH` and the `allow_web_fetch` org policy again, and one of them now refuses. | The tool was on when the call began, but the switch is set or the policy is off at call time. The error code is `web_fetch_refused`. The check text is `WebFetch is turned off by CLAUDE_CODE_DISABLE_WEB_FETCH.` for the variable, or the policy text for `allow_web_fetch`.[^fetch-refused] |
| `The fetch tool returned no text for this page.` | <Undocumented /> | **WebFetch.** A fetch tool of the session (error id `web-fetch-mcp-tool`) fetched the page and gave back empty text. | `WebFetch` fails with this text. Call it again, or try another page.[^fetch-no-text] |
| `The small, fast model that reads the content gave no answer.` | <Undocumented /> | **WebFetch.** The small model that applies the prompt to the fetched page returned empty text. | The page was fetched, but the second step gave an empty answer. The text goes on: `Trying again may work.` Call `WebFetch` again, or word the prompt another way.[^fetch-empty] |
| `The search was cut off before any results arrived. Try again.` | <Undocumented /> | **WebSearch.** A `WebSearch` call ended with no results because the search was cut off. | The text appears in two cases. A search function that the session holds returned no results. Or the reply of the API stopped after it had begun. Call `WebSearch` again.[^search-cut] |
| `No task found with ID:` | <Undocumented /> | **TaskStop.** `TaskStop` found no task for the ID. | The text can add `Did you mean`, the running teammates, and the running named agents. A stop request from a client with an ID of the shape of a shell task ID, that no task holds, gets a shorter text: `An ID of this shape is not looked up as an agent's name: send the agent's task ID.` Use the task ID, not an agent name, in that case.[^no-task] |

## Related Pages

- [Tools](index.md)
- [Permission Rules](../../configure/permissions/rules.md)
- [Sandbox](../../configure/permissions/sandbox.md)
- [Tools Reference](https://code.claude.com/docs/en/tools-reference)

## Sources

[^tools-source]: The program, `chunk-d1scfh43.js:54` (the tool names `TaskStop`, `WebFetch`, and `WebSearch` in the list of tool names).
[^taskstop-trunc]: The program, `chunk-krh304mc.js:3588` (`$c2bb4a`: over 1000 characters, `500` first and `300` last).
[^bash-schema]: The program, the `Bash` input schema, `chunk-hg1yqkjk.js:291945` (`command`, `timeout`, `description`, `run_in_background`).
[^monitor-schema]: The program, the `Monitor` input schema, `chunk-3en7bpzn.js:513` (`description`, `timeout_ms`, `persistent`).
[^disk-full]: The program, `chunk-hg1yqkjk.js:249046` (the text) and `chunk-hg1yqkjk.js:22062` (the volume path).
[^edquot]: The program, `chunk-hg1yqkjk.js:249044` (`EDQUOT` and `the user's disk quota is used up`).
[^monitor-flag]: The program, `chunk-3en7bpzn.js:941` (`isEnabled` calls the check) and `chunk-v16rzw0k.js:116` (the check `$4491e5`). The check returns true off Windows. On Windows it returns false when the build withholds `Bash`, and else true only if Git Bash is found. It has no flag.
[^monitor-stderr]: The program, `chunk-a4cww0eh.js:78` (`stderr, which isn't delivered as events and may mean it failed`).
[^sleep]: The program, `chunk-hg1yqkjk.js:292213` (the `sleep` pattern), `chunk-hg1yqkjk.js:292220` (the limit, a constant with the value `25`), `chunk-hg1yqkjk.js:292668` (the refusal text with `sleep`), and `chunk-hg1yqkjk.js:108403` (the `Bash` prompt text that names `Monitor` and the until-loop).
[^cap]: The program, `chunk-qe4gckzg.js:36` (the cap, where `subagentCapMs` of 0 or less means no cap and `2000` is the least timeout), `chunk-hg1yqkjk.js:293635` (`subagentCapApplied`), and `chunk-hg1yqkjk.js:249587` (the two notices, `Command was moved to the background (ID: ...) after running for Ns` and `Command did not complete within its Ns timeout`).
[^bg-output]: The program, `chunk-hg1yqkjk.js:249588`. The notice reads `Command did not complete within its Ns timeout and was moved to the background (ID: ...). Output is being written to: ...`.
[^bash-hook]: The program, `chunk-avkdw0az.js:2469` (`Bash` is another name of `Monitor` for hook matchers, when the call has a `command`), `chunk-avkdw0az.js:2459` (the hook input is rewritten as a `Bash` call with `command` and `description`), and `chunk-hg1yqkjk.js:268038` (the skipped `if` condition). The same code is at `chunk-hg1yqkjk.js:266283-266290` (`tool_name` and `tool_input` are rewritten).
[^fetch-long]: The program, `chunk-hg1yqkjk.js:134184` (`URL is longer than`) and the limit in `chunk-tz4tgxyb.js:23`.
[^bash-diff]: The program, `chunk-73abjwvb.js:164`. The diff view lists the changed files that it cannot show, and its text for files that did not get a diff reads `... changed (binary, mode only or too large to show)`, followed by the file names.
[^ps-ask]: The program, `chunk-xzd0knvp.js:3517` (the prompt text), `chunk-xzd0knvp.js:4077` (the names `get-module`, `gmo`, and `module`, and the ask with `ruleProof`), `chunk-xzd0knvp.js:4642` (`ruleProof` gives no saved-rule suggestion), `chunk-xzd0knvp.js:4959` (the ask that a rule cannot override), and `chunk-g4ytdnfz.js:1073` (the server flag `bot_protected_tengu_sienna_grebe`).
[^head-start]: The program, `chunk-hg1yqkjk.js:70428` (`CLAUDE_CODE_DISABLE_SHELL_HEAD_START`), `chunk-hg1yqkjk.js:247807`, `chunk-hg1yqkjk.js:247807`, `chunk-wm04tzdx.js:4812`.
[^which]: The program, `chunk-hg1yqkjk.js:247072`. The flag is `tengu_swirling_koala`.
[^git-grep]: The program, `chunk-hg1yqkjk.js:246183`.
[^snapshot]: The program, `chunk-hg1yqkjk.js:246395` (`eval --` and `declare -f --` for a name that starts with `-` or `+`), `chunk-hg1yqkjk.js:246470`, `chunk-hg1yqkjk.js:246470` (the `set -o` step), and `chunk-hg1yqkjk.js:246484` (`\alias -p` and the `alias --` prefix).
[^auto-bg]: The program, `chunk-rjy0ddvf.js:1103`.
[^monitor-ws]: The program, `chunk-3en7bpzn.js:161` (`could not resolve <host>: <error>` for a `ws` URL, the text `could not resolve`).
[^ps-quote]: The program, `chunk-ykw467c0.js:15` (the check and the message) and `chunk-hg1yqkjk.js:70793` (the temp-directory call).
[^fetch-refused]: The program, `chunk-hg1yqkjk.js:134250`.
[^fetch-empty]: The program, `chunk-hg1yqkjk.js:134078`.
[^no-task]: The program, `chunk-b2932m4d.js:2268` for the list form and `chunk-b2932m4d.js:2322` for the short form.
[^commit-secrets]: The program, `chunk-hg1yqkjk.js:108243` (the short git guidance of `Bash`, with `.env`) and `chunk-rbrxn03m.js:187` (the `PowerShell` text).
[^ps-locate]: The program, `chunk-d1h5mdmm.js:163`.
[^search-cut]: The program, `chunk-b2932m4d.js:3726` (no results) and `chunk-b2932m4d.js:3935` (the reply stopped after output began).
[^fetch-no-text]: The program, `chunk-hg1yqkjk.js:133844` (the text "The fetch tool returned no text for this page." with the id `web-fetch-mcp-tool`).
