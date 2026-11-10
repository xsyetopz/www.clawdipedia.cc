---
title: Testing Mock, Mount, and Target Types
description: "Types of the mocks, the mounted members, the mount and press targets, and the test options."
sidebar_position: 2
---

## Types with Fields

Each type below has its own table of fields.

### `Mock`

The world beneath the plugins, mocked noun by noun: each member registers hooks of the test on `on`. The hooks are visible where the test calls it. Object with fields `clock`, `store`, `env`, `session`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `clock` | <Documented /> | Answers `$.clock` from a clock in memory that moves only when the test moves it: `clock.now` reads it, and the clock holds each wait. | Type: `(on: On, options?: MockClockOptions) => MockClock`. A fake clock. A held wait resolves when an advance crosses its time. `options.now` sets the start time (0 by default). |
| `store` | <Documented /> | Answers `$.store` from a store in memory: `get`, `set`, `delete` and `keys` over it, as the engine keeps the own store of a plugin. | Type: `(on: On, entries?: Readonly<Record<string, unknown>>) => void`. Parameter `on`: the test's `on`. Parameter `entries`: what the store holds at the start (nothing when not given). |
| `env` | <Documented /> | Answers `$.env.get` from a set of variables. A variable not listed is unset. | Type: `(on: On, variables: Readonly<Record<string, string>>) => void`. Parameter `on`: the test's `on`. Parameter `variables`: the environment the plugins read. |
| `session` | <Documented /> | Records what is appended to the conversations of the session. It has each row that the kit stored for the `$.session.append` of a plugin, or for the own call of the test. | Type: `(on: On) => MockSession`. Gives a fake session that stores appended rows. Returns the rows appended so far. |

### `MockClock`

The clock that `mock.clock` hands back: the time its hooks answer, and the only ways it moves. Object with fields `now`, `advance`, `set`, `settle`, `sleep`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `now` | <Documented /> | The time now, in milliseconds: what `$.clock.now()` resolves beneath the plugins. | Type: `() => number`. Returns: the time. |
| `advance` | <Documented /> | Moves the clock on, and resolves each wait due on the way (`$.clock.sleep`, `after`, `every`, `sleep` of this clock) in the order it comes due. | Type: `(ms: number) => Promise<void>`. Moves the fake clock by `ms`. Resolves once the clock is there and the event loop settled. |
| `set` | <Documented /> | Moves the clock to a time at or past now, as `advance` would. | Type: `(ms: number) => Promise<void>`. Parameter `ms`: the time, in milliseconds. Returns: resolves once the clock is there and the event loop settled. |
| `settle` | <Documented /> | Lets what is already under way run as far as it can without the clock moving. Every wait due now resolves, and the event loop settles. | Type: `() => Promise<void>`. The same as `advance(0)`. Use it between starting a dispatch and looking at what it did. |
| `sleep` | <Documented /> | Resolves once the clock has moved this far past now: how a hook of the test answers late. | Type: `(ms: number) => Promise<void>`. Parameter `ms`: how far, in milliseconds. Returns: resolves when an advance crosses that time. |

### `MockClockOptions`

Where a mocked clock starts: `now`, in milliseconds (0 when not given). Object with fields `now?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `now` | <Documented /> | Where the mocked clock starts, in milliseconds. 0 when not given. | Type: `number`. Optional. |

### `MockSession`

The session that `mock.session` hands back: what was appended to its conversations while the test ran. Object with fields `appended`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `appended` | <Documented /> | The rows stored so far, oldest first, each as the event carried it: `message` as stored, `door`, `origin`, `uuid` and `agentId`. | Type: `() => readonly SessionAppendInput[]`. A row of a plugin has the door `note`, the plugin as `origin` and a fresh `uuid`. The list leaves out a row that a hook above refused, or the kit. Returns: the rows. |

### `MountedMembers`

Every member that a mounted drawing of component `C` can have. `Mounted<P, C>` keeps the ones that surface `P` has the element for (ElementOfAct). Alias of the members `surface`, `drawn`, `find`, `findAll`, `press`, `input`, `select`, `key`, `pointer`, `post`, `advance`, `resize`, `redraw`, and `unmount`. Each act resolves once its work settles.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where this drawing is, as the test named it. | Type: `P`. Read-only. |
| `drawn` | <Documented /> | The tree as last drawn: what the `ui.render` chain of the plugins returned for this instance, checked by the table of the surface, as plain data. | Type: `(scope?: ClientScope) => Promise<RenderElement>`. Gives the tree. Rejects if the surface could not draw it. Example: `expect(await ui.drawn()).toMatchObject({ type: 'Box' })`. |
| `find` | <Documented /> | The first element matching the query, outermost first in document order, or undefined. | Type: `(query: ElementQuery) => Promise<FoundElement \| undefined>`. Finds one element by tag, key, or text. Example: `(await ui.find({ key: 'count' }))?.text`. |
| `findAll` | <Documented /> | Every element matching the query, in document order. | Type: `(query: ElementQuery) => Promise<FoundElement[]>`. Finds all matching elements. Example: `expect(await ui.findAll({ type: 'Button' })).toHaveLength(2)`. |
| `press` | <Documented /> | Presses the Button keyed `key`, as the person who activates it on this surface does: the `ui.press` chain, with the own `onPress` of the Button last. | Type: `(target: MountPressTarget) => Promise<UiPressResult \| undefined>`. Presses the element with this `key`. With `link` it presses a link of a `Markdown`. Example: `await ui.press({ key: 'save' })`. |
| `input` | <Documented /> | Types into the Input keyed `key`: the `ui.input` chain with the text as `e.value`, with the own handler of the Input last. | Type: `(target: MountInputTarget) => Promise<UiInputResult \| undefined>`. `kind` `submit` (default) is Enter with that text. `change` leaves it in the field. Example: `await ui.input({ key: 'title', text: 'groceries' })`. |
| `select` | <Documented /> | Picks `value` in the Select keyed `key`: the `ui.select` chain, with the own `onSelect` of the Select last. | Type: `(target: MountSelectTarget) => Promise<UiSelectResult \| undefined>`. Picks the option `value` in the `Select` with this `key`. Example: `await ui.select({ key: 'sort', value: 'date' })`. |
| `key` | <Documented /> | Hands the `onKey` listener of a `Client` one key, as a key pressed while its region has the focus does. | Type: `(event: MountKeyEvent) => Promise<void>`. Sends a key to a `Client`. Example: `await ui.key({ key: 'return', in: 'board' })`. |
| `pointer` | <Documented /> | Hands the `onPointer` listener of a `Client` one event, in the cells of its region as every surface that draws a `Client` reports them. | Type: `(event: MountPointerEvent) => Promise<void>`. Sends a pointer event. Example: `await ui.pointer({ type: 'down', x: 2, y: 0, button: 'left' })`. |
| `post` | <Documented /> | Posts as the own `surface.post(data)` of a `Client` does: the `ui.message` hooks of the plugin run with `e.data`, and `e.surface` is this drawing. | Type: `(data: JsonValue, scope?: ClientScope) => Promise<void>`. Posts data to a `Client`. A `{ props }` answer reaches the instance, which redraws with its state kept. |
| `advance` | <Documented /> | Moves the frame clock of the drawing on: each `surface.every(ms, fn)` timer of its `Client`s fires at every interval of its own that the move crosses. | Type: `(ms: number) => Promise<void>`. Parameter `ms`: how far, in milliseconds. Example: `await ui.advance(250)`. |
| `resize` | <Documented /> | Lays the region of a `Client` out at a size, as the surface that measures it does: what its module reads as `surface.columns` and `surface.rows`. | Type: `(size: MountResizeTarget) => Promise<void>`. Parameter `size`: cells across and down, `in`: which `Client`. Example: `await ui.resize({ columns: 40, rows: 3 })`. |
| `redraw` | <Documented /> | Draws the instance again, as the engine does when its props change (the output of a tool row arrived): the `ui.render` chain with the next props. | Type: `(props?: RenderPropsOf[C]) => Promise<void>`. Draws again with new props. A plugin's own `$.ui.invalidate` needs no call. |
| `keepsBeneath` | <Documented /> | Says whether the tree as last drawn holds what `next(e)` answered, so what is beneath the plugins is drawn with it. False when a hook left it out. | Type: `() => Promise<boolean>`. Since `2.1.321`. Calling it says the test has looked, so `claude plugin test` prints no advice for this drawing, whichever answer the test expects. It rejects with `keepsBeneath: this test has its own ui.render hook at this site, so look for what it drew with find` when the tree holds a stub and the test has its own `ui.render` hook at that site (`chunk-hhh3j18b.js:36602`). Example: `expect(await ui.keepsBeneath()).toBe(true)`. |
| `unmount` | <Documented /> | Lets the drawing go, as the surface that drops the instance does: its `Client`s and their timers end. Later acts on the handle reject. | Type: `() => Promise<void>`. Example: `await ui.unmount()`. |

### `MountInputTarget`

What the `input` of a mounted drawing takes. It has the key of the Input, the text, and which of the two inputs it is (`submit` when unsaid). It also has the name of another plugin. Object with fields `key`, `text`, `kind?`, `plugin?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The `key` of the Input. | Type: `string`. |
| `text` | <Documented /> | The text to put in the field. | Type: `string`. |
| `kind` | <Documented /> | Which of the two inputs it is. `submit` when not given. | Type: `UiInputArgument['kind']`. Optional. |
| `plugin` | <Documented /> | The name of another plugin, when the Input is not that of the mounted plugin. | Type: `string`. Optional. |

### `MountPressTarget`

What the `press` of a mounted drawing takes. It has the key of the Button and a link. It also has the name of another plugin when the Button is not that of the mounted plugin. Object with fields `key`, `plugin?`, `link?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The `key` of the Button. | Type: `string`. |
| `plugin` | <Documented /> | The name of another plugin, when the Button is not that of the mounted plugin. | Type: `string`. Optional. |
| `link` | <Documented /> | Presses this link of the Markdown keyed `key` instead of a Button. | Type: `PressedLink`. Optional. |

### `MountResizeTarget`

What the `resize` of a mounted drawing takes. It has the size in cells of the region of a `Client`, as the surface that measures it hands it, and which `Client`. Object with fields `columns`, `rows`, `in?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `columns` | <Documented /> | The width of the region, in cells. | Type: `number`. |
| `rows` | <Documented /> | The height of the region, in cells. | Type: `number`. |
| `in` | <Documented /> | The `key` of the `Client` to resize. | Type: `string`. Optional. |

### `MountSelectTarget`

What the `select` of a mounted drawing takes. It has the key of the Select and the value of the picked option. It also has the name of another plugin when the Select is not its own. Object with fields `key`, `value`, `plugin?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | The `key` of the Select. | Type: `string`. |
| `value` | <Documented /> | The value of the option to pick. | Type: `string`. |
| `plugin` | <Documented /> | The name of another plugin, when the Select is not that of the mounted plugin. | Type: `string`. Optional. |

### `MountTarget`

What `$.ui.mount` takes: whose elements the test will act on, the surface that draws, and the component instance that the engine asks the plugins for. Alias of the target of `mount`: `plugin`, `surface`, `component`, `props`, `requestId?`, `viewport?`. `surface` is never defaulted. Run one body over several surfaces.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | Whose elements the acts of the handle address by bare `key`: the plugin under test, usually. An act names another plugin to reach its element. | Type: `string`. |
| `surface` | <Documented /> | What draws: its element table checks every tree that the plugins return, and every dispatch that the handle raises carries it as `e.surface`. | Type: `P`. One of `terminal`, `desktop`, `vscode`, `mobile`. |
| `component` | <Documented /> | Which component the engine asks the plugins to draw (`Pane`, `AbovePrompt`, `ToolUse`, ...): what a `ui.render` matcher narrows on. | Type: `C`. |
| `props` | <Documented /> | The props of the component, what the hook reads as `e.props`. | Type: `RenderPropsOf[C]`. |
| `requestId` | <Documented /> | The instance drawn (the id of a pane, the tool_use_id of a tool row). The kit mints one when absent. Two mounts of one component are two instances. | Type: `string`. Optional. |
| `viewport` | <Documented /> | What the surface measured, as the hook reads it under `e.viewport`. Absent when the surface has not measured, as on `e`. | Type: `RenderViewport`. Optional. Cells across and down. A `Client` starts at this size (0 by 0 when absent) until `resize` lays it out. |

### `Negatable`

A set of checks and, under `not`, the same set passing where they fail. Combines `Negatable`. Object with fields `not`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `not` | <Documented /> | The checks negated. | Type: `M`. |

### `Plugin`

A plugin that you write inline in a test. The test loads it as it loads a plugin folder. It has its name, the tier it loads in (`user` when not given), and the `register` of its hooks module. Object with fields `name`, `tier?`, `register`. `register` is written `register(on) { ... }` and is self-contained, as that of a module: it closes over nothing of the test file.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The name of the inline plugin. | Type: `string`. |
| `tier` | <Documented /> | The tier the plugin loads in. `user` when not given. | Type: `PluginTier`. Optional. |
| `register` | <Documented /> | The `register` function of its hooks module. It is self-contained and closes over nothing of the test file. | Type: `Register`. |

### `PressTarget`

What `$.ui.press` takes: the plugin whose `ui.render` hook drew the element, the `key` it gave it, the instance and surface when several, and a `link`. Object with fields `plugin`, `key`, `requestId?`, `surface?`, `link?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | The plugin whose `ui.render` hook drew the element. | Type: `string`. |
| `key` | <Documented /> | The `key` the plugin gave the element. | Type: `string`. |
| `requestId` | <Documented /> | Which instance holds it, when the plugin drew the key in several. | Type: `string`. Optional. |
| `surface` | <Documented /> | Which surface's drawing, when the key is drawn on more than one. The press carries the surface of the drawing that it lands in either way. | Type: `RenderSurface`. Optional. |
| `link` | <Documented /> | For a Markdown that answers its links: which of them the press lands on. | Type: `PressedLink`. Optional. |

### `SelectTarget`

What `$.ui.select` takes: the plugin whose hook drew the Select, its `key`, the value of the picked option, and the instance and surface when several. Object with fields `plugin`, `key`, `value`, `requestId?`, `surface?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | The plugin whose hook drew the Select. | Type: `string`. |
| `key` | <Documented /> | The `key` of the Select. | Type: `string`. |
| `value` | <Documented /> | Which option is picked, by the `value` that the Select listed it under. | Type: `string`. |
| `requestId` | <Documented /> | Which instance holds it, when the plugin drew the key in several. | Type: `string`. Optional. |
| `surface` | <Documented /> | Which surface's drawing, when the key is drawn on more than one. The pick carries the surface of the drawing that it lands in either way. | Type: `RenderSurface`. Optional. |

### `TestOptions`

What `test` takes beside its name. It has the inline plugins that it loads beside the one under test, and how long it may run (5000 ms when not given). Object with fields `plugins?`, `timeoutMs?`, `options?`. It also takes the `userConfig` values of the plugin under test.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugins` | <Documented /> | The inline plugins to load beside the one under test. | Type: `readonly Plugin[]`. Optional. |
| `timeoutMs` | <Documented /> | How long the test may run, in milliseconds. 5000 when not given. | Type: `number`. Optional. |
| `options` | <Documented /> | The `userConfig` values of the plugin under test, standing as the ones stored in settings. | Type: `PluginOptions`. Optional. `register(on, options)` receives them as in a real load, with defaults filled in. If left out, the defaults of the manifest apply. |

### `WithMessage`

An error-like value `toThrow` compares by its whole message. Object with fields `message`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `message` | <Documented /> | The whole message `toThrow` compares. | Type: `string`. |

## Related Pages

- [Testing Types](index.md)
- [Mod API Types](../index.md)
