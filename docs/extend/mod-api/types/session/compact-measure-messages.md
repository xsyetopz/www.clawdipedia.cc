---
title: Session Compact, Detach, Measure, and Messages Types
description: "Types of compact, context usage, cost, detach, end, identity, measure, and the messages call."
sidebar_position: 2
---

These types describe compaction, context usage, cost, scheduled tasks, detach, end, identity, measure, and the messages call of `$.session`. A mod reads them from `$.session` and from the `session.*` hooks.

## Types with Fields

Each type below has its own table of fields.

### `SessionCompactArgs`

The input of `session.compact` as the `$.session.compact(args)` of a plugin takes it. The engine sets `trigger` (`plugin`), `messages` and `agentId`. Used by `$.session.compact`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `instructions` | <Documented /> | What the summary should keep or stress, as you type it after `/compact`. If you leave it out, the compaction prompt of the engine runs alone. | Type: `string`. Optional. |

### `SessionCompacted`

A compaction that stands. It has the conversation as it reads afterwards. When the engine did the compaction, it also has the counts and request usage that the engine recorded.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `messages` | <Documented /> | The conversation after the compaction, oldest first. From core, it is the summary and the messages that core kept. From a hook, it is whatever the hook hands up. | Type: `readonly SessionMessage[]`. What the transcript becomes after compaction. A message with a `handle` stays as it is. The engine builds others from `role`, `text`, and tool blocks. The transcript line that records the compaction is described in [Compaction Rows](../../../../reference/transcript-format.md#compaction-rows). |
| `tokensBefore` | <Documented /> | The size of the conversation before the compaction, in tokens. Absent when core did not record it. | Type: `number`. Optional. |
| `tokensAfter` | <Documented /> | The size of the conversation after the compaction, in tokens. Absent on `precompute` and when core did not record it. | Type: `number`. Optional. |
| `usage` | <Documented /> | What the model request of the compaction cost (`ModelUsage`), when core made one. These are the token counts of the summarizer, as the API reported them. | Type: `ModelUsage`. Optional. Absent when a hook answered, when a stored summary was reused, or when the response gave none. The cost ledger already holds it. |
| `skip` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

A hook that keeps messages changes what `--resume` loads. A kept message with a `handle` comes back as the engine's own row. A kept tool result row points to its assistant row through `sourceToolAssistantUUID`, and the loader follows that link. The loader also adds back the tool results that share one `message.id`. So a kept tool result with a `handle` can pull rows from before the boundary into the next session. The engine builds a message without a `handle` anew. A boundary row from a hook can carry `preservedMessages` (the kept `uuids`) and has no `preservedSegment`. See [Compaction Rows](../../../../reference/transcript-format.md#compaction-rows).[^resume-loader]

### `SessionCompactInput`

The input of `session.compact`: one compaction of the conversation, about to run. `messages` is the transcript that the compaction runs over. Used by `session.compact`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `trigger` | <Documented /> | What starts the compaction (`SessionCompactTrigger`). A matcher narrows on this key. Pinned: `next(e)` passes it on as received. | Type: `SessionCompactTrigger`. |
| `agentId` | <Documented /> | The id of the loop that compacts, for a subagent's own transcript or a fork. Absent for the main conversation (the `agentId` of `tool.call`). | Type: `string`. Optional. Pinned: a rewrite that changes it fails the hook. `e.messages` is the transcript of this loop. It is not the main transcript. |
| `instructions` | <Documented /> | What the summary should keep or stress. It is the text after `/compact`, the text of a plugin, or absent. | Type: `string`. Optional. `next({ ...e, instructions })` changes what the summarizer receives. |
| `messages` | <Documented /> | The transcript that the compaction runs over, in the shape of `$.session.messages()`. Each message carries the `handle` of the engine. A subagent has its own transcript under `agentId`. | Type: `readonly SessionMessage[]`. `next({ ...e, messages })` changes what the engine summarizes. A message that keeps its handle is the engine's own message, whole. The engine reads a message without a handle as you built it. |

### `SessionCompactSkipped`

A compaction that a hook vetoed. On `precompute`, the engine computes and keeps nothing. On any other trigger, the conversation stays as it is, and one line says why. Core also answers this way when a classic `PreCompact` hook blocks.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `skip` | <Documented /> | Why the compaction was skipped, as the notice reads. | Type: `string`. |
| `messages` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `SessionContextBreakdown`

The context window broken down as `/context` breaks it down. It has the rows, the grid, and the lists beneath it, in the shape of the `get_context_usage` of the SDK. Token counts are numbers. A `full` breakdown uses the token-count API where it can. A `summary` breakdown only estimates.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `categories` | <Documented /> | One row for each category. The free space and the compaction buffer are among them. `kind` says which row is which. | Type: `ContextCategory[]`. |
| `totalTokens` | <Documented /> | Tokens in use, unclamped: past `rawMaxTokens` when over the window. | Type: `number`. |
| `maxTokens` | <Documented /> | The window that the breakdown measures against. It is the same figure as `rawMaxTokens`. | Type: `number`. |
| `rawMaxTokens` | <Documented /> | The window that the breakdown measures against, in tokens. It is the limit of the model, or a smaller compaction window (`autocompactSource` says which). | Type: `number`. |
| `autocompactSource` | <Documented /> | How Claude Code chose that window (`ContextWindowSource`). The reply of the SDK carries it under this name too, outside its typed schema. | Type: `ContextWindowSource`. |
| `percentage` | <Documented /> | `totalTokens` over `rawMaxTokens` as a whole percentage, 0 to 100, and past it when over. | Type: `number`. |
| `gridRows` | <Documented /> | The grid, row by row. It is 10 by 10, or 20 by 10 for a window of a million tokens or more. It is 5 squares wide when the request asks for fewer than 80 `columns`. | Type: `ContextGridSquare[][]`. |
| `model` | <Documented /> | The model that the breakdown was computed for, as `/model` displays it. | Type: `string`. |
| `memoryFiles` | <Documented /> | Each memory file in the context, with its path and tokens. | Type: `ContextMemoryFile[]`. |
| `mcpTools` | <Documented /> | The schema of each MCP tool, with its server and tokens. | Type: `ContextMcpTool[]`. |
| `agents` | <Documented /> | The custom agents that the `Agent` tool describes, each with its tokens. | Type: `ContextAgent[]`. |
| `slashCommands` | <Documented /> | The count of the slash-command listing. Absent when the session lists none. | Type: `ContextSlashCommands`. Optional. |
| `skills` | <Documented /> | The count of the skill listing, with one entry for each skill. Absent when the session lists none. | Type: `ContextSkills`. Optional. |
| `autoCompactThreshold` | <Documented /> | The token count at which auto-compaction runs. Absent when it is off. | Type: `number`. Optional. |
| `isAutoCompactEnabled` | <Documented /> | Whether auto-compaction is on for the session. | Type: `boolean`. |
| `apiUsage` | <Documented /> | The token counts (`ModelUsage`) that the last API response of the live window reported, or null before a response came back. | Type: `ModelUsage \| null`. The breakdown reconciles its `Messages` row to it. |

### `SessionContextUsage`

The live context window as the status line reads it. When the call asks for it (`{ breakdown }`), the type also holds the window by category, as `/context` breaks it down. `tokens` and `percent` are absent until the first API response of a fresh or just-compacted session.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tokens` | <Documented /> | Input tokens that the last response was answered over: uncached, cache-written, and cache-read tokens together (the `total_input_tokens` of the status line). | Type: `number`. Optional. |
| `window` | <Documented /> | The context window of the model of the session, in tokens (the `context_window_size` of the status line). | Type: `number`. |
| `percent` | <Documented /> | `tokens` over `window` as a whole percentage, 0 to 100 (the `used_percentage` of the status line). | Type: `number`. Optional. |
| `breakdown` | <Documented /> | The window by category, as `/context` breaks it down. It is present only when the call passed `breakdown`, and only with a session bound. | Type: `SessionContextBreakdown`. Optional. It counts against the compaction window (`rawMaxTokens`), so its `totalTokens` may differ from `tokens`. |

### `SessionCost`

What the session has cost, as `/cost` and the status line add it up.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `usd` | <Documented /> | US dollars, summed over every priced API response in this session. | Type: `number`. |
| `hasUnknownPrice` | <Documented /> | Since `2.1.326`, present once `usd` includes a model with no known price, which goes at the rates of another model: the note that `/cost` prints. On an agent, only its own requests set it. | Type: `true`. Optional. |

### `SessionCronSummary`

One scheduled task, as the session lists it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | The ID of the scheduled task. | Type: `string`. |
| `schedule` | <Documented /> | A cron expression, for example `"0 9 * * 1-5"`. | Type: `string`. |
| `recurring` | <Documented /> | False for a one-shot wakeup whose cron field encodes a single fire time. True for a task that fires again on every match. | Type: `boolean`. |
| `prompt` | <Documented /> | The prompt text that the task submits when the cron fires. The text is capped at 1000 characters. A clipped value ends with the marker `... [+N chars]` inside the string. | Type: `string`. |

### `SessionDetachInput`

The input of `session.detach`. It fires when a client leaves the roster of the session. The engine sets every field. A hook can only observe, and `next(e)` passes the fields on. Used by `session.detach`, `$.session.detach`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `surface` | <Documented /> | Where the client drew. | Type: `RenderSurface`. |
| `clientId` | <Documented /> | The id that the client attached under. | Type: `string`. |
| `reason` | <Documented /> | Why the client left: it detached, or the session ended under it. | Type: `SessionDetachReason`. |

### `SessionDetachResult`

What a `session.detach` hook returns and what `next(e)` resolves to: `{ clientId }`, which core echoes back. A value that a hook returns changes nothing. Used by `session.detach`, `$.session.detach`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `clientId` | <Documented /> | The ID of the client that detached. | Type: `string`. |

### `SessionEndInput`

The input of `session.end`. It fires when the session is ending, and it says why and how to come back to the session. The engine sets every field. A hook can only observe, and `next(e)` passes the fields on. One short time limit (1.5 s by default) covers all hooks. `next.budget` reads the limit, and `next.signal` aborts at the limit. Used by `session.end`, `$.session.end`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `reason` | <Documented /> | Why the session ends (`SessionEndReason`). It is the word that the classic `SessionEnd` hook receives as its `reason`. | Type: `SessionEndReason`. `clear` is how a hook sees a `/clear`. The conversation ends, the process goes on under a new session id, and no `session.start` fires for it. |
| `sessionId` | <Documented /> | The id of the ending session (`$.session.id()` until now). After a `/clear` or a resume, the process goes on under another id. | Type: `string`. |
| `resume` | <Documented /> | What `claude --resume` takes to return to the session. | Type: `SessionResume`. |

### `SessionEndResult`

What a `session.end` hook returns and what `next(e)` resolves to: `{ sessionId }`, which core echoes back. A value that a hook returns changes nothing. Used by `session.end`, `$.session.end`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sessionId` | <Documented /> | The ID of the session that ended. | Type: `string`. |

### `SessionIdentity`

What `$.session.identity()` answers. It says how the session is signed in and, under a managed pin of its organization, which account the session holds. Only a mod that managed settings install gets an answer. Used by `$.session.identity`, `session.identity`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | How the session signs in: `claude.ai`, `console`, `api-key`, `oauth-token` (a token that its host handed it), `none`, or the name of a cloud provider (`bedrock`, `vertex`, ...). | Type: `string`. Each build can add kinds. Read an unknown kind as a session with no identity. |
| `organizationId` | <Documented /> | The id of the organization that the account belongs to. It is set only where managed `forceLoginOrgUUID` lists that organization. | Type: `string`. Optional. Absent unless the organization is pinned, so a mod never learns the account of another organization. |
| `organizationType` | <Documented /> | The plan of the organization as the server names it (`claude_team`, `claude_enterprise`, ...), when the login recorded one. | Type: `string`. Optional. Always read from the login record on disk, which the user can edit, whatever `isVerified` says. |
| `email` | <Documented /> | The email address of the account, when the session holds one. | Type: `string`. Optional. |
| `isVerified` | <Documented /> | Whether `organizationId` and `email` are the account that the server told this process its credential signed in as. The login record on disk does not set it. | Type: `boolean`. The user can edit that record. It is false until the server has answered this process. It is also false with nonessential traffic off, and with no account. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Why the call gets no answer: the calling mod is not one that managed settings enable and load in place from a source that they name. | Type: `string`. |
| `kind` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `organizationId` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `organizationType` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `email` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isVerified` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `SessionInfo`

What `$.session.info()` answers. Since `2.1.326`, it holds what a settings hook's input says of the session that no other read on `$.session` gives, and where the engine runs. Used by `$.session.info`, `session.info`.[^session-info]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `transcriptPath` | <Documented /> | The transcript file of the main conversation (`transcript_path`). | Type: `string`. It is empty in a session that keeps none on this machine. The transcript of a subagent lies in the `subagents/` folder under the folder of that name. |
| `scratchpadDir` | <Documented /> | The scratchpad directory of the session (`scratchpad_dir`). | Type: `string`. Optional. Absent where the session has none. |
| `promptId` | <Documented /> | The ID of the prompt that the session is on (`prompt_id`). | Type: `string`. Optional. Absent before the first prompt. |
| `agentType` | <Documented /> | The agent that the session itself runs as (`--agent`, `agent_type`). | Type: `string`. Optional. Absent when it runs as none. |
| `configRoot` | <Documented /> | The folder that the project settings are read from, when it is not where the session stands. A settings hook's command starts in it. | Type: `string`. Optional. Absent otherwise. |
| `platform` | <Documented /> | The operating system that the engine runs on. | Type: `'macos' \| 'windows' \| 'wsl' \| 'linux' \| 'unknown'`. Optional. `wsl` is Linux under Windows. The engine always gives it. A hook that answers whole may leave it out. |
| `isHosted` | <Documented /> | Whether the engine runs on the hosted server. That machine is not the session's own, so `platform` is the server's. | Type: `boolean`. Optional. False anywhere else, a cloud session with a machine of its own included. The engine always gives it. A hook that answers whole may leave it out. |

### `SessionMachine`

Since `2.1.328`, what `$.session.machine()` answers: the machine as `uname` names it, and the developer tools on its `PATH`. Used by `$.session.machine`.[^session-machine]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sysname` | <Documented /> | The system name as `uname -s` prints it. | Type: `string`. `Linux` or `Darwin`. `Windows_NT` on Windows. |
| `release` | <Documented /> | The kernel release as `uname -r` prints it. | Type: `string`. On Windows it is the NT version. |
| `machine` | <Documented /> | The hardware name in the words of `uname -m`. | Type: `string`. `x86_64`, and `arm64` or `aarch64` for 64-bit ARM. Either may stand for the other. |
| `packageManagers` | <Documented /> | Of `npm`, `yarn`, and `pnpm`, those found on the `PATH`, in that order. | Type: `string[]`. Empty on the server, where tools run in another container. |
| `runtimes` | <Documented /> | Of `bun`, `deno`, and `node`, those found on the `PATH`, in that order. | Type: `string[]`. Empty on the server, where tools run in another container. |

### `SessionMeasureInput`

The input of `session.measure`. It holds what `$.session.usage()` answers at this moment, and which of its units moved since the last measurement that a hook saw. The figures are the same as in the call, without `context.breakdown`. A hook can only observe. Used by `session.measure`, `$.session.measure`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `context` | <Documented /> | The live context window (the `context` of `$.session.usage()`). It has the window, and its fill once a response of the live window reported one. | Type: `SessionContextUsage`. Never carries `breakdown` here. |
| `rateLimits` | <Documented /> | The rate-limit windows that the last response reported, each with its `percentUsed`. Empty without a subscription or before the first reading. | Type: `SessionRateLimit[]`. |
| `cost` | <Documented /> | What the session has cost so far. Absent where the host keeps no ledger. | Type: `SessionCost`. Optional. |
| `changed` | <Documented /> | The units that differ from the last measurement that the engine raised (`UsageUnit`). It is never empty. The first measurement names every unit that has a figure. | Type: `UsageUnit[]`. `context`: the fill moved. `rateLimits`: a window moved a whole point, a window appeared or left, or the limit status of the account changed. `cost`: the total grew. |

### `SessionMeasureResult`

What a `session.measure` hook returns and what `next(e)` resolves to: `{ changed }`, which core echoes back. A value that a hook returns changes nothing. Used by `session.measure`, `$.session.measure`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `changed` | <Documented /> | The usage units that changed. | Type: `UsageUnit[]`. |

### `SessionMessage`

One message of the transcript as `$.session.messages()` returns it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `role` | <Documented /> | Who wrote the message. | Type: `'user' \| 'assistant'`. |
| `text` | <Documented /> | The text blocks of the message joined. It is `''` when the message has none. | Type: `string`. |
| `toolUses` | <Documented /> | The `tool_use` blocks of an assistant message. Each has its outcome (`result`, `text`, `isError`) once the transcript holds it. | Type: `ToolUseSummary[]`. |
| `toolResults` | <Documented /> | The `tool_result` blocks of a user message: `{ tool_use_id, text, isError, result }`. | Type: `ToolResultSummary[]`. Optional. |
| `handle` | <Documented /> | An opaque token that the engine stamps on each message that it hands to a `session.compact` hook. A list that the hook hands back then maps to the engine's own messages. | Type: `string`. Optional. Absent on `$.session.messages()` and on a message that a hook built. |

### `SessionMessagesAgentArgs`

A `$.session.messages` call for the rows (`SessionMessage`) of the main conversation or of one agent. It takes `agentId` alone, with no `as`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `agentId` | <Documented /> | Whose conversation to read. If you leave it out, the call reads the main conversation. | Type: `string`. Optional. |
| `as` | <Documented /> | Left out, so the call returns the rows. | Type: `undefined`. Optional. |

### `SessionMessagesApiArgs`

A `$.session.messages` call for the Messages API form (`ApiMessage`) of the main conversation. With `agentId`, it returns the form for one agent of this session.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `as` | <Documented /> | `"api"`. | Type: `'api'`. |
| `agentId` | <Documented /> | Whose conversation to read. If you leave it out, the call reads the main conversation. | Type: `string`. Optional. |

### `SessionMessagesArgs`

What `$.session.messages(args)` takes and a `session.messages` hook reads on `e`. It names whose conversation to read (`agentId`) and in which form (`as`). Used by `session.messages`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `agentId` | <Documented /> | Whose conversation to read. It is the id that `tool.call`, `turn.step`, and `turn.complete` carry inside the loop of that agent. If you leave it out, the call reads the main conversation. | Type: `string`. Optional. Names a subagent, fork, or teammate that runs in this process. `$.agent.list()` lists them. |
| `as` | <Documented /> | `"api"` returns the Messages API form (`ApiMessage`: `{ role, content }` with the content blocks intact). If you leave it out, the call returns the rows (`SessionMessage`). | Type: `'api'`. Optional. |

### `SessionMessagesDeny`

What `$.session.messages({ agentId })` resolves to when the id names no conversation that this session can read. `deny` says why not: the agent is unknown, runs in another process, or has no saved transcript. The agent is never the main agent.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Why the call read no conversation. The text names the id. | Type: `string`. |

### `SessionMessagesMainApiArgs`

A `$.session.messages({ as: "api" })` call that names no agent. It reads the main conversation, and the answer is always the messages (`ApiMessage`).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `as` | <Documented /> | `"api"`. | Type: `'api'`. |
| `agentId` | <Documented /> | Left out, so the call reads the main conversation. | Type: `undefined`. Optional. |

## Related Pages

- [Session Types](index.md)
- [Mod API Types](../index.md)

## Sources

[^resume-loader]: The program, `chunk-56bhcxay.js:554201`.
[^session-info]: `schemas/claude-code.d.ts`, `SessionInfo`. The program, `chunk-56bhcxay.js:4975754`.
[^session-machine]: `schemas/claude-code.d.ts`, `SessionMachine`. The program, `chunk-56bhcxay.js:1060862`.
