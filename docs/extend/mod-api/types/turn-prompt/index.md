---
title: Turn and Prompt Types
description: "Types behind $.turn, $.prompt, and their events: prompts, attachments, system prompt sections, and the prompt box."
sidebar_position: 10
---

These are the types behind `$.turn`, `$.prompt`, and their events.
They describe prompts, attachments, system prompt sections, and the prompt box.

## Pages

| Page | What is in it |
| --- | --- |
| [Prompt Attachment, Autocomplete, and Context Types](attachments-context.md) | `AttributionTextInput` to `PromptDecoration`: attribution, attachments, plan mode details, autocomplete, the prompt box, change, compose, and context. |
| [Prompt Edit, Fill, Media, and Submit Types](edit-fill-submit.md) | `PromptEditInput` to `PromptSubmitResult`: edit, fill, paint, media, mention, origin, section, and submit types. |
| [Prompt Suggest, Skill, and Turn Types](suggest-skill-turn.md) | `PromptSuggestInput` to `UndeclaredAttachmentInput`: suggest, skill, and turn types, including the model step chunks. |

## Example

The first line reads the prompt box. The second submits text as if the user typed it. The third logs server tool uses of a model step.

```ts
const { text, cursor } = await $.prompt.read();
await $.prompt.submit({ text: "what the person typed", asUser: true });
for (const use of response.serverToolUses ?? []) {
  $.ui.log(use.name);
}
```

:::note[Shared Sections Skip `prompt.section`]
A `prompt.section` hook does not fire once per named section. From 2.1.302 to 2.1.321, the engine builds shared sections such as `lean_body` without a `prompt.section` call, so a hook does not see them.
A `prompt.compose` hook does see them. See [System Prompt](../../../../how-it-works/system-prompt.md).
:::

## Types without Fields

These types are aliases, unions, or plain shapes. Each row gives its use and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AttributionTextKind` | <Documented /> | Which git text `attribution.text` carries: the commit trailer, the PR footer, or the sentence that names the exemption (from the mandate or from the commit gate). | Alias of `'commit' \| 'pr' \| 'exemption' \| 'remedy'`. |
| `PromptComposeArgs` | <Documented /> | What a plugin passes `$.prompt.compose`: the facts that it wants composed for. The engine reads each one that it leaves out off the session (its model, its tools). | Alias of `Partial<PromptComposeInput>`. Used by `$.prompt.compose`. |
| `PromptComposeScope` | <Documented /> | Which side of the boundary of the prompt cache a section of the system prompt sits on: `shared` before it, `session` after it. | Alias of `'shared' \| 'session'`. `shared` text is the same for everyone on this build and model, so the API may cache it. `session` text varies. |
| `PromptComposeTrait` | <Documented /> | One branch that the own composition of the system prompt by the engine takes on the request or the session before it computes any section. It is a closed set. | Alias of `'bare' \| 'lean' \| 'sdk-preset' \| 'teammate' \| 'analysis' \| 'print' \| 'skills' \| 'send-user-message'`. Each trait tells a hook how the engine composes the prompt. `bare` is the one-line prompt of `--bare`. |
| `PromptFillMode` | <Documented /> | Where a `prompt.fill` puts its text: over the whole draft, after it, or into it at the cursor. | Alias of `'replace' \| 'append' \| 'insert'`. `replace` empties the box first. `append` adds after the draft. `insert` splices the text in at the cursor. |
| `PromptMentionAttached` | <Documented /> | How the engine attached a mentioned file, in the names that `prompt.attachment` gives its `type`. | Alias of `'file' \| 'already_read_file' \| 'pdf_reference'`. `already_read_file` means the model holds it unchanged. `pdf_reference` is a PDF too long to inline. |
| `PromptSuggestArgs` | <Documented /> | The input of `prompt.suggest` as the `$.prompt.suggest(args)` of a plugin takes it. The engine sets `origin` (the name of the calling plugin). | Alias of `Omit<PromptSuggestInput, 'origin'>`. Used by `$.prompt.suggest`. |
| `SkillFrontmatterList` | <Documented /> | A YAML sequence in the frontmatter of a skill, as JSON holds it. | Interface. |
| `SkillFrontmatterValue` | <Documented /> | One value in the frontmatter of a skill: what JSON holds, and assignable to and from `JsonValue`. | Alias of `null \| boolean \| number \| string \| SkillFrontmatterList \| SkillFrontmatter`. A date is the text that its author wrote. What JSON cannot hold (NaN, an infinity) is null. |
| `SkillPromptArgs` | <Documented /> | The input of `skill.prompt` as a call takes it. `frontmatter` and `source` may be left out, as a caller written before the event carried them does. | Alias of `SkillPromptInput` with optional `frontmatter` and `source`. If left out, they read `{}` and `built-in`. Used by `$.skill.prompt`. |
| `SkillSource` | <Documented /> | Whose words a skill is, in the own words of the engine: the settings tier whose skills folder holds it, or what else provides it. | Alias of `'userSettings' \| 'projectSettings' \| 'policySettings' \| 'plugin' \| 'built-in' \| 'mcp' \| 'syncedSkills'` or any string. The list is open, so a newer source is a word of its own. |
| `TurnCompleteInput` | <Documented /> | The input of `turn.complete`: the final message of the assistant for a turn. It is raised at the moment the turn ends (where the duration of the turn is reported). | Alias of `TurnCompleteFields & (TurnCompleteRefused \| TurnCompleteUnrefused)`. `reason` says why it ended. `refusal` exists on a refusal alone. Used by `turn.complete`, `$.turn.complete`. |
| `TurnCompleteReason` | <Documented /> | Why a turn ended. The model answered, the user interrupted it, the model refused with no fallback model to retry on, or an API error ended it. | Alias of `'answer' \| 'aborted' \| 'refusal' \| 'error'`. |
| `TurnStepChunk` | <Documented /> | One piece of a `turn.step` response as it streams through the chain. It is what the `next(e)` of a hook yields and what the hook yields up in turn. | Alias of six chunk types: text, thinking, tool start, tool input, stop, and `engine`. The first five are plain data that a hook reads and rewrites. A hook passes `engine` on unread. Used by `$.turn.step`. |
| `TurnStopReason` | <Documented /> | Why the model stopped, as a `turn.step` result and its stop chunk carry it. It is one of the stop reasons of the API, or null when no response arrived. | Alias of `'end_turn' \| 'max_tokens' \| 'stop_sequence' \| 'tool_use' \| 'pause_turn' \| 'compaction' \| 'refusal' \| 'model_context_window_exceeded' \| null`. |
| `UsageUnit` | <Documented /> | One unit of what `$.session.usage()` answers, by its key there: the fill of the context window, the rate-limit windows, the cost of the session. | Alias of `'context' \| 'rateLimits' \| 'cost'`. |

## Related Pages

- [Mod API Overview](../../index.md)
- [Turn and Prompt](../../calls/turn-prompt.md)
- [System Prompt](../../../../how-it-works/system-prompt.md)
- [Mod API Types](../index.md)
