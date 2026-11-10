---
title: Prompt Attachment, Autocomplete, and Context Types
description: "Types of attribution text, attachments, plan mode details, autocomplete, the prompt box, change, compose, and context."
sidebar_position: 1
---

## Types with Fields

Each type below has its own table of fields.

### `AttributionTextInput`

The input of `attribution.text`: one text that the engine asks the model to write into a commit or a pull request. It is raised at the moment the engine composes it. Object. Its fields (`kind`, `text`) have rows below. Used by `attribution.text`, `$.attribution.text`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Which text (`commit`, `pr`, `exemption`, `remedy`), the key that a matcher narrows on. | Type: `AttributionTextKind`. |
| `text` | <Documented /> | As the engine composed it, with the settings applied. | Type: `string`. |

### `AttributionTextResult`

What an `attribution.text` hook returns: the text the model reads in that place. Used by `attribution.text`, `$.attribution.text`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text the model reads in that place. | Type: `string`. |

### `DeclaredAttachmentInput`

One `prompt.attachment` input of a type that PromptAttachmentDetailOf names. It has the text of the attachment, and under `detail` the facts that the engine rendered it from. A row that the engine made holds them, unless its session keeps no plan file. That one, or one edited by hand, carries no `detail` key. Read it as it may be.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | As the engine names the kind of the attachment, one of the names that carry a `detail`, and the key that a matcher narrows on. Pinned. | Type: `K`. |
| `text` | <Documented /> | What the model reads for this attachment, inside the framing of the engine. A hook can rewrite it with `next({ ...e, text })`. | Type: `string`. The `<system-reminder>` wrapper (or the system channel that replaces it) goes around what the chain answers, never inside it. |
| `origin` | <Documented /> | Who authored the text (PromptAttachmentOrigin): the engine, a settings hook, or the chain context of a plugin. | Type: `PromptAttachmentOrigin`. Pinned: a different value is refused, one left out is kept. |
| `agentId` | <Documented /> | The loop whose request carries the attachment: the id of a subagent, the `id` that `$.agent.list()` gives it. Absent on main. | Type: `string`. Optional. Pinned: a different value is refused, one left out is kept. A loop forked from another carries the rows made for that one. |
| `detail` | <Documented /> | Facts of the row that the engine computed as it rendered `text`, by `type`. A hook with words of its own reads them in place of the words of the engine. | Type: `PromptAttachmentDetailOf[K]`. Optional. Pinned: a different value is refused. Absent on a row that does not hold its facts. |

### `PlanModeDetail`

What the engine knew as it made a plan-mode reminder. It has which of its two wordings the row carries, where the plan is kept, and whether one is there.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `reminder` | <Documented /> | Which wording the row carries. `full` is the whole workflow. `sparse` is the one line that restates it between two full ones. | Type: `'full' \| 'sparse'`. A row made for a subagent reads the same under either. |
| `planFilePath` | <Documented /> | Where the plan is kept, as the text names it. It is the file that the model writes its plan to, for the loop that the row was made for. | Type: `string`. |
| `hasPlan` | <Documented /> | True when the engine found that file as it made the row. | Type: `boolean`. |

### `PlanModeExitDetail`

What the engine knew as it made the note that plan mode has ended. It has where the plan is kept and whether one is there.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `planFilePath` | <Documented /> | Where the plan is kept. The text names it only when `hasPlan`. | Type: `string`. |
| `hasPlan` | <Documented /> | True when the engine found that file as it made the row. | Type: `boolean`. |

### `PlanModeReentryDetail`

What the engine knew as it made the note that plan mode is entered again. It has where the plan of the earlier planning is kept.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `planFilePath` | <Documented /> | Where the earlier plan is kept, as the text names it. The engine makes the note only when it finds that file. | Type: `string`. |

### `PromptAttachmentDetailOf`

The facts that `prompt.attachment` pins under `e.detail`, by attachment type. They are what the engine computed for the row, as it rendered the text of the row. The engine attaches them to a row of some types. A type not named has no `detail`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plan_mode` | <Documented /> | The reminder that a request carries while plan mode is on. `full` is the first of a planning session and the one after a compaction. `sparse` is most others. | Type: `PlanModeDetail`. Example: `const isSparse = e.detail?.reminder === "sparse"`. |
| `plan_mode_reentry` | <Documented /> | The note made when the process that left plan mode enters it again, with the earlier plan still in its file. It precedes the reminder. | Type: `PlanModeReentryDetail`. Example: `const planFilePath = e.detail?.planFilePath`. |
| `plan_mode_exit` | <Documented /> | The note made once when plan mode has ended. The model may act again. It is told where its plan is when there is one. | Type: `PlanModeExitDetail`. Example: `const hasPlan = e.detail?.hasPlan === true`. |

### `PromptAttachmentInput`

The input of `prompt.attachment`: one message that the engine injects into the conversation for the model on its own. It is raised as a request is about to carry it. A union on `type`. The engine raises only an attachment that carries text for the model. Used by `prompt.attachment`, `$.prompt.attachment`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in keyof PromptAttachmentDetailOf]` | <Documented /> | One input variant for each attachment type that `PromptAttachmentDetailOf` declares. | Type: `DeclaredAttachmentInput<K>`. |

### `PromptAttachmentOrigin`

Who authored the text that an injected attachment carries, as the engine knows it from the attachment itself. It is a closed set, pinned on the event. `e.origin.kind` tells the own text of the engine from the output of a settings hook or the context of another plugin. No hook sets it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The own prose or framing of the engine: a reminder, a mode transition, a listing, a notice, an announced context block. | Type: `'engine'`. A file that the person mentioned, as the engine presents it, is the engine's too. So is a prompt or notification delivered into a running turn. |
| `kind` | <Documented /> | The output of a settings hook that the engine injects for the model: its additional context, the note of a blocking error, a stopped continuation. | Type: `'hook'`. |
| `event` | <Documented /> | The settings hook event that produced it (`SessionStart`, `UserPromptSubmit`, `PostToolUse`, ...). | Type: `string`. |
| `kind` | <Documented /> | Text that the hook of a plugin attached through the `context` of a chain, as the model reads it. | Type: `'plugin'`. The chains that carry one are `prompt.submit`, `prompt.mention`, and `tool.call`. |
| `event` | <Documented /> | The event of the chain that attached it. | Type: `string`. |

### `PromptAttachmentResult`

What a `prompt.attachment` hook returns: the text that the model reads for that attachment, or null to leave the attachment out of the request. Used by `prompt.attachment`, `$.prompt.attachment`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text that the model reads for the attachment, or `null` to leave it out. | Type: `string \| null`. |

### `PromptAutocompleteInput`

The input of `prompt.autocomplete`: the prompt box as the person left it and the token at its cursor, which a taken suggestion replaces. All four are pinned, as facts of the box. The engine refuses a rewrite that changes one. It keeps one that is left out. Offsets count UTF-16 code units. Used by `prompt.autocomplete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The whole draft in the prompt box. | Type: `string`. |
| `cursor` | <Documented /> | Where the caret of the person stands in `text`, 0 to `text.length`. | Type: `number`. |
| `token` | <Documented /> | The run of characters that are not whitespace and that ends at the cursor: `text.slice(start, cursor)`. Never empty. | Type: `string`. What a matcher names to answer one lead character only. Example: `on("prompt.autocomplete", { token: /^#/ }, hook)`. |
| `start` | <Documented /> | Where `token` starts in `text`. | Type: `number`. |

### `PromptAutocompleteResult`

What a `prompt.autocomplete` hook returns and what `next(e)` resolves to: the rows that the plugins add to the typeahead for the token. Used by `prompt.autocomplete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `suggestions` | <Documented /> | The rows, in the order drawn beneath the own rows of the engine. From core, none. | Type: `readonly PromptAutocompleteSuggestion[]`. A hook puts its rows before or after what `next(e)` gave. The own rows of the engine are not on this event. |

### `PromptAutocompleteSuggestion`

One row that a `prompt.autocomplete` hook adds to the typeahead of the prompt box. It has what taking it writes, what the row displays, and a dim line beside it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | What taking the row writes in place of the token, with the cursor after it. Never empty. The engine then asks again for the new token of the box. | Type: `string`. |
| `label` | <Documented /> | What the row displays, on one line. It is the `text` when absent. | Type: `string`. Optional. |
| `description` | <Documented /> | The dim line drawn beside the label. The surface cuts it to the row. | Type: `string`. Optional. |

### `PromptBox`

The prompt box of the person as it stands. It has the draft and where the cursor is in it. It is what `$.prompt.read()` resolves and `$.prompt.fill` hands back. No selection: the box of the terminal has none of its own, and a surface that binds one adds it here. Used by `$.prompt.read`, `prompt.read`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The draft as typed so far. It is `''` where the session draws no box. | Type: `string`. |
| `cursor` | <Documented /> | Where the next typed character lands: an offset into `text` in UTF-16 code units. It is 0 at the start and `text.length` at the end. | Type: `number`. |

### `PromptChangeInput`

The input of `prompt.change` (prompt-change/): the prompt box after a change of its text that no `prompt.edit` carried, and who made it. The change is already in the box. Every field is the engine's: a hook observes, and `next(e)` passes them on as received. Used by `prompt.change`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The draft as it stands when the engine raises the event. It is what `$.prompt.read()` answers then. | Type: `string`. |
| `cursor` | <Documented /> | Where the caret stands in `text` then, 0 to `text.length`. | Type: `number`. |
| `origin` | <Documented /> | Who changed the box (PromptChangeOrigin). The engine sets it. It is the act that left the box as it stands. | Type: `PromptChangeOrigin`. Example: `($, e, next) => next(e))`. |

### `PromptChangeOrigin`

Who changed the prompt box at `prompt.change`, as the engine stamps it where the text is written. A matcher narrows on its `kind`. The set of kinds may grow. Treat a kind that you do not know as `engine`. `next(e)` passes it on as received. No hook sets one.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The engine put a recalled entry of the prompt history in the box. The person used the up and down arrows, the history search, or the history picker. | Type: `'history'`. Stepping back out of a recall is `history` too. It happens when the person passes the newest entry, cancels the search, or gets the own draft put back. |
| `kind` | <Documented /> | Something other than an edit or an undo emptied the box: a submit took the draft, a clear, or a stash. | Type: `'clear'`. `text` is the box when the engine raised the event. A key typed since is in it. |
| `kind` | <Documented /> | The person took an edit back (`chat:undo`). The box holds an earlier text of theirs, which may be empty. | Type: `'undo'`. |
| `kind` | <Documented /> | The `$.prompt.fill` of a plugin landed, as its `prompt.fill` chain left it and as the engine finished it (an over-long text collapsed). | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the filling plugin. A hook that fills tells its own fill by it. | Type: `string`. |
| `kind` | <Documented /> | The own Composer of a remote surface, changed by the hand of the app. Reserved. Nothing raises it as shipped. | Type: `'app'`. |
| `kind` | <Documented /> | Every other write: a draft put back, an accepted completion, dictation, a prefill, and an edit that `prompt.edit` does not carry. | Type: `'engine'`. |

### `PromptChangeResult`

What a `prompt.change` hook returns and what `next(e)` resolves to: `{ text }`, echoed by core. The own value of a hook changes nothing. Used by `prompt.change`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The prompt text, echoed by core. | Type: `string`. |

### `PromptComposeInput`

The input of `prompt.compose`: the facts that a system prompt is composed from, each already resolved by the engine, at the moment it renders one. Used by `prompt.compose`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `model` | <Documented /> | The id of the model that the request is for. Pinned. It is the field that a matcher narrows on. | Type: `string`. |
| `promptModel` | <Documented /> | The model whose prompt is rendered. It is `model`, unless the engine renders the prompt of another model for it (a model that it holds no prompt of its own for). | Type: `string`. |
| `surfaces` | <Documented /> | Where the session draws at this render, as `$.session.surfaces()` answers. `terminal` is first under the REPL. It is empty where nothing draws. | Type: `readonly RenderSurface[]`. |
| `tools` | <Documented /> | The names of the tools that the request offers the model. The own composition of the engine reads them against those of the session. It ignores an unknown name. | Type: `readonly string[]`. |
| `outputStyle` | <Documented /> | What the person chose in place of the default way of answering, and whether it keeps the coding instructions. It is null for the default style. | Type: `object`. |
| `traits` | <Documented /> | The traits the system prompt is composed from. | Type: `readonly PromptComposeTrait[]`. |

### `PromptComposeResult`

What a `prompt.compose` hook returns: the sections of the system prompt, in order, with every `shared` one ahead of every `session` one. The engine does not send a section that is left out. The engine places the cache boundary itself. Used by `prompt.compose`, `$.prompt.compose`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sections` | <Documented /> | The sections of the system prompt, in order: every `shared` one ahead of every `session` one. | Type: `readonly PromptComposeSection[]`. |

### `PromptComposeSection`

One section of the system prompt as `prompt.compose` answers it. It has a stable id, the text that the model reads, and the side of the cache boundary that it is on. Example: `const POLICY = { id: "acme:policy", text: "...", scope: "session" } as const`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | What a hook above finds the section by, to replace, move or drop it. Never empty, and unique in one list. | Type: `string`. The own id of a plugin is `<plugin>:<name>`. A bare name is the engine's. The full prompt opens with `intro`, `system`, `doing_tasks`, `actions`, `tools`, and `tone`. |
| `text` | <Documented /> | The text of the section, sent as written. The engine joins sections on one side of the boundary by a blank line, in the order of the list. | Type: `string`. |
| `scope` | <Documented /> | The side of the cache boundary that the section is sent on. In one list every `shared` section comes before every `session` one. | Type: `PromptComposeScope`. A section added at the end of what `next(e)` answered is `session`. |

### `PromptContextBlock`

One block of the context that the first user message carries. It has a name that the engine keys it by and the text under it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The key that the block renders under (`# name`): `claudeMd`, `userEmail`, `attachedProject`, `currentDate`, or the own key of a plugin. | Type: `string`. The field that a matcher narrows on, unique among the blocks of one context. |
| `text` | <Documented /> | The text of the block. For `claudeMd` it is the instruction files framed as the engine frames them. It is empty when the engine announces none. | Type: `string`. |

### `PromptContextBlocks`

The context blocks of the first user message of a conversation, in the order that the engine renders them. `prompt.context` takes and answers the same.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `blocks` | <Documented /> | From core: `claudeMd` (when instruction files are loaded), `userEmail`, `attachedProject`, `currentDate`. Each is there only when present. | Type: `readonly PromptContextBlock[]`. |

### `PromptContextInput`

The input of `prompt.context`: the context blocks that the engine prepends to the first user message of a conversation, and the files behind `claudeMd`. Used by `prompt.context`, `$.prompt.context`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `blocks` | <Documented /> | From core: `claudeMd` (when instruction files are loaded), `userEmail`, `attachedProject`, `currentDate`. Each is there only when present. | Type: `readonly PromptContextBlock[]`. |
| `instructionFiles` | <Documented /> | The files behind `claudeMd`, in the order that it renders them, with `@` imports included. Empty when it renders none. | Type: `readonly InstructionFile[]`. Optional. Undefined when a hook above rewrote the `claudeMd` text. The files behind that text are then unknown, and a hook adds none of its own. |

### `PromptContextResult`

What a `prompt.context` hook returns: the blocks that the conversation carries, in order. The engine does not send one that is left out. It sends names such as `userEmail` again when the text differs. It sends its own `gitStatus` and `currentDate`. Used by `prompt.context`, `$.prompt.context`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `blocks` | <Documented /> | What the conversation carries, in order. | Type: `readonly PromptContextBlock[]`. A block whose name the engine does not route reaches the model once, when the conversation holds none. |
| `instructionFiles` | <Documented /> | The files now behind `claudeMd`. If left out, the ones from below stand. | Type: `readonly InstructionFile[]`. Optional. Kept in step with the `claudeMd` text. A hook may add, drop, or rewrite any kind. On `2.1.322`, the program gave the "not verified" label to a `managed` file that a mod added, and quoted its text. See [Labels in the Prompt](../../../../configure/memory-and-rules.md#labels-in-the-prompt). |

### `PromptDecoration`

One styled run that a surface paints over the prompt draft: `[start, end)` of a text, in UTF-16 code units like PromptBox `cursor`. Paint only. The engine clamps a range outside the text into it. The engine drops an empty range with no `virtualText`. A boundary inside a grapheme moves back to the start of that grapheme. Later entries win for each style key. It has its own fields plus `color`, `backgroundColor`, `dimColor`, `italic`, `underline`, and `strikethrough`, picked from `TextProps`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `start` | <Documented /> | The first code unit painted: an integer offset into the text that the list travels beside, clamped into it. | Type: `number`. |
| `end` | <Documented /> | The code unit past the last one painted. A run with `end <= start`, once clamped, paints nothing. | Type: `number`. |
| `bold` | <Documented /> | Drawn in bold. A decoration takes no `weight`. | Type: `boolean`. Optional. |
| `virtualText` | <Documented /> | A text drawn before the character at `start`, in the own style keys of this entry. It is never in the draft, no offset counts it, and it never holds the cursor. | Type: `string`. Optional. Typed text at `start` lands before it. A tab draws as four spaces. The engine drops control characters other than a newline. It is not drawn in the empty box, on a remote host, or in screen-reader mode, where it is heard as typed. |
| `color` | <Documented /> | The text color of the run. From `TextProps`. | Type: `Color`. Optional. |
| `backgroundColor` | <Documented /> | The background color of the run. From `TextProps`. | Type: `Color`. Optional. |
| `dimColor` | <Documented /> | The run drawn dim. From `TextProps`. | Type: `boolean`. Optional. |
| `italic` | <Documented /> | The run drawn in italics. From `TextProps`. | Type: `boolean`. Optional. |
| `underline` | <Documented /> | The run underlined. From `TextProps`. | Type: `boolean`. Optional. |
| `strikethrough` | <Documented /> | The run struck through. From `TextProps`. | Type: `boolean`. Optional. |

## Related Pages

- [Turn and Prompt Types](index.md)
- [Mod API Types](../index.md)
