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
All numbers come from one subscription account, with Claude Code `2.1.328`. The token counts use the default model, `claude-sonnet-5-5`. The character counts use the captured request for `claude-opus-5-5`.
Anthropic turns some tools on or off per account from its servers.
For example, `ListAgents` and `ScheduleWakeup` are gated. A server-side list can defer `Workflow` and `ReportFindings` (see [Tools](../reference/tools/index.md)).
Another account, plan, or date can get a different tool list and different totals.
Run `/context` to see your own numbers.
:::

## What an Empty Session Holds

Method: a live run on `2.1.328` with a subscription login, a fresh config folder, and an empty project (a `README.md` only, no git repo).
We ran `claude -p "/context" --output-format stream-json`. We read the `context_usage` object.
For the second column we ran `claude -p "Reply with 'OK'."`. Then we ran `claude -p --continue "/context"`.
The server refused the login (HTTP 401), so `/context` could not get counts from the token counting endpoint. It showed its local estimate instead. All numbers are these estimates, on the model the session reported, `claude-sonnet-5-5`.[^method] This breakdown is <Undocumented />.

| Category | Empty | After `Reply with 'OK'.` |
| --- | --- | --- |
| System prompt | 2,252 | 2,252 |
| System tools (loaded) | 8,432 | 8,432 |
| System tools (deferred, not in the total) | 9,722 | 9,722 |
| Skills (listing) | 2,067 | 2,067 |
| Messages | Not listed | 3,336 |
| Total | 12,751 | 16,087 |

The autocompact buffer is 33,000 tokens. See [Context and Compaction](context-and-compaction.md) for the levels.

Messages hold about 3,336 tokens (estimate) after the first turn.
The first request carries injected content as messages:

- a system reminder about git attribution
- an environment block (working folder, platform, model, knowledge cutoff)
- the names of the deferred tools
- the "Available agent types" list (`claude`, `Explore`, `general-purpose`, `Plan`, `statusline-setup`)
- the skills listing

Your own prompt (`Reply with 'OK'.`) is a few tokens.
See the captured [first-turn messages](../prompts/index.md).

The split between cache write and cache read depends on the cache, not on the request.
`/context` itself only calls the token counting endpoint, so it does not run a model turn. The probe `claude -p "/context"` against the stub sends 25 requests to `/v1/messages/count_tokens` and none to `/v1/messages`.[^ctx-count]

## What Each Tool Costs

Loaded by default: `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, and `Write`.
Deferred by default: `CronCreate`, `CronDelete`, `CronList`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `NotebookEdit`, `SendMessage`, `TaskStop`, `WebFetch`, and `WebSearch`.
A deferred tool costs nothing, apart from its name, until `ToolSearch` loads it.[^captures]

### Definition Sizes in Characters

The table below counts characters in the tool texts that the `2.1.328` probe captured (`print` captures with the stub API, model `claude-opus-5-5`, 12 tools). A denied tool leaves the request, so its description and schema characters are the saving. The request body also holds a little JSON framing around each tool.[^captures]

| Tool | Description | Schema | Sum | Sent in the first request |
| --- | --- | --- | --- | --- |
| `Workflow` | 3,496 | 2,107 | 5,603 | Yes |
| `Agent` | 3,225 | 1,952 | 5,177 | Yes |
| `ScheduleWakeup` | 3,396 | 1,392 | 4,788 | Yes |
| `Bash` | 2,110 | 1,750 | 3,860 | Yes |
| `ReportFindings` | 574 | 1,796 | 2,370 | Yes |
| `ListAgents` | 1,433 | 472 | 1,905 | Yes |
| `Read` | 790 | 1,071 | 1,861 | Yes |
| `Skill` | 1,417 | 327 | 1,744 | Yes |
| `ToolSearch` | 952 | 406 | 1,358 | Yes |
| `Edit` | 360 | 552 | 912 | Yes |
| `Write` | 240 | 348 | 588 | Yes |
| `DeferredToolPlaceholder` | 83 | 33 | 116 | Yes |
| `Monitor` | 6,357 | 1,040 | 7,397 | Deferred |
| `SendMessage` | 4,761 | 1,306 | 6,067 | Deferred |
| `CronCreate` | 3,399 | 958 | 4,357 | Deferred |
| `EnterWorktree` | 3,220 | 692 | 3,912 | Deferred |
| `ExitWorktree` | 2,149 | 653 | 2,802 | Deferred |
| `NotebookEdit` | 619 | 940 | 1,559 | Deferred |
| `WebFetch` | 469 | 554 | 1,023 | Deferred |
| `WebSearch` | 334 | 468 | 802 | Deferred |
| `TaskStop` | 364 | 366 | 730 | Deferred |
| `CronDelete` | 167 | 206 | 373 | Deferred |
| `CronList` | 106 | 119 | 225 | Deferred |

- A deferred tool sends only its name until `ToolSearch` loads it. Denying it saves nothing in the first request.
- A probe runs the same request with `--disable-slash-commands`.[^dsc] The request body changes from 49,190 to 58,035 bytes, which is 8,845 bytes more, not less. The messages change from 10,160 to 3,765 bytes.
- Sizes in this table are for one model and one account state. A server flag or a setting can change the tool list.

### Deny-List Savings in Characters

The 12 tools that `2.1.328` sends first hold 30,282 characters of description and schema in all (18,076 and 12,206). A deny rule removes the tool from this sum.
Denying `Workflow` and `ScheduleWakeup` removes the two sums in the table above (5,603 and 4,788), which is 10,391 characters.

`Skill` brings the skills listing. It is 2,067 tokens for the 13 built-in skills.

## What Else Changes the Budget

`--disable-slash-commands` makes the request larger, not smaller. The probe ran `claude -p "Reply with 'OK'."` against a local stub. The request body grew by 8,845 bytes, from 49,190 to 58,035. The totals shift a little with the length of the project path. The skills section of the messages is 6,299 bytes. Your own skills and commands are left out too, so with many of them the net change is smaller.

## Best Practices

### Keep Tool Search On

Tool search defers rarely used tools. Turning it off loads every deferred tool.
Leave `ENABLE_TOOL_SEARCH` unset unless you have a reason.

### Trim Tools for Narrow Jobs

A headless job or a narrow agent rarely needs every tool.
`--tools` limits the tools in the request.

```bash
claude -p "Fix the typo in README.md" --tools "Read,Edit"
```

To remove single tools, deny them. `permissions.deny` and `--disallowedTools` both remove a tool from the context.
`Workflow` and `ScheduleWakeup` cost the most characters among the loaded tools and are often unused.
See [Permissions](../configure/permissions/index.md).

```json title=".claude/settings.json"
{
  "permissions": {
    "deny": ["Workflow", "ScheduleWakeup"]
  }
}
```

Denying a deferred tool such as `WebSearch` only shrinks the deferred pool. It leaves the total almost unchanged.

Do not deny tools that are part of the loading machinery:

- Denying `ToolSearch` loads every deferred tool.
- Denying `Skill` removes the skills listing, and the request grows in other places (see `--disable-slash-commands` above).

### Keep `CLAUDE.md` Short

Claude Code sends your memory files on every turn.
A longer `CLAUDE.md` adds more tokens to every turn.
Keep only rules the model needs in every session.

### Put Rare Instructions in Skills or Subagents

Claude Code lists only the description of a skill. The body loads when the skill runs.
Move a long, rarely needed procedure out of `CLAUDE.md` into a skill, or into a subagent that has its own context.

### Keep MCP Descriptions Short

Claude Code defers MCP tools. So their schemas arrive when a search loads them. Keep tool descriptions short.

### Turn Off Text You Do Not Use

Each switch below removes a block of the start. Use one only if you do not need that feature.

| Switch | You lose |
| --- | --- |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` | Auto memory |
| `includeGitInstructions: false` | Commit and PR rules in the `Bash` text |
| `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` | The `Explore` and `Plan` agents |

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

A custom agent with a one-line description is cheap. But the descriptions accumulate.
Claude Code warns when the descriptions of all non-built-in agents pass 15,000 tokens.
See [Subagents](../extend/subagents/index.md).

### Keep the Start Stable for the Cache

The start of the request (tools and system prompt) is cached.
Editing `CLAUDE.md` keeps the cache.
Claude Code sends memory in the first user message, not the system prompt.
The old text stays there. The new text comes in a later message.
Changing the tools breaks the cache. Pick tools before you start.
See [Request and Cache](request-and-cache.md).

## Related Pages

- [Context and Compaction](context-and-compaction.md)
- [Request and Cache](request-and-cache.md)
- [System Prompt](system-prompt.md)
- [Probes](../reference/probes.md)

## Sources

[^method]: The probe case `live.context-budget` on `2.1.328`; see [Probes](../reference/probes.md#context-budget). When the count request fails, `/context` logs `analyzeContext: count unavailable, estimating locally` and estimates from the text: the program, `chunk-56bhcxay.js:2973839`.
[^captures]: The probe captures, shown in [Tool Descriptions](../prompts/tools/tools.md).
[^dsc]: Probe case `print.dsc.sizes`.
[^ctx-count]: Probe case `print.misc.context-slash-command` on `2.1.328`. The case records the tools and message text of each count request.
