---
title: Agent
description: The $.agent noun that starts, lists, and registers subagents, the agent.offer and agent.spawn events, and the agent types.
sidebar_position: 12
---

`$.agent` starts and lists subagents and teammates, and it registers new agent types.
`agent.offer` decides which agent types the model sees.
`agent.spawn` picks the model of a new agent or refuses it.

Return `{ isOffered: false }` or `{ deny }` from a hook to turn something off. Hook `agent.spawn` to pick a model or refuse. Hook `agent.offer` to hide a type.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.323 program (`schemas/claude-code.d.ts`).
"Run time" appears in a "Where it can be used" cell. It means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

This hook sends every subagent that does not name a model to `haiku`.

```javascript
on("agent.spawn", async ($, e, next) =>
  next(e.model ? e : { ...e, model: "haiku" }),
);
```

## Members of the Agent Noun

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.agent.spawn` | <Documented /> | Spawns a subagent. It is the event `agent.spawn`, the same call the engine makes when the Agent tool starts one. | `(input: AgentSpawnArgs) => Promise<AgentSpawnResult>`. Starts a subagent in the background and resolves `{ model, agentId }` or `{ deny }`. | Run time. |
| `$.agent.list` | <Documented /> | Returns the agents of the session so far, subagents and teammates, whoever spawned them. | `() => Promise<AgentInfo[]>`. One entry for each agent until the engine drops its task. The list omits a workflow's agents. | Run time. |
| `$.agent.register` | <Documented /> | Defines an agent type, named `<plugin>:<name>`, that the Agent tool dispatches from the next turn on. | `(spec: AgentSpec) => Promise<...>`. Takes the same fields as an agent file. A second call with the same name replaces the first. Rejects on an invalid spec. | After the session binds at `session.start` (rejects before). |

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `agent.offer` | <Documented /> | Fires when the engine offers an agent type to the model, in the agent listing and again at dispatch. `next(e)` resolves to `{ isOffered: true }`. | Input `AgentOfferInput`. Result `AgentOfferResult`. Return `{ isOffered: false }` to hide the type from the model and refuse its dispatch. A hook that refuses, or a `{ deny }` result, gives `{ isOffered: false }` (the program, `chunk-s82q53mp.js@75367`). The engine checks that the hook kept `agent`, `description`, and `source` and did not change `provider` (`chunk-s82q53mp.js@193506`). | `on('agent.offer', ...)`. In tests: `$.agent.offer(...)` on the test engine (not on a hook's `$`). |
| `agent.spawn` | <Documented /> | Fires when the Agent tool, or a workflow script's `agent()` call, is about to start an agent, before the engine resolves the model. | Input `AgentSpawnInput`. Result `AgentSpawnResult`: `{ model }` or `{ deny }`. The engine skips a guard that fails, and the subagent starts. | `on('agent.spawn', ...)`. Also `$.agent.spawn(...)`. |

## Events Raised by Agent Calls

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `agent.list` | <Documented /> | The argument of `$.agent.list()`. | Input `NoArgs`. Value `AgentInfo[]`. A hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`. | `on('agent.list', ...)` |
| `agent.register` | <Documented /> | The argument of `$.agent.register(spec)`. A hook above can rewrite any of it, but the type stays the caller's. | Input `AgentSpec`. Value `{ agent: string }`. | `on('agent.register', ...)` |

## Listing Cost of an Agent

Each agent the model can use adds its listing line to the request. A run of 2.1.316 against a local stub added one project agent file with a 1000-character `description`. The `messages` text grew from 10011 to 11042 characters, 1031 more. The `Agent` tool description stayed at 3227 characters. So the listing is in `messages` and not in the tool description, and a long `description` costs its length on every session.
A `agent.offer` hook that returns `{ isOffered: false }` hides the type from the listing, so it saves those characters. This run did not load a mod, so the saving is not measured here.

## Agent Types

### Call Records and Status

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentCallRecord` | <Documented /> | What an Agent call raised by a plugin (`$.tool.call({ tool: "Agent", ... })`) answers as `result` once the agent settles. `text` is its final answer. | Fields `agentId` (as `$.agent.list()` names it) and `resolvedModel?`. A plugin's spawn always runs in the background. |
| `AgentStatus` | <Documented /> | Where an agent's loop stands. | `'pending' \| 'running' \| 'waiting' \| 'idle' \| 'completed' \| 'failed' \| 'killed'`. `idle` means between turns until a message wakes it. A message may resume an ended agent under the same id. |
| `AgentLoop` | <Documented /> | Which model loop an event happened in. | Field `agentId?`: the loop's agent id inside a subagent or teammate, absent on the main loop. Pinned. `next.origin` names the plugin that caused the call. |
| `AgentTeammateRecord` | <Documented /> | What an Agent call that started a teammate answers as `result`. | `status` (`'teammate_spawned'`), `agentId?`, `agent_id` (older spelling), `teammate_id`, `name` (any `@` replaced, with a suffix such as `scout-2` when taken), `team_name?`, `agent_type?`, `resolvedModel?`, `model?`, `prompt`. |

### What `$.agent.list()` Returns

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentInfo.id` | <Documented /> | The agent's one id. | `string`. The Agent tool calls it `agentId`. The classic events call it `agent_id`. A teammate in its own terminal pane uses its address as the id. |
| `AgentInfo.teammateId` | <Documented /> | A teammate's address in its team, `<name>@<team>`. | `string`, optional. Absent for other agents. |
| `AgentInfo.description` | <Documented /> | The Agent call's short `description` of the task. | `string`. |
| `AgentInfo.type` | <Documented /> | The agent type it was spawned as (`general-purpose`, `Explore`), or `teammate`. | `string`. |
| `AgentInfo.status` | <Documented /> | Where its loop stands now. | `AgentStatus`. |
| `AgentInfo.parentId` | <Documented /> | The id of the agent whose loop spawned it. | `string`, optional. Absent when the main loop did. |
| `AgentInfo.spawnedBy` | <Documented /> | The plugin whose `$.agent.spawn` (or Agent `$.tool.call`) started it. | `string`, optional. Absent when the model or the person did. |
| `AgentInfo.name` | <Documented /> | What SendMessage addresses it by, when it has one. | `string`, optional. Two agents may hold one name. `id` tells them apart. |

### Offer Types

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentOfferInput.agent` | <Documented /> | Which type (`Explore`, `Plan`, a plugin's agent). It is the key a matcher narrows on. | `string`. |
| `AgentOfferInput.description` | <Documented /> | The text of its listing line (`whenToUse`). | `string`. |
| `AgentOfferInput.source` | <Documented /> | Where the definition came from (`built-in`, `plugin`, a settings source). | `string`. |
| `AgentOfferInput.provider` | <Documented /> | Who provides this agent: the plugin and its tier. A built-in is `{ plugin: "engine", tier: "core" }`. | `Origin`. Pinned. |
| `AgentOfferResult.isOffered` | <Documented /> | Whether the engine offers the type to the model, in its listing and at dispatch. | `boolean`. |

### Spawn Types

`AgentSpawnArgs` is the input of the call: the `prompt` field of `AgentSpawnInput` plus optional `description`, `subagentType`, `model`, `name`, and `cwd`.
A hook may rewrite the content keys of `AgentSpawnInput`. The type pins every other key.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentSpawnInput.tool_use_id` | <Documented /> | The Agent tool call this spawn belongs to. Pinned. | `string`. For a workflow agent it is the Workflow tool call that started the run. |
| `AgentSpawnInput.prompt` | <Documented /> | The task the subagent gets. A rewrite is the prompt it runs with. | `string`. On a workflow run that hides its script, it is a placeholder. The engine does not apply a rewrite. |
| `AgentSpawnInput.description` | <Documented /> | The short description of the task. A rewrite is what the task shows as. | `string`. |
| `AgentSpawnInput.subagentType` | <Documented /> | The resolved agent type (`general-purpose`, `Explore`, a plugin's agent, `fork`). | `string`. A name that matches no agent refuses the spawn. |
| `AgentSpawnInput.provider` | <Documented /> | Who provides this agent. Pinned. | `Origin`. |
| `AgentSpawnInput.model` | <Documented /> | The Agent tool's `model` parameter as given, an alias (`haiku`) or a full id. | `string`, optional. A hook sets it to pick the model. Forks inherit the model, so the engine ignores it for them. |
| `AgentSpawnInput.parentModel` | <Documented /> | The parent's effective model, what `inherit` resolves to. Pinned. | `string`. |
| `AgentSpawnInput.parentAgentId` | <Documented /> | The id of the loop the spawn happens in. Pinned. | `string`, optional. Absent from main. |
| `AgentSpawnInput.permissionMode` | <Documented /> | The parent's permission mode, which the subagent inherits. Pinned. | `string`, optional. |
| `AgentSpawnInput.background` | <Documented /> | True when the subagent runs in the background or remotely. | `boolean`. The agent definition or remote isolation can force it on. Disabled background tasks force it off. A teammate's is always true. |
| `AgentSpawnInput.fork` | <Documented /> | True for a fork of the parent. It inherits the parent's context and model. Pinned. | `boolean`. |
| `AgentSpawnInput.isTeammate` | <Documented /> | Present and true when the call starts a teammate. Pinned. | `true`, optional. A teammate is a named agent of the session's team. It goes idle between turns and wakes on a message. |
| `AgentSpawnInput.workflow` | <Documented /> | Present when a workflow script's `agent()` starts the agent. Pinned. | `object`, optional. A hook may rewrite `prompt` and `model` only. A deny becomes the error that the script's `agent()` throws. |
| `AgentSpawnInput.resume` | <Documented /> | Present when the run resumes a subagent or brings a teammate back from disk. | `object`, optional. A hook can only refuse it. A deny leaves the agent parked. |
| `AgentSpawnInput.name` | <Documented /> | The name given by the call, which SendMessage can address. Pinned. | `string`, optional. A teammate whose name the team already has gets a suffix. |
| `AgentSpawnInput.cwd` | <Documented /> | The directory the subagent runs in, when the call set one. A rewrite is where it runs. | `string`, optional. A teammate runs in the session's directory. |
| `AgentSpawnResult.model` | <Documented /> | What the subagent runs on. | `string`. From core it is the resolved id. From a hook it can be an alias or an id. |
| `AgentSpawnResult.agentId` | <Documented /> | The id of the started subagent. | `string`, optional. Core sets it. A hook that answers without `next` started none. |
| `AgentSpawnResult.teammateId` | <Documented /> | A started teammate's address, `<name>@<team>`. | `string`, optional. Core sets it. |
| `AgentSpawnResult.deny` | <Documented /> | Refuses the spawn, so nothing starts. | `string`. The text is the Agent tool's error, or the error a workflow's `agent()` call throws. If a hook returns it after `next(e)` answered, the hook fails. |

`AgentSpawnResult` is either `{ model, agentId, teammateId? }` or `{ deny }`. The answer of the subagent comes in its own `turn.complete` with this `agentId`.

### Agent Spec

`AgentSpec` is what `$.agent.register` takes. It is an agent definition as spelled in settings JSON, plus a `name`. It accepts every field that an agent file or a `--agents` entry accepts.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentSpec.name` | <Documented /> | The short name of the type. The type is `<plugin>:<name>`. | `string`. Letters, digits, `_`, `-`, up to 64. |
| `AgentSpec.description` | <Documented /> | When to delegate to this agent. The model reads it in its listing, and `agent.offer` gets it. | `string`. |
| `AgentSpec.prompt` | <Documented /> | The agent's system prompt, whole. It replaces the session's. | `string`. |
| `AgentSpec.tools` | <Documented /> | What the agent may call, by tool name (`Read`, `Bash`, `mcp__x__y`). The engine refuses a call to any other. Left out means every tool of the parent. | `readonly string[]`, optional. |
| `AgentSpec.disallowedTools` | <Documented /> | Tools withheld from the agent, out of whatever `tools` allows. | `readonly string[]`, optional. |
| `AgentSpec.model` | <Documented /> | The agent's model: an alias (`haiku`, `sonnet`, `opus`), a full id, or `inherit`. Left out means the session's subagent default. | `string`, optional. |
| `AgentSpec.effort` | <Documented /> | The agent's effort: `low`, `medium`, `high`, `xhigh`, `max`, or an integer budget. | `string \| number`, optional. |
| `AgentSpec.permissionMode` | <Documented /> | The agent's permission mode, which decides its permission asks: `default`, `acceptEdits`, `plan`, `auto`, `dontAsk`, or `bypassPermissions`. Left out means the parent's. | `string`, optional. |
| `AgentSpec.mcpServers` | <Documented /> | Servers connected over MCP for the agent's run: a configured server's name, or one server's config inline. | `readonly (string \| Record<string, unknown>)[]`, optional. |
| `AgentSpec.hooks` | <Documented /> | Settings hooks in force while the agent runs, in the `hooks` shape of `settings.json`. | `Record<string, unknown>`, optional. |
| `AgentSpec.maxTurns` | <Documented /> | The most turns the agent takes before it stops. | `number`, optional. |
| `AgentSpec.autoCompactWindow` | <Documented /> | Token count, 100000 to 1000000, at which the agent compacts its own conversation. It only lowers the window. | `number`, optional. |
| `AgentSpec.skills` | <Documented /> | Skill names preloaded into the agent's context before its first turn. | `readonly string[]`, optional. |
| `AgentSpec.initialPrompt` | <Documented /> | The agent's first user turn. `{{intent}}` in it takes the spawn's prompt. Left out means the spawn's prompt is the first turn. | `string`, optional. |
| `AgentSpec.memory` | <Documented /> | A persistent memory the agent keeps between runs, and where. | `'user' \| 'project' \| 'local'`, optional. |
| `AgentSpec.background` | <Documented /> | Every spawn of the agent runs in the background. | `true`, optional. |
| `AgentSpec.omitClaudeMd` | <Documented /> | The agent's context carries no CLAUDE.md block. | `true`, optional. |
| `AgentSpec.isolation` | <Documented /> | Where the agent runs apart from the session: `worktree` (its own git worktree) or `remote` (a cloud session where the build allows one). | `'worktree' \| 'remote'`, optional. |

## Related Pages

- [Mod API Overview](../index.md)
- [Session](session.md)
- [Tool, Command, and Config](tool-command-config.md)
