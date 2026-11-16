---
title: Default Keys for the Main Contexts
description: The default keys of the Global, Chat, Autocomplete, Confirmation, Help, Transcript, HistorySearch, Task, ThemePicker, Settings, Tabs, Attachments, and Footer contexts.
sidebar_position: 2
---

These are the keys that Claude Code binds before it reads your `keybindings.json`.[^defaults] Use this page to find the key of an action before you rebind it. See [Keybindings](index.md) for the file format.

## Example

This block frees `ctrl+s` in `Chat`, which the table below binds to `chat:stash`.

```json title="~/.claude/keybindings.json"
{
  "bindings": [{ "context": "Chat", "bindings": { "ctrl+s": null } }]
}
```

## Default Keys by Context

Your file overrides these defaults. Two contexts have no default key in this list: `ProactivityMenu` and `MessageSelector`. Two defaults depend on the platform:

- `chat:cycleMode` and `confirm:cycleMode` use `shift+tab`. On Windows with an older runtime, they use `meta+m` instead.
- `chat:imagePaste` uses `ctrl+v`. On Windows and WSL it uses `alt+v`. WSL keeps `ctrl+v` too.

### `Global`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+c` | `app:interrupt` | <Documented /> |
| `ctrl+d` | `app:exit` | <Documented /> |
| `ctrl+t` | `app:toggleTodos` | <Documented /> |
| `ctrl+o` | `app:toggleTranscript` | <Documented /> |
| `ctrl+shift+b` | `app:toggleBrief` | <Undocumented /> |
| `ctrl+r` | `history:search` | <Documented /> |
| `ctrl+up` | `app:diffFileListUp` | <Documented /> |
| `ctrl+down` | `app:diffFileListDown` | <Documented /> |
| `meta+up` | `app:diffFileListUp` | <Documented /> |
| `meta+down` | `app:diffFileListDown` | <Documented /> |
| `ctrl+]` | `app:openArtifact` | <Undocumented /> |

### `Chat`

| Key | Action | Status |
| --- | --- | --- |
| `escape` | `chat:cancel` | <Documented /> |
| `ctrl+l` | `chat:clearInput` | <Documented /> |
| `cmd+k` | `chat:clearScreen` | <Documented /> |
| `ctrl+x ctrl+k` | `chat:killAgents` | <Documented /> |
| `shift+tab` | `chat:cycleMode` | <Documented /> |
| `meta+p` | `chat:modelPicker` | <Documented /> |
| `meta+o` | `chat:fastMode` | <Documented /> |
| `ctrl+y` | `chat:defaultToNewerModel` | <Undocumented /> |
| `meta+t` | `chat:thinkingToggle` | <Documented /> |
| `meta+w` | `chat:workflowKeywordToggle` | <Undocumented /> |
| `enter` | `chat:submit` | <Documented /> |
| `ctrl+x enter` | `chat:queueSubmit` | <Documented /> |
| `ctrl+x ctrl+s` | `chat:sendNow` | <Documented /> |
| `ctrl+enter` | `chat:sendNow` | <Documented /> |
| `ctrl+j` | `chat:newline` | <Documented /> |
| `up` | `history:previous` | <Documented /> |
| `down` | `history:next` | <Documented /> |
| `ctrl+_` | `chat:undo` | <Documented /> |
| `ctrl+-` | `chat:undo` | <Documented /> |
| `ctrl+shift+-` | `chat:undo` | <Documented /> |
| `ctrl+shift+_` | `chat:undo` | <Documented /> |
| `ctrl+x ctrl+e` | `chat:externalEditor` | <Documented /> |
| `ctrl+x ctrl+a` | `abovePrompt:toggle` | <Documented /> |
| `ctrl+x tab` | `abovePrompt:focus` | <Documented /> |
| `ctrl+g` | `chat:externalEditor` | <Documented /> |
| `ctrl+s` | `chat:stash` | <Documented /> |
| `ctrl+v` | `chat:imagePaste` | <Documented /> |
| `space` | `voice:pushToTalk` | <Documented /> |

### `Autocomplete`

| Key | Action | Status |
| --- | --- | --- |
| `tab` | `autocomplete:accept` | <Documented /> |
| `escape` | `autocomplete:dismiss` | <Documented /> |
| `up` | `autocomplete:previous` | <Documented /> |
| `down` | `autocomplete:next` | <Documented /> |

### `Confirmation`

| Key | Action | Status |
| --- | --- | --- |
| `enter` | `confirm:yes` | <Documented /> |
| `escape` | `confirm:no` | <Documented /> |
| `up` | `confirm:previous` | <Documented /> |
| `down` | `confirm:next` | <Documented /> |
| `tab` | `confirm:nextField` | <Documented /> |
| `space` | `confirm:toggle` | <Documented /> |
| `shift+tab` | `confirm:cycleMode` | <Documented /> |

### `Help`

| Key | Action | Status |
| --- | --- | --- |
| `escape` | `help:dismiss` | <Documented /> |

### `Transcript`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+e` | `transcript:toggleShowAll` | <Documented /> |
| `ctrl+c` | `transcript:exit` | <Documented /> |
| `escape` | `transcript:exit` | <Documented /> |
| `q` | `transcript:exit` | <Documented /> |
| `ctrl+u` | `scroll:halfPageUp` | <Documented /> |
| `ctrl+d` | `scroll:halfPageDown` | <Documented /> |
| `ctrl+b` | `scroll:fullPageUp` | <Documented /> |
| `ctrl+f` | `scroll:fullPageDown` | <Documented /> |
| `ctrl+n` | `scroll:lineDown` | <Documented /> |
| `ctrl+p` | `scroll:lineUp` | <Documented /> |
| `g` | `scroll:top` | <Documented /> |
| `shift+g` | `scroll:bottom` | <Documented /> |
| `j` | `scroll:lineDown` | <Documented /> |
| `k` | `scroll:lineUp` | <Documented /> |
| `space` | `scroll:fullPageDown` | <Documented /> |
| `b` | `scroll:fullPageUp` | <Documented /> |
| `up` | `scroll:lineUp` | <Documented /> |
| `down` | `scroll:lineDown` | <Documented /> |
| `home` | `scroll:top` | <Documented /> |
| `end` | `scroll:bottom` | <Documented /> |

### `HistorySearch`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+r` | `historySearch:next` | <Documented /> |
| `escape` | `historySearch:accept` | <Documented /> |
| `tab` | `historySearch:accept` | <Documented /> |
| `ctrl+c` | `historySearch:cancel` | <Documented /> |
| `enter` | `historySearch:execute` | <Documented /> |
| `ctrl+s` | `historySearch:cycleScope` | <Documented /> |

### `Task`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+x ctrl+b` | `task:background` | <Documented /> |
| `ctrl+b` | `task:background` | <Documented /> |

### `ThemePicker`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+t` | `theme:toggleSyntaxHighlighting` | <Documented /> |
| `ctrl+e` | `theme:editCustom` | <Undocumented /> |

### `Settings`

| Key | Action | Status |
| --- | --- | --- |
| `escape` | `confirm:no` | <Documented /> |
| `up` | `select:previous` | <Documented /> |
| `down` | `select:next` | <Documented /> |
| `k` | `select:previous` | <Documented /> |
| `j` | `select:next` | <Documented /> |
| `ctrl+p` | `select:previous` | <Documented /> |
| `ctrl+n` | `select:next` | <Documented /> |
| `home` | `select:first` | <Documented /> |
| `end` | `select:last` | <Documented /> |
| `pageup` | `select:pageUp` | <Documented /> |
| `pagedown` | `select:pageDown` | <Documented /> |
| `space` | `select:accept` | <Documented /> |
| `enter` | `select:accept` | <Documented /> |
| `/` | `settings:search` | <Documented /> |
| `r` | `settings:retry` | <Documented /> |
| `d` | `settings:periodDay` | <Undocumented /> |
| `w` | `settings:periodWeek` | <Undocumented /> |
| `f` | `settings:fixUsage` | <Documented /> |
| `t` | `settings:sortByTokens` | <Undocumented /> |
| `ctrl+u` | `scroll:halfPageUp` | <Documented /> |
| `ctrl+d` | `scroll:halfPageDown` | <Documented /> |

### `Tabs`

| Key | Action | Status |
| --- | --- | --- |
| `tab` | `tabs:next` | <Documented /> |
| `shift+tab` | `tabs:previous` | <Documented /> |
| `right` | `tabs:next` | <Documented /> |
| `left` | `tabs:previous` | <Documented /> |

### `Attachments`

| Key | Action | Status |
| --- | --- | --- |
| `right` | `attachments:next` | <Documented /> |
| `left` | `attachments:previous` | <Documented /> |
| `backspace` | `attachments:remove` | <Documented /> |
| `delete` | `attachments:remove` | <Documented /> |
| `down` | `attachments:exit` | <Documented /> |
| `escape` | `attachments:exit` | <Documented /> |

### `Footer`

| Key | Action | Status |
| --- | --- | --- |
| `up` | `footer:up` | <Documented /> |
| `ctrl+p` | `footer:up` | <Documented /> |
| `down` | `footer:down` | <Documented /> |
| `ctrl+n` | `footer:down` | <Documented /> |
| `right` | `footer:next` | <Documented /> |
| `left` | `footer:previous` | <Documented /> |
| `enter` | `footer:openSelected` | <Documented /> |
| `escape` | `footer:clearSelection` | <Documented /> |
| `x` | `footer:close` | <Documented /> |

## Related Pages

- [Keybindings](index.md) lists the contexts and shows how to write `keybindings.json`.

## Sources

[^defaults]: The program.
