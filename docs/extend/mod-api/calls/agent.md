---
title: Agent
description: The $.agent noun that starts, lists, and registers subagents, the agent.offer and agent.spawn events, and the agent types.
sidebar_position: 12
---

`$.agent` starts and lists subagents and teammates, and it registers new agent types. Two events cover the life of an agent. `agent.offer` decides which agent types the model sees. `agent.spawn` picks the model of a new agent or refuses it.

Use a hook to change what agents do. Hook `agent.spawn` to pick a model or refuse a spawn. Hook `agent.offer` to hide a type. Return `{ deny }` to refuse a spawn, or `{ isOffered: false }` to hide a type.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types]

"Run time" in a "Where it can be used" cell means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

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
| `$.agent.call` | <Documented /> | Since `2.1.326`, runs a tool as an agent's own call. It is the event `agent.call`, and `tool.call` runs beneath it in the loop of that agent. `$.tool.call` is unchanged. | `(args: AgentCallArgs, options?: AgentCallOptions) => Promise<...>`. `args` holds `tool`, `input`, and `agentId` (absent: the main conversation). The call has the tools, folder, mode, and rules of the agent. It meets the hooks, the dialog, and the classifier of auto mode as a call of the model does. Nothing joins the conversation of the agent. Resolves the tool's result, or `{ deny }` for a refusal, a tool the agent lacks, an agent the session cannot run from, or a cut by `options.signal`. Rejects on a deny from an `agent.call` hook. `Workflow` is refused.[^call-workflow] | Run time. |
| `$.agent.limits` | <Documented /> | Since `2.1.326`, returns the bounds the agents of the session run under: how many may run at once, how deep they may nest, and whether they may run in the background. | `() => Promise<AgentLimits>`. Resolves `{ concurrent, depth, isBackgroundEnabled }`, read at each call and the same for every plugin.[^limits] `concurrent` follows `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`, 20 unless set. `depth` follows `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. | Run time. |

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `agent.offer` | <Documented /> | Fires when the engine offers an agent type to the model, in the agent listing and again at dispatch. `next(e)` resolves to `{ isOffered: true }`. | Input `AgentOfferInput`. Result `AgentOfferResult`. Return `{ isOffered: false }` to hide the type from the model and refuse its dispatch. A hook that refuses, or a `{ deny }` result, gives `{ isOffered: false }`.[^offer-refuse] The engine checks that the hook kept `agent`, `description`, and `source` and did not change `provider`.[^offer-check] | `on('agent.offer', ...)`. In tests: `$.agent.offer(...)` on the test engine (not on a hook's `$`). |
| `agent.spawn` | <Documented /> | Fires when the Agent tool, or a workflow script's `agent()` call, is about to start an agent, before the engine resolves the model. | Input `AgentSpawnInput`. Result `AgentSpawnResult`: `{ model }` or `{ deny }`. The engine skips a guard that fails, and the subagent starts. | `on('agent.spawn', ...)`. Also `$.agent.spawn(...)`. |

## Events Raised by Agent Calls

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `agent.list` | <Documented /> | The argument of `$.agent.list()`. | Input `NoArgs`. Value `AgentInfo[]`. A hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`. | `on('agent.list', ...)` |
| `agent.call` | <Documented /> | `$.agent.call(args, options)`. Since `2.1.326`, a hook above the caller reads the abort signal of the call as `next.signal`. | Input `AgentCallArgs`. Value `ToolCallResult`. | `on('agent.call', ...)` |
| `agent.limits` | <Documented /> | `$.agent.limits()` | Input `NoArgs`. Value `AgentLimits`. | `on('agent.limits', ...)` |
| `agent.register` | <Documented /> | The argument of `$.agent.register(spec)`. A hook above can rewrite any of it, but the type stays the caller's. | Input `AgentSpec`. Value `{ agent: string }`. | `on('agent.register', ...)` |

## Listing Cost of an Agent

Each agent the model can use adds its listing line to the request. A run of `2.1.316` against a local stub added one project agent file with a 1000-character `description`. The `messages` text grew from 10011 to 11042 characters, 1031 more. The `Agent` tool description stayed at 3227 characters. So the listing is in `messages` and not in the tool description, and a long `description` costs its length on every session.
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
| `AgentInfo.kind` | <Documented /> | Since `2.1.326`, which kind of task the engine keeps it as. | `'local_agent'` for every subagent, whatever its `type`, or `'in_process_teammate'` [^kind] |
| `AgentInfo.taskStatus` | <Documented /> | Since `2.1.326`, the task's own status, as the engine stores it, before `status` tells `waiting` and `idle` apart. | `'pending' \| 'running' \| 'completed' \| 'failed' \| 'killed' \| 'paused'`. A subagent that ended its turn is `completed` here. A teammate between turns is `running`. |
| `AgentInfo.label`, `startTime`, `cwd` | <Documented /> | Since `2.1.326`, what the agent is doing, when it started, and the folder it works in. | `label` is the latest progress summary as stored, else `description`. `startTime` is in milliseconds since the epoch. `cwd` is the agent's own folder (a worktree), else the folder of the session. |
| `AgentInfo.model`, `effort`, `contextWindowSize` | <Documented /> | Since `2.1.326`, the model the agent runs on, the effort set for it, and the context window of that model in tokens. | All optional. `model` is absent where the engine has none, such as a teammate in a pane of its own. `effort` is a level or a number as written. A request may carry less (`lastRequest`). |
| `AgentInfo.tokenCount`, `tokenSamples` | <Documented /> | Since `2.1.326`, the tokens the agent has used, and its last 16 readings. | `tokenCount` is the latest request's input and all its output, 0 before the first reading. `tokenSamples` runs oldest first, about five seconds apart, and the last one is `tokenCount`. They start over when the row of the agent goes. |
| `AgentInfo.lastRequest` | <Documented /> | Since `2.1.326`, the last request of the loop that the API began to answer. | `AgentRequest`, optional. Fields `at` (the start of the request, in `$.clock.now()` milliseconds), `model`, `effort?`, and `cacheTtl?` (`'5m'` or `'1h'`). Absent before the first request and for a teammate in a pane of its own. |
| `AgentInfo.usage`, `cost` | <Documented /> | Since `2.1.326`, the tokens of the agent's own requests that `/cost` counts, one entry for each model that answered, and the cost `/cost` credited for them. | `usage` is `TurnUsage[]`, absent until `/cost` counts a request. `cost` is `SessionCost`, a part of the cost of `$.session.usage()`, so an estimate. `cost` is absent for a teammate in a pane of its own. |
| `AgentInfo.hasRow` | <Documented /> | Since `2.1.326`, whether the agent list at a glance holds a row for the agent. | `boolean`. False where the layout draws no agent rows. A finished subagent keeps an undrawn row until the engine drops its task. |
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

`AgentSpawnArgs` is the input of the call: the `prompt` field of `AgentSpawnInput` plus optional `description`, `subagentType`, `model`, `name`, `cwd`, and, since `2.1.326`, `parentAgentId`.
A hook may rewrite the content keys of `AgentSpawnInput`. The type pins every other key.

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentSpawnInput.tool_use_id` | <Documented /> | The Agent tool call this spawn belongs to. Pinned. | `string`. For a workflow agent it is the Workflow tool call that started the run. |
| `AgentSpawnInput.prompt` | <Documented /> | The task the subagent gets. A rewrite is the prompt it runs with. | `string`. On a workflow run that hides its script, it is a placeholder. The engine does not apply a rewrite. |
| `AgentSpawnInput.description` | <Documented /> | The short description of the task. A rewrite is what the task shows as. | `string`. |
| `AgentSpawnInput.subagentType` | <Documented /> | The resolved agent type (`general-purpose`, `Explore`, a plugin's agent, `fork`). | `string`. A name that matches no agent refuses the spawn. |
| `AgentSpawnInput.parentAgentId` | <Documented /> | Since `2.1.326`, the agent that the spawn is made under, when a plugin gives it to `$.agent.spawn`. Left out, the spawn is the main loop's own spawn. | `string`, optional. Names a running or resting agent of this session. The spawn acts as that agent's own spawn: with `subagentType: "fork"` it copies the conversation, prompt, tools, and model of the agent. A child is one level deeper, shows that agent as `parentId` in `$.agent.list()`, stops with it, and uses its folder and permission mode. The spawn takes no turn of the agent and writes nothing to its conversation. An id the session cannot read or run from answers `{ deny }`, and nothing falls back to the main loop.[^parent-agent] |
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

### Agent Limits

`AgentLimits` is what `$.agent.limits()` returns, since `2.1.326`. Claude Code reads it at each call.[^limits]

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AgentLimits.concurrent` | <Documented /> | How many agents may run at once. A plugin's `$.agent.spawn` calls stop at this number. | `number`. Set it with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`. The default is 20. Spawns that the model starts can go past it. |
| `AgentLimits.depth` | <Documented /> | How deep agents may nest. An agent that the main conversation starts is at depth 1. An agent at this depth starts no agents. | `number`. Set it with `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH`. If the variable is not set, the value stays the same for the session after the first read. |
| `AgentLimits.isBackgroundEnabled` | <Documented /> | Whether an agent can run in the background. | `boolean`. `false` when the session keeps its agents in the foreground. `true` does not promise one launch: on the hosted server the host decides each launch, and a subagent's own launch there runs in the foreground. |

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

## Sources

[^types]: The program, the Mod API type file loaded at `chunk-gf0qnxzg.js:257`, published as `schemas/claude-code.d.ts`, `AgentCallArgs`, `AgentCallOptions`, `AgentCallRecord`, `AgentInfo`, `AgentLimits`, `AgentLoop`, `AgentOfferInput`, `AgentOfferResult`, `AgentRequest`, `AgentSpawnArgs`, `AgentSpawnInput`, `AgentSpawnResult`, `AgentSpec`, `AgentStatus`, and `AgentTeammateRecord`.
[^call-workflow]: The program, `chunk-m14bt1pz.js:243910` and `chunk-4zn1ct5c.js:1221`.
[^limits]: The program, `chunk-m14bt1pz.js:224885`.
[^offer-refuse]: The program, `chunk-b0yr0k8v.js:77338`.
[^offer-check]: The program, `chunk-b0yr0k8v.js:209230`.
[^kind]: The program, `chunk-m14bt1pz.js:224997`.
[^parent-agent]: The program, `chunk-m14bt1pz.js:239896`.
