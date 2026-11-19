---
title: Context Budget
description: What an empty Claude Code session holds, what each tool costs, what else changes the budget, and how to keep it small.
sidebar_position: 5.5
---

The context window is shared by everything the model reads.
Some of it is there before you type a word.
A smaller start leaves more room for your work and costs less on each request. This page counts that start and shows what each tool and setting adds. To shrink it, deny tools with `permissions.deny` or `--tools`, as the Best Practices section shows.
For compaction and what fills the window later, see [Context and Compaction](context-and-compaction.md).

:::note[Your Numbers May Differ]
All numbers come from one subscription account on 2026-10-21, with Claude Code `2.1.305` on Opus 5.5 unless a row says otherwise.
Anthropic turns some tools on or off per account from its servers.
For example, `ListAgents` and `ScheduleWakeup` are gated. A server-side list can defer `Workflow` and `ReportFindings` (see [Tools](../reference/tools/index.md)).
Another account, plan, or date can get a different tool list and different totals.
Run `/context` to see your own numbers.
:::

## What an Empty Session Holds

Method: live runs on `2.1.305` with a subscription login, a fresh config folder, and an empty project (a `README.md` only, no git repo).
We ran `claude -p "/context" --output-format stream-json`. We read the `context_usage` object.
For the second column we ran `claude -p "Reply with 'OK'."` (the reply was exactly `OK` in every run). Then we ran `claude -p --continue "/context"`.
All numbers are tokens on Opus 5.5.[^method] This breakdown is <Undocumented />.

| Category | Empty | After `Reply with 'OK'.` |
| --- | --- | --- |
| System prompt | 2,407 | 2,407 |
| System tools (loaded) | 7,897 | 7,962 |
| System tools (deferred, not in the total) | 13,425 | 13,425 |
| Skills (listing) | 2,210 | 2,210 |
| Messages | 10 | 3,698 |
| Total | 12,524 | 16,277 |

The window is 1,000,000 tokens on Opus, Sonnet, and Haiku 5.5.
The autocompact buffer is 33,000 tokens. See [Context and Compaction](context-and-compaction.md) for the levels.

Messages jump by about 3.7k on the first turn.
The first request carries injected content as messages:

- a system reminder about git attribution
- an environment block (working folder, platform, model, knowledge cutoff)
- the names of the deferred tools
- the "Available agent types" list (`claude`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`)
- the skills listing

Your own prompt (`Reply with 'OK'.`) is a few tokens.
See the captured [first-turn messages](../prompts/index.md).

The real first request matched `/context` exactly: input 2, cache write 5,441, and cache read 10,834 make 16,277.
Reruns on `2.1.306`, `2.1.307`, `2.1.308`, `2.1.309`, `2.1.310`, and `2.1.311` matched the same way: input, cache write, and cache read of the first reply added up to the `/context` total. Those runs used the default model, `claude-sonnet-5-5`, and a warm cache, so their counts are not shown here. They listed the same categories, no memory files, no agents, and no MCP tools.[^method]
The split between cache write and cache read depends on the cache, not on the request. A subscription login writes with a 1-hour lifetime. So another session on the account with the same tools and system prompt within the last hour lets this one read them. A cold first request wrote almost all of it and read nothing.
`/context` itself only calls the token counting endpoint, so it does not run a model turn. We checked this: `claude -p "/context"` against the stub sent 24 requests to `/v1/messages/count_tokens` and none to `/v1/messages`. On `2.1.328` the same run sent 25.[^ctx-count]

## What Each Tool Costs

We removed one tool at a time from the default set with `--disallowedTools <tool>`. We read the new total of the empty session (12,524).
We did not run a tool alone with `--tools`. Those numbers carry shared overhead and mislead.

| Removed | New total | Change | Notes |
| --- | --- | --- | --- |
| `Workflow` | 10,555 | -1,969 | |
| `ScheduleWakeup` | 10,849 | -1,675 | |
| `Agent` | 11,204 | -1,320 | |
| `ReportFindings` | 11,717 | -807 | |
| `Read` | 11,818 | -706 | |
| `ListAgents` | 12,179 | -345 | |
| `Edit` | 12,184 | -340 | |
| `Write` | 12,294 | -230 | |
| `Bash` | 12,908 | +384 | Claude Code adds `Glob` and `Grep` in its place. So the loaded tools rise to 8,273. |
| `Skill` | 18,123 | +5,599 | The skills listing goes. The `Workflow` tool (description and schema) grows from 5,313 to 22,089 characters. With no `Skill` tool to load the `workflow-authoring` skill, Claude Code puts that guidance in the tool text. |
| `ToolSearch` | 28,422 | +15,898 | Every deferred tool loads (deferred 0, tools 23,781). |
| `WebSearch` (deferred) | 12,394 | -130 | The deferred pool shrinks, 13,425 to 13,190. The system prompt was also 128 tokens smaller in this run. |

The system prompt line moved between 2,277 and 2,427 across these runs. So each Change has some noise (10 to 20 tokens in most rows).

Loaded by default: `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, and `Write`.
Deferred by default: `CronCreate`, `CronDelete`, `CronList`, `DesignSync`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `NotebookEdit`, `PushNotification`, `RemoteTrigger`, `SendMessage`, `TaskStop`, `WebFetch`, and `WebSearch`.
A deferred tool costs nothing, apart from its name, until `ToolSearch` loads it.
In the default session the deferred tools would add 13,425 tokens.

### Definition Sizes in Characters

The token numbers above are from `2.1.305`. The table below counts characters in the tool texts that the `2.1.316` probe captured (`print` captures with the stub API, model `claude-opus-5-5`, 12 tools). A denied tool leaves the request, so its description and schema characters are the saving. The request body also holds a little JSON framing around each tool.[^captures]

| Tool | Description | Schema | Sum | Sent in the first request |
| --- | --- | --- | --- | --- |
| `Agent` | 3,227 | 1,942 | 5,169 | Yes |
| `Workflow` | 3,480 | 1,775 | 5,255 | Yes |
| `ScheduleWakeup` | 3,396 | 1,392 | 4,788 | Yes |
| `Bash` | 1,934 | 1,720 | 3,654 | Yes |
| `Skill` | 1,417 | 327 | 1,744 | Yes |
| `ReportFindings` | 574 | 1,545 | 2,119 | Yes |
| `Read` | 790 | 1,071 | 1,861 | Yes |
| `ToolSearch` | 953 | 406 | 1,359 | Yes |
| `ListAgents` | 777 | 316 | 1,093 | Yes |
| `Edit` | 360 | 552 | 912 | Yes |
| `Write` | 240 | 348 | 588 | Yes |
| `DeferredToolPlaceholder` | 83 | 33 | 116 | Yes |
| `Monitor` | 6,354 | 1,040 | 7,394 | Deferred |
| `SendMessage` | 4,259 | 1,291 | 5,550 | Deferred |
| `CronCreate` | 3,399 | 958 | 4,357 | Deferred |
| `EnterWorktree` | 3,220 | 687 | 3,907 | Deferred |
| `ExitWorktree` | 1,923 | 481 | 2,404 | Deferred |
| `NotebookEdit` | 619 | 940 | 1,559 | Deferred |

- A deferred tool sends only its name until `ToolSearch` loads it. Denying it saves nothing in the first request.
- A probe runs the same request with `--disable-slash-commands`.[^dsc] The `Skill` tool leaves (1,811 bytes in the body). The skills section of the messages leaves (6,191 bytes). The `Workflow` tool grows from 5,383 to 22,511 bytes. The request body changes from 46,108 to 54,967 bytes, which is 8,859 bytes more, not less. This is the same effect as denying `Skill` in the table above.
- Sizes in this table are for one model and one account state. A server flag or a setting can change the tool list.

### Deny-List Savings in Characters

The 12 tools that `2.1.316` sends first hold 28,658 characters of description and schema in all (17,231 and 11,427). A deny rule removes the tool from this sum.
We ran `claude -p "Reply with OK" --model claude-opus-5-5 --disallowedTools Workflow,ScheduleWakeup` on `2.1.316` against the stub API, with and without the flag.

| Run | Tools sent | Description and schema | Request body (JSON characters) |
| --- | --- | --- | --- |
| No deny rule | 12 | 28,658 | 46,110 |
| Deny `Workflow` and `ScheduleWakeup` | 10 | 18,615 | 35,867 |
| Saving | 2 | 10,043 | 10,243 |

The saving of 10,043 equals the two sums in the table above (5,255 and 4,788). The body also drops about 200 characters of JSON framing around the two tools.

`Skill` brings the skills listing. It is 2,210 tokens for the built-in skills:

| Skill | Tokens |
| --- | --- |
| `dataviz` | 482 |
| `claude-api` | 361 |
| `update-config` | 236 |
| `code-review` | 331 |
| `schedule` | 127 |
| `run` | 123 |
| `loop` | 115 |
| `plugin-authoring` | 89 |
| `workflow-authoring` | 84 |
| `keybindings-help` | 83 |
| `fewer-permission-prompts` | 64 |
| `simplify` | 63 |
| `security-review` | 30 |
| `init` | 22 |

## What Else Changes the Budget

Each row is a session after `Reply with 'OK'.` on Opus 5.5, compared to the default of 16,277.

| Variant | Total | Change | Why |
| --- | --- | --- | --- |
| Default | 16,277 | 0 | |
| `--tools "Read,Edit,Bash"` | 5,358 | -10,919 | Tools drop to 2,533. There is no skills listing. |
| `--tools ""` | 2,532 | -13,745 | No tools. The system prompt is 2,222. |
| `ENABLE_TOOL_SEARCH=false` | 31,604 | +15,327 | All tools load, 23,846 in all. Nothing is deferred. |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | 15,586 | -691 | The system prompt drops from 2,407 to 1,706. |
| `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` | 15,953 | -324 | The agent list is shorter. |
| `includeGitInstructions: false` | 15,929 | -348 | The `Bash` text is shorter (loaded tools 7,815). The messages are shorter too. |
| Git repo with one commit | 16,454 | +177 | A git status goes into the messages. |
| `CLAUDE.md` of 60 short lines (about 3.4 KB) | 17,727 | +1,450 | Memory files take 1,327. |
| `outputStyle` set to `Explanatory` | 16,614 | +337 | Claude Code adds the style text. |
| One custom agent file with a one-line description | 16,306 | +29 | Custom agents take 19. |
| One MCP server (filesystem, 14 tools) | 16,467 | +190 | Claude Code defers its tools (2,753) until a search loads them. |
| Sonnet 5.5 | 16,679 | +402 | Loaded tools take 8,355. |
| Haiku 5.5 | 17,459 | +1,182 | The system prompt is 3,198. |

Messages still vary by a few tokens between runs, even though every reply was exactly `OK`. Two runs of the default session gave totals of 16,274 and 16,277. The split differed more. For example, deferred tools were 15,919 in one run and 13,425 in the other, and messages were 3,769 and 3,698. So trust the totals more than single categories.

`--disable-slash-commands` makes the request larger, not smaller. The test ran `claude -p "Reply with 'OK'."` with `2.1.305` against a local stub, on Opus 5.5, with no skills of your own. The request body grew by 9,057 bytes, from 44,332 to 53,389. The totals shift a little with the length of the project path. The growth was the same 9,057 bytes on later builds:

- `2.1.307`: from 45,388 to 54,445.
- `2.1.309`: from 45,671 to 54,728, after the `Bash` tool description grew.
- `2.1.310`: from 45,766 to 54,823, after `Monitor` joined the tool list.

That is about 2,300 more tokens at 4 bytes per token (an estimate, not a count). The `Skill` tool (1,803 bytes) went away. So did the list of skills in the messages: the text of that message fell from 8,947 to 2,952 bytes, which is 5,995 bytes less. The `Workflow` tool description grew by 16,955 bytes, because it then holds the workflow authoring reference that it otherwise loads through the `workflow-authoring` skill. Your own skills and commands are left out too, so with many of them the net change is smaller.

## Best Practices

### Keep Tool Search On

Tool search defers rarely used tools. Turning it off added 15,327 tokens.
Leave `ENABLE_TOOL_SEARCH` unset unless you have a reason.

### Trim Tools for Narrow Jobs

A headless job or a narrow agent rarely needs every tool.
`--tools "Read,Edit,Bash"` cut the session from 16,277 to 5,358 tokens. It also removed the skills listing.

```bash
claude -p "Fix the typo in README.md" --tools "Read,Edit"
```

To remove single tools, deny them. `permissions.deny` and `--disallowedTools` both remove a tool from the context.
Denying `Workflow` and `ScheduleWakeup`, which cost the most and are often unused, took the empty session from 12,524 to 8,852 tokens.
See [Permissions](../configure/permissions/index.md).

```json title=".claude/settings.json"
{
  "permissions": {
    "deny": ["Workflow", "ScheduleWakeup"]
  }
}
```

Denying a deferred tool such as `WebSearch` only shrinks the deferred pool (13,425 to 13,190). It left the total almost unchanged (12,524 to 12,394).

Do not deny tools that are part of the loading machinery:

- Denying `ToolSearch` loads every deferred tool: +15,898.
- Denying `Skill` raised the total by 5,599. The `workflow-authoring` reference moves into the `Workflow` text. Denying both `Skill` and `Workflow` gives 9,875, which saves 2,649.
- Denying `Bash` raised the total by 384. Claude Code adds `Glob` and `Grep` in its place.

### Keep `CLAUDE.md` Short

Claude Code sends your memory files on every turn.
A `CLAUDE.md` of 60 short lines cost about 1,300 tokens of memory files (1,327). It cost 1,450 in total with the extra message text.
Keep only rules the model needs in every session.

### Put Rare Instructions in Skills or Subagents

Claude Code lists only the description of a skill. The body loads when the skill runs.
Move a long, rarely needed procedure out of `CLAUDE.md` into a skill, or into a subagent that has its own context.

### Keep MCP Descriptions Short

Claude Code defers MCP tools. So one server with 14 tools added only 190 tokens at the start.
The 2,753 tokens of schemas arrive when a search loads them. So keep tool descriptions short.

### Turn Off Text You Do Not Use

Each switch below removes a block of the start. Use one only if you do not need that feature.

| Switch | Saves | You lose |
| --- | --- | --- |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | 691 | Auto memory |
| `includeGitInstructions: false` | 348 | Commit and PR rules in the `Bash` text |
| `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` | 324 | The `Explore` and `Plan` agents |

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "includeGitInstructions": false,
  "env": {
    "CLAUDE_CODE_DISABLE_AUTO_MEMORY": "1",
    "CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS": "1"
  }
}
```

See [Overriding Prompts](../prompts/other/override.md) for each switch.

### Watch Custom Agent Descriptions

One custom agent with a one-line description added 29 tokens (the agent list itself took 19).
That is cheap. But the descriptions accumulate.
Claude Code warns when the descriptions of all non-built-in agents pass 15,000 tokens.
See [Subagents](../extend/subagents/index.md).

### Keep the Start Stable for the Cache

The start of the request (tools and system prompt) is cached.
In live tests with `2.1.305` (a two-turn session, the second turn resumed with `--continue`):

| Change Before Turn Two | Cache Read | Cache Written |
| --- | --- | --- |
| Nothing | 12,980 | 3,474 |
| `CLAUDE.md` edited | 12,980 | 3,604 |
| Tools changed (`--disallowedTools ListAgents`) | 0 | 15,925 |
| Tools changed (`--disallowedTools ReportFindings`) | 10,013 | 5,499 |

Editing `CLAUDE.md` keeps the cache.
This also holds inside one open session. After the model rewrote `CLAUDE.md` with the Write tool, the next request read 16,611 tokens from the cache and wrote 182.
Claude Code sends memory in the first user message, not the system prompt.
The old text stays there. The new text comes in a later message.
Changing the tools breaks the cache. Dropping `ListAgents` discarded the whole cached prefix. Dropping `ReportFindings` kept the first 10,013 tokens. Pick tools before you start. No earlier request in the past hour had dropped either tool. An earlier identical request would have left a matching cache to read.
A new session with the same tools and system prompt also reads the cache of an earlier one within the cache lifetime (1 hour on a subscription). It read 10,834 tokens on its first turn.
See [Request and Cache](request-and-cache.md).

## Related Pages

- [Context and Compaction](context-and-compaction.md)
- [Request and Cache](request-and-cache.md)
- [System Prompt](system-prompt.md)
- [Probes](../reference/probes.md)

## Sources

[^method]: Live runs on `2.1.305`; see [Probes](../reference/probes.md#context-budget).
[^captures]: The probe captures, shown in [Tool Descriptions](../prompts/tools/tools.md).
[^dsc]: Probe case `print.dsc.sizes`.
[^ctx-count]: Probe case `print.misc.context-slash-command`. The request count went from 24 to 25. The probe does not show which count request is new.
