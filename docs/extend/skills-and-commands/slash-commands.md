---
title: Slash Commands
description: Every built-in slash command in Claude Code 2.1.314, grouped by job, with aliases, arguments, and gates.
sidebar_position: 5
---

A slash command is a word that starts with `/`. You type it in the prompt to do one thing, such as clearing the session or switching the model.
Type `/` to see the list.
Some commands open a panel. Others print a result or expand into a prompt for Claude.
Many commands are hidden unless your account, provider, or settings allow them.

You cannot change built-in commands. You can add your own with [skills](index.md). Some commands have an env var or setting. The Notes column names it. Some also work in `-p` and the SDK.

## Example

```text
/model opus
/compact keep the database schema decisions
/effort high
```

Each line is a separate command. The text after the name is the argument.

## How to Read the Tables

- A panel command opens an interactive screen. The program calls it `local-jsx`.
- A text command returns text from fixed code. The program calls it `local`.
- A prompt command expands into a model prompt. The program calls it `prompt`.
- Many commands have two forms: a panel for interactive sessions and a text form for `-p` and the SDK.
- A `Gated` badge means a flag, policy, plan, provider, or env var must allow the command.
- The program holds about 101 command names. It also makes `/mcp__<server>__<prompt>` commands from MCP prompts.

## Session and Conversation Commands

| Command | Status | What it does | Notes |
| --- | --- | --- | --- |
| `/add-dir` `<path>` | <Documented /> | Adds a working folder. | Panel. Runs at once when you give a path. Loads `.claude/skills`, `.claude/commands`, and `.claude/agents` of that folder. A text form runs for some SDK entry points. |
| `/cd` `<path>` | <Documented /> | Moves this session to a new working folder. | Panel. The new folder adds its project skills (2.1.246 or later). |
| `/clear` (aliases `/reset`, `/new`) `[name]` | <Documented /> | Starts a new session with empty context. | The old session stays on disk. `/resume` opens it. Works non-interactive too. |
| `/compact` `<optional custom summarization instructions>` | <Documented /> | Summarizes the conversation to free context. | Off when env var `DISABLE_COMPACT` is truthy. See [Context and Compaction](../../how-it-works/context-and-compaction.md). |
| `/autocompact` `[auto\|<tokens>]` | <Documented /> | Sets how full the context gets before it auto-summarizes. | Panel in interactive mode. A text form, "Configure the auto-compact window size", runs non-interactive or in a remote workspace. |
| `/context` | <Documented /> | Shows current context use. | Found only as a text command, enabled in non-interactive mode. |
| `/resume` (alias `/continue`) `[conversation id or search term]` | <Documented /> | Resumes a past conversation. | Panel. Hidden for a remote viewer. See [Sessions and Storage](../../how-it-works/sessions-and-storage.md). |
| `/rename` (alias `/name`) `[name]` | <Documented /> | Renames the conversation. | Panel and text form. |
| `/branch` `[name]` | <Documented /> | Branches the conversation at this point. | Panel. |
| `/fork` `<directive> or [prompt]` | <Documented /> | Starts a background agent that inherits the full conversation. | Panel. Off in coordinator mode. |
| `/subtask` `<task>` | <Documented /> | Sends a subagent to work with your full context. Its result returns here. | Panel. Off in coordinator mode. |
| `/background` (alias `/bg`) `[prompt]` | <Documented /> | Sends this session to the background. Frees the terminal. | Panel. Runs at once with no prompt. Matches the `--bg` flag. |
| `/stop` | <Gated note="The session must be a background session." /> | Stops this background session. | It keeps the transcript and worktree. |
| `/goal` `[<condition> \| clear]` | <Documented /> | Sets a goal that Claude checks before it stops. | Panel. A text form ("keep working until the condition is met") runs non-interactive or in a remote workspace. |
| `/plan` `[open\|<description>]` | <Documented /> | Enables plan mode, or shows the session plan. | Panel. |
| `/recap` | <Documented /> | Writes a one-line session recap now. | Text command. |
| `/btw` `[question]` | <Documented /> | Asks a quick side question without interrupting the main conversation. | Panel. |
| `/export` `[filename]` | <Documented /> | Exports the conversation to a file or the clipboard. | Panel. |
| `/copy` `[N]` | <Documented /> | Copies the last reply to the clipboard. `/copy N` copies the Nth latest. | Panel. |
| `/exit` (alias `/quit`) | <Documented /> | Exits the CLI. In a background session, it detaches. The session keeps running. | Panel and text form. |
| `/restart` (alias `/update`) | <Gated note="Interactive terminal on macOS or Linux, native install only, and a server-side feature flag." /> | Restarts Claude Code on the newly installed version. Resumes this session. | Interactive only. See [How `/restart` Works](#how-restart-works). |
| `/rewind` (aliases `/checkpoint`, `/undo`) | <Documented /> | Restores the code, the conversation, or both to an earlier point. | Interactive only. |
| `/tasks` (alias `/bashes`) | <Documented /> | Shows and manages everything that runs in the background. | Panel. |
| `/list-agents` (alias `/peers`) | <Documented /> | Lists subagents, teammates, and other sessions you can message. | Off when the org setting `messagingBeyondOwnAgentsDisabled` is set. |
| `/focus` `[on\|off]` | <Documented /> | Toggles focus view: only your prompt, a summary, and the reply. | Needs the fullscreen renderer (`/tui fullscreen` or `CLAUDE_CODE_NO_FLICKER=1`). The setting `viewMode: "focus"` does the same. |
| `/diff` | <Documented /> | Shows uncommitted changes and per-turn diffs. | Panel. Off when a mod provides its own diff view. |
| `/model` `<model> or [model]` | <Documented /> | Sets the model. | Panel and text form. See [Models](../../how-it-works/models.md). |
| `/effort` `[levels] or <levels>` | <Documented /> | Sets the effort level. | Panel and text form. Since `2.1.304`, `/effort status` no longer shows a guessed level when `CLAUDE_CODE_EFFORT_LEVEL` is `auto` or `unset`. |
| `/fast` `[on\|off]` | <Gated note="First-party provider, and env var CLAUDE_CODE_DISABLE_FAST_MODE not set." /> | Toggles fast mode. | Panel and text form. When you turn it on with `claude-opus-4-8` as the model, from the command or the picker, Claude Code shows "Opus 4.8 fast mode is deprecated and will be removed on Nov 30". The notice stops after that date. A server value can move the date. `2.1.314` has the same notice (the program, `chunk-sy129746.js`). |
| `/advisor` `[model\|off]` | <Gated note="On when env CLAUDE_CODE_ENABLE_EXPERIMENTAL_ADVISOR_TOOL is set, otherwise server flag tengu_sage_compass2" /> <Experimental /> | Lets Claude consult a stronger model at key moments. | Panel and text form. See [`CLAUDE_CODE_ENABLE_EXPERIMENTAL_ADVISOR_TOOL`](../../configure/env-vars/models-and-effort.md). |

## Setup, Interface, and Config Commands

| Command | Status | What it does | Notes |
| --- | --- | --- | --- |
| `/config` (alias `/settings`) `key=value` | <Documented /> | Sets a setting by key. | The text form works in non-interactive mode only. |
| `/memory` | <Documented /> | Edits `CLAUDE.md` files and memory settings. | Panel. |
| `/permissions` (alias `/allowed-tools`) | <Documented /> | Manages allow and deny rules. | Panel. |
| `/hooks` | <Documented /> | Shows your hook configuration. | Panel. Needs no workspace. See [Hooks](../hooks/index.md). |
| `/mcp` `[reconnect\|enable\|disable [<server>\|all]]` | <Documented /> | Manages MCP servers. | Panel and text form. |
| `/plugin` (aliases `/plugins`, `/marketplace`) `[subcommand]` | <Documented /> | Manages plugins. | Panel with argument completion. |
| `/reload-plugins` `[--force]` | <Documented /> | Activates pending plugin changes in the current session. | Runs non-interactive too (2.1.260 or later). |
| `/reload-skills` | <Documented /> | Loads skills added or changed on disk during this session. | Works in both modes. |
| `/skills` | <Documented /> | Lists available skills. `Space` cycles the `skillOverrides` state and `Esc` saves it. | Panel. |
| `/skill-doctor` | <Documented /> | Shows which loaded skills are unused and cost context. | Panel (opens the `/plugin` Stats tab) and a text form. Needs feature-flag fetching. |
| `/output-style` `[style]` | <Documented /> | Lists output styles or switches to one. | Text command. |
| `/theme` | <Documented /> | Changes the theme. | Panel. |
| `/tui` `[default\|fullscreen]` | <Documented /> | Sets the terminal UI renderer. | A change restarts and resumes the session. |
| `/color` `[color\|default]` | <Documented /> | Sets the prompt bar color for this session. | Panel and text form. |
| `/brief` | <Gated note="Remote config flag enable_slash_command, and the account needs the Brief tool." /> | Toggles brief-only mode. | Panel. |
| `/scroll-speed` | <Documented /> | Adjusts mouse wheel scroll speed. | Needs the fullscreen renderer. Off in some terminals, including JetBrains. |
| `/terminal-setup` | <Documented /> | Installs the Shift+Enter key binding. | The text changes with the terminal. |
| `/keybindings` | <Documented /> | Opens your keyboard shortcuts file. | Interactive only. Needs keybinding customization on. |
| `/ide` `[open]` | <Documented /> | Manages IDE integrations and shows status. | Panel. |
| `/init` | <Documented /> | Creates a `CLAUDE.md` file with codebase notes. | A prompt command. With env var `CLAUDE_CODE_NEW_INIT` it also configures skills and hooks. Claude can call it through the `Skill` tool. |
| `/auto-mode-setup` `[--request-id <uuid>] (--wizard ... --propose \| --expect-sha256 <hex> --apply-file <path>)` | <Gated note="An environment-onboarding policy flag." /> | Teaches auto mode about your environment, with optional rule changes. It reads your project and recent sessions. | Panel. The text form is non-interactive. Since `2.1.304` it is also on Bedrock, Vertex, Foundry, a Claude apps gateway, and with telemetry off. `skillOverrides["auto-mode-setup"]: "off"` turns it off (the program). |
| `/import` `[codex\|gemini\|cursor] [--dry-run]` | <Gated note="Server flag tengu_import, off by default. You cannot enable it" /> | Imports config from another AI coding agent. | Panel and text form. |
| `/help` | <Documented /> | Shows help and the command list. | Panel. Terminal only. |
| `/status` | <Documented /> | Shows version, model, account, API connectivity, and tool status. | Panel. Lists skills whose `allowed-tools` were ignored. |
| `/usage` (aliases `/cost`, `/stats`) | <Documented /> | Shows session cost, plan use, and activity stats. | Panel and text form. Since `2.1.304` it says when a rate limit ends. `CLAUDE_CODE_OAUTH_TOKEN` shows the limit rows too. Since `2.1.305` each warning is a one-line fix that names its source, and `f` applies the fixes. The same fixes appear in VS Code and `/doctor` ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). See [How `/usage` and `/artifacts` Work](#how-usage-and-artifacts-work). |
| `/release-notes` | <Documented /> | Shows release notes. | Panel. |
| `/statusline` | <Documented /> | Configures the status line. | A prompt command. Not in safe mode. Interactive only. |
| `/sandbox` `exclude "command pattern"` (Windows also `install`) | <Gated note="Hidden when the platform is not supported or not in the enabled list." /> | Shows sandbox state and opens its settings. | Panel. |
| `/chrome` | <Gated note="Availability claude-ai, policy allow_claude_browser_extension, interactive only." /> | Opens Claude in Chrome settings. | Panel. |
| `/insights` | <Gated note="Policy allow_insights, and needs a workspace." /> | Makes a report that analyzes your sessions. | A prompt command. |
| `/privacy-settings` | <Gated note="A signed-in subscriber with an eligible plan." /> | Views and updates privacy settings. | Panel. |
| `/login` | <Documented /> | Signs in, or switches accounts. | Off when env var `DISABLE_LOGIN_COMMAND` is set. |
| `/logout` | <Documented /> | Signs out. | Off when env var `DISABLE_LOGOUT_COMMAND` is set. |
| `/install` `[options]` | <Documented /> | Installs the native build. | Takes `--force` and a target. Interactive only. |

## Account, Cloud, and Other Commands

| Command | Status | What it does | Notes |
| --- | --- | --- | --- |
| `/usage-credits` | <Gated note="Env var DISABLE_EXTRA_USAGE_COMMAND not set, and the account can use credits." /> | Configures usage credits, or asks your admin for them at a limit. | Panel and text form. |
| `/upgrade` | <Gated note="Availability claude-ai, env var DISABLE_UPGRADE_COMMAND not set, plan is not enterprise." /> | Upgrades your plan for higher rate limits and more Opus (the description in `2.1.319`; `2.1.316` said "Upgrade to Max for higher rate limits and more Opus"). The program ships the text in its command table. The command is on only when the `tengu_idle_amber_finch` flag is off, `DISABLE_UPGRADE_COMMAND` is not set, and the plan is not enterprise. Case `pty.cli319.slash.upgrade` (fake key) gives `Unknown command: /upgrade`. Case `live.cli319.upgrade-typeahead` (real login, typed `/upg`, no Enter) lists only `/rate-limit-options`, whose text holds "upgrade options", so the account of the run does not get `/upgrade` and no run shows its description. | Panel. |
| `/project` `[Project ID or claude.ai address] [--save] \| clear [--save]` | <Undocumented /> <Gated note="Needs a claude.ai login and the server flag tengu_gentle_cupcake." /> | Sets the claude.ai Project that this session names in usage reports. It takes a Project ID or an address such as `https://claude.ai/project/<ID>`. `--save` keeps it for the folder in `attributionProject`. `clear` removes it. The variable `CLAUDE_CODE_ATTRIBUTION_PROJECT` wins over it, and managed settings can stop it. A one-shot `claude -p` run ends before a request uses it. New in `2.1.319`. Case: `pty.cli319.slash.project` (with the fake API key the command is not in the list: "Unknown command: /project"). Read site: the command table, `isEnabled: Hys() && k("tengu_gentle_cupcake")`. | Text command. |
| `/use-case` `[use case]` | <Undocumented /> <Gated note="Needs a claude.ai login, a workspace, and the server flag tengu_federated_possum. Hidden when the program has no use case to list." /> | Chooses the Life Sciences use case that applies to your requests. It ties to the variables `CLAUDE_CODE_PROGRAM_USE_CASE_ID` and `CLAUDE_CODE_PROGRAM_USE_CASE_STAMPED` and to the beta `program-use-case-ids`. New in `2.1.319`. Case: `pty.cli319.slash.use-case` (with the fake API key: "Unknown command: /use-case"). Read site: the command table, `isEnabled: Y0() && !Tt()`. | Panel. |
| `/pro-trial-expired` | <Undocumented /> | Options shown when the Pro plan trial ends. | Hidden. The UI shows it. You do not type it. |
| `/rate-limit-options` | <Gated note="claude.ai sign-in." /> | Manages usage limits and upgrade options. | Panel. |
| `/passes` | <Gated note="Hidden unless the account is eligible." /> | Shares a free week of Claude Code with friends. | Panel. |
| `/feedback` `[report]` | <Gated note="Off when env var DISABLE_FEEDBACK_COMMAND is set." /> | Sends feedback or reports a bug. | Panel. |
| `/bug` (alias `/share`) `[report]` | <Gated note="Env var DISABLE_BUG_COMMAND exists." /> | Reports a bug or shares your conversation. | Panel. |
| `/install-github-app` | <Gated note="Availability claude-ai and console. Off when env var DISABLE_INSTALL_GITHUB_APP_COMMAND is set." /> | Configures GitHub Actions for a repository. | Panel. |
| `/install-slack-app` | <Gated note="Availability claude-ai." /> | Installs the Slack app. | Text command. |
| `/setup-bedrock` | <Gated note="Hidden unless CLAUDE_CODE_USE_BEDROCK is set." /> | Reconfigures Amazon Bedrock sign-in, region, or model pins. | Panel. See [Models and Providers](../../configure/models-and-providers/index.md). |
| `/setup-vertex` | <Gated note="Hidden unless CLAUDE_CODE_USE_VERTEX is set." /> | Reconfigures Google Vertex AI sign-in, project, region, or model pins. | Panel. |
| `/web-setup` | <Gated note="Availability claude-ai. Policies allow_remote_sessions and allow_quick_web_setup." /> | Configures cloud sessions with your GitHub account. | Panel. |
| `/cloud-plugins` | <Gated note="Off when env var CLAUDE_CODE_DISABLE_PLUGIN_FORWARDING is set." /> | Chooses whether cloud sessions use the plugins enabled on this machine. | Panel. |
| `/remote-env` | <Gated note="Availability claude-ai and console-profile. Policy allow_remote_sessions." /> | Chooses the default environment for cloud agents. | Panel. |
| `/teleport` (alias `/tp`) | <Gated note="Availability claude-ai and console-profile. Policy allow_remote_sessions." /> | Sends this session to the cloud, or resumes one from claude.ai. | Panel. |
| `/session` (alias `/remote`) | <Gated note="Needs a remote workspace." /> | Shows the cloud session URL and a QR code. | Panel. |
| `/desktop` (alias `/app`) | <Gated note="Availability claude-ai." /> | Continues the session in Claude Desktop. | Panel. |
| `/mobile` (aliases `/ios`, `/android`) | <Documented /> | Shows a QR code to download the mobile app. | Panel. |
| `/remote-control` (alias `/rc`) `[name]` | <Gated note="Off when the setting disableRemoteControl is true." /> | Controls this session from your phone or claude.ai/code. | Panel. Since `2.1.305`, pressing `w` in the spawn-mode screen says the new mode is saved for the folder, and a later `claude remote-control` start that uses the saved mode says where it came from ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). A `!` command sent over Remote Control is not run: `Not run: '!' commands aren't available in Remote Control sessions. Run the command directly on the computer the session is running on.` (the program). |
| `/ultraplan` `<prompt>` | <Gated note="Availability claude-ai." /> | Drafts an editable plan in a cloud session. | Panel. |
| `/ultrareview` | <Gated note="Paid feature." /> | Runs a cloud code review. | Panel and text form. |
| `/autofix-pr` | <Gated note="Availability claude-ai and console-profile. Policy allow_remote_sessions." /> | Watches the current pull request and fixes issues. | Panel. |
| `/send-to-project` `["project name" or id] [message or note]` | <Gated note="Policy allow_remote_sessions, not CLAUDE_CODE_REMOTE, a claude.ai login, and a hidden server-side flag." /> | Sends this session's work to a Claude Project on claude.ai/code. | Text that Claude acts on (prompt command). Only you can run it. Claude cannot start it, and it does not run in a subagent. Put a project name in double quotes, or give a project id. With no name it asks you to pick a project. Claude drafts a brief, or sends your message, with the `SendToProject` tool. The tool shows its own confirmation pane and sends nothing until you approve. Remote Control must be on for the session. See [Gated and Surface-Specific Tools](../../reference/tools/gated-and-other.md). |
| `/daemon` | <Undocumented /> | Manages background services and routines. | Panel. |
| `/workflows` | <Gated note="Setting disableWorkflows and env var CLAUDE_CODE_DISABLE_WORKFLOWS." /> | Browses running and finished workflows. | Panel. |
| `/artifacts` | <Gated note="claude.ai login on a Pro, Max, Team, or Enterprise plan (or no plan set), and an org policy." /> | Browses your published and shared artifacts. | Panel. `d` deletes your own artifact after a confirmation. Since `2.1.304` the confirmation is numbered: 1 or Enter keeps, 2 deletes, and `y`, `n`, and Esc still worked. Since `2.1.305` `y` and `n` no longer answer. See [How `/usage` and `/artifacts` Work](#how-usage-and-artifacts-work). |
| `/design-consent`, `/design-revoke` | <Gated note="Policy allow_design_sync." /> | Grants or revokes agent access to your Design projects. | Hidden text commands. |
| `/design-login` | <Gated note="Policy allow_design_sync." /> | Authorizes design-system access for `/design-sync`. | Panel. |
| `/voice` `[hold\|tap\|off]` | <Gated note="Availability claude-ai." /> | Toggles voice mode. | Text command. |
| `/powerup` | <Documented /> | Teaches features through short interactive lessons. | Panel. |
| `/stickers` | <Documented /> | Orders stickers. | Text command. |
| `/radio` | <Documented /> | Plays a lo-fi radio station. | Text command. |
| `/team-onboarding` | <Gated note="Policy allow_team_onboarding, and needs a workspace." /> | Builds a guide that helps teammates learn Claude Code from your usage. | A prompt command. |
| `/low-priority` | <Undocumented /> <Gated note="Hidden. An isEnabled check decides." /> | Continues now at lower priority after you reach your 5-hour limit. Run it again to stop. | Hidden text command. |
| `/workflow-launch-exec` | <Undocumented /> <Gated note="Hidden." /> | Runs a workflow handoff that the server started. | Hidden text command. Only for sessions that a `workflow_launch` event starts. |
| `/heapdump` | <Gated note="Policy allow_heap_dump." /> | Writes the JavaScript heap to your Desktop (home folder on Linux without a Desktop). | Hidden text command. |
| `/mcp__<server>__<prompt>` `prompt arguments` | <Documented /> | MCP prompts become commands. Missing required arguments give "Missing required argument". | Made at run time with `source:"mcp"`. The alias form is `<server>:<prompt> (MCP)`. |

## How It Works

Each command is an object with a kind: panel, text, or prompt.
A command can have two objects, one for interactive use and a text one for non-interactive use. The program picks the second one when the session is not interactive.
Aliases come from an `aliases` list on the object.
A skill or custom command with the same name replaces a built-in command, but not its aliases (see [Skills and Commands](index.md#name-resolution)).

## When a Command Name Is Not Valid

The program loads custom commands from `.claude/commands/` and skills together. A command that fails a check does not stop the others from loading.

- **Name rule.** A name must not hold hidden, direction-changing, or blank-like characters, `<` or `>`. It must not be over 256 characters (`chunk-r5cyd28m.js:54682`). When a name fails, the program does not offer the command. It writes a warning to the debug log: `[names] <name> is not offered: a name may not hold hidden, direction-changing or blank-like characters, < or >, or be over 256 characters` (`chunk-r5cyd28m.js:54686`, `:155024`). Rename the file to fix it.
- **Name type.** Since `2.1.312`, the program skips a command whose name or display name is not a string. It reports an error that starts "Command not listed: its name or display name is not a string" and keeps the other commands (`chunk-r5cyd28m.js:53519`). In `2.1.311` the same loop made no such check (`chunk-2ht8z368.js:53427`).
- **File errors.** If one file in `.claude/commands/` cannot load, the program logs `[skills] failed to load command from <path>: <error>` at the error level. It loads the other files (`chunk-r5cyd28m.js:155696`).

The release note says that one bad command name could leave `claude -p` with no output ([release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.312)). The program code does not show that link.

## How `/restart` Works

`/restart` restarts Claude Code on the installed version. It resumes the same session. It keeps the model, the permission mode, extra working directories, and the Remote Control state. After the restart, it adds a "Successfully updated from A to B" message.

It only shows when all of these are true:

- You are in an interactive terminal (not `-p`).
- You run macOS or Linux.
- You use the native install. The binary is under `~/.local/share/claude/versions/`, or `$XDG_DATA_HOME/claude/versions/`. A package-manager global install does not count.
- You are not in a teammate agent or a remote session, and slash commands are not disabled.
- A server-side feature flag is on for you. Some users never see it.

After an auto-update installs a new version, the prompt area shows a green notice: "Update installed · /restart to apply". When the conditions above are not met, it says "Restart to update" instead.

`/restart` refuses in these cases:

- Background work is running or pending. It says "Can't restart while work is running in the background — wait for it to finish (or stop it via /tasks), then try again." Running subagents and background shell commands count. Remote agents do not.
- Remote Control is connected, or the command came in over Remote Control.
- The session is not saved to disk.
- Claude tried to run it. You must type it at the prompt.
- The installed version is missing (it suggests `/doctor`), or that version is on hold.

Background sessions use `claude respawn <id>` instead.

## How `/usage` And `/artifacts` Work

`/artifacts` has four tabs: `All`, `Mine`, `Shared`, and `Pinned`. `Pinned` shows only when you have pins.
The footer lists the keys. `Enter` attaches the selected artifact to the session. The panel shows `Attaching <title>…`. `Enter` opens an artifact that is already attached instead. `x` dismisses, `c` copies the URL, `Ctrl+R` renames, `d` deletes, `p` pins, `/` searches, and `r` refreshes.

To delete, press `d` or choose `Delete` from the actions menu. Only the owner can delete, so the key works only on your own artifacts. The panel asks `Delete <title>? This cannot be undone.` Choose `No, keep it` or `Yes, delete it`. Since `2.1.304` the keys are 1 or Enter to keep and 2 to delete, and `y`, `n`, and Esc still worked. Since `2.1.305` `y` and `n` no longer answer, and Esc goes back with nothing sent ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)).

A yes sends `DELETE /api/frame/<slug>`. The program retries once on `409`, `429`, or `503`. Success shows `Artifact deleted`. The link stops working for everyone. You cannot restore it. Republishing makes a new URL.

Since `2.1.305` `/usage` turns each warning into a one-line fix that names its source, and `f` applies the fixes. Each fix starts a prompt that begins `Fix what /usage flagged. Show me each change before you make it.` It tells Claude that text in backticks is a name from your logs, never an instruction. Examples of fix lines are `Turn off MCP servers you don't use`, `Stop sessions you no longer need`, `Start fresh when you switch tasks`, and `Give simple subagents a cheaper model` (the program). With Remote Control on, `/usage` says `Nothing was sent. Turn off Remote Control to use fixes.`

On `2.1.305`, an API key shows only session cost and tokens. `CLAUDE_CODE_OAUTH_TOKEN` also shows the `Current session` and `Current week (all models)` rows, filled from model reply headers. The panel then also shows `What's contributing to your limits usage?` with `Scanning local sessions…`. The program did not call the usage endpoint with the token, on `2.1.305` and again on `2.1.306` (see [Probes](../../reference/probes.md#static-and-print-probes)). A claude.ai login with the `user:inference` and `user:profile` scopes is what the program checks for the full section.

Reset times look like `Resets <time> (<time zone>)`. `/usage` drops minutes on the hour. It adds a date when the reset is more than 24 hours away. Weekly rows always show the date.

When the usage endpoint is rate limited, `/usage` says so. What you see depends on the data it already has. A run against a local stub that answered `429` showed these texts. The time is 12-hour, rounded up to the next minute, with no zone and no date. This differs from the `Resets` lines.

The two rows for the `200` reply hold the `2.1.312` text, which the program gives. `2.1.311` and earlier said `Usage endpoint is rate limited. Please try again in a moment.` and `(rate limited — try again in a moment)`. No `2.1.312` run reached the usage endpoint, so a run has not shown the new text. See [Probes](../../reference/probes.md#interactive-probes).

| Data Before the `429` | What `/usage` Shows |
| --- | --- |
| None | `Error: Usage endpoint is rate limited until 10:44am.` |
| None, and the reply is a `200` with an `error` of type `rate_limit_error` | `Error: Claude is temporarily limiting requests to the usage page (not your usage limit). Try again in a moment.` |
| Bars from the `anthropic-ratelimit-unified-5h` and `-7d` headers | The bars, then `Per-model breakdown unavailable (rate limited until 10:43am)` |
| The same, plus `7d_oi` headers | An extra `Current week (<model>)` row, then `Partial usage data (rate limited until 10:47am)` |
| A saved cache that is 10 minutes old | The cached bars, then `Showing last-known usage as of 10m ago (rate limited until 10:45am)` |
| The same cache, with the `200` reply | `Showing last-known usage as of 10m ago (requests temporarily limited — try again in a moment)` |

The end time comes from `Retry-After`. A `Retry-After` of `1800` gave 30 minutes. A missing one gave the 5-minute default. The program caps the hold at 1 hour. Claude Code keeps the hold in memory for each token. A new process therefore asks again. Claude Code shows a saved cache younger than 60 seconds without a request. The `200` reply has no end time, because only the `429` path reads the hold.

With `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` set, the panel shows `Failed to load usage data` and sends no request.

No live run showed these items. They come from the program. The first is the `(could not refresh)` ending. The program uses it when the request fails for a reason other than a rate limit. The second is the form `Showing last-known usage (rate limited until <time>)` without `as of`. The third is a `403` response.

Source: the program. The delete prompt, the footer keys, and `Artifact deleted` were also seen in a live run. The `Resets` lines and the rate-limit texts above were seen against a local stub with fake subscriber credentials.

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | **Terminal setup.** `/terminal-setup` could not change a terminal's settings. | A backup of the Terminal.app preferences could not be made. A profile could not be read. Option as Meta or the audio bell could not be set. No config path was found for Alacritty. The text says whether the settings were restored. |
| `Failed to create workflow file`, `Failed to set API key secret` | <Undocumented /> | `/install-github-app` could not finish a setup step with the `gh` command. | A Claude workflow file already exists in the repository (`gh` answered 422 for the `sha`), so remove it or update it by hand. The `gh` call that sets the API key secret failed. The text adds hints: run `gh auth refresh -h github.com -s repo`, and make sure you have admin access to the repository. |
| `Unknown skill` | <Undocumented /> | The program refused to run a forked skill. | An organization Skills policy withholds the skill, a skills-sync veto applies, or the skill comes from a synced plugin. The text is `Unknown skill: <name>`. |
| `Could not` | <Undocumented /> <Gated note="Same gate as /send-to-project" /> | **Claude Project requests.** A request that `/send-to-project` makes to the projects routes failed. The message reads `Could not <step>: <reason>`, and the program names the error `ChannelApiError`. | The step is one of `create the project`, `look up the project`, `send the message`, `list your cloud environments`, `submit the setup proposal`, or `save to project memory`. The reason comes from the answer. A sign-in problem and a policy that turns the feature off give their own reason text. Source: the program (`chunk-3vzbpce5.js:175`). |

## Related Pages

- [Skills and Commands](index.md): skills, which also give you slash commands.
- [Bundled Skills](bundled-skills.md): commands that are really skills.
- [Hooks](../hooks/index.md): the `UserPromptExpansion` event fires when a command expands.
- [Environment Variables](../../configure/env-vars/index.md): the `DISABLE_*_COMMAND` variables.

Source: [Commands](https://code.claude.com/docs/en/commands) and the program (the command objects). `/keybindings`, `/release-notes`, `/rewind`, `/chrome`, `/statusline`, and `/sandbox` are missing from the program inventory file because of the key order in their objects. The program itself has them.
