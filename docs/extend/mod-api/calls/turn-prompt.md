---
title: Turn and Prompt
description: The $.turn and $.prompt nouns, and the events that follow a turn from start to end, including the system prompt, context blocks, and attachments.
sidebar_position: 10
---

`$.turn` ends the running turn.
`$.prompt` sends a prompt as a user turn and works with the prompt box.
The events follow a turn from start to end, and they cover the system prompt, the context blocks, and attachments.

Return `{ drop }`, `{ deny }`, or `{ text: null }` from the right hook to stop or remove something.

Official pages: [React to Events](https://code.claude.com/docs/en/plugins/mods/events), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.323 program (`schemas/claude-code.d.ts`).
"Run time" appears in a "Where it can be used" cell. It means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

This hook trims the whitespace of every prompt before the model reads it.

```javascript
on("prompt.submit", async ($, e, next) => next({ ...e, text: e.text.trim() }));
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.turn.abort` | <Documented /> | Cancels the running model turn of the main loop. Running tools stop. No interruption marker appears. | `(input) => Promise<void>`. Use the id that its `turn.start` gave this plugin. Rejects if `turnId` is not the running turn's id. A hook may end its own turn. | Only for the running turn of the main loop. |
| `$.prompt.submit` | <Documented /> | Submits a prompt. It is the event `prompt.submit`, the same call the engine makes for a typed prompt. It is a turn of its own, once the session is idle. | `(input: PromptSubmitArgs) => Promise<PromptSubmitResult>`. The model reads it as a user turn. Every hook but the calling one sees it. | Run time. |
| `$.prompt.read` | <Documented /> | Returns the prompt box as it stands: the draft typed so far and the cursor offset. | `() => Promise<PromptBox>`. Never rejects. Gives `{ text: '', cursor: 0 }` where no box is drawn, such as a `-p` run. | Run time. |
| `$.prompt.media` | <Documented /> | Returns one image or document of the prompt that someone submits, by the `id` that `e.attachments` lists. Gives its bytes as base64, 4 MiB a call. | `(args: PromptMediaArgs) => Promise<PromptMedia>`. Works only in a `prompt.submit` hook of a mod that managed settings install. Otherwise `{ deny }`. | The `prompt.submit` hook of a mod that managed settings install. |
| `$.prompt.fill` | <Documented /> | Puts `input.text` in the prompt box as the draft, by `mode`: `replace` (default), `append`, or `insert` at the cursor. An optional `cursor` places the caret afterwards. | `(input: PromptFillArgs) => Promise<PromptFilled>`. Gives `isFilled: false` under a dialog or when headless. | Run time. |
| `$.prompt.paint` | <Documented /> | Sets this plugin's own decorations over the draft and nothing else: no text, caret, or undo entry, and no `prompt.change` or `prompt.edit`. It is the event `prompt.paint`. | `(input: PromptPaintArgs) => Promise<PromptPainted>`. Hooks may rewrite it or answer `{ deny }`. Gives `isPainted: false` when the draft no longer reads `text`, or another plugin hooks its read. Since `2.1.311`. | Run time. |
| `$.prompt.suggest` | <Documented /> | Proposes `input.text` as the dim suggestion of the prompt box. Tab takes it. | `(input: PromptSuggestArgs) => Promise<PromptSuggestResult>`. Gives `{ isShown: false }` while the box has text or a turn runs. | Run time. |
| `$.prompt.compose` | <Documented /> | Returns the sections of the system prompt. It is the event `prompt.compose`, the call the engine makes for every prompt it sends. | `(input?: PromptComposeArgs) => Promise<PromptComposeResult>`. Builds the sections without sending them. Example: `(await $.prompt.compose()).sections.map(s => s.id)`. | Run time. |

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `prompt.submit` | <Documented /> | Fires on a submitted prompt, before the turn starts. `next(e)` runs the hooks beneath and the `UserPromptSubmit` settings hooks, then enters. | Input `PromptSubmitInput`. A hook returns `{ text, context? }` or `{ drop }`, rewrites with `next({ ...e, text })`, or stops the prompt with `{ drop: reason }`. A guard that fails lets the prompt through. | `on('prompt.submit', ...)`. Also `$.prompt.submit(...)`. |
| `prompt.fill` | <Documented /> | Fires when a text is about to go into the prompt box as the draft. `next(e)` writes it by `e.mode`. | Input `PromptFillInput`. Result `{ isFilled }`. `mode` is `replace`, `append`, or `insert`. Answer `{ isFilled: false }` without `next` to keep the text out. | `on('prompt.fill', ...)`. Also `$.prompt.fill(...)`. |
| `prompt.paint` | <Documented /> | Fires when a plugin calls `$.prompt.paint`, with the runs it wants painted over the draft. `next(e)` paints them. | Input `PromptPaintArgs`. Result `PromptPainted`. A hook may rewrite the argument or answer `{ deny }`. Since `2.1.311`. | `$.prompt.paint(...)`. |
| `prompt.suggest` | <Documented /> | Fires when the engine or a plugin proposes a text as the dim suggestion: the engine's guess after a turn, or a plugin's `$.prompt.suggest`. | Input `PromptSuggestInput`. Result `{ isShown }`. Rewrite with `next({ ...e, text })`, or answer `{ isShown: false }` to drop it. | `on('prompt.suggest', ...)`. Also `$.prompt.suggest(...)`. |
| `prompt.edit` | <Documented /> | Fires when the person edits the main prompt box: a key the editor took as an edit, or a paste. `next(e)` resolves the box the editor shows. | Input `PromptEditInput`. Result `{ text, cursor }`. A burst of keys is one edit. Answering without `next` consumes the keys. This hook has a 50 millisecond budget. | `on('prompt.edit', ...)`. |
| `prompt.change` | <Documented /> | Fires after the text of the main prompt box changed and no `prompt.edit` carried it: a recalled history entry, a clear, a plugin's fill. | Input `PromptChangeInput`. Result `{ text }`. Observe only. One call for each batch of changes. | `on('prompt.change', ...)`. |
| `prompt.autocomplete` | <Documented /> | Fires as the person types in the main prompt box, for the token at the cursor. `next(e)` resolves to `{ suggestions }`, rows for the typeahead. | Input `PromptAutocompleteInput`. Your rows join below the engine's rows. Nothing waits on them. | `on('prompt.autocomplete', ...)`. |
| `prompt.section` | <Differs note="Docs say every named section; the program skips shared sections such as lean_body." /> | Fires when the engine builds some named sections of the system prompt. `next(e)` resolves to `{ text }` as core computed it. | Input `PromptSectionInput`. Result `{ text }`, or null to leave the section out. The answer is cached until `$.ui.invalidate("prompt.section")`. Since `2.1.321`, a changed answer waits for a new thread or a compaction, unless the result says `breakPromptCache: true`. Until `2.1.319`, the type file said a changed answer went out on the next turn and lost the thinking and the prompt cache. Not every section goes through it: from 2.1.302 to 2.1.323 the engine builds the shared `lean_body` section without a `prompt.section` call, so this hook does not see it. A `prompt.compose` hook sees it. See [System Prompt](../../../how-it-works/system-prompt.md#sections). | `on('prompt.section', ...)`. In tests: `$.prompt.section(...)` on the test engine (not on a hook's `$`). |
| `prompt.context` | <Documented /> | Fires once for each conversation, when the engine computes the context blocks that its first user message carries. `next(e)` resolves to `{ blocks }`. | Input `PromptContextInput`. Append, drop, reorder, or rewrite blocks. The answer stands until `$.ui.invalidate("prompt.context")`. | `on('prompt.context', ...)`. In tests: `$.prompt.context(...)` on the test engine (not on a hook's `$`). |
| `prompt.compose` | <Documented /> | Fires when the engine renders a system prompt. `next(e)` resolves to `{ sections }`, each `{ id, text, scope }`, in the order that the engine sends them. | Input `PromptComposeInput`. Every `shared` section comes before every `session` section. A wrong order skips the hook. See [System Prompt](../../../how-it-works/system-prompt.md#sections). | `on('prompt.compose', ...)`. Also `$.prompt.compose(...)`. |
| `prompt.attachment` | <Documented /> | Fires once for each message the engine adds for the model on its own (a reminder, a mode change, a mentioned file). It fires as a request carries the message. | Input `PromptAttachmentInput`. Result `{ text }`, or `{ text: null }` to leave the attachment out. The transcript keeps the engine's record. | `on('prompt.attachment', ...)`. In tests: `$.prompt.attachment(...)` on the test engine (not on a hook's `$`). |
| `prompt.mention` | <Documented /> | Fires once for each path a prompt names after an `@` (a directory aside), before the engine reads it. `next(e)` reads it and resolves `{ type }`. | Input `PromptMentionInput`. Result `{ type, context? }` or `{ deny }`. This read raises no `tool.call`. The engine skips a guard that fails, and reads the file. | `on('prompt.mention', ...)`. In tests: `$.prompt.mention(...)` on the test engine (not on a hook's `$`). |
| `skill.prompt` | <Documented /> | Fires when the engine expands a skill's prompt for the model (`/name`, the Skill tool, a preload). `next(e)` resolves to `{ text }`. | Input `SkillPromptInput`. The text replaces what the model reads. A hook that fails passes through. | `on('skill.prompt', ...)`. In tests: `$.skill.prompt(...)` on the test engine (not on a hook's `$`). |
| `attribution.text` | <Documented /> | Fires when the engine composes a git text that the model writes (`kind`: `commit`, `pr`, `exemption`, `remedy`). `next(e)` resolves to `{ text }`. | Input `AttributionTextInput`. The text replaces what the model reads. A hook that fails passes through. | `on('attribution.text', ...)`. In tests: `$.attribution.text(...)` on the test engine (not on a hook's `$`). |
| `turn.start` | <Documented /> | Fires when a model turn starts, main's or a subagent's (`e.agentId`), before its first model call. `next(e)` resolves to `{ turnId }`. | Input `TurnStartInput`. Observe only. To act for the main loop alone, return `next(e)` first when `e.agentId` is set. | `on('turn.start', ...)`. In tests: `$.turn.start(...)` on the test engine (not on a hook's `$`). |
| `turn.step` | <Documented /> | Fires when the engine is about to send a model request of a turn. `next(e)` resolves to the whole response. | Input `TurnStepInput`. Result: the response (`turnId`, `index`, `answer`, `toolUses`, `stopReason`, `usage`). It streams. `next({ ...e, model })` sends another model. | `on('turn.step', ...)`. A streaming hook (async generator). |
| `turn.complete` | <Documented /> | Fires when a model turn ends, where the engine reports its duration. `next(e)` resolves to `{ text }`, the answer. `e.reason` says why. | Input `TurnCompleteInput`. A different text shows beneath the answer. The transcript is never rewritten. | `on('turn.complete', ...)`. In tests: `$.turn.complete(...)` on the test engine (not on a hook's `$`). |

## Events Raised by These Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `turn.abort` | <Documented /> | `$.turn.abort({ turnId })` | Input `{ turnId: string }`. Value `void`. |
| `prompt.read` | <Documented /> | `$.prompt.read()` | Input `NoArgs`. Value `PromptBox`. |
| `prompt.paint` | <Documented /> | `$.prompt.paint(args)` | Input `PromptPaintArgs`. Value `PromptPainted`. Since `2.1.311`. |

## Related Pages

- [Mod API Overview](../index.md)
- [System Prompt](../../../how-it-works/system-prompt.md)
- [Tool, Command, and Config](tool-command-config.md)
- [Turn and Prompt Types](../types/turn-prompt/index.md) (prompt, attachment, and model step types)
