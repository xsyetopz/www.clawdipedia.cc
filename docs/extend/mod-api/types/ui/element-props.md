---
title: UI Element Props Types
description: "Types of the element props and the client modules: AskOptions, Box, Button, Client, Code, and Image."
sidebar_position: 1
---

## Types with Fields

Each type below has its own table of fields.

### `AskOptions`

Options of `$.ui.ask`. Object with fields `options?`, `header?`, `multiSelect?`. Used by `$.ui.ask`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `options` | <Documented /> | 2-4 option labels. The engine pads fewer than two with Yes/No. Free text is the Other of the dialog. | Type: `readonly string[]`. Optional. |
| `header` | <Documented /> | A short chip beside the question (`Approach`, 12 characters at most). | Type: `string`. Optional. |
| `multiSelect` | <Documented /> | Allow several options. The answer comes back comma-joined. | Type: `true`. Optional. |

### `BoxHoverProps`

The `Box` props that a `hover` may override, none of which moves the siblings of the Box, and `scope`, which names the hover group that the Box joins. The surface applies a hover as the pointer moves. A reveal that keeps moving settles and never loops.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `scope` | <Documented /> | Names a hover group of this plugin. Every element that it draws with the same `scope`, in any site, lights while any is hovered, with reveals included. | Type: `string`. Optional. A `Pane` row and a transcript mark can share one scope. A scope is 1 to 64 characters with no control characters. |
| `borderStyle` | <Documented /> | Restyles a border that the Box has. It adds none. | Type: `string`. Optional. |
| `borderColor` | <Documented /> | The border color. | Type: `Color`. Optional. |
| `borderDimColor` | <Documented /> | `true` dims the border color. | Type: `boolean`. Optional. |
| `backgroundColor` | <Documented /> | The background color. | Type: `Color`. Optional. |
| `display` | <Documented /> | `"flex"` alone, on a Box drawn `display: "none"`. With a `scope`, the surface reveals every member of the lit group, in whichever site it sits. | Type: `'flex'`. Optional. A pointer on a glyph in the transcript can then swap an entry into a fixed row of the band. It can also reveal an absolutely positioned card. |
| `top` | <Documented /> | Moves a Box drawn `position: "absolute"`, as `left`, `right` and `bottom` do. None of the four moves a Box in the flow. | Type: `number`. Optional. |
| `left` | <Documented /> | The distance from the left edge. | Type: `number`. Optional. |
| `right` | <Documented /> | The distance from the right edge. | Type: `number`. Optional. |
| `bottom` | <Documented /> | The distance from the bottom edge. | Type: `number`. Optional. |

### `BoxProps`

The props of `Box`: the layout, position, margin, padding and border props of the Ink Box that a tree may set, and the two of hover. They are the layout and style props of a `Box`, such as `flexDirection`, `gap`, `padding`, and `borderStyle`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | Makes the Box a hover scope. While the pointer is anywhere over it, its own `hover` and that of every element beneath it apply. | Type: `string`. Optional. A nested `Box` with a `key` scopes what is beneath it. A key that a sibling took names no scope. |
| `hover` | <Documented /> | Style overrides. The surface applies them while the pointer is over the nearest keyed `Box`, this one included, or, given a `scope`, its group. | Type: `BoxHoverProps`. Optional. No hook runs on hover. To reveal on hover, draw the `Box` with `display: "none"` and set `hover: { display: "flex" }`. |
| `position` | <Documented /> | `"absolute"` leaves the flow, as in CSS. The offsets place it against its parent. It takes no room among its siblings, and it is painted over those before it. | Type: `'relative' \| 'absolute'`. Optional. An absolute `Box` moves nothing when it displays. The region of its site clips it. |
| `top` | <Documented /> | Rows from the top edge of the parent, in character cells: an integer, negative above the edge. | Type: `number`. Optional. With `bottom` and no `height` the Box spans the two. |
| `left` | <Documented /> | Columns from the left edge of the parent, in character cells: an integer, negative left of the edge. | Type: `number`. Optional. With `right` and no `width` the Box spans the two. |
| `right` | <Documented /> | Columns from the right edge of the parent, in character cells: an integer, negative right of the edge. | Type: `number`. Optional. |
| `bottom` | <Documented /> | Rows from the bottom edge of the parent, in character cells: an integer, negative below the edge. | Type: `number`. Optional. |
| `flexDirection` | <Documented /> | The direction of the main axis. | Type: `'row' \| 'column' \| 'row-reverse' \| 'column-reverse'`. Optional. |
| `flexGrow` | <Documented /> | How much the box grows to fill free space. | Type: `number`. Optional. |
| `flexShrink` | <Documented /> | How much the box shrinks when space is short. | Type: `number`. Optional. |
| `flexWrap` | <Documented /> | Whether children wrap onto more lines. | Type: `'nowrap' \| 'wrap' \| 'wrap-reverse'`. Optional. |
| `alignItems` | <Documented /> | How children line up on the cross axis. | Type: `'flex-start' \| 'center' \| 'flex-end' \| 'stretch'`. Optional. |
| `alignSelf` | <Documented /> | How this box lines up on the cross axis. It overrides its parent. | Type: `'flex-start' \| 'center' \| 'flex-end' \| 'auto'`. Optional. |
| `justifyContent` | <Documented /> | How children line up on the main axis. | Type: `'flex-start' \| 'center' \| 'flex-end' \| 'space-between' \| 'space-around' \| 'space-evenly'`. Optional. |
| `gap` | <Documented /> | Space between the children, in cells or a step name. Set `gap` on the `Box`. Do not set a margin on each child. | Type: `Space`. Optional. |
| `columnGap` | <Documented /> | The space between columns. | Type: `Space`. Optional. |
| `rowGap` | <Documented /> | The space between rows. | Type: `Space`. Optional. |
| `width` | <Documented /> | The width, in cells or as a percentage string. | Type: `number \| string`. Optional. |
| `height` | <Documented /> | The height, in cells or as a percentage string. | Type: `number \| string`. Optional. |
| `minWidth` | <Documented /> | The smallest width, in cells or as a percentage string. | Type: `number \| string`. Optional. |
| `minHeight` | <Documented /> | The smallest height, in cells or as a percentage string. | Type: `number \| string`. Optional. |
| `margin` | <Documented /> | The margin on all four sides. | Type: `Space`. Optional. |
| `marginX` | <Documented /> | The left and right margin. | Type: `Space`. Optional. |
| `marginY` | <Documented /> | The top and bottom margin. | Type: `Space`. Optional. |
| `marginTop` | <Documented /> | The top margin. | Type: `Space`. Optional. |
| `marginBottom` | <Documented /> | The bottom margin. | Type: `Space`. Optional. |
| `marginLeft` | <Documented /> | The left margin. | Type: `Space`. Optional. |
| `marginRight` | <Documented /> | The right margin. | Type: `Space`. Optional. |
| `padding` | <Documented /> | The padding on all four sides. | Type: `Space`. Optional. |
| `paddingX` | <Documented /> | The left and right padding. | Type: `Space`. Optional. |
| `paddingY` | <Documented /> | The top and bottom padding. | Type: `Space`. Optional. |
| `paddingTop` | <Documented /> | The top padding. | Type: `Space`. Optional. |
| `paddingBottom` | <Documented /> | The bottom padding. | Type: `Space`. Optional. |
| `paddingLeft` | <Documented /> | The left padding. | Type: `Space`. Optional. |
| `paddingRight` | <Documented /> | The right padding. | Type: `Space`. Optional. |
| `borderStyle` | <Documented /> | The border style. | Type: `string`. Optional. |
| `borderColor` | <Documented /> | The border color. | Type: `Color`. Optional. |
| `borderDimColor` | <Documented /> | `true` dims the border color. | Type: `boolean`. Optional. |
| `backgroundColor` | <Documented /> | The background color. | Type: `Color`. Optional. |
| `overflow` | <Documented /> | Whether content outside the box is displayed or cut. | Type: `'visible' \| 'hidden'`. Optional. |
| `display` | <Documented /> | `flex` displays the box. `none` hides it. | Type: `'flex' \| 'none'`. Optional. |

### `ButtonProps`

The props of `Button`, the pressable of every surface. It has an address, a label or children, the closure that a press runs, and the styles that a hover overrides. The terminal draws `[ label ]` and desktop draws a native button. A click, a `hotkey`, or Enter raises `ui.press`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element: `e.element` at `ui.press`, what a matcher names. Defaults to the `label`, or the one string child. | Type: `string`. Optional. Needed where the Button holds other children and no `label`. The text of a row holds what changes (a count, an age). Its address must not change. |
| `label` | <Documented /> | The text drawn on the button, or the one string child. | Type: `string`. Optional. Children of strings and `Text` are drawn in its place. Any other element is refused. |
| `hotkey` | <Documented /> | One digit (`"1"`) or one lowercase letter (`"w"`) that presses it while the site of the plugin holds the focus. The engine refuses anything else. | Type: `string`. Optional. Its site holds the key after ctrl+x tab, a click, or `open({ focus })`. Two buttons of one plugin with the same key clash, and the later wins. Since `2.1.323`, two buttons of two plugins with the same key press neither (`schemas/claude-code.d.ts`). |
| `action` | <Documented /> | An engine keybinding action (`"app:cycleDiffBase"`) whose chord, as the person bound it, presses this from the prompt. The engine refuses unknown names. | Type: `string`. Optional. Chords that a global or active context binding holds, on the terminal while the button is mounted. |
| `plain` | <Documented /> | Drawn without chrome: the hotkey in the accent color, a colon, and the label (`1: Yes`), as the row of a survey reads. With no `hotkey`, the label alone. | Type: `true`. Optional. A one-glyph label is then a control by itself. `dimColor` and `hover` still apply. |
| `dimColor` | <Documented /> | The label drawn dim at rest, as the `dimColor` of `Text`, and at full strength under the pointer or the focus. Use it for a secondary control or a path in a list. | Type: `boolean`. Optional. |
| `variant` | <Documented /> | Which button of several is the main action. `"primary"` is drawn as the surface marks the one to press. `"secondary"` and absent are drawn as before. | Type: `'primary' \| 'secondary'`. Optional. The terminal draws a primary button in the accent color. `plain` wins over `variant`. |
| `role` | <Documented /> | Marks the Button that closes its site. It is a drawing hint only. `onPress` still does the dismissing and the press is raised as for any Button. | Type: `'dismiss'`. Optional. The terminal draws it as without the prop. A desktop draws its native close control at the trailing edge of the site, with the label as its accessible name. |
| `autoFocus` | <Documented /> | The focus ring of the site starts here when the site takes the keyboard, instead of on nothing, as the `autofocus` of the DOM. Enter acts on it at once. | Type: `true`. Optional. A pane opened with `focus` takes it. Of several in one site, the first drawn wins. |
| `hover` | <Documented /> | Label style overrides (the `Text` set). The surface applies them while the nearest enclosing keyed `Box`, or given a `scope` its group, is hovered. | Type: `TextHoverProps`. Optional. No hook runs and nothing crosses to the plugin. Under the pointer itself the button inverts as it always has. The engine refuses it outside a keyed Box unless it names a `scope`. |
| `onPress` | <Documented /> | What the press runs, in the own environment of the plugin: the bottom of the `ui.press` chain. The host holds only a handle, for the life of the drawing. | Type: `(e: UiPressArgument) => void`. Runs with the `ui.press` argument. `e.surface` names the surface the press came from. |

### `ClientKeyEvent`

One key that the person pressed while a `Client` had the focus, as `surface.onKey` hands it. Escape never arrives. It returns the focus. Object with fields `key`, `ctrl?`, `shift?`, `meta?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The name of a special key (`up`, `down`, `left`, `right`, `return`, `tab`, `backspace`, `delete`, `pageup`, `home`, ...) or the character typed. | Type: `string`. |
| `ctrl` | <Documented /> | Modifier keys held with it, each present only when true. | Type: `true`. Optional. |
| `shift` | <Documented /> | `true` when Shift was held. | Type: `true`. Optional. |
| `meta` | <Documented /> | `true` when Meta was held. | Type: `true`. Optional. |

### `ClientPointerEvent`

One pointer event over the region of a `Client`, as `surface.onPointer` hands it. It has region-relative cells, and the sub-cell position where known. Object with the fields `type`, `x`, `y`, `fine?`, `button?`, `shift?`, `alt?`, `ctrl?`. After a `down` the instance holds the pointer until the `up`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | What the pointer did. | Type: `ClientPointerType`. |
| `x` | <Documented /> | The column under the pointer, 0 at the left edge of the region. On `enter` and `leave`, it is the last column that a move reported. | Type: `number`. |
| `y` | <Documented /> | The row under the pointer, 0 at the top edge of the region. | Type: `number`. |
| `fine` | <Documented /> | The same position with the fraction of a cell kept (`x: 12`, `fine.x: 12.375`), where the surface knows it. A terminal that reports pixels knows it. | Type: `object`. Optional. Sub-cell pointer position. Kitty, Ghostty, iTerm2, WezTerm, and foot send it. tmux passes none. |
| `button` | <Documented /> | Which button is down (`down`, `move` while held) or came up (`up`). Absent on a hover `move`, `enter` and `leave`. | Type: `'left' \| 'middle' \| 'right'`. Optional. |
| `shift` | <Documented /> | Modifier keys the terminal reported held, each present only when true. | Type: `true`. Optional. |
| `alt` | <Documented /> | `true` when Alt was held. | Type: `true`. Optional. |
| `ctrl` | <Documented /> | `true` when Ctrl was held. | Type: `true`. Optional. |

### `ClientProps`

The props of `Client`. They say which surface module of the plugin draws here, under what key, with what data, and in how much room. Object with fields `key`, `module`, `props?`, `width?`, `height?`, `flexGrow?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the instance within the drawing. Two `Client`s of one plugin in one tree take two keys. It is what `e.element` carries at `ui.message`. | Type: `string`. The engine keeps the instance (its local state, its timers) across the redraws of the plugin while a `Client` under this key stays in the tree. |
| `module` | <Documented /> | The path of the surface module, a string literal relative to this file: `module: "./<name>.tsx"` (or `.jsx`, `.ts`, `.js`, `.mjs`). | Type: `string`. The engine reads it off the source, so it refuses a variable at load. It refuses a path outside the plugin too. |
| `props` | <Documented /> | Plain data (JsonValue) handed to the module function. A new value on a redraw reaches the running instance, and its state is kept. | Type: `unknown`. Optional. At most 100000 characters serialized. It is not a channel for closures. Typed `unknown` so a matcher over a tree stays shallow. |
| `width` | <Documented /> | Columns that the region of the instance takes: a count, or a percentage of the parent. If absent, the region is as wide as what the module draws. | Type: `number \| string`. Optional. |
| `height` | <Documented /> | Rows that the region of the instance takes: a count, or a percentage of the parent. If absent, the region is as tall as what the module draws. | Type: `number \| string`. Optional. |
| `flexGrow` | <Documented /> | How the region grows into free room along the direction of the parent, as the `flexGrow` of a Box. | Type: `number`. Optional. |

### `ClientSurface`

What the function of a surface module receives as its second argument. It has its elements, the local state of the instance, its region, input, clock and port. Alias of an object with `elements`, `state`, `setState`, `columns`, `rows`, `every`, `onPointer`, `onKey`, and `post`. The module runs again on new props, `setState`, and a resize.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `elements` | <Documented /> | The element table of the surface (ClientElements), the tags that the module draws with: `const { Box, Text } = surface.elements`. No `Client` in it, and since `2.1.323` no `Progress`. | Type: `ClientElements`. Read-only. |
| `state` | <Documented /> | The local state of the instance: `undefined` until the first `setState`. Kept across the redraws of the plugin, and dropped with the instance. | Type: `S \| undefined`. Read-only. |
| `setState` | <Documented /> | Replaces the local state and schedules one more call of the function on the next frame. Several calls before it coalesce into one redraw. | Type: `(next: S) => void`. A `setState` on each of three renders in a row with no key, pointer, tick, press or props between is a render loop. The instance unmounts. |
| `columns` | <Documented /> | The width of the region in cells, as last laid out (0 before the first layout). | Type: `number`. Read-only. |
| `rows` | <Documented /> | The height of the region in cells, as last laid out (0 before the first layout). | Type: `number`. Read-only. |
| `every` | <Documented /> | Calls `fn` every `ms` milliseconds on the frame clock of the surface until the returned function is called or the instance unmounts. | Type: `(ms: number, fn: () => void) => () => void`. Start it once (while `state` is still undefined), not on every call. |
| `onPointer` | <Documented /> | Sets the pointer listener of the instance (one, and a later call replaces it) and returns what clears it. See ClientPointerEvent for capture. | Type: `(fn: (event: ClientPointerEvent) => void) => () => void`. |
| `onKey` | <Documented /> | Sets the key listener of the instance (one, and a later call replaces it). It is reached while a click has given it the focus. Escape returns that. | Type: `(fn: (event: ClientKeyEvent) => void) => () => void`. |
| `post` | <Documented /> | Sends plain data to the hooks module of the plugin: `e.data` of a `ui.message` that only the hooks of that plugin see. It sends one for each frame at most. | Type: `(data: JsonValue) => void`. A later post in the same frame replaces an undelivered one. At most 20,000 values, 32 deep, 100,000 characters. Since `2.1.323`, with no named key on a list and no key named `__proto__`, `constructor` or `prototype`, or the post is not sent. |

### `CodeProps`

The props of `Code`, source text that every surface draws with the own highlighter of the engine. It has coloured tokens, a line gutter on request, or a unified diff. Object with the fields `source`, `language?`, `path?`, `startLine?`, `format?`, `wrap?`. A leaf with no children. The color on screen belongs to the engine.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `source` | <Documented /> | The text drawn: source code, or under `format: 'diff'` one or more unified-diff hunks. | Type: `string`. Of any length. One drawing draws 100000 characters in all. Tab and newline are its only control characters. A diff cut mid-hunk does not parse. |
| `language` | <Documented /> | A highlighter language id or alias (`typescript`, `ts`, `py`), with a grammar that a plugin contributes included. | Type: `string`. Optional. If absent, the engine infers the language from `path`. When neither resolves, the text is drawn plain. |
| `path` | <Documented /> | A file path that the engine infers the language from when `language` is absent: its extension or name, else a shebang on the first line. | Type: `string`. Optional. Drawn nowhere and never read. Nothing touches the disk. |
| `startLine` | <Documented /> | The 1-based number of the first line of `source`. If present, a dim right-aligned gutter numbers the lines from it. If absent, there is no gutter. | Type: `number`. Optional. Ignored under `format: 'diff'`, whose hunks carry their own numbers. |
| `format` | <Documented /> | `'source'` (the default) draws `source` as code. `'diff'` reads it as unified-diff hunks and draws gutters, markers, and add and remove colouring. | Type: `'source' \| 'diff'`. Optional. A diff holds `@@ -a,b +c,d @@` hunks. A source with no hunks is drawn as plain code. |
| `wrap` | <Documented /> | What a line wider than the room does, in the `wrap` vocabulary of Text. `'wrap'` (the default) continues it on rows under the gutter. | Type: `'wrap' \| 'truncate-end'`. Optional. `'truncate-end'` cuts it at the edge with an ellipsis. The engine refuses the other spellings of Text, because a gutter leaves them no sense here. |

### `ElementChildren`

The `children` field that the props of every element constructor carry, appended beside its own props type: one child, or a list that may nest. Object with the field `children?`. A lone child is typed as the child itself. A mapped list beside a sibling is a nested list.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `children` | <Documented /> | One child, or a list of children that may nest. | Type: `RenderChildren`. Optional. |

### `ElementName`

Every element name of every surface. It is what a table handed out is completed to (an omitted one draws a fragment, see `ui.resolve`). Object with fields `[P in RenderSurface]`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[P in RenderSurface]` | <Documented /> | For each render surface, the names of its elements. | Type: `keyof Elements[P]`. |

### `ImageBlitArgs`

A `$.ui.blit` argument that swaps one of the mounted keyed Images of the caller to its next picture. Every call sends it, so a stream needs no generation. Object with the fields `requestId`, `key`, `source`, `columns?`, `rows?`. Byte and `file` sources fold to the last one for each frame.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `requestId` | <Documented /> | The site that the Image is drawn in, by the `requestId` that this plugin draws it under. | Type: `string`. |
| `key` | <Documented /> | The `key` of the Image in that drawing. | Type: `string`. |
| `source` | <Documented /> | The next picture (ImageSource): bytes, or a name that the terminal reads. | Type: `ImageSource`. |
| `columns` | <Documented /> | The engine refuses it unless it is the width of the mounted Image in cells. If absent, that width. | Type: `number`. Optional. |
| `rows` | <Documented /> | The engine refuses it unless it is the height of the mounted Image in cells. If absent, that height. | Type: `number`. Optional. |

### `ImageProps`

The props of `Image`, the terminal surface's picture leaf: pixels over a box of cells where the terminal can (kitty, Ghostty), the `alt` elsewhere. Since `2.1.305` it also draws in iTerm2 3.5 and later with fullscreen rendering. The program detects it from an XTVERSION reply that names iTerm2 3.5 or later; otherwise it shows the `alt` text. Since `2.1.310` it also draws inside tmux, for a bytes `source` only, when tmux's `allow-passthrough` and `focus-events` are on. Object with the fields `key?`, `source`, `columns`, `rows`, `alt`. A leaf with no children, `hover`, or `onPress`. A new `source` replaces the picture in place.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The address of the element within the drawing: what `$.ui.blit` names to swap. | Type: `string`. Optional. Unique among the Images of one tree. If absent, only a redraw changes it. |
| `source` | <Documented /> | The picture (ImageSource): `{ png }` or `{ rgba, width, height }` bytes, or `{ file, format }` / `{ shm, format, width, height }` read here. | Type: `ImageSource`. |
| `columns` | <Documented /> | /** How many terminal columns wide, 1 to 255. The picture is scaled to fill the box, and the site clips what its body cannot show. */ | Type: `number`. |
| `rows` | <Documented /> | How many terminal rows tall, 1 to 255. | Type: `number`. |
| `alt` | <Documented /> | What the picture says. It is drawn dim in its place where the picture cannot be (and read by a screen reader). Required, and may be a single space. | Type: `string`. |

### `ImageSource`

The picture that an `Image` displays. It is base64 bytes that the plugin holds (at most 2 MiB decoded). It can also be the name of a file or POSIX shared-memory object that the plugin does not hold. The terminal reads and decodes a file name itself, so no pixel crosses `$`. An unreadable source draws a blank box, and a source equal to the last one sends nothing.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `png` | <Documented /> | A whole PNG file, base64. | Type: `string`. |
| `rgba` | <Documented /> | `width \* height` RGBA pixels, 4 bytes each, base64. | Type: `string`. |
| `width` | <Documented /> | Pixels per row, 1 to 2048. | Type: `number`. |
| `height` | <Documented /> | Rows of pixels, 1 to 2048. | Type: `number`. |
| `file` | <Documented /> | The absolute path of a regular file that holds a whole PNG, at most 3072 bytes of path. The terminal reads it and leaves it in place. | Type: `string`. |
| `format` | <Documented /> | The file is a whole PNG. The terminal decodes it and sizes it itself. | Type: `'png'`. |
| `generation` | <Documented /> | A whole number that changes when the content of the file does under the same path, so a redraw reads it again. If absent, the path alone tells. | Type: `number`. Optional. |
| `file` | <Documented /> | The absolute path of a regular file of `width \* height` raw pixels, at most 3072 bytes of path. The terminal reads it and leaves it in place. | Type: `string`. On Linux a file under `/dev/shm` is memory. |
| `format` | <Documented /> | `rgba`, 4 bytes for each pixel, or `rgb`, 3. | Type: `'rgba' \| 'rgb'`. |
| `width` | <Documented /> | Pixels per row, 1 to 4096. | Type: `number`. |
| `height` | <Documented /> | Rows of pixels, 1 to 4096. | Type: `number`. |
| `generation` | <Documented /> | A whole number that changes when the content of the file does under the same path, so a redraw reads it again. If absent, the path alone tells. | Type: `number`. Optional. |
| `shm` | <Documented /> | The name of a POSIX shared-memory object of `width \* height` raw pixels: `/` then up to 254 of `A-Z a-z 0-9 . _ -` (macOS takes 30). | Type: `string`. The terminal unlinks it after reading. So a name feeds one Image drawn once, and a redraw never sends it again. POSIX terminals only. |
| `format` | <Documented /> | `rgba`, 4 bytes for each pixel, or `rgb`, 3. | Type: `'rgba' \| 'rgb'`. |
| `width` | <Documented /> | Pixels per row, 1 to 4096. | Type: `number`. |
| `height` | <Documented /> | Rows of pixels, 1 to 4096. | Type: `number`. |
| `generation` | <Documented /> | A whole number that changes when a fresh object reuses a name, so a redraw reads it again. If absent, the name alone tells. | Type: `number`. Optional. |

## Related Pages

- [UI Types](index.md)
- [Mod API Types](../index.md)
