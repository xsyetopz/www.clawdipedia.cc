---
title: Session, Prompt, and Turn Hook Events
description: The session, prompt, and turn hook events, when each fires, what input it gets, and which output fields it accepts.
sidebar_position: 6
---

## Session Events

These events fire when a session starts or ends, and when its settings, files, or folders change.

### `SessionStart`

Fires when a session starts or resumes.
Interactive starts run it in the background, but the first reply waits for it.
Exit 2 shows `stderr` to you only.
Handlers: `command` and `mcp_tool` (skipped when Claude Code starts).

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `source` | <Documented /> | Input | How the session began: `startup`, `resume`, `clear`, `compact`, `fork`. This is the matcher. |
| `model` | <Documented /> | Input | The active model ID. Can be missing, for example after `/clear`. |
| `agent_type` | <Documented /> | Input | The agent name from `--agent`. Optional. |
| `session_title` | <Documented /> | Input | The custom title. Present only when one exists. |
| `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd` | <Documented /> | Input | The cost of a stale resume. Only for `resume` and `fork` with an earlier reply. Needs 2.1.251. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Text before the first prompt. Plain `stdout` works too. |
| `initialUserMessage` | <Documented /> | Output | The first user message. Only in `-p`. From a plugin it works only if the plugin was installed before the start. |
| `sessionTitle` | <Documented /> | Output | Sets the title. Works for `startup`, `resume`, `fork`. Same as `/rename`. |
| `watchPaths` | <Documented /> | Output | Absolute paths for `FileChanged` to watch. On Windows, a working directory with a lowercase drive letter no longer stops the watch after the first shell command (fixed in `2.1.321`, per the [2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). |
| `reloadSkills` | <Documented /> | Output | Scans the skill and command folders again. Use it after a hook installs skills. |

### `Setup`

Fires for `--init-only`, or for `--init` or `--maintenance` with `-p`. It does not fire on a normal start.
`--init-only` also runs `SessionStart` with `startup`.
Handler: `command` only.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `Setup` event | <Gated note="Fires only with the --init-only, --init, or --maintenance CLI flags." /> | Event | See the flags above. |
| `trigger` | <Documented /> | Input | `init` or `maintenance`. It is also the matcher. |
| `additionalContext` | <Differs note="Docs: Claude Code drops all JSON fields of Setup on every exit code. The program output schema lists additionalContext for Setup." /> | Output | Treat it as not delivered. A probe with `--init` found it never reached the model request ([Probes](../../reference/probes.md#subagents-and-hooks)). |
| `CLAUDE_ENV_FILE` | <Documented /> | Environment | Persists environment variables, as for `SessionStart`. |

### `SessionEnd`

Fires when a session ends.
The budget is 1.5 seconds for all hooks together. Exit 2 shows `stderr` to you. Claude Code drops JSON.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `reason` | <Documented /> | Input | Why it ended: `clear`, `resume`, `logout`, `prompt_input_exit`, `other`. This is the matcher. |

### `InstructionsLoaded`

Fires when `CLAUDE.md` or a `.claude/rules/*.md` file loads.
It runs async and has no decision. It does not fire for an `AGENTS.md` file read directly.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `file_path` | <Documented /> | Input | The absolute path of the file. |
| `memory_type` | <Documented /> | Input | `User`, `Project`, `Local`, or `Managed`. |
| `load_reason` | <Documented /> | Input | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact`. This is the matcher. |
| `globs`, `trigger_file_path`, `parent_file_path` | <Documented /> | Input | Extra data for lazy and `include` loads. `globs` is only for `path_glob_match`. |

### `ConfigChange`

Fires when a settings, managed policy, or skill file changes.
It does not fire for server-managed or MDM changes.
Exit 2 or `decision: "block"` stops the change, except for `policy_settings`.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `source` | <Documented /> | Input | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills`. This is the matcher. |
| `file_path` | <Documented /> | Input | The changed file. Optional. |
| `decision`, `reason` | <Documented /> | Output | `block` keeps the old settings. Nobody sees `reason`. Claude Code drops `systemMessage` and `continue`. |

### `CwdChanged`

Fires when a shell command in the main conversation changes the directory.
It has no matcher and cannot block.
Claude Code clears `CLAUDE_ENV_FILE` at the next event.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `old_cwd`, `new_cwd` | <Documented /> | Input | The two directories. |
| `watchPaths` | <Documented /> | Output, in `hookSpecificOutput` | Replaces the dynamic watch list. An empty array clears it. `systemMessage` shows as a short notice. Claude Code drops `continue`. |

### `FileChanged`

Fires when a watched file changes on disk.
A file watcher drives it, not tool calls.
The matcher names the files to watch, and Claude Code filters by base name.
It cannot block.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `file_path` | <Documented /> | Input | The absolute path. |
| `event` | <Documented /> | Input | `change`, `add`, or `unlink`. |
| `watchPaths` | <Documented /> | Output, in `hookSpecificOutput` | Replaces the dynamic watch list. The watcher starts only when something names a file. |

### `DirectoryAdded`

Fires after `/add-dir`, or after the SDK `register_repo_root` request.
It runs in the background with a 600 second timeout.
It does not fire for `--add-dir`, `/permissions`, or a directory Claude Code already knows.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `directory` | <Documented /> | Input | The absolute path. |
| `source` | <Documented /> | Input | `slash_command` or `register_repo_root`. This is the matcher. `systemMessage` goes to Claude for `slash_command` and to the debug log otherwise. |

## Prompt and Turn Events

These events fire around a turn: when you send a prompt, while text shows, when Claude Code sends a notification, and when Claude stops.

### `UserPromptSubmit`

Fires when you submit a prompt, before Claude reads it.
It has no matcher. It also fires for scheduled tasks, background subagent reports, and messages from other sessions.
The default timeout is 30 seconds.
Exit 2 blocks the prompt. Claude Code adds plain `stdout` as context.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `prompt` | <Documented /> | Input | The text. A typed `/skill` arrives as typed, not expanded. Pasted text arrives expanded. |
| `source` | <Undocumented /> | Input | Who made the prompt: `user`, `sdk`, `system`, `loop_wakeup`, `schedule_wakeup`, `poll_event`. May be missing. |
| `session_title` | <Documented /> | Input | The custom title, only when one exists. |
| `decision`, `reason` | <Documented /> | Output | `block` stops the prompt. You see `reason`. Claude Code does not add it to context. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Context placed next to the prompt. |
| `sessionTitle` | <Documented /> | Output | Sets the session title. |
| `suppressOriginalPrompt` | <Documented /> | Output | Omits the prompt text from the block message. Otherwise the block message ends with `Original prompt:`. Claude Code writes the message to the transcript. |

### `UserPromptExpansion`

Fires when a typed command expands into a prompt.
The matcher is `command_name`.
It covers typing `/skill`, which skips `PreToolUse`.
Exit 2 blocks. Plain `stdout` is context.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `expansion_type` | <Documented /> | Input | `slash_command` or `mcp_prompt`. |
| `command_name`, `command_args`, `prompt` | <Documented /> | Input | The command parts and the raw line. |
| `command_source` | <Documented /> | Input | Where the command came from, such as `plugin`. Optional. |
| `decision`, `reason` | <Documented /> | Output | `block` stops the expansion. |
| `additionalContext`, `suppressOriginalPrompt` | <Documented /> | Output, in `hookSpecificOutput` | As in `UserPromptSubmit`. |

### `MessageDisplay`

Fires while assistant text streams, once for each batch of finished lines.
It has no matcher. The timeout is 10 seconds.
It only changes what you see. The transcript and Claude keep the original.
In `-p` mode it runs once with the full text.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `turn_id`, `message_id` | <Documented /> | Input | UUIDs of the turn and the message. `message_id` is stable for the whole message. |
| `index`, `final` | <Documented /> | Input | The position of the batch. `final` is true on the last one. |
| `delta` | <Documented /> | Input | The new lines. Whole lines, except in the final batch. |
| `displayContent` | <Documented /> | Output, in `hookSpecificOutput` | Text shown in place of `delta`. If the hook fails, the original shows. Claude Code drops `systemMessage` and `continue`. |

### `Notification`

Fires when Claude Code sends a notification.
The matcher is the notification type.
It runs even if desktop notifications are off.
Claude Code ignores the exit code and `stderr`, but `terminalSequence` still works.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `message`, `title`, `notification_type` | <Documented /> | Input | The text, an optional title, and the type. |
| `permission_prompt` | <Documented /> | Type | A prompt waited about 6 seconds. Seen live in the interactive screen (2.1.305) with the message `Claude needs your permission`. |
| `idle_prompt` | <Documented /> | Type | The session was idle for about 60 seconds. Both depend on typing and running agents. Seen live: the message was `Claude is waiting for your input`, about 60 seconds after the turn ended (the config key `messageIdleNotifThresholdMs` sets the 60 seconds, default 60000). |
| `auth_success`, `elicitation_dialog`, `elicitation_url_dialog`, `elicitation_complete`, `elicitation_response` | <Documented /> | Type | Auth finished, and the steps of an MCP question. The two dialog types wait 6 seconds. Seen live in the interactive screen: all four `elicitation_*` values (messages `Claude Code needs your input` for the two dialogs, `Elicitation response for server "probe": accept`, and `MCP server "probe" confirmed elicitation el-1 complete`). `auth_success` needs a login and was not seen. |
| `agent_needs_input`, `agent_completed` | <Documented /> | Type | Background session events in agent view. `agent_needs_input` for a teammate setup question needs 2.1.248. `agent_needs_input` was seen live on 2.1.319 for the dialog `Auto mode can't check actions in this session` (message `Auto mode can't check actions in this session and needs your choice`). Auto mode shows that dialog with a custom base URL that gives no server-side verdict, or that refuses the dangerous-tool-use beta with HTTP 400 (cases `pty.notifications.agent-needs-input` and `-refused`). Up to 2.1.316, the classifier billing notice fired it with the message `Auto mode has a classifier billing notice to acknowledge`. `agent_completed` was not seen (it needs a background session). |
| `quota_auto_resume_fired`, `quota_auto_resume_stale`, `quota_auto_resume_disabled` | <Documented /> | Type | Usage limit wait events. Need 2.1.234. Not seen live: they need a login. |
| `plugin_notification` | <Undocumented /> | Type | The mod call `$.ui.notify` sends it. Seen live: the hook got `message`, `title`, and `notification_type`, even with no notification channel. |
| `auth_storage_failure` | <Undocumented /> | Type | Sent after the OAuth token exchange, when saving the credentials fails. Not seen live. Message: `Claude Code login needs attention: credentials may not have been saved`, or `Claude Code login needs attention: credentials could not be saved`. |
| `worker_permission_prompt` | <Undocumented /> <Gated note="Set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 or use --agent-teams" /> | Type | Sent by the team lead's inbox poller when a teammate asks for permission. Needs agent teams and at least one teammate. It fires only when the lead is idle and shows no dialog. Seen live: the message was `A subagent needs permission for Bash`, with no `title`. A normal `permission_prompt` followed when the dialog showed. The message `<worker> needs network access to <host>` comes from the program and was not run. |
| `push_notification` | <Undocumented /> <Gated note="The PushNotification tool is behind a server-side flag that is off by default" /> | Type | Sent with the message from the `PushNotification` tool. Skipped when the config is off (`config_off`) or the user is present (`user_present`). Setting `CLAUDE_CODE_DISABLE_NOTIFICATION_PRESENCE_CHECK` disables the presence check. Seen live: the input had the common fields, `message`, and `notification_type`, with no `title`. When skipped, the hook does not fire (from the program, not run). |
| `computer_use_enter` | <Undocumented /> <Gated note="Needs a Pro or Max plan, a server flag, and not HIPAA" /> | Type | Not seen live. Message when computer use starts: `Claude is using your computer · press Esc to stop` (or `Ctrl+C`). |
| `computer_use_exit` | <Undocumented /> <Gated note="Needs a Pro or Max plan, a server flag, and not HIPAA" /> | Type | Not seen live. Sent at the end of a turn that sent `computer_use_enter`. Message when computer use ends: `Claude is done using your computer`. |

Seen live: `push_notification` and `worker_permission_prompt`. See [Probes](../../reference/probes.md#notification-types) for how we triggered them.

These come from the program and were not seen live:

- `auth_storage_failure` fires only after a real OAuth login. A probe cannot point the token request at a local server. On macOS the save goes to the real keychain, so we did not run it.
- `computer_use_enter` and `computer_use_exit` fire when the program takes the computer-use lock. The program seems to take it only for tools that act on the screen, so we did not run this. The probe enabled the built-in computer-use server, but its listing and wait calls did not fire the hook.
- We did not run the network form of `worker_permission_prompt`.

The program also lists `model_refusal_fallback` as a type. The probe found no code that sends a Notification with it (a reading of the program, not a live result). The same name is a system message subtype (see [Stream JSON](../headless/stream-json.md)) for a retry on a fallback model after a refusal. The program runs Notification hooks for each type that it sends before it chooses a notification channel.

### `Stop`

Fires when the main agent finishes. It does not fire on a user interrupt.
It has no matcher.
Exit 2 or `decision: "block"` keeps Claude working.
The cap is 8 continuations in a row. `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` sets it.
Handlers: all five types.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `stop_hook_active` | <Documented /> | Input | `true` when a stop hook already continued the turn. Check it to avoid loops. |
| `last_assistant_message` | <Documented /> | Input | The text of the final reply. Use it instead of the transcript. |
| `background_tasks` | <Documented /> | Input | Tasks still running. Each has `id`, `type`, `status`, `description`, and some of `command`, `agent_type`, `server`, `tool`, `name` by type. Claude Code cuts text at 1000 characters. |
| `session_crons` | <Documented /> | Input | Scheduled wakeups. Each has `id`, `schedule`, `recurring`, `prompt`. |
| `decision`, `reason` | <Documented /> | Output | `block` stops Claude from stopping. You must give `reason`. It becomes the next instruction. |
| `additionalContext` | <Documented /> | Output, in `hookSpecificOutput` | Feedback that continues the turn. Claude Code labels it `Stop hook feedback`, not an error. |

### `StopFailure`

Fires instead of `Stop` when the turn ends on an API error.
The matcher is `error`.
Claude Code ignores output and the exit code, but `terminalSequence` works.
Handlers: `command`, `http`, `mcp_tool`.

| Field | Status | Direction | What it does |
| --- | --- | --- | --- |
| `error` | <Differs note="The docs list 12 values. The type SDKAssistantMessageError also includes verification_required." /> | Input | The error type. See the list on [Configuration](configuration.md#matcher-targets). |
| `error_details` | <Documented /> | Input | More detail. Optional. |
| `last_assistant_message` | <Documented /> | Input | The rendered API error text. It is not Claude's own words, unlike in `Stop`. |

## Related Pages

- [Hook Events](events.md): all 33 events and where each one is documented.
- [Input and Output](input-and-output.md): common fields, decisions, and exit codes.
- [Configuration](configuration.md): matchers and timeouts.
