---
title: Tool, Command, and Config
description: The $.tool, $.command, and $.config nouns that list, check, call, and register tools and slash commands, and change /config rows.
sidebar_position: 11
---

`$.tool` lists, checks, calls, and registers tools. `$.command` does the same for slash commands. `$.config` lists and sets the rows of the `/config` menu. To add a tool or command, register it, then serve it with a hook on `tool.call` or `command.run`.

A `deny` from a `tool.call`, `tool.check`, or `config.set` hook stops the action. A registered tool has the name `mcp__<plugin>__<name>`.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types]

"Run time" in a "Where it can be used" cell means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

This mod adds a `/standup` command.

```javascript
on("session.start", async ($, e, next) => {
  await $.command.register({
    name: "standup",
    description: "Summarize what changed today",
    argumentHint: "[days]"
  });
  return next(e);
});
on("command.run", { command: "standup" }, async ($, e) => ({
  text: `Summary for ${e.args === "" ? "1" : e.args} day(s)`
}));
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.tool.list` | <Documented /> | Returns the tools the model can call now, built-in and MCP, in the order the model sees them. It runs through the `tool.list` hooks: what they answer the engine's own raise is the tool pool of the session, for the model and for every agent. | `() => Promise<ToolInfo[]>`. The hooks of the calling plugin are skipped, as on every op, so a tool that it adds itself is not in what it reads back. | Run time. |
| `$.tool.call` | <Documented /> | Calls a tool. It is the event `tool.call`, the same call the engine makes for the model, under a `tool_use_id` of its own. | Runs a tool through the hooks, the permission check, and the tool. Rejects for an unknown name or an aborted call. The call raises no permission prompt, also in `dontAsk` mode and in `-p` runs, and under an ask rule of yours. Deny rules at every level, an organization's managed ones included, do not cover this call. They bind the model and its subagents, whose own calls stay refused. Every ask becomes an allow, whoever raised it, but for a built-in tool whose dialog is the call itself, such as `ExitPlanMode`.[^tool-call-ask] An organization's mod cannot call a tool that a person's mod registered. The call is answered `{ deny }`.[^tool-call-org] `$.tool.check` still reports the session's own verdict, so it can say `ask` for a call that runs. A hook that re-issues the model's call with `$.tool.call` answers for its input: the model's command runs with nobody asked.[^tool-call] Example: `await $.tool.call({ tool: "Read", file_path: "a.md" })`. | Run time. |
| `$.tool.check` | <Documented /> | Asks for the permission decision for a tool call now. It is the event `tool.check`. Resolves `{ decision, reason?, ... }`. | `(input: ToolCheckArgs) => Promise<ToolCheckResult>`. Nothing runs and no dialog opens. | Run time. |
| `$.tool.register` | <Documented /> | Declares a tool the model can call from the next prompt on: the name, description, and input schema of `mcp__<plugin>__<name>`. | `(tool: ToolSpec) => Promise<...>`. Serve it with a `tool.call` hook. A second registration of a name replaces the first. | After the session binds at `session.start` (rejects before). |
| `$.command.list` | <Documented /> | Returns the slash commands the person can run now, built-in, plugin, and MCP, in typeahead order. | `() => Promise<CommandInfo[]>`. | Run time. |
| `$.command.run` | <Documented /> | Runs a slash command as if the person typed `/command args`. It is the event `command.run`. It queues and runs once the session is idle. | `(input: CommandRunArgs) => Promise<CommandRunResult>`. Rejects an unknown name. It runs through the hooks that hear it (Tier). An organization's mod cannot run a command that a person's mod registered: that rejects too.[^v328-command-run] | Run time. |
| `$.command.register` | <Documented /> | Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on. | `(command: CommandSpec) => Promise<...>`. Serve it with a `command.run` hook. The engine refuses a built-in's name. | Run time. |
| `$.config.list` | <Documented /> | Returns the rows the `/config` menu would draw now, in its order, each with its value, kind, owner, and lock. | `() => Promise<ConfigRow[]>`. Lists the rows after every `config.describe` hook. The list omits a hidden row. | Run time. |
| `$.config.set` | <Documented /> | Changes one row as if the person did in the menu. It is the event `config.set` with `origin` `{ kind: 'plugin', name }`. | `(input: ConfigSetArgs) => Promise<ConfigSetResult>`. Resolves `{ value }` or `{ deny }`. Rejects a key that no row has. | Run time. |

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `tool.call` | <Documented /> | Fires when the engine is about to run a tool. Each `next(e)` runs the hooks beneath, then core (the permission prompt, the tool). | Input `ToolCallInput`. Result `{ result, context? }` or `{ deny }`. `{ deny: reason }` refuses the call. The engine skips a guard that fails, and the tool runs. Code Mode does not refuse to start when a mod hooks tool calls. An administrator can still keep Code Mode off in managed settings.[^v2327] | `on('tool.call', ...)`. Also `$.tool.call(...)`. |
| `tool.check` | <Documented /> | Fires when the engine decides whether a tool call may run, after the `tool.call` and `PreToolUse` hooks and before the mode settles an ask. | Input `ToolCheckInput`, which carries `isReadOnly` when the call is read-only and `approver`, who can answer an ask. Result `{ decision, reason?, ... }`. An ask that a hook makes goes to a person, and the engine marks it with `plugin`: only the permission dialog, a host's callback, or a `PermissionRequest` hook can approve it, and where nobody can be asked (`dontAsk` mode, avoid-prompts, headless) it is refused with the mod's reason. `next(e)` gives the engine's verdict. `$.tool.check` still reports the session's own verdict, so it can say `ask` for a call that `$.tool.call` then runs, because that call opens no dialog and asks no classifier.[^tool-call] A guard that fails is skipped, so add a `.catch`. The call of a settings `mcp_tool` hook passes here too (`next.origin`), and so may a plugin's file or process call, for a matcher that names `op`.[^v328-check-origin] | `on('tool.check', ...)`. Also `$.tool.check(...)`. |
| `tool.judge` | <Documented /> | Fires when auto mode is about to ask its classifier about a call, after every rule, hook, and check that only a person may answer. | Input `ToolJudgeInput`. Result `{ decision, reason?, plugin? }`. `next(e)` asks the classifier once, however often the event runs, and runs no tool: the verdict of the server where it judged the call of the model, else the local classifier. A call that auto mode settles with no classifier raises none. A hook that fails is skipped and the classifier decides. The allow of the classifier is no proof the call ran, because an ask of a hook or a change of mode may still hold it.[^judge] | `on('tool.judge', ...)`. Also `$.tool.judge(input)`. |
| `tool.run` | <Documented /> | Fires when a call has been allowed and is about to run: after `tool.call`, `PreToolUse`, `tool.check`, and whoever settled an ask. It never fires for a refusal. | Input `ToolCallInput`, all of it pinned: a rewrite is refused. `next(e)` runs the tool. `{ result, context? }` answers in its place, as a success that `PostToolUse` sees. `{ deny }` is the error of the call. A second `next(e)` starts nothing and resolves to a `{ deny }`. A hook that may match a tool turns off, for that tool, what would carry its output past the hook: the move to the background, the live output of a served call, and the wait of Code Mode for a stopped result. A guard that fails is skipped and the tool runs.[^run] | `on('tool.run', ...)`. Also `$.tool.run(input)`. A tool that `$.tool.register` declares may be served here, once the call is allowed, or at `tool.call`. |
| `tool.describe` | <Documented /> | Fires when the engine first renders the tool's schema in a session. `next(e)` resolves to `{ description, isDeferred? }`. | Input `ToolDescribeInput`. The engine caches the answer until `$.ui.invalidate("tool.describe")`. When a tool is asked again, the hook's text goes over the description that the engine recorded for the tool, where the two differ, only when its answer says `breakPromptCache: true`. Without `breakPromptCache`, a changed description waits for a new thread or a compaction, and a changed placement for a new thread or `/clear`. With no hook, the engine keeps its own text and `isDeferred`.[^describe-resolve] The engine marks a tool as rewritten when the hook text differs from its own after normalization. An invalidation clears the cached answers and starts a new redescribe epoch once a tool was described. | `on('tool.describe', ...)`. In tests: `$.tool.describe(...)` on the test engine (not on a hook's `$`). |
| `tool.offer` | <Documented /> | Fires once for each tool before the first request of a loop, and again when the model of the loop calls the tool. `next(e)` resolves to `{ isOffered: true }`. | Input `ToolOfferInput`. Result `ToolOfferResult`. `{ isOffered: false }` keeps the tool from the model of that loop for the life of the loop, compactions and resumes included. At a call it refuses that call alone. A tool that joins later is asked once, as it joins. `tool.list` shapes the whole pool. `tool.offer` shapes only what one model is shown of it: the children of the agent inherit a tool that was not offered, and `$.tool.call` still runs it. A hook that fails passes the tool through. The answers hold only while some hook is on the event. `StructuredOutput` and `EndConversation` are never asked. A refused call fails with `<Tool> did not run: the agent it was called as is not offered it (tool.offer).`[^tool-offer] | `on('tool.offer', { tool: "Agent" }, ($, e) => ({ isOffered: !e.agentId }))`. Also `$.tool.offer(input)`. |
| `command.run` | <Documented /> | Fires when a slash command is about to run. `next(e)` resolves to `{ text }`, its output. | Input `CommandRunInput`. Rewrite `args` with `next`, or return `{ text }` to answer in its place. | `on('command.run', ...)`. Also `$.command.run(...)`. |
| `command.describe` | <Documented /> | Fires once for each command, when the engine lists it for the typeahead and `/help`. `next(e)` resolves to `{ description, argumentHint, isHidden }`. | Input `CommandDescribeInput`. The engine caches it for the session until `$.ui.invalidate("command.describe")`. | `on('command.describe', ...)`. In tests: `$.command.describe(...)` on the test engine (not on a hook's `$`). |
| `config.set` | <Documented /> | Fires when a `/config` row is about to change, from the menu or a plugin's `$.config.set`. `next(e)` resolves to `{ value }` once written. | Input `ConfigSetInput`. Result `{ value }` or `{ deny }`. `{ deny: reason }` leaves the row as it is. The engine refuses a value of the wrong kind. | `on('config.set', ...)`. Also `$.config.set(...)`. |
| `config.describe` | <Documented /> | Fires once for each `/config` row, when the menu lists it and for `$.config.list`. `next(e)` resolves to `{ label, description, isHidden }`. | Input `ConfigDescribeInput`. The engine caches it until `$.ui.invalidate("config.describe")`. | `on('config.describe', ...)`. In tests: `$.config.describe(...)` on the test engine (not on a hook's `$`). |

## How `tool.describe` Resolves a Description

The resolver and the request builder work as follows.[^resolver]

1. The engine builds its own description for the tool. It also decides if the tool waits behind `ToolSearch` (`isDeferred`).
2. The engine passes the tool, that text, and that placement to the resolver. With no `tool.describe` hook, the resolver returns them unchanged.
3. With a hook, the resolver returns what the hook chain gives back as `{ description, isDeferred }`.
4. The request builder writes the resolved `description` into the tool object of the request body. That object has `name`, `description`, and `input_schema`. So a hook changes what the model reads. A shorter text makes a smaller request.
5. The engine may hold a recorded description for the tool from an earlier request. The recorded text goes into the request instead. The exception is a tool that counts as redescribed and that a hook rewrote. Then the hook text goes in.
6. A request that the engine builds with the option `withoutToolDescribeHooks` skips the hook. The program shows no more about which requests set it.

The hook sees the tool as `e.tool`. It sees the engine's text as `e.description`.
This hook shortens the `Read` description.

```javascript
on("tool.describe", { tool: "Read" }, async ($, e, next) => {
  const base = await next(e);
  return { ...base, description: "Read a file by its absolute path." };
});
```

## Events Raised by These Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `tool.judge`, `tool.run` | <Documented /> | `$.tool.judge(input)`, `$.tool.run(input)` | Input `ToolJudgeInput` and `ToolCallInput`. Value `ToolJudgeResult` and `ToolCallResult`. |
| `tool.list` | <Documented /> | `$.tool.list()` | Input `NoArgs`. Value `ToolInfo[]`. The event is also raised for the engine's own list of its tools, and what the hooks answer is the session's tool pool.[^types] The tools a `tool.list` hook adds or removes apply to the model and every agent.[^tool-list] |
| `tool.offer` | <Documented /> | `$.tool.offer(input)` | Input `ToolOfferInput`. Value `ToolOfferResult`.[^tool-offer] |
| `tool.register` | <Documented /> | `$.tool.register(spec)` | Input `RegisteredToolSpec`. Value `{ tool: string }`. |
| `command.list` | <Documented /> | `$.command.list()` | Input `NoArgs`. Value `CommandInfo[]`. |
| `command.register` | <Documented /> | `$.command.register(spec)` | Input `CommandSpec`. Value `{ command: string }`. |
| `config.list` | <Documented /> | `$.config.list()` | Input `NoArgs`. Value `ConfigRow[]`. |

## Related Pages

- [Mod API Overview](../index.md)
- [Turn and Prompt](turn-prompt.md)
- [Tool, Command, and Config Types](../types/tool-command-config/index.md) (tool call, check, command, and config types)

## Sources

[^types]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-0yef3dc4.js:6`, published as `schemas/claude-code.d.ts`: `ToolInfo`, `ToolSpec`, `RegisteredToolSpec`, `ToolCallInput`, `ToolCheckArgs`, `ToolCheckInput`, `ToolCheckResult`, `ToolJudgeInput`, `ToolJudgeResult`, `ToolDescribeInput`, `CommandInfo`, `CommandSpec`, `CommandRunArgs`, `CommandRunInput`, `CommandRunResult`, `CommandDescribeInput`, `ConfigRow`, `ConfigSetArgs`, `ConfigSetInput`, `ConfigSetResult`, `ConfigDescribeInput`, and the `$.tool`, `$.command`, and `$.config` text.
[^tool-call]: The type file `schemas/claude-code.d.ts`, `$.tool.call`. The program, `chunk-bzyb60p0.js:308124` and `chunk-bzyb60p0.js:63423`.
[^tool-call-ask]: The type file `schemas/claude-code.d.ts`, `$.tool.call`. The program, `chunk-bzyb60p0.js:197105` (the allow, with the reason `plugin-origin: <plugin>`) and `chunk-bzyb60p0.js:197105` (the ask of a mod's own call turns into that allow).
[^tool-call-org]: The type file `schemas/claude-code.d.ts`, `$.tool.call` (an organization's mod and a person's mod).
[^judge]: The program, `chunk-0w2wb7gk.js:9761` (`tool.judge`, the check of `{ decision }` and the settle of `reason` and `plugin`).
[^v2327]: The program, `chunk-qwcebyxc.js:80` (`$e2d52d`, the switch on the reason, such as `"bad_value"` and `"unattended"`): the list of reasons that Code Mode does not start has no case for a mod that hooks tool calls.
[^run]: The program, `chunk-0w2wb7gk.js:9813`.
[^describe-resolve]: The program, `chunk-865at33z.js:25746`, `resolveToolDescription`.
[^resolver]: The program, `chunk-865at33z.js:25746` holds the resolver (`resolveToolDescription`, which answers `{ description, isDeferred }`). `chunk-bzyb60p0.js:109320` holds the request builder (`description` and `input_schema`).
[^tool-list]: The program, `chunk-bzyb60p0.js:217681`.
[^tool-offer]: The type file `schemas/claude-code.d.ts`, `tool.offer`. The program, `chunk-bzyb60p0.js:8664` (the input pass), `chunk-bzyb60p0.js:11308` (the core answer, `isOffered`), and `chunk-bzyb60p0.js:308129` (the call), and `chunk-bzyb60p0.js:210346` (the refusal message).
[^v328-command-run]: The type file `schemas/claude-code.d.ts`, `$.command.run`.
[^v328-check-origin]: The type file `schemas/claude-code.d.ts`, `tool.check`.
