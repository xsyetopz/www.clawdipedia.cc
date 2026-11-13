---
title: UI Select, Text, and Focus Types
description: "Types of resolve inputs, Select, Svg, Text, toasts, blit and copy results, fault inputs, and focus arguments."
sidebar_position: 3
---

## Types with Fields

Each type below has its own table of fields.

### `ResolveInputOf`

One `ui.resolve` input, for a component on one surface.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where the table draws, one literal for each member, so a hook that narrows it narrows the table that `next(e)` resolves to. | Type: `P`. |
| `component` | <Documented /> | Which drawing the table is resolved for, and the key that a matcher narrows on. | Type: `C`. |

### `SelectOption`

One option of a `Select`. It has the value that `onSelect` and `ui.select` carry, and the text drawn for it (the value when absent).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `value` | <Documented /> | The value that `onSelect` and `ui.select` carry. | Type: `string`. |
| `label` | <Documented /> | The text drawn for the option. The value when absent. | Type: `string`. Optional. |

### `SelectProps`

The props of `Select`, the one-of-several picker of every surface. It has an address, a label, the options, the one selected, and the closure that a pick runs. A leaf. Arrows move, Enter picks, and Esc returns to the prompt. A pick raises `ui.select`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element: `e.element` at `ui.select`, what a matcher names. | Type: `string`. |
| `label` | <Documented /> | Text drawn before the current value. | Type: `string`. Optional. |
| `options` | <Documented /> | What the person can pick, in the order drawn. At least one, with unique values. | Type: `readonly SelectOption[]`. |
| `value` | <Documented /> | Which option is selected when drawn. The pick of the person replaces it until the hook draws another. | Type: `string`. Optional. |
| `autoFocus` | <Documented /> | The focus ring of the site starts here when the site takes the keyboard, instead of on nothing, as the `autofocus` of the DOM. Enter acts on it at once. | Type: `true`. Optional. A pane opened with `focus` takes it. Of several in one site, the first drawn wins. A ring that the person has moved stays where it is. |
| `onSelect` | <Documented /> | Runs on a pick with the value of the option, in the own environment of the plugin: the bottom of a `ui.select` chain. No model turn unless it asks one. | Type: `(value: string, e: UiSelectArgument) => void`. |

### `SiteScroll`

Where the window of a site sits over the tree that a hook drew in it (the body of a pane, the band). The engine moves it (the person scrolls). The plugin reads it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `offset` | <Documented /> | The first row of the tree that the window displayed when the hook was asked, 0 at the top. Read-only. | Type: `number`. A move through `ui.scroll` asks again. The own moves of the engine on the terminal do not. The next ask reads where the window stands. |
| `bodyRows` | <Documented /> | How many rows of the tree the window may display at once. They are the rows that the surface gave the body, whatever the height of the tree. Read-only. | Type: `number`. |

### `SiteView`

Which transcript the person has on screen where a site draws: the main conversation, or one agent, opened from the tasks list. A site reads it. A switch re-runs the hooks of the site. `$.ui.view` takes the same shape. Used by `$.ui.view`, `ui.view`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `agentId` | <Documented /> | The agent whose transcript is in view: the `id` that `$.agent.list()` gives it, and the `agentId` that its `turn.step` and `tool.call` events carry. | Type: `string`. Optional. Absent while the main conversation is in view. Read-only on a site. |

### `StyledElement`

The shape that a `Box` and a `Text` share in a render tree. It has allowlisted props, an optional `hover`, the group stamp that a `hover.scope` earns, the mark of the plugin whose drawing starts there, and children. `Tag` says if it is a `Box` or a `Text`. `Hover` holds the hover props. Every surface draws both.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | Which of the two it is: `Box` or `Text`. | Type: `Tag`. |
| `props` | <Documented /> | For a Box: its layout, position, spacing and border props and the `key` that makes it a hover scope. For a Text: its colors and styles. The engine refuses others. | Type: `Record<string, string \| number \| boolean>`. Optional. |
| `hover` | <Documented /> | Style overrides. The surface applies them while the pointer is over the nearest keyed Box, or over any member of the group that `scope` names. | Type: `Hover`. Optional. Plain data, no hook. It never moves a sibling. `display` only reveals a `Box` that is drawn as `"none"`. |
| `group` | <Documented /> | Whose group `hover.scope` names. Absent without a `scope`. | Type: `PluginStamp`. Optional. |
| `part` | <Documented /> | Says whose part of the drawing starts here. The engine sets it on the returned root of each hook. It proves no author. | Type: `PluginStamp`. Optional. |
| `children` | <Documented /> | In order. A Box holds elements and strings (core wraps each string in a Text). A Text holds strings and inline elements, never an engine node. | Type: `RenderNode[]`. Optional. |

### `SvgProps`

The props of `Svg`, the vector leaf of the remote surfaces. The markup is the data of the element, as a string is the data of a Text, and it is drawn isolated. A leaf with no children. The engine bounds the markup. The surface never lets it reach the page.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `source` | <Documented /> | The SVG document, `<svg ...>...</svg>`, at most 131072 characters. | Type: `string`. |
| `alt` | <Documented /> | What the drawing says, for a reader that cannot see it. Required, because a surface without the element draws nothing else of it. | Type: `string`. |
| `width` | <Documented /> | CSS pixels. If absent, the box takes the own width of the markup up to the slot. | Type: `number`. Optional. |
| `height` | <Documented /> | CSS pixels. If absent, the own height of the markup at the drawn width. | Type: `number`. Optional. |
| `isInteractive` | <Documented /> | `true` draws the SVG in a script-less sandboxed frame so hover, CSS `:hover`, SMIL animation and `<title>` tooltips work. If absent, an image. | Type: `boolean`. Optional. It never enables script or event-handler attributes. Put presses on an enclosing element. New in `2.1.314`: the editor ignores it and always draws an image. SMIL and CSS animation can run there, but hover, CSS `:hover`, and `<title>` tooltips never work. |

### `TextHoverProps`

The `Text` props that a `hover` may override (its colors and styles, not its wrapping) and `scope`, the hover group that it joins. The label of a `Button` has them too.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `scope` | <Documented /> | Names a hover group of this plugin. Every element that it draws with the same `scope`, in any site on the surface, lights while any is hovered. | Type: `string`. Optional. A scope is 1 to 64 characters with no control characters. The elements of other plugins with the same string are a different group. |
| `color` | <Documented /> | The text color. | Type: `Color`. Optional. |
| `backgroundColor` | <Documented /> | The background color. | Type: `Color`. Optional. |
| `dimColor` | <Documented /> | `true` dims the color. | Type: `boolean`. Optional. |
| `bold` | <Documented /> | `true` makes the text bold. | Type: `boolean`. Optional. |
| `italic` | <Documented /> | `true` makes the text italic. | Type: `boolean`. Optional. |
| `underline` | <Documented /> | `true` underlines the text. | Type: `boolean`. Optional. |
| `strikethrough` | <Documented /> | `true` strikes the text through. | Type: `boolean`. Optional. |
| `inverse` | <Documented /> | `true` swaps the text and background colors. | Type: `boolean`. Optional. |

### `TextProps`

The props of `Text`: colors, styles, and the size, weight, face and digits that each surface draws its own way. Colors are a theme key or a raw color.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `hover` | <Documented /> | Style overrides. The surface applies them while the pointer is over the nearest enclosing keyed `Box`, or, given a `scope`, over its group. | Type: `TextHoverProps`. Optional. No hook runs and nothing crosses to the plugin. The engine refuses it outside a keyed Box unless it names a `scope`. |
| `color` | <Documented /> | The text color. | Type: `Color`. Optional. |
| `backgroundColor` | <Documented /> | The background color. | Type: `Color`. Optional. |
| `dimColor` | <Documented /> | The run dimmed. On the terminal, it is drawn in the dim color of the theme. | Type: `boolean`. Optional. Faint too where that color is the own white or black of the palette, as plain text is. It is not faint if the run is bold, inverse or on a background of any other color. |
| `size` | <Documented /> | The text size, a step on a scale that each surface maps to its own type sizes. | Type: `'caption' \| 'footnote' \| 'body' \| 'heading' \| 'title'`. Optional. If absent, the size of the enclosing Text, or `body`. The terminal has one size and ignores it. |
| `weight` | <Documented /> | How heavy the text is, drawn at the nearest weight that the surface has. | Type: `'regular' \| 'medium' \| 'semibold' \| 'bold'`. Optional. If absent, the weight of the enclosing Text. The terminal draws `semibold` and `bold` as bold and cannot draw a lighter weight inside a bold Text. |
| `mono` | <Documented /> | The monospaced face of the surface at the same size. The terminal is always monospaced and ignores it. | Type: `boolean`. Optional. |
| `tabular` | <Documented /> | Digits of one width. Use them for a number that changes by itself on screen (a timer, a percentage), or for numbers stacked in a column to line up. | Type: `boolean`. Optional. The digits of the terminal are already one cell each. |
| `bold` | <Documented /> <Deprecated note="Use weight" /> | The older spelling of a semibold weight. | Type: `boolean`. Optional. Deprecated: Use `weight`. The engine reads `bold: true` as `weight: 'semibold'`, and an explicit `weight` outranks it. The `bold` of a `hover` still applies. |
| `italic` | <Documented /> | `true` makes the text italic. | Type: `boolean`. Optional. |
| `underline` | <Documented /> | `true` underlines the text. | Type: `boolean`. Optional. |
| `strikethrough` | <Documented /> | `true` strikes the text through. | Type: `boolean`. Optional. |
| `inverse` | <Documented /> | `true` swaps the text and background colors. | Type: `boolean`. Optional. |
| `dir` | <Documented /> | The direction that the text reads in. Use `rtl` for a right-to-left script, so a row of it that opens with a Latin word or a number reads right to left. | Type: `'ltr' \| 'rtl'`. Optional. When absent, each row reads by its first strong letter. `rtl` rows are flush right. |
| `wrap` | <Documented /> | How text that is too long is wrapped or cut. | Type: `'wrap' \| 'end' \| 'middle' \| 'truncate' \| 'truncate-start' \| 'truncate-middle' \| 'truncate-end'`. Optional. |

### `ToastOptions`

Options of `$.ui.toast`. Used by `$.ui.toast`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `timeoutMs` | <Documented /> | How long the line stays, in milliseconds. The default is 4000. | Type: `number`. Optional. |

### `ToolGroupCall`

One tool call of a ToolGroup, as `ui.render` sees it under `calls`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The id that `tool.call` carried for this call (`e.tool_use_id` there), so a hook that saw the call finds its row in the group. Read-only. | Type: `string`. Optional. Absent on a desktop host that predates it. |
| `tool` | <Documented /> | Which tool the call ran (`Bash`, `Read`, `Grep`, ...). | Type: `string`. |
| `input` | <Documented /> | The input of the call, as the model sent it. | Type: `unknown`. |
| `isRunning` | <Documented /> | True while the call is still running. | Type: `boolean`. |
| `isErrored` | <Documented /> | True when the call ended in an error. | Type: `boolean`. |
| `isInterrupted` | <Documented /> | True when an abort ended the call, as on `ToolUse`. | Type: `boolean`. |
| `output` | <Documented /> | As on `ToolUse`, undefined while the call runs. | Type: `unknown`. Optional. |

### `UiBlitResult`

What `$.ui.blit` resolves to and what the `{ value }` of a `ui.blit` hook holds. It is `{}` once the cells or source are the next frame, or the reason why not. Used by `$.ui.blit`, `ui.blit`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Absent when the engine took the cells or source, else why not. | Type: `string`. Optional. Says why nothing was drawn: not mounted, wrong size, bad cells or source. With no surface, `no-surface` heads it. |
| `fix` | <Documented /> | With `deny`, a stable code to key on instead of the words of `deny`. | Type: `'tmux-passthrough'`. Optional. New in `2.1.310`. `tmux-passthrough`: tmux 3.3 or later holds back images that the terminal outside it can draw, because `allow-passthrough` or `focus-events` is off. Both must be on. Absent for every other cause. |

### `UiCopyArgs`

The argument of `$.ui.copy` and the input of `ui.copy`: the text, and which clipboard of a surface takes it. The caller chooses. A hook above may rewrite either field, refuse with `{ deny }`, or answer `{ value }`. Used by `$.ui.copy`, `ui.copy`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | What the person pastes afterwards, verbatim: any string, with newlines and all. The copy itself never displays it on screen. | Type: `string`. |
| `surface` | <Documented /> | Which surface to copy on. The caller chooses one that the session draws on. A press, field or message hook passes `e.surface`. | Type: `RenderSurface`. Optional. When left out, the engine uses the first of `$.session.surfaces()`. A matcher can narrow on it. |

### `UiCopyResult`

What `$.ui.copy` resolves to and what the `{ value }` of a `ui.copy` hook holds. It says whether the text reached a clipboard (`isCopied`), else why not. Example: `if (!(await $.ui.copy({ text, surface: e.surface })).isCopied) warn()`. Used by `$.ui.copy`, `ui.copy`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isCopied` | <Documented /> | True: the surface took the text. The clipboard tool of the terminal or its OSC 52 write took it, or the app of a remote surface wrote its own clipboard. | Type: `true`. OSC 52 does not report back. A terminal that drops it, with no tool on the machine (pbcopy, wl-copy, xclip, PowerShell, the buffer of tmux), still reads true. |
| `isCopied` | <Documented /> | False: nothing was copied. | Type: `false`. |
| `reason` | <Documented /> | Why not. It is a closed set: `no-surface`, `no-clipboard` or `refused`. A hook above that answers without copying says `refused`. | Type: `'no-surface' \| 'no-clipboard' \| 'refused'`. `no-surface` means nothing draws. `no-clipboard` means no clipboard tool ran and nothing was written. |

### `UiFaultInput`

The input of `ui.fault`: a `Client` that this plugin drew failed on a surface, addressed by where the instance is drawn. Every key is the word of the engine, pinned. `next(e)` passes them on. A rewrite that leaves one out keeps it. A rewrite that changes one fails the hook. Used by `ui.fault`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where the instance failed: `terminal`, or the remote surface that told the engine (`desktop`). | Type: `RenderSurface`. |
| `component` | <Documented /> | The render component the `Client` was drawn in (`AbovePrompt`, `Pane`, ...). | Type: `RenderComponent`. |
| `requestId` | <Documented /> | The id of the engine for the drawing that the `Client` sits in: the `requestId` that the `ui.render` hook that drew it saw. | Type: `string`. |
| `element` | <Documented /> | The `key` of the `Client`: which instance failed. | Type: `string`. |
| `module` | <Documented /> | The `module` of the `Client`: which surface module ran there, as its path under the folder of the plugin. | Type: `string`. |
| `phase` | <Documented /> | When it failed (UiFaultPhase): loading, drawing, or running after it had drawn. | Type: `UiFaultPhase`. The step that failed. The terminal tries again once with new props or a new size. |
| `reason` | <Documented /> | Why, as the surface said it. It is one line of 1 to 200 characters with no control character in it. The engine cuts a longer one and ends it with an ellipsis. | Type: `string`. Untrusted text. It may quote what the module of the plugin threw. Display or log it. Never act on it. |

### `UiFocusArgs`

What the `$.ui.focus(args)` of a plugin takes. It takes one of its own elements, by the `key` that it drew it under. The element is in one of its sites that holds the keyboard now. The engine resolves it to the focus ring of the site. Then it raises `ui.focus`. A site that holds no keyboard gets `{ deny }`. Used by `$.ui.focus`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `requestId` | <Documented /> | The site, by the `requestId` that this plugin draws it under: the id of one of its panes, or the id of the band. | Type: `string`. |
| `key` | <Documented /> | The `key` of the element: a `Button`, `Input` or `Select` that this plugin drew in that site. Of several under one key, the first in document order. | Type: `string`. The element key. The engine waits a short time for one that the next drawing brings. An element never drawn gets `{ deny }`. |

### `UiFocusInput`

The input of `ui.focus`: the focus ring of a site, about to move. It moves onto one of the elements that a hook drew in it (a `Button`, `Input` or `Select`), or off them. Every key but `element` is pinned. A rewrite that changes a pinned key fails the hook. Used by `ui.focus`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `component` | <Documented /> | Which site: a `Pane` body or the `AbovePrompt` band. | Type: `UiFocusComponent`. |
| `requestId` | <Documented /> | The instance that the `ui.render` hook that draws the site sees: the id of the pane, or the one id of the band. | Type: `string`. |
| `plugin` | <Documented /> | Whose `ui.render` hook drew the element that takes the ring. Absent with `element`. Read-only. | Type: `string`. Optional. Since `2.1.323`, a hook that names no `plugin` hears the elements of its own plugin and the stops of the engine. `{ plugin: "*" }` hears the elements of every plugin (`schemas/claude-code.d.ts`, `UiFocusInput`). |
| `element` | <Documented /> | The `key` of the element that takes the ring, as `ui.press` names it. Absent for one of the own stops of the engine (the close mark of a pane or the tab of another). | Type: `string`. Optional. `next({ ...e, element })` lands it on another element that `plugin` drew in the site instead. For one not drawn there, core answers `{ deny }`. |
| `origin` | <Documented /> | Who moves it (UiFocusOrigin). The engine sets it where the move starts. | Type: `UiFocusOrigin`. |

### `UiFocusOrigin`

Who moves the ring at `ui.focus`, as the engine stamps it where the move starts. It is a closed set that a matcher narrows on. `next(e)` passes it on as received. No hook sets one.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The person, with Tab, the arrows or a click while the site holds the keyboard. | Type: `'person'`. |
| `kind` | <Documented /> | The `$.ui.focus` of a plugin, or its `autoFocus` element that takes the ring as the site takes the keyboard. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the focusing plugin. | Type: `string`. |

### `UiFocusResult`

What a `ui.focus` hook returns, what `next(e)` resolves to, and what `$.ui.focus` hands back: `{}` once the ring moved, or why it did not. It is spelled as `ui.scroll` spells it. Used by `$.ui.focus`, `ui.focus`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Absent when the ring is where the chain left it, else why nothing moved. | Type: `string`. Optional. Says why the focus did not move: a hook kept the ring, the site is not of this plugin, or another move came first. With no surface, `no-surface` heads it. |

## Related Pages

- [UI Types](index.md)
- [Mod API Types](../index.md)
