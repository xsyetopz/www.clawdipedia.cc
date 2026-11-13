---
title: Tool Call, Check, and Describe Types
description: "Types of tool call results, permission checks, tool descriptions, envelopes, and summaries."
sidebar_position: 2
---

## Types with Fields

Each type below has its own table of fields.

### `ToolCallReserved`

The keys that the input of `tool.call` carries beside the own arguments of the tool. The tool sees none of them (the engine strips them before the tool runs). `consent` is the own words of the person for the press that raised the call. The permission path reads it as the request of the user.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool. | Type: `T`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. Optional. |
| `consent` | <Documented /> | The own words of the person for the press that raised the call. The tool never sees it. | Type: `string`. Optional. |

### `ToolCallResult`

What a `tool.call` hook returns and what `next(e)` and `$.tool.call(input)` resolve to: the result of the tool (`{ result, context? }`) or `{ deny }`. Union. Fields: `context`, `deny`, `isError`, `isReadOnly`, `ref`, `result`, `text`. From core the result is `{ ref, result, text }`, plus `isError` on a tool error. Used by `tool.call`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Refuses the call: the model receives the text as an error result. Absent when the call was answered. | Type: `string`. A deny that a hook returns after the tool answered without error withholds that result and undoes nothing. In its place the model reads `<tool> ran, and a plugin withheld its result: <text>`. |
| `result` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `context` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `ref` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `text` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isError` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isReadOnly` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `result` | <Documented /> | The output of the tool: from core the record of the tool, typed for each built-in tool once `e.tool` and `isError` are narrowed. From a hook, its own. | Type: `ToolResultOf<Name>`. Core checks the answer of a hook against the output schema of the tool when it has one. Absent on a deny. |
| `context` | <Documented /> | What the model reads after the result of the tool, and the user never sees. From core, none. | Type: `readonly string[]`. Optional. One reminder, as that of a `PostToolUse` hook. Past 100,000 characters (200,000 together) the model reads a head and a path. |
| `ref` | <Documented /> | Core sets it on what `next(e)` resolves to. It names the messages that core produced for the call (they stay on the host side). | Type: `number`. Optional. A hook that returns the object it got makes core use them verbatim. Absent on the own `{ result }` of a hook and on a deny. |
| `text` | <Documented /> | Core sets it: the result as the model reads it (text blocks joined). It is present whatever the tool, where the shape of `result` varies for each tool. | Type: `string`. Optional. Absent on the own `{ result }` of a hook. |
| `isReadOnly` | <Documented /> | Core sets it. It is present only when the tool held the input it executed read-only by its own check (the check that its permissions use). | Type: `true`. Optional. Says the call ran read-only, rewrites included. It does not cover calls that this call causes. |
| `isError` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isError` | <Documented /> | Core sets it. It is present only when the tool reported an error (it threw, was interrupted, or answered an error). `text` is what the model read. | Type: `true`. |
| `result` | <Documented /> | What the transcript stored for the errored call: the error text, or undefined when nothing was stored. It is never the typed record of the tool. | Type: `unknown`. |
| `text` | <Documented /> | The error as the model reads it. | Type: `string`. Optional. |
| `ref` | <Documented /> | As on an answered result: names the messages that core produced. | Type: `number`. Optional. |
| `context` | <Documented /> | As on an answered result. | Type: `readonly string[]`. Optional. |
| `isReadOnly` | <Documented /> | As on an answered result: the tool held the input it ran read-only. | Type: `true`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `ToolCheckInput`

The input of `tool.check`. It has the tool and its arguments. It also has the ceiling of the organization if it set one, whether the call is read-only, and who can answer an ask. On a real call it also has the id of the call and the `agentId` of the loop. All fields are pinned. A hook decides about the call and does not change it. Used by `tool.check`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | As the model names it (`Bash`, `mcp__server__tool`), the key that a matcher narrows on. | Type: `string`. A matcher on any name that the host declares for the tool admits it. |
| `input` | <Documented /> | The arguments of the tool as the permission decision reads them (`{ command }` for Bash, `{ file_path, ... }` for the file tools). | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The call being decided, on a real call only. Absent on a query. | Type: `string`. Optional. `next.origin` names who raised it: `{ plugin: 'engine', tier: 'core' }` for the own call of the model, the plugin for its `$.tool.call` or its query. |
| `agentId` | <Documented /> | The id of the loop that decides the call. It is on a real call inside the loop of a subagent or a teammate: the one that its `tool.call` carried. | Type: `string`. Optional. Absent on the main loop and on a query. It says which loop, not which plugin caused the call (`next.origin` says that). |
| `isReadOnly` | <Documented /> | Set when the tool call is read-only (new in 2.1.304). | Type: `true`. Optional. The program passes it on as the read-only flag of the permission decision. |
| `approver` | <Documented /> | Who answers this evaluation's asks, known before any hook runs (new in 2.1.307). | Type: `ToolCheckApprover`. Optional. Set by the engine and pinned. `host` when a hosted session's permission callback or prompt tool, or the cloud session a served call is for, answers. `person` when a person can be asked, a pane's card included. Absent when nobody can be asked (`dontAsk` mode, avoid-prompts, headless). |
| `ceiling` | <Documented /> | The most permissive verdict that the organization lets a call of the tool reach (`ask`), as its administrators set it on the tool of a connector. | Type: `ToolCheckDecision`. Optional. Set by the engine, from the tool, never by a query, and pinned. The own `ceiling` of a hook, on its answer, is dropped. Since `2.1.323`, where the question has none, it is the ceiling that the check of core found for this call, on the verdict of core and on each hook's that asked beneath. Absent where none is set (`schemas/claude-code.d.ts`, `ToolCheckInput`). |

### `ToolCheckResult`

What a `tool.check` hook returns and what `next(e)` resolves to: the verdict, why, and what stands behind it. It is never who answers it. From core, it is the decision of the engine for the mode and rules. A hook may answer any verdict. The last word up the chain decides. Used by `tool.check`, `$.tool.check`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `decision` | <Documented /> | `allow` runs the tool. `ask` puts it to the decider of the mode, or to a person when a hook made it (`plugin`). `deny` refuses it, with the reason as the error of the model. | Type: `ToolCheckDecision`. For a tool that needs the person, a hook can only tighten the verdict. Its `allow` does not dismiss the dialog. |
| `reason` | <Documented /> | Why, in a sentence. From core, it is the rule or check that decided. From a hook, it is what the model reads on a deny and the dialog shows on an ask. | Type: `string`. Optional. |
| `rule` | <Documented /> | The settings rule that decided, as written (`Bash(git push:*)`). | Type: `string`. Optional. Absent for a mode or the own check of a tool. |
| `hook` | <Documented /> | The classic hook event that decided, or whose ask the verdict was reached under (`PreToolUse`), whoever configured the hook. | Type: `string`. Optional. Absent on a `$.tool.check` query, which runs no classic hook. |
| `setting` | <Documented /> | The key of the option whose own check asked, whoever configured it (`permissions.blockReadsOutsideWorkingDirectories`). | Type: `string`. Optional. From core, for the read block: its ask on a shell command that reads outside the working directories or, the block on, leaves the sandbox. |
| `plugin` | <Documented /> | The plugin whose hook made this ask (new in 2.1.307). | Type: `string`. Optional. Set by the engine and pinned. What a hook writes here is dropped. Set on an `ask` that a hook answered, a reworded ask included. An ask a hook passes up unchanged keeps what it carried, so core's own ask names none. Such an ask is a person's: the dialog, the host's callback, or a `PermissionRequest` hook answers it. No classifier's allow settles it, its block still refuses, and a rule for the whole tool is not kept. A narrower rule the person saves settles nothing while the hook asks. Where nobody can be asked (`approver` absent), the program turns the ask into a deny, and its reason is the model's error. A tool that raises no prompt keeps its own rule. |
| `decider` | <Undocumented /> <Deprecated note="Removed from the type file in 2.1.307." /> | The 2.1.304 to 2.1.306 way for a hook to put its ask to a person. | Type: `'host' \| 'person'`. Optional. The 2.1.309 program still reads `decider: "person"` on a hook's answer and marks the answer with `plugin`. It ignores any other value, and no result carries `decider` (the program). Use `ask` alone since 2.1.307: every ask a hook makes goes to a person. |
| `ceiling` | <Documented /> | The most permissive verdict that the organization lets a call of the tool reach (`ask`), as its administrators set it on the tool of a connector. | Type: `ToolCheckDecision`. Optional. Set by the engine from the tool. The own `ceiling` of a hook is dropped. Since `2.1.323`, where the question has none, it is the ceiling that the check of core found for this call (`schemas/claude-code.d.ts`, `ToolCheckInput`). |

### `ToolDescribeInput`

The input of `tool.describe`: the description of one tool, at the moment the engine first renders the schema of the tool for the model. Used by `tool.describe`, `$.tool.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | As the model sees the name (`Bash`, `mcp__server__tool`), the key that a matcher narrows on. | Type: `string`. |
| `description` | <Documented /> | The description of the tool as the tool computed it. | Type: `string`. |
| `isDeferred` | <Documented /> | Present, and true, when the engine lists the tool behind ToolSearch (its schema loads when the model asks for it by name). Absent for a tool that the engine lists in front. | Type: `true`. Optional. The tool of an MCP server loads on demand, and so does a tool that asks to. A plugin tool with `isDeferred: false` stays in front. |
| `provider` | <Documented /> | Who provides this tool: the plugin and its tier, `{ plugin: "engine", tier: "core" }` for a built-in. Pinned: a rewrite is refused. | Type: `Origin`. The tool of a configured MCP server is `mcp:<server>`. It is in `prepend` when the policy settings source configures the server, else in `user`. |

### `ToolDescribeResult`

What a `tool.describe` hook returns: the description that the model sees for that tool and, when the hook moves it, where the tool waits (ToolDeferral). `{ description }` alone changes the text and keeps the placement. `isDeferred: true` puts the tool behind ToolSearch. Used by `tool.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `description` | <Documented /> | The description the model sees for the tool. | Type: `string`. |
| `isDeferred` | <Documented /> | Where the tool waits. `true` puts it behind ToolSearch. | Type: `ToolDeferral`. Optional. |
| `breakPromptCache` | <Documented /> | Sends a changed description or placement at the next turn. It rewrites the whole prompt cache and drops the earlier thinking of the model. | Type: `boolean`. Optional. Since `2.1.321`. Left out, a changed description waits for a new thread or a compaction, and a changed placement for a new thread or `/clear`, as a compaction keeps the tool block. Before `2.1.321`, a changed answer for a tool that a thread had sent went out at the next turn (`captures/2.1.321/types.diff`). |

### `ToolEnvelope`

`{ tool, tool_use_id, ...args }` as one flat object type, generic over the tool name and its parsed arguments.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool being called (`Bash`, `mcp__<server>__<tool>`). A comparison with it narrows `e`. Reserved: core ignores a rewrite of it. | Type: `Name`. |
| `tool_use_id` | <Documented /> | The id of the tool_use block. It is the same at every event of the call and in `$.ui.notice`. Reserved: core ignores a rewrite of it. | Type: `string`. |

### `ToolInfo`

One tool as `$.tool.list()` returns it and a `tool.list` hook answers it (since `2.1.323`). Used by `$.tool.list`, `tool.list`.

Since `2.1.323` (`schemas/claude-code.d.ts`, `ToolInfo`; the program, `chunk-620k1a78.js:105325`, `chunk-2x9ma4k7.js:4502683`):

- **What the hooks answer.** For the raise of the engine, the answer is the tool pool of the session: for the model, every agent (foreground or background), ToolSearch, and `$.tool.call`. The tools of an MCP server that joins later are asked about before a request carries them. For the `$.tool.list()` of a mod, the answer is only what that call reads.
- **What `next(e)` holds.** The tools as the engine built them, with what an earlier answer removed and without what it added. Answer the whole list each time. The order of the list is ignored, so that the prompt cache holds.
- **When the engine raises it.** Before the first request of a thread, once a load of hooks modules is over or 10 seconds have passed. It raises it again when the loaded plugins, the names of the tools, or a setting change, and at the turn after `$.ui.invalidate('tool.list')`. It never raises it per turn, because a pool that moves breaks the prompt cache.
- **Remove a tool.** Leave an entry out and the tool goes, with what a deny rule on it takes out. What such a rule brings back, such as Glob and Grep without Bash, is asked about too. A tool that no deny rule can leave out stays while any other does. A call of a removed tool is refused, by a script, an agent, the host's `mcp_call`, an `mcp_tool` settings hook, or a Monitor poll, and a running watch of it ends. The last three do not wait for a hooks load, so one made before a module has loaded is not refused by what that module removes. A tool that a thread already declared stays declared until a compaction, and a call of it is refused saying why. `$.ui.ask` and `$.agent.spawn` are the host's: removing their tools does not reach them.
- **Add a tool.** Add `{ name, description, mcp: false, inputSchema? }` under a new name and the tool joins. It is checked as `$.tool.register` checks a spec, and an entry that fails is left out. A `tool.call` hook on its name answers its calls, with no permission prompt. A call that no hook answers is a tool error that names it. A schema that the API refuses is declared with no parameters. New words reach a thread at its next compaction. These cannot be added: an `mcp__` name, a name that a request declares itself (`advisor`, `DeferredToolPlaceholder`), and the name of a tool or built-in in any case or with its words apart, on or off. An entry with the name or alias of a tool that exists leaves that tool as it is: `tool.describe` changes a description. A deny rule, a `--tools` list, and the `tools:` of an agent hold over an added tool as over any other. A real tool takes its name when it joins.
- **Failure.** A hook that throws, crashes, or runs past its 10-second budget is skipped, unless its `.catch` answers. The answer is then what the others said, without what the hook removed or added on any run, and the event is raised again at the next turn. A hook whose `$` ops hold it past 30 seconds in all is aborted the same way (`opHoldMs: 30000`, `chunk-s82q53mp.js:201764`). A crash traced to a mod can unload it, and the removals of a mod lapse when it is unloaded. A `{ deny }`, or a list with nothing in it to read, leaves the last answer standing, and the event is raised again at the next turn. A turn waits at most 10 seconds for a raise, then goes on with the answer that stood, or the tools as built before the first. A `$.tool.call` of a `tool.list` hook, or an agent it spawns, reads the answer that stood, or the tools as built on the first raise. `$.prompt.submit` and `$.command.run` are refused there.
- **Managed policy.** Where sec-default is seated, the hook of a person cannot remove a tool of the managed MCP servers or seated plugins of the organization, or bring back a tool that a hook of the organization removed. Its addition is dropped while managed `allowedMcpServers` is set, or where the name reads as a tool that the organization delivers. A hook of a person that overruns or crashes is skipped and sec-default still answers, though that hook can delay the answer. The engine puts no other limit on the answer.

```javascript
on("tool.list", async ($, e, next) => {
  const listed = await next(e);
  return listed.value === undefined
    ? listed
    : { value: listed.value.filter((t) => t.name !== "AskUserQuestion") };
});
```

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | What the model calls it by. | Type: `string`. |
| `description` | <Documented /> | What it does, in the own words of the tool (its description, at most a first sentence for MCP tools without one). | Type: `string`. |
| `mcp` | <Documented /> | True for the tool of an MCP server. | Type: `boolean`. |
| `inputSchema` | <Documented /> | On an entry that a `tool.list` hook adds: a JSON schema object for the input (`{ type: "object", properties, required }`). Default `{ type: "object" }`, as on `$.tool.register`. | Type: `Record<string, unknown>`. Optional. New in `2.1.323`. Never on a tool that the session lists. |

### `ToolInputOf`

`{ tool, tool_use_id, ...args }` as one flat object type. The docs of `tool` and `tool_use_id` live on the `keyof` operand: a mapped type takes the docs of its properties from there.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in keyof ToolEnvelope<Name, Arguments>]` | <Documented /> | Each key of the tool envelope, with its type unchanged. | Type: `ToolEnvelope<Name, Arguments>[K]`. |

### `ToolNamed`

An input that names its tool as the literal `T`: what `next` and `$.tool.call` read to type the result of the call for each tool (NextResultFor).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool being called (`Bash`). | Type: `T`. Read-only. |

### `ToolRequestMeta`

What a `tool.call` hook sets for the request of the tool of an MCP server.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `requestMeta` | <Documented /> | Entries for the `_meta` of the request that this call sends to its MCP server. Set them with `next({ ...e, requestMeta })`. They are never an argument of the tool. | Type: `Record<string, string>`. Optional. A hook may set only `anthropic/sources`, a string of at most 256 KiB. It goes only to a connector relay. `{}` clears it. |

### `ToolResultSummary`

One tool_result block of a user message.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The id of the call that this result answers (`e.tool_use_id` of `tool.call`). | Type: `string`. |
| `text` | <Documented /> | The result as the model read it (text blocks joined). | Type: `string`. |
| `isError` | <Documented /> | True when the tool reported an error. | Type: `boolean`. |
| `result` | <Documented /> | What the transcript stored for the call: the record of the tool on an answered call (`result` of `tool.call`), the error text when `isError`. | Type: `unknown`. Optional. Absent when nothing was stored. In `-p` a tool may store the record without its bulk. `text` is what the model read. |
| `meta` | <Documented /> | What the MCP server of the tool addressed to plugins in `_meta`: entries under `"claude/plugins"` and `"anthropic/sources"`. The model never reads it. The engine leaves out a key over 256 KiB. | Type: `Record<string, unknown>`. Optional. Off by default. Absent on an error result, and when the server addressed nothing. A subagent's transcript keeps at most 8 KiB. |

### `ToolSpec`

What `$.tool.register` takes. Used by `$.tool.register`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The short name of the tool (letters, digits, `_`, `-`, up to 64). The model calls it as `mcp__<plugin>__<name>`. | Type: `string`. |
| `description` | <Documented /> | What the tool does, for the model (and the person where tools are listed). The engine draws an unpaired surrogate half in it as U+FFFD. | Type: `string`. |
| `inputSchema` | <Documented /> | A JSON schema object for the input (`{ type: "object", properties, required }`). The default is `{ type: "object" }`. | Type: `Record<string, unknown>`. Optional. |
| `isDeferred` | <Documented /> | Where the tool waits: `false` puts its schema in the prompt's tool list, `true` behind ToolSearch. | Type: `ToolDeferral`. Optional. If left out, the rule of the engine places it: behind ToolSearch, as it places the tool of an MCP server. The answer of a `tool.describe` hook is read first. |

### `ToolUseSummary`

One tool_use block of an assistant message, with its outcome once the transcript holds the tool_result of the call (paired by `tool_use_id`).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The id of the call, as `tool.call` carried it (`e.tool_use_id` there). | Type: `string`. |
| `tool` | <Documented /> | Which one was called (`Read`, `Bash`, `mcp__server__tool`), as `tool.call` named it (`e.tool` there). | Type: `string`. |
| `input` | <Documented /> | The arguments the model gave it. | Type: `Record<string, unknown>`. |
| `result` | <Documented /> | What the transcript stored for the call. On an answered call, it is the record of the tool (`result` of `tool.call`). On a refused or errored call, it is the error text. | Type: `unknown`. Optional. Absent while the call is in flight or when nothing was stored. `text` holds either way. |
| `text` | <Documented /> | The result as the model read it. Absent while the call is in flight. | Type: `string`. Optional. |
| `isError` | <Documented /> | Present only when the tool reported an error, as on the result of `tool.call`. | Type: `true`. Optional. |
| `agentId` | <Documented /> | On an Agent tool use, the id of the agent that it spawned: what `$.session.messages({ agentId })` reads and its `turn.complete` carries. | Type: `string`. Optional. Known while the session tracks the run. Absent on other tools and on a refused Agent call. |
| `durationMs` | <Documented /> | On an answered Agent tool use that ran to completion, it is how long the agent ran. The unit is milliseconds, as the stored record of the call has it. | Type: `number`. Optional. Absent while it runs, on a background launch, and on every other tool. |
| `meta` | <Documented /> | What the MCP server of the tool addressed to plugins in `_meta`: entries under `"claude/plugins"` and `"anthropic/sources"`. The model never reads it. The engine leaves out a key over 256 KiB. | Type: `Record<string, unknown>`. Optional. Off by default. Absent on an error result, and when the server addressed nothing. A subagent's transcript keeps at most 8 KiB. |

## Related Pages

- [Tool, Command, and Config Types](index.md)
- [Mod API Types](../index.md)
