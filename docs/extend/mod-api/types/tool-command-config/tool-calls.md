---
title: Tool Call, Check, and Describe Types
description: "Types of tool call results, permission checks, tool descriptions, envelopes, and summaries."
sidebar_position: 2
---

These types describe what a mod reads and returns when it hooks a tool call. Use them to type a `tool.call`, `tool.check`, `tool.describe`, or `tool.list` hook, and to read the summaries of past calls. Each type has a table of its fields.

## Types with Fields

Each type below has its own table of fields.

### `ToolCallReserved`

The keys that the input of `tool.call` carries beside the arguments of the tool. The engine strips them before the tool runs, so the tool sees none of them. `consent` holds the words of the person for the press that raised the call. It joins the context of the run as a human turn, which the permission path reads as the request of the user, only when the call answers the press, input, or pick of the person on an element of this plugin (not one in a desktop `Client`). The call must come from the closure of that element, or from this plugin's own hook on that event before it returns or times out, with no `Stop` standing since the gesture. Any other call runs as it would without `consent`.[^consent]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool. | Type: `T`. |
| `tool_use_id` | <Documented /> | The ID of the tool call. | Type: `string`. Optional. |
| `consent` | <Documented /> | The words of the person for the press that raised the call. The tool never sees it. | Type: `string`. Optional. It counts as the request of the user only for a call that answers a press, input, or pick on this plugin's own element (see above). |

### `ToolCallResult`

What a `tool.call` hook returns, and what `next(e)` and `$.tool.call(input)` resolve to. It is a union: the result of the tool (`{ result, context? }`) or `{ deny }`. Its fields are `context`, `deny`, `isError`, `isReadOnly`, `ref`, `result`, and `text`. From core, the result is `{ ref, result, text }`, plus `isError` on a tool error. Used by `tool.call`.

The rows below show each form of the union in turn: a deny, an answered result, and an errored result. A row that says "Never set in this form" has type `undefined` in that form.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Refuses the call. The model receives the text as an error result. Absent when the call was answered. | Type: `string`. A deny that a hook returns after the tool answered without error withholds that result and undoes nothing. The model then reads `<tool> ran, and a plugin withheld its result: <text>`. |
| `result` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `context` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `ref` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `text` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isError` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isReadOnly` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `result` | <Documented /> | The output of the tool. From core, it is the record of the tool, typed for each built-in tool once `e.tool` and `isError` are narrowed. From a hook, it is the hook's own. | Type: `ToolResultOf<Name>`. Core checks the answer of a hook against the output schema of the tool when the tool has one. Absent on a deny. |
| `context` | <Documented /> | Text that the model reads after the result of the tool. The user never sees it. From core, none. | Type: `readonly string[]`. Optional. One entry is one reminder, like that of a `PostToolUse` hook. Past 100,000 characters (200,000 together) the model reads a head and a path. |
| `ref` | <Documented /> | Core sets it on what `next(e)` resolves to. It names the messages that core produced for the call. They stay on the host side. | Type: `number`. Optional. A hook that returns the object it got makes core use those messages as they are. Absent on a hook's own `{ result }` and on a deny. |
| `text` | <Documented /> | Core sets it. It is the result as the model reads it (text blocks joined). It is present for every tool, while the shape of `result` varies for each tool. | Type: `string`. Optional. Absent on a hook's own `{ result }`. |
| `isReadOnly` | <Documented /> | Core sets it. It is present only when the tool held the input it executed read-only by its own check (the check that its permissions use). | Type: `true`. Optional. It says the call ran read-only, rewrites included. It does not cover calls that this call causes. |
| `isError` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isError` | <Documented /> | Core sets it. It is present only when the tool reported an error (it threw, was interrupted, or answered an error). `text` is what the model read. | Type: `true`. |
| `result` | <Documented /> | What the transcript stored for the errored call: the error text, or undefined when nothing was stored. It is never the typed record of the tool. | Type: `unknown`. |
| `text` | <Documented /> | The error as the model reads it. | Type: `string`. Optional. |
| `ref` | <Documented /> | As on an answered result: it names the messages that core produced. | Type: `number`. Optional. |
| `context` | <Documented /> | As on an answered result. | Type: `readonly string[]`. Optional. |
| `isReadOnly` | <Documented /> | As on an answered result: the tool held the input it ran read-only. | Type: `true`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `ToolCheckInput`

The input of `tool.check`. It has the tool and its arguments. It also has the ceiling of the organization if it set one, whether the call is read-only, and who can answer an ask. On a real call it also has the ID of the call and the `agentId` of the loop. All fields are pinned: a hook decides about the call and does not change it. Used by `tool.check`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The tool name as the model writes it (`Bash`, `mcp__server__tool`). It is the key that a matcher narrows on. | Type: `string`. A matcher on any name that the host declares for the tool admits it. |
| `input` | <Documented /> | The arguments of the tool as the permission decision reads them (`{ command }` for Bash, `{ file_path, ... }` for the file tools). | Type: `unknown`. |
| `tool_use_id` | <Documented /> | The call being decided. Absent on a query, with `op`, and on an MCP call that goes straight to its server (a settings hook's, a `Monitor` watch). | Type: `string`. Optional. `next.origin` names who raised it: `{ plugin: 'engine', tier: 'core' }` for the model's own call, the plugin for its `$.tool.call` or its query, or `hook:<event>` for the call of a settings `mcp_tool` hook. |
| `agentId` | <Documented /> | The ID of the loop that decides the call. It is on a real call inside the loop of a subagent or a teammate: the one that its `tool.call` carried. | Type: `string`. Optional. Absent on the main loop and on a query. It says which loop made the call, not which plugin caused it (`next.origin` says that). |
| `isReadOnly` | <Documented /> | Set when the tool call is read-only. | Type: `true`. Optional. The program passes it on as the read-only flag of the permission decision.[^read-only] |
| `approver` | <Documented /> | Who answers the asks of this evaluation. It is known before any hook runs. | Type: `ToolCheckApprover`. Optional. Set by the engine and pinned. `host` when a hosted session's permission callback or prompt tool answers, or the cloud session a served call is for. `person` when a person can be asked, a pane's card included. Absent when nobody can be asked (`dontAsk` mode, avoid-prompts, headless). |
| `ceiling` | <Documented /> | The most permissive verdict that the organization lets the model's call of an MCP tool reach: `ask`, or `deny` where an administrator blocked the tool. On the own call of a plugin or of a settings hook, for any tool, it is also `deny` where a managed deny rule covers the input as it would cover the call of the model. | Type: `ToolCheckDecision`. Optional. Set by the engine, never by a query, and pinned. The own `ceiling` of a hook, on its answer, is dropped. Where the question has none, it is the ceiling that the check of core found for this call. That holds on the verdict of core and on each hook's verdict that asked beneath. Absent where none is set. `deny` here is a block by the organization (a managed deny rule, a block on the tool or its connector, or a host's `always_deny`), not a rule or a switch of the person or of a repository. The engine holds no own call of a plugin or of a settings hook to it: a hook here may.[^ceiling] |
| `isCeilingUnread` | <Documented /> | Set on the own call of a plugin or of a settings hook when managed deny rules exist and the engine cannot tell whether one covers the call. | Type: `true`. Optional. Set by the engine and pinned. Matching the rules failed or stopped short, or they bind only where or as the tool runs. The engine refuses nothing on it: a hook here may.[^ceiling] |
| `op` | <Documented /> | Set where no tool is called: the own call of a plugin on `$` that `tool` and `input` stand for, as it is about to run. | Type: `'fs.read' \| 'fs.list' \| 'fs.write' \| 'process.run' \| 'process.spawn'`. Optional. Set by the engine and pinned. Raised only with `ceiling: "deny"` or `isCeilingUnread`, and only to a hook whose matcher names `op`. A file call reads as `Read` or `Write`, a process call as the `Bash` line of its argv. Nobody is asked: a deny refuses the call.[^ceiling] |

### `ToolCheckResult`

What a `tool.check` hook returns, and what `next(e)` resolves to: the verdict, why, and what stands behind it. It never says who answers it. From core, it is the decision of the engine for the mode and rules. A hook may answer any verdict. The last word up the chain decides. Used by `tool.check`, `$.tool.check`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `decision` | <Documented /> | `allow` runs the tool. `ask` puts it to the decider of the mode, or to a person when a hook made it (`plugin`). `deny` refuses it, with the reason as the error of the model. | Type: `ToolCheckDecision`. For a tool that needs the person, a hook can only tighten the verdict. Its `allow` does not dismiss the dialog. |
| `reason` | <Documented /> | Why, in a sentence. From core, it is the rule or check that decided. From a hook, it is what the model reads on a deny and what the dialog shows on an ask. | Type: `string`. Optional. |
| `rule` | <Documented /> | The settings rule that decided, as written (`Bash(git push:*)`). | Type: `string`. Optional. Absent for a mode or a tool's own check. |
| `hook` | <Documented /> | The classic hook event that decided, or whose ask the verdict was reached under (`PreToolUse`), whoever configured the hook. | Type: `string`. Optional. Absent on a `$.tool.check` query, which runs no classic hook. |
| `setting` | <Documented /> | The key of the option whose own check asked, whoever configured it (`permissions.blockReadsOutsideWorkingDirectories`). | Type: `string`. Optional. From core, for the read block: its ask on a shell command that reads outside the working directories or, with the block on, leaves the sandbox. |
| `plugin` | <Documented /> | The plugin whose hook made this ask. | Type: `string`. Optional. Set by the engine and pinned. What a hook writes here is dropped. Set on an `ask` that a hook answered, a reworded ask included. An ask that a hook passes up unchanged keeps what it carried, so core's own ask names none. Such an ask is a person's: the dialog, the host's callback, or a `PermissionRequest` hook answers it. No classifier's allow settles it, its block still refuses, and a rule for the whole tool is not kept. A narrower rule the person saves settles nothing while the hook asks. Where nobody can be asked (`approver` absent), the program turns the ask into a deny, and its reason is the error of the model. A tool that raises no prompt keeps its own rule. |
| `decider` | <Undocumented /> | A way for a hook to put its ask to a person. | Type: `'host' \| 'person'`. Optional. The program reads `decider: "person"` on the answer of a hook and marks the answer with `plugin`. It ignores any other value, and no result carries `decider`. An ask that a hook makes goes to a person.[^decider] |
| `ceiling` | <Documented /> | The most permissive verdict that the organization lets the model's call of an MCP tool reach: `ask`, or `deny` where an administrator blocked the tool, or where a managed deny rule covers a plugin's own call of any tool. | Type: `ToolCheckDecision`. Optional. Set by the engine. The own `ceiling` of a hook is dropped. Where the question has none, it is the ceiling that the check of core found for this call.[^ceiling-result] |

### `ToolDescribeInput`

The input of `tool.describe`: the description of one tool, at the moment the engine first renders the schema of the tool for the model. Used by `tool.describe`, `$.tool.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The tool name as the model sees it (`Bash`, `mcp__server__tool`). It is the key that a matcher narrows on. | Type: `string`. |
| `description` | <Documented /> | The description of the tool as the tool computed it. | Type: `string`. |
| `isDeferred` | <Documented /> | Present, and true, when the engine lists the tool behind ToolSearch. Its schema loads when the model asks for it by name. Absent for a tool that the engine lists in front. | Type: `true`. Optional. The tool of an MCP server loads on demand, and so does a tool that asks to. A plugin tool with `isDeferred: false` stays in front. |
| `provider` | <Documented /> | Who provides this tool: the plugin and its tier, or `{ plugin: "engine", tier: "core" }` for a built-in. Pinned: the engine refuses a rewrite. | Type: `Origin`. The tool of a configured MCP server is `mcp:<server>`. It is in `prepend` when the policy settings source configures the server, else in `user`. |
| `mcpServer` | <Documented /> | The MCP server that the tool comes from, read off the connection that listed it. A config file need not be read, and a server added at runtime is covered. Pinned: the engine refuses a rewrite that changes or adds it, and restores it when a rewrite leaves it out. | Type: `ToolMcpServer`. Optional. Absent on any other tool (a built-in, or one of a `tool.list` hook) and on an MCP tool whose server facts are not known.[^tool-mcp-server] |

### `ToolDescribeResult`

What a `tool.describe` hook returns: the description that the model sees for that tool and, when the hook moves it, where the tool waits (ToolDeferral). `{ description }` alone changes the text and keeps the placement. `isDeferred: true` puts the tool behind ToolSearch. Used by `tool.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `description` | <Documented /> | The description that the model sees for the tool. | Type: `string`. |
| `isDeferred` | <Documented /> | Where the tool waits. `true` puts it behind ToolSearch. | Type: `ToolDeferral`. Optional. |
| `breakPromptCache` | <Documented /> | Sends a changed description or placement at the next turn. It rewrites the whole prompt cache and drops the earlier thinking of the model. | Type: `boolean`. Optional. Left out, a changed description waits for a new thread or a compaction. A changed placement waits for a new thread or `/clear`, because a compaction keeps the tool block.[^break-cache] |

### `ToolEnvelope`

`{ tool, tool_use_id, ...args }` as one flat object type, generic over the tool name and its parsed arguments.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool being called (`Bash`, `mcp__<server>__<tool>`). A comparison with it narrows `e`. | Type: `Name`. Reserved: core ignores a rewrite of it. |
| `tool_use_id` | <Documented /> | The ID of the tool_use block. It is the same at every event of the call and in `$.ui.notice`. | Type: `string`. Reserved: core ignores a rewrite of it. |

### `ToolInfo`

One tool as `$.tool.list()` returns it and as a `tool.list` hook answers it.[^tool-info] Used by `$.tool.list`, `tool.list`.

These rules hold:

- **What the hooks answer.** For the raise of the engine, the answer is the tool pool of the session: for the model, every agent (foreground or background), ToolSearch, and `$.tool.call`. The tools of an MCP server that joins later are asked about before a request carries them. For the `$.tool.list()` of a mod, the answer is only what that call reads.
- **What `next(e)` holds.** The tools as the engine built them, with what an earlier answer removed and without what it added. Answer the whole list each time. The engine ignores the order of the list, so that the prompt cache holds.
- **When the engine raises it.** Before the first request of a thread, once a load of hooks modules is over or 10 seconds have passed. It raises it again when the loaded plugins, the names of the tools, or a setting change, and at the turn after `$.ui.invalidate('tool.list')`. It never raises it for each turn, because a pool that moves breaks the prompt cache.
- **Remove a tool.** Leave an entry out and the tool goes, with what a deny rule on it takes out. What such a rule brings back, such as Glob and Grep without Bash, is asked about too. A tool that no deny rule can leave out stays while any other does. The engine refuses a call of a removed tool, whether a script, an agent, the host's `mcp_call`, an `mcp_tool` settings hook, or a Monitor poll makes it. A running watch of the tool ends. The last three do not wait for a hooks load, so what a module removes does not refuse a call made before that module has loaded. A tool that a thread already declared stays declared until a compaction, and a call of it is refused with a reason. `$.ui.ask` and `$.agent.spawn` belong to the host: removing their tools does not reach them.
- **Add a tool.** Add `{ name, description, mcp: false, inputSchema? }` under a new name and the tool joins. The engine checks it as `$.tool.register` checks a spec, and leaves out an entry that fails. A `tool.call` hook on its name answers its calls, with no permission prompt. A call that no hook answers is a tool error that names the tool. A schema that the API refuses is declared with no parameters. New words reach a thread at its next compaction. These names cannot be added: an `mcp__` name, a name that a request declares itself (`advisor`, `DeferredToolPlaceholder`), and the name of a tool or built-in in any case or with its words apart, on or off. An entry with the name or alias of a tool that exists leaves that tool as it is: `tool.describe` changes a description. A deny rule, a `--tools` list, and the `tools:` of an agent hold over an added tool as over any other. A real tool takes its name when it joins.
- **Failure.** The engine skips a hook that throws, crashes, or runs past its 10-second budget, unless its `.catch` answers. The answer is then what the others said, without what the hook removed or added on any run, and the event is raised again at the next turn. A hook whose `$` ops hold it past 30 seconds in all is aborted the same way.[^op-hold] A crash traced to a mod can unload it, and the removals of a mod lapse when it is unloaded. A `{ deny }`, or a list with nothing in it to read, leaves the last answer standing, and the event is raised again at the next turn. A turn waits at most 10 seconds for a raise. It then goes on with the answer that stood, or with the tools as built before the first. A `$.tool.call` of a `tool.list` hook, or an agent it spawns, reads the answer that stood, or the tools as built on the first raise. `$.prompt.submit` and `$.command.run` are refused there.
- **Managed policy.** Where sec-default is seated, the hook of a person cannot remove a tool of the managed MCP servers or seated plugins of the organization. It cannot bring back a tool that a hook of the organization removed. Its addition is dropped while managed `allowedMcpServers` is set, or where the name reads as a tool that the organization delivers. The engine skips a hook of a person that overruns or crashes, and sec-default still answers, though that hook can delay the answer. The engine puts no other limit on the answer.

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
| `name` | <Documented /> | What the model calls the tool. | Type: `string`. |
| `description` | <Documented /> | What the tool does, in its own words: its description, or at most a first sentence for MCP tools without one. | Type: `string`. |
| `mcp` | <Documented /> | True for the tool of an MCP server. | Type: `boolean`. |
| `inputSchema` | <Documented /> | On an entry that a `tool.list` hook adds: a JSON schema object for the input (`{ type: "object", properties, required }`). The default is `{ type: "object" }`, as on `$.tool.register`. | Type: `Record<string, unknown>`. Optional. Never on a tool that the session lists. |

### `ToolInputOf`

`{ tool, tool_use_id, ...args }` as one flat object type. The docs of `tool` and `tool_use_id` live on the `keyof` operand, because a mapped type takes the docs of its properties from there.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in keyof ToolEnvelope<Name, Arguments>]` | <Documented /> | Each key of the tool envelope, with its type unchanged. | Type: `ToolEnvelope<Name, Arguments>[K]`. |

### `ToolJudgeInput`

The input of `tool.judge`. It is the question of `tool.check` about a real call: all fields of `ToolCheckInput`, with a call that always has its ID. All fields are pinned. Used by `tool.judge`, `$.tool.judge`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The call that is judged: the ID that its `tool.call` and `tool.check` carried. | Type: `string`. `next.origin` names a plugin only on that plugin's own `$.agent.call`, where its allow stands in the place of the classifier. On any other call it names the engine. |

The other fields are those of [`ToolCheckInput`](#toolcheckinput).[^tool-judge]

### `ToolMcpServer`

The MCP server that a tool comes from, as `tool.describe` reports it in `mcpServer`. Used by `tool.describe`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The transport in the config of the server. A config with no `type` reads `stdio`. | Type: `'stdio' \| 'http' \| 'sse' \| 'ws' \| 'sdk' \| 'sse-ide' \| 'ws-ide' \| 'claudeai-proxy'`. |
| `origin` | <Documented /> | Where the server is: scheme, host, and a port that is not the default, as WHATWG `URL.origin` gives it, of the URL after `${VAR}` expansion. Never a login, path, query, or fragment. An entry on a session proxy reads the host dialed, not the server that the proxy reaches. | Type: `string`. Optional. Absent for `stdio` and `sdk`; for a URL that does not parse or has no origin of its own; for a connector whose address claude.ai withholds; for a `claudeai-proxy` entry with no route to dial; and for a server that the tool container of a cloud session relays, whatever its `type`. |
| `connectorId` | <Documented /> | The ID of the claude.ai connector, only where it is vouched for: the own connector of claude.ai, or the `connectorId` that a host states on its own `sdk` entry. Never one written in a file, a plugin, or `--mcp-config`. | Type: `string`. Optional. |

### `ToolNamed`

An input that names its tool as the literal `T`. `next` and `$.tool.call` read it to type the result of the call for each tool (NextResultFor).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The name of the tool being called (`Bash`). | Type: `T`. Read-only. |

### `ToolOfferInput`

The input of `tool.offer`: one tool, at the moment the engine offers it to the model of one loop. Used by `tool.offer`, `$.tool.offer`.[^tool-offer]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool` | <Documented /> | The tool name (`Bash`, `mcp__server__tool`). It is the key that a matcher narrows on. | Type: `string`. |
| `provider` | <Documented /> | Who provides this tool, as `tool.describe` says in `provider`. | Type: `Origin`. |
| `agentId` | <Documented /> | The agent whose loop it is. | Type: `string`. Optional. Absent for the main conversation. |
| `subagentType` | <Documented /> | The type of that agent (`Explore`, or the agent of a plugin). | Type: `string`. Optional. Absent for the main conversation. |

### `ToolOfferResult`

What a `tool.offer` hook returns: whether the model of the loop is offered the tool, in its tool list and at its call. Used by `tool.offer`.[^tool-offer]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isOffered` | <Documented /> | `false` keeps the tool from the model of that loop for the life of the loop, compactions and resumes included. At a call it refuses that call alone. | Type: `boolean`. |

### `ToolRequestMeta`

What a `tool.call` hook sets for the request of the tool of an MCP server.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `requestMeta` | <Documented /> | Entries for the `_meta` of the request that this call sends to its MCP server. Set them with `next({ ...e, requestMeta })`. They are never an argument of the tool. | Type: `Record<string, string>`. Optional. A hook may set only `anthropic/sources`, a string of at most 256 KiB. It goes only to a connector relay. `{}` clears it. |

### `ToolResultSummary`

One tool_result block of a user message.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The ID of the call that this result answers (`e.tool_use_id` of `tool.call`). | Type: `string`. |
| `text` | <Documented /> | The result as the model read it (text blocks joined). | Type: `string`. |
| `isError` | <Documented /> | True when the tool reported an error. | Type: `boolean`. |
| `result` | <Documented /> | What the transcript stored for the call: the record of the tool on an answered call (`result` of `tool.call`), or the error text when `isError`. | Type: `unknown`. Optional. Absent when nothing was stored. In `-p` a tool may store the record without its bulk. `text` is what the model read. |
| `meta` | <Documented /> | What the MCP server of the tool addressed to plugins in `_meta`: entries under `"claude/plugins"` and `"anthropic/sources"`. The model never reads it. The engine leaves out a key over 256 KiB. | Type: `Record<string, unknown>`. Optional. Off by default. Absent on an error result, and when the server addressed nothing. A subagent's transcript keeps at most 8 KiB. |

### `ToolSpec`

What `$.tool.register` takes. Used by `$.tool.register`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The short name of the tool (letters, digits, `_`, `-`, up to 64). The model calls it as `mcp__<plugin>__<name>`. | Type: `string`. |
| `description` | <Documented /> | What the tool does, for the model (and the person where tools are listed). The engine draws an unpaired surrogate half in it as U+FFFD. | Type: `string`. |
| `inputSchema` | <Documented /> | A JSON schema object for the input (`{ type: "object", properties, required }`). The default is `{ type: "object" }`. | Type: `Record<string, unknown>`. Optional. |
| `isDeferred` | <Documented /> | Where the tool waits: `false` puts its schema in the tool list of the prompt, `true` puts it behind ToolSearch. | Type: `ToolDeferral`. Optional. If left out, the rule of the engine places it behind ToolSearch, as it places the tool of an MCP server. The engine reads the answer of a `tool.describe` hook first. |

### `ToolUseSummary`

One tool_use block of an assistant message, with its outcome once the transcript holds the tool_result of the call (paired by `tool_use_id`).

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `tool_use_id` | <Documented /> | The ID of the call, as `tool.call` carried it (`e.tool_use_id` there). | Type: `string`. |
| `tool` | <Documented /> | Which tool was called (`Read`, `Bash`, `mcp__server__tool`), as `tool.call` named it (`e.tool` there). | Type: `string`. |
| `input` | <Documented /> | The arguments the model gave it. | Type: `Record<string, unknown>`. |
| `result` | <Documented /> | What the transcript stored for the call. On an answered call, it is the record of the tool (`result` of `tool.call`). On a refused or errored call, it is the error text. | Type: `unknown`. Optional. Absent while the call is in flight or when nothing was stored. `text` holds either way. |
| `text` | <Documented /> | The result as the model read it. Absent while the call is in flight. | Type: `string`. Optional. |
| `isError` | <Documented /> | Present only when the tool reported an error, as on the result of `tool.call`. | Type: `true`. Optional. |
| `agentId` | <Documented /> | On an Agent tool use, the ID of the agent that it spawned. `$.session.messages({ agentId })` reads it, and its `turn.complete` carries it. | Type: `string`. Optional. Known while the session tracks the run. Absent on other tools and on a refused Agent call. |
| `durationMs` | <Documented /> | On an answered Agent tool use that ran to completion, how long the agent ran. The unit is milliseconds, as the stored record of the call has it. | Type: `number`. Optional. Absent while it runs, on a background launch, and on every other tool. |
| `meta` | <Documented /> | What the MCP server of the tool addressed to plugins in `_meta`: entries under `"claude/plugins"` and `"anthropic/sources"`. The model never reads it. The engine leaves out a key over 256 KiB. | Type: `Record<string, unknown>`. Optional. Off by default. Absent on an error result, and when the server addressed nothing. A subagent's transcript keeps at most 8 KiB. |

## Related Pages

- [Tool, Command, and Config Types](index.md)
- [Mod API Types](../index.md)

## Sources

[^read-only]: The program, `chunk-hg1yqkjk.js:8807` (`isReadOnly: true` when the tool reports the call read-only).
[^consent]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-dm9xqacz.js:6`. The text of `ToolCallReserved`. The run of `$.tool.call`, `chunk-hg1yqkjk.js:210350`, throws unless `consent` is a string, adds it to the messages of the run as a message with origin `human` only when the call answers a vouched press or input of the plugin, and otherwise logs `consent left out, unvouched`.
[^ceiling]: `schemas/claude-code.d.ts`, `ToolCheckInput`.
[^ceiling-result]: `schemas/claude-code.d.ts`, `ToolCheckInput`.
[^break-cache]: `schemas/claude-code.d.ts`, `PromptSectionResult` and `ToolDescribeResult` (`breakPromptCache`).
[^tool-info]: `schemas/claude-code.d.ts`, `ToolInfo`. The program, `chunk-nxwpaxwj.js:5818`, `chunk-hg1yqkjk.js:210776`.
[^tool-mcp-server]: `schemas/claude-code.d.ts`, `ToolDescribeInput` and `ToolMcpServer`.
[^op-hold]: `opHoldMs: 30000`, `chunk-qsd8sbe8.js:9668`.
[^tool-judge]: `schemas/claude-code.d.ts`, `ToolJudgeInput`. The program, `chunk-qsd8sbe8.js:9568` (the keys of the judged call, such as `tool_use_id` and `isReadOnly`, that a hook cannot change).
[^tool-offer]: `schemas/claude-code.d.ts`, `ToolOfferInput` and `ToolOfferResult`. The program, `chunk-wm04tzdx.js:1914` (the input of `tool.offer`) and `chunk-hg1yqkjk.js:207667` (the refusal message).
[^decider]: The program, `chunk-qsd8sbe8.js:9516`.
