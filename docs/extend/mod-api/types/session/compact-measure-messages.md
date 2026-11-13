---
title: Session Compact, Detach, Measure, and Messages Types
description: "Types of compact, context usage, cost, detach, end, identity, measure, and the messages call."
sidebar_position: 2
---

## Types with Fields

Each type below has its own table of fields.

### `SessionCompactArgs`

The input of `session.compact` as the `$.session.compact(args)` of a plugin takes it. The engine sets `trigger` (`plugin`), `messages` and `agentId`. Used by `$.session.compact`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `instructions` | <Documented /> | What the summary should keep or stress, as typed after `/compact`. If absent, the compaction prompt of the engine alone. | Type: `string`. Optional. |

### `SessionCompacted`

A compaction that stands. It has the conversation as it reads afterwards. It also has the counts and request usage that the engine recorded when it was the one compacting.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `messages` | <Documented /> | The conversation after the compaction, oldest first. From core, it is its summary and the messages it kept. From a hook, it is whatever the hook hands up. | Type: `readonly SessionMessage[]`. What the transcript becomes after compaction. A message with a `handle` stays as it is. The engine builds others from `role`, `text`, and tool blocks. The transcript line that records the compaction is described in [Compaction Rows](../../../../reference/transcript-format.md#compaction-rows). |
| `tokensBefore` | <Documented /> | The size of the conversation before, in tokens. Absent when core did not record it. | Type: `number`. Optional. |
| `tokensAfter` | <Documented /> | Its size afterwards, in tokens. Absent on `precompute` and when core did not record it. | Type: `number`. Optional. |
| `usage` | <Documented /> | What the own model request of the compaction cost (ModelUsage), when core made one: the token counts of the summarizer as the API reported them. | Type: `ModelUsage`. Optional. Absent when a hook answered, when a stored summary was reused, or when the response gave none. The cost ledger already holds it. |
| `skip` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

A hook that keeps messages changes what `--resume` loads. A kept message with a `handle` comes back as the engine's own row. A kept tool result row points to its assistant row through `sourceToolAssistantUUID`, and the loader follows that link. It also adds back the tool results that share one `message.id`. So a kept tool result with a `handle` can pull rows from before the boundary into the next session. A message without a `handle` is built anew. A boundary row from a hook can carry `preservedMessages` (the kept `uuids`) and has no `preservedSegment`. See [Compaction Rows](../../../../reference/transcript-format.md#compaction-rows). Source: the program (`chunk-2x9ma4k7.js`).

### `SessionCompactInput`

The input of `session.compact`: one compaction of the conversation, about to run. `messages` is the transcript it runs over. Used by `session.compact`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `trigger` | <Documented /> | What is compacting (SessionCompactTrigger), the key that a matcher narrows on. Pinned: `next(e)` passes it on as received. | Type: `SessionCompactTrigger`. |
| `agentId` | <Documented /> | The id of the loop that compacts, for the own transcript of a subagent or a fork. Absent for the main conversation (the `agentId` of tool.call). | Type: `string`. Optional. Pinned: a rewrite that changes it fails the hook. `e.messages` is the transcript of this loop, not the main one. |
| `instructions` | <Documented /> | What the summary should keep or stress: the text after `/compact`, the text of a plugin, or absent. | Type: `string`. Optional. `next({ ...e, instructions })` changes what the summarizer is told. |
| `messages` | <Documented /> | The transcript being compacted, in the shape of `$.session.messages()`, with each message carrying the `handle` of the engine. A subagent has its own under `agentId`. | Type: `readonly SessionMessage[]`. `next({ ...e, messages })` changes what is summarized: a message kept with its handle is the engine's own, whole. One without is read as built. |

### `SessionCompactSkipped`

A compaction vetoed: on `precompute` nothing is computed or kept. On any other trigger the conversation stays as it is and one line says why. Core answers it too, when a classic PreCompact hook blocks.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `skip` | <Documented /> | Why, as the notice reads. | Type: `string`. |
| `messages` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `SessionContextBreakdown`

The context window broken down as /context breaks it down. It has the rows, the grid and the lists beneath it, in the shape of the `get_context_usage` of the SDK. Token counts are numbers. A `full` breakdown uses the token-count API where it can. A `summary` one only estimates.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `categories` | <Documented /> | One row for each category, with the free space and the compaction buffer among them. `kind` says which is which. | Type: `ContextCategory[]`. |
| `totalTokens` | <Documented /> | Tokens in use, unclamped: past `rawMaxTokens` when over the window. | Type: `number`. |
| `maxTokens` | <Documented /> | The window measured against, the same figure as `rawMaxTokens`. | Type: `number`. |
| `rawMaxTokens` | <Documented /> | The window measured against, in tokens: the limit of the model, or a smaller compaction window (`autocompactSource` says which). | Type: `number`. |
| `autocompactSource` | <Documented /> | How that window was settled (ContextWindowSource). The reply of the SDK carries it under this name too, outside its typed schema. | Type: `ContextWindowSource`. |
| `percentage` | <Documented /> | `totalTokens` over `rawMaxTokens` as a whole percentage, 0 to 100, and past it when over. | Type: `number`. |
| `gridRows` | <Documented /> | The grid, row by row: 10 by 10, or 20 by 10 for a window of a million or more. It is 5 wide when asked for under 80 `columns`. | Type: `ContextGridSquare[][]`. |
| `model` | <Documented /> | Which model the breakdown was computed for, as `/model` displays it. | Type: `string`. |
| `memoryFiles` | <Documented /> | Each memory file in the context, with its path and tokens. | Type: `ContextMemoryFile[]`. |
| `mcpTools` | <Documented /> | The schema of each MCP tool, with its server and tokens. | Type: `ContextMcpTool[]`. |
| `agents` | <Documented /> | The custom agents the Agent tool describes, each with its tokens. | Type: `ContextAgent[]`. |
| `slashCommands` | <Documented /> | The slash-command listing, counted. Absent when the session lists none. | Type: `ContextSlashCommands`. Optional. |
| `skills` | <Documented /> | The skill listing, counted, with one entry for each skill. Absent when the session lists none. | Type: `ContextSkills`. Optional. |
| `autoCompactThreshold` | <Documented /> | The token count at which auto-compaction runs. Absent when it is off. | Type: `number`. Optional. |
| `isAutoCompactEnabled` | <Documented /> | Whether auto-compaction is on for the session. | Type: `boolean`. |
| `apiUsage` | <Documented /> | The token counts (ModelUsage) that the last API response of the live window reported, or null before one came back. | Type: `ModelUsage \| null`. The breakdown reconciles its `Messages` row to it. |

### `SessionContextUsage`

The live context window as the status line reads it, and by category as /context breaks it down when the call asked (`{ breakdown }`). `tokens` and `percent` are absent until the first API response of a fresh or just-compacted session.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tokens` | <Documented /> | Input tokens that the last response was answered over: uncached, cache-written and cache-read together (the `total_input_tokens` of the status line). | Type: `number`. Optional. |
| `window` | <Documented /> | The context window of the model of the session, in tokens (the `context_window_size` of the status line). | Type: `number`. |
| `percent` | <Documented /> | `tokens` over `window` as a whole percentage, 0 to 100 (the `used_percentage` of the status line). | Type: `number`. Optional. |
| `breakdown` | <Documented /> | The window by category, as /context breaks it down: present only when the call passed `breakdown`, and only with a session bound. | Type: `SessionContextBreakdown`. Optional. It counts against the compaction window (`rawMaxTokens`), so its `totalTokens` may differ from `tokens`. |

### `SessionCost`

What the session has cost, as `/cost` and the status line total it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `usd` | <Documented /> | US dollars, summed over every priced API response this session. | Type: `number`. |

### `SessionCronSummary`

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | The ID of the scheduled task. | Type: `string`. |
| `schedule` | <Documented /> | Cron expression, e.g. "0 9 \* * 1-5". | Type: `string`. |
| `recurring` | <Documented /> | False for one-shot wakeups whose cron field encodes a single fire time, true for tasks that re-fire on every match. | Type: `boolean`. |
| `prompt` | <Documented /> | Prompt text submitted when the cron fires. Capped at 1000 chars. Clipped values append an in-string "... [+N chars]" marker. | Type: `string`. |

### `SessionDetachInput`

The input of `session.detach`: a client left the roster of the session. Every field is the engine's: a hook observes, and `next(e)` passes them on. Used by `session.detach`, `$.session.detach`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where the client drew. | Type: `RenderSurface`. |
| `clientId` | <Documented /> | The id that it attached under. | Type: `string`. |
| `reason` | <Documented /> | Why it left: it detached, or the session ended under it. | Type: `SessionDetachReason`. |

### `SessionDetachResult`

What a `session.detach` hook returns and what `next(e)` resolves to: `{ clientId }`, echoed by core. The own value of a hook changes nothing. Used by `session.detach`, `$.session.detach`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `clientId` | <Documented /> | The ID of the client that detached. | Type: `string`. |

### `SessionEndInput`

The input of `session.end`: the session is ending, why, and how to come back to it. Every field is the engine's: a hook observes, and `next(e)` passes it on. One short time bound (1.5 s by default) covers all hooks. `next.budget` reads it and `next.signal` aborts at it. Used by `session.end`, `$.session.end`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `reason` | <Documented /> | Why it ends (SessionEndReason), the word that the classic SessionEnd hook receives as its `reason`. | Type: `SessionEndReason`. `clear` is how a hook sees a `/clear`: the conversation ends, the process goes on under a new session id, and no `session.start` fires for it. |
| `sessionId` | <Documented /> | The id of the ending session (`$.session.id()` until now). After a `/clear` or a resume the process goes on under another. | Type: `string`. |
| `resume` | <Documented /> | What `claude --resume` takes to return to it. | Type: `SessionResume`. |

### `SessionEndResult`

What a `session.end` hook returns and what `next(e)` resolves to: `{ sessionId }`, echoed by core. The own value of a hook changes nothing. Used by `session.end`, `$.session.end`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sessionId` | <Documented /> | The ID of the session that ended. | Type: `string`. |

### `SessionIdentity`

What `$.session.identity()` answers: how the session is signed in and, under a managed pin of its organization, the account that the session holds. Only a mod that managed settings install gets an answer. Used by `$.session.identity`, `session.identity`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | How the session is authenticated: `claude.ai`, `console`, `api-key`, `oauth-token` (a token that its host handed it), `none`, or the name of a cloud provider (`bedrock`, `vertex`, ...). | Type: `string`. Builds add kinds: read an unknown one as a session with no identity. |
| `organizationId` | <Documented /> | The organization that the account belongs to, by its id, only where managed `forceLoginOrgUUID` lists that organization. | Type: `string`. Optional. Absent unless the organization is pinned, so a mod never learns of the account of another organization. |
| `organizationType` | <Documented /> | The plan of the organization as the server names it (`claude_team`, `claude_enterprise`, ...), when the login recorded one. | Type: `string`. Optional. Always read from the login record on disk, which the person can edit, whatever `isVerified` says. |
| `email` | <Documented /> | The email address of the account, where the session holds one. | Type: `string`. Optional. |
| `isVerified` | <Documented /> | Whether `organizationId` and `email` are the account that the server told this process its credential signed in as, not the login record on disk. | Type: `boolean`. The person can edit that record. It is false until the server has answered this process, as with nonessential traffic off, and with no account. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Why nothing is answered: the calling mod is not one that managed settings enable and load in place from a source they name. | Type: `string`. |
| `kind` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `organizationId` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `organizationType` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `email` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isVerified` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `SessionMeasureInput`

The input of `session.measure`: what `$.session.usage()` answers at this moment, and which of its units moved since the last measurement that a hook saw. The same figures as the op, without `context.breakdown`. A hook observes. Used by `session.measure`, `$.session.measure`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `context` | <Documented /> | The live context window (the `context` of `$.session.usage()`): the window, and its fill once a response of the live window reported one. | Type: `SessionContextUsage`. Never carries `breakdown` here. |
| `rateLimits` | <Documented /> | The rate-limit windows that the last response reported, each with its `percentUsed`. Empty off a subscription or before the first reading. | Type: `SessionRateLimit[]`. |
| `cost` | <Documented /> | What the session has cost so far. Absent where the host keeps no ledger. | Type: `SessionCost`. Optional. |
| `changed` | <Documented /> | Which units differ from the last measurement raised (UsageUnit). Never empty. The first measurement names every unit it has a figure for. | Type: `UsageUnit[]`. `context`: the fill moved. `rateLimits`: a window moved a whole point, appeared or left, or the limit status of the account changed. `cost`: the total grew. |

### `SessionMeasureResult`

What a `session.measure` hook returns and what `next(e)` resolves to: `{ changed }`, echoed by core. The own value of a hook changes nothing. Used by `session.measure`, `$.session.measure`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `changed` | <Documented /> | The usage units that changed. | Type: `UsageUnit[]`. |

### `SessionMessage`

One message of the transcript as `$.session.messages()` returns it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `role` | <Documented /> | Who wrote it. | Type: `'user' \| 'assistant'`. |
| `text` | <Documented /> | Its text blocks joined, '' when it has none. | Type: `string`. |
| `toolUses` | <Documented /> | The tool_use blocks of an assistant message, each with its outcome (`result`, `text`, `isError`) once the transcript holds it. | Type: `ToolUseSummary[]`. |
| `toolResults` | <Documented /> | The tool_result blocks of a user message: `{ tool_use_id, text, isError, result }`. | Type: `ToolResultSummary[]`. Optional. |
| `handle` | <Documented /> | An opaque token that the engine stamps on a message it hands a `session.compact` hook, so a list handed back maps to its own messages. | Type: `string`. Optional. Absent on `$.session.messages()` and on a message a hook built. |

### `SessionMessagesAgentArgs`

A `$.session.messages` call for the rows (SessionMessage) of the main conversation or of one agent: `agentId` alone, no `as`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `agentId` | <Documented /> | Whose conversation. If absent, the main one. | Type: `string`. Optional. |
| `as` | <Documented /> | Left out: the rows. | Type: `undefined`. Optional. |

### `SessionMessagesApiArgs`

A `$.session.messages` call for the Messages API form (ApiMessage) of the main conversation or, with `agentId`, of one agent of this session.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `as` | <Documented /> | `"api"`. | Type: `'api'`. |
| `agentId` | <Documented /> | Whose conversation. If absent, the main one. | Type: `string`. Optional. |

### `SessionMessagesArgs`

What `$.session.messages(args)` takes and a `session.messages` hook reads on `e`: whose conversation (`agentId`) and in which form (`as`). Used by `session.messages`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `agentId` | <Documented /> | Whose conversation to read: the id that `tool.call`, `turn.step` and `turn.complete` carry inside the loop of that agent. If absent, the main one. | Type: `string`. Optional. Names a subagent, fork, or teammate that runs in this process. `$.agent.list()` lists them. |
| `as` | <Documented /> | `"api"` for the Messages API form (ApiMessage: `{ role, content }` with the content blocks intact). If absent, the rows (SessionMessage). | Type: `'api'`. Optional. |

### `SessionMessagesDeny`

What `$.session.messages({ agentId })` resolves to when the id names no conversation that this session can read: why not, in `deny`. The agent is unknown, runs in another process, or has no saved transcript. It is never the main agent.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Why no conversation was read, naming the id. | Type: `string`. |

### `SessionMessagesMainApiArgs`

A `$.session.messages({ as: "api" })` call that names no agent: the main conversation, whose answer is always the messages (ApiMessage).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `as` | <Documented /> | `"api"`. | Type: `'api'`. |
| `agentId` | <Documented /> | Left out: the main conversation. | Type: `undefined`. Optional. |

## Related Pages

- [Session Types](index.md)
- [Mod API Types](../index.md)
