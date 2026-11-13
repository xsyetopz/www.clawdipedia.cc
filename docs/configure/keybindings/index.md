---
title: Keybindings
description: Every keybinding context and action of Claude Code, with the default keys, and how to change them in keybindings.json.
sidebar_position: 1
---


Claude Code reads your keyboard shortcuts from `~/.claude/keybindings.json`.
Each block names a context and maps key strokes to actions. A context is where the block applies.
This page lists the contexts, the default key of each action, and the actions that have no default key.

Run `/keybindings` to open the file.

Source: [Customize Keyboard Shortcuts](https://code.claude.com/docs/en/keybindings) and the program.
The tables below come from the default keys in the program.
An action marked <Undocumented /> is not named on the official page.

## Example

This file binds `ctrl+k` in the chat input to the stash action. It frees `ctrl+s` there. It runs `/compact` on `ctrl+shift+k`.

```json title="~/.claude/keybindings.json"
{
  "$schema": "https://xsyetopz.github.io/clawdipedia/schemas/claude-code-keybindings.json",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+k": "chat:stash",
        "ctrl+s": null,
        "ctrl+shift+k": "command:compact"
      }
    }
  ]
}
```

A binding value is an action name, `command:<name>`, or `null`. `command:<name>` runs the slash command as if you typed it. `null` removes a default key.
The `command:` name may use letters, digits, `:`, `-`, and `_`.
Each part of a key before the last must be a modifier: `ctrl`, `control`, `alt`, `opt`, `option`, `shift`, `meta`, `cmd`, `command`, `super`, or `win`. Since `2.1.323`, Claude Code ignores a binding such as `ctl+k` that has a misspelled modifier, where before it bound the bare key. The program reports `"ctl" is not a modifier, so the binding "ctl+k" is ignored` and suggests a fix (`chunk-qmcxj60c.js:4615`). For keys pressed one after another, put a space between them, as in `ctrl+x ctrl+s`.
The schema is [claude-code-keybindings.json](https://xsyetopz.github.io/clawdipedia/schemas/claude-code-keybindings.json).

## Contexts

A context says where a block of bindings applies. `Global` bindings work everywhere.

| Context | Status | When it applies |
| --- | --- | --- |
| `Global` | <Documented /> | The context is active everywhere, regardless of focus. |
| `Chat` | <Documented /> | When the chat input has focus. |
| `Autocomplete` | <Documented /> | When the autocomplete menu is visible. |
| `Confirmation` | <Documented /> | When a confirmation or permission dialog shows. |
| `Help` | <Documented /> | When the help overlay is open. |
| `ProactivityMenu` | <Undocumented /> | When the proactivity dialog is open. |
| `Transcript` | <Documented /> | When you view the transcript. |
| `HistorySearch` | <Documented /> | When you search command history (ctrl+r). |
| `Task` | <Documented /> | When a task or agent runs in the foreground. |
| `ThemePicker` | <Documented /> | When the theme picker is open. |
| `Settings` | <Documented /> | When the settings menu is open. |
| `Tabs` | <Documented /> | When tab navigation is active. |
| `Attachments` | <Documented /> | When you navigate image attachments in a select dialog. |
| `Footer` | <Documented /> | When footer indicators have focus. |
| `AbovePrompt` | <Documented /> | When a plugin's panel above the prompt, or a button in it, has keyboard focus. |
| `AbovePromptInput` | <Documented /> | When a plugin's input field above the prompt has keyboard focus. |
| `AbovePromptSelect` | <Documented /> | When a plugin's select above the prompt has keyboard focus. |
| `Pane` | <Documented /> | When a plugin's pane has keyboard focus. |
| `PaneField` | <Documented /> | When an input field or select in a plugin's pane has keyboard focus. |
| `MessageSelector` | <Documented /> | When the message selector (rewind) is open. |
| `DiffDialog` | <Documented /> | When the diff dialog is open. |
| `DiffPanel` | <Documented /> | When the diff sidebar panel is open. |
| `FeedbackSurvey` | <Undocumented /> | When you type over the session feedback survey. |
| `SessionTabs` | <Gated /> | When a session on screen can be closed under the session tabs. The program lists no default key for it and leaves it out of its own generated context list. |
| `ModelPicker` | <Documented /> | When the model picker is open. |
| `EffortSlider` | <Documented /> | When the effort slider is open. |
| `Select` | <Documented /> | When a select or list component has focus. |
| `Plugin` | <Documented /> | When the plugin dialog is open. |
| `Scroll` | <Documented /> | When a scrollable view has focus (fullscreen layout). |
| `Agents` | <Documented /> | When the agents view (`claude agents`) is open. |

## Pages in This Section

| Page | What it holds |
| --- | --- |
| [Default Keys for the Main Contexts](default-keys.md) | The default keys of `Global`, `Chat`, `Autocomplete`, `Confirmation`, `Help`, `Transcript`, `HistorySearch`, `Task`, `ThemePicker`, `Settings`, `Tabs`, `Attachments`, and `Footer`. |
| [Default Keys for Plugin Panels, Dialogs, and Views](panels-and-dialogs.md) | The default keys of the plugin panels, the diff views, the pickers, `Select`, `Plugin`, `Scroll`, and `Agents`. |
| [Unbound Actions and Reserved Keys](unbound-and-reserved.md) | Actions with no default key, keys you cannot rebind, click to send, and the vim operators. |

## Related Pages

- [Interface Settings](../settings/ui.md) lists the keys that change how the terminal looks and feels.
- [Slash Commands](../../extend/skills-and-commands/slash-commands.md) covers `/keybindings`.
- [Files on Disk](../../start/files-on-disk.md) lists `keybindings.json`.
