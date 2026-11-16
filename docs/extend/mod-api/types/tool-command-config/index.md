---
title: Tool, Command, and Config Types
description: "Types behind $.tool, $.command, and $.config: tool calls, permission checks, command runs, and /config rows."
sidebar_position: 9
---

These are the types behind `$.tool`, `$.command`, and `$.config`. They describe a tool call, a permission check, a command run, and a row of the `/config` menu.

Use them to type the values that these calls return and that their hooks receive. Each type has a field table on one of the two pages below, or a row in the last table of this page.

## Pages

| Page | What is in it |
| --- | --- |
| [Command, Config, and Registered Tool Types](command-config.md) | `BuiltinToolCallInput` to `RegisteredToolSpec`: built-in tool calls, command types, `/config` row types, and registered tool specs. |
| [Tool Call, Check, and Describe Types](tool-calls.md) | `ToolCallReserved` to `ToolUseSummary`: tool call results, permission checks, descriptions, envelopes, and summaries. |

## Example

The first call asks the permission system about a tool call. The second call reads the messages of the subagent that made a tool use.

```ts
const { decision } = await $.tool.check({ tool: "Read", input });
if (use.agentId) {
  child = await $.session.messages({ agentId: use.agentId });
}
```

## Types without Fields

These types are aliases or unions, so they have no field tables. Each row gives the use of the type and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `BuiltinToolInputs` | <Documented /> | The arguments of each built-in tool by name, for declaration merging. It is empty until a declaration file adds entries. Then `e.tool === "Bash"` narrows `e` to the arguments of `Bash`. | Interface. The engine places the set for this build beside each mod that it loads (`claude-code-tools/index.d.ts`), built from the input schema of each tool. |
| `BuiltinToolName` | <Documented /> | The names of the built-in tools. | Alias of `keyof BuiltinToolInputs & string`. |
| `BuiltinToolResults` | <Documented /> | The structured result of each built-in tool by name, for declaration merging. It is empty until a declaration file adds entries. Then, after `e.tool === "Bash"`, the `result` of `next(e)` is the record of `Bash`. | Interface. The engine places the set for this build beside each mod that it loads (`claude-code-tools/index.d.ts`), built from the output schema of each tool. A tool without an output schema has the type `unknown`. |
| `CommandDescribeResult` | <Documented /> | What a `command.describe` hook returns: the description, the hint, and the hidden flag that the menu uses. The name, `immediate`, and `provider` stay as they were. | Alias of `Omit<CommandDescribeInput, 'command' \| 'immediate' \| 'provider'>`. Used by `command.describe` and `$.command.describe`. |
| `CommandSource` | <Documented /> | Where a slash command comes from. `$.command.list()` uses it to tell commands apart. | Alias of `'builtin' \| 'plugin' \| 'user' \| 'mcp'`. `builtin` ships with Claude Code. `user` is a file of the user or the project. |
| `ConfigDescribeResult` | <Documented /> | What a `config.describe` hook returns: the label, the help text, and the hidden flag that the menu uses. The key and the provider stay as they were. | Alias of `Omit<ConfigDescribeInput, 'key' \| 'provider'>`. Used by `config.describe` and `$.config.describe`. |
| `ConfigKind` | <Documented /> | How a `/config` row takes its value. `boolean` toggles. `choice` picks one of its `options`. `text` takes a string. `number` takes a number. | Alias of `'boolean' \| 'choice' \| 'text' \| 'number'`. |
| `ConfigSetArgs` | <Documented /> | The input of `config.set` as the `$.config.set(args)` call of a plugin takes it: the key of the row and the value. The engine fills in the rest. | Alias of `Pick<ConfigSetInput, 'key' \| 'value'>`. Used by `$.config.set`. |
| `ConfigValue` | <Documented /> | The value of a `/config` row as a hook and `$.config` see it. It is a boolean (toggle), a string (choice or text), a number, or a list of strings. | Alias of `boolean \| string \| number \| readonly string[]`. |
| `ToolCallArgs` | <Documented /> | The input of `tool.call` as the call takes it. `tool_use_id` and `agentId` may come with it (a hook that passes on the input of its event), and the call drops them. | Alias of `ToolCallEnvelope extends infer I ? I extends ToolCallEnvelope ? Omit<I, 'tool_use_id'> & ToolCallReserved<I['tool']> : never : never`. The run gets its own id and runs in the loop of the session. |
| `ToolCallEnvelope` | <Documented /> | The envelope that the two tool events share. It has the tool, the id of this call, and the arguments of the tool spread beside them (`e.command` for `Bash`). | Alias of `BuiltinToolCallInput \| McpToolCallInput`. A union keyed by `tool`. After `if (e.tool === "Bash")`, `e.command` is a string. |
| `ToolCallInput` | <Documented /> | The input of `tool.call`: the tool, the id of this call, the arguments of the tool beside them (`e.command` for `Bash`), and `agentId` in a subagent. | Alias of `ToolCallEnvelope & AgentLoop & ToolRequestMeta`. `tool`, `tool_use_id`, and `agentId` are reserved. The engine refuses a rewrite of any of them. Used by `tool.call`. |
| `ToolCallOverloads` | <Documented /> | `$.tool.call(input)`. It resolves with a `result` typed for the tool that `input` names (`ToolCallResult`). For an input that does not name a tool as a literal, the type is loose. | Alias of `{ <T extends string>(input: ToolCallArgs & ToolNamed<T>): Promise<ToolCallResult<T>>, (input: ToolCallArgs): Promise<ToolCallResult>, }`. Used by `$.tool.call`. |
| `ToolCheckArgs` | <Documented /> | The input of `tool.check` as `$.tool.check` takes it: the tool and its arguments. The engine sets the id of the call, `agentId`, the ceiling, the approver, and `isReadOnly`. | Alias of `Pick<ToolCheckInput, 'tool' \| 'input'>`. Used by `$.tool.check`. |
| `ToolCheckApprover` | <Documented /> | Who answers the asks of a `tool.check` evaluation. `host` is the program that answers the asks of a hosted session, or the asks of a served call's own session. `person` is a dialog or a card that a person answers. New in 2.1.307. It replaces `ToolCheckDecider`. | Alias of `'host' \| 'person'`. Used by `ToolCheckInput.approver`. |
| `ToolCheckDecision` | <Documented /> | The verdict of `tool.check`: run the tool, refuse it, or put it to a decider. The decider is the decider of the mode (the dialog, the auto-mode classifier, or a headless host). For the ask of a hook, it is a person. | Alias of `'allow' \| 'ask' \| 'deny'`. |
| `ToolDeferral` | <Documented /> | Where a `tool.describe` answer places the tool. `true` places it behind `ToolSearch`, so its schema loads when the model asks for it. `false` places it in the list of the prompt. | Alias of `boolean`. When an answer leaves it out, the placement beneath stands. |
| `ToolResultOf` | <Documented /> | The structured result of the tool named `Name`. It is the `BuiltinToolResults` entry for a built-in tool, and `unknown` for any other tool. | Alias of the result type of a tool by name. `Agent` also allows a teammate or call record. `unknown` covers an MCP tool or an unknown name. |

## Related Pages

- [Mod API Overview](../../index.md)
- [Tool, Command, and Config](../../calls/tool-command-config.md)
- [Agent](../../calls/agent.md)
- [Mod API Types](../index.md)
