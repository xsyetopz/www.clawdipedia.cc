---
title: Prompt Suggest, Skill, and Turn Types
description: "Types of prompt suggestions, skill prompts, and the turn events: start, step, chunks, usage, and complete."
sidebar_position: 3
---

## Types with Fields

Each type below has its own table of fields.

### `PromptSuggestInput`

The input of `prompt.suggest` (prompt-suggest/): a text about to be displayed dim in the empty prompt box, for Tab (or the right arrow) to take. Used by `prompt.suggest`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The proposed prompt. The box displays it but does not write it. Taking it puts it in the box for editing. `next({ ...e, text })` proposes another. | Type: `string`. |
| `origin` | <Documented /> | Who proposes (PromptSuggestOrigin). The engine sets it where the proposal starts. Pinned: `next(e)` passes it on as received. | Type: `PromptSuggestOrigin`. |

### `PromptSuggestOrigin`

Who proposes the text at `prompt.suggest`, as the engine stamps it where the proposal starts. It is a closed set that a matcher narrows on. `next(e)` passes it on as received. No hook sets one.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The own guess of the engine at the next prompt of the person, generated after a turn (the prompt-suggestion service). | Type: `'suggestion'`. |
| `kind` | <Documented /> | The `$.prompt.suggest` of a plugin. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the proposing plugin. | Type: `string`. |

### `PromptSuggestResult`

What a `prompt.suggest` hook returns and what `next(e)` resolves to: whether the text is now the dim suggestion of the box. Used by `prompt.suggest`, `$.prompt.suggest`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isShown` | <Documented /> | True once the box has the suggestion to display, at once or as soon as a dialog gives the box back. False where it cannot display. | Type: `boolean`. It cannot while the box holds text, a turn runs, the text is blank, or the session is headless. A hook that answers `{ isShown: false }` without `next` keeps it from displaying. |

### `SkillFrontmatter`

What the file of a skill declares above its text, parsed and JSON-safe. Each key is as YAML reads it, and none is respelled. Each value is whatever JSON holds. Interface with free keys. Plain data within bounds: 32 levels, 20,000 values, 100,000 characters. A block past them is handed as `{}`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[key: string]` | <Documented /> | Each key that the skill file declares, with its value as YAML reads it. | Type: `SkillFrontmatterValue`. |

### `SkillPromptInput`

The input of `skill.prompt`: the prompt of one skill, at the moment the engine expanded it for the model. The skill is typed as `/name`, run by the Skill tool, or preloaded into a subagent. A hook rewrites `text` and `frontmatter` only. Used by `skill.prompt`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `skill` | <Documented /> | Which skill (`commit`), the key a matcher narrows on. | Type: `string`. |
| `text` | <Documented /> | The text of the prompt as the skill computed it (its text blocks, joined). Since `2.1.323`, the type file (`schemas/claude-code.d.ts`) no longer says that it ends with the `compatibility` line of the file and the text of Claude Code for Claude about it. | Type: `string`. |
| `frontmatter` | <Documented /> | What the file of the skill declares above its text, as its author wrote it. Keys are as YAML reads them, and the strings of a remote author are scrubbed. | Type: `SkillFrontmatter`. No key named `__proto__`, `constructor`, or `prototype`. It is not the effective grants. The grants of a call are read at `tool.check`. |
| `frontmatterProblem` | <Documented /> | Why the frontmatter of the file was left out (`{}`), or a key of it. It is prose for a person, not to match on. Absent if handed whole or none exists. | Type: `string`. Optional. The engine refuses nothing for it. A hook that decides on frontmatter is the one to refuse a skill whose problem is set. |
| `source` | <Documented /> | Whose words these are, in the words of `SkillSource`. | Type: `SkillSource`. The words of a `projectSettings` skill are those of its repository. The words of an `mcp` skill are those of its server. Nobody vouches for any of them. |
| `pluginName` | <Documented /> | The name of an installed plugin, when the skill comes from one. | Type: `string`. Optional. |
| `path` | <Documented /> | Where the file that it was loaded from is, as an absolute path: the SKILL.md of a skill, or the own `.md` file of a command. | Type: `string`. Optional. The path as the loader joined it. Absent with no file on this machine, such as a built-in or MCP skill. |

### `SkillPromptResult`

What a `skill.prompt` hook returns: the text that the model reads for that skill. Used by `skill.prompt`, `$.skill.prompt`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text that the model reads for the skill. | Type: `string`. |

### `TurnCompleteFields`

What every `turn.complete` carries, whatever its reason. It has the answer, the duration, the interrupt flag, the id of the turn, its loop and what it cost.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `answer` | <Documented /> | The final visible text of the assistant this turn ("" if none, for example thinking-only). | Type: `string`. For a subagent that handed its report back, this is the report as delivered. A refused hand-back changes nothing. |
| `durationMs` | <Documented /> | Wall-clock length of the turn in milliseconds. | Type: `number`. |
| `isAborted` | <Documented /> | True when the turn ended by interruption (`reason === 'aborted'`). | Type: `boolean`. |
| `turnId` | <Documented /> | The id of the turn, the same one that its `turn.start` and every `turn.step` carried, on the main loop and in the run of a subagent alike. | Type: `string`. A hook that heard the start of a turn hears its end too, even for an aborted run. |
| `agentId` | <Documented /> | The loop that the turn ran in: the id of a subagent, as `$.agent.spawn` resolves it. Each run of its loop is one turn. Absent on the main loop. | Type: `string`. Optional. Pinned: a different value is refused. Every hook hears the end of an agent, so a plugin gets the answer of its child. |
| `usage` | <Documented /> | What the turn cost. It sums the token counts of its real requests and what the stop of a made-up response stated. It also has the model of the last response that counted. | Type: `TurnUsage`. Optional. A response that a `turn.step` hook made up adds nothing unless its stop states usage. Absent when nothing counted (an interrupt, an API error). |

### `TurnCompleteRefused`

The end of a turn that the model refused with no fallback model to retry on. What the API said of the refusal rides along.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `reason` | <Documented /> | Why the turn ended: `refusal`. | Type: `'refusal'`. |
| `refusal` | <Documented /> | What the API said about the refusal. | Type: `TurnRefusal`. |

### `TurnCompleteResult`

What a `turn.complete` hook returns and what `next(e)` resolves to: `{ text }`. The engine displays a text other than the answer of a main loop beneath it. Core fills `usage` from `e.usage` when the turn had one. Used by `turn.complete`, `$.turn.complete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text of the answer of the turn. | Type: `string`. |
| `usage` | <Documented /> | What the turn cost. Core fills it from `e.usage` when the turn had one. | Type: `TurnUsage`. Optional. |
| `by` | <Undocumented /> | The engine sets it: the plugins that wrote the text, or that rewrote the answer they passed down. Their names head the note of the text. | Type: `readonly string[]`. Optional. The engine replaces what a hook puts there. New in `2.1.319`. |

### `TurnCompleteUnrefused`

The end of a turn that was not a refusal. The turn was answered, interrupted, or dead on an API error (retries exhausted, the context limit). Nothing more.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `reason` | <Documented /> | Why the turn ended: any reason but `refusal`. | Type: `Exclude<TurnCompleteReason, 'refusal'>`. |

### `TurnRefusal`

What the API said about a refusal that ended a turn. It has the category of the classifier and its explanation, each null when the API sent none.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `category` | <Documented /> | The category of the classifier, or `null` when the API sent none. | Type: `string \| null`. |
| `explanation` | <Documented /> | The explanation of the classifier, or `null` when the API sent none. | Type: `string \| null`. |

### `TurnStartInput`

The input of `turn.start`: the prompt that a model turn begins with, for the main loop or for the run of a subagent or teammate (`agentId`). On the main loop it comes after `prompt.submit` and the `UserPromptSubmit` settings hooks. Used by `turn.start`, `$.turn.start`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text of the user as the turn proceeds with it ("" for a turn started without a typed prompt, for example a continuation). | Type: `string`. In the run of a subagent, the prompt that the run begins with. It is empty for a continued turn. |
| `turnId` | <Documented /> | The id of the turn, minted here. Every `turn.step` and the `turn.complete` of this turn carry the same one. | Type: `string`. |
| `agentId` | <Documented /> | The loop that the turn runs in: the id of a subagent or teammate, as `agent.spawn` answers it and `$.agent.list()` lists it. Absent on the main loop. | Type: `string`. Optional. Pinned: a different value is refused. The hooks that the spawn of an agent was nested in do not hear its start. |

### `TurnStartResult`

What a `turn.start` hook returns and what `next(e)` resolves to: `{ turnId }`, echoed by core. The own value of a hook does not change the turn. Used by `turn.start`, `$.turn.start`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `turnId` | <Documented /> | The ID of the turn, echoed by core. | Type: `string`. |

### `TurnStepEngineChunk`

An item of the stream of the engine that the other chunk kinds do not model. Examples are the envelope, the start and end of a block, and a retry marker. Opaque by `ref`. A tool call that the API runs itself streams as these chunks. Pass each on as it came.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Marks an engine chunk: `engine`. | Type: `'engine'`. |
| `ref` | <Documented /> | The handle of the engine on the item. Opaque, and for this step only. | Type: `number`. |

### `TurnStepInput`

The input of `turn.step`: one model request inside a turn, at the moment the engine is about to send it. The bottom of the chain sends it. The transcript is not on it. `messageCount` says how many messages go out. A hook rewrites `model` or `effort` only. Used by `turn.step`, `$.turn.step`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `turnId` | <Documented /> | The turn that this step belongs to: the id of its `turn.start`, which its `turn.complete` will carry too. Pinned. | Type: `string`. |
| `index` | <Documented /> | The position of the step in the turn, from 0. Pinned. | Type: `number`. |
| `model` | <Documented /> | Which model the request names, as the engine resolved it for this step (the session's, a fallback's). `next({ ...e, model })` names another, by an alias (`haiku`) or a full ID. | Type: `string`. Since `2.1.309` an alias resolves to its model. Before, it failed the request with a model error ([v2.1.309 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.309)). |
| `effort` | <Documented /> | How hard the request asks the model to think: the setting of the session or the default of the model. Absent for a model without effort. A hook can rewrite it. Since `2.1.321`, the value is the level that the loop, turn, or session set, or the default of the model. A rewrite is not carried to later steps. On a model that takes effort per message, the level in force stands from one message with input to the next: another named level on a step whose new input is tool results is not sent, and one on a step with input stays for the tool steps after it. A number goes out at once on an internal build and not at all on a public one, unless the `maxEffortLevel` setting turns it into a level (`captures/2.1.321/types.diff`). Since `2.1.323`, the level can also come from `CLAUDE_CODE_EFFORT_LEVEL`. The field is absent on a model without effort, or if that variable is `unset` or `auto` with no `maxEffortLevel` cap. A rewrite lasts one step. On a model that takes effort per message, a level on tool results alone is not sent if another is in force, and one on a step with input stays for later tool steps whose `effort` is a level. A number goes out at once on internal builds only, unless that cap makes it a level, and public builds refuse the number from a hook (`schemas/claude-code.d.ts`, `TurnStepInput`). | Type: `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max' \| number`. Optional. |
| `messageCount` | <Documented /> | How many messages the request carries (the conversation so far, with the tool results of the turn included). Pinned: the messages belong to the engine. | Type: `number`. |
| `agentId` | <Documented /> | The loop that the request is made in: the id of a subagent, the `id` that `$.agent.list()` gives it and its `tool.call`s carry. Absent on main. | Type: `string`. Optional. Pinned: a different value is refused. A subagent that a hook spawned steps past that hook. |

### `TurnStepInputChunk`

A piece of the arguments of a tool call as they arrive. It is partial JSON text, for the `tool` chunk of the same `index`. The tool arguments are these pieces joined and parsed once the block ends. Broken JSON leaves the call with no usable arguments. Combines `TurnStepInputChunk`, `ChunkRef`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Marks a tool argument chunk: `input`. | Type: `'input'`. |
| `index` | <Documented /> | The block that the piece belongs to. It matches the `tool` chunk of the same index. | Type: `number`. |
| `json` | <Documented /> | The next piece of the JSON text of the arguments. | Type: `string`. |

### `TurnStepResult`

What a `turn.step` hook returns and what `next(e)` resolves to: the response of the model to the request of the step, once all its blocks are in. The own value of a hook changes what the hooks above it read, never what the engine streamed. Used by `turn.step`, `$.turn.step`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `turnId` | <Documented /> | The turn that this step belongs to, as received. | Type: `string`. |
| `index` | <Documented /> | The position of the step in the turn, as received. | Type: `number`. |
| `answer` | <Documented /> | The visible text of the response ("" when it only called tools, only thought, or when no request was made). | Type: `string`. |
| `toolUses` | <Documented /> | The tool calls that the response asks the engine to run, in order. Empty for a step that asks for none. | Type: `readonly TurnStepToolUse[]`. |
| `serverToolUses` | <Documented /> | The tool calls that the API ran itself inside the request (the advisor is one), in order, each with when it started and ended. | Type: `readonly TurnStepServerToolUse[]`. Optional. Tools that the API ran itself. A hook reads them here and cannot refuse or rewrite them. |
| `stopReason` | <Documented /> | Why the model stopped. It is null when no response arrived (the request failed or was interrupted before a message, or no request was made). | Type: `TurnStopReason`. |
| `usage` | <Documented /> | What the request cost as the API reported it, and the model that answered. It is null when no response arrived or it carried no usage. | Type: `TurnUsage \| null`. |

### `TurnStepServerToolUse`

One tool call of a step that the API ran itself, inside the request (the advisor is one). The engine ran nothing for it. No `tool.check`, `tool.call`, or `tool.describe` chain runs for it. A tool that the engine runs, such as `WebSearch`, is in `toolUses`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | The id of the call, as its result block names it (`tool_use_id` there). | Type: `string`. |
| `name` | <Documented /> | The name of the server tool as the API spells it (`advisor`). | Type: `string`. |
| `input` | <Documented /> | The arguments that the model gave it. | Type: `unknown`. |
| `startedAt` | <Documented /> | When the model had written the call and the API began to run it, in the milliseconds of `$.clock.now()`. | Type: `number`. |
| `endedAt` | <Documented /> | When the result of the call had arrived, in the same milliseconds. | Type: `number`. Optional. Absent when the response ended before the result, such as a cut stream. |

### `TurnStepStopChunk`

The response is whole. It has why the model stopped and what the request cost, as the result of the step will carry them. The last chunk of one response. Combines `TurnStepStopChunk`, `ChunkRef`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Marks the final chunk: `stop`. | Type: `'stop'`. |
| `stopReason` | <Documented /> | Why the model stopped. | Type: `TurnStopReason`. |
| `usage` | <Documented /> | What the request cost, or `null`. | Type: `TurnUsage \| null`. |

### `TurnStepTextChunk`

A piece of the visible text of the response as it arrives, in block `index`. The text on screen and the text in the transcript are both these chunks joined in order. A rewrite changes both. Combines `TurnStepTextChunk`, `ChunkRef`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Marks a text chunk: `text`. | Type: `'text'`. |
| `index` | <Documented /> | The content block that the piece belongs to, from 0 within one response. | Type: `number`. |
| `text` | <Documented /> | The next piece of the response text. | Type: `string`. |

### `TurnStepThinkingChunk`

A piece of the thinking of the model as it arrives, in block `index`. It is what the person sees of it live. The transcript keeps the thinking block that the model signed. The engine displays thinking that a hook streams alone, and does not record it. Combines `TurnStepThinkingChunk`, `ChunkRef`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Marks a thinking chunk: `thinking`. | Type: `'thinking'`. |
| `index` | <Documented /> | The block that the piece belongs to. | Type: `number`. |
| `text` | <Documented /> | The next piece of the thinking of the model. | Type: `string`. |

### `TurnStepToolChunk`

The model begins a tool call in block `index`. It has the name of the tool and the id of the call. Its arguments follow as `input` chunks of the same index. Combines `TurnStepToolChunk`, `ChunkRef`. A block whose `tool` chunk never comes out of the chain is no tool call. The engine records none and runs none.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Marks the start of a tool call: `tool`. | Type: `'tool'`. |
| `index` | <Documented /> | The block that the tool call is in. | Type: `number`. |
| `id` | <Documented /> | The `tool_use_id` of the call. | Type: `string`. |
| `name` | <Documented /> | The name of the tool (`Read`, `Bash`, `mcp__server__tool`). | Type: `string`. |

### `TurnStepToolUse`

One tool call that the model asked for in a step. It has the name of the tool and its arguments.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The name of the tool (`Read`, `Bash`, `mcp__server__tool`). | Type: `string`. |
| `input` | <Documented /> | The arguments that the model gave it, as the tool schema shapes them. | Type: `unknown`. |

### `TurnUsage`

What a model turn, or one response inside it, cost as the API reported it. It has the four token counts (ModelUsage) and the id of the model. Combines `TurnUsage`, `ModelUsage`. The counts of a turn are the sum of those of its responses. Its model is the model of the last response.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `model` | <Documented /> | Which model answered, by the id the API reports. | Type: `string`. |

### `UndeclaredAttachmentInput`

One `prompt.attachment` input of every other type, the ones that PromptAttachmentDetailOf does not name. It has the text of the attachment alone.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | As the engine names the kind of the attachment, and the key that a matcher narrows on. Pinned. Builds add and retire kinds, so match by name. | Type: `string`. The attachment kind, such as `todo_reminder`, `auto_mode`, `instructions`, `nested_memory`, `skill_listing`, `file`, or `queued_command`. |
| `text` | <Documented /> | What the model reads for this attachment, inside the framing of the engine. A hook can rewrite it with `next({ ...e, text })`. | Type: `string`. The `<system-reminder>` wrapper goes around what the chain answers, never inside it. Several text blocks arrive joined by newlines. |
| `origin` | <Documented /> | Who authored the text (PromptAttachmentOrigin): the engine, a settings hook, or the chain context of a plugin. | Type: `PromptAttachmentOrigin`. Pinned: a different value is refused, one left out is kept. |
| `agentId` | <Documented /> | The loop whose request carries the attachment: a subagent's id, the `id` `$.agent.list()` gives it and its `tool.call`s carry, absent on main. | Type: `string`. Optional. Pinned: a different value is refused, one left out is kept. A subagent that a hook spawned through `$.agent.spawn` is resolved past that hook. |
| `detail` | <Documented /> | Absent, as the key itself. The engine declares no facts for the type, and the engine refuses a rewrite that adds the key. | Type: `undefined`. Optional. Example: `if (!("detail" in e)) return next(e)`. |

## Related Pages

- [Turn and Prompt Types](index.md)
- [Mod API Types](../index.md)
