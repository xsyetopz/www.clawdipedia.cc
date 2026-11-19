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
  "bindings": [
    { "context": "Global", "bindings": { "ctrl+x r": "app:redraw" } }
  ]
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
| Hint text | <Undocumented /> | Names the key for `chat:sendNow`, or reads "click to send now" when no key is bound to it. | Since `2.1.312`. With no key bound, the hint shows only in mouse mode `full`.[^hint-text] Since `2.1.326`, the hint reads `Queued · <key> send now`, or `Queued · click to send now` with no key bound, when the line is wide enough for it.[^hint-queued] |

## Vim Mode Operators with `gj` And `gk`

The vim keys of the input prompt are not in `keybindings.json`. The setting `editorMode` turns them on. See [Interface Settings](../settings/ui.md).

| Input | Status | What it does | Notes |
| --- | --- | --- | --- |
| `d`, `c`, or `y` with `gj` or `gk` and a count | <Undocumented /> | When the count is larger than the display lines left, the keys only move the cursor. | Since `2.1.312`. Before, the keys could delete or copy text. Claude Code tests the count against the wrapped lines below the cursor for `gj` and above it for `gk`.[^vim-count] |

## Related Pages

- [Keybindings](index.md) lists the contexts and shows how to write `keybindings.json`.

## Sources

[^unbound]: The program lists these actions as valid, and its default keys do not bind them. The valid actions are in `chunk-g4fdykqa.js:12613-16014`, and the default keys are in `chunk-g4fdykqa.js:682-7837`.
[^close-session]: The program, `chunk-j2wfp6sf.js:874650`, `chunk-g4fdykqa.js:16014`, `chunk-b3qefvbn.js:5989`, `chunk-b3qefvbn.js:7082`. Probe cases `pty.cli319.keybinding.session-tabs`, `pty.cli319.keybinding.control-bad-action`, and `pty.cli319.keybinding.control-bad-context`, run with `bun run release:probe:pty -- --to 2.1.319 --only cli319.keybinding`. The footer code calls `getDisplayText("app:closeSession", "SessionTabs")`, and the context list in the keybinding schema names `SessionTabs`.
[^reserved]: The program, `chunk-g4fdykqa.js:7838-9037`.
[^click-send]: The program reports the click as `chat:sendNowHintPress`. `chunk-j2wfp6sf.js:131971`. The program reads the two mouse variables at `chunk-mc2z5m5k.js:5712`: `CLAUDE_CODE_DISABLE_MOUSE` gives mode `off`, and `CLAUDE_CODE_DISABLE_MOUSE_CLICKS` gives mode `scroll`, so only unset gives `full`. The hint is a pressable text whose handler runs only in mode `full`, `chunk-j2wfp6sf.js:9960-9968` and `chunk-j2wfp6sf.js:9969-9974`. The handler is registered at `chunk-j2wfp6sf.js:66692` and sends the queued message with `sendQueuedNow`, `chunk-j2wfp6sf.js:66589-66625`.
[^hint-text]: The program, `chunk-j2wfp6sf.js:9918-9969`.
[^vim-count]: The program, `chunk-k6jrg48j.js:475-482` and `chunk-k6jrg48j.js:955-961`.
[^hint-queued]: The program, `chunk-j2wfp6sf.js:9901-9928`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
