---
title: Default Keys for Plugin Panels, Dialogs, and Views
description: The default keys of the plugin panel, diff, picker, select, plugin, scroll, and agents contexts.
sidebar_position: 3
---

These are the keys that Claude Code binds in the plugin panels, the diff views, the pickers, and the `Select`, `Plugin`, `Scroll`, and `Agents` contexts.[^defaults] Use this page to find the key of an action before you rebind it. To rebind a key, see [Keybindings](index.md).

## Example

This block moves the install action in the `Plugin` context from `i` to `p`. It sets `i` to `null` to free the default key.

```json title="~/.claude/keybindings.json"
{
  "bindings": [
    {
      "context": "Plugin",
      "bindings": { "i": null, "p": "plugin:install" }
    }
  ]
}
```

## Default Keys for Panels, Dialogs, and Views

The first contexts are on [Default Keys by Context](default-keys.md#default-keys-by-context). The same rules for platforms and overrides apply here.

### `AbovePrompt`

| Key | Action | Status |
| --- | --- | --- |
| `tab` | `abovePrompt:next` | <Documented /> |
| `right` | `abovePrompt:next` | <Documented /> |
| `shift+tab` | `abovePrompt:previous` | <Documented /> |
| `left` | `abovePrompt:previous` | <Documented /> |
| `enter` | `abovePrompt:press` | <Documented /> |
| `space` | `abovePrompt:press` | <Documented /> |
| `escape` | `abovePrompt:leave` | <Documented /> |
| `up` | `pane:scrollUp` | <Documented /> |
| `down` | `pane:scrollDown` | <Documented /> |
| `pageup` | `pane:pageUp` | <Documented /> |
| `pagedown` | `pane:pageDown` | <Documented /> |
| `home` | `pane:top` | <Documented /> |
| `end` | `pane:bottom` | <Documented /> |

### `AbovePromptInput`

| Key | Action | Status |
| --- | --- | --- |
| `tab` | `abovePrompt:next` | <Documented /> |
| `shift+tab` | `abovePrompt:previous` | <Documented /> |
| `enter` | `abovePrompt:press` | <Documented /> |
| `escape` | `abovePrompt:leave` | <Documented /> |

### `AbovePromptSelect`

| Key | Action | Status |
| --- | --- | --- |
| `tab` | `abovePrompt:next` | <Documented /> |
| `shift+tab` | `abovePrompt:previous` | <Documented /> |
| `down` | `abovePrompt:highlightNext` | <Documented /> |
| `up` | `abovePrompt:highlightPrevious` | <Documented /> |
| `enter` | `abovePrompt:press` | <Documented /> |
| `escape` | `abovePrompt:leave` | <Documented /> |

### `Pane`

| Key | Action | Status |
| --- | --- | --- |
| `tab` | `abovePrompt:next` | <Documented /> |
| `shift+tab` | `abovePrompt:previous` | <Documented /> |
| `enter` | `abovePrompt:press` | <Documented /> |
| `escape` | `abovePrompt:leave` | <Documented /> |
| `up` | `pane:scrollUp` | <Documented /> |
| `down` | `pane:scrollDown` | <Documented /> |
| `pageup` | `pane:pageUp` | <Documented /> |
| `pagedown` | `pane:pageDown` | <Documented /> |
| `home` | `pane:top` | <Documented /> |
| `end` | `pane:bottom` | <Documented /> |
| `ctrl+x left` | `pane:grow` | <Documented /> |
| `ctrl+x up` | `pane:grow` | <Documented /> |
| `ctrl+x right` | `pane:shrink` | <Documented /> |
| `ctrl+x down` | `pane:shrink` | <Documented /> |
| `ctrl+x x` | `pane:close` | <Documented /> |

### `PaneField`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+x x` | `pane:close` | <Documented /> |

### `DiffDialog`

| Key | Action | Status |
| --- | --- | --- |
| `escape` | `diff:dismiss` | <Documented /> |
| `left` | `diff:previousSource` | <Documented /> |
| `right` | `diff:nextSource` | <Documented /> |
| `up` | `diff:previousFile` | <Documented /> |
| `down` | `diff:nextFile` | <Documented /> |
| `j` | `diff:nextFile` | <Documented /> |
| `k` | `diff:previousFile` | <Documented /> |
| `pageup` | `scroll:pageUp` | <Documented /> |
| `pagedown` | `scroll:pageDown` | <Documented /> |
| `space` | `scroll:fullPageDown` | <Documented /> |
| `shift+space` | `scroll:fullPageUp` | <Documented /> |
| `b` | `scroll:fullPageUp` | <Documented /> |
| `g` | `scroll:top` | <Documented /> |
| `shift+g` | `scroll:bottom` | <Documented /> |
| `home` | `scroll:top` | <Documented /> |
| `end` | `scroll:bottom` | <Documented /> |

### `DiffPanel`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+x b` | `app:cycleDiffBase` | <Documented /> |

### `FeedbackSurvey`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+x 1` | `feedbackSurvey:bad` | <Undocumented /> |
| `ctrl+x 2` | `feedbackSurvey:fine` | <Undocumented /> |
| `ctrl+x 3` | `feedbackSurvey:good` | <Undocumented /> |

### `ModelPicker`

| Key | Action | Status |
| --- | --- | --- |
| `left` | `modelPicker:decreaseEffort` | <Documented /> |
| `right` | `modelPicker:increaseEffort` | <Documented /> |
| `s` | `modelPicker:thisSessionOnly` | <Documented /> |

### `EffortSlider`

| Key | Action | Status |
| --- | --- | --- |
| `left` | `effortSlider:decreaseEffort` | <Documented /> |
| `right` | `effortSlider:increaseEffort` | <Documented /> |
| `tab` | `effortSlider:toggleUltracode` | <Documented /> |
| `s` | `effortSlider:thisSessionOnly` | <Documented /> |

### `Select`

| Key | Action | Status |
| --- | --- | --- |
| `up` | `select:previous` | <Documented /> |
| `down` | `select:next` | <Documented /> |
| `j` | `select:next` | <Documented /> |
| `k` | `select:previous` | <Documented /> |
| `ctrl+n` | `select:next` | <Documented /> |
| `ctrl+p` | `select:previous` | <Documented /> |
| `pageup` | `select:pageUp` | <Documented /> |
| `pagedown` | `select:pageDown` | <Documented /> |
| `home` | `select:first` | <Documented /> |
| `end` | `select:last` | <Documented /> |
| `enter` | `select:accept` | <Documented /> |
| `escape` | `select:cancel` | <Documented /> |

### `Plugin`

| Key | Action | Status |
| --- | --- | --- |
| `space` | `plugin:toggle` | <Documented /> |
| `i` | `plugin:install` | <Documented /> |
| `f` | `plugin:favorite` | <Documented /> |
| `ctrl+s` | `plugin:cycleMarketplace` | <Undocumented /> |

### `Scroll`

| Key | Action | Status |
| --- | --- | --- |
| `pageup` | `scroll:pageUp` | <Documented /> |
| `pagedown` | `scroll:pageDown` | <Documented /> |
| `wheelup` | `scroll:lineUp` | <Documented /> |
| `wheeldown` | `scroll:lineDown` | <Documented /> |
| `ctrl+home` | `scroll:top` | <Documented /> |
| `ctrl+end` | `scroll:bottom` | <Documented /> |
| `ctrl+shift+c` | `selection:copy` | <Documented /> |
| `cmd+c` | `selection:copy` | <Documented /> |
| `shift+left` | `selection:extendLeft` | <Documented /> |
| `shift+right` | `selection:extendRight` | <Documented /> |
| `shift+up` | `selection:extendUp` | <Documented /> |
| `shift+down` | `selection:extendDown` | <Documented /> |
| `shift+home` | `selection:extendLineStart` | <Documented /> |
| `shift+end` | `selection:extendLineEnd` | <Documented /> |

### `Agents`

| Key | Action | Status |
| --- | --- | --- |
| `ctrl+s` | `agents:switchView` | <Documented /> |
| `ctrl+t` | `agents:togglePin` | <Documented /> |
| `ctrl+f` | `agents:find` | <Documented /> |
| `ctrl+r` | `agents:rename` | <Documented /> |
| `ctrl+up` | `agents:previousGroup` | <Documented /> |
| `meta+up` | `agents:previousGroup` | <Documented /> |
| `ctrl+down` | `agents:nextGroup` | <Documented /> |
| `meta+down` | `agents:nextGroup` | <Documented /> |

## Related Pages

- [Keybindings](index.md) lists the contexts and shows how to write `keybindings.json`.

## Sources

[^defaults]: The program, `chunk-g4fdykqa.js:682-7837`.
