---
title: UI Methods
description: The $.ui noun that draws and manages the interface - transcript lines, toasts, panes, scroll, focus, and the clipboard.
sidebar_position: 6
---

`$.ui` draws and manages the interface: lines in the transcript, toasts, panes, scroll, focus, the clipboard, and element tables.
Each method is also an event with the same name, such as `ui.log`, so a hook above the caller can rewrite or refuse the call.

Close a pane with `$.ui.close`. A `deny` from a hook refuses a call.

Official page: [Draw in the Interface](https://code.claude.com/docs/en/plugins/mods/interface), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.314 program (`schemas/claude-code.d.ts`).
"Run time" appears in a "Where it can be used" cell. It means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

```javascript
on("session.start", async ($, e, next) => {
  $.ui.status("Mod ready");
  $.ui.toast("Hello from a mod", { timeoutMs: 2000 });
  return next(e);
});
```

A theme example, from the run of case `print.cli319.theme.engine`:

```javascript
on("session.start", async ($, e, next) => {
  const r = await $.theme.set({
    backdrop: {
      id: "lagoon",
      glass: { blur: 14, opacity: 0.55 },
      colorScheme: "dark",
    },
  });
  $.ui.log(JSON.stringify(r), { to: "debug" });
  return next(e);
});
```

In a `-p` run, with no app attached, the debug log shows `{"isDrawn":false,"requestId":"backdrop","reason":"no attached desktop or mobile client says it draws backdrops (an app with the backdrop layer does, on its ui_attach)"}`.

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.ui.notice` | <Documented /> | Shows `text` as one line under the dialog open for `tool_use_id`. Removes the line when `text` is undefined. | `(tool_use_id, text) => void`. Core removes the line when the call ends. | A `tool.call` hook while the call's dialog is open. |
| `$.ui.invalidate` | <Documented /> | Re-runs an event whose results the engine caches. `ui.render` draws the instances this plugin may draw again. The others drop the cached answers. | `(event: InvalidatableEventName) => void`. At most ten redraws a second. It can also drop a cached answer, such as `prompt.section` or `tool.describe`. | Run time. |
| `$.ui.blit` | <Documented /> | Repaints a mounted `Raster` that this plugin's render hook drew with new cells, or swaps a keyed `Image` to a new source. No redraw. | `(args: UiBlitArgs) => Promise<UiBlitResult>`. Paints at the next frame. The engine takes up to 120 calls a second. Resolves `{}` or `{ deny }`. | A plugin's own mounted `Raster` or keyed `Image`. |
| `$.ui.resolve` | <Documented /> | Gives the elements of the surface that `e` is drawn on: a frozen table of constructors, the JSX tags that a render hook draws with. | `<E extends ResolveInput>(e: E) => Elements[E['surface']]`. It is a read, not a dispatch. | A `ui.render` hook (it takes that hook's `e`). |
| `$.ui.log` | <Documented /> | Appends one line to the transcript, drawn like a dim system notice that is not sent to the model. With `{ to: "debug" }` it goes to the debug log only. | `(text, options?) => void`. The terminal draws 2000 characters. A remote surface draws 10000. | Run time. |
| `$.ui.ask` | <Documented /> | Asks the user a question in the engine's own AskUserQuestion dialog. Resolves to the label they chose, or the text typed under "Other". | `(question, options?) => Promise<string>`. Offers 2 to 4 labels. Rejects if the user dismisses the dialog, and in a `-p` run. | Not in a `-p` run. |
| `$.ui.toast` | <Documented /> | Shows `text` for a few seconds under the plugin's name in a small box at the top right of the transcript. | `(text, options?) => void`. A click removes it. `timeoutMs` sets how long it stays (default 4000). | Run time. |
| `$.ui.notify` | <Documented /> | Raises a native notification through the person's own notification channel (the one `preferredNotifChannel` names). | `(text, options?) => Promise<UiNotifyResult>`. The `Notification` hooks run first. Resolves `{ isSent, channel }` or `{ isSent: false, reason }`. | Run time. |
| `$.ui.cancelNotify` | <Undocumented /> | Takes back a notification that this plugin raised with `$.ui.notify` under a `key`, shown or still waiting. If none is held under the key, nothing happens. | `(key: string) => Promise<{ isSent: boolean }>`. The `key` is 1 to 64 characters, with no hidden characters or stray spaces, and not a name that every object has, such as `constructor`. `isSent` is `true` when a client took the cancel and `false` when none did (`no_client`). New in `2.1.321`. Read sites: call `chunk-agdd3hhp.js:278677`, check and run `chunk-ne1755n5.js:4349609` (`WEs`), table `chunk-ne1755n5.js:4379223`. The official [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference) does not list it. | Run time. |
| `$.ui.status` | <Documented /> | Pins `text` as this plugin's status line under the prompt, until the next call replaces it. | `(text: string \| undefined) => void`. `undefined` removes it. 2000 characters are drawn. | Run time. |
| `$.ui.open` | <Documented /> | Opens a pane: a framed region that the surface places and this plugin draws by hooking `ui.render` for `{ component: "Pane" }`. | `(pane: PaneOpenArgs) => Promise<UiOpenResult>`. The `id` has 1 to 64 characters. Panes that someone asked for fit at any width. Panes that nobody asked for need 144 columns. | Run time. |
| `$.ui.close` | <Documented /> | Closes one of the open panes. The call ignores an id that is not open. | `(pane: PaneCloseArgs) => Promise<void>`. A `ui.close` hook can keep it open, except on an unload. | Run time. |
| `$.ui.panes` | <Documented /> | Lists this plugin's own open panes: id, title, and whether each is shown, holds the keyboard, and is placed. | `() => Promise<readonly UiPane[]>`. In open order, placed ones first. Other plugins' panes are not listed. | Run time. |
| `$.ui.place` | <Undocumented /> | Places one row at the end of the transcript. It scrolls with the conversation, and a `ui.render` hook draws it as the component `Placed`. Display only: the model and the transcript file never read it. | `(args: UiPlaceArgs) => Promise<UiPlaceResult>`. The `id` names the row among this plugin's rows. A second call with the same `id` answers the row that stands. A plugin holds at most 500 placed rows. Resolves `{ isPlaced: false, reason }` with no conversation. New in `2.1.314`. | Run time. |
| `$.theme.set` | <Undocumented /> | Sets the one theme of the session from an object of named attributes. The only attribute is `backdrop`, drawn behind the conversation by a `ui.render` hook for the component `Backdrop`, on the desktop and mobile apps only. The latest set wins, whichever plugin set it. Display only: `--resume` brings none back, and a plugin that unloads takes its own with it. | `(attributes: { backdrop: { id: string, glass?: { blur?: number, tint?: string, opacity?: number } \| false, colorScheme?: 'light' \| 'dark' } }) => Promise<ThemeResult>`. `id` is 1 to 64 letters, digits, `_`, or `-`. `blur` is 0 to 64 CSS pixels (16 when left out). `opacity` is 0 to 1 (0.6 when left out). `tint` is a raw color: `#hex`, `rgb()`, `rgba()`, `hsl()`, or `hsla()`. Resolves `{ isDrawn: true, requestId: "backdrop" }`, or `{ isDrawn: false, requestId, reason }` when no surface draws backdrops. With no desktop or mobile client attached, the run gave `isDrawn: false`, `requestId: "backdrop"`, and the reason "no attached desktop or mobile client says it draws backdrops (an app with the backdrop layer does, on its ui_attach)". It rejects with the host check text: `theme.set does not know the attribute "palette": this build takes backdrop`, `theme.set takes backdrop: { id, glass?, colorScheme? }; $.theme.clear() clears the theme`, `glass.blur is a number of CSS pixels, 0 to 64`, `colorScheme is light or dark`, and `id is 1 to 64 of letters, digits, _ or - (host check)`. A second identical call also resolves `isDrawn: false` with the same reason. New in `2.1.319`. Run on the 2.1.319 program in a `-p` run, with a mod that calls the function from `session.start`: case `print.cli319.theme.engine`. Read site: the function table of the hooks engine (`theme.set` with a `check` and a `run`). | Run time. |
| `$.theme.clear` | <Undocumented /> | Clears the theme of the session, back to the own look of the app. It clears whatever theme stands, whichever plugin set it, so call it on a person's ask and not at `session.start` or on a reload. | `() => Promise<ThemeResult>`. Always resolves `{ isDrawn: false, reason }`. The reason is "the theme is cleared" when a theme stood, and "no theme stood, so nothing was cleared" when none did. In the run, `clear` after a `set` gave the first, and a second `clear` and a first `clear` gave the second. New in `2.1.319`. Run on the 2.1.319 program in a `-p` run, with a mod that calls the function from `session.start`: case `print.cli319.theme.engine`. Read site: the function table of the hooks engine (`theme.set` with a `check` and a `run`). | Run time. |
| `$.ui.scroll` | <Documented /> | Scrolls something into view, like the DOM's `scrollIntoView`: a render instance by `requestId`, an element by `key`, or the edge of a site. | `(args: UiScrollArgs) => Promise<UiScrollResult>`. `to` says where, `in` says which site, `block` says where it lands. | Run time. |
| `$.ui.focus` | <Documented /> | Moves the focus ring of one of this plugin's sites to an element it drew there, like the DOM's `element.focus()`. | `(args: UiFocusArgs) => Promise<UiFocusResult>`. Takes the site `requestId` and the element `key`. Resolves `{}` or `{ deny }`. | Run time. |
| `$.ui.copy` | <Documented /> | Puts `text` on the clipboard of a surface the session draws on, and says whether it took. | `(args: UiCopyArgs) => Promise<UiCopyResult>`. Resolves `{ isCopied: true }` or `{ isCopied: false, reason }`. | Run time. |
| `$.ui.selection` | <Documented /> | Returns what the person last selected with the mouse: the text as a copy would take it, and the transcript row it lies in. | `() => Promise<UiSelection \| undefined>`. `undefined` with nothing selected, in `-p`, or when fullscreen is off. | Run time. |
| `$.ui.view` | <Undocumented /> | Puts an agent's transcript in the main view, as the person's own switch from the tasks list does. `{}` goes back to the main one. | `(view: SiteView) => Promise<UiViewResult>`. Works only while the call answers the person's own input (press, pick, prompt, command). | Only while answering the person's own input. |

## Related Pages

- [Mod API Overview](../index.md)
- [UI Events](ui-events.md)
- [Surfaces, Elements, and Render Sites](ui-elements.md)
- [UI Types](../types/ui/index.md) (element props and results of `$.ui`)
