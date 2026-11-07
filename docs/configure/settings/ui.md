---
title: Interface Settings
description: Keys that change the theme, spinner, notices, terminal display, voice, and feedback prompts.
sidebar_position: 5
---

These keys change how Claude Code looks and feels in the terminal.
They cover the theme, the spinner, notices, view modes, and vim keys.
Many boolean keys are written as the thing to hide, so check each row before you pick a value.

Use `/config` for some keys. Most boolean keys switch one display feature.

## Keys

Source: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, Source: the program (its bundled settings schema).
Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `autoScrollEnabled` | <Documented /> | boolean | - | Follow new output to the bottom in fullscreen rendering. | Any settings file |
| `breakReminder` | <Undocumented /> | object | - | Show a dismissible nudge after long continuous use. It never blocks. | Settings files |
| `breakReminder.breakThresholdMinutes` | <Undocumented /> | integer | `10` | Set the minutes of inactivity that count as a break and reset the timer. | Settings files |
| `breakReminder.enabled` | <Undocumented /> | boolean | `false` | Turn on the break reminder. The reminder fires only when this is `true`. | Settings files |
| `breakReminder.intervalMinutes` | <Undocumented /> | integer | `30` | Set the minutes of continuous use before the reminder fires. It fires again every interval until you take a break. | Settings files |
| `breakReminder.message` | <Undocumented /> | string | - | Set your own reminder text. Leave it unset for a rotating set of friendly nudges. | Settings files |
| `companyAnnouncements` | <Documented /> | array of string | - | Show your organization's announcements at startup. | Any settings file |
| `editorMode` | <Documented /> | string | - | Use vim key bindings in the input prompt. | Any settings file |
| `emojiCompletionEnabled` | <Documented /> | boolean | - | Turn off `:shortcode:` emoji suggestions and replacement in the prompt input. | Any settings file |
| `feedbackDrafts` | <Documented /> | enum: `notify`, `quiet`, `off` | - | Control whether Claude queues feedback drafts for you to review. | User or managed settings |
| `feedbackSurveyRate` | <Documented /> | number | - | Change how often the session quality survey appears. | Any settings file |
| `footerLinksRegexes` | <Documented /> | array | - | Make issue or review IDs in output into clickable links below the input box. | User or managed settings |
| `maxProseWidth` | <Documented /> | integer | - | Cap how wide the prose in Claude's responses runs in a wide terminal. | Any settings file |
| `preferredNotifChannel` | <Documented /> | string | - | Choose a terminal bell or desktop notification for task completion. | Any settings file |
| `prefersReducedMotion` | <Documented /> | boolean | - | Reduce or turn off spinner, shimmer, and flash animations. | Any settings file |
| `promptSuggestionEnabled` | <Documented /> | boolean | - | Hide the grayed-out prompt suggestions in the input box. | Any settings file |
| `prUrlTemplate` | <Documented /> | string | - | Point PR links at an internal code-review tool instead of github.com. | Any settings file |
| `quietHours` | <Undocumented /> | object | - | Show one soft nudge per session during a local-time window you set. It never blocks. | Settings files |
| `quietHours.enabled` | <Undocumented /> | boolean | `false` | Show a one-time nudge when you start or keep using the CLI inside your quiet-hours window. | Settings files |
| `quietHours.end` | <Undocumented /> | string | - | End of the quiet-hours window, in 24-hour local time `HH:MM`. It may be earlier than `start` for an overnight range. | Settings files |
| `quietHours.start` | <Undocumented /> | string | - | Start of the quiet-hours window, in 24-hour local time `HH:MM`. | Settings files |
| `showClearContextOnPlanAccept` | <Documented /> | boolean | `false` | Show a "clear context" option on the plan accept screen. | Any settings file |
| `showMessageTimestamps` | <Undocumented /> | boolean | - | Stamp each message with its arrival time. The docs name a VS Code extension setting with this name, not this settings key. | Settings files |
| `showTurnDuration` | <Documented /> | boolean | - | Hide the "Cooked for" duration after each response. | Any settings file |
| `spellcheck` | <Documented /> | object | - | Underline misspelled words in the prompt input with a spell checker you install. | User or managed settings |
| `spellcheck.checker` | <Documented /> | enum: `aspell`, `hunspell`, `ispell`, `auto` | `auto` | Pick the spell checker to run. `auto` uses the first of the three found on `PATH`. | User or managed settings |
| `spellcheck.color` | <Documented /> | string | The theme's error color | Set the color of misspelled words. Use a color name, `#rrggbb`, `rgb(r,g,b)`, `ansi256(n)`, or `ansi:<name>`. Words stay underlined. | User or managed settings |
| `spellcheck.enabled` | <Documented /> | boolean | `false` | Turn on spell checking of the prompt input. | User or managed settings |
| `spellcheck.language` | <Documented /> | string | The checker's own dictionary | Pick the dictionary. Claude Code passes it to the checker as given, for example `en_GB`. Names depend on the checker. | User or managed settings |
| `spinnerTipsEnabled` | <Documented /> | boolean | - | Hide tips in the spinner while Claude works. | Any settings file |
| `spinnerTipsOverride` | <Documented /> | object | - | Add your own tips to the spinner rotation, or replace the built-in tips. | Any settings file |
| `spinnerTipsOverride.excludeDefault` | <Documented /> | boolean | `false` | Set to `true` to hide the built-in tips and show only yours. | User settings, `--settings`, or managed settings |
| `spinnerTipsOverride.label` | <Documented /> | string | `Tip` | Set the prefix shown before your tips in the spinner. | User settings, `--settings`, or managed settings |
| `spinnerTipsOverride.tips` | <Documented /> | array of string or object | - | List your tips. Each item is a string or an object with `id`, `text`, and optional `cooldownSessions` and `priority`. | Any settings file. Project and local settings take plain strings only |
| `spinnerTipsOverride.tipsFile` | <Documented /> | string | - | Path to a JSON file with an array of tips. Use an absolute path or a `~/` path. Claude Code reads it once per process. | User settings, `--settings`, or managed settings on disk |
| `spinnerVerbs` | <Documented /> | object | - | Add or replace the verbs shown while a turn runs. | Any settings file |
| `spinnerVerbs.mode` | <Documented /> | enum: `append`, `replace` | - | `append` adds your verbs to the defaults. `replace` uses only your verbs. | Any settings file |
| `spinnerVerbs.verbs` | <Documented /> | array of string | - | List the verbs to show in the spinner. | Any settings file |
| `syntaxHighlightingDisabled` | <Documented /> | boolean | - | Turn off syntax highlighting in diffs and code blocks. | Any settings file |
| `terminalProgressBarEnabled` | <Documented /> | boolean | - | Hide the terminal progress bar in terminals that support it. | Any settings file |
| `terminalTitleFromRename` | <Documented /> | boolean | `true` | Stop `/rename` and `--name` from changing the terminal tab title. | Any settings file |
| `theme` | <Documented /> | string | - | Pick the interface color theme, built-in or custom. | Any settings file |
| `timeFormat` | <Documented /> | string | - | Show the times in the interface on a 12-hour or 24-hour clock, in UTC, or with a strftime pattern. | Any settings file |
| `timeZone` | <Documented /> | string | The system time zone | Show the times in the interface in a time zone other than your system's. | Any settings file |
| `tui` | <Documented /> | enum: `default`, `fullscreen` | - | Choose the fullscreen or classic terminal renderer. | Any settings file |
| `verbose` | <Documented /> | boolean | - | Show full tool output instead of truncated summaries. `viewMode` takes precedence when you set both. | Any settings file |
| `viewMode` | <Documented /> | enum: `default`, `verbose`, `focus` | - | Start every session in default, verbose, or focus view. | Any settings file |
| `vimInsertModeRemaps` | <Documented /> | object | - | Map a two-key INSERT-mode sequence such as `jj` to Escape. | User or managed settings |
| `voice` | <Documented /> | object | - | Turn on voice dictation and pick hold or tap mode. | Any settings file |
| `voice.autoSubmit` | <Documented /> | boolean | - | Send the prompt when you release the key. Applies in hold mode only. | Any settings file |
| `voice.enabled` | <Documented /> | boolean | - | Turn voice dictation on. | Any settings file |
| `voice.mode` | <Documented /> | enum: `hold`, `tap` | `hold` | Hold the key to talk, or tap once to start and again to stop and send. | Any settings file |
| `wheelScrollAccelerationEnabled` | <Documented /> | boolean | - | Turn off mouse-wheel acceleration in fullscreen rendering. | Any settings file |

## Example

### Calm Terminal

This file hides spinner tips. It reduces animation. It starts every session in focus view. It picks the fullscreen renderer.

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "spinnerTipsEnabled": false,
  "prefersReducedMotion": true,
  "viewMode": "focus",
  "tui": "fullscreen"
}
```

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Customize Keyboard Shortcuts](https://code.claude.com/docs/en/keybindings) covers key bindings.
- [Keybindings](../keybindings/index.md) lists every context and action with its default key.
- [Status Line](../status-line.md) and [Output Styles](../output-styles.md) cover two related features.
- [UI and Terminal Variables](../env-vars/ui-and-terminal.md) lists the matching environment variables.
