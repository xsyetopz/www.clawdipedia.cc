---
title: Model, Audio, and MCP Types
description: "Types behind $.model, $.audio, and $.mcp."
sidebar_position: 6
---

These are the types behind `$.model`, `$.audio`, and `$.mcp`. They describe the request and the answer of a model call, the cache marks of a prompt, and the result of an MCP call.

Use them to type the values that these calls take and return. The first table covers aliases and unions. A section for each type with fields follows it.

## Example

This call asks a model for one answer. The types below describe the request and the result.

```ts
const r = await $.model.complete({ model: "haiku", prompt, effort: "low" });
```

## Types without Fields

These types are aliases or unions, so they have no field tables. Each row gives the use of the type and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `McpConnectRefusal` | <Documented /> | Why `$.mcp.connect` left a server unconnected, in one word. `unlisted` applies where the host of the session runs the servers of the plugin itself. | Alias of `'unlisted' \| 'unapproved' \| 'disabled' \| 'policy' \| 'auth' \| 'failed'`. Each name says why the connection was refused, such as `auth` for a missing sign-in. Since `2.1.323`, `unlisted` is a server that is in neither the manifest of the plugin nor `/mcp`. Since `2.1.323`, `failed` also covers a server of a provider other than the one whose hooks were shown. |
| `McpToolInputs` | <Documented /> | The inputs of the MCP tools that this project knows, keyed by full tool name, for declaration merging. It is empty by default, so every MCP tool has loose types. | Interface. A `.d.ts` file in the project of the mod author adds entries under `declare module "claude-code"`. Then `e.tool === <name>` narrows to them. |
| `McpToolName` | <Documented /> | The name of an MCP tool as the engine spells it: `mcp__<server>__<tool>`. | Alias of `` `mcp__${string}__${string}` ``. |
| `ModelApiError` | <Documented /> | The kind of API failure that ended a model call (a completion or a fork). Claude Code uses this word to classify every API error. It is the same word as in `StopFailure`. | Alias of the `error` field of the `StopFailure` input. `rate_limit`, `overloaded`, and `server_error` may clear on their own. The other values do not. |
| `ModelEffort` | <Documented /> | How hard a request asks the model to think. The levels are the ones that the engine and `turn.step` name: `low` to `max`, with `xhigh` between `high` and `max`. | Alias of `'low' \| 'medium' \| 'high' \| 'xhigh' \| 'max'`. The engine sends no effort setting to a model that takes none, even when the request asks for one. |

## Types with Fields

Each type below has its own table of fields.

### `ApiContentBlock`

One content block of an ApiMessage. `type` names its kind (`text`, `tool_use`, `tool_result`, `image`, `document`, `thinking`, ...). The other fields are the fields of that kind, as the Messages API defines them (see its reference). The engine hands over the block as it holds it. It renames and drops nothing.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The kind of the block. The rest of the block is the fields of that kind. | Type: `string`. |
| `[field: string]` | <Documented /> | Any other field of the block. Its kind (`type`) decides which fields it has, as the Messages API defines them. | Type: `unknown`. |

### `ApiMessage`

One message of the conversation in Messages API form, as `$.session.messages({ as: "api" })` returns it. These are the messages for the next request. There are at most 4096, and the first one is a user message.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `role` | <Documented /> | Who wrote the message. | Type: `'user' \| 'assistant'`. |
| `content` | <Documented /> | The blocks of the message in order. It is always an array. The blocks are `text`, `tool_use`, `tool_result` (paired across an assistant message and the next), `image`, and `document`. | Type: `ApiContentBlock[]`. Media blocks stay inline, and thinking blocks go back. The system prompt and the tool list are in no message. |

### `AudioClip`

What `$.audio.play` plays: a file of the plugin, a URL that the engine fetches, or the bytes. Each form below sets one of `asset`, `url`, or `base64` with `mime`. Used by `$.audio.play`, `audio.play`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `asset` | <Documented /> | A file of the calling plugin, relative to the directory of the plugin (`fx/open.wav`), with no `.` and no leading slash. | Type: `string`. The engine resolves it and loads the file from disk. |
| `url` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `base64` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `mime` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `url` | <Documented /> | The URL of the clip. The engine fetches it (never the plugin), or refuses it as `$.http.fetch` would refuse the same URL. | Type: `string`. |
| `asset` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `base64` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `mime` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `base64` | <Documented /> | The bytes of the clip, base64. | Type: `string`. |
| `mime` | <Documented /> | What the bytes are (`audio/mpeg`, `audio/wav`). | Type: `string`. |
| `asset` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `url` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `ClassifyOptions`

Options of `$.model.classify`. Used by `$.model.classify`, `model.classify`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `model` | <Documented /> | An alias (`haiku`) or a full model id. The default is the small fast model of the engine. | Type: `string`. Optional. |

### `McpConnectResult`

What `$.mcp.connect` resolves to and what the `{ value }` of an `mcp.connect` hook holds. It says that the server connected, or why it did not. Example: `const browser = await $.mcp.connect("browser")`. Used by `$.mcp.connect`, `mcp.connect`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isConnected` | <Documented /> | True: the server is connected, and its tools are tools of the session. | Type: `true`. |
| `server` | <Documented /> | The name that `/mcp` lists the server under and that `$.mcp.call` takes. It is usually `plugin:<plugin>:<server>`. | Type: `string`. It can also be the name that the session already uses to run the same server. |
| `isConnected` | <Documented /> | False: the server is not connected. | Type: `false`. |
| `reason` | <Documented /> | Why, in one word. | Type: `McpConnectRefusal`. |
| `message` | <Documented /> | The same reason as one plain sentence, for a log or a toast. | Type: `string`. |

### `McpContentBlock`

One block of an MCP result. It has `type` and the fields that this kind of block carries.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The kind of the block: `text`, `image`, `audio`, `resource`, `resource_link`. | Type: `string`. |
| `text` | <Documented /> | Set on a `text` block. | Type: `string`. Optional. |
| `uri` | <Documented /> | Set on a `resource_link` (or embedded `resource`) block. | Type: `string`. Optional. |
| `mimeType` | <Documented /> | The MIME type, which an image, audio, or resource block declares. | Type: `string`. Optional. |
| `[field: string]` | <Documented /> | Any other field of the block. Its `type` decides which fields it has. | Type: `unknown`. |

### `McpServerProvenance`

The MCP server that serves this tool. `name` is the config key of the server. `source` says where its definition came from. Base trust on `source`, because the name is only a config key.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The config key of the MCP server. | Type: `string`. |
| `source` | <Documented /> | One of `sdk`, `plugin`, `user`, `project`, `local`, `dynamic`, `managed`, `enterprise`, `claudeai`, or `agent`. The set is open. Treat an unknown value as an unrecognized configured source, never as `sdk`. | Type: `string`. |

### `McpToolCallInput`

The MCP branch of the `e` of a `tool.call` hook (and of the input of `$.tool.call`). It has one variant for each declared tool. Without a declared tool, it is the loose `McpToolCallInputFallback`. It is an alias of the input types of connected MCP tools. `$.mcp.call(server, tool, args)` does not use it, because its parameters are positional.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[N in keyof McpToolInputs & string]` | <Documented /> | One variant for each declared MCP tool: the input of the tool. | Type: `ToolInputOf<N, McpToolInputs[N] & Record<string, unknown>>`. |

### `McpToolCallInputFallback`

The `e` that a `tool.call` (or `classic.PreToolUse`) hook receives for an MCP tool while no MCP tool is declared. It covers every `mcp__*` name, with loose arguments. It is also the `input` of `$.tool.call({ tool: "mcp__<server>__<tool>" })` when no tool types are declared.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool being called (`mcp__<server>__<tool>`). A comparison with it narrows `e`. It is reserved: core ignores a rewrite of it. | Type: `McpToolName`. |
| `tool_use_id` | <Documented /> | The id of the `tool_use` block. It is the same at every event of the call and in `$.ui.notice`. It is reserved: core ignores a rewrite of it. | Type: `string`. |
| `[argument: string]` | <Documented /> | Any argument of the MCP tool, with no type. | Type: `unknown`. |

### `McpToolResult`

An MCP `tools/call` result as the SDK returns it, as plain data. Used by `$.mcp.call`, `mcp.call`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `content` | <Documented /> | The content blocks of the result, in order (`text`, `image`, `resource`, `resource_link`, ...). | Type: `McpContentBlock[]`. |
| `isError` | <Documented /> | True when the server reported the call as failed. The blocks then describe the error. | Type: `boolean`. |
| `structuredContent` | <Documented /> | The structured result of the server, when its tool declares an output schema. | Type: `unknown`. Optional. |

### `ModelCompleteInput`

What a hook on `model.complete` reads as `e`. It is the request with its text as strings, as it always was. The blocks of the caller come beside the strings. A list of blocks arrives joined in `prompt` and as given in `promptBlocks`. Used by `model.complete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `model` | <Documented /> | The model that answers, as the request named it (`ModelCompleteRequest`). | Type: `string`. |
| `prompt` | <Documented /> | The one user message, as text. It is the string that the caller gave, or the texts of its blocks joined in order with nothing between them. | Type: `string`. The engine sends it to the model. A hook that passes another string down has rewritten the prompt, whatever `promptBlocks` still says. |
| `system` | <Documented /> | The system prompt that precedes the completion, as text joined as `prompt` is. Absent when the caller gave none. | Type: `string`. Optional. Passing `null` or `false` down sends none. |
| `promptBlocks` | <Documented /> | The blocks of `prompt` from the caller, as given, when the caller gave a list. They show where the cache marks are. Absent for a string. | Type: `readonly ModelTextBlock[]`. Optional. They place cache marks and change no text. A rewritten opening keeps no cache mark. |
| `systemBlocks` | <Documented /> | The blocks of `system` from the caller. Read them against `system` exactly as `promptBlocks` is read against `prompt`. Absent for a string or none. | Type: `readonly ModelTextBlock[]`. Optional. |
| `maxTokens` | <Documented /> | The token cap of the reply, as the request gave it. | Type: `number`. Optional. |
| `effort` | <Documented /> | How hard the model thinks, as the request gave it. | Type: `ModelEffort`. Optional. |
| `timeoutMs` | <Documented /> | How long the whole call may take, in milliseconds, as the request gave it. | Type: `number`. Optional. |

### `ModelCompleteOptions`

Options of `$.model.complete`. They are not part of the request, so no hook on `model.complete` reads them on `e`. Used by `$.model.complete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `signal` | <Documented /> | Aborting the signal cuts the call while it runs. The call then resolves `aborted`, as when its dispatch aborts. If the signal is already aborted, no request is made. | Type: `AbortSignal`. Optional. It is the plugin's own signal. |

### `ModelCompleteRequest`

What `$.model.complete` takes. Used by `$.model.complete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `model` | <Documented /> | An alias (`haiku`) or a full model id. The engine resolves it and checks it against the allowlist like a `--model` value. | Type: `string`. |
| `prompt` | <Documented /> | The one user message: a string, or blocks of text sent in order (`ModelTextBlock`). You can mark any block for the prompt cache. | Type: `string \| readonly ModelTextBlock[]`. The result says what happened: text and usage, or a `reason`. Too many cache marks give an API error 400. |
| `system` | <Documented /> | The system prompt that precedes the completion, after the identity block of the CLI. It is a string, or blocks of text as `prompt` takes. The default is none. | Type: `string \| readonly ModelTextBlock[]`. Optional. On Bedrock, Vertex, Foundry, or behind a gateway, the cache finds text marked here again only while `prompt` opens the same. Mark the text in `prompt` there. |
| `maxTokens` | <Documented /> | The token cap of the reply: any positive integer up to what one reply can hold. That is the output limit of the model or 64000, whichever is lower. | Type: `number`. Optional. Default 1024. The reply comes back whole, not streamed. A provider ends such a request at ten minutes, hence the 64000. The engine refuses a value past the limit and names the limit. |
| `effort` | <Documented /> | How hard the model thinks (`ModelEffort`). Use `low` for a cheap label and `max` for a hard judgment. The default is the effort of the model. | Type: `ModelEffort`. Optional. The engine sends it where the model takes an effort and drops it where the model does not. It refuses a value outside the five levels. |
| `timeoutMs` | <Documented /> | How long the whole call may take, in milliseconds, before it resolves `aborted` and the engine abandons the request. The default is none. | Type: `number`. Optional. It bounds the completion itself. Use a positive whole number up to 2147483647. The engine refuses anything else. |

### `ModelCompleteResult`

What one model call resolves to. When the model answered, it holds the reply (`isAnswered`). Otherwise `reason` says which of three things left the call without text. A provider failure never rejects the call. Branch on `isAnswered` and `reason`. Used by `$.model.complete`, `model.complete`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isAnswered` | <Documented /> | True: the model answered, and `text` and `usage` are its reply. | Type: `true`. Example: `if (r.isAnswered) spent += r.usage.output_tokens`. |
| `text` | <Documented /> | The text of the reply. For a completion, it is the text blocks joined. On a fork, it is the text of the non-error replies joined by newlines. | Type: `string`. |
| `usage` | <Documented /> | What the call cost (`ModelUsage`). On a fork, it is the sum of its completions. | Type: `ModelUsage`. On a fork, `cache_read_input_tokens` near zero means the fork paid for the whole prefix. |
| `effort` | <Documented /> | On a fork, the effort that the last response was asked for. It is the `effort` of the request after the limits, or the level of the session when the request named none. | Type: `ModelEffort`. Optional. Not in `2.1.316`. Absent when the model takes no effort, when `CLAUDE_CODE_EFFORT_LEVEL` is `auto` or `unset` with no `maxEffortLevel` setting, or when the first request was the one refused (see the checks under `ModelForkRequest`). |
| `isAnswered` | <Documented /> | `false`: the model gave no text. | Type: `false`. |
| `reason` | <Documented /> | The API answered with an error, and no reply carried text. | Type: `'api-error'`. Example: `if (!r.isAnswered && r.reason === "api-error") retry(r.status)`. |
| `status` | <Documented /> | The HTTP status of the error reply (429, 500, 529, ...). It is null when no response arrived at all (a dropped connection, a provider timeout). | Type: `number \| null`. |
| `error` | <Documented /> | The kind of failure, as Claude Code classifies API errors. It is never the text or body of the error. | Type: `ModelApiError`. `rate_limit`, `overloaded`, `invalid_request`, `authentication_failed`, `server_error`, ..., `unknown` when the failure fits none of the named kinds. |
| `usage` | <Documented /> | What the call cost before it failed. For a completion, all values are zero (its one request was the one refused). On a fork, it covers the turns before the failure. | Type: `ModelUsage`. |
| `isAnswered` | <Documented /> | `false`: the model gave no text. | Type: `false`. |
| `reason` | <Documented /> | The model replied, and its reply carried no text. | Type: `'empty-reply'`. The reply held no text block, or a fork answered only with a denied tool attempt. |
| `usage` | <Documented /> | What the call cost. | Type: `ModelUsage`. |
| `isAnswered` | <Documented /> | `false`: the model gave no text. | Type: `false`. |
| `reason` | <Documented /> | The call was cut before a reply came. The engine discards whatever had come back. | Type: `'aborted'`. The dispatch aborted, the plugin unloaded, `options.signal` fired, or `timeoutMs` ended. |
| `usage` | <Documented /> | What the call cost before it was cut. For a completion, all values are zero (no response arrived). On a fork, it covers what came back before the abort. | Type: `ModelUsage`. |

### `ModelForkRequest`

What `$.model.fork` takes. Used by `$.model.fork`, `model.fork`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `prompt` | <Documented /> | The one user message. The engine appends it to the transcript of the session as the main thread last sent it. | Type: `string`. The result says what happened: text and usage, or a `reason` such as `nothing-to-fork`. |
| `effort` | <Documented /> | How hard the fork thinks (`ModelEffort`). Use `low` for a quick side job. The default is the level of the session. A fork may ask for more than the session runs at. | Type: `ModelEffort`. Optional. Not in `2.1.316`. A value outside `low`, `medium`, `high`, `xhigh`, `max` rejects the call. A missing `prompt` also rejects the call (see the checks below). The level stays within what the user and the organization allow (see the checks below). The main thread keeps its own level. |

These checks used a stub API and a mod whose `turn.complete` hook calls `$.model.fork` and logs the result.[^fork-cases] `top` below is `output_config.effort` of the request. `trailer` is the effort on a closing `system` message after the prompt. For the official page, see [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^fork-type]

- **Named level.** On Opus 5.5 at the default (`medium`), a named level reaches the request, and the `effort` of the result shows what the engine sent. `none` gave `effort: medium` with `top=medium trailer=none`. `low` gave `low` with `top=low trailer=low`. `medium` gave `medium` with no trailer. `max` gave `max` with `top=max trailer=max`.[^fork-per-message] The trailer is a message `{"role":"system","content":[],"output_config":{"effort":"low"}}` after the prompt message. A level equal to the session level sends no trailer. With `--effort max`, the default fork gave `max`, and `low` and `high` went out as named.
- **Bad request.** `extreme`, `5`, an empty string, and `LOW` each rejected the call with `takes an effort that is one of low, medium, high, xhigh, max (got <value>) (host check)`. A request without `prompt` rejected the call with `takes { prompt, effort? } (a non-empty prompt) (host check)`. The stub saw `0` fork requests.[^fork-bad]
- **Limits.** With `maxEffortLevel: "medium"` in the settings, and with `CLAUDE_CODE_EFFORT_LEVEL=medium`, `max` ran as `medium` with no trailer, and `low` ran as `low`.[^fork-ceiling] With `CLAUDE_CODE_EFFORT_LEVEL=auto` or `unset`, the main request and every fork carried no effort, the result had no `effort`, and `low` and `max` changed nothing.[^fork-auto] Claude Haiku 4.5 takes no effort: the requests carried none, and the result had no `effort`.[^fork-haiku]
- **Whole request.** On a model that does not take the effort per message, the level goes in the whole request. With Opus 4.8 at `high`, `low` went out as `top=low trailer=none`, and `max` as `top=max trailer=none`.[^fork-whole] With `CLAUDE_CODE_MODEL_CAPABILITIES=per_turn_effort` and a first-party base URL, `low` went out as `top=low trailer=low`.[^fork-capability] The stub reports no cache use, so these checks show what the request carried, not what it cost.

### `ModelForkResult`

What `$.model.fork` resolves to: the result of a completion (`ModelCompleteResult`), or a note that there was nothing to fork yet. It is a union with the fields `isAnswered` and `reason`. The arms of the completion are the reply when the fork answered, else `api-error`, `empty-reply`, or `aborted`. Each arm has `usage`. Once a response came back at a named level, it also has the `effort` that the fork ran at. Used by `$.model.fork`, `model.fork`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isAnswered` | <Documented /> | `false`: the fork gave no text. | Type: `false`. |
| `reason` | <Documented /> | Nothing to fork, so the engine made no request. The session holds no snapshot of the main thread of this conversation that a fork may share. | Type: `'nothing-to-fork'`. No turn has run yet, or the conversation started afresh after `/clear` or a resume. |

### `ModelTextBlock`

One block of text in the `prompt` or `system` of a `$.model.complete` request. The engine sends it as written, in the order given. You can mark it for the prompt cache. Put the text that every call repeats first, and mark its last block with `cache`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text of the block, sent as written. The API refuses an empty block as an `api-error` of status 400. | Type: `string`. |
| `cache` | <Documented /> | Keeps the request, up to and including this block, in the prompt cache. A call within five minutes that opens with the same text reads it there. | Type: `true`. Optional. The `usage` of the result shows `cache_creation_input_tokens` or `cache_read_input_tokens`. Both zero means nothing was cached. |

### `ModelUsage`

What one model call cost, as the API counted it. It has the four token counts, spelled as the API spells them. When the call made several requests, the counts are summed over the responses. Every place that reports the cost of a call uses this one shape. All four counts are always present. A missing count reads as zero.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `input_tokens` | <Documented /> | Uncached input tokens that the call was answered over. This is the part of the prompt that the call neither read from nor wrote to the prompt cache. | Type: `number`. |
| `output_tokens` | <Documented /> | Tokens the call generated. | Type: `number`. |
| `cache_read_input_tokens` | <Documented /> | Input tokens that the prompt cache served. | Type: `number`. On a fork, it shows how much of the transcript of the main thread the cache still held. Near zero means the fork paid for the whole prefix: the entry had lapsed, or the model changed after the entry was made. |
| `cache_creation_input_tokens` | <Documented /> | Input tokens that the call wrote to the prompt cache. | Type: `number`. |

### `PlayOptions`

How `$.audio.play` plays a clip: looped until `signal` aborts, or once. A loop needs the signal that ends it. A single play takes a signal as an option. Used by `$.audio.play`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `shouldLoop` | <Documented /> | Repeats the clip until `signal` aborts. The promise then resolves. | Type: `true`. |
| `gain` | <Documented /> | Linear gain, from 0 to 4, default 1. | Type: `number`. Optional. |
| `signal` | <Documented /> | Stops the clip. Playback ends at once, and the promise resolves. | Type: `AbortSignal`. |
| `shouldLoop` | <Documented /> | Plays the clip once. | Type: `false`. Optional. |
| `gain` | <Documented /> | Linear gain, from 0 to 4, default 1. | Type: `number`. Optional. |
| `signal` | <Documented /> | Stops the clip early, as in the looped form. | Type: `AbortSignal`. Optional. |

### `SpeakOptions`

Options of `$.audio.speak`. Used by `$.audio.speak`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `voice` | <Documented /> | The exact name of the system voice, as the platform lists it (`Samantha`, or the name of a voice that you installed). If you leave it out, the synthesizer uses its default voice. | Type: `string`. Optional. |

### `SpeakRequest`

The argument of `$.audio.speak(text, options)` as the event carries it. The signal does not cross. Before `2.1.326`, it combined `SpeakRequest` and `SpeakOptions`. Used by `audio.speak`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | What to say, as plain text. The system speaks the first 4096 characters. | Type: `string`. |
| `voice` | <Documented /> | The exact name of the system voice (`SpeakOptions`). If you leave it out, the synthesizer uses its default voice. | Type: `string`. Optional. |

### `SpeakResult`

What `$.audio.speak` resolves with after the utterance ends. Used by `$.audio.speak`, `audio.speak`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `via` | <Documented /> | The synthesizer that spoke. `system` is the synthesizer of the platform (`say` on macOS). | Type: `'system'`. |

## Related Pages

- [Mod API Overview](../index.md)
- [Model, Audio, and MCP](../calls/model-audio-mcp.md)
- [Mod API Types](index.md)

## Sources

[^fork-type]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`. Its `ModelForkRequest` and `ModelForkResult`, which `2.1.316` lacks.
[^fork-cases]: Probe cases `print.fork319.model-fork.*`.
[^fork-per-message]: Probe cases `print.fork319.model-fork.per-message` and `print.fork319.model-fork.session-max`.
[^fork-bad]: Probe case `print.fork319.model-fork.bad-value`.
[^fork-ceiling]: Probe cases `print.fork319.model-fork.max-effort-setting` and `print.fork319.model-fork.env-ceiling`.
[^fork-auto]: Probe cases `print.fork319.model-fork.env-auto` and `print.fork319.model-fork.env-unset`.
[^fork-haiku]: Probe case `print.fork319.model-fork.no-effort-model`.
[^fork-whole]: Probe case `print.fork319.model-fork.whole-request`.
[^fork-capability]: Probe case `print.fork319.model-fork.whole-request-capability`.
