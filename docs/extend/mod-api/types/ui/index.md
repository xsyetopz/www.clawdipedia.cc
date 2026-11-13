---
title: UI Types
description: "Types of $.ui, the element props, and the client modules: Box, Text, Button, panes, and render inputs."
sidebar_position: 11
---

These are the types of `$.ui`, the element props, and the client modules.
They describe `Box`, `Text`, `Button`, and the other elements that a mod can draw.
They also cover images, inputs, links, panes, scroll targets, selections, and render inputs.

## Pages

| Page | What is in it |
| --- | --- |
| [UI Element Props Types](element-props.md) | `AskOptions` to `ImageSource`: ask options and the props of `Box`, `Button`, `Client`, `Code`, and `Image`. |
| [UI Input, Pane, and Render Types](input-pane-render.md) | `InputProps` to `RenderViewport`: `Input`, `Link`, `Markdown`, notify options, panes, `Raster`, and render inputs. |
| [UI Select, Text, and Focus Types](select-text-focus.md) | `ResolveInputOf` to `UiFocusResult`: `Select`, `Svg`, `Text`, toasts, blit, copy, fault, and focus types. |
| [UI Call Argument and Result Types](call-arguments.md) | `UiInputArgument` to `UserMessageTask`: the arguments and results of the input, log, message, pane, press, scroll, and select calls. |

## Example

This element draws a button that copies a URL to the clipboard when pressed.

```tsx
<Button key="save" onPress={() => $.ui.copy({ text: url })}>
  Copy
</Button>;
```

## Types without Fields

These types are aliases, unions, or plain shapes. Each row gives its use and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `ClientElements` | <Documented /> | The element table that a surface module draws with, `surface.elements`. It is the table of the terminal (Elements) less `Client` (none nests), `Raster`, `Image` and, since `2.1.323`, `Progress`. | Alias of the terminal element table without `Client`, `Raster`, `Image`, and, since `2.1.323`, `Progress`. A tree has bounds: 20,000 nodes, 32 deep, 100,000 characters. |
| `ClientModule` | <Documented /> | The component that a surface module exports (default, or its one PascalCase export). It maps props and surface to the tree drawn (no nested `Client`). | Alias of a function `(props, surface) => RenderElement`. It runs on the drawing thread, for a second for each call at most. A throw or an overrun unmounts it. |
| `ClientPointerType` | <Documented /> | What the pointer did over the region of a `Client`. A button went down, the pointer moved, the button came up, or the pointer crossed the edge of the region. | Alias of `'down' \| 'move' \| 'up' \| 'enter' \| 'leave'`. |
| `Color` | <Documented /> | What a prop that paints may hold. It is a theme key, which follows the theme of the person, or any other string, a raw color (a name such as `"red"`, or hex). | Alias of `ThemeKey \| (string & {})`. The keys are named so that an editor lists them. Every string is admitted. What a surface draws for one that it does not know is its own choice. |
| `ElementConstructor` | <Documented /> | An element as `$.ui.resolve(e)` hands it out. It is a constructor from props to the frozen plain-data element, with `children` among the props as JSX passes. | Alias of `(props: P & ElementChildren) => RenderElement`. `const { Box } = $.ui.resolve(e)` then `<Box gap={1}>` compiles to a call of `h`. |
| `Elements` | <Documented /> | The primitive tags of each surface and their prop types, by `e.surface`, for the surfaces that the plugin was compiled against. | Interface with the members `terminal`, `desktop`, `mobile`, `vscode`. A new surface adds its table by declaration merging. Since `2.1.323`, each table has `Progress`. The terminal table is "the nine every surface here carries, and `Client`", and the desktop table is "the nine, `Svg`, and `Client`" (before: lists of the elements by name). Used by `$.ui.resolve`. |
| `ElementTable` | <Documented /> | The table that `ui.resolve` answers for an argument of surface `P`. | Generic alias of `Elements[P]`. Used by `ui.resolve`. |
| `InvalidatableEventName` | <Documented /> | What `$.ui.invalidate` takes: a render event, or, since `2.1.323`, one of the seven events (before, six) whose answers the engine caches for the session. | Alias of the render event names plus `prompt.section`, `prompt.context`, `prompt.attachment`, `tool.describe`, `tool.list` (since `2.1.323`), `command.describe`, and `config.describe`. Used by `$.ui.invalidate`. |
| `PaneCloseArgs` | <Documented /> | The argument of `$.ui.close`: the pane to close (`{ id }`). The engine sets `origin`. The hooks read `plugin` for the call of a plugin. | Alias of `Omit<PaneCloseInput, 'origin'>`. Used by `$.ui.close`. |
| `RenderChildren` | <Documented /> | What an element takes as `children`, as JSX passes them. It is a node, a number (drawn as its string), a value that the factory drops, or a list that may nest. | Alias of `RenderNode` plus numbers, booleans, `null`, `undefined`, and nested lists. `false`, `null`, and `undefined` are dropped, so `{ok && <Text>hi</Text>}` works. |
| `RenderComponent` | <Documented /> | Everything that `ui.render` can draw: one name for each component that has a render site. A matcher narrows on it. | Alias of the names of the 17 components a plugin may draw, from `AskUserQuestion` to `Placed`. Since `2.1.323`, `AbovePromptList` is one of them: the band's arrangement of its `AbovePrompt` rows. The engine alone draws the permission dialog. Used by `$.ui.render`. |
| `RenderEventName` | <Documented /> | The render event: `ui.render`, one event for every component that has a render site. | Alias of `'ui.render'`. |
| `RenderInput` | <Documented /> | The input of `ui.render`: a union discriminated by `component`, with one member for each RenderComponent and each RenderSurface. | Generic alias of `C extends RenderComponent ? P extends RenderSurface ? RenderInputOf<C, P> : never : never`. Used by `ui.render`, `$.ui.render`. |
| `RenderNode` | <Documented /> | A node of a render tree: an element, or a string (text). | Alias of `RenderElement \| string`. |
| `RenderPropsOf` | <Documented /> | The plain-data props of each renderable component, as `ui.render` sees them under `e.props`. A hook rewrites them with `next({ ...e, props })`. | A component checks a rewrite. An invalid rewrite draws the original. This is the render contract for plugins. |
| `RenderSurface` | <Documented /> | The surface that the component of a render event is drawn on, by name. Plugins draw into surfaces. They do not provide them. | Alias of `keyof Elements & string`. The surfaces: `terminal`, `desktop`, `mobile`, and `vscode`. A host with no attached surface displays nothing drawn. Used by `$.session.surfaces`. |
| `ResolveInput` | <Documented /> | The input of `ui.resolve`: the elements of which surface, for which component. It is a union with one member for each surface (ResolveInputOf). | Alias that picks the input type for a component and a surface. It names the surface and the component, not the props. Used by `$.ui.resolve`, `ui.resolve`. |
| `Space` | <Documented /> | Spacing of a `Box`: a number of character cells, or a step name (`xs`, `sm`, `md`, `lg`, `xl`). The terminal and VS Code draw steps as cells. Desktop and phones use their own scale. | Alias of `number \| 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl'`. |
| `ThemeKey` | <Documented /> | The theme keys named for what a color means: text, status, the prompt box and its modes, and diffs. The custom theme reference lists them. | Alias of theme color names such as `'text'`, `'error'`, `'success'`, `'warning'`, `'permission'`, and `'diffAdded'`. A tree that names one follows the theme of the person. |
| `UiBlitArgs` | <Documented /> | What the `$.ui.blit(args)` of a plugin takes: the next `cells` of a Raster (RasterBlitArgs) or the next `source` of a keyed Image (ImageBlitArgs). | Alias of `RasterBlitArgs \| ImageBlitArgs`. It names an element that the own `ui.render` hook of this plugin drew. A hook may rewrite the cells or source, not the address. Used by `$.ui.blit`. |
| `UiFaultPhase` | <Documented /> | When a `Client` failed, as `ui.fault` names it. It is a closed set that a matcher narrows on. | Alias of `'load' \| 'render' \| 'run'`. `load` is before the module ran. `render` is while drawing. `run` is in a listener, timer, or handler. |
| `UiFaultResult` | <Documented /> | What a `ui.fault` hook returns and what `next(e)` resolves to: `{}`. It means the fault was heard. | Alias of `Record<string, never>`. Observe only. The engine then draws the site again. The `ui.render` hook of the plugin falls back by leaving the `Client` out. Used by `ui.fault`. |
| `UiFocusComponent` | <Documented /> | The render components whose site keeps a focus ring: the body of a pane and the band above the prompt. Each is a ring over the elements that hooks drew there. | Alias of `'Pane' \| 'AbovePrompt'`. |
| `UiLogSink` | <Documented /> | Where a `$.ui.log` line goes. `transcript` is a dim row of its own (and the debug log, as every line). `debug` is the debug log alone, with nothing on screen. | Alias of `'transcript' \| 'debug'`. The debug log is `claude --debug` or the `--debug-file`. In either case the name of the plugin leads the line. Used by `ui.log`. |
| `UiScrollBlock` | <Documented /> | Where in its scrollable a revealed row lands, as the `scrollIntoView({ block })` of the DOM names it. | Alias of `'start' \| 'center' \| 'end' \| 'nearest'`. `nearest` moves the least that displays the row whole. A row taller than the window displays its top. |
| `UiScrollComponent` | <Documented /> | The render components whose site the engine scrolls: the body of a pane and the band above the prompt. Each is a window over the tree that a hook drew there. | Alias of `'Pane' \| 'AbovePrompt'`. |

## Related Pages

- [Mod API Overview](../../index.md)
- [UI Methods](../../ui/ui.md)
- [UI Events](../../ui/ui-events.md)
- [Surfaces, Elements, and Render Sites](../../ui/ui-elements.md)
- [Mod API Types](../index.md)
