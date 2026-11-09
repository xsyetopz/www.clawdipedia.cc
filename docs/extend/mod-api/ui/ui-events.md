---
title: UI Events
description: The events that fire when Claude Code draws part of the interface, when a person uses a control a mod drew, and when $.ui methods run.
sidebar_position: 7
---

These events fire when Claude Code draws part of the interface, and when a person uses a control that a mod drew.
The second table lists the events that the `$.ui` methods raise.

A `deny` from a hook refuses a scroll, focus, or close. An invalid tree draws the engine's own drawing.

Official pages: [Draw in the Interface](https://code.claude.com/docs/en/plugins/mods/interface), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.314 program (`schemas/claude-code.d.ts`).

## Example

This hook adds a count to the spinner.

```javascript
let calls = 0;
on("tool.call", ($, e, next) => {
  calls += 1;
  return next(e);
});
on("ui.render", { component: "Spinner" }, async ($, e, next) =>
  next({
    ...e,
    props: { ...e.props, suffix: ` · tool calls: ${calls}…` },
  }),
);
```

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `ui.render` | <Documented /> | Fires when the engine is about to draw a component: once for each input value (props, viewport width), at plugin load, or on `$.ui.invalidate("ui.render")`. | Input `RenderInput`. Result `RenderElement`: the tree to draw. `next(e)` gives the engine's drawing. An invalid tree draws the engine's drawing. | `on('ui.render', ...)`. In tests: `$.ui.render(...)` on the test engine (not on a hook's `$`). |
| `ui.resolve` | <Documented /> | Fires when the plugins load (not on each draw), once for each surface, component, and plugin. `e` names the surface and component, never the props. | Input `ResolveInput`. Result `ElementTable`: the element table of the surface. A hook may restyle an element or leave one out. | `on('ui.resolve', ...)`. Also `$.ui.resolve(...)`. |
| `ui.press` | <Documented /> | Fires when a `Button` that a render hook drew is pressed on a surface. `e` is `{ plugin, element, component, surface }`. `element` is the button's `key`. Set a `key` on buttons that share a label: until 2.1.304 a click was lost when same-label buttons with no `key` were redrawn unchanged. | Input `UiPressArgument`. Result `{ element }`. `next(e)` lets the press through. Returning `{ element }` takes it. | `on('ui.press', ...)`. |
| `ui.input` | <Documented /> | Fires when an `Input` that a render hook drew changes or the person submits it. `e` is `{ plugin, element, component, surface, kind, value }`. | Input `UiInputArgument`. Result `{ element, value }`. `next({ ...e, value })` rewrites the typing. | `on('ui.input', ...)`. |
| `ui.select` | <Documented /> | Fires when the person picks from a `Select` that a render hook drew. `e` is `{ plugin, element, component, surface, value }`. | Input `UiSelectArgument`. Result `{ element, value }`. `next({ ...e, value })` rewrites the pick. | `on('ui.select', ...)`. |
| `ui.message` | <Documented /> | Fires when a `Client` that this plugin drew posts from its surface module (`surface.post(data)`). Only this plugin's hooks see it. | Input `UiMessageArgument`. Result `{ props? }`. `next({ ...e, data })` rewrites the data. One call for each instance in each frame. | `on('ui.message', ...)`. |
| `ui.fault` | <Documented /> | Fires when a `Client` that this plugin drew failed on a surface. Its module did not load, its drawing failed, or its code failed after it drew. | Input `UiFaultInput`. Result `{}`. Only this plugin's hooks see it. `e.phase` says when and `e.reason` says why. | `on('ui.fault', ...)`. |
| `ui.scroll` | <Documented /> | Fires before the window of a site moves: the person's wheel or scroll keys on a `Pane` body or the `AbovePrompt` band (at its edges too), or `$.ui.scroll`. | Input `UiScrollInput`. Result `{}` or `{ deny }`. `next({ ...e, offset })` scrolls elsewhere. | `on('ui.scroll', ...)`. Also `$.ui.scroll(...)`. |
| `ui.focus` | <Documented /> | Fires before the focus ring of a site moves: the person's Tab, arrows, or click in a `Pane` or the band, an `autoFocus` element taking it, or `$.ui.focus`. | Input `UiFocusInput`. Result `{}` or `{ deny }`. `next({ ...e, element })` moves the focus to another element. | `on('ui.focus', ...)`. Also `$.ui.focus(...)`. |

## Events Raised by UI Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `ui.toast` | <Documented /> | `$.ui.toast(text, { timeoutMs })` | Input `{ text: string, timeoutMs?: number }`. Value `void`. |
| `ui.status` | <Documented /> | `$.ui.status(text)`. `text` undefined clears the line. | Input `{ text: string \| undefined }`. Value `void`. |
| `ui.log` | <Documented /> | `$.ui.log(text, { to })`. `to` is always present. `next({ ...e, to: "debug" })` keeps a line off screen. | Input `{ text: string, to: UiLogSink }`. Value `void`. |
| `ui.notice` | <Documented /> | `$.ui.notice(tool_use_id, text)` | Input `{ tool_use_id: string, text: string \| undefined }`. Value `void`. |
| `ui.invalidate` | <Documented /> | `$.ui.invalidate(event)` | Input `{ event: InvalidatableEventName }`. Value `void`. |
| `ui.open` | <Documented /> | `$.ui.open({ id, title, focus })`. A hook above may retitle it or refuse with `{ deny }`, never rename it. | Input `PaneOpenArgs`. Value `UiOpenResult`. |
| `ui.close` | <Documented /> | `$.ui.close({ id })` with `origin` `plugin`. The engine raises it too, for the person (`person`) and for an unload (`unload`). | Input `PaneCloseInput`. Value `void`. |
| `ui.panes` | <Documented /> | `$.ui.panes()` | Input `NoArgs`. Value `readonly UiPane[]`. |
| `ui.place` | <Undocumented /> | `$.ui.place({ id })` | Input `UiPlaceArgs`. Value `UiPlaceResult`. New in `2.1.314`. |
| `theme.set` | <Undocumented /> | `$.theme.set({ backdrop })` | Input `ThemeSetArgs`. Value `ThemeResult`. New in `2.1.319`. Case: `print.cli319.theme.engine`. |
| `theme.clear` | <Undocumented /> | `$.theme.clear()` | Input `NoArgs`. Value `ThemeResult`. New in `2.1.319`. Case: `print.cli319.theme.engine`. |
| `ui.selection` | <Documented /> | `$.ui.selection()` | Input `NoArgs`. Value `UiSelection \| undefined`. |
| `ui.copy` | <Documented /> | `$.ui.copy({ text, surface })`. `surface` takes the session's first surface when left out. | Input `UiCopyArgs`. Value `UiCopyResult`. |
| `ui.view` | <Undocumented /> | `$.ui.view({ agentId })`: whose transcript the main view shows. None means the main conversation. | Input `SiteView`. Value `UiViewResult`. |
| `ui.notify` | <Documented /> | `$.ui.notify(text, { title })`. `title` is the plugin's name when left out. Two mods that notify again on hearing a notification can echo each other without end. | Input `{ text: string, title?: string, key?: string, delayMs?: number, at?: number, untilBack?: boolean }`. Value `UiNotifyResult`. `key`, `delayMs`, `at`, and `untilBack` are new in `2.1.321`; see [`NotifyOptions`](../types/ui/input-pane-render.md#notifyoptions). |
| `ui.cancelNotify` | <Undocumented /> | `$.ui.cancelNotify(key)` | Input `{ key: string }`. Value `{ isSent: boolean }`. New in `2.1.321`. Read site: `chunk-ne1755n5.js:4379223`. |
| `ui.blit` | <Documented /> | `$.ui.blit(...)`: the `cells` of a `Raster` or the `source` of a keyed `Image`. A hook above may rewrite either, or `{ deny }`. | Input `UiBlitArgs`. Value `UiBlitResult`. |

## Related Pages

- [Mod API Overview](../index.md)
- [UI Methods](ui.md)
- [Surfaces, Elements, and Render Sites](ui-elements.md)
- [UI Types](../types/ui/index.md) (input and result types)
