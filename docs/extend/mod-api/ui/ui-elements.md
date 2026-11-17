---
title: Surfaces, Elements, and Render Sites
description: "What a mod may draw and where: the surfaces, the 20 render sites with their props, and the JSX globals."
sidebar_position: 8
---

A mod draws with elements, at render sites, on a surface. Use this page to find which site and element to hook when you want to change what Claude Code shows. Hook `ui.render` with `on("ui.render", { component }, ...)` to draw at a site.

- A surface is the app that draws: the terminal, the desktop app, the mobile app, or the VS Code extension.
- A render site is one part of the interface, such as the spinner, a tool row, or a pane.
- An element is a building block of a drawing, such as `Box`, `Text`, or `Button`.

The engine (Claude Code) raises `ui.render` when it is about to draw a render site.
A hook gets the name of the site in `e.component` and returns a tree of elements. JSX needs a `.tsx` or `.jsx` file.

Official pages: [Draw in the Interface](https://code.claude.com/docs/en/plugins/mods/interface), [Mods Overview](https://code.claude.com/docs/en/plugins/mods/overview), and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types]

## What a Mod Can Do at a Render Site

A render site is a place, not a tag.
The element table from `$.ui.resolve(e)` holds elements only. It has no `Spinner`, `ToolUse`, or other site name.
Thus a mod cannot put a render site into a tree of its own. The engine decides where each site is.

The engine draws most sites itself: the messages, the tool rows, the spinner, and the status lines.
At such a site, a `ui.render` hook makes one of four choices.

| Choice | What the hook returns | What the surface draws |
| --- | --- | --- |
| Leave it | `next(e)` | The engine's drawing, as it is. |
| Change a detail | `next({ ...e, props })`, with changed props | The engine's drawing with the new props. An invalid rewrite draws the original. |
| Wrap it | A tree that holds the result of `await next(e)` | The engine's drawing, with the elements of the mod beside it. |
| Replace it | A tree of its own, with no call to `next` | The tree of the mod alone. An invalid tree draws the engine's drawing. |

Five sites are empty until a hook draws them. A mod draws something new there.

- [Pane](#pane): a framed region that a mod opens with `$.ui.open`.
- [`ContextMenu`](#contextmenu): the rows that a mod adds to the menu that the person opens on the transcript.
- [`Placed`](#placed): a row that a mod places in the transcript with `$.ui.place`.
- [`AbovePrompt`](#aboveprompt): the band above the prompt. It is always there, and every mod shares it.
- [`Backdrop`](#backdrop): the drawing behind the conversation, which a mod sets with `$.theme.set`.

The engine alone draws the permission dialog. A mod adds context to it with `$.ui.notice`.

Official sections, with an example of each choice: [Change What Claude Code Already Draws](https://code.claude.com/docs/en/plugins/mods/interface#change-what-claude-code-already-draws) and [Pick Where to Draw](https://code.claude.com/docs/en/plugins/mods/interface#pick-where-to-draw).

## Example

This hook adds a tail to the hint line under the prompt.

```javascript
on("ui.render", { component: "PromptHint" }, async ($, e, next) =>
  next({ ...e, props: { ...e.props, tail: " (mod)" } }),
);
```

There are no string tags in JSX.
Every tag is an element from `$.ui.resolve(e)`, and JSX compiles a tag to `h(Box, props, ...children)`.

```tsx
on("ui.render", { component: "Pane" }, async ($, e) => {
  const { Box, Text } = $.ui.resolve(e);
  return (
    <Box>
      <Text>Hello</Text>
    </Box>
  );
});
```

## Surfaces

| Item | Status | What it does | Elements | Where it can be used |
| --- | --- | --- | --- | --- |
| `terminal` | <Documented /> | Ink. Draws the whole tree of the hook. | `Box`, `Text`, `Button`, `Input`, `Select`, `Link`, `Code`, `Markdown`, `Client`, `Raster`, `Image`. No `Svg`. | `e.surface === 'terminal'` |
| `desktop` | <Documented /> | Claude Code Desktop. Asks over the wire. | `Box`, `Text`, `Button`, `Input`, `Select`, `Svg`, `Link`, `Code`, `Markdown`, `Client`. Since `2.1.326`, `Shader` too. | `e.surface === 'desktop'` |
| `mobile` | <Documented /> | The mobile app. Asks over the wire. | `Box`, `Text`, `Button`, `Svg`, `Link`, `Code`, `Markdown`. Since `2.1.323`, `Progress` too, when the client names it in `draws`; any other client gets its Box and Text. Since `2.1.326`, `Shader` too. No `Input`, `Select`, or `Client` yet. The docs name no mobile surface. | `e.surface === 'mobile'` |
| `vscode` | <Differs note="The type file says no surface is attached yet. The docs say the extension draws from 2.1.299 in a session that fetches feature flags." /> | The editor webview. The same table as `desktop` without `Client`. | `Box`, `Text`, `Button`, `Input`, `Select`, `Svg`, `Link`, `Code`, `Markdown`. | `e.surface === 'vscode'` |

## Render Sites and Props

Each name in this table is a value of `e.component`. The sections below give the props of each site.

| Site | Status | What it is | What draws it |
| --- | --- | --- | --- |
| [`AskUserQuestion`](#askuserquestion) | <Documented /> | The dialog the AskUserQuestion tool opens. | The engine. |
| [`UserMessage`](#usermessage) | <Documented /> | A user-role row of the transcript. | The engine. |
| [`AssistantMessage`](#assistantmessage) | <Documented /> | One block of an assistant reply. | The engine. |
| [`ToolUse`](#tooluse) | <Documented /> | The row of a tool call in the transcript. | The engine. |
| [`ToolResult`](#toolresult) | <Documented /> | The result block under a tool row. | The engine. |
| [`ToolGroup`](#toolgroup) | <Documented /> | A run of tool calls that the transcript folds into one count line. | The engine. |
| [`CommandOutput`](#commandoutput) | <Documented /> | The output row of a slash command. | The engine. |
| [`ToolProgress`](#toolprogress) | <Documented /> | One row of live progress under a running tool call. | The engine. |
| [Spinner](#spinner) | <Documented /> | The line that animates while a turn runs. | The engine. |
| [`TurnDuration`](#turnduration) | <Documented /> | The line that closes a turn. | The engine. |
| [`InfoNotice`](#infonotice) | <Documented /> | One dim status line under the logo. | The engine. |
| [`SessionMode`](#sessionmode) | <Documented /> | The mode labels at the right of the prompt footer. | The engine. |
| [`PromptHint`](#prompthint) | <Documented /> | The hint line under the prompt. | The engine. |
| [`AbovePrompt`](#aboveprompt) | <Documented /> | The band directly above the prompt input. | A hook of a mod. A survey also draws there. |
| [`AbovePromptList`](#abovepromptlist) | <Documented /> | The arrangement of the `AbovePrompt` rows of the band. New in `2.1.323`. | The engine stacks the rows that hooks settled. |
| [`AgentRow`](#agentrow) | <Documented /> | One agent's row in the agent list. Since `2.1.326`. | The engine. |
| [`ContextMenu`](#contextmenu) | <Documented /> | The rows that a mod adds to the menu on a transcript row. Since `2.1.326`. | A hook of a mod. The desktop app only. |
| [Pane](#pane) | <Documented /> | A framed region. | A hook of a mod, after `$.ui.open`. |
| [`Placed`](#placed) | <Documented /> | A row in the transcript. | A hook of a mod, after `$.ui.place`. |
| [`Backdrop`](#backdrop) | <Documented /> | The drawing behind the conversation. | A hook of a mod, after `$.theme.set`. |

"Read-only" means a rewrite must keep the prop as received. The engine refuses a change.
Many sites have `onScreen` (type `OnScreen \| null`, optional, read-only): which of its rows the viewport shows now. It is `null` while drawn outside the viewport, and absent where the surface does not say.

### `AskUserQuestion`

The dialog the AskUserQuestion tool opens. A tree for it holds the engine's node once. At most 12 rows on the terminal and 48 on other surfaces. Markdown works on other surfaces only.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool whose call opened the dialog. | `string`. |
| `questions` | <Documented /> | The tool's `questions` input, as the dialog draws them. A rewrite must still fit the tool's schema, or the engine draws the original. | `unknown[]`. Since `2.1.323`, the engine's own confirmations are drawn as asked, whatever a rewrite says.[^types-323] |
| `metadataSource` | <Documented /> | The call's `metadata.source` (who asked), when the model gave one. Analytics only, never drawn. | `string`, optional. |

### `UserMessage`

A user-role transcript row: the person's prompt, a background task notification, or a message from another agent, teammate, or session. A rewrite of `text` changes only what the surface draws. The stored message stays as it was.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | What the row shows. | `string`. The engine draws a rewrite up to 100000 characters. A teammate block with several frames keeps the engine's drawing. |
| `origin` | <Documented /> | Where the stored message came from, as `prompt.submit` named it: composer, task notification, peer, channel, or plugin. | `PromptOrigin`. Read-only. `unclassified` for a teammate's message and for a message stored before stamps. |
| `isExpanded` | <Documented /> | Whether the view draws the row in full: the ctrl+o transcript, `--verbose`, or a surface with no ctrl+o. | `boolean`. Read-only. When false, a message row is one dim line that names the sender. |
| `task` | <Documented /> | What a notification row (`origin.kind` `task-notification`) reports on: its background task. | `UserMessageTask`, optional. Read-only. |
| `from` | <Documented /> | Who sent the message: another agent of this session, a teammate, another session, or a channel. | `UserMessageFrom`, optional. Read-only. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `AssistantMessage`

One block of an assistant reply: its text, or a summary of the text the model wrote between two tool calls. A rewrite changes the drawing and leaves the stored message alone. The engine raises it on every attached surface.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The block's text in markdown, as the surface will draw it. | `string`. |
| `isFirstOfReply` | <Documented /> | True on the block that draws the bullet that opens a reply. | `boolean`. |
| `isSummary` | <Documented /> | True on a block that holds a summary of the model's text. | `true`, optional, read-only. The engine refuses a rewrite that changes it. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `ToolUse`

A tool call's row in the transcript, such as `Bash(ls -la)` and its result. The `tool.call` event decided the call, so a rewrite here changes the row alone. The engine raises it on every attached surface.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The id `tool.call` carried for this call. Same value as the row's `requestId`. | `string`. Read-only. |
| `tool` | <Documented /> | Which tool the row draws (`Bash`, `Read`, a plugin's tool). | `string`. |
| `input` | <Documented /> | The call's input, as the model sent it. | `unknown`. |
| `isRunning` | <Documented /> | True while the call is still running. | `boolean`. |
| `isErrored` | <Documented /> | True when the call ended in an error. A refusal at the dialog counts. | `boolean`. |
| `isInterrupted` | <Documented /> | True when an abort ended the call: the user's Esc or a plugin's `$.turn.abort`. | `boolean`. The row draws `Interrupted`. |
| `output` | <Documented /> | The stored result once the call resolves. Undefined while it runs. | `unknown`, optional. For a failed, refused, or cut call it is the text the model read. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `ToolResult`

The result block under a standalone tool row, which the tool's own result renderer draws from `output`. The engine checks a rewrite of `output` against the tool's output schema. A rewrite that does not fit draws nothing. The stored result stays as it was.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The id of the call this result belongs to. | `string`. Read-only. |
| `tool` | <Documented /> | Which tool the result belongs to. | `string`. Read-only. |
| `output` | <Documented /> | The tool's own result object. The same one `ToolUse.output` carries. A rewrite is drawn. | `unknown`. |
| `isErrored` | <Documented /> | True when the call ended in an error. The row then draws the error text, not `output`. | `boolean`. Read-only. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `ToolGroup`

A run of tool calls that the transcript folds into one count line, such as `Read 3 files, ran 2 shell commands`. A hook that sets `isExpanded` unfolds the group. Each unfolded row is a `ToolUse`. The fullscreen ctrl+o view draws no `ToolGroup`.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `calls` | <Documented /> | The calls of the group, in the order the model made them. | `ReadonlyArray<ToolGroupCall>`. |
| `isActive` | <Documented /> | True while the group is the live one. A call in it may still run, and the model's next call may join it. | `boolean`. |
| `isExpanded` | <Documented /> | Whether each call draws as its own `ToolUse` row, or the group draws one line. | `boolean`. True under `--verbose` and in the non-fullscreen ctrl+o transcript. The one prop a rewrite changes on screen. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `CommandOutput`

The output row a slash command printed in the transcript, under its echo. A rewrite of `text` changes only what is drawn. The model still reads the stored row.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `command` | <Documented /> | Which command printed the row, as `command.run` named it (no slash). | `string`. Read-only. The engine refuses a change or a drop, and draws its own row. |
| `args` | <Documented /> | The arguments of the run, as the echo shows them. `***` for a command that marks its arguments sensitive. | `string`. Read-only. |
| `text` | <Documented /> | The text of the row, in markdown. | `string`. |
| `isErrored` | <Documented /> | True when the row is the error line of a command that threw. | `boolean`. Read-only. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `ToolProgress`

One row of the live tool-progress region under a running tool call. Today it is the run-in-background pill. A hook matches `{ props: { kind: "background_hint" } }`.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The tool call the row belongs to. | `string`. Read-only. While several foreground calls share one pill, the first of them. |
| `kind` | <Documented /> | Which progress row. | `'background_hint'`. Read-only. |
| `hint` | <Documented /> | The text of the pill as the engine draws it, dim. For example `(ctrl+b to run in background)`. | `string`. The engine draws a rewrite in its place. `""` draws nothing. |

### Spinner

The line that animates while a turn runs, such as `Sauteing... (12s, 300 tokens)`. On the desktop it is the row that carries the mark of the turn.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `word` | <Documented /> | The animated word (`Sauteing`), as sampled for this turn. | `string`. On the desktop it is what the step is doing (`Creating notes.md`), or `Working`. |
| `message` | <Documented /> | The text drawn instead of the word while a state overrides it. Otherwise null. | `string \| null`. |
| `suffix` | <Documented /> | What the engine draws after the word to say the turn is still going: one ellipsis character. | `string`. Not added to a text that already ends in an ellipsis. |
| `mode` | <Documented /> | What the turn is doing. | `'requesting' \| 'responding' \| 'thinking' \| 'tool-input' \| 'tool-use'`. The desktop never says `tool-input`. |

### `TurnDuration`

The line that closes a turn in the transcript, such as `Baked for 3s`. Only the terminal surface raises it. A remote surface draws its own footer.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `word` | <Documented /> | The past-tense word the line drew (`Baked`). | `string`. |
| `durationMs` | <Documented /> | The duration of the turn in milliseconds. | `number`. |
| `waitingFor` | <Documented /> | What the line waits on while it draws only its waiting text (`Waiting for 2 background agents to finish`). It is read when the row mounts: the pending agents that started at or before the time of the line. Absent while the line draws anything else, or when their count differs from the count it draws. A hook that redraws the line for its own agents checks that each agent is its own and that `workflows` is 0. | `WaitingFor`, optional, read-only: `{ agents: ReadonlyArray<{ id: string, agentType: string, tool_use_id?: string }>, workflows: number }`. `id` is the `task.id` of the `UserMessage` notification row that reports the end of the agent. `agentType` is `general-purpose` or `<plugin>:<agent>`. `tool_use_id` is the call that started it, as `tool.call` carried it, when its task records one. `workflows` is how many workflows the line waits on. New in `2.1.323`.[^waiting] |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `InfoNotice`

One dim status line under the logo (the model source, an experiment enrollment, a settings hint), with a trailing `/command`. Terminal only.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text of the notice, flattened to one string. | `string`. |
| `command` | <Documented /> | The slash command appended after the text. | `string \| null`. |
| `onScreen` | <Documented /> | Which rows are in the viewport. | See above. |

### `SessionMode`

The dim mode labels at the right of the prompt footer (`focus`, `memory paused`), joined by `&`. One instance. Terminal and desktop only. A hook adds a mode by rewriting `modes`, removes one by filtering, or draws its own tree.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `modes` | <Documented /> | The labels the footer shows, in order. Empty when there are none. | `readonly string[]`. |

### `PromptHint`

The dim hint line under the prompt (`? for shortcuts`, `esc to interrupt`, and the pills beside them). One instance. Since `2.1.323`, the terminal, desktop, and mobile surfaces raise it.[^above-prompt]

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `isDraft` | <Documented /> | True while the prompt holds typed text. | `boolean`. Read-only. |
| `isWorking` | <Documented /> | True while a model turn is running. | `boolean`. Read-only. |
| `hint` | <Documented /> | The text of the line as the engine draws it, one string. A rewrite replaces the line. | `string`. |
| `tail` | <Documented /> | Text a hook adds after the line. | `string`, optional. The terminal draws it dim. The terminal leaves it out when fewer than four columns would show. |

### `AbovePrompt`

The band directly above the prompt input, where surveys draw. The engine draws a `[-]` beside the tree and an `n more` row under it. Since `2.1.323`, the engine asks once for each plugin that hooks it, `e.plugin` naming the plugin. A hook draws that plugin's row or passes, and [`AbovePromptList`](#abovepromptlist) stacks the rows. The person collapses the band (ctrl+x ctrl+a) or focuses it (a click, ctrl+x tab). Since `2.1.323`, the mobile surface raises it too.[^above-prompt]

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `hasSurvey` | <Documented /> | True while a survey holds the band. A hook yields to it. | `boolean`. Read-only. |
| `isCollapsed` | <Documented /> | True while the person has collapsed the band: a tree still returns, and nothing of it is on screen. False where the band cannot collapse. | `boolean`. Read-only. Since `2.1.321`. Claude Code passes it in the props of `AbovePrompt`.[^collapsed] |
| `isWorking` | <Documented /> | True while a model turn is running. | `boolean`. Read-only. |
| `maxRows` | <Documented /> | Rows the band may take. In fullscreen, what remains of the bottom slot above the prompt. Otherwise the terminal's height. | `number`. Read-only. The slot has a cap of half the terminal's rows. A taller tree scrolls in a window of `scroll.bodyRows`. |
| `bodyColumns` | <Documented /> | Cells the tree is laid out in. | `number`. Read-only. Size a table to this value, not to `viewport.columns`. |
| `scroll` | <Documented /> | The window over a tree taller than `maxRows`. Engine-owned. The wheel and the person's keys move it while the band has focus. | `SiteScroll`. `bodyRows` is `maxRows` less the `n more` row. |
| `view` | <Documented /> | Which transcript is on screen above the band: the main conversation or one agent's. | `SiteView`. Read-only. A switch of view re-runs the hook. |

### `AbovePromptList`

New in `2.1.323`. The arrangement of the band once its rows settled. A hook that names it, or a bare `on("*")`, hears it. What settles is the whole band. The engine asks it itself while it draws `AbovePrompt`. Core stacks `rows`. Filter what `next(e)` gets and wrap its answer, never rows copied by value. An organization's mod wins by the order of the chain. The engine passes over a bad answer. To fail closed, answer no rows in its `.catch`. A `rows` rewrite that drops, adds, or reorders a row is refused. Terminal, desktop, and mobile only.[^list]

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `rows` | <Documented /> | The settled rows, in chain order, one for each plugin that drew one. A rewrite holds the rows it was handed, and what it leaves is what core stacks. | `readonly AbovePromptRow[]`. |
| `hasSurvey` | <Documented /> | As on `AbovePrompt`. | `boolean`. Read-only. |
| `isCollapsed` | <Documented /> | As on `AbovePrompt`. | `boolean`. Read-only. |
| `isWorking` | <Documented /> | As on `AbovePrompt`. | `boolean`. Read-only. |
| `maxRows` | <Documented /> | As on `AbovePrompt`: the rows the band may take, all its rows together. | `number`. Read-only. |
| `bodyColumns` | <Documented /> | As on `AbovePrompt`. | `number`. Read-only. |
| `scroll` | <Documented /> | As on `AbovePrompt`: the window over the whole stacked tree. | `SiteScroll`. Read-only. |
| `view` | <Documented /> | As on `AbovePrompt`. | `SiteView`. Read-only. A rewrite carries it on as received. |

### `AgentRow`

Since `2.1.326`. One agent's row in the agent list: the list under the prompt in the terminal, the Background tasks of the session rail in the desktop app, and the running subagents in VS Code. A row is for a subagent or a teammate. `requestId` is its `id`. The props are the agent as `$.agent.list()` gives it (see [Agents](../calls/agent.md)), and `parentId` names the agent that spawned it. The props are read-only, but `label` (the words that the engine's row shows beside the name), `body`, and `isHidden`. A tree, or `body`, stands for everything after the pointer, connector, and bullet of the row. The surface keeps opening and stopping the agent, and hiding a row never removes an agent from the full list. The site is not raised where the layout draws no agent rows, nor for the `main` row, a row of a workflow, or the folded idle summary. It is raised on every attached surface.[^agent-row]

The engine asks for every agent that has `hasRow`, drawn now or not, and again when a prop changes. It reads `tokenCount`, `tokenSamples`, `lastRequest`, `usage`, and `cost` every five seconds, on `$.ui.invalidate`, and with a new `status` or `taskStatus`. The last answer stands until the next one comes. A new row waits 300 ms at most for its first answer, then shows with no text until it comes (in VS Code and the desktop app, it shows as the engine's).

- The mobile background tasks sheet asks only for the subagents on screen. It keeps its own row, draws the tree or `body` under it, and shows a changed `label` in the row. A hidden row stays listed, with nothing of the mod.
- The desktop app shows one line and takes no presses in the tree. A tree stands for the words of the row, a `Link` is drawn as its text, and a `Button` is left out.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `rowIds` | <Documented /> | The `id` of every agent that has `hasRow`, so each row is asked again as one comes or goes. | `string[]`. Read-only. |
| `columns` | <Documented /> | The columns that the body of a top-level row has, where the surface measures them. A nested row's connector takes two of them for each level. | `number`, optional. Read-only. |
| `body` | <Documented /> | Text drawn as the whole body of the row in place of the engine's columns, cut at the edge of the row. `""` hides the row, as `isHidden` does. | `string`, optional. It arrives set where the settings of the person already draw the row; leave it out for the engine's columns. It alone may hold escape sequences: SGR styles and OSC 8 links are drawn, any other is dropped. A line break makes the row taller. A remote surface gets it as `Text` and `Link` elements. |
| `isHidden` | <Documented /> | Whether the row is left out of the list: of its drawing, its count, and its keys. A hidden row is still asked, so a hook may show it again. | `boolean`. What the last `next` in the chain passed decides, whoever draws. Pass `false` to show a row that arrives hidden by the settings of the person. |

```javascript
on("ui.render", { component: "AgentRow" }, ($, e, next) =>
  next({ ...e, props: { ...e.props, isHidden: e.props.status === "idle" } }),
);
```

### `ContextMenu`

Since `2.1.326`. The menu that the person opens on something in the transcript (a right-click in the desktop app). A mod adds rows to it. The engine draws none. It is raised on the desktop surface only.[^context-menu]

The engine asks once for each plugin that hooks it, and `e.plugin` names the plugin. A hook answers the rows of that plugin, passes with `next(e)` to the next hook of its plugin, or adds none. Another plugin takes rows away with a hook above that names their plugin or `"*"` and answers over them. The props say what the pointer was on. Each prop is absent when the pointer was on none, so a matcher that names `link` runs only when the menu opened on a link. A hook cannot change the props. `e.requestId` names the menu, not the row: read `e.props.row`.

The surface makes a row of each `Button`: its `label`, or its text, is the label of the row, a dim `Text` inside it is the line under the label, and `onPress` runs when the person picks the row. It makes a row of each `Link` to an `https:` address, with one line and no second, and opens it on the computer of the person. It leaves out the rest of the tree, keeps its own rows whatever a hook answers, and chooses where the rows go and how many it shows.

A surface may open the menu before a slow answer arrives. Then those rows are missing from that menu. A part that is too long to hand over whole is absent: text past 64 KB, or an address too long for a `Link`. The last answer for the same props stands until a `$.state` value that it read changes, or until `$.ui.invalidate()`.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `row` | <Documented /> | The transcript row that the menu opened on: the `component` that its own `ui.render` hook names, and the id that this hook reads as `e.requestId`. | `{ component: RenderComponent; requestId: string }`, optional. Absent where the surface cannot name the row. |
| `link` | <Documented /> | The link under the pointer. `href` is the address as the surface resolved it. `text` is the visible text of the link, when the surface sends it. | `{ href: string; text?: string }`, optional. |
| `selection` | <Documented /> | The text that the person selected, when the menu opened on it. | `UiSelection`, optional. |
| `code` | <Documented /> | The code under the pointer. `isBlock` is true for a fenced block, and `text` is then the whole block. It is false for code inside a line. | `{ text: string; isBlock: boolean }`, optional. |

```javascript skip-lint
on(
  "ui.render",
  {
    component: "ContextMenu",
    props: { link: { href: /^https:\/\/example\.com\// } },
  },
  ($, e) => {
    const { Button } = $.ui.resolve(e);
    const fill = () =>
      $.prompt.fill({ text: `Summarize ${e.props.link?.href}` });
    return (
      <Button key="summarize" onPress={fill}>
        Summarize this page
      </Button>
    );
  },
);
```

### Pane

The framed region a plugin opened with `$.ui.open({ id })`. There is one instance for each id (`requestId`). The body is the hook's tree. One pane shows, the rest are tabs. The surface places it (docked in fullscreen, otherwise above the prompt). The person closes it, which raises `ui.close` with origin `person`, and a hook may refuse.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `title` | <Documented /> | The label of its tab while more than one pane is open. | `string`. Read-only here. Another `$.ui.open`, or a hook on `ui.open`, retitles it. |
| `isFocused` | <Documented /> | True while the pane holds the keyboard, which the person gave it. Tab walks its elements, a Button's `hotkey` presses it, and the arrows scroll. | `boolean`. Read-only. |
| `isPromptCovered` | <Documented /> | True while keys typed in the terminal may go to something other than the prompt or this pane: a dialog (a permission prompt, `/model`), a search, or a field in the band. | `true`, optional. Read-only. The prop is left out while it is false.[^covered] Since `2.1.323`, the type is `true`, not `boolean`.[^types-323] |
| `bodyColumns` | <Documented /> | Cells across the body, inside the frame. | `number`. Read-only. |
| `placement` | <Documented /> | Where the surface seated the pane: `dock` beside the transcript (the terminal in fullscreen from 110 columns), or `inline` above the prompt. Since `2.1.323`, on the desktop app also `widget`, the small form of a minimized pane. Draw what reads at a glance there, because clicks may not reach it. The hook runs again when the seat changes. | `'dock' \| 'inline' \| 'widget'`. Read-only. The engine refuses a change. Treat any other value as `dock`. Since `2.1.323`.[^types-323] |
| `anchoredEdges` | <Documented /> | The edges of the chat area that a `widget` is anchored on, to align the drawing by: `["bottom", "right"]` in that corner, `["right"]` stacked on another widget there, `[]` in the session rail (the column beside the chat). | `readonly ('top' \| 'right' \| 'bottom' \| 'left')[]`, optional. Absent in every other seat. The hook runs again when they change. Ignore a value outside these four. No call moves a widget. Since `2.1.323`.[^anchored] |
| `scroll` | <Documented /> | The window of the body over the tree. Engine-owned. | `SiteScroll`. `bodyRows` is the room the frame may use. Inline, the frame fits the tree. |
| `view` | <Documented /> | Which transcript is on screen beside the pane. | `SiteView`. The pane stays open across a switch of view. |

### `Placed`

A row that a plugin placed in the transcript with `$.ui.place`. It is empty until a hook draws it, in the row's place in the conversation. Every plugin's hook hears every row, so read `plugin` beside `id`. Outside fullscreen, a compaction ends the row, and the same id then places a new one. The engine raises it on every attached surface.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `id` | <Undocumented /> | What `$.ui.place` was given. It is unique among that plugin's rows. | `string`. Read-only. New in `2.1.314`. |
| `plugin` | <Undocumented /> | Who placed the row, so a hook can leave the row of another plugin alone. | `string`. Read-only. New in `2.1.314`. |
| `onScreen` | <Undocumented /> | Which of its rows the viewport of the transcript shows now. It is reported once the row is drawn, and again when it changes. On a scroll, it is reported for the messages at the edges of the viewport only. | `OnScreen \| null`, optional. Read-only. `null` while drawn outside the viewport. Absent where the surface does not say. A rewrite carries it on as received. The engine refuses a rewrite that changes or drops it. New in `2.1.314`. |

### `Backdrop`

The backdrop of the session, which a plugin set with `$.theme.set`. Only the desktop and mobile surfaces raise it, and they draw it behind the conversation. It is empty until a hook draws it. Every plugin's hook hears it, so read `plugin` beside `scene`. The surface sizes the drawing to its window or screen, and presses go through to what is over it. Each surface asks separately, so a hook can read `e.surface` and draw a different scene on each. A `Client` draws nothing on mobile. Since `2.1.326`, an answer holds only `Box`, `Text`, `Svg`, and one [`Shader`](#shader-element). An `Svg` in it must be pure vector, or the engine refuses the answer.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `scene` | <Documented /> | What `$.theme.set` was given as `backdrop.scene`. Since `2.1.323`, this prop is `scene`, not `id`. | `string`. Read-only. |
| `plugin` | <Documented /> | Who set the backdrop, so a hook can leave the backdrop of another plugin alone. | `string`. Read-only. |
| `glass` | <Documented /> | How the surface frosts its panels over the drawing, with the defaults filled in. | `{ blur: number; tint?: string; opacity: number } \| false`. Read-only. `false` where the panels stay as they are. |
| `overrideColorScheme` | <Documented /> | The `overrideColorScheme` of `$.theme.set`: whether to force light or dark. Since `2.1.323`, this prop is `overrideColorScheme`, not `colorScheme`. | `'light' \| 'dark'`, optional. Read-only. Absent where the plugin did not say. |

## Shader Element

Since `2.1.326`. `Shader` is an element for the `Backdrop` site. It plays a scene on the GPU of the desktop app: the shader file that `module` names, fed `values`, over one `Svg` child. The mobile app shows the `Svg` alone. The `desktop` and `mobile` element tables have it, and the `vscode` table does not.[^shader] See [`ShaderProps`](../types/ui/input-pane-render.md#shaderprops) for the props.

- A `Shader` draws only in a `Backdrop`, one at most, at the root or in a `Box`. Anywhere else, or over anything but one `Svg`, the engine refuses the tree.
- The file is TypeScript written against `claude-code/shader`, never GLSL. The engine reads it at load and never runs it: it sends the app a checked form. The app feeds the time and the pointers of the person itself. None of that comes back to the mod, except a click on the bare backdrop (`ui.pointer`).
- The `Svg` shows alone on an app that plays no shaders, under Reduce Motion, when the shader fails, flashes, or runs too slowly, and when the engine refuses the file or a prop. A hook cannot tell which the person got, so draw the `Svg` as a finished scene.
- The `Svg` can be the scene of another mod (`await next(e)`) where that is a bare `Svg`. A hook may keep a `Shader` that `next(e)` gave it and change its `values`, not its `module`. Otherwise the hook fails and the engine skips it.
- `claude plugin validate` lists each shader file with its cost, or names the line that it refuses.

### The Shader Language

The module `claude-code/shader` declares the language of the file. A file ends with `export default shader({ fps: 30, passes: [sky] })`, and its passes run in order. The engine compiles the file and never runs it.

- Allowed: `const`, `let`, functions and arrows (inlined), `if` and `else`, `?:`, `for` loops whose start, end, and step are known while reading (or up to `pointerCount`, 64 turns at most), `for...of` over `pointers` or a written list, `break`, `continue`, `return`, and destructuring.
- Refused: `while`, `do`, recursion, classes, `new`, `async`, strings as values, spread, and any other import or global.
- Numbers are 32-bit floats and are never NaN or infinite. `y` points up. The vector types are `vec2`, `vec3`, and `vec4`, with lanes `xyzw` or `rgba`. A 32-bit `int` wraps.
- A file's numbers, ints, and tables hold 16384 bits in all. A `table` holds up to 256 rows of 1 to 4 numbers. A pass is a `picture` (exactly one, what shows over the `Svg`), a `buffer` (a texture that lasts between frames), or `shapes`. A file has 24 passes at most with tables.
- The inputs are `time`, `dt`, `frame`, `first`, `fresh`, `turn`, `still` (1 under Reduce Motion), `size`, `res`, `px`, `composer`, `pixel`, `scene` (a picture of the `Svg`), and up to four pointers. `values({ ... })` declares the numbers that the mod sets, each held to its range.

```javascript skip-lint
import { picture, shader, sin, time, vec3, vec4 } from "claude-code/shader";
const sky = picture((p) => {
  const glow = 0.2 + 0.1 * sin(time + p.uv.x * 6);
  return vec4(vec3(0.3, 0.5, 1) * glow, glow);
});
export default shader({ fps: 30, passes: [sky] });
```

## JSX and Globals

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `h(tag, props, ...children)` | <Documented /> | The JSX factory (classic runtime). Returns a plain-data element from a string tag or a component. | JSX compiles to bare `h(...)` calls. A module must not declare, import, or take as a parameter anything named `h` or `Fragment` where it writes JSX. The engine adds the pragma. | Hooks modules and surface modules. |
| `Fragment` | <Documented /> | `<>...</>`. A column `Box` around the children. | The same naming rule as `h`. | Hooks modules and surface modules. |
| `JSX` namespace | <Documented /> | `Element` is `RenderElement`. `IntrinsicElements` is empty, so there are no string tags. `IntrinsicAttributes` allows `key`. | Every tag is a constructor from `$.ui.resolve(e)`, as in `const { Box, Text } = $.ui.resolve(e)`. | Files named `.tsx` or `.jsx`. |
| Web globals | <Documented /> | `URL`, `URLSearchParams`, `TextEncoder`, `TextDecoder`, `AbortController`, `AbortSignal`, `atob`, `btoa`, `structuredClone`, `crypto.subtle.digest`, `crypto.randomUUID`, `crypto.getRandomValues`, and `performance.now`. | There is no DOM, no Node, no `require`, and no `import()`. `eval` and `new Function` over a string throw. There is no `WebAssembly`. A surface module also has `console` and no timers. | Hooks modules and surface modules. |
| Module rules | <Documented /> | A file ends in `.ts`, `.tsx`, `.jsx`, `.js`, `.mjs`, `.cjs`, `.mts`, or `.cts`. It is an ES module whatever its suffix. | A module imports a file of the plugin with an `import` declaration. A module with `import()` does not load. `on`, `$`, `$.env` names, and `$.state` references must be spelled literally. | Hooks modules. |

## Related Pages

- [Mod API Overview](../index.md)
- [UI Methods](ui.md)
- [UI Events](ui-events.md)
- [UI Types](../types/ui/index.md) (element props and results)

## Sources

[^types]: The Mod API type file of the `2.1.322` program, `schemas/claude-code.d.ts`.
[^types-323]: The Mod API type file, `schemas/claude-code.d.ts`.
[^waiting]: The Mod API type file, `schemas/claude-code.d.ts`, `WaitingFor` and `WaitingAgent`. The program, `chunk-s3j7dx93.js:215530`.
[^above-prompt]: The Mod API type file, `schemas/claude-code.d.ts`. The program, `chunk-fvkvyefp.js:197780`.
[^collapsed]: The program, `chunk-y9bdpp8r.js:541869`.
[^list]: The Mod API type file, `schemas/claude-code.d.ts`. The program, `chunk-fvkvyefp.js:170774` and `chunk-fvkvyefp.js:197780`.
[^covered]: The program, `chunk-y9bdpp8r.js:554445`.
[^anchored]: The Mod API type file, `schemas/claude-code.d.ts`. The program, `chunk-fvkvyefp.js:168072`.
[^agent-row]: The Mod API type file of the `2.1.326` program, `schemas/claude-code.d.ts`, the `AgentRow` member of `RenderPropsOf`.
[^context-menu]: The Mod API type file of the `2.1.326` program, `schemas/claude-code.d.ts`, the `ContextMenu` member of `RenderPropsOf`.
[^shader]: The Mod API type file of the `2.1.326` program, `schemas/claude-code.d.ts`, `ShaderProps` and the module `claude-code/shader`.
