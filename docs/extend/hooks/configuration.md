---
title: Hook Configuration
description: Matchers, the if filter, timeouts, failure handling, environment variables, settings keys, and trust rules for hooks.
sidebar_position: 2
---

Hook configuration decides which hooks run, when they run, and what happens when one fails.
A matcher picks the events. An `if` filter narrows them to some tool calls.
The `timeout` and `onFailure` fields set limits.
For example, `"matcher": "Bash"` with `"if": "Bash(git push *)"` runs a hook only for `git push` commands.

To disable hooks, set `disableAllHooks` or `allowManagedHooksOnly`. You can also remove the entry.

## Example

```json title=".claude/settings.json"
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "if": "Edit(*.ts)",
            "command": "bunx prettier --write \"$CLAUDE_PROJECT_DIR\"",
            "timeout": 60,
            "statusMessage": "Formatting"
          }
        ]
      }
    ]
  }
}
```

The hook runs after an edit or write, but only for `.ts` files.
It can run for up to 60 seconds.

## Matcher Rules

The `matcher` key is a string on a matcher group. It picks which occurrences of the event run the group.

| Matcher form | Status | What it does | Notes |
| --- | --- | --- | --- |
| `"*"`, `""`, or no `matcher` | <Documented /> | Matches everything. | The group runs on every occurrence. |
| Letters, digits, `_`, `-`, space, `,`, `\|` only | <Documented /> | An exact string or a list. | `Edit\|Write` and `Edit, Write` both match either name. `mcp__memory` alone matches no tool. |
| Any other character | <Documented /> | A JavaScript regular expression, not anchored. | Claude Code tests it with `RegExp.prototype.test`. Use `^` and `$` to match a whole name. |
| `FileChanged` and `StopFailure` | <Documented /> | A narrower exact set. | Only letters, digits, `_`, and `\|` count as exact. A hyphen, space, or comma makes it a regex. |
| A matcher on an event with no matcher | <Documented /> | Claude Code ignores it silently. | No error. |

## Matcher Targets

The event decides what the matcher tests.

| Target | Status | Values | Events |
| --- | --- | --- | --- |
| Tool name | <Documented /> | `Bash`, `Edit\|Write`, `mcp__.*`. Plugin MCP tools are `mcp__plugin_<plugin>_<server>__<tool>`. `Bash` also matches a `Monitor` call that has a `command`. Such a hook can block the call or ask, but a `permissionDecision` of `allow` is ignored and `updatedInput` is dropped. A `Monitor` call with `ws` is not covered (the program). | `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`, `PermissionDenied` |
| Start source | <Documented /> | `startup`, `resume`, `clear`, `compact`, `fork`. `fork` needs 2.1.214. | `SessionStart` |
| CLI flag | <Documented /> | `init`, `maintenance` | `Setup` |
| End reason | <Documented /> | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` | `SessionEnd` |
| Notification type | <Documented /> | See [Events](session-events.md#notification). | `Notification` |
| Agent type | <Documented /> | `general-purpose`, `Explore`, `Plan`, or a custom name. A plugin name such as `my-plugin:reviewer` contains a colon, so it is a regex. Write `^my-plugin:reviewer$`. | `SubagentStart`, `SubagentStop` |
| Trigger | <Documented /> | `manual`, `auto` | `PreCompact`, `PostCompact` |
| Target model | <Documented /> | The canonical name of `to_model`, without `[1m]`. If Claude Code knows no canonical name, every hook runs. | `PreModelSwitch`, `PostModelSwitch` |
| Config source | <Documented /> | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` | `ConfigChange` |
| Add source | <Documented /> | `slash_command`, `register_repo_root` | `DirectoryAdded` |
| File names | <Documented /> | Literal names split on `\|`. Claude Code filters by base name. The matcher also builds the watch list. | `FileChanged` |
| Error type | <Differs note="The docs list 12 values. The program type also includes verification_required." /> | `rate_limit`, `overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`, `invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`, `cloud_credential_error`, `unknown`. | `StopFailure` |
| Load reason | <Documented /> | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` | `InstructionsLoaded` |
| Command name | <Documented /> | Skill or command names. | `UserPromptExpansion` |
| MCP server name | <Documented /> | Names of configured servers. | `Elicitation`, `ElicitationResult` |
| No matcher | <Documented /> | Always fires. | `UserPromptSubmit`, `PostToolBatch`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate`, `WorktreeRemove`, `MessageDisplay`, `CwdChanged` |

## The `if` Filter

`if` is a handler field. It holds one permission rule, such as `Bash(git *)` or `Edit(*.ts)`.

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| `if` | <Documented /> | Runs the handler only when the rule matches the tool call. | Only the five tool events read it. On any other event the hook never runs. You cannot use `&&` or a list. |
| Bash patterns | <Documented /> | Checked on each subcommand. | Claude Code removes a leading `VAR=value`. It also checks `$()` and backticks. If it cannot parse the command, the hook runs. |
| File patterns | <Documented /> | For example `Edit(src/**)`. | Matches only `src` in the working directory. Use `**/src/**` for any depth. This changed in 2.1.214. |

## Timeouts

`timeout` is a number of seconds.
If a hook reaches its timeout, Claude Code cancels it. Claude Code drops its output.

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| Default `timeout` | <Documented /> | 600 seconds for `command`, `http`, `mcp_tool`. 30 for `prompt`. 60 for `agent`. | We did not search the program for each default. They come from the docs. |
| Lower defaults | <Documented /> | 30 seconds on `UserPromptSubmit`, `PreModelSwitch`, `PostModelSwitch`. 10 seconds on `MessageDisplay`. | For `command`, `http`, `mcp_tool`. |
| `timeout` under 1 second | <Documented /> | On a `prompt` or `agent` hook, a `timeout` under 1 counts as 1 second. | Since `2.1.312`. The program takes the larger of `timeout` and 1. Other types are not changed. See [Handlers](handlers.md#prompt-and-agent-concurrency). |
| `SessionEnd` budget | <Documented /> | 1.5 seconds shared by all hooks. | Claude Code raises it to the largest per-hook `timeout` in settings, up to 60 seconds. Plugin timeouts do not raise it. |
| `PreModelSwitch` timeout | <Documented /> | A hook that reaches its timeout blocks the switch. | |
| `PreToolUse` timeout | <Documented /> | A `command`, `http`, or `mcp_tool` hook that reaches its timeout does not block. | Use `onFailure: "block"` to block. An SDK callback that reaches its timeout does block. |
| `asyncTimeout` | <Undocumented /> | A first reply of `{"async":true,"asyncTimeout":ms}` moves a command hook to the background. It also sets its time limit. | Default 15000 ms. Only the Agent SDK pages name it. See [Agent SDK Hooks](https://code.claude.com/docs/en/agent-sdk/hooks). |

## Failure Handling

A hook fails when it cannot start or reaches its timeout. It also fails when it exits with a code other than 0 or 2, prints invalid JSON, or gets a non-2xx HTTP status.

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| `onFailure: "continue"` | <Documented /> | The default. The action continues after a failure. | `command` and `http` handlers. |
| `onFailure: "block"` | <Documented /> | A failure counts as exit 2. | The error text says `blocking because onFailure is "block"`. |
| `onFailure` has no effect | <Undocumented /> | On async hooks and on `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle`. | The field text in the program says so. The Hooks Reference does not. |
| Windows without Git Bash | <Documented /> | A shell-form `PreToolUse` or `PermissionRequest` hook that fails can block. | Set `shell: "powershell"`, or use exec form with `onFailure`. |
| Background process keeps `stdout` open | <Documented /> | After an allow, this blocks the call with `refusing to honor the suspect capture`. | Redirect the output of background child processes. |
| `CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG` | <Undocumented /> | Your own hooks in user files must succeed. Claude Code drops their grant and rewrite fields. | Program messages: `blocking because it is one of the user's own hooks`. Affects `PreToolUse`, `PermissionRequest`, `PreModelSwitch`, `UserPromptSubmit`, `UserPromptExpansion`. |

## Environment Variables for Hooks

| Variable | Status | What it does | Notes |
| --- | --- | --- | --- |
| `CLAUDE_PROJECT_DIR` | <Documented /> | The project root where the session started. | Stays fixed in a worktree. `cwd` in the input follows Claude. Claude Code also sets it for stdio MCP servers and plugin LSP. |
| `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` | <Documented /> | The plugin install folder and data folder. | Claude Code replaces them in `command` and `args`. It also exports them. |
| `CLAUDE_PLUGIN_OPTION_<KEY>` | <Documented /> | A plugin `userConfig` option. | Use it in shell form. `${user_config.*}` works only in exec form. |
| `CLAUDE_ENV_FILE` | <Documented /> | A file of `export` lines that later Bash commands load. | Append with `>>`. Claude Code sets it for `SessionStart`, `Setup`, `CwdChanged`, `FileChanged`. It does not set it for PowerShell hooks. |
| `CLAUDE_EFFORT` | <Documented /> | The effort level of the turn. | Also visible in Bash. |
| `CLAUDE_CODE_REMOTE` | <Documented /> | `"true"` in remote web environments. | Unset in the local CLI. |
| `CLAUDE_CODE_BRIDGE_SESSION_ID` | <Documented /> | The Remote Control session ID. | Set from 2.1.199 while connected. |
| Inherited environment | <Documented /> | The parent environment minus `OTEL_*`. | `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips more. HIPAA sessions drop Anthropic credentials. |
| `CLAUDE_MODEL` | <Documented /> | Does not exist. | Use `PostModelSwitch` and `to_model`. |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | <Documented /> | The `SessionEnd` budget. | See [Environment Variables](../../configure/env-vars/index.md). |
| `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` | <Documented /> | The most `Stop` continuations in a row. | Default 8. |
| `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS` | <Documented /> | Disables the `permission_prompt` notification in SDK hosts. | |
| `CLAUDE_CODE_DISABLE_FILE_MENTIONS` | <Documented /> | Stops `@` insertion. | |
| `CLAUDE_CODE_GIT_BASH_PATH` | <Documented /> | The Git Bash path on Windows. | |
| `MCP_TIMEOUT` | <Documented /> | How long an MCP hook waits for a server that is still connecting. | |
| `CLAUDE_CODE_HOOKS_SAME_THREAD` | <Undocumented /> | Runs function hooks on the main thread, not in a worker. | The program picks `same-thread` or `worker`. For mods. |
| `CLAUDE_CODE_DISABLE_HOOK_FORWARDING` | <Undocumented /> | Disables hook forwarding in SDK and remote sessions. See [Plugins and MCP](../../configure/env-vars/plugins-and-mcp.md). | |
| `DISABLE_BRIEF_MODE_STOP_HOOK` | <Undocumented /> | Skips the brief-mode check at the end of a turn. See [Features and Toggles](../../configure/env-vars/features-and-toggles.md). | |
| `CLAUDE_CODE_RESUME_SESSIONSTART_HOOKS_WAIT_MS` | <Undocumented /> | Sets how long a resume waits for `SessionStart` hooks. See [Sessions and Storage](../../configure/env-vars/sessions-and-storage.md). | |

## Settings Keys and Trust

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| `hooks` | <Documented /> | The event map. | Merges across levels. |
| `allowedHttpHookUrls` | <Documented /> | A URL allowlist for `http` hooks. | `*` is a wildcard. An empty array blocks all. Arrays merge across levels. |
| `httpHookAllowedEnvVars` | <Documented /> | A name allowlist for header values. | Claude Code intersects it with each hook's `allowedEnvVars`. Arrays merge. |
| Workspace trust | <Documented /> | Settings hooks wait for the trust dialog. | `-p` and SDK sessions treat the folder as trusted. Hooks of project subagents need the dialog. |
| `/hooks` menu | <Documented /> | A read-only browser of your hooks. | Shows where each one comes from. |
| Debug output | <Documented /> | `claude --debug-file <path>` writes hook activity. | `CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose` adds matcher lines. |

The keys `disableAllHooks` and `allowManagedHooksOnly` disable hooks or limit them to managed ones. Their rows are on [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys).

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `Unknown hook decision type`, `Unknown hook permissionDecision type`, `Hook returned incorrect event name`, `Hook from ${…}`, `Hook "${…}"`, `Hook input is over the size limit`, `prompt-type hooks are not supported`, `agent-type hooks are not supported`, `SessionEnd hook [`, `This hook's matcher cannot be tested`, `The name that this hook's matcher`, `invalid hook matcher`, `hook '${…}' does not exist`, `script hook:`, `script hooks are not available`, `Forked dispatch requires` | <Undocumented /> | Claude Code refused a hook, or a hook returned a value that is not valid. | Any of these cases applies. The decision type is not one of approve, block (or allow, deny, ask, defer for `permissionDecision`). The output names another event. The hook is prompt-type or agent-type, and the event has no conversation context. The hook needs bash or PowerShell, and Claude Code did not find the shell. The shell would parse the command in shell form again. |
| Various | <Undocumented /> | **Hooks on this machine.** Claude Code refused a request to list, run, or judge a hook on this machine. | Any of these cases applies. The machine disables hooks through its settings or policy. The machine has not settled its plugins yet. The machine has no such hook for that event. The machine runs only command hooks. A device hook template directory is unsafe, or Claude Code found no `python3`. |
| `Hook ${…}has shell: 'powershell' but no PowerShell executable` | <Undocumented /> | A hook sets `"shell": "powershell"`, and the machine has no PowerShell. | Neither `pwsh` nor `powershell` is on `PATH`. Install PowerShell, or remove `"shell": "powershell"` to use bash. Probe case `print.err319.hook-powershell` printed this text. |
| `Hook ${…}requires bash but Git Bash was not found` | <Undocumented /> | A hook needs bash, and Claude Code found no Git Bash. | The program checks for Git Bash only when `x()==="windows"`, a platform check (read site `chunk-9r1hbf9p.js`, search `requires bash but Git Bash was not found`). On this macOS build the platform is a baked-in `"darwin"` literal, and `CLAUDE_CODE_HOST_PLATFORM` only sets the telemetry `platform` field, so no setting or variable reaches the branch. Not run: hard limit on this host. |
| `the path in the tool's input could not be made absolute for the hook` | <Undocumented /> | Claude Code was asked to judge a hook `if` condition on this machine, and it could not make a path in the tool input absolute. | The request throws this plain error, and no condition is judged. A request to run a hook on this machine does not throw. It returns the text `The hook was not run: the path in the tool's input could not be made absolute for it.` and the call is refused. Source: the program (`chunk-mv50rsxg.js:37603` and `chunk-mfvm1e5b.js:17197`). |

## Related Pages

- [Hooks](index.md): the overview.
- [Handlers](handlers.md): the fields of each handler type.
- [Input and Output](input-and-output.md): exit codes and JSON fields.
- [Environment Variables](../../configure/env-vars/index.md): the full variable list.
- [Settings Files and Scopes](../../configure/settings/index.md): the settings keys.

Source: [Hooks Reference](https://code.claude.com/docs/en/hooks) and the settings schema (`claude-code-settings.json`).
