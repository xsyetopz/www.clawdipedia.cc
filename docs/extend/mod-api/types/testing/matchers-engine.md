---
title: Testing Matcher and Engine Types
description: "Types of the matchers, the engine, element queries, found elements, and expectations of the testing module."
sidebar_position: 1
---

These types describe the matchers, the test engine, element queries, found elements, and expectations of the `claude-code/testing` module. A mod test uses them through `expect`, `$`, and a mounted drawing.

## Types with Fields

Each type below has its own table of fields.

### `AsymmetricMatcher`

A value that matches by a rule inside `toEqual` and its kin (`expect.any`, `expect.objectContaining`). A failure names the matcher by its text. It is an object with the field `text`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text that names the matcher in a failure message. | Type: `string`. Read-only. |

### `AsyncMatchers`

The same checks, applied to what a received promise settles with. Each check resolves once the promise has settled and the check passed. It is an object with the fields `[K in keyof Matchers]`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in keyof Matchers]` | <Documented /> | For each matcher, the same check as a call that returns a promise. | Type: `(...args: Parameters<Matchers[K]>) => Promise<void>`. |

### `ClientScope`

The `Client` of a mounted drawing that an act or a read means, by the `key` that its element carries. It is optional while the drawing holds exactly one `Client`. It is an object with the field `in?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `in` | <Documented /> | The `key` of the `Client` element. Optional while the drawing holds exactly one. | Type: `string`. Optional. |

### `ElementOfAct`

The element that each surface-dependent act of a mounted drawing reaches. A handle carries the act only where the table of the surface has the element. It is an object with the fields `input`, `select`, `key`, `pointer`, `post`, `advance`, and `resize`. `input` needs an `Input`, and `select` needs a `Select`. The other acts reach a `Client`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `input` | <Documented /> | The element the `input` act reaches. | Type: `'Input'`. |
| `select` | <Documented /> | The element the `select` act reaches. | Type: `'Select'`. |
| `key` | <Documented /> | The element the `key` act reaches. | Type: `'Client'`. |
| `pointer` | <Documented /> | The element the `pointer` act reaches. | Type: `'Client'`. |
| `post` | <Documented /> | The element the `post` act reaches. | Type: `'Client'`. |
| `advance` | <Documented /> | The element the `advance` act reaches. | Type: `'Client'`. |
| `resize` | <Documented /> | The element the `resize` act reaches. | Type: `'Client'`. |

### `ElementQuery`

What `find` and `findAll` of a mounted drawing match an element on. An element must match every field that you give: its tag, its `key`, and the text that it shows. It is an object with the fields `type?`, `key?`, `text?`, and `in?`. `text` matches the whole shown text: a string by inclusion, a `RegExp` by test. Since `2.1.323`, the shown text of a `Progress` is its label and its figure.[^element-query]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The tag of the element to match. | Type: `string`. Optional. |
| `key` | <Documented /> | The `key` of the element to match. | Type: `string`. Optional. |
| `text` | <Documented /> | The text that the element shows. A string matches by inclusion, and a `RegExp` matches by test. | Type: `string \| RegExp`. Optional. |
| `in` | <Documented /> | Searches what the surface module of this `Client` drew (by the key of the `Client`), instead of the plugin's own tree. | Type: `string`. Optional. |

### `Engine`

What a test holds as `$`: the engine's own `$`. Every call on it works as the calls of the REPL, the query loop, and the render sites, over every plugin. It is an object with one call for each event noun, plus `classic`. `next.origin` is the engine. `$.ui.mount` draws an instance. `press`, `input`, and `select` act on the instance.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[N in keyof EventCalls]` | <Documented /> | One entry for each noun in `EventCalls`. | Type: `N extends 'ui' ? EngineNoun<N> & EnginePress & EngineInput & EngineSelect & EngineMount : EngineNoun<N>`. |
| `classic` | <Documented /> | The classic events, raised as the engine raises them. | Type: `EngineClassic`. |

### `EngineClassic`

The classic (settings) hook events as the engine raises them. Each is a call that runs the `classic.<Event>` chain over every plugin that hooks it. It is an object with one call for each classic event. The `on('classic.<Event>')` of the test is the bottom of the chain. Example: `await $.classic.SessionStart({ source: 'clear' })`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[E in ClassicEvent]` | <Documented /> | For each classic event, a call that runs the `classic.*` chain and resolves to the result. | Type: `` (e: ClassicFields<E>) => Promise<ClassicResultOf[`classic.${E}`]> ``. |

### `EngineInput`

A surface that types into an `Input` that a test rendered. The `ui.input` chain runs over every plugin that hooks it, with the `Input`'s own handler last. It is an object with the field `input`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `input` | <Documented /> | Types into the `Input`, as an edit (`kind` `change`, which reaches `onInput`) or as Enter (`submit`, the default, which reaches `onSubmit`) with that text. | Type: `(target: InputTarget) => Promise<UiInputResult \| undefined>`. Types text into an `Input`. Rejects if no such input is drawn, or several are and none is named. |

### `EngineMount`

A surface that draws a component instance through the plugins. The test then drives the instance by key through a handle that the surface types (`Mounted`). It is an object with the field `mount`. It raises `ui.render` for those props, checks the tree, and runs its `Client` modules.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `mount` | <Documented /> | Raises the drawing of the component by the plugins on the surface and holds it, as the surface does when it shows the instance. | Type: `<P extends RenderSurface, C extends RenderComponent>(target: MountTarget<P, C>) => Promise<Mounted<P, C>>`. Draws a component on a surface. Rejects if the surface cannot draw the tree. |

### `EngineNoun`

One noun of the `$` of the engine, with each of its events as the engine calls it. `tool.call` is typed for each tool (`EngineToolCall`), and `ui.render` for each component. `ui.resolve` is not included. It is an object with the fields `[V in EngineNounEvent<N>]`. `skill.prompt` takes the input of a call. You may leave out its frontmatter and source, as a test written before the event carried them does.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[V in EngineNounEvent<N>]` | <Documented /> | One entry for each event of that noun. | Type: `` `${N}.${V}` extends 'tool.call' ? EngineToolCall : `${N}.${V}` extends 'ui.render' \| 'skill.prompt' ? EventCalls[N][V] : EngineCall<`${N}.${V}` & EventName> ``. |

### `EnginePress`

A surface that presses a `Button` that a test rendered, or a link of a `Markdown` element. The `ui.press` chain runs over every plugin that hooks it, with its own closure last. It is an object with the field `press`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `press` | <Documented /> | Presses the `Button`, as a click or its hotkey does. With `link`, it presses the link of the `Markdown` element, as a click on the link does. | Type: `(target: PressTarget) => Promise<UiPressResult \| undefined>`. Presses an element. Resolves once all the work that `onPress` started has settled. Rejects if no such element is drawn. |

### `EngineSelect`

A surface that picks an option of a `Select` that a test rendered. The `ui.select` chain runs over every plugin that hooks it, with the `Select`'s own `onSelect` last. It is an object with the field `select`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `select` | <Documented /> | Picks the option, as choosing it on the surface does. It resolves once the chain, `onSelect`, and the work that they started have settled. | Type: `(target: SelectTarget) => Promise<UiSelectResult \| undefined>`. Picks a value in a `Select`. Example: `await $.ui.select({ plugin: 'notes', key: 'sort', value: 'date' })`. |

### `Expectation`

What `expect(received)` answers: the checks, their negation, and the checks on what a received promise resolves or rejects with. It combines `Expectation`, `Negatable`, and `Matchers`. It is an object with the fields `resolves` and `rejects`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `resolves` | <Documented /> | The checks on what the received promise resolves with. A rejection fails them. | Type: `Negatable<AsyncMatchers>`. |
| `rejects` | <Documented /> | The checks on what the received promise rejects with. A resolution fails them. | Type: `Negatable<AsyncMatchers>`. |

### `FoundElement`

One element of a mounted drawing as `find` returns it. It is the description that the hook of the plugin (or the module of a `Client`) built, read as plain data. It is an object with the fields `type`, `key`, `props`, `text`, and `children`. It is what each surface receives to draw, and it is the same on every surface. It is not what the surface painted. Since `2.1.323`, a `Progress` is `Box` and `Text` on every surface except mobile.[^found-element]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The tag of the element: `Box`, `Text`, `Button`, `Input`, `Client`, ... | Type: `string`. |
| `key` | <Documented /> | The `key` that its props carry, when they carry one. | Type: `string \| undefined`. |
| `props` | <Documented /> | Its props, as plain data: the `label` of a `Button`, the `color` of a `Text`, and so on. Handlers never cross, so the `onPress` of a `Button` is not here. | Type: `Record<string, unknown>`. |
| `text` | <Documented /> | The text that the element shows. It is its string children in document order and, for the leaves that draw a prop as text, that prop (`ElementQuery` `text`). | Type: `string`. |
| `children` | <Documented /> | Its children as drawn: strings and element descriptions. | Type: `unknown[]`. |

### `InputTarget`

What `$.ui.input` takes. It names the plugin whose hook drew the `Input`, its `key`, the text of the field, and the kind of input. When the key is drawn more than once, it also names the instance and the surface. It is an object with the fields `plugin`, `key`, `text`, `kind?`, `requestId?`, and `surface?`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | The plugin whose hook drew the `Input`. | Type: `string`. |
| `key` | <Documented /> | The `key` of the `Input`. | Type: `string`. |
| `text` | <Documented /> | The whole text of the field at that moment: `e.value` for the chain. | Type: `string`. |
| `kind` | <Documented /> | `submit` (the default) is Enter with that text, and it reaches `onSubmit`. `change` is one edit that leaves the text in the field, and it reaches `onInput`. | Type: `UiInputArgument['kind']`. Optional. A user who types makes a run of `change` edits, then a `submit`. |
| `requestId` | <Documented /> | The instance that holds the `Input`, when the plugin drew the key in several instances. | Type: `string`. Optional. |
| `surface` | <Documented /> | The surface of the drawing, when the key is drawn on more than one surface. The input carries the surface of the drawing that it lands in either way. | Type: `RenderSurface`. Optional. |

### `Matchers`

The checks that `expect(received)` offers. Each throws an `AssertionError` when it fails, and the error names what was expected and what was received. It is an object with 23 matchers: the `toBe` family, the `toContain` family, `toHaveLength`, `toHaveProperty`, `toMatch`, `toStartWith`, `toEndWith`, `toBeInstanceOf`, and `toThrow`. The full list is in the `.d.ts` file.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `toBe` | <Documented /> | Passes when received is the value, by `Object.is`. | Type: `(expected: unknown) => void`. Parameter `expected`: the value. |
| `toEqual` | <Documented /> | Passes when received equals the value in structure. It ignores properties that hold undefined. `expect.any` and its kin match inside it. | Type: `(expected: unknown) => void`. Parameter `expected`: the value. |
| `toStrictEqual` | <Documented /> | Works as `toEqual`, but undefined properties and prototypes count. | Type: `(expected: unknown) => void`. Parameter `expected`: the value. |
| `toMatchObject` | <Documented /> | Passes when received holds at least the properties of the object, with equal values. | Type: `(expected: object) => void`. Parameter `expected`: the object. |
| `toContain` | <Documented /> | Passes when a string received includes the item, or an iterable received has an element that is it. | Type: `(item: unknown) => void`. Parameter `item`: the substring or element. |
| `toContainEqual` | <Documented /> | Passes when an iterable received has an element equal to the item. | Type: `(item: unknown) => void`. Parameter `item`: the element. |
| `toHaveLength` | <Documented /> | Passes when the `length` of received is the number. | Type: `(length: number) => void`. Parameter `length`: the number. |
| `toHaveProperty` | <Documented /> | Passes when received holds a property at the path (`a.b`, or the keys in order), equal to the value when you give one. | Type: `(path: string \| readonly string[], value?: unknown) => void`. Parameter `path`: the path of the property. Parameter `value`: what it must equal, when you give it. |
| `toBeUndefined` | <Documented /> | Passes when received is undefined. | Type: `() => void`. |
| `toBeDefined` | <Documented /> | Passes when received is anything but undefined. | Type: `() => void`. |
| `toBeNull` | <Documented /> | Passes when received is null. | Type: `() => void`. |
| `toBeTruthy` | <Documented /> | Passes when received is truthy. | Type: `() => void`. |
| `toBeFalsy` | <Documented /> | Passes when received is falsy. | Type: `() => void`. |
| `toBeNaN` | <Documented /> | Passes when received is NaN. | Type: `() => void`. |
| `toBeGreaterThan` | <Documented /> | Passes when received is greater than the bound. | Type: `(bound: number \| bigint) => void`. Parameter `bound`: the bound. |
| `toBeGreaterThanOrEqual` | <Documented /> | Passes when received is the bound or greater. | Type: `(bound: number \| bigint) => void`. Parameter `bound`: the bound. |
| `toBeLessThan` | <Documented /> | Passes when received is less than the bound. | Type: `(bound: number \| bigint) => void`. Parameter `bound`: the bound. |
| `toBeLessThanOrEqual` | <Documented /> | Passes when received is the bound or less. | Type: `(bound: number \| bigint) => void`. Parameter `bound`: the bound. |
| `toMatch` | <Documented /> | Passes when a string received includes the text, or the pattern matches it. | Type: `(pattern: string \| RegExp) => void`. Parameter `pattern`: the text or pattern. |
| `toStartWith` | <Documented /> | Passes when a string received starts with the prefix. | Type: `(prefix: string) => void`. Parameter `prefix`: the prefix. |
| `toEndWith` | <Documented /> | Passes when a string received ends with the suffix. | Type: `(suffix: string) => void`. Parameter `suffix`: the suffix. |
| `toBeInstanceOf` | <Documented /> | Passes when received is an instance of the class. | Type: `(expected: Constructor) => void`. Parameter `expected`: the class. |
| `toThrow` | <Documented /> | Passes when calling received throws (or, under `rejects`, the rejection is) an error as described: by substring, pattern, class, or message. | Type: `(expected?: ThrowExpectation) => void`. Parameter `expected`: the description. Any throw passes when you give no description. |

### `Matching`

The matchers that stand inside an expected value. Each one matches received there by a rule instead of by equality. It is an object with the fields `any`, `anything`, `stringContaining`, `stringMatching`, `objectContaining`, and `arrayContaining`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `any` | <Documented /> | Matches any instance of the class, a primitive by its wrapper (`expect.any(Number)`). | Type: `(expected: Constructor) => AsymmetricMatcher`. Parameter `expected`: the class. Returns: the matcher. |
| `anything` | <Documented /> | Matches anything but null and undefined. | Type: `() => AsymmetricMatcher`. Returns: the matcher. |
| `stringContaining` | <Documented /> | Matches a string that includes the text. | Type: `(text: string) => AsymmetricMatcher`. Parameter `text`: the substring. Returns: the matcher. |
| `stringMatching` | <Documented /> | Matches a string that the pattern matches. | Type: `(pattern: string \| RegExp) => AsymmetricMatcher`. Parameter `pattern`: the pattern, or the source of one. Returns: the matcher. |
| `objectContaining` | <Documented /> | Matches an object that holds at least the properties of the shape, with equal values. | Type: `(shape: object) => AsymmetricMatcher`. Parameter `shape`: the properties. Returns: the matcher. |
| `arrayContaining` | <Documented /> | Matches an array holding an element equal to each of the items. | Type: `(items: readonly unknown[]) => AsymmetricMatcher`. Parameter `items`: the elements. Returns: the matcher. |

## Related Pages

- [Testing Types](index.md)
- [Mod API Types](../index.md)

## Sources

[^element-query]: The type file `schemas/claude-code.d.ts`, `ElementQuery`.
[^found-element]: The type file `schemas/claude-code.d.ts`, `FoundElement`.
