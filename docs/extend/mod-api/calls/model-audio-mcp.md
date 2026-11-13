---
title: Model, Audio, and MCP
description: The $.model, $.audio, and $.mcp nouns - ask a model, play or speak sound, and call a tool of a connected MCP server.
sidebar_position: 8
---

`$.model` asks a model with the credentials of the session.
`$.audio` plays a sound or speaks text.
`$.mcp` calls a tool of a connected MCP server.
A model call bills to the plan or key of the person, so keep requests small.

A `deny` from a hook refuses a call. `maxTokens` is 1024 by default and goes up to 64000 or the output limit of the model.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.323 program (`schemas/claude-code.d.ts`).
"Run time" appears in a "Where it can be used" cell. It means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

This hook answers `/triage` by asking a small model for a label.

```javascript
on("command.run", { command: "triage" }, async ($, e) => {
  const r = await $.model.complete({
    model: "haiku",
    system: "Reply with one word: bug, feature, or question.",
    prompt: e.args,
    maxTokens: 20,
  });
  return { text: `Label: ${r.isAnswered ? r.text.trim() : "unknown"}` };
});
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.model.complete` | <Documented /> | Runs one text completion through the session's own API client. Resolves the reply's text and cost, or why there is no text. | `(request, options?) => Promise<ModelCompleteResult>`. Asks the model once, with no tools and no history. Only a request that the engine refuses to send rejects. | Run time. |
| `$.model.fork` | <Documented /> | Runs one tool-less completion over the session's own transcript as the main thread last sent it. The API then serves that prefix from its cache. | `(request: ModelForkRequest) => Promise<ModelForkResult>`. Repeats the main thread's last request with your `prompt` added. The call denies every tool. Its own tail is never cached. Since `2.1.321`, the type file adds that the API bills the prefix afresh in a cloud session that continues a chat, besides after the entry lapsed or after `/model` (`captures/2.1.321/types.diff`). Resolves a result. Not in `2.1.316`: `request.effort` sets how hard the fork thinks, and a request of the wrong shape (no `prompt`, an `effort` that is no level) rejects (see [Model, Audio, and MCP Types](../types/model.md#modelforkrequest)). | Run time. |
| `$.model.classify` | <Documented /> | Picks one of `labels` for `text` with one completion and a fixed classifier prompt. | `(text, labels, options?) => Promise<string \| undefined>`. Needs 2 or more labels. Resolves `undefined` if the model names none. | Run time. |
| `$.audio.play` | <Documented /> | Plays one audio clip, starting now. Clips do not queue, so two calls play together (a bed under speech). | `(clip, options?) => Promise<void>`. `afplay` plays it on macOS. Linux and Windows terminals play nothing. | Run time. |
| `$.audio.speak` | <Documented /> | Speaks `text` with the platform's own synthesizer (`say` on macOS). Plain text. | `(text, options?) => Promise<SpeakResult>`. Utterances queue. Rejects if there is no synthesizer. | Run time. |
| `$.mcp.call` | <Documented /> | Calls `tool` on one of the engine's connected MCP servers, with the engine's own connection. | `(server, tool, args?) => Promise<McpToolResult>`. No permission prompt appears, because the plugin's call is the grant. | Run time. |
| `$.mcp.connect` | <Documented /> | Connects an MCP server if the session has not already: one that this plugin's own manifest lists, by its key, or, since `2.1.323`, any server that `/mcp` lists. Connected means its tools ride the next request of the turn. | `(server) => Promise<McpConnectResult>`. A server joins the session at its start unless a hook on `mcp.connect` holds it back. Since `2.1.323`, this call brings a held one in (the hooks are asked with this plugin as `next.origin`), by the enable of the session under its policy. A key of the own manifest is read first. The same server run under another name answers with that name, and is only read. A listed server that is off, waits on sign-in, or failed answers as it stands: the call never dials, switches, or drops one that no hook holds. A key not yet in the session, when another server is listed under that name, answers `failed`. Before `2.1.323`, listing a server deferred nothing, so refuse its calls at `tool.check` to hold them back. | The server is a key of this plugin's manifest or, since `2.1.323`, its name as `/mcp` lists it (`schemas/claude-code.d.ts`). |

## Events Raised by These Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `model.complete` | <Documented /> | `$.model.complete(request, { signal })`. The signal does not cross. It aborts the call. | Input `ModelCompleteInput`. Value `ModelCompleteResult`. |
| `model.classify` | <Documented /> | `$.model.classify(text, labels, options)` | Input `{ text: string, labels: readonly string[], options?: ClassifyOptions }`. Value `string \| undefined`. |
| `model.fork` | <Documented /> | `$.model.fork(request)` | Input `ModelForkRequest`. Value `ModelForkResult`. |
| `audio.play` | <Documented /> | The clip and how to play it (`shouldLoop`, `gain`). | Input `{ clip: AudioClip, shouldLoop: boolean, gain?: number }`. Value `void`. |
| `audio.speak` | <Documented /> | `$.audio.speak(text, { voice })` | Input `SpeakRequest`. Value `SpeakResult`. |
| `mcp.call` | <Documented /> | `$.mcp.call(server, tool, args)` | Input `{ server: string, tool: string, args: Record<string, unknown> }`. Value `McpToolResult`. |
| `mcp.connect` | <Documented /> | `$.mcp.connect(server)` | Input `{ server: string }`. Value `McpConnectResult`. Since `2.1.323`, the input is `{ server: string, provider: Origin }` and the engine raises the event too, for each server it is about to join by itself (`next.origin` is the engine's). `server` is the key as `$.mcp.connect(server)` spelled it, or on the engine's raise the name `/mcp` lists, usually `plugin:<plugin>:<server>`. `provider` is who provides the server: the plugin and its tier, or `mcp:<server>` for a server that settings configure. Both are pinned: a rewrite is refused, and a `$.mcp.connect` that then resolves to the server of another provider answers `failed`. A hook on the engine's raise that answers without calling `next` holds the server back: nothing is dialed, and `/mcp` lists it as held by the plugin of that hook until `$.mcp.connect` or a later raise lets it through. Headless plugin install, sync, and reload raise nothing: a server they bring in first dials with no hook asked, and one held before stays held. The event is not raised for the dial that `$.mcp.connect` itself starts (`schemas/claude-code.d.ts`; the program, `chunk-2x9ma4k7.js:4508402`, `chunk-s82q53mp.js:104498`). |

## Related Pages

- [Mod API Overview](../index.md)
- [Tool, Command, and Config](tool-command-config.md)
- [Model, Audio, and MCP Types](../types/model.md) (requests, answers, and MCP types)
