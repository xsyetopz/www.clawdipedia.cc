---
title: UI Methods
description: "The $.ui noun that draws and manages the interface: transcript lines, toasts, panes, scroll, focus, and the clipboard."
sidebar_position: 6
---

`$.ui` draws and manages the interface: lines in the transcript, toasts, panes, scroll, focus, the clipboard, and element tables. Use it when a mod must show something to the person or react to what they select. Call it from a hook, a closure that a hook drew, or a timer callback.

Each method is also an event with the same name, such as `ui.log`. A hook above the caller can rewrite or refuse the call. A `deny` from a hook refuses a call. Close a pane with `$.ui.close`.

Official pages: [Draw in the Interface](https://code.claude.com/docs/en/plugins/mods/interface) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types-theme]

In the "Where it can be used" column, "Run time" means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

```javascript
on("session.start", async ($, e, next) => {
  $.ui.status("Mod ready");
  $.ui.toast("Hello from a mod", { timeoutMs: 2000 });
  return next(e);
});
```

This theme example uses `backdrop.scene` and the top-level `overrideColorScheme`.

```javascript
on("session.start", async ($, e, next) => {
  const r = await $.theme.set({
    backdrop: {
      scene: "lagoon",
      glass: { blur: 14, opacity: 0.55 }
    },
    overrideColorScheme: "dark"
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
| `$.ui.invalidate` | <Documented /> | Re-runs an event whose results the engine caches. `ui.render` draws the instances this plugin may draw again. The others drop the cached answers. | `(event: InvalidatableEventName) => void`. At most ten redraws a second. In the terminal, a shown pane, an expanded band, and the prompt hint redraw up to thirty times a second. Calls that come sooner fold into one. It can also drop a cached answer, such as `prompt.section` or `tool.describe`. It also takes `tool.list`. | Run time. |
| `$.ui.blit` | <Documented /> | Repaints a mounted `Raster` that this plugin's render hook drew with new cells, or swaps a keyed `Image` to a new source. No redraw. | `(args: UiBlitArgs) => Promise<UiBlitResult>`. Paints at the next frame. The engine takes up to 120 calls a second. Resolves `{}` or `{ deny }`. | A plugin's own mounted `Raster` or keyed `Image`. |
| `$.ui.resolve` | <Documented /> | Gives the elements of the surface that `e` is drawn on: a frozen table of constructors, the JSX tags that a render hook draws with. | `<E extends ResolveInput>(e: E) => Elements[E['surface']]`. It is a read, not a dispatch. | A `ui.render` hook (it takes that hook's `e`). |
| `$.ui.log` | <Documented /> | Appends one line to the transcript, drawn like a dim system notice that is not sent to the model. With `{ to: "debug" }` it goes to the debug log only. | `(text, options?) => void`. The terminal draws 2000 characters. A remote surface draws 10000. | Run time. |
| `$.ui.ask` | <Documented /> | Asks the user a question in the engine's own AskUserQuestion dialog. Resolves to the label they chose, or the text typed under "Other". | `(question, options?) => Promise<string>`. Offers 2 to 4 labels. Rejects if the user dismisses the dialog, and in a `-p` run. | Not in a `-p` run. |
| `$.ui.toast` | <Documented /> | Shows `text` for a few seconds under the plugin's name in a small box at the top right of the transcript. | `(text, options?) => void`. A click removes it. `timeoutMs` sets how long it stays (default 4000). | Run time. |
| `$.ui.notify` | <Documented /> | Raises a native notification through the person's own notification channel (the one `preferredNotifChannel` names). | `(text, options?) => Promise<UiNotifyResult>`. The `Notification` hooks run first. Resolves `{ isSent, channel }` or `{ isSent: false, reason }`. | Run time. |
| `$.ui.cancelNotify` | <Undocumented /> | Takes back a notification that this plugin raised with `$.ui.notify` under a `key`, shown or still waiting. If none is held under the key, nothing happens. | `(key: string) => Promise<{ isSent: boolean }>`. The `key` is 1 to 64 characters, with no hidden characters or stray spaces, and not a name that every object has, such as `constructor`. `isSent` is `true` when a client took the cancel and `false` when none did (`no_client`).[^cancel-notify] The official [Mods reference](https://code.claude.com/docs/en/plugins/mods/reference) does not list it. | Run time. |
| `$.ui.status` | <Documented /> | Pins `text` as this plugin's status line under the prompt, until the next call replaces it. | `(text: string \| undefined) => void`. `undefined` removes it. 2000 characters are drawn. | Run time. |
| `$.ui.open` | <Documented /> | Opens a pane: a framed region that the surface places and this plugin draws by hooking `ui.render` for `{ component: "Pane" }`. | `(pane: PaneOpenArgs) => Promise<UiOpenResult>`. The `id` has 1 to 64 characters. Panes that someone asked for fit at any width. Panes that nobody asked for need 144 columns, or 110 for an id the person opened before and did not close by hand.[^pane-floor] A pane that another plugin holds is refused: the open rejects and names it, with the text `pick another id, or wait until <plugin> closes it`.[^pane-held] `PaneOpenArgs` takes `placement` (the seat to start in: `"widget"`, its small form on the desktop app), and the seat the pane got is on the `Pane` props.[^types-theme] | Run time. |
| `$.ui.close` | <Documented /> | Closes one of the open panes. The call ignores an id that is not open. | `(pane: PaneCloseArgs) => Promise<void>`. A `ui.close` hook can keep it open, except on an unload. A pane that another plugin holds is refused with the text `only <plugin> closes it`.[^pane-held] | Run time. |
| `$.ui.panes` | <Documented /> | Lists this plugin's own open panes: id, title, and whether each is shown, holds the keyboard, and is placed. | `() => Promise<readonly UiPane[]>`. In open order, placed ones first. Other plugins' panes are not listed. | Run time. |
| `$.ui.place` | <Undocumented /> | Places one row at the end of the transcript. It scrolls with the conversation, and a `ui.render` hook draws it as the component `Placed`. Display only: the model and the transcript file never read it. | `(args: UiPlaceArgs) => Promise<UiPlaceResult>`. The `id` names the row among this plugin's rows. A second call with the same `id` answers the row that stands. A plugin holds at most 500 placed rows. Resolves `{ isPlaced: false, reason }` with no conversation.[^place] | Run time. |
| `$.theme.set` | <Undocumented /> | Sets the one theme of the session from an object of named attributes. Name at least one of `backdrop`, `overrideColorScheme`, `colors`, `sound`, and `style`. A set names the whole theme, so what it leaves out is gone. The latest set wins, whichever plugin set it. Display only: `--resume` brings none back, and a plugin that unloads takes its own with it. | `(attributes: ThemeSetArgs) => Promise<ThemeResult>`, where `ThemeSetArgs` is `{ backdrop?: { scene: string, glass?: { blur?: number, tint?: string, opacity?: number } \| false } \| ThemeGround, overrideColorScheme?: 'light' \| 'dark', colors?: ThemeColors, sound?: ThemeSound, style?: ThemeStyle }`.[^types-theme] See Theme Set Details. | Run time. |
| `$.theme.clear` | <Undocumented /> | Clears the theme of the session, back to the app's own look. It clears whatever theme stands, whichever plugin set it, so call it on a person's ask and not at `session.start` or on a reload. | `() => Promise<ThemeResult>`. Always resolves `{ isDrawn: false, reason }`. The reason is "the theme is cleared" when a theme stood, and "no theme stood, so nothing was cleared" when none did. | Run time. |
| `$.ui.scroll` | <Documented /> | Scrolls something into view, like the DOM's `scrollIntoView`: a render instance by `requestId`, an element by `key`, or the edge of a site. | `(args: UiScrollArgs) => Promise<UiScrollResult>`. `to` says where, `in` says which site, `block` says where it lands. | Run time. |
| `$.ui.focus` | <Documented /> | Moves the focus ring of one of this plugin's sites to an element it drew there, like the DOM's `element.focus()`. | `(args: UiFocusArgs) => Promise<UiFocusResult>`. Takes the site `requestId` and the element `key`. Resolves `{}` or `{ deny }`. | Run time. |
| `$.ui.copy` | <Documented /> | Puts `text` on the clipboard of a surface the session draws on, and says whether it took. | `(args: UiCopyArgs) => Promise<UiCopyResult>`. Resolves `{ isCopied: true }` or `{ isCopied: false, reason }`. | Run time. |
| `$.ui.selection` | <Documented /> | Returns what the person last selected with the mouse: the text as a copy would take it, and the transcript row it lies in. | `() => Promise<UiSelection \| undefined>`. `undefined` with nothing selected, in `-p`, or when fullscreen is off. | Run time. |
| `$.ui.view` | <Undocumented /> | Puts an agent's transcript in the main view, as the person's own switch from the tasks list does. `{}` goes back to the main one. | `(view: SiteView) => Promise<UiViewResult>`. Works only while the call answers the person's own input (press, pick, prompt, command). | Only while answering the person's own input. |

## Theme Set Details

`$.theme.set` takes five attributes: `backdrop`, `overrideColorScheme`, `colors`, `sound`, and `style`.[^types-theme]

- `backdrop` is a scene or a still ground. A scene is `{ scene, glass? }`, and a `ui.render` hook for `Backdrop` draws it. A still ground (`ThemeGround`) is `{ color }`, `{ gradient: { stops, angle?, shape?, size?, repeat? } }`, or `{ vector: { viewBox, paths, color?, size?, repeat? } }`. A surface draws a still ground with no hook. A still ground takes no `glass`. A scene takes no `color`, `gradient`, or `vector`.
- `overrideColorScheme` replaces the mode of the person with `light` or `dark`. Without it, a surface acts as if it named the only mode that `colors.inputs` gives. If `colors.inputs` gives two modes, the mode of the person stands.
- `colors` is a color theme (`ThemeColors`, a whole palette) for a surface to paint itself with, where it reads one.
- `sound` (`ThemeSound`) is an ambience and short cues. Without it, the theme is silent. See [Sound Values](#sound-values).
- `style` (`ThemeStyle`) is a rule for each part of the conversation: the type of messages and the boxes around messages and tool calls. See [Style Values](#style-values).

### Backdrop Values

- `scene` is 1 to 64 letters, digits, `_`, or `-`.
- `blur` is 0 to 64 points. The default is 16.[^blur]
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

### Sound Values

- `ThemeSound` is `{ ambience?, cues? }`. It needs one of them: the program says `sound needs an ambience or at least one cue`.[^theme-sound]
- `ambience` plays behind the session.
- `cues` has seven moments: `send`, `tool`, `compact`, `done`, `ask`, `error`, and `click`. `send` is a sent message. `tool` is the start of a tool call, which can come often, so keep it short and soft. `compact` is a compaction. `done` is the end of a turn. `ask` is a permission prompt or a question. `error` is a turn that ends in an error. `click` is a click on the backdrop where no part of the app covers it. A `click` layer plays one note, chosen by where the click lands, so it takes no `step`: the program says `a click plays one note, chosen by where it lands`.[^theme-click]
- An ambience (`ThemeAmbience`) and a cue (`ThemeCue`) are each `{ layers, reverb? }`. `layers` holds 1 to 8 layers. `reverb` is 0 to 1, and the default is 0.
- A layer plays a tone or a noise. A tone layer has a `wave` of `sine`, `triangle`, `square`, `saw`, or `bell`, and `notes`. A noise layer has a `wave` of `white`, `pink`, `brown`, or `crackle`. `notes` holds 1 to 16 notes. A note is a name such as `C5`, `F#3`, or `Bb2`, a number of hertz from 20 to 10,000, or `0` for a rest.
- A layer in an ambience is a drone (`drone: true`, which plays without a break) or a scatter (`scatter`, a number of hits a second at random, 0.02 to 10). A layer in a cue is one hit.
- Every layer takes `gain` (0 to 1, default 0.5), `pan` (-1 to 1, default 0), `filter` (`{ type, hz, to? }`, where `type` is `lowpass`, `highpass`, or `bandpass` and `hz` is 20 to 10,000), and `tremolo` (`{ hz, depth }`, `hz` 0.05 to 30 and `depth` 0 to 1). The app turns a loud sound down and never turns one up.
- A hit takes `attack` (0.002 to 2 seconds, default 0.005) and `release` (0.01 to 4 seconds, default 0.4). A tone hit also takes `step` (0 to 2 seconds between notes) and `glide` (-24 to 24 semitones).
- A cue layer lasts at most 4 seconds. An ambience may take 256 seconds of audio to render and a cue 32. A scatter may start about 24 hits at once at most.[^theme-sound-limits]
- The whole `sound` holds at most 1,500 values. A value out of range gets an error that says what to change.
- A wrong shape gets an error that names the field: `is an object with any of`, `takes no`, `is one of`, `is a list of 1 to`, `is a number,` with its range, and `is a note name such as "C5" or "F#3"`. A layer that is both or neither of a drone and a scatter gets `needs exactly one of drone: true and scatter`, and a drone value other than `true` gets `.drone is true, or left out`.[^theme-sound-shape]

### Style Values

- `ThemeStyle` is `{ Text?, Heading?, UserMessage?, AssistantMessage?, ToolUse? }`. It needs at least one of them.[^theme-style]
- `Text` is the words of both kinds of message, and `Heading` is the headings in a message. Each is a type rule (`ThemeTypeRule`): `color`, `fontFamily`, `fontSize`, `fontWeight`, `italic`, `letterSpacing`, and `lineHeight`.
- `UserMessage` is the message of the person, and `AssistantMessage` is each run of words in the reply of Claude. Each takes one message rule (`ThemeMessageRule`) or a list of 1 to 4 rules. With a list, each message takes one rule and keeps it. A message rule is a type rule, a box rule, and `rotate`.
- `ToolUse` is the row of a tool call. A tool rule (`ThemeToolRule`) is a box rule plus `color` and `fontFamily`.
- A box rule (`ThemeBoxRule`) has `backgroundColor`, `fill`, `radius`, `borderColor`, `borderWidth`, `shadow`, and the paddings: `padding`, `paddingX`, `paddingY`, `paddingTop`, `paddingRight`, `paddingBottom`, and `paddingLeft`. A side beats its axis, which beats `padding`.
- `fill` is `{ gradient }` or `{ vector }`, as in a still backdrop. A `vector` fill also takes `slice`. The cuts must leave a middle, and no edge may be more than 48 points wide.[^theme-slice]
- `fontFamily` is a list of 1 to 8 values. The last value is a generic font: `sans`, `serif`, `mono`, `code`, or `cursive`. Font names can come before it. In `ToolUse`, the list holds only the generic font; a longer list gets the error `takes one of sans, serif, mono, code, cursive alone, such as ["mono"]`.[^theme-font]
- A style color is a `#hex`, `rgb()`, or `hsl()` value, `transparent`, or a color token name such as `text-primary`. Any other value gets the error `is a color: #hex, rgb(), hsl(), transparent or a ThemeColorName such as text-primary`.[^theme-style-color]
- Ranges: `fontSize` 11 to 28, `letterSpacing` -1 to 4, `lineHeight` 12 to 48 (in points, not a multiple), `borderWidth` 0 to 8, `rotate` -3 to 3 degrees, `radius` 0 to 64 (one number or four), padding 0 to 48, and `shadow` `x` and `y` -16 to 16 and `blur` 0 to 32 (or `'none'`).[^theme-style-ranges]
- The whole `style` holds at most 1,500 values and 65,536 characters of text.[^theme-style]
- A wrong shape gets an error that names the field: `is an object with any of`, `takes no`, `is a number of`, `is a list of`, and `is true or false`. A `fontWeight` error ends with `is one of` and the weights. A `fontFamily` list that does not end with a generic font gets `ends with one of`, and a name that is not valid gets `is a font name: 1 to 64 letters, digits, spaces, _ and -, starting with a letter or digit`. A gradient needs `.shape is linear or radial`, and its stops must run in order, from 0 to 1. A fill that names both or neither of `gradient` and `vector` gets `needs exactly one of gradient and vector`. A `lineHeight` is in points: the program says `.lineHeight is points, not a multiple of the font size: 24, not 1.5`, and it refuses a `lineHeight` less than `fontSize`.[^theme-style-shape]

### Result and Errors

- It resolves `{ isDrawn: true, requestId: "backdrop" }`, or `{ isDrawn: false, requestId, reason }` when no surface draws backdrops.
- `isDrawn: true` says only that a client that says it draws the theme is attached. It does not say that the client paints `colors`, follows `overrideColorScheme`, or draws each part of a look.
- `requestId` is `backdrop` for a scene and `theme` with no scene.[^theme-set] With no scene, no `ui.render` hook is asked to draw.
- The program says `theme.set needs at least one of backdrop, overrideColorScheme, colors, sound, style; $.theme.clear() clears the theme`, `overrideColorScheme is light or dark`, `glass.blur is a number of points, 0 to 64`, `backdrop needs a scene: 1 to 64 of letters, digits, _ or -`, `backdrop.glass is for a scene: a still ground has none`, and `backdrop takes just one of scene, color, gradient or vector, and this names ...`. The attribute error ends `this build takes backdrop, overrideColorScheme, colors, sound, style`.[^theme-set]

## Related Pages

- [Mod API Overview](../index.md)
- [UI Events](ui-events.md)
- [Surfaces, Elements, and Render Sites](ui-elements.md)
- [UI Types](../types/ui/index.md) (element props and results of `$.ui`)

## Sources

[^types-theme]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-0yef3dc4.js:6`, published as `schemas/claude-code.d.ts`, the `ui` and `theme` members of the `$` type, `InvalidatableEventName`, `PaneOpenArgs`, and `ThemeSetArgs`.
[^pane-floor]: The program, `chunk-1ea72zr6.js:483`. The type file `schemas/claude-code.d.ts`, `PaneOpenArgs`, says the same.
[^pane-held]: The program, `chunk-1ea72zr6.js:543`, the message `pane "<id>" is held by <plugin>`.
[^theme-sound]: The program, `chunk-mkqy4tm9.js:5` (the seven cue names, from `send` to `click`), `chunk-mkqy4tm9.js:44` (`sound may hold at most 1500 values`), `chunk-mkqy4tm9.js:52` (`sound needs an ambience or at least one cue`), and `chunk-mkqy4tm9.js:191` (`layers` holds up to 8). The ranges (`step`, `attack`, `release`, `gain`, `pan`, `glide`, `scatter`, `reverb`) are the table at `chunk-mkqy4tm9.js:17-24` and the type file `schemas/claude-code.d.ts`, `ThemeSound` and the types it names.
[^theme-click]: The program, `chunk-mkqy4tm9.js:133` (the `click` cue refuses `step`, with the text `a click plays one note, chosen by where it lands`) and `chunk-mkqy4tm9.js:68` (the notes of a click come from the longest layer).
[^theme-slice]: The program, `chunk-fq5wseep.js:317` (`leaves no middle`) and `chunk-fq5wseep.js:321` (`the most is 48`).
[^theme-sound-limits]: The program, `chunk-mkqy4tm9.js:184` (the error `lasts`, with `the most is 4`), `chunk-mkqy4tm9.js:198` (256 for an `ambience`, else 32), `chunk-mkqy4tm9.js:217` (`seconds of audio to render`), and `chunk-mkqy4tm9.js:221` (`the most is 24`).
[^theme-style]: The program, `chunk-fq5wseep.js:29-35` (the fields of `UserMessage`, `AssistantMessage`, and `ToolUse`), `chunk-fq5wseep.js:72` (`style may hold at most 1500 values`), `chunk-fq5wseep.js:80` (a list of 1 to 4 for a message), and `chunk-fq5wseep.js:86` (`style needs at least one of`). The `style` check runs from `chunk-c2m5gm43.js:606`.
[^theme-style-ranges]: The program, `chunk-fq5wseep.js:45-58` (the ranges of `fontSize`, `letterSpacing`, `lineHeight`, `borderWidth`, and `rotate`, and the ranges of padding, radius, and shadow). The type file `schemas/claude-code.d.ts`, `ThemeBoxRule`, states the same ranges.
[^theme-set]: The program, `chunk-c2m5gm43.js:480` (`requestId` is `backdrop` for a scene and `theme` with none). The attribute check reads the list `["backdrop","overrideColorScheme","colors","sound","style"]` at `chunk-c2m5gm43.js:579`, the validator runs at `chunk-c2m5gm43.js:581-621`, and `glass.blur is a number of points` is at `chunk-c2m5gm43.js:256`.
[^blur]: The program, `chunk-c2m5gm43.js:256` (`glass.blur` is 0 to 64 points) and `chunk-c2m5gm43.js:320` (the `blur` default of 16).
[^cancel-notify]: The program, call `chunk-0w2wb7gk.js:14346` (`cancelNotify` sends `key`), check `chunk-bzyb60p0.js:216246` (`$12a6e9`, the `key`) and run `chunk-bzyb60p0.js:216324` (`Rri`), table `chunk-bzyb60p0.js:217953` (`ui.cancelNotify`).
[^place]: The program, `chunk-bzyb60p0.js:215860` for the limit `UHt=500`, `chunk-bzyb60p0.js:215860` for the reason `no conversation to place a row in`, and `chunk-bzyb60p0.js:215860` for the reason `a plugin holds at most 500 placed rows`.
[^theme-style-color]: The program, `chunk-fq5wseep.js:192` (the color check of a style value).
[^theme-font]: The program, `chunk-fq5wseep.js:37` (the five generic fonts), `chunk-fq5wseep.js:197` (a list of 1 to 8), `chunk-fq5wseep.js:204` (`ToolUse` with more than one value), and `chunk-fq5wseep.js:206` (the error text).
[^theme-sound-shape]: The program, `chunk-mkqy4tm9.js:83` (`is an object with any of`), `chunk-mkqy4tm9.js:87` (`takes no`), `chunk-mkqy4tm9.js:95` (`is a number,`), `chunk-mkqy4tm9.js:100` (`is one of`), `chunk-mkqy4tm9.js:105` (`is a list of 1 to`), `chunk-mkqy4tm9.js:118` (the note-name text), and `chunk-mkqy4tm9.js:129` (`needs exactly one of drone: true and scatter`, with `.drone is true, or left out` at line 131).
[^theme-style-shape]: The program, `chunk-fq5wseep.js:107` (`is an object with any of`), `chunk-fq5wseep.js:111` (`takes no`), `chunk-fq5wseep.js:117` (`is a number of`), `chunk-fq5wseep.js:123` (`is a list of`), `chunk-fq5wseep.js:128` (`is true or false`), `chunk-fq5wseep.js:202` (`ends with one of`), `chunk-fq5wseep.js:212` (the font-name text), `chunk-fq5wseep.js:226` (`.shape is linear or radial`), `chunk-fq5wseep.js:239` (the text "stops run in order, from 0 to 1"), `chunk-fq5wseep.js:330` (`needs exactly one of gradient and vector`), `chunk-fq5wseep.js:353` (the `lineHeight` points text), `chunk-fq5wseep.js:371` (`fontSize` and the overlap text), and `chunk-fq5wseep.js:379` (`.fontWeight is one of`).
