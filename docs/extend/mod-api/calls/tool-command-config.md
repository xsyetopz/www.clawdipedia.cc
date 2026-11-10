---
title: Tool, Command, and Config
description: The $.tool, $.command, and $.config nouns that list, check, call, and register tools and slash commands, and change /config rows.
sidebar_position: 11
---

`$.tool` lists, checks, calls, and registers tools.
`$.command` does the same for slash commands.
`$.config` lists and sets the rows of the `/config` menu.
A hook on `tool.call` or `command.run` serves a tool or command that a mod registers.

A `deny` from a `tool.call`, `tool.check`, or `config.set` hook stops the action. A registered tool has the name `mcp__<plugin>__<name>`.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.314 program (`schemas/claude-code.d.ts`).
"Run time" appears in a "Where it can be used" cell. It means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

This mod adds a `/standup` command.

```javascript
on("session.start", async ($, e, next) => {
  await $.command.register({
    name: "standup",
    description: "Summarize what changed today",
    argumentHint: "[days]",
  });
  return next(e);
});
on("command.run", { command: "standup" }, async ($, e) => ({
  text: `Summary for ${e.args === "" ? "1" : e.args} day(s)`,
}));
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.tool.list` | <Documented /> | Returns the tools the model can call now, built-in and MCP, in the order the model sees them. | `() => Promise<ToolInfo[]>`. | Run time. |
| `$.tool.call` | <Documented /> | Calls a tool. It is the event `tool.call`, the same call the engine makes for the model, under a `tool_use_id` of its own. | Runs a tool through the hooks, the permission check, and the tool. Rejects for an unknown name or an aborted call. Since `2.1.321`, the call raises no permission prompt, also in `dontAsk` mode and in `-p` runs, and under an ask rule of yours. A deny rule and organization policy still apply. An ask that only a person can answer ends in a deny with the message `<Tool> wasn't run: this call needs a person's approval, and a mod's own call can't ask for it.` `$.tool.check` still reports the session's own verdict, so it can say `ask` for a call that runs. A hook that re-issues the model's call with `$.tool.call` answers for its input: the model's command runs with nobody asked (the type file `schemas/claude-code.d.ts`, `$.tool.call`; the program, `chunk-ne1755n5.js:1395203`, `:3209699`; [2.1.321 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.321)). Example: `await $.tool.call({ tool: "Read", file_path: "a.md" })`. | Run time. |
| `$.tool.check` | <Documented /> | Asks for the permission decision for a tool call now. It is the event `tool.check`. Resolves `{ decision, reason?, ... }`. | `(input: ToolCheckArgs) => Promise<ToolCheckResult>`. Nothing runs and no dialog opens. | Run time. |
| `$.tool.register` | <Documented /> | Declares a tool the model can call from the next prompt on: the name, description, and input schema of `mcp__<plugin>__<name>`. | `(tool: ToolSpec) => Promise<...>`. Serve it with a `tool.call` hook. A second registration of a name replaces the first. | After the session binds at `session.start` (rejects before). |
| `$.command.list` | <Documented /> | Returns the slash commands the person can run now, built-in, plugin, and MCP, in typeahead order. | `() => Promise<CommandInfo[]>`. | Run time. |
| `$.command.run` | <Documented /> | Runs a slash command as if the person typed `/command args`. It is the event `command.run`. It queues and runs once the session is idle. | `(input: CommandRunArgs) => Promise<CommandRunResult>`. Rejects an unknown name. | Run time. |
| `$.command.register` | <Documented /> | Declares the slash command `/<name>` for this session, listed in the typeahead from the next keystroke on. | `(command: CommandSpec) => Promise<...>`. Serve it with a `command.run` hook. The engine refuses a built-in's name. | Run time. |
| `$.config.list` | <Documented /> | Returns the rows the `/config` menu would draw now, in its order, each with its value, kind, owner, and lock. | `() => Promise<ConfigRow[]>`. Lists the rows after every `config.describe` hook. The list omits a hidden row. | Run time. |
| `$.config.set` | <Documented /> | Changes one row as if the person did in the menu. It is the event `config.set` with `origin` `{ kind: 'plugin', name }`. | `(input: ConfigSetArgs) => Promise<ConfigSetResult>`. Resolves `{ value }` or `{ deny }`. Rejects a key that no row has. | Run time. |

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `tool.call` | <Documented /> | Fires when the engine is about to run a tool. Each `next(e)` runs the hooks beneath, then core (the permission prompt, the tool). | Input `ToolCallInput`. Result `{ result, context? }` or `{ deny }`. `{ deny: reason }` refuses the call. The engine skips a guard that fails, and the tool runs. | `on('tool.call', ...)`. Also `$.tool.call(...)`. |
| `tool.check` | <Documented /> | Fires when the engine decides whether a tool call may run, after the `tool.call` and `PreToolUse` hooks and before the mode settles an ask. | Input `ToolCheckInput`, which carries `isReadOnly` when the call is read-only (new in 2.1.304) and, since 2.1.307, `approver`, who can answer an ask. Result `{ decision, reason?, ... }`. Since 2.1.307 an ask that a hook makes goes to a person, and the engine marks it with `plugin`: only the permission dialog, a host's callback, or a `PermissionRequest` hook can approve it, and where nobody can be asked (`dontAsk` mode, avoid-prompts, headless) it is refused with the mod's reason. The 2.1.304 `decider: "person"` field is still read but is no longer in the type file. `next(e)` gives the engine's verdict. Since `2.1.321`, `$.tool.check` still reports the session's own verdict, so it can say `ask` for a call that `$.tool.call` then runs, because that call opens no dialog and asks no classifier (type file; the program, `chunk-ne1755n5.js:1395203`, `chunk-ne1755n5.js:3209699`). A guard that fails is skipped, so add a `.catch`. | `on('tool.check', ...)`. Also `$.tool.check(...)`. |
| `tool.describe` | <Documented /> | Fires when the engine first renders the tool's schema in a session. `next(e)` resolves to `{ description, isDeferred? }`. | Input `ToolDescribeInput`. The engine caches the answer until `$.ui.invalidate("tool.describe")`. When a tool is asked again, the hook's text goes over the description that the engine recorded for the tool, where the two differ, only when its answer says `breakPromptCache: true` (since `2.1.321`; until `2.1.319` it went over it always). Without `breakPromptCache`, a changed description waits for a new thread or a compaction, and a changed placement for a new thread or `/clear`. With no hook, the engine keeps its own text and `isDeferred` (the program, `chunk-qfakytpa.js@538061`, `resolveToolDescription`). The engine marks a tool as rewritten when the hook text differs from its own after normalization. An invalidation clears the cached answers and starts a new redescribe epoch once a tool was described. | `on('tool.describe', ...)`. In tests: `$.tool.describe(...)` on the test engine (not on a hook's `$`). |
| `command.run` | <Documented /> | Fires when a slash command is about to run. `next(e)` resolves to `{ text }`, its output. | Input `CommandRunInput`. Rewrite `args` with `next`, or return `{ text }` to answer in its place. | `on('command.run', ...)`. Also `$.command.run(...)`. |
| `command.describe` | <Documented /> | Fires once for each command, when the engine lists it for the typeahead and `/help`. `next(e)` resolves to `{ description, argumentHint, isHidden }`. | Input `CommandDescribeInput`. The engine caches it for the session until `$.ui.invalidate("command.describe")`. | `on('command.describe', ...)`. In tests: `$.command.describe(...)` on the test engine (not on a hook's `$`). |
| `config.set` | <Documented /> | Fires when a `/config` row is about to change, from the menu or a plugin's `$.config.set`. `next(e)` resolves to `{ value }` once written. | Input `ConfigSetInput`. Result `{ value }` or `{ deny }`. `{ deny: reason }` leaves the row as it is. The engine refuses a value of the wrong kind. | `on('config.set', ...)`. Also `$.config.set(...)`. |
| `config.describe` | <Documented /> | Fires once for each `/config` row, when the menu lists it and for `$.config.list`. `next(e)` resolves to `{ label, description, isHidden }`. | Input `ConfigDescribeInput`. The engine caches it until `$.ui.invalidate("config.describe")`. | `on('config.describe', ...)`. In tests: `$.config.describe(...)` on the test engine (not on a hook's `$`). |

## How `tool.describe` Resolves a Description

Source: the program in 2.1.316. `chunk-qfakytpa.js` holds the resolver. `chunk-ne1755n5.js` holds the request builder.

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
| `tool.list` | <Documented /> | `$.tool.list()` | Input `NoArgs`. Value `ToolInfo[]`. |
| `tool.register` | <Documented /> | `$.tool.register(spec)` | Input `RegisteredToolSpec`. Value `{ tool: string }`. |
| `command.list` | <Documented /> | `$.command.list()` | Input `NoArgs`. Value `CommandInfo[]`. |
| `command.register` | <Documented /> | `$.command.register(spec)` | Input `CommandSpec`. Value `{ command: string }`. |
| `config.list` | <Documented /> | `$.config.list()` | Input `NoArgs`. Value `ConfigRow[]`. |

## Related Pages

- [Mod API Overview](../index.md)
- [Turn and Prompt](turn-prompt.md)
- [Tool, Command, and Config Types](../types/tool-command-config/index.md) (tool call, check, command, and config types)
