---
title: Session Types
description: "Types behind $.session and the session.* events: messages, context size, cost, and rate limits."
sidebar_position: 7
---

These are the types behind `$.session` and the `session.*` events. They describe the data a mod reads about a session: its messages, its context size, its cost, and its rate limits.

Use them to type the values that `$.session` calls return and that `session.*` hooks receive. Each type has a field table on one of the three pages below, or a row in the last table of this page.

## Pages

| Page | What is in it |
| --- | --- |
| [Session Context and Append Types](context-append.md) | `ContextAgent` to `SessionAuthorization`: the context breakdown types and the append and attach types. |
| [Session Compact, Detach, Measure, and Messages Types](compact-measure-messages.md) | `SessionCompactArgs` to `SessionMessagesMainApiArgs`: compact, context usage, cost, cron, detach, end, identity, measure, and messages types. |
| [Session Receive, Send, and Usage Types](receive-send-usage.md) | `SessionRateLimit` to `SessionVersion`: rate limit, receive, repo, resume, send, start, usage, and version types. |

## Example

The first call reads usage data. The second call sends text to another session. Its result tells you whether the text arrived.

```ts
const { startedAt, context, rateLimits, cost } = await $.session.usage();
const { isDelivered, reason } = await $.session.send({ to, text });
```

## Types without Fields

These types are aliases or unions, so they have no field tables. Each row gives the use of the type and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `ContextBreakdownDetail` | <Documented /> | How a context breakdown is counted. `full` counts each category with the token-count API. `summary` counts from the usage of the last response and from local estimates. | Alias of `'summary' \| 'full'`. The `get_context_usage` of the SDK takes the same two words as its `detail`. |
| `ContextCategoryKind` | <Documented /> | The kind of a breakdown row. Branch on this value, not on the `name` of the row. | Alias of `'used' \| 'free' \| 'buffer' \| 'deferred'`. `deferred` rows are tool schemas that load on demand and sit outside the window. |
| `ContextWindowSource` | <Documented /> | How Claude Code chose the window that the breakdown measures against. `/context` prints its `Auto-compact window` line from this value. | Alias of `'env' \| 'settings' \| 'clientdata' \| 'experiment' \| 'model-default' \| 'unknown-model' \| 'auto'`. Names what set the compaction window. `auto` is the own limit of the model. |
| `SessionAppendDoor` | <Documented /> | The door a row came in by. Claude Code decides it from the row alone. The set is closed, the event carries it, and a matcher narrows on it. | Alias of the twelve door names (`'prompt'`, `'command'`, `'response'`, `'note'`, `'queue'`, and more). `queue` is the text of a message queue record. It is not a row of the conversation. |
| `SessionCompactResult` | <Documented /> | What a `session.compact` hook returns and what `next(e)` resolves to. It is the compaction (`{ messages, tokensBefore?, tokensAfter?, usage? }`) or a skip. | Alias of `SessionCompacted \| SessionCompactSkipped`. The result has no summary string. The summary is a message. Used by `session.compact`, `$.session.compact`. |
| `SessionCompactTrigger` | <Documented /> | What starts the compaction: the `/compact` command of the user (`manual`), the engine at its threshold or on a prompt that is too long (`auto`), a plugin, or a `precompute`. | Alias of `'manual' \| 'auto' \| 'plugin' \| 'precompute'`. `precompute` installs nothing. Claude Code keeps its result for the next compaction. |
| `SessionDetachReason` | <Documented /> | Why a client left the roster. `detach` means the client asked to leave (`ui_detach`). `end` means the session ended while the client was still attached. | Alias of `'detach' \| 'end'`. |
| `SessionEndReason` | <Documented /> | Why the session ended. It is the `reason` of the classic `SessionEnd` hook, word for word. | Alias of `ClassicHookInputs['SessionEnd']['reason']`. Values include `prompt_input_exit`, `clear`, `resume`, `logout`, or `other`. |
| `SessionMessagesApiResult` | <Documented /> | What `$.session.messages({ as: "api", agentId })` resolves to. It is the conversation of the agent as `ApiMessage`, or `{ deny }` (`SessionMessagesDeny`). | Alias of `ApiMessage[] \| SessionMessagesDeny`. Use `Array.isArray` to tell the two apart. Without `agentId` the result is always the messages. |
| `SessionMessagesCall` | <Documented /> | The call signature of `$.session.messages`. With no argument it returns the rows of the main conversation. With `{ as: "api" }` it returns the Messages API form. With `agentId` it returns the rows of an agent, or a deny. | Alias of five call signatures. The shape of the answer depends on the arguments: none, `as: "api"`, `agentId`, or both. Used by `$.session.messages`. |
| `SessionMessagesResult` | <Documented /> | What `$.session.messages({ agentId })` resolves to. It is the messages (`SessionMessage`), or `{ deny }` (`SessionMessagesDeny`). | Alias of `SessionMessage[] \| SessionMessagesDeny`. Without `agentId` the result is always the messages. With an id that the session cannot read, the result is the deny. Use `Array.isArray` to tell the two apart. |
| `SessionMessagesValue` | <Documented /> | What the `{ value }` of a `session.messages` hook holds for any call: the rows (`SessionMessage`), the Messages API form (`ApiMessage`), or `{ deny }`. | Alias of `SessionMessagesResult \| SessionMessagesApiResult`. Used by `session.messages`. |

## Related Pages

- [Mod API Overview](../../index.md)
- [Session](../../calls/session.md)
- [Mod API Types](../index.md)
