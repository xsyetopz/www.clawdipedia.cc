---
title: Tool, Command, and Config Types
description: "Types behind $.tool, $.command, and $.config: tool calls, permission checks, command runs, and /config rows."
sidebar_position: 9
---

These are the types behind `$.tool`, `$.command`, and `$.config`.
They describe a tool call, a permission check, a command run, and a row of the `/config` menu.

## Pages

| Page | What is in it |
| --- | --- |
| [Command, Config, and Registered Tool Types](command-config.md) | `BuiltinToolCallInput` to `RegisteredToolSpec`: built-in tool calls, command types, `/config` row types, and registered tool specs. |
| [Tool Call, Check, and Describe Types](tool-calls.md) | `ToolCallReserved` to `ToolUseSummary`: tool call results, permission checks, descriptions, envelopes, and summaries. |

## Example

The first call asks the permission system about a tool call. The second line reads the messages of a subagent that made a tool use.

```ts
const { decision } = await $.tool.check({ tool: "Read", input });
if (use.agentId) {
  child = await $.session.messages({ agentId: use.agentId });
}
```

## Types without Fields

These types are aliases, unions, or plain shapes. Each row gives its use and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `BuiltinToolInputs` | <Documented /> | The arguments of each built-in tool by name, for declaration merging. It is empty until a declaration file adds entries. Then `e.tool === "Bash"` narrows `e` to the arguments of Bash. | Interface. The engine lays the set of this build beside a mod that it loads (claude-code-tools/index.d.ts), from the input schema of each tool. |
| `BuiltinToolName` | <Documented /> | The names of the built-in tools. | Alias of `keyof BuiltinToolInputs & string`. |
| `BuiltinToolResults` | <Documented /> | The structured result of each built-in tool by name, for declaration merging. It is empty until a declaration file adds entries. Then after `e.tool === "Bash"` the `result` of `next(e)` is the record of Bash. | Interface. The engine lays the set of this build beside a mod that it loads (claude-code-tools/index.d.ts), from the output schema of each tool. A tool without one is `unknown`. |
| `CommandDescribeResult` | <Documented /> | What a `command.describe` hook returns: the description, hint and hidden flag that the menu uses. The name, `immediate` and `provider` stay as they were. | Alias of `Omit<CommandDescribeInput, 'command' \| 'immediate' \| 'provider'>`. Used by `command.describe`, `$.command.describe`. |
| `CommandSource` | <Documented /> | Where a slash command comes from, as `$.command.list()` tells them apart. | Alias of `'builtin' \| 'plugin' \| 'user' \| 'mcp'`. `builtin` ships with Claude Code. `user` is the own file of the person or project. |
| `ConfigDescribeResult` | <Documented /> | What a `config.describe` hook returns: the label, help text and hidden flag that the menu uses. The key and provider stay as they were. | Alias of `Omit<ConfigDescribeInput, 'key' \| 'provider'>`. Used by `config.describe`, `$.config.describe`. |
| `ConfigKind` | <Documented /> | How a `/config` row takes its value: `boolean` toggles, `choice` picks one of its `options`, `text` takes a string, `number` a number. | Alias of `'boolean' \| 'choice' \| 'text' \| 'number'`. |
| `ConfigSetArgs` | <Documented /> | The input of `config.set` as the `$.config.set(args)` of a plugin takes it: the key of the row and the value. The engine fills the rest. | Alias of `Pick<ConfigSetInput, 'key' \| 'value'>`. Used by `$.config.set`. |
| `ConfigValue` | <Documented /> | The value of a `/config` row as a hook and `$.config` see it. It is a boolean (toggle), a string (choice or text), a number, or a list of strings. | Alias of `boolean \| string \| number \| readonly string[]`. |
| `ToolCallArgs` | <Documented /> | The input of `tool.call` as the call takes it. `tool_use_id` and `agentId` may ride along (a hook that passes the input of its event on) and the call drops them. | Alias of `ToolCallEnvelope extends infer I ? I extends ToolCallEnvelope ? Omit<I, 'tool_use_id'> & ToolCallReserved<I['tool']> : never : never`. The run gets its own id and runs in the loop of the session. |
| `ToolCallEnvelope` | <Documented /> | The envelope that the two tool events share. It has the tool, the id of this call, and the arguments of the tool spread beside them (`e.command` for Bash). | Alias of `BuiltinToolCallInput \| McpToolCallInput`. A union keyed by `tool`. After `if (e.tool === "Bash")`, `e.command` is a string. |
| `ToolCallInput` | <Documented /> | The input of `tool.call`: the tool, the id of this call, the arguments of the tool beside them (`e.command` for Bash), and `agentId` in a subagent. | Alias of `ToolCallEnvelope & AgentLoop & ToolRequestMeta`. `tool`, `tool_use_id`, and `agentId` are reserved. A rewrite of any is refused. Used by `tool.call`. |
| `ToolCallOverloads` | <Documented /> | `$.tool.call(input)`: resolves with `result` typed for the tool that `input` names (ToolCallResult), or loosely for an input that names none literally. | Alias of `{ <T extends string>(input: ToolCallArgs & ToolNamed<T>): Promise<ToolCallResult<T>>, (input: ToolCallArgs): Promise<ToolCallResult>, }`. Used by `$.tool.call`. |
| `ToolCheckArgs` | <Documented /> | The input of `tool.check` as `$.tool.check` takes it: the tool and its arguments. The engine sets the id of the call, `agentId`, the ceiling, the approver, and `isReadOnly`. | Alias of `Pick<ToolCheckInput, 'tool' \| 'input'>`. Used by `$.tool.check`. |
| `ToolCheckApprover` | <Documented /> | Who answers the asks of a `tool.check` evaluation: `host`, the program that answers a hosted session's asks or a served call's own session, or `person`, a dialog or a card the person answers (new in 2.1.307, replaces `ToolCheckDecider`). | Alias of `'host' \| 'person'`. Used by `ToolCheckInput.approver`. |
| `ToolCheckDecision` | <Documented /> | The verdict of `tool.check`: run the tool, refuse it, or put it to a decider. The decider is the decider of the mode (the dialog, the auto-mode classifier, a headless host). For the ask of a hook, it is a person. | Alias of `'allow' \| 'ask' \| 'deny'`. |
| `ToolDeferral` | <Documented /> | Where a `tool.describe` answer places the tool: `true` behind ToolSearch (its schema loads when the model asks for it), `false` in the list of the prompt. | Alias of `boolean`. Left out of an answer, the placement beneath stands. |
| `ToolResultOf` | <Documented /> | The structured result of the tool named `Name`: its BuiltinToolResults entry for a built-in tool, else `unknown`. | Alias of the result type of a tool by name. `Agent` also allows a teammate or call record. `unknown` covers an MCP tool or an unknown name. |

## Related Pages

- [Mod API Overview](../../index.md)
- [Tool, Command, and Config](../../calls/tool-command-config.md)
- [Agent](../../calls/agent.md)
- [Mod API Types](../index.md)
