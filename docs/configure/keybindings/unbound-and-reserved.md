---
title: Unbound Actions and Reserved Keys
description: Actions that have no default key, keys that Claude Code will not let you rebind, click to send, and the vim operators.
sidebar_position: 4
---

Some actions have no default key, and some keys Claude Code does not let you rebind. This page lists both, so you know what you can bind in `keybindings.json`. It also covers click to send and the vim operators with `gj` and `gk`.

## Example

This block binds the unbound action `app:redraw` to `ctrl+x r` in the `Global` context.

```json title="~/.claude/keybindings.json"
{
  "bindings": [{ "context": "Global", "bindings": { "ctrl+x r": "app:redraw" } }]
}
```

## Actions without a Default Key

Claude Code accepts these actions, but no default key binds them.[^unbound] You can bind them in `keybindings.json`.

| Action | Status |
| --- | --- |
| `app:toggleReplTab` | <Documented /> |
| `app:toggleDiffNoiseFilter` | <Documented /> |
| `app:toggleDiffPreSession` | <Documented /> |
| `app:closeSession` | <Gated /> |
| `app:toggleTerminal` | <Undocumented /> |
| `app:redraw` | <Documented /> |
| `strip:jump1` | <Undocumented /> |
| `strip:jump2` | <Undocumented /> |
| `strip:jump3` | <Undocumented /> |
| `strip:jump4` | <Undocumented /> |
| `strip:jump5` | <Undocumented /> |
| `strip:jump6` | <Undocumented /> |
| `strip:jump7` | <Undocumented /> |
| `strip:jump8` | <Undocumented /> |
| `strip:jump9` | <Undocumented /> |
| `strip:next` | <Undocumented /> |
| `strip:previous` | <Undocumented /> |
| `strip:tabNext` | <Undocumented /> |
| `strip:tabPrevious` | <Undocumented /> |
| `strip:viewAll` | <Undocumented /> |
| `strip:toggle` | <Undocumented /> |
| `strip:new` | <Undocumented /> |
| `chat:cycleProactivity` | <Undocumented /> |
| `chat:attentionUp` | <Undocumented /> |
| `chat:attentionDown` | <Undocumented /> |
| `chat:increaseEffort` | <Undocumented /> |
| `chat:decreaseEffort` | <Undocumented /> |
| `effortSlider:adaptive` | <Undocumented /> |
| `confirm:previousField` | <Documented /> |
| `proactivityMenu:previousMode` | <Undocumented /> |
| `proactivityMenu:nextMode` | <Undocumented /> |
| `footer:dismiss` | <Documented /> |
| `pane:next` | <Documented /> |
| `pane:previous` | <Documented /> |
| `diff:back` | <Documented /> |
| `permission:toggleDebug` | <Documented /> |
| `selection:clear` | <Documented /> |
| `agents:setGroup` | <Undocumented /> |

### `app:closeSession`

New in `2.1.319`. Context: `SessionTabs`. Default key: none.
The footer reads the key you bind for `app:closeSession` in `SessionTabs` and shows a close confirmation when you press it twice.
The context is active only when Claude Code draws session tabs. A plain terminal session does not.

`keybindings.json` accepts the binding, but a plain terminal session never makes it active. With `{"context": "SessionTabs", "bindings": {"ctrl+g": "app:closeSession"}}` the debug log shows "Loaded 1 user bindings" and "0 warnings", and holds no keybinding line after two presses of `ctrl+g`. An unknown action warns "Unknown action ... in SessionTabs - this binding is ignored". An unknown context warns "Unknown context ... Valid contexts: ...".[^close-session]

## Keys You Cannot Rebind

Claude Code refuses some keys and warns about others.[^reserved]

| Key | Result | Reason |
| --- | --- | --- |
| `ctrl+c`, `ctrl+d` | Error | Claude Code hardcodes them for interrupt and exit. |
| `ctrl+m` | Error | It is the same as `enter` in terminals. |
| `ctrl+[` | Error | It is the same as `escape` in terminals. |
| `ctrl+i` | Error | It is the same as `tab` in terminals. |
| `ctrl+h` | Error | It is the same as `backspace` in terminals. |
| `capslock` | Error | Terminals do not deliver it. |
| `ctrl+\` | Error | It is the terminal quit signal (SIGQUIT). |
| `ctrl+z` | Warning | It is the Unix process suspend (SIGTSTP). |
| `cmd+c`, `cmd+v`, `cmd+x`, `cmd+q`, `cmd+w`, `cmd+tab`, `cmd+space` | Error on macOS | macOS uses them. |

## Click to Send a Queued Message

A queued message shows a hint under the prompt. In fullscreen rendering with mouse mode `full`, a click on that hint sends the message at once, as the `chat:sendNow` key does.

| Input | Status | What it does | Notes |
| --- | --- | --- | --- |
| Click on the "send now" hint | <Undocumented /> | Sends the queued message at once. | Since `2.1.312`. The click needs mouse mode `full`, so `CLAUDE_CODE_DISABLE_MOUSE` and `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` both stop it.[^click-send] |
| Hint text | <Undocumented /> | Names the key for `chat:sendNow`, or reads "click to send now" when no key is bound to it. | Since `2.1.312`. With no key bound, the hint shows only in mouse mode `full`.[^hint-text] |

## Vim Mode Operators with `gj` And `gk`

The vim keys of the input prompt are not in `keybindings.json`. The setting `editorMode` turns them on. See [Interface Settings](../settings/ui.md).

| Input | Status | What it does | Notes |
| --- | --- | --- | --- |
| `d`, `c`, or `y` with `gj` or `gk` and a count | <Undocumented /> | When the count is larger than the display lines left, the keys only move the cursor. | Since `2.1.312`. Before, the keys could delete or copy text. Claude Code tests the count against the wrapped lines below the cursor for `gj` and above it for `gk`.[^vim-count] |

## Related Pages

- [Keybindings](index.md) lists the contexts and shows how to write `keybindings.json`.

## Sources

[^unbound]: The program lists these actions as valid, and its default keys do not bind them.
[^close-session]: The program. Probe cases `pty.cli319.keybinding.session-tabs`, `pty.cli319.keybinding.control-bad-action`, and `pty.cli319.keybinding.control-bad-context`, run with `bun run release:probe:pty -- --to 2.1.319 --only cli319.keybinding`. The footer code calls `getDisplayText("app:closeSession", "SessionTabs")`, and the context list in the keybinding schema names `SessionTabs`.
[^reserved]: The program.
[^click-send]: The program reports the click as `chat:sendNowHintPress`. `chunk-1xmjf4e6.js` lines 8948 and 9341 to 9374.
[^hint-text]: The program, `chunk-1xmjf4e6.js` lines 9498 to 9522.
[^vim-count]: The program, `chunk-wjynqhds.js` lines 327 to 332 and 812.
