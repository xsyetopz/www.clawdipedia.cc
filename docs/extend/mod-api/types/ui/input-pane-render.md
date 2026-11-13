---
title: UI Input, Pane, and Render Types
description: "Types of Input, Link, Markdown, notify options, panes, Raster, and the render element and viewport."
sidebar_position: 2
---

## Types with Fields

Each type below has its own table of fields.

### `InputProps`

The props of `Input`, the text field of every surface. It has an address, optional texts, and the closures that a change and a submit run. A leaf. One line, or several with `rows`. While it has focus every printable key reaches it, and Esc returns them. A change and Enter raise `ui.input`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element: `e.element` at `ui.input`, what a matcher names. | Type: `string`. |
| `label` | <Documented /> | Text drawn before the field. | Type: `string`. Optional. |
| `placeholder` | <Documented /> | Text drawn dim in an empty field. | Type: `string`. Optional. |
| `value` | <Documented /> | The text that the field holds when drawn. The typing of the person replaces it until the hook draws another. | Type: `string`. Optional. |
| `submitLabel` | <Documented /> | What Enter does, in a word or two, drawn beside the field while it has focus (`send`). Defaults to `submit`. | Type: `string`. Optional. |
| `rows` | <Documented /> | How many lines tall the field is: a whole number of at least 1. From 2 it holds several lines, as the `<textarea rows>` of the DOM. Defaults to 1. | Type: `number`. Optional. Drawn this tall. A longer text scrolls inside. Enter submits. Up and Down walk its rows, then go to the next element. |
| `autoFocus` | <Documented /> | The focus ring of the site starts here when the site takes the keyboard, instead of on nothing, as the `autofocus` of the DOM. Enter acts on it at once. | Type: `true`. Optional. A pane opened with `focus` takes it. Of several in one site, the first drawn wins. A ring that the person has moved stays where it is. |
| `onInput` | <Documented /> | Runs on every change of the text, in the own environment of the plugin: the bottom of a `ui.input` chain of kind `change`. | Type: `(value: string, e: UiInputArgument) => void`. Optional. The text is whole, with its lines joined by `\n`. |
| `onSubmit` | <Documented /> | Runs on Enter with the text, in the own environment of the plugin: the bottom of a `ui.input` chain of kind `submit`. No model turn unless it asks one. | Type: `(value: string, e: UiInputArgument) => void`. The text is whole, with newlines kept and nothing trimmed. |

### `LinkProps`

The props of `Link`, a hyperlink that every surface draws. It is an OSC 8 span on the terminal (else its text, then the URL in dim) and an anchor on desktop. It is an inline element. Its children are the text. With no children, the `label` is the text. With neither, the URL is the text.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `href` | <Documented /> | Where the link goes, as written: any scheme, host and port, at most 2048 characters once the engine percent-encodes what a terminal acts on. | Type: `string`. A blank value draws plain text. On a remote surface only an `https:` URL is a link. A click opens what the surface opens. |
| `label` | <Documented /> | The text drawn when the element has no children. If both are absent, the URL itself is the text. | Type: `string`. Optional. |

### `MarkdownLeafProps`

What a `Markdown` carries across the boundary: its address, text, dimness and which links it answers. `onLinkPress` stays behind, and a `press` goes instead.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element: what `e.element` carries and what a matcher names. Present whenever the element carries a `press`. | Type: `string`. Optional. |
| `text` | <Documented /> | The markdown drawn, checked as the string of a Text is. | Type: `string`. |
| `dimColor` | <Documented /> | The whole block dim, as the `dimColor` of `Text`. If absent, it draws as false. | Type: `boolean`. Optional. |
| `pressableLinks` | <Documented /> | Which links a press belongs to, by `href` as written. If absent, with a `press`, every link drawn. The engine compares it with the pressed target only. | Type: `readonly string[]`. Optional. |

### `MarkdownProps`

The props of `Markdown`, a block of markdown that every surface draws as it draws the text of an assistant reply. It has its own renderer, links, tables, fences. A leaf with no children. With `onLinkPress` a press on a link raises `ui.press` addressed to `key`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element: `e.element` at `ui.press`, what a matcher names. Required with `onLinkPress`, because a press needs one. Else optional. | Type: `string`. Optional. |
| `text` | <Documented /> | The markdown drawn, as an assistant reply would write it. A `<context>` block, hidden in the own text of a reply, is drawn here as written. | Type: `string`. One drawing draws 100000 characters in all. A link that is not `https:`, `http:`, or `file:` draws as text. |
| `dimColor` | <Documented /> | The whole block dim, as the `dimColor` of `Text`: a thought, an aside. | Type: `boolean`. Optional. |
| `onLinkPress` | <Documented /> | What a press on a link in `text` runs, in the own environment of the plugin: the bottom of a `ui.press` chain whose `e.link` names the link. | Type: `(link: PressedLink, e: UiPressArgument) => void`. Optional. Called on a plain single click where the surface reports clicks. Ctrl, alt, or cmd click opens the link as before. |
| `pressableLinks` | <Documented /> | Which links in `text` a press belongs to, by `href` as the markdown writes it. If absent, every link drawn. Only with `onLinkPress`. | Type: `readonly string[]`. Optional. A link left out keeps the own behavior of the surface. At most 256 entries of at most 2048 characters. |

### `NotifyOptions`

Options of `$.ui.notify`. Used by `$.ui.notify`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `title` | <Documented /> | What heads the notification, sent as the mod gives it. The engine puts no name of its own beside it. If left out or empty, the name of the plugin. | Type: `string`. Optional. |
| `key` | <Undocumented /> | A name for this notification. A new notification with the same key from the same plugin replaces the last one. `$.ui.cancelNotify(key)` takes it back. If left out, each call is its own notification. | Type: `string`. Optional. 1 to 64 characters, with no hidden characters or stray spaces, and not a name that every object has, such as `constructor`. Since `2.1.321`. |
| `delayMs` | <Undocumented /> | How long to wait before the notification shows. The client holds it, so it can show after the session ends. | Type: `number`. Optional. A whole number from 0 to 604800000 (7 days). Do not give it with `at`. Since `2.1.321`. |
| `at` | <Undocumented /> | The clock time to show the notification. | Type: `number`. Optional. Epoch milliseconds, a whole number from 0 to 7 days from now. Do not give it with `delayMs`. Since `2.1.321`. |
| `untilBack` | <Undocumented /> | With `delayMs` or `at`: the client drops the notification if the person comes back to the session before it shows. | Type: `boolean`. Optional. Since `2.1.321`. |

The engine sends `key`, `delayMs`, `at`, and `untilBack` to the client in the `ui_notify` stream message, as `key`, `delay_ms`, `at`, and `until_back`. In the program, only that message reads the timing fields; the terminal notification channels do not. A bad option makes the call fail with one of these texts:

- `key is a string of 1 to 64 characters, with no hidden characters or stray spaces, and not a name every object has, such as constructor`
- `give delayMs or at, not both. Each is a whole number of 0 or more: delayMs in milliseconds, up to 7 days, and at in epoch milliseconds, up to 7 days from now`
- `untilBack is a boolean, when given`

Read sites: the checks `chunk-2x9ma4k7.js:4543213` (`HEs`), the call `chunk-s82q53mp.js:285501`, and the `ui_notify` message `chunk-h3xwema8.js:551765`.

### `OnScreen`

The part of a transcript message that is on the screen of the surface that drew it. It is units `first` to `last` of the `of` of the message, counted from its start. It says which rows of a site are on screen. The terminal counts rows. Other surfaces use their own unit, so compare `first / of` there.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `first` | <Documented /> | The unit inside the viewport, from 0. On the terminal, it is `7` when the top seven rows of the message are scrolled away. | Type: `number`. |
| `last` | <Documented /> | The unit inside the viewport, inclusive, at least `first`. | Type: `number`. |
| `of` | <Documented /> | The whole extent of the message in the same unit, as laid out (a hook tree taller than the engine tree counts its own rows). It is more than `last`. | Type: `number`. The numbers of one surface say nothing of another. What the phone displays the terminal may not. Each `ui.render` carries the numbers of its own surface. |

### `PaneCloseInput`

The input of `ui.close`: the pane that closes and why (PaneCloseOrigin). Closing an id that is not open does nothing. Used by `ui.close`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | What `$.ui.open` named the pane. Pinned: `next(e)` passes it on. | Type: `string`. |
| `origin` | <Documented /> | Who closes it. The engine sets it. A hook that answers without `next` keeps the pane open on `plugin` and `person`, never on `unload`. | Type: `PaneCloseOrigin`. |

### `PaneCloseOrigin`

Why a pane closes, as the engine stamped it at `ui.close`. `unload` drops a pane that nothing draws any more, before the hooks hear of it. `next(e)` passes the origin on as received.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | `plugin` is the `$.ui.close` of a plugin. `person` is the close mark or close key of the person. `unload` is the engine itself. | Type: `'plugin' \| 'person' \| 'unload'`. |

### `PaneOpenArgs`

The argument of `$.ui.open`. It has which pane, its title, whether it asks for the keyboard of the person, its dialog manners, and its size (rows, columns), and its seat. An open that answers the input of the person is placed at any width. An open that the plugin makes alone waits below 144 columns. Used by `$.ui.open`, `ui.open`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | Names the pane: 1-64 of letters, digits, `_` and `-`. One pane for each id. Opening an open id delivers the new title, never a second instance. | Type: `string`. Pinned at the hooks: `next(e)` passes it on. The title and focus rewrite. |
| `title` | <Documented /> | The tab of the pane while more than one pane is open (with one, no title is drawn), and the `title` that its hook sees. It is the id when omitted. | Type: `string`. Optional. An unpaired surrogate half (a `.slice()` through an emoji) is drawn as U+FFFD. The engine refuses a control character. |
| `focus` | <Documented /> | A request, not a grant. The surface focuses (and raises) the pane only while the prompt has the keys over an empty composer. | Type: `true`. Optional. An element of the band, a pane that the person holds, text in the composer, a dialog or a survey each refuse it. The pane opens without the keyboard. |
| `closeOnEscape` | <Documented /> | While the pane holds the keyboard, the key that hands it back (Escape) also closes it, as the close of the person does: `ui.close`, origin `person`. | Type: `true`. Optional. Escape at an idle, empty prompt closes the pane. A hook may refuse the close. Each open sets it anew. |
| `holdToasts` | <Documented /> | While the pane is the one displayed, the surface holds every transient toast. That includes the `$.ui.toast` of each other plugin, the own toasts of the engine, and those of this plugin. | Type: `true`. Optional. Toasts wait while the pane is open. Use it for a dialog that the person answers and leaves. Each open sets it anew. |
| `backgroundColor` | <Documented /> | What the surface paints under the pane's body while it is the one shown, as a Box takes it: a theme key, a raw color, or `"transparent"`. | Type: `Color`. Optional. `"transparent"` paints nothing, so what lies behind the pane shows through. A color stops at the body. Left out, the surface's own look stands. Anything else is refused. Each open sets it anew, and a `ui.open` hook may drop it. A request, not a grant: a surface with no counterpart for a theme key keeps its own look. Since `2.1.311`. |
| `rows` | <Documented /> | The body rows that the content of the pane wants while seated inline above the prompt. It opens that tall, up to what the layout spares, not a third. | Type: `number`. Optional. A request, not a grant. A size that the person dragged wins. The dock ignores it. A positive whole number. |
| `columns` | <Documented /> | The body columns the pane's content wants while docked beside a fullscreen transcript: the dock opens that wide, at most 45% of the terminal's columns and at least 24. Each open sets it anew. | Type: `number`. Optional. A request, not a grant. A width the person dragged or keyed wins, under the same ceiling. Since `2.1.305` the dock stays within 45% of the terminal's width, also for a requested or chosen width and a width kept from a wider terminal, with a floor of 24 columns. The cap is also at most the terminal's width minus 60 columns. The dock is hidden below 110 columns, so the floor and the cap never clash (the program; [v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). The inline block ignores it. A positive whole number. |
| `placement` | <Documented /> | Asks that the pane start as a `"widget"`, the small form of a minimized pane on the desktop app. Drawn so, its `Pane` props say `placement: "widget"`. | Type: `'widget'`. Optional. A request: the surface decides, and the person can expand or minimize the pane afterwards. A surface with no widgets (the terminal, VS Code, a desktop app without them) opens the pane as if this were left out. Any other value is ignored. Each open sets it anew, but a surface is meant to read it only when it first shows the pane. A `ui.open` hook may set or drop it. Since `2.1.323` (`schemas/claude-code.d.ts`; the program, `chunk-h3xwema8.js:556803`). |

### `PressedLink`

The link that a press landed on. It is one that a `Markdown` drew, pressed where the surface reports presses (a plain click in the fullscreen terminal). It holds what the surface knows of the cell pressed, not which occurrence. Two links written with one target read the same here.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `href` | <Documented /> | The target of the link as the surface drew it. For an `https:` link, it is the href as the markdown wrote it. | Type: `string`. |

### `ProgressProps`

The props of `Progress`, how far along a task is. A leaf: no children. Use it for a task moving toward done. For a level that is not heading anywhere, such as usage against a limit, draw a bar of Boxes instead. The `ToolProgress` render site is unrelated. New in `2.1.323` (`schemas/claude-code.d.ts`; the program builds it in `chunk-s82q53mp.js:21347`).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `label` | <Documented /> | What is being done. It is drawn and read out by a screen reader. | Type: `string`. Not blank. |
| `value` | <Documented /> | How far along the task is, from 0 to `max`. | Type: `number`. Optional. Absent or not finite, the task is running with no known end. Past either end it draws as that end. |
| `max` | <Documented /> | Where `value` ends. | Type: `number`. Optional. Absent, 1. Zero or less, or not finite, makes no fraction, so the task draws as running. |
| `valueText` | <Documented /> | The figure as a person reads it, such as `412 of 900`. | Type: `string`. Optional. Absent, a surface draws the whole percent, or says the task is running. |
| `color` | <Documented /> | The fill, as the `backgroundColor` of a Box takes it. | Type: `Color`. Optional. Absent, the surface's own. |

### `RasterBlitArgs`

A `$.ui.blit` argument that repaints one of the mounted Rasters of the caller. `columns` and `rows`, when given, must be the mounted size. A resize is a redraw (`$.ui.invalidate("ui.render")`), not a blit.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `requestId` | <Documented /> | The site that the Raster is drawn in, by the `requestId` that this plugin draws it under. It is the id of one of its panes, the `tool_use_id` of a tool row, or the id of the band. | Type: `string`. |
| `key` | <Documented /> | The `key` of the Raster in that drawing. | Type: `string`. |
| `cells` | <Documented /> | The new cells, encoded as the `cells` of the element are (RasterProps), for the mounted `columns \* rows`. | Type: `string`. |
| `columns` | <Documented /> | The width that the cells are laid out for. The engine refuses it unless it is the width of the mounted Raster. If absent, the mounted width. | Type: `number`. Optional. |
| `rows` | <Documented /> | The height that the cells are laid out for. The engine refuses it unless it is the height of the mounted Raster. If absent, the mounted height. | Type: `number`. Optional. |

### `RasterProps`

The props of `Raster`, the cell-grid leaf of the terminal surface. It is a fixed box of cells, each a glyph, a foreground and a background, packed in `cells`. A leaf with no children, `hover`, or `onPress`. `$.ui.blit` repaints it in place. Terminal only. The palette holds 1024 color pairs.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element within the drawing: what `$.ui.blit` names to repaint it. Unique among the Rasters of one tree. | Type: `string`. |
| `columns` | <Documented /> | How many terminal columns wide, 1 to 512. The site clips what its body cannot show. | Type: `number`. |
| `rows` | <Documented /> | How many terminal rows tall, 1 to 256. | Type: `number`. |
| `cells` | <Documented /> | Every cell, row-major: standard padded base64 of `columns \* rows` little-endian u32 triplets `[codePoint, foreground, background]`. | Type: `string`. Each cell is a code point plus colors. A code point is one printable width-1 BMP character. A color is `0x00RRGGBB`, or `0x01000000` for the terminal default. |

### `RenderElement`

What a render hook returns, and what `next(e)` resolves to: a plain-data tree of elements (a Box or Text is a StyledElement), with strings as children. Union of the element types. Props are an allowed subset of the Ink `Box` and `Text` props. A tree with any other prop fails as a whole. Used by `ui.render`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | A button, on every surface: `[ label ]` on the terminal, a native button on a desktop. A press raises `ui.press` (`e.element` is the key). | Type: `'Button'`. Built by `<Button>`. The `onPress` closure stays in the own environment of the plugin under `press.handle`. |
| `props` | <Documented /> | The props of the element, typed `object`. | Type: `object`. |
| `press` | <Documented /> | Where the handler lives: the plugin whose hook drew the element, and the handle that its environment keeps the `onPress` closure under. | Type: `object`. The runtime stamps the plugin as the tree leaves that hook. |
| `hover` | <Documented /> | Label style overrides (the Text set). The surface applies them while the nearest keyed Box, or the group that `scope` names, is hovered. Plain data. | Type: `TextHoverProps`. Optional. |
| `children` | <Documented /> | What is drawn in the place of the label, all of it one pressable: strings and `Text` (a chip, a dim part). The engine refuses any other element. | Type: `RenderNode[]`. Optional. Absent for a Button of a label alone, drawn as it always was. |
| `type` | <Documented /> | A text field on every surface, of one line or of `rows`. A change and Enter raise `ui.input` (`e.element`, `e.kind`, and `e.value` as the text). | Type: `'Input'`. Built by `<Input>`. The `onInput` and `onSubmit` closures stay in the environment of the plugin. A leaf with no children. |
| `props` | <Documented /> | The props of the element, typed `object`. | Type: `object`. |
| `press` | <Documented /> | Where the handlers live: the plugin whose hook drew the element, and the handle that its environment keeps the closures under. | Type: `object`. The runtime stamps the plugin as the tree leaves that hook. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A one-of-several picker on every surface. A pick raises `ui.select` (`e.element` is the key, `e.value` is the value of the option). | Type: `'Select'`. Built by `<Select>` or the table's `t.Select`. The `onSelect` closure stays in the own environment of the plugin under `press.handle`, held as the closure of a Button is. A leaf: no children. |
| `props` | <Documented /> | The props of the element, typed `object`. | Type: `object`. |
| `press` | <Documented /> | Where the handler lives: the plugin whose hook drew the element, and the handle that its environment keeps the closure under. | Type: `object`. The runtime stamps the plugin as the tree leaves that hook. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A hyperlink that every surface draws. It is an OSC 8 span on the terminal (its text, then the URL in dim where unsupported) and an anchor on desktop. | Type: `'Link'`. Inline. Its children are the text: strings and inline elements. With absent children, the label is the text. With both absent, the URL is the text. `href` is drawn as written. If it is no string, the text draws plain. |
| `props` | <Documented /> | The props of the element, typed `LinkProps`. | Type: `LinkProps`. |
| `children` | <Documented /> | The child nodes. | Type: `RenderNode[]`. Optional. |
| `type` | <Documented /> | Source code that every surface draws with the highlighter of the engine, with tokens coloured by language. Under `format: 'diff'`, unified-diff hunks. | Type: `'Code'`. A leaf. A dim gutter numbers the lines from `startLine`. A diff has two gutters and add and remove backgrounds. |
| `props` | <Documented /> | The props of the element, typed `CodeProps`. | Type: `CodeProps`. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A block of markdown that every surface draws as it draws the text of an assistant reply. It has its own renderer, theme, hyperlinks and highlighting. | Type: `'Markdown'`. Built by `<Markdown>`. A leaf. Without a `press` its links open as the surface opens links. |
| `props` | <Documented /> | The props of the element, typed `MarkdownLeafProps`. | Type: `MarkdownLeafProps`. |
| `part` | <Documented /> | Whose `key` it is: the engine sets it on a keyed element as the tree leaves its hook, as on a Box (new in 2.1.307). | Type: `PluginStamp`. Optional. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A `Markdown` whose plugin answers the links that it drew (`onLinkPress`). A press on one raises `ui.press` with `e.link`, and the surface opens none. | Type: `'Markdown'`. |
| `props` | <Documented /> | The props of the element, typed `MarkdownLeafProps`. | Type: `MarkdownLeafProps`. |
| `press` | <Documented /> | Where the `onLinkPress` handler lives: the plugin whose hook drew the element, and the handle that its environment keeps the closure under. | Type: `object`. The runtime stamps the plugin as the tree leaves that hook. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A region that one of the SURFACE MODULES of the plugin, named by path, draws and handles input for on the drawing thread, without `$` (ClientModule). | Type: `'Client'`. One instance for each plugin. It lives while the node stays in the tree and talks to the plugin through `ui.message`. |
| `props` | <Documented /> | The props of the element, typed `ClientProps`. | Type: `ClientProps`. |
| `client` | <Documented /> | Whose surface module `props.module` names: the plugin whose hook drew the element. The runtime stamps it as the tree leaves it. | Type: `object`. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A vector drawing, for the remote surfaces alone. The SVG markup is the data of the element, drawn in an isolated box, off the page. | Type: `'Svg'`. A leaf. A surface whose table lacks it refuses the tree. Put a press that others should see on an enclosing `Button`. |
| `props` | <Documented /> | The props of the element, typed `SvgProps`. | Type: `SvgProps`. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | How far along a task is, or that it is still running. Hooks above wrap it, replace it, or rewrite its props. | Type: `'Progress'`. A leaf. A mobile client that names it in `draws` is sent this node. Any other client, on any surface, gets its Box and Text. A surface module cannot draw one. Since `2.1.323` (`schemas/claude-code.d.ts`; the program, `chunk-h3xwema8.js:845092`). |
| `props` | <Documented /> | The props of the element, typed `ProgressProps`. | Type: `ProgressProps`. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A grid of terminal cells, for the terminal surface alone. Each cell is a glyph, a foreground and a background, packed in `props.cells`. | Type: `'Raster'`. A leaf, one node however many cells. `$.ui.blit` repaints it in place. A surface whose table lacks it refuses the tree. |
| `props` | <Documented /> | The props of the element, typed `RasterProps`. | Type: `RasterProps`. |
| `raster` | <Documented /> | Whose Raster: the plugin whose hook drew the element. The runtime stamps it as the tree leaves it. It is the one plugin whose blit reaches it. | Type: `object`. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | A picture, for the terminal surface alone. `props.source` is drawn over a box of cells where the terminal can, and `props.alt` where it cannot. | Type: `'Image'`. A leaf. `$.ui.blit` swaps its picture. A surface without it refuses the tree. |
| `props` | <Documented /> | The props of the element, typed `ImageProps`. | Type: `ImageProps`. |
| `image` | <Documented /> | Whose Image: the plugin whose hook drew the element. The runtime stamps it as the tree leaves it. It is the one plugin whose blit reaches it. | Type: `object`. |
| `children` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `type` | <Documented /> | The component that core draws itself, with the props held under `ref`. | Type: `'engine'`. |
| `ref` | <Documented /> | Which drawing: the number that core answered from `next(e)`, under which it holds the props that it received. 0 draws the original props. | Type: `number`. |

### `RenderInputOf`

One `ui.render` input, for a component narrowed to one surface.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where the tree will be drawn, one literal for each member, so `if (e.surface === "terminal")` narrows `e` and `$.ui.resolve(e)`. | Type: `P`. Over the wire it is what the client declared. It is a rendering fact and not a trust signal, so do not key policy on it. |
| `component` | <Documented /> | Which component this instance is, the key a matcher narrows on. | Type: `C`. |
| `requestId` | <Documented /> | The instance: the tool_use_id for a dialog or tool row, the message id for a message, or the agent id for a spinner. | Type: `string`. Two drawings of one component are two instances. |
| `viewport` | <Documented /> | The size that the surface draws into, in character cells, and whether its layout docks a pane. Absent where no surface has measured. | Type: `RenderViewport`. Optional. Part of the envelope, so a rewrite keeps it. A change of width re-draws every hooked site once the resize settles. |
| `plugin` | <Documented /> | Whose this drawing is, where it is one plugin's: the plugin an `AbovePrompt` row is asked of, the plugin that opened a `Pane`. It is a default matcher key: a hook that leaves it out hears the drawings of its own plugin only here. A hook that names it is read as written, `{ plugin: "*" }` for all. | Type: `string`. Optional. Pinned: a rewrite carries it on as received. Since `2.1.323` (`schemas/claude-code.d.ts`; the program, `chunk-s82q53mp.js:76755`). |
| `props` | <Documented /> | The plain-data props of the component. | Type: `RenderPropsOf[C]`. |

### `RenderResultOf`

What a `ui.render` hook returns and what `next(e)` resolves to: a RenderElement tree, the same for every component.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[C in RenderComponent]` | <Documented /> | For each component, a `RenderElement` tree. | Type: `RenderElement`. |

### `RenderViewport`

The size that a surface draws into, in character cells of the monospace metric of the surface, and whether its layout docks a pane. On the terminal it is the columns and rows of the conversation. On a remote surface it is the pane size.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `columns` | <Documented /> | Cells across. A tree wider than this wraps or truncates, as its Text props say. | Type: `number`. |
| `rows` | <Documented /> | Cells down the whole surface, not the room left for this component. | Type: `number`. Informational. A change of height alone re-draws nothing and keys no new evaluation, so a hook reads it as of the last width or props change. |
| `isFullscreen` | <Documented /> | Whether this surface docks a pane beside the transcript, so a pane that a plugin opens unasked is a sidebar, not a takeover. Absent means unknown. | Type: `boolean`. Optional. The terminal always says it: `true` is fullscreen. A remote surface reports it with its size. A change re-draws. |

## Related Pages

- [UI Types](index.md)
- [Mod API Types](../index.md)
