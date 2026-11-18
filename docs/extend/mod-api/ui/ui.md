---
title: UI Methods
description: "The $.ui noun that draws and manages the interface: transcript lines, toasts, panes, scroll, focus, and the clipboard."
sidebar_position: 6
---

`$.ui` draws and manages the interface: lines in the transcript, toasts, panes, scroll, focus, the clipboard, and element tables. Use it when a mod must show something to the person or react to what they select. Call it from a hook, a closure that a hook drew, or a timer callback.

Each method is also an event with the same name, such as `ui.log`. A hook above the caller can rewrite or refuse the call. A `deny` from a hook refuses a call. Close a pane with `$.ui.close`.

Official pages: [Draw in the Interface](https://code.claude.com/docs/en/plugins/mods/interface) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types-323]

In the "Where it can be used" column, "Run time" means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

```javascript
on("session.start", async ($, e, next) => {
  $.ui.status("Mod ready");
  $.ui.toast("Hello from a mod", { timeoutMs: 2000 });
  return next(e);
});
```

This theme example uses the `2.1.323` names: `backdrop.scene` and the top-level `overrideColorScheme`. The run behind it used the older `id` and `colorScheme`.[^theme-run]

```javascript
on("session.start", async ($, e, next) => {
  const r = await $.theme.set({
    backdrop: {
      scene: "lagoon",
      glass: { blur: 14, opacity: 0.55 },
    },
    overrideColorScheme: "dark",
  });
  $.ui.log(JSON.stringify(r), { to: "debug" });
  return next(e);
});
```

In a `-p` run with no app attached, the debug log shows `{"isDrawn":false,"requestId":"backdrop","reason":"no attached desktop or mobile client says it draws backdrops (an app with the backdrop layer does, on its ui_attach)"}`.

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.ui.notice` | <Documented /> | Shows `text` as one line under the dialog open for `tool_use_id`. Removes the line when `text` is undefined. | `(tool_use_id, text) => void`. Core removes the line when the call ends. | A `tool.call` hook while the call's dialog is open. |
| `$.ui.invalidate` | <Documented /> | Re-runs an event whose results the engine caches. `ui.render` draws the instances this plugin may draw again. The others drop the cached answers. | `(event: InvalidatableEventName) => void`. At most ten redraws a second. It can also drop a cached answer, such as `prompt.section` or `tool.describe`. Since `2.1.323`, it also takes `tool.list`. | Run time. |
| `$.ui.blit` | <Documented /> | Repaints a mounted `Raster` that this plugin's render hook drew with new cells, or swaps a keyed `Image` to a new source. No redraw. | `(args: UiBlitArgs) => Promise<UiBlitResult>`. Paints at the next frame. The engine takes up to 120 calls a second. Resolves `{}` or `{ deny }`. | A plugin's own mounted `Raster` or keyed `Image`. |
| `$.ui.resolve` | <Documented /> | Gives the elements of the surface that `e` is drawn on: a frozen table of constructors, the JSX tags that a render hook draws with. | `<E extends ResolveInput>(e: E) => Elements[E['surface']]`. It is a read, not a dispatch. | A `ui.render` hook (it takes that hook's `e`). |
| `$.ui.log` | <Documented /> | Appends one line to the transcript, drawn like a dim system notice that is not sent to the model. With `{ to: "debug" }` it goes to the debug log only. | `(text, options?) => void`. The terminal draws 2000 characters. A remote surface draws 10000. | Run time. |
| `$.ui.ask` | <Documented /> | Asks the user a question in the engine's own AskUserQuestion dialog. Resolves to the label they chose, or the text typed under "Other". | `(question, options?) => Promise<string>`. Offers 2 to 4 labels. Rejects if the user dismisses the dialog, and in a `-p` run. | Not in a `-p` run. |
| `$.ui.toast` | <Documented /> | Shows `text` for a few seconds under the plugin's name in a small box at the top right of the transcript. | `(text, options?) => void`. A click removes it. `timeoutMs` sets how long it stays (default 4000). | Run time. |
| `$.ui.notify` | <Documented /> | Raises a native notification through the person's own notification channel (the one `preferredNotifChannel` names). | `(text, options?) => Promise<UiNotifyResult>`. The `Notification` hooks run first. Resolves `{ isSent, channel }` or `{ isSent: false, reason }`. | Run time. |
| `$.ui.cancelNotify` | <Undocumented /> | Takes back a notification that this plugin raised with `$.ui.notify` under a `key`, shown or still waiting. If none is held under the key, nothing happens. | `(key: string) => Promise<{ isSent: boolean }>`. The `key` is 1 to 64 characters, with no hidden characters or stray spaces, and not a name that every object has, such as `constructor`. `isSent` is `true` when a client took the cancel and `false` when none did (`no_client`). New in `2.1.321`.[^cancel-notify] The official [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference) does not list it. | Run time. |
| `$.ui.status` | <Documented /> | Pins `text` as this plugin's status line under the prompt, until the next call replaces it. | `(text: string \| undefined) => void`. `undefined` removes it. 2000 characters are drawn. | Run time. |
| `$.ui.open` | <Documented /> | Opens a pane: a framed region that the surface places and this plugin draws by hooking `ui.render` for `{ component: "Pane" }`. | `(pane: PaneOpenArgs) => Promise<UiOpenResult>`. The `id` has 1 to 64 characters. Panes that someone asked for fit at any width. Panes that nobody asked for need 144 columns. Since `2.1.323`, a pane that another plugin holds is refused: the open rejects and names it. `PaneOpenArgs` takes `placement` (the seat to start in: `"widget"`, its small form on the desktop app), and the seat the pane got is on the `Pane` props.[^types-323] | Run time. |
| `$.ui.close` | <Documented /> | Closes one of the open panes. The call ignores an id that is not open. | `(pane: PaneCloseArgs) => Promise<void>`. A `ui.close` hook can keep it open, except on an unload. Since `2.1.323`, a pane that another plugin holds is refused. | Run time. |
| `$.ui.panes` | <Documented /> | Lists this plugin's own open panes: id, title, and whether each is shown, holds the keyboard, and is placed. | `() => Promise<readonly UiPane[]>`. In open order, placed ones first. Other plugins' panes are not listed. | Run time. |
| `$.ui.place` | <Undocumented /> | Places one row at the end of the transcript. It scrolls with the conversation, and a `ui.render` hook draws it as the component `Placed`. Display only: the model and the transcript file never read it. | `(args: UiPlaceArgs) => Promise<UiPlaceResult>`. The `id` names the row among this plugin's rows. A second call with the same `id` answers the row that stands. A plugin holds at most 500 placed rows. Resolves `{ isPlaced: false, reason }` with no conversation. New in `2.1.314`. | Run time. |
| `$.theme.set` | <Undocumented /> | Sets the one theme of the session from an object of named attributes. Name at least one of `backdrop`, `overrideColorScheme`, and `colors`. A set names the whole theme, so what it leaves out is gone. The latest set wins, whichever plugin set it. Display only: `--resume` brings none back, and a plugin that unloads takes its own with it. | Since `2.1.323`: `(attributes: ThemeSetArgs) => Promise<ThemeResult>`, where `ThemeSetArgs` is `{ backdrop?: { scene: string, glass?: { blur?: number, tint?: string, opacity?: number } \| false } \| ThemeGround, overrideColorScheme?: 'light' \| 'dark', colors?: ThemeColors }`.[^types-323] Before: `(attributes: { backdrop: { id: string, glass?: ..., colorScheme?: 'light' \| 'dark' } }) => Promise<ThemeResult>`. See Theme Set Details. New in `2.1.319`.[^theme-run] | Run time. |
| `$.theme.clear` | <Undocumented /> | Clears the theme of the session, back to the app's own look. It clears whatever theme stands, whichever plugin set it, so call it on a person's ask and not at `session.start` or on a reload. | `() => Promise<ThemeResult>`. Always resolves `{ isDrawn: false, reason }`. The reason is "the theme is cleared" when a theme stood, and "no theme stood, so nothing was cleared" when none did. In the run, `clear` after a `set` gave the first, and a second `clear` and a first `clear` gave the second. New in `2.1.319`.[^theme-run] | Run time. |
| `$.ui.scroll` | <Documented /> | Scrolls something into view, like the DOM's `scrollIntoView`: a render instance by `requestId`, an element by `key`, or the edge of a site. | `(args: UiScrollArgs) => Promise<UiScrollResult>`. `to` says where, `in` says which site, `block` says where it lands. | Run time. |
| `$.ui.focus` | <Documented /> | Moves the focus ring of one of this plugin's sites to an element it drew there, like the DOM's `element.focus()`. | `(args: UiFocusArgs) => Promise<UiFocusResult>`. Takes the site `requestId` and the element `key`. Resolves `{}` or `{ deny }`. | Run time. |
| `$.ui.copy` | <Documented /> | Puts `text` on the clipboard of a surface the session draws on, and says whether it took. | `(args: UiCopyArgs) => Promise<UiCopyResult>`. Resolves `{ isCopied: true }` or `{ isCopied: false, reason }`. | Run time. |
| `$.ui.selection` | <Documented /> | Returns what the person last selected with the mouse: the text as a copy would take it, and the transcript row it lies in. | `() => Promise<UiSelection \| undefined>`. `undefined` with nothing selected, in `-p`, or when fullscreen is off. | Run time. |
| `$.ui.view` | <Undocumented /> | Puts an agent's transcript in the main view, as the person's own switch from the tasks list does. `{}` goes back to the main one. | `(view: SiteView) => Promise<UiViewResult>`. Works only while the call answers the person's own input (press, pick, prompt, command). | Only while answering the person's own input. |

## Theme Set Details

`$.theme.set` takes three attributes. Each one is since `2.1.323` unless the text says otherwise.[^types-323]

- `backdrop` is a scene or a still ground. A scene is `{ scene, glass? }`, and a `ui.render` hook for `Backdrop` draws it. A still ground (`ThemeGround`) is `{ color }`, `{ gradient: { stops, angle?, shape?, size?, repeat? } }`, or `{ vector: { viewBox, paths, color?, size?, repeat? } }`. A surface draws a still ground with no hook. A still ground takes no `glass`. A scene takes no `color`, `gradient`, or `vector`. Before `2.1.323`, `backdrop.id` named the scene, and `colorScheme` was inside `backdrop`.
- `overrideColorScheme` replaces the mode of the person with `light` or `dark`. The desktop app ignores it for now. Without it, a surface acts as if it named the only mode that `colors.inputs` gives. If `colors.inputs` gives two modes, the mode of the person stands.
- `colors` is a color theme (`ThemeColors`, a whole palette) for a surface to paint itself with, where it reads one.

### Backdrop Values

- `scene` is 1 to 64 letters, digits, `_`, or `-`. Before `2.1.323`, this was `id`.
- `blur` is 0 to 64 points. Before `2.1.323`, it was CSS pixels. The default is 16.[^blur]
- `opacity` is 0 to 1. The default is 0.6.
- `tint` is a raw color: `#hex`, `rgb()`, `rgba()`, `hsl()`, or `hsla()`.
- `color` is one `ThemeColor`: a design system color name (`ThemeColorName`, such as `surface-0`, `text-primary`, or `fill-accent`), `transparent`, or a raw `#hex`, `rgb...`, or `hsl...` color. A surface uses a raw color as it is. It works out a name from the `colors` of the look in the mode of the look, else from the app's own colors. It logs and drops anything else.
- `gradient` has `stops` (2 to 16 colors, evenly spaced, or `{ at, color }` with `at` from 0 to 1 in order), `angle` (degrees, -360 to 360, default 180), and `shape` (`linear`, or `radial`, which ignores `angle`).
- `vector` has `viewBox` (a side, or `[width, height]`, 1 to 256), `paths` (at most 64), and an optional `color` for paths that name none. A path is a string or `{ d }`, which the surface fills by the even-odd rule. A path `{ d, strokeWidth }` is stroked at a width above 0 and at most 64, with an optional `color` on each.
- A gradient and a vector also take `size` (`[width, height]` in points, each side 1 to 256) and `repeat`. With `repeat`, the surface tiles the ground at that size. Without it, the ground stretches.
- A surface may refuse a long `d`: past 16,384 characters on Desktop, or 8,192 parts in a drawing on iPhone.

### Palette Values

- `ThemeColors` is `{ v: 1, label, inputs: { light?, dark? }, codeTheme?, contrast? }`. Each mode of `inputs` maps a design system token to a six-digit hex color. `label` has 1 to 64 characters. `contrast` is `more` or absent. The `id` of a palette is optional.
- The `defineTheme` of the design system returns it. It holds at most 1,500 JSON values.
- The engine reads none of it, and no `ui.render` hook sees it.
- `colors` holds no key `__proto__`, `constructor`, or `prototype`, and no named key on a list.
- The token names are those of the design system. A wrong one paints nothing.
- If `inputs` has one mode only, a surface acts as if `overrideColorScheme` named that mode. Where the person is in the other mode, the surface keeps its own colors.
- A surface refuses a palette whose text contrast is too low. `isDrawn` stays `true`.

### Result and Errors

- It resolves `{ isDrawn: true, requestId: "backdrop" }`, or `{ isDrawn: false, requestId, reason }` when no surface draws backdrops. With no desktop or mobile client attached, the run gave `isDrawn: false`, `requestId: "backdrop"`, and the reason "no attached desktop or mobile client says it draws backdrops (an app with the backdrop layer does, on its ui_attach)". A second identical call also resolves `isDrawn: false` with the same reason.
- `isDrawn: true` says only that a client that says it draws the theme is attached. It does not say that the client paints `colors`, follows `overrideColorScheme`, or draws each part of a look.
- `requestId` is `backdrop` for a scene and `theme` with no scene.[^theme-323] Before `2.1.323`, the second case was "with no `backdrop`". With no scene, no `ui.render` hook is asked to draw.
- Before `2.1.321`, the only attribute was `backdrop`. It was drawn behind the conversation by a `ui.render` hook for the component `Backdrop`, on the desktop and mobile apps only. The `2.1.319` rule that the only attribute is `backdrop` is gone.
- Before `2.1.321`, it rejected with the host check text `theme.set does not know the attribute "palette": this build takes backdrop`, `theme.set takes backdrop: { id, glass?, colorScheme? }; $.theme.clear() clears the theme`, `glass.blur is a number of CSS pixels, 0 to 64`, `colorScheme is light or dark`, and `id is 1 to 64 of letters, digits, _ or - (host check)`.[^theme-321]
- In `2.1.321` and `2.1.322`, the texts were `this build takes backdrop, colors` and `theme.set takes backdrop: { id, glass?, colorScheme? }, colors, or both; $.theme.clear() clears the theme`. The signature was `{ backdrop?, colors? }`.[^theme-321]
- Since `2.1.323`, the program says `theme.set needs at least one of backdrop, overrideColorScheme, colors; $.theme.clear() clears the theme`, `overrideColorScheme is light or dark`, `glass.blur is a number of points, 0 to 64`, `backdrop needs a scene: 1 to 64 of letters, digits, _ or -`, `backdrop.glass is for a scene: a still ground has none`, and `backdrop takes just one of scene, color, gradient or vector, and this names ...`. The attribute error ends `this build takes backdrop, overrideColorScheme, colors`.[^theme-323]

## Related Pages

- [Mod API Overview](../index.md)
- [UI Events](ui-events.md)
- [Surfaces, Elements, and Render Sites](ui-elements.md)
- [UI Types](../types/ui/index.md) (element props and results of `$.ui`)

## Sources

[^types-323]: The program, the Mod API type file loaded at `chunk-gf0qnxzg.js:257`, published as `schemas/claude-code.d.ts`, the `ui` and `theme` members of the `$` type, `InvalidatableEventName`, `PaneOpenArgs`, and `ThemeSetArgs`.
[^theme-run]: Probe case `print.cli319.theme.engine`, run on the `2.1.319` program in a `-p` run with a mod that calls the function from `session.start`. The function table of the hooks engine holds `theme.set`, with a `check` and a `run`.
[^theme-323]: The program, `chunk-grrnec65.js:18110`. The attribute check reads the list `E=["backdrop","overrideColorScheme","colors"]` at `chunk-grrnec65.js:17712`, and `glass.blur is a number of points` is at `chunk-grrnec65.js:11001`.
[^theme-321]: The texts are from the program of `2.1.321`. The text of `2.1.327` no longer holds them; its host check is at `chunk-grrnec65.js:17949` and `chunk-grrnec65.js:18110`. The type text is in `schemas/claude-code.d.ts`, `ThemeColors`.
[^blur]: The program, `chunk-grrnec65.js:11001`.
[^cancel-notify]: The program, call `chunk-b0yr0k8v.js:314613`, check `chunk-m14bt1pz.js:4846946` (`mri`) and run `chunk-m14bt1pz.js:4848746` (`Rri`), table `chunk-m14bt1pz.js:4874632`.
