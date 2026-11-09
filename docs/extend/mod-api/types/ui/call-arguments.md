---
title: UI Call Argument and Result Types
description: "Types of the arguments and results of the other $.ui calls: input, log, message, press, scroll, and select."
sidebar_position: 4
---

## Types with Fields

Each type below has its own table of fields.

### `UiInputArgument`

The argument of `ui.input`: a change of, or a submit from, an `Input` that a render hook drew. Flat and frozen like every event argument. Another plugin addresses one field by matcher: `on("ui.input", { plugin: "roster", element: "reply" }, ...)`. Used by `ui.input`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | Whose `ui.render` hook drew the element. | Type: `string`. |
| `element` | <Documented /> | The `key` that the hook gave its `Input`: its address, what a matcher names. | Type: `string`. |
| `component` | <Documented /> | The render component that the element was drawn in (`AbovePrompt`, `ToolUse`, ...). | Type: `RenderComponent`. |
| `requestId` | <Documented /> | The instance that the element was drawn in. It is the `requestId` that the `ui.render` hook that drew it saw (the tool_use_id of a tool row, or the id of a pane). | Type: `string`. |
| `surface` | <Documented /> | Where the typing came from, one literal for each member, so `if (e.surface === "terminal")` narrows `e`. | Type: `RenderSurface`. |
| `kind` | <Documented /> | `change` after every edit of the text, `submit` on Enter. | Type: `'change' \| 'submit'`. |
| `value` | <Documented /> | The whole text of the field at that moment. A hook above may rewrite it for the plugins beneath and the own handler of the element. | Type: `string`. A field of several lines joins them with `\n`. A submit trims nothing. |

### `UiInputResult`

What a `ui.input` hook returns and what `next(e)` resolves to. Core runs the `onInput` (kind `change`) or `onSubmit` (kind `submit`) closure of the element and answers `{ element, value }`. Used by `ui.input`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `element` | <Documented /> | Which handler the input reached, by the `key` of its Input. | Type: `string`. |
| `value` | <Documented /> | The text the handler received. | Type: `string`. |

### `UiLogOptions`

Options of `$.ui.log`. Used by `$.ui.log`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | Where the line goes (UiLogSink). It is `transcript` when left out. A hook on `ui.log` reads it as `e.to` and may send the line elsewhere. | Type: `UiLogSink`. Optional. |

### `UiMessageArgument`

The argument of `ui.message`: what the surface module of a `Client` instance posted (`surface.post(data)`), addressed by where the instance is drawn. The origin is `client`, so `data` is input to check, not a fact. A hook may not rewrite the other fields. Used by `ui.message`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where the instance is drawn: `terminal`, or `desktop` once it has them. | Type: `RenderSurface`. |
| `component` | <Documented /> | The render component the `Client` was drawn in (`AbovePrompt`, `Pane`, ...). | Type: `RenderComponent`. |
| `requestId` | <Documented /> | The id of the engine for the drawing that the `Client` sits in: the `requestId` that the `ui.render` hook that drew it saw. | Type: `string`. |
| `element` | <Documented /> | The `key` of the `Client`: which instance posted. | Type: `string`. |
| `module` | <Documented /> | The `module` of the `Client`: which surface module runs there, as its path under the folder of the plugin. | Type: `string`. |
| `data` | <Documented /> | What the instance posted: plain data (JsonValue) of at most 100000 characters, typed `unknown` because it came from code. A hook can rewrite it. | Type: `unknown`. |

### `UiMessageResult`

What a `ui.message` hook returns and what `next(e)` resolves to. Core answers `{}`. A hook that answers `{ props }` hands the posting instance its next props with no `ui.render` run. Used by `ui.message`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `props` | <Documented /> | The next props of the instance, as plain data (JsonValue) bounded as the props of a `Client` are. If absent, the props of the instance stay as they were. | Type: `unknown`. Optional. |

### `UiNotifyResult`

What `$.ui.notify` resolves to and what the `{ value }` of a `ui.notify` hook holds. It says whether a channel sent it (`isSent`) and which, else why not. Example: `if (!(await $.ui.notify(text)).isSent) $.ui.toast(text)`. Used by `$.ui.notify`, `ui.notify`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isSent` | <Documented /> | True: the notification channel of the person wrote it to their terminal, as its notification sequence, its bell, or both. | Type: `true`. A terminal does not report back. One that drops the sequence, or a system that mutes its banners, still reads true. |
| `channel` | <Documented /> | Which channel sent it, spelt as the `preferredNotifChannel` setting spells it. Under `auto`, it is the one that their terminal resolved to. | Type: `'iterm2' \| 'iterm2_with_bell' \| 'kitty' \| 'ghostty' \| 'terminal_bell' \| 'client'`. `terminal_bell` rings and displays neither the text nor the title. Since `2.1.321`, `client` means a host that raises notifications was handed it to raise, and it does not report back. A terminal sends the text as given. A host gets it cleaned and cut to 1,000 characters. With no terminal, the `Notification` hooks run, then such a host is handed it (`captures/2.1.321/types.diff`). |
| `isSent` | <Documented /> | False: no channel sent it. | Type: `false`. |
| `reason` | <Documented /> | Why not. It is a closed set: `disabled`, `no-channel`, `no-surface` or `refused`. A hook above says `refused` when it answers without sending. | Type: `'disabled' \| 'no-channel' \| 'no-surface' \| 'refused'`. `disabled` means `notifications_disabled` is set. `no-channel` means no terminal that notifies. Since `2.1.321`, `no-surface` means no terminal and no host that raises notifications (a `-p` run, the SDK, a cloud session), no session bound yet, the session is exiting, or the mod unloaded before the notification went out. |

### `UiOpenResult`

What `$.ui.open` resolves to and what the `{ value }` of a `ui.open` hook holds. `isPlaced` says if a surface draws the pane now. Asked panes place at any width. Unasked panes need 144 columns (110 for an id that the person opened before).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isPlaced` | <Documented /> | True: the pane is open and drawn (or retitled in place). The first `ui.render` for `{ component: "Pane", requestId: id }` follows. | Type: `true`. |
| `isPlaced` | <Documented /> | False: the pane is open but undrawn. It was opened unasked on a narrow terminal, or where no surface places panes, or none is attached. | Type: `false`. With none attached, keep the pane, which stays open. `session.attach` is raised when one is attached. `$.ui.panes()` then says placed, and a surface that places panes asks the `ui.render` of the pane. |
| `reason` | <Documented /> | Why it waits and what seats it. It has the floor that it fell under (144 columns unasked, 110 for an id that the person once opened) and the width now. | Type: `string`. Says why a pane is not placed. It starts with `no-surface` when no surface is attached, such as in a `-p` run. |

### `UiPane`

One of the open panes of this plugin as `$.ui.panes()` lists it. It has the id and title of the pane, and where it stands with the person right now. Where the surface seated the pane (`dock` or `inline`) is on the `Pane` render props. Used by `$.ui.panes`, `ui.panes`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | What `$.ui.open({ id })` named it. `$.ui.close` and its `ui.render` `requestId` name it too. | Type: `string`. |
| `title` | <Documented /> | The label of its tab: the `title` of its latest open, or the id. | Type: `string`. |
| `isShown` | <Documented /> | True for the one pane that the surface displays. The rest are tabs behind it. | Type: `boolean`. |
| `isFocused` | <Documented /> | True while the person has given it the keyboard. | Type: `boolean`. |
| `isPlaced` | <Documented /> | False while it waits undrawn. It was opened unasked on a terminal too narrow for an unrequested pane, and its `$.ui.open` answered `{ isPlaced: false }`. | Type: `boolean`. It turns true when the person opens the pane or the terminal widens to the floor. It is false on every row while an open answers `no-surface`. |

### `UiPlaceArgs`

The argument of `$.ui.place`. A `ui.render` hook reads the `id` as `e.props.id`. Used by `$.ui.place`, `ui.place`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Undocumented /> | Names the row among this plugin's rows. | Type: `string`. 1 to 64 letters, digits, `_`, and `-`, as the id of a pane. New in `2.1.314`. |

### `UiPlaceResult`

What `$.ui.place` resolves to and what the `{ value }` of a `ui.place` hook holds. The row stands in the conversation in both cases, except past the cap and with no conversation, where there is no `requestId`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isPlaced` | <Undocumented /> | True: a surface is attached to draw the row. | Type: `true`. New in `2.1.314`. |
| `requestId` | <Undocumented /> | The `e.requestId` of the row at `ui.render`. `$.ui.scroll` takes it. | Type: `string`. New in `2.1.314`. |
| `isPlaced` | <Undocumented /> | False: nothing draws the row now. | Type: `false`. New in `2.1.314`. |
| `requestId` | <Undocumented /> | The id of the row when it stands for a surface that is not attached yet. | Type: `string`. Optional. New in `2.1.314`. |
| `reason` | <Undocumented /> | Why nothing draws it, in one line to show or log. | Type: `string`. New in `2.1.314`. |

### `UiPressArgument`

The argument of `ui.press`: a press on a `Button` that a render hook drew, or on an answered `Markdown` link. Flat and frozen like every event argument. Another plugin addresses one button by matcher: `on("ui.press", { plugin: "explainer", element: "explain" }, ...)`. Used by `ui.press`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | Whose `ui.render` hook drew the element. | Type: `string`. |
| `element` | <Documented /> | The `key` that the hook gave its `Button` or `Markdown`: its address, what a matcher names. | Type: `string`. |
| `component` | <Documented /> | The render component that the element was drawn in (`ToolUse`, `AssistantMessage`, ...). | Type: `RenderComponent`. |
| `requestId` | <Documented /> | The instance that the element was drawn in. It is the `requestId` that the `ui.render` hook that drew it saw (the tool_use_id of a tool row, or the id of a pane). | Type: `string`. |
| `surface` | <Documented /> | Where the press came from, one literal for each member, so `if (e.surface === "terminal")` narrows `e`. | Type: `RenderSurface`. |
| `link` | <Documented /> | Where the press landed, when the element is a `Markdown` whose links its plugin answers (`onLinkPress`). Absent for a `Button`. | Type: `PressedLink`. Optional. A hook may rewrite its `href` for the hooks and the closure beneath. A hook that adds or drops it fails, and the press goes on beneath it. |

### `UiPressResult`

What a `ui.press` hook returns and what `next(e)` resolves to. Core runs the `onPress` closure of the element and answers `{ element }`. Used by `ui.press`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `element` | <Documented /> | Which handler the press reached, by the `key` of its Button. | Type: `string`. |

### `UiScrollArgs`

What the `$.ui.scroll(args)` of a plugin takes: what to bring into view, in which of its sites, and where in the window it lands. The engine resolves it to a window and an offset. A transcript row displays only while the plugin answers the own input of the person. Used by `$.ui.scroll`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | What to reveal (UiScrollTarget): a render instance by `requestId`, one of the elements of this plugin by `key`, or the `start` or `end` of `in`. | Type: `UiScrollTarget`. |
| `in` | <Documented /> | The site to scroll, by the `requestId` that this plugin draws it under: the id of one of its panes, or the id of the band. | Type: `string`. Optional. Required with `start` and `end`. With `{ key }` it picks the site when the key is drawn in several. |
| `block` | <Documented /> | Where the target lands in the window (UiScrollBlock). It is `nearest` when left out, so a row that is already on screen does not move. | Type: `UiScrollBlock`. Optional. |

### `UiScrollInput`

The input of `ui.scroll`: the window of a site, asked to move. It moves over the tree that a hook drew in it (the body of a pane, the band above the prompt). Every key but `offset` is pinned. A rewrite that changes one fails the hook. Used by `ui.scroll`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `component` | <Documented /> | Which site: a `Pane` body or the `AbovePrompt` band. | Type: `UiScrollComponent`. |
| `requestId` | <Documented /> | The instance that the `ui.render` hook that draws the site sees: the id of the pane, or the one id of the band. | Type: `string`. |
| `offset` | <Documented /> | The first row that the window is to show, 0 at the top. It is the row that it shows now plus `by`, clamped to the tree, or where `$.ui.scroll` resolved. | Type: `number`. `next({ ...e, offset })` moves it elsewhere (a clamp). One past the end of the tree lands at the end. Nothing has moved when a hook reads it. |
| `by` | <Documented /> | The rows that the move asks for, signed, negative toward the top. It is what the `scrollBy` of the DOM takes. Read-only. | Type: `number`. The scroll distance. A wheel tick is `-1` or `1`. A page key is `bodyRows`. Home and End are `contentRows`. |
| `bodyRows` | <Documented /> | How many rows of the tree the window displays at once, as drawn now. Read-only. | Type: `number`. |
| `contentRows` | <Documented /> | How many rows the tree has, as drawn now. The last offset of the window is `contentRows - bodyRows`, and none when the tree fits. Read-only. | Type: `number`. |
| `origin` | <Documented /> | Who moves it (UiScrollOrigin). The engine sets it where the move starts. | Type: `UiScrollOrigin`. |
| `pointer` | <Documented /> | The body cell that the wheel or trackpad of the person was over (UiScrollPointer). Absent for the scroll keys and for `$.ui.scroll`. Read-only. | Type: `UiScrollPointer`. Optional. Tells a tick over the own list of a hook from a tick over the body. |

### `UiScrollOrigin`

Who moves the window at `ui.scroll`, as the engine stamps it where the move starts. It is a closed set that a matcher narrows on. `next(e)` passes it on as received. No hook sets one.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The person, with the wheel over the site or its scroll keys while they hold it. | Type: `'person'`. |
| `kind` | <Documented /> | The `$.ui.scroll` of a plugin. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the scrolling plugin. | Type: `string`. |

### `UiScrollPointer`

The cell that the pointer was over when the wheel of the person raised `ui.scroll`, in the body of the site. The body is the box that its `ui.render` hook draws into, as painted. It is the pointer position in cells, measured from the top of the body. The window offset is not added.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `column` | <Documented /> | 0 at the left edge of the body, as `bodyColumns` counts them. It is negative, or `bodyColumns` and past, over the sides of an inline pane or the `[-]` of the band. | Type: `number`. |
| `row` | <Documented /> | 0 at the first row of the body on screen, as `bodyRows` counts them. | Type: `number`. The row under the pointer. It is negative above the body and `bodyRows` or more below it. |

### `UiScrollResult`

What a `ui.scroll` hook returns, what `next(e)` resolves to, and what `$.ui.scroll` hands back: `{}` once the window moved, or why it did not. Used by `$.ui.scroll`, `ui.scroll`. Since `2.1.321`, `{}` does not say the person saw the move: a band folded away shows nothing, and the closed Mods sheet of a mobile app shows nothing and keeps nothing (`captures/2.1.321/types.diff`).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Absent when the window is where the chain left it, else why nothing moved, as `tool.call` and `config.set` spell a refusal. | Type: `string`. Optional. Says why nothing scrolled: a hook kept the window, the target is not of this plugin, or another move came first. With no surface `no-surface` heads it. |

### `UiScrollTarget`

What `$.ui.scroll` brings into view: never a row number, always a thing drawn somewhere. `{ requestId }` names a render instance. `{ key }` names an element that this plugin drew. `start` and `end` are the top and bottom of the site.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `requestId` | <Documented /> | The ID of a render instance, as its `ui.render` hook saw it. | Type: `string`. |
| `key` | <Documented /> | The `key` of an element that this plugin drew. | Type: `string`. |

### `UiSelectArgument`

The argument of `ui.select`: a pick from a `Select` that a render hook drew. Flat and frozen like every event argument. Another plugin addresses one picker by matcher: `on("ui.select", { plugin: "roster", element: "peer" }, ...)`. Used by `ui.select`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | Whose `ui.render` hook drew the element. | Type: `string`. |
| `element` | <Documented /> | The `key` that the hook gave its `Select`: its address, what a matcher names. | Type: `string`. |
| `component` | <Documented /> | The render component that the element was drawn in (`AbovePrompt`, `ToolUse`, ...). | Type: `RenderComponent`. |
| `requestId` | <Documented /> | The instance that the element was drawn in. It is the `requestId` that the `ui.render` hook that drew it saw (the tool_use_id of a tool row, or the id of a pane). | Type: `string`. |
| `surface` | <Documented /> | Where the pick came from, one literal for each member, so `if (e.surface === "terminal")` narrows `e`. | Type: `RenderSurface`. |
| `value` | <Documented /> | The value of the picked option. A hook above may rewrite it for the plugins beneath and the own handler of the element. | Type: `string`. |

### `UiSelection`

What the person has selected on screen, as `$.ui.selection()` answers it. It has the text, and the transcript row that it lies in when it lies in one. Example: `const selected = await $.ui.selection()`. Used by `$.ui.selection`, `ui.selection`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The selected text as the person sees it: what a copy would put on the clipboard, with wrapped rows joined back into their lines. | Type: `string`. |
| `requestId` | <Documented /> | The transcript row that the selection lies in, by the id that its `ui.render` hook reads as `e.requestId` and `$.ui.scroll` takes. | Type: `string`. Optional. The row of a tool call, by its `tool_use_id`. Absent when the selection spans several rows or lies outside the transcript. |

### `UiSelectResult`

What a `ui.select` hook returns and what `next(e)` resolves to. Core runs the `onSelect` closure of the element and answers `{ element, value }`. Used by `ui.select`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `element` | <Documented /> | Which handler the pick reached, by the `key` of its Select. | Type: `string`. |
| `value` | <Documented /> | What the handler received: the value of the option as the chain left it. | Type: `string`. |

### `UiViewResult`

What `$.ui.view` hands back and what the `{ value }` of a `ui.view` hook holds. It is `{}` once the main view displays what was asked, or the reason why it does not. It is spelled as `ui.scroll` spells it. Example: `$.ui.view({ agentId }).then(shown => shown.deny && $.ui.toast(shown.deny))`. Used by `$.ui.view`, `ui.view`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Undocumented /> | Absent when the main view displays the transcript asked for, else why the view did not move. | Type: `string`. Optional. Says why the view did not change. The call was not the own input of the person, no agent has the id, or the view moved meanwhile. |

### `UserMessageFrom`

Who sent the message that a `UserMessage` row carries, when someone other than the person did: another agent, a teammate, another session, a channel. Read-only. The words of the sender are not the words of the person. The model reads them framed as those of that sender, whatever a hook draws for the row.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The name of the sender as the row displays it. For a subagent, it is its name, else its type. For a teammate, it is the name of the teammate. For another session, it is the title. For a channel, it is the sender, else the server. | Type: `string`. One printable line: control and format characters stripped, whitespace collapsed, length bounded. Absent (no `from`) for a teammate block whose frames name different senders or none. |

### `UserMessageTask`

The background task that a `UserMessage` notification row reports on: a subagent, a background shell, a workflow, a remote agent, a monitor. Read-only. Every field belongs to the notification, so the row names the same task on every draw. Each string is one printable line.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | The id of the task as the notification names it. For a subagent, it is the `agentId` that its `turn.complete` carried and `$.agent.list()` keys. | Type: `string`. Optional. |
| `status` | <Documented /> | How the task ended: `completed`, `failed` or `killed` (stopped, by the person or by Claude), or another word that its producer wrote. | Type: `string`. Optional. |
| `type` | <Documented /> | What kind of task, when the notification says (`remote_agent`, the kind of an artifact watch). The notification of a subagent and of a shell leave it out. | Type: `string`. Optional. |
| `toolUseId` | <Documented /> | Which call started the task: its `tool_use_id`, when the notification carries it. | Type: `string`. Optional. |
| `durationMs` | <Documented /> | How long the task ran, in milliseconds, when the notification says. The row draws it after the summary (`2m 2s`). | Type: `number`. Optional. |

## Related Pages

- [UI Types](index.md)
- [Mod API Types](../index.md)
