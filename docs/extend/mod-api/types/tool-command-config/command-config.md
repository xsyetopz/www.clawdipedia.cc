---
title: Command, Config, and Registered Tool Types
description: "Types of built-in tool calls, command runs and specs, config rows, and registered tool specs."
sidebar_position: 1
---

## Types with Fields

Each type below has its own table of fields.

### `BuiltinToolCallInput`

One variant for each built-in tool. With none in the table (the project of a plugin author with no tools entry laid), it is one loose variant over every name. Alias of `[BuiltinToolName] extends [never] ? BuiltinToolCallInputFallback : { [N in BuiltinToolName]: ToolInputOf<N, BuiltinToolInputs[N]>, }[BuiltinToolName]`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[N in BuiltinToolName]` | <Documented /> | One variant for each built-in tool: the input of the tool. | Type: `ToolInputOf<N, BuiltinToolInputs[N]>`. |

### `BuiltinToolCallInputFallback`

The answer of the built-in branch when no built-in tool is declared: every name, with its arguments unconstrained.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool being called (`Bash`). A comparison with it narrows `e` once the table has entries. Reserved: core ignores a rewrite of it. | Type: `string`. |
| `tool_use_id` | <Documented /> | The id of the tool_use block. It is the same at every event of the call and in `$.ui.notice`. Reserved: core ignores a rewrite of it. | Type: `string`. |
| `[argument: string]` | <Documented /> | Any argument of the tool, with no type. | Type: `unknown`. |

### `CommandDescribeInput`

The input of `command.describe`: how one slash command presents in the typeahead and `/help`, at the moment the engine lists it. Used by `command.describe`, `$.command.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `command` | <Documented /> | Names the command without its slash, the key that a matcher narrows on. A rewrite is refused. | Type: `string`. |
| `description` | <Documented /> | The one-line description that the menu shows, as the command declares it. | Type: `string`. |
| `argumentHint` | <Documented /> | The hint drawn dim after the name (`[name]`), when the command has one. | Type: `string`. Optional. |
| `isHidden` | <Documented /> | Whether the typeahead and `/help` leave the command out. A hidden command still runs when typed in full. | Type: `boolean`. |
| `immediate` | <Documented /> | Whether the command declares that it runs at once when typed mid-turn, instead of waiting for the turn to end. | Type: `boolean`. One that decides per invocation reads false. Read only. It is not part of what a hook answers, and a rewrite is refused. |
| `provider` | <Documented /> | Who provides this command: the plugin and its tier, `{ plugin: "engine", tier: "core" }` for a built-in. Pinned: a rewrite is refused. | Type: `Origin`. |

### `CommandInfo`

One slash command as `$.command.list()` returns it. Used by `$.command.list`, `command.list`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | What the person runs it by, without the slash. | Type: `string`. |
| `description` | <Documented /> | The one line the typeahead shows for it. | Type: `string`. |
| `source` | <Documented /> | Where it comes from (CommandSource). | Type: `CommandSource`. |
| `plugin` | <Documented /> | Which plugin added it, when `source` is `plugin` and the engine knows. It is the plugin that registered it, or whose manifest carries it. | Type: `string`. Optional. |

### `CommandPresentation`

Where the answer of a command will show. It has the layout of the terminal that the surface renders (one of two), and how wide it is when the command runs. The engine stamps this fact on `command.run`, so a command can suit the room it has. A pane docks from 110 columns in fullscreen.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isFullscreen` | <Documented /> | True under the fullscreen (alternate-screen) layout. False on the main screen (`CLAUDE_CODE_NO_FLICKER=0`, tmux by default) and headless. | Type: `boolean`. The fact that `isFullscreen` of `RenderViewport` carries on every terminal drawing, from the same source: the two agree. |
| `columns` | <Documented /> | The width of the terminal in cells as the command runs. It is 80 where no terminal has measured (headless with no tty). | Type: `number`. |

### `CommandRunArgs`

The input of `command.run` as the `$.command.run` of a plugin takes it: `args` may be left out (`/command`, bare). The engine sets `origin` and `presentation`. Combines `CommandRunArgs`, `CommandRunInput`. Used by `$.command.run`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `args` | <Documented /> | Everything after the name, as the person would type it. If left out, it is `""`. | Type: `string`. Optional. |

### `CommandRunInput`

The input of `command.run`: one slash command about to run, the way the person typed it (`/name args`), and where the run came from. Used by `command.run`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `command` | <Documented /> | Names the command without its slash (`compact`, `hello`), with aliases and folds resolved. It is the key that a matcher narrows on. A rewrite is refused. | Type: `string`. |
| `args` | <Documented /> | Everything after the name, as typed (`""` when nothing was). A hook rewrites it with `next({ ...e, args })`. | Type: `string`. |
| `origin` | <Documented /> | Where the run came from, in the words of `prompt.submit` (PromptOrigin): the Enter of the person (`composer`), the bridge, the SDK, or a plugin. | Type: `PromptOrigin`. The `$.command.run` of a plugin reads `{ kind: 'plugin', name }`. `next(e)` passes it on as received. |
| `presentation` | <Documented /> | Where the answer of the command will show (CommandPresentation): the fullscreen layout or the main screen, and the width of the terminal. | Type: `CommandPresentation`. Pinned: the engine stamps it, and `next(e)` passes it on. A rewrite that leaves it out keeps it. A rewrite that changes it is refused. |

### `CommandRunResult`

What a `command.run` hook returns and what `next(e)` and `$.command.run` resolve to: the output text of the command and the notes it leaves the model. `text` is what the command printed and `context` is what it recorded for the model. A hook that answers without `next` runs no command. Used by `command.run`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The output of the command as a transcript line, or undefined when the command showed nothing as text (a panel, a prompt for the model). | Type: `string`. Optional. |
| `context` | <Documented /> | What the model reads after the output of the command, and the person never sees. Each entry is one hidden user message recorded after the output row. | Type: `readonly string[]`. Optional. The notes that the command left the model. Absent when none. |
| `isTextDisplayOnly` | <Gated note="The engine reads it only when every plugin that hooks the command is bundled with Claude Code." /> | True: `text` is for the person only, and `context` is all that the model reads. The output row is drawn and kept, and it goes in no request. The engine reads it on the own answer of a hook without `next`, on the queued lanes: a panel answered in the middle of a turn keeps its text in requests. The text of any other plugin stays in requests. | Type: `true`. Optional. New in `2.1.319`. |
| `exitCode` | <Documented /> | What the process exits with when this command was the whole prompt of a headless run (`claude -p "/lint"`): a whole number from 0 to 255. | Type: `number`. Optional. If left out, the run exits as it would have. Any other value fails the hook. An interactive session ignores it. |
| `ref` | <Documented /> | Core sets it on what `next(e)` resolves to. It names the run of the command by the engine (its result stays on the host side). | Type: `number`. Optional. A hook that returns the object it got makes the engine use that run verbatim. Absent on the own `{ text }` of a hook and on that of `$.command.run`. |

### `CommandSpec`

What `$.command.register` takes: the slash command this plugin serves. Used by `$.command.register`, `command.register`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The name of the command without the slash (letters, digits, `_`, `-`, up to 64). The person runs it as `/<name>`. | Type: `string`. |
| `description` | <Documented /> | The one line the typeahead and `/help` show for it. | Type: `string`. |
| `argumentHint` | <Documented /> | The hint drawn dim after the name (`[name]`), when it takes arguments. | Type: `string`. Optional. |
| `immediate` | <Documented /> | Set it so that `/<name>`, typed while a turn is in flight, runs at once. When left out, the command waits for the turn to end. | Type: `true`. Optional. Its `command.run` hook runs while a turn may still be streaming, so it must not assume the state of the turn. |

### `ConfigDescribeInput`

The input of `config.describe`: how one `/config` row presents, at the moment the menu lists it (and for `$.config.list`). Used by `config.describe`, `$.config.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | Names the row, as the `key` of `config.set` does. It is the key that a matcher narrows on. Pinned: a rewrite is refused. | Type: `string`. |
| `label` | <Documented /> | What the menu draws for the row, before its value. | Type: `string`. |
| `description` | <Documented /> | The help text beneath the label, when the row has one (the `description` of a plugin field). Absent for the own rows of the panel. | Type: `string`. Optional. |
| `isHidden` | <Documented /> | Whether the menu leaves the row out. A hidden row still answers `$.config.set` and `/config key=value`. | Type: `boolean`. |
| `provider` | <Documented /> | Who owns the row, as the `provider` of `config.set`. Pinned. | Type: `Origin`. |

### `ConfigOrigin`

Where a `config.set` came from, in the words of `prompt.submit`: the person in the `/config` menu (`composer`), the bridge, or a plugin, named. The engine sets it. `next(e)` passes it on as received, and nothing else sets it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The own change of the person in the `/config` menu (a toggle, a pick, a typed value), or their `/config key=value`. | Type: `'composer'`. |
| `kind` | <Documented /> | A `/config key=value` that arrived over the Remote Control bridge (a phone or web client, or a relay): not attestably the hand of the owner. | Type: `'bridge'`. |
| `kind` | <Documented /> | A `$.config.set` of a plugin. The own hooks of that plugin do not see it. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the calling plugin. | Type: `string`. |

### `ConfigRow`

One `/config` row as `$.config.list()` returns it: what the menu would draw now, after every `config.describe` hook, with a hidden row left out. Used by `$.config.list`, `config.list`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | Names the row: the id of the panel for a built-in, `<plugin>.<field>` for the `userConfig` field of a plugin. It is what `$.config.set` takes. | Type: `string`. |
| `label` | <Documented /> | What the menu draws for the row, before its value. | Type: `string`. |
| `description` | <Documented /> | The help text under the label, when the row has one. | Type: `string`. Optional. |
| `kind` | <Documented /> | How the row takes its value (ConfigKind). | Type: `ConfigKind`. |
| `value` | <Documented /> | What the row holds now. | Type: `ConfigValue`. |
| `options` | <Documented /> | The values that a `choice` row takes, in order (the declared `options` of a plugin string field for its row). Absent otherwise. | Type: `readonly string[]`. Optional. |
| `provider` | <Documented /> | Who owns the row: the engine for the own rows of the panel, else the plugin. | Type: `Origin`. |
| `isLocked` | <Documented /> | Whether a trusted source (managed settings, the policy of the organization) owns the value, so the menu shows it and refuses a change. | Type: `boolean`. |

### `ConfigSetInput`

The input of `config.set`: one `/config` row about to change, from the menu or the `$.config.set` of a plugin, with what it holds now and who owns it. Used by `config.set`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `key` | <Documented /> | Names the row: the own id of the panel for a built-in (`theme`, `verbose`, `autoCompact`), `<plugin>.<field>` for the `userConfig` field of a plugin. | Type: `string`. The key that a matcher narrows on, pinned: a rewrite is refused. |
| `value` | <Documented /> | What the row is being set to. `next({ ...e, value })` clamps or replaces it, held to the kind of the row (a toggle takes a boolean). | Type: `ConfigValue`. |
| `previous` | <Documented /> | What the row holds before the change, as the menu shows it. Pinned. | Type: `ConfigValue`. |
| `provider` | <Documented /> | Who owns the row: `{ plugin: "engine", tier: "core" }` for the own rows of the panel, the plugin and its tier for a `userConfig` field. Pinned. | Type: `Origin`. |
| `origin` | <Documented /> | Where the change came from (ConfigOrigin): the person in the menu (`composer`) or a plugin's `$.config.set`. Pinned. | Type: `ConfigOrigin`. |

### `ConfigSetResult`

What a `config.set` hook returns and what `next(e)` resolves to: `{ value }` once written, or `{ deny: reason }` with the row left as it was. The menu shows the reason of a deny. A deny after `next(e)` was answered fails the hook. Used by `config.set`, `$.config.set`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `value` | <Documented /> | The value now written to the row. | Type: `ConfigValue`. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | The reason the write was refused. The row stays as it was. | Type: `string`. |
| `value` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `RegisteredToolSpec`

A ToolSpec as `$.tool.register` hands it on: with the input schema filled in, and `isDeferred` as the plugin gave it. Used by `tool.register`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The name of the tool. | Type: `string`. |
| `description` | <Documented /> | The description the model sees for the tool. | Type: `string`. |
| `inputSchema` | <Documented /> | The JSON schema of the tool input. | Type: `Record<string, unknown>`. |
| `isDeferred` | <Documented /> | Where the tool waits, as the plugin gave it. | Type: `ToolDeferral`. Optional. |

## Related Pages

- [Tool, Command, and Config Types](index.md)
- [Mod API Types](../index.md)
