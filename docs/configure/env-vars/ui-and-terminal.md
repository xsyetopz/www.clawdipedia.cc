---
title: UI and Terminal
description: Environment variables for the terminal screen, colors, voice, keys, and notifications.
sidebar_position: 8
---

These variables change what you see and how the terminal behaves.
They cover colors, fullscreen rendering, key handling, voice input, notifications, and the title bar.
Use them when your terminal draws the screen badly or you want a quieter interface.

This page lists 90 variables. Restart `claude` after a change. Set a variable to `0` to turn it off where the row says so.

## Example

```bash
export NO_COLOR=1
claude
```

Claude Code prints without color.

## Variables

The rows are in name order. See [Environment Variables](index.md#how-to-read-the-tables) for what each column and badge means.

| Variable | Status | What it does | Values and default | Notes |
| --- | --- | --- | --- | --- |
| `CLAUDE_AFK_COUNTDOWN_MS` | <Documented /> | Sets how long before auto-continue the countdown shows on an unanswered `AskUserQuestion` dialog. | A number of milliseconds, `20000` by default. Whole number, default `20000`, capped at the auto-continue timeout | Interactive UI. Not set from project `env` before trust |
| `CLAUDE_AFK_TIMEOUT_MS` | <Documented /> | Sets the idle time before an unanswered `AskUserQuestion` dialog auto-continues. Setting it also turns auto-continue on. | A number of milliseconds. Whole number, overrides the `askUserQuestionTimeout` setting. The dialog shows when the value is not `undefined` | Interactive UI. Not set from project `env` before trust |
| `CLAUDE_AX_ANNOUNCEMENT_HOLD_MS` | <Undocumented /> | Sets how long screen reader mode holds output after a hold request for an announcement. | A number of milliseconds, `1000` by default. Whole number of `0` or more, default `1000`, capped at `10000` | Screen reader mode. Not set from project `env` before trust |
| `CLAUDE_AX_PREPARK_MS` | <Documented /> | Sets how long screen reader mode waits before it writes a new or changed line. | A number of milliseconds, `0` by default. Whole number of `0` or more, default `0`, capped at `5000` | Screen reader mode. Not set from project `env` before trust |
| `CLAUDE_AX_REWRITE_HELD_ANNOUNCEMENT` | <Undocumented /> | Controls whether screen reader mode rewrites a held announcement. | On, off, or unset, `false` by default | Screen reader mode. Not set from project `env` before trust |
| `CLAUDE_AX_SCREEN_READER` | <Documented /> | Turns screen reader mode on with `1` or forces it off with `0`. | On, off, or unset. The `--ax-screen-reader` flag wins, then this var, then the `axScreenReader` setting. Claude Code sets `1` for relaunched children | Interactive UI. In a settings `env` block it applies only from user, managed, or `--settings` settings. Project and local `env` cannot set it (since `2.1.305`, per the [`2.1.307` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.307)) |
| `CLAUDE_AX_STARTUP_QUIET_MS` | <Documented /> | Sets how long screen reader mode holds the first render after the startup line. | A number of milliseconds, `3000` by default. Whole number of `0` or more, default `3000`, capped at `600000` | Screen reader mode. Not set from project `env` before trust |
| `CLAUDE_CODE_ACCESSIBILITY` | <Documented /> | Keeps the native terminal cursor visible and turns off the inverted-text cursor. Screen magnifiers can then track the cursor. | On or off. Also stops Claude Code from hiding the cursor again after a suspend resume | Interactive UI. Project `env` can set it before trust |
| `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT` | <Documented /> <Differs note="The official docs and the program disagree. The row says how." /> | Repaints the whole screen on each frame in fullscreen rendering. | On or off, on by default | Fullscreen UI. Not set from project `env` before trust |
| `CLAUDE_CODE_ALTGR_AS_TEXT` | <Undocumented /> | Controls whether AltGr key chords count as text input. | On or off. Truthy gives `force`. Falsy gives `off` | Interactive UI, mainly Windows Terminal. Not set from project `env` before trust |
| `CLAUDE_CODE_ARTIFACT_AUTO_OPEN` | <Documented /> | Stops Claude Code from opening the browser when it publishes an artifact. | Text. A falsy value such as `0` skips the open and logs `auto_open_skipped_env` | Artifacts. Not set from project `env` before trust |
| `CLAUDE_CODE_AUTO_CONNECT_IDE` | <Documented /> | Overrides the automatic IDE connection. `false` stops it and `true` forces a try. | On, off, or unset. `false` wins over the `autoConnectIde` config | IDE integration |
| `CLAUDE_CODE_BRIEF` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Turns on brief mode. In brief mode, Claude Code hides plain assistant text. Only the user message tool reaches the user. | On or off. Else a feature flag decides. An entitlement check applies | All sessions, gated by a feature flag |
| `CLAUDE_CODE_BS_AS_CTRL_BACKSPACE` | <Documented /> | Sets whether the `0x08` byte counts as Ctrl+Backspace or plain Backspace. | On or off. A truthy value means Ctrl+Backspace and a falsy value means Backspace. Else it is Ctrl+Backspace on Windows except `mintty` and `cygwin` | Terminal input |
| `CLAUDE_CODE_DEBUG_REPAINTS` | <Undocumented /> | Turns on the repaint debug mode of the terminal renderer. | On or off, off by default. Claude Code copies it to the Ink root node as `debugRepaints` | Terminal UI |
| `CLAUDE_CODE_DECSTBM` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces the DECSTBM scroll region renderer on. Without it a feature flag decides. | On or off. Truthy string. Off when the terminal check fails or other renderer conditions apply | Fullscreen terminal UI |
| `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` | <Documented /> | Uses the classic main-screen renderer instead of fullscreen. | On or off. Also triggers when `CLAUDE_CODE_NO_FLICKER` is false. A startup crash hint names it | Terminal UI |
| `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` | <Documented /> | Turns off the "How is Claude doing?" session surveys. | On or off. The survey and memory survey gates check it | Interactive UI. Project `env` can set it before trust |
| `CLAUDE_CODE_DISABLE_MOUSE` | <Documented /> | Turns off mouse tracking in fullscreen rendering. | On, off, or unset. A set truthy value gives mouse mode `off`, a set false value gives `full` | Fullscreen terminal UI |
| `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` | <Documented /> | Turns off click, drag and hover handling but keeps wheel scrolling. | On, off, or unset. A truthy value gives mouse mode `scroll`. `CLAUDE_CODE_DISABLE_MOUSE` wins when set | Fullscreen terminal UI |
| `CLAUDE_CODE_DISABLE_NOTIFICATION_PRESENCE_CHECK` | <Documented /> | Sends the `PushNotification` desktop notification even when the user is typing or the terminal has focus. | On or off. Skips the presence check in the tool | All sessions |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | <Documented /> | Turns off automatic terminal title updates and the title generation request. | On or off. Also stops the `claude` process title write | All sessions. Project `env` can set it before trust |
| `CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL` | <Documented /> | Turns off virtual scrolling in fullscreen rendering, so every message renders. | On or off, off by default | Fullscreen terminal UI |
| `CLAUDE_CODE_ENABLE_AWAY_SUMMARY` | <Documented /> | Forces session recaps on or off, ahead of the `awaySummaryEnabled` setting. | On or off. Off values give off, on values give on. Else off in non-interactive mode, and the setting decides otherwise | Interactive. Project `env` can set it before trust |
| `CLAUDE_CODE_ENABLE_MENU_KIND_LANES` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Turns on kind lanes in the slash command menu. | On or off, off by default. Else a feature flag | Interactive slash menu |
| `CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION` | <Documented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces prompt suggestions on or off, ahead of `promptSuggestionEnabled`. | On, off, or unset. Unset needs a feature flag, then the setting. `true` also stops the unused-suggestion auto-pause | Interactive. Project `env` can set it before trust |
| `CLAUDE_CODE_EXIT_AFTER_FIRST_RENDER` | <Undocumented /> | Skips startup prefetches and fullscreen auto-switch checks so the process can exit after the first render. | On or off, off by default | Interactive startup, used for startup tests |
| `CLAUDE_CODE_FOOTER_INDICATOR` | <Undocumented /> | Sets a custom text for the footer indicator. | Text. Claude Code strips control characters and trims the text. It wins over settings | Interactive footer |
| `CLAUDE_CODE_FORCE_FULLSCREEN_UPSELL` | <Undocumented /> | Shows the fullscreen mode upsell even when other checks would skip it. | On or off, off by default. Claude Code still skips it in non-interactive mode and some other modes | Interactive |
| `CLAUDE_CODE_FORCE_STRIKETHROUGH` | <Documented /> | Forces `~~text~~` strikethrough rendering in terminals that are not auto-detected. | On or off, off by default | Interactive terminal |
| `CLAUDE_CODE_FORCE_SYNC_OUTPUT` | <Documented /> | Forces DEC 2026 synchronized output on. No effect under tmux. | On or off, off by default. Works for emulators that skip the capability probe | Interactive terminal |
| `CLAUDE_CODE_FORCE_TERMINAL_IMAGES` | <Documented /> | Forces image output through the kitty graphics protocol. | On or off, off by default. The kitty graphics capability check also uses it | Interactive terminal, not tmux or screen |
| `CLAUDE_CODE_FORCE_TIP_ID` | <Undocumented /> | Forces the startup tip with this id to show. | Text, unset by default | Interactive sessions |
| `CLAUDE_CODE_HIDE_CWD` | <Documented /> | Hides the working directory in the startup logo header. | On or off. Unset shows the path, with the remote name when one exists | Interactive terminal UI |
| `CLAUDE_CODE_HIDE_SETTINGS_HINT` | <Undocumented /> | Hides a settings hint. A helper returns false when it is on. No visible effect in a print-mode probe ([Probes](../../reference/probes.md)). | On or off. The hint is also off for the entrypoints `claude_in_slack`, `claude-in-teams`, and the `remote_*` ones | All sessions |
| `CLAUDE_CODE_IDE_HOST_OVERRIDE` | <Documented /> | Overrides the host address Claude Code uses to reach the IDE extension. | Text, gateway by default. Unset gives `127.0.0.1`, or the default gateway IP when it runs in WSL | IDE integration, WSL |
| `CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL` | <Documented /> | Skips the automatic install of the IDE extension. | On or off. Works like `autoInstallIdeExtension` set to `false` | IDE integration. Project `env` can set it before trust |
| `CLAUDE_CODE_IDE_SKIP_VALID_CHECK` | <Documented /> | Skips the check of IDE lockfile entries, so each entry counts as containing the working directory. | On or off | IDE integration |
| `CLAUDE_CODE_IDLE_THRESHOLD_MINUTES` | <Undocumented /> | Sets the idle minutes before a `new task?` notification shows in a long conversation. | A number, `75` by default. Works with `CLAUDE_CODE_IDLE_TOKEN_THRESHOLD` | Interactive terminal UI |
| `CLAUDE_CODE_IDLE_TOKEN_THRESHOLD` | <Undocumented /> | Sets the least conversation size in tokens before the idle `new task?` notification can show. | A number, `100000` by default. Works with `CLAUDE_CODE_IDLE_THRESHOLD_MINUTES` | Interactive terminal UI |
| `CLAUDE_CODE_NATIVE_CURSOR` | <Documented /> | Shows the terminal's own cursor at the input caret instead of a drawn block. | On or off. Also on for accessibility modes. Unset follows a feature flag | Interactive terminal UI |
| `CLAUDE_CODE_NEW_INIT` | <Documented /> <Differs note="The official docs and the program disagree. The row says how." /> <Gated note="Works only behind a feature flag or server gate" /> | Makes `/init` run the interactive setup flow. The docs omit that the feature flag also turns it on. | On or off. Changes the `/init` description and prompt | All sessions, `/init` |
| `CLAUDE_CODE_NO_FLICKER` | <Documented /> | Turns on fullscreen rendering and overrides the `tui` setting. A false value turns it off. | On, off, or unset. Background sessions also force it on. `CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN` forces it off | Interactive terminal UI |
| `CLAUDE_CODE_NONBLOCKING_STDOUT` | <Documented /> <Differs note="The official docs and the program disagree. The row says how." /> <Gated note="Works only behind a feature flag or server gate" /> | Writes terminal output through a second non-blocking descriptor so a stalled terminal cannot freeze the session. The docs omit the remote flag. | On, off, or unset. Claude Code passes it as the env override. A feature flag also feeds the choice | Interactive terminal UI on macOS, Linux, WSL |
| `CLAUDE_CODE_NOTIFICATIONS_HOST` | <Undocumented /> | Tells Claude Code that the host app shows notifications for plugins. A plugin notification then goes to the host as a `system` stream event with the subtype `ui_notify`, and a cancel goes as `ui_notify_cancel`. Without it, the plugin call reports `no_surface`. Added in `2.1.321`. | A truthy value turns it on, off by default. Ignored when the transport is remote. The program passes it to child sessions in an env list. The program did not show how the value is parsed | Hosts that read stream-json output. Read at `chunk-3da4gdx5.js:797266`. Used at `chunk-3da4gdx5.js:774691` |
| `CLAUDE_CODE_POWERUP_ONBOARDING` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Shows the `/powerup` tour offer as a `banner` or a `step`, even after onboarding ends. | Text, `off` by default. Other values fall back to a feature flag, default `off` | Interactive sessions |
| `CLAUDE_CODE_PROACTIVE` | <Undocumented /> | Passes the value as `assistantMode` to the interactive loop. No visible effect in a print-mode probe ([Probes](../../reference/probes.md)). | On or off | Interactive sessions |
| `CLAUDE_CODE_RC_PERMISSION_NUDGE` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Overrides the config of the Remote Control permission nudge. Fields are `afterPromptCount`, `probability`, and `maxImpressions`. | JSON text. Defaults are 5, 0, and 3. Without it, Claude Code uses a feature flag | Interactive sessions |
| `CLAUDE_CODE_RELAUNCH_TERMINAL_SIZE` | <Undocumented /> | Carries the terminal size across a relaunch as `COLUMNSxROWS`. The new process uses it when stdout reports no size. | A number. Claude Code sets it on relaunch. The new process removes it | Relaunched sessions |
| `CLAUDE_CODE_SCROLL_SPEED` | <Documented /> | Sets the mouse wheel scroll multiplier in fullscreen rendering. Claude Code caps values above 20 to 20. | A number. Claude Code parses it as a float. A non-number or a value of 0 or less falls back to the default of 1 or 3 by terminal | Fullscreen terminal UI |
| `CLAUDE_CODE_SEND_FEEDBACK` | <Documented /> <Gated note="Works only behind a feature flag or server gate" /> | Turns Claude-drafted feedback off with `0` or on with `1`. It cannot grant access the account lacks. | On, off, or unset. Even when on, the check still needs a feature flag. First-party provider only | First-party API accounts. Gated by a feature flag |
| `CLAUDE_CODE_SILENT_TURN_REMINDER` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces the silent-turn reminder on or off. The reminder nudges the model to update the user after a long quiet turn. | On, off, or unset. When unset, a gate function reads server and flag config for `silent_turn_reminder` | All. Gated by a feature flag |
| `CLAUDE_CODE_SILENT_TURN_REMINDER_SECONDS` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Sets the quiet time in seconds before the silent-turn reminder fires. It overrides the server value. | A number of seconds. Integer 1 or more. Without it, Claude Code uses a server config number of 1 or more | All sessions. Related to the silent-turn reminder |
| `CLAUDE_CODE_SILENT_TURN_REMINDER_TEXT` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Overrides the text of the silent-turn reminder sent to the model. | Text, text by default. A feature flag may replace the default | All sessions. Related to the silent-turn reminder |
| `CLAUDE_CODE_SILENT_TURN_REMINDER_TURNS` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Sets the number of silent turns before the reminder fires. It overrides the flag value. | A number. Integer 1 or more. Else Claude Code rounds a feature flag value down, with a built-in default | All sessions. Related to the silent-turn reminder |
| `CLAUDE_CODE_SSE_PORT` | <Undocumented /> | Gives the port of the IDE extension. It turns on IDE auto-connect and marks the IDE lockfile with that port as a match. | A number. Integer. An IDE terminal usually sets it | IDE integration |
| `CLAUDE_CODE_SYNTAX_HIGHLIGHT` | <Documented /> | Turns off syntax highlighting in diff output when set to a false value. The theme screen then shows it as disabled by this variable. | Text. A false value such as `false` turns it off. The docs match | Diff output |
| `CLAUDE_CODE_THINKING_DISPLAY_UPDATES` | <Undocumented /> | Chooses whether connector-text updates show while thinking text is hidden. On gives `connector_text`, off gives `none`. | On, off, or unset, on by default. Ignored when the thinking display is `summarized`, `highlights`, or similar | Interactive UI |
| `CLAUDE_CODE_TMUX_PREFIX` | <Undocumented /> | Holds the tmux prefix key. Claude Code shows it in the tmux session notice. | Claude Code sets it when it starts its own tmux session | `--tmux` sessions |
| `CLAUDE_CODE_TMUX_PREFIX_CONFLICTS` | <Undocumented /> | Marks that the tmux prefix is a key that Claude Code also uses. The notice then says to press the prefix twice. | On or off. Claude Code sets it to `1` or empty | `--tmux` sessions |
| `CLAUDE_CODE_TMUX_SESSION` | <Undocumented /> | Holds the name of the tmux session that Claude Code started. It drives the session notice and worktree exit handling. | Text. Claude Code sets it | `--tmux` sessions |
| `CLAUDE_CODE_TMUX_TRUECOLOR` | <Documented /> | Allows 24-bit color inside tmux. Without it, Claude Code clamps to 256 colors when `TMUX` is set. | `rawStr`. Any non-empty value counts, so `0` and `false` still allow truecolor | Terminal inside tmux |
| `CLAUDE_CODE_TUI_JUST_SWITCHED` | <Undocumented /> | Tells the new process that the user just switched TUI mode. It shows the matching notice and skips the downsell announcement. | `fullscreen` or `default`. Claude Code removes it from the environment when it relaunches itself | Interactive UI |
| `CLAUDE_CODE_TUI_TRIAL` | <Undocumented /> | Starts a fullscreen trial when the value is `fullscreen`. Claude Code latches it once and then unsets it. | Text. Claude Code removes it from the environment when it relaunches itself | Interactive UI |
| `CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS` | <Documented /> | Sets the deadline for dialogs that Claude Code forwards to a remote client. It overrides the `dialogExpiry` setting. | A number of milliseconds. Integer, whole value. Order: env, setting, then `300000` | Remote Control and SDK hosts |
| `CLAUDE_CODE_YOU_SHOULD_KNOW_AUTO_SEND` | <Undocumented /> | Lets the You should know module act at once on an answer that you type in the terminal composer, such as a single digit, for a check line that it shows. Added in `2.1.321`. | On when the trimmed value, in lower case, is `1`, `true`, `yes`, or `on`. Else off. Off by default. The module skips it in background, child, and print sessions. The program did not show every step of the send | Interactive terminal sessions. Value parsed at `chunk-sgmp92c0.js:77061`. Read at `chunk-sgmp92c0.js:77888` |
| `CLAUDE_CODE_YOU_SHOULD_KNOW_DEBUG` | <Documented /> | Shows a line above the prompt for each of the last three checks of the You should know mod. | On or off | Interactive sessions |
| `CLAUDE_FORCE_DISPLAY_SURVEY` | <Undocumented /> | Forces the feedback survey to show if it never showed before. | On or off. `CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY` and the feedback policy block it | Interactive sessions |
| `COLORFGBG` | <Undocumented /> | Hints the terminal background. Claude Code maps it to a dark or light theme. | - | - |
| `DEMO_VERSION` | <Undocumented /> | Replaces the shown version and the working directory in the header for demos. It also skips the release notes. | - | - |
| `DISABLE_COST_WARNINGS` | <Documented /> | Turns off cost warning messages. | On or off | - |
| `DISABLE_UPGRADE_COMMAND` | <Documented /> <Gated note="Works only behind a feature flag or server gate" /> | Hides the `/upgrade` command. | On or off. Claude Code also hides the command for enterprise plans or when a feature flag is on | Interactive. Project `env` can set it before trust |
| `FORCE_CODE_TERMINAL` | <Undocumented /> | Marks the terminal as a supported IDE terminal for IDE auto-connect. | On or off | IDE integration. Not set from project `env` before trust |
| `FORCE_HYPERLINK` | <Differs note="The docs say only 0 turns it off. The program also reads false, no, and off as off." /> | Forces OSC 8 hyperlinks on or off. | `0`, `false`, `no`, `off`, and any value that reads as the number `0` turn links off. Any other non-empty value turns them on. Unset or empty lets the terminal decide. The match ignores case and outer spaces. In `2.1.312` the value did nothing: with the name set, the support of the terminal decided, and the checks for `TERM_PROGRAM`, tmux, Windows Terminal, and kitty were skipped | Terminal output. Not set from project `env` before trust |
| `INK_SCREEN_READER` | <Undocumented /> | Turns on screen reader mode in the terminal UI renderer. | - | - |
| `INTELLIJ_TERMINAL_COMMAND_BLOCKS` | <Undocumented /> | With any value, it marks the JetBrains terminal wheel and arrow scroll handling as bug-confirmed. | - | - |
| `INTELLIJ_TERMINAL_COMMAND_BLOCKS_REWORKED` | <Undocumented /> | With any value, it marks the JetBrains terminal wheel and arrow scroll handling as bug-confirmed. | - | - |
| `IS_DEMO` | <Documented /> <Differs note="The official docs and the program disagree. The row says how." /> | Sets demo mode. Demo mode hides the account email and organization name in the header and status output. | - | - |
| `ITERM_SESSION_ID` | <Undocumented /> | Detects iTerm2 and gives the session id that the iTerm2 pane backend uses for teammate panes. | Text | - |
| `KITTY_WINDOW_ID` | <Undocumented /> | Detects the kitty terminal for terminal identification and strikethrough support. | Text | - |
| `KONSOLE_VERSION` | <Undocumented /> | Marks Konsole as a terminal that supports strikethrough text. | - | - |
| `LANG` | <Documented /> | Gives the locale for date formatting. It is the last fallback after `LC_ALL` and `LC_TIME`. | - | - |
| `LC_ALL` | <Undocumented /> | Gives the locale for date formatting, first in order. Claude Code also sets it to `C` for routed `sh` interpreters. | - | - |
| `LC_TERMINAL` | <Undocumented /> | Claude Code detects iTerm2 when it is `iTerm2`, for macOS key and clipboard handling. | - | - |
| `LC_TIME` | <Undocumented /> | Gives the locale for date formatting, after `LC_ALL`. | - | - |
| `MSYSTEM` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | On Windows, a set value marks the terminal as mintty (Git Bash). | - | - |
| `NETLIFY` | <Undocumented /> | If set, the bundled hyperlink check says the terminal supports hyperlinks. | - | - |
| `NO_COLOR` | <Documented /> | Turns off colors unless `FORCE_COLOR` is set. | On or off | - |
| `TERMINAL` | <Documented /> | Names the terminal program that Claude Code starts on Linux for features that open a terminal window. | Text. Non-empty string. Claude Code tries it first | Linux |
| `VISUAL` | <Documented /> | Sets the editor for external editing. It wins over `EDITOR`. | Text. Non-empty string. If neither has a value, Claude Code tries `code`, `vi`, and `nano` | All sessions |

## How It Works

Claude Code checks the terminal at startup. It looks at names such as `TERM`, `TERM_PROGRAM`, and `COLORTERM` to decide which features to use.
Those names belong to the system. [System and Third-Party](system-and-third-party.md) lists them.
The variables on this page override that guess.

## Related Pages

- [Environment Variables](index.md): how Claude Code reads variables and which value wins.
- [System and Third-Party](system-and-third-party.md)
- [Status Line](../status-line.md)
- [Undocumented Items](../../reference/undocumented.md): every item that only the program shows.

Source: the program (variable names found in the `2.1.314` binary) and the [Environment Variables](https://code.claude.com/docs/en/env-vars) page of the official docs.
