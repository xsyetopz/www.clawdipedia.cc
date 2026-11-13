---
title: Request and Cache
description: What one request to the model holds, which cache markers it carries, how long the cache lives, and which actions break it.
sidebar_position: 3
---

Each time the model must answer, Claude Code builds one request to the Messages API.
The request holds the tool list, the system prompt, and the whole conversation so far.
The API can reuse the start of a request it has seen before. That reuse is the prompt cache.
What you change in the request decides what the cache can reuse. So it decides speed and cost.

## Parts of a Request

The API reads the parts in this order: tools, then system, then messages.
A change in an early part makes the later parts miss the cache.
Source: [How Claude Code Uses Prompt Caching](https://code.claude.com/docs/en/prompt-caching).

```mermaid
flowchart LR
  T[tools] --> Sy[system] --> M[messages]
  T -.-> TC[Changes when the loaded tool set changes]
  Sy -.-> SC[Changes with model, output style, prompt flags]
  M -.-> MC[Changes every turn]
```

| Part | Status | Content | Changes when |
| --- | --- | --- | --- |
| `tools` | <Documented /> | The tool definitions. Claude Code defers MCP tools by default, so only their names go in. | The set of loaded tools changes. |
| `system` | <Documented /> | The attribution line, the identity line, and the system prompt. | The model, the output style, or the prompt flags change. |
| `messages` | <Documented /> | The first user message with project context (`CLAUDE.md`, auto memory, unscoped rules), then the conversation. | Every turn. |

Project context changes at session start, at `/clear`, and at `/compact`.

## Body Fields

The field list comes from the official docs and from `api-request` lines that version 2.1.305 wrote to a local transcript. They and a stub run of 2.1.305 wrote `api-request` lines with the keys `model`, `betas`, `max_tokens`, `thinking`, `context_management`, and `output_config`.

| Field | Status | Content |
| --- | --- | --- |
| `model` | <Documented /> | The model ID. |
| `max_tokens` | <Documented /> | The output limit. `CLAUDE_CODE_MAX_OUTPUT_TOKENS` can change it up to the model cap. |
| `thinking` | <Documented /> | The thinking mode, such as `{"type": "adaptive"}`. |
| `output_config` | <Documented /> | The `effort` level, the format of structured output, and `task_budget`. See [Gateway Compatibility Guide](https://code.claude.com/docs/en/llm-gateway-protocol) in the official docs. |
| `context_management` | <Documented /> | Edits that clear old thinking or old tool results. |
| `betas` | <Documented /> | The list of beta values, sent in the `anthropic-beta` header. |
| `safeguards` | <Undocumented /> | A list of safety checks, such as `dangerous_tool_use`, with the context that each check needs. |
| `system` | <Documented /> | An array of text blocks with `cache_control`. |
| `tools` | <Documented /> | An array of tool definitions. |
| `messages` | <Documented /> | The conversation. An entry with `role: "system"` can join in the middle. |
| `CLAUDE_CODE_EXTRA_BODY` | <Documented /> | An env var that adds fields to the body. |

The transcript line `api-request` records the request.
The lines `api-request-shape` and `api-request-blob` store parts of it once, by hash.
All three are <Undocumented />. See [Transcript Format](../reference/transcript-format.md).

## System Blocks and Cache Markers

A cache marker (`cache_control`) tells the API: "everything up to here can be reused."
An observed request had three `system` blocks and three markers.

| Position | Status | Marker |
| --- | --- | --- |
| `system[0]` (attribution line) | <Undocumented /> | No marker. |
| `system[1]` (identity line) | <Undocumented /> | `ephemeral`, `ttl: 1h`, `scope: global`. |
| `system[2]` (system prompt) | <Undocumented /> | `ephemeral`, `ttl: 1h`. |
| Last block of the last message | <Undocumented /> | `ephemeral`, `ttl: 1h`. |

A print-mode run of 2.1.316 against the local stub with a fake key sent the same three blocks, but the markers were plain `{"type":"ephemeral"}` on `system[1]`, `system[2]`, and the last message block. They had no `ttl` and no `scope`. So the fields `ttl: 1h` and `scope: global` do not always appear. `system[0]` had no marker. Source: the probe captures of 2.1.316.

Claude Code also marks the block of system context in the middle of a conversation, such as file-change notices, on every provider.
`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` turns this off.
If a gateway rejects the marker with a `400` error, Claude Code moves it to the last message. It keeps it there.

```mermaid
sequenceDiagram
  participant CC as Claude Code
  participant GW as Gateway or API
  CC->>GW: Request with a marker on a system block
  GW-->>CC: 400 (marker rejected)
  CC->>GW: Same request, marker moved to the last message
  GW-->>CC: 200 (stream)
  Note over CC: The marker stays on the last message from now on
```

### The Attribution Line

`system[0]` is a text block that starts with `x-anthropic-billing-header:`. Claude Code builds it for each request (the program, `chunk-9r6f1wsj.js@2988`). The text after the colon is a list of `name=value;` pairs.
The `cc_` names say which client, entry point, and turn made the request.

| Pair | When it appears |
| --- | --- |
| `cc_version=2.1.316.<suffix>` | Always. The suffix is a short code that Claude Code computes. |
| `cc_entrypoint=<value>` | Always. The value is the entry point of the run, or `unknown`. |
| `cch=00000` | First-party API requests that pass an internal test, and Vertex requests. |
| `cc_workload=<value>` | A workload tag is set. |
| `cc_is_subagent=true` | The request is from a subagent, not the main session. |
| `cc_prev_req=<req_id>` | First-party only, and the id matches `req_` and up to 36 letters, digits, `_`, or `-`. |
| `cc_prompt_id=<uuid>` | First-party only, and the id is a UUID. |
| `cc_turn_origin=<name>` | First-party only, and the name is 1 to 32 lowercase letters or `_`. |
| `cc_prompt_index=<n>; cc_turn_index=<n>` | First-party only, and both are valid numbers. |
| `cc_gateway=1` or `cc_gateway=env` | A gateway login (`1`) or a base URL from the environment (`env`), unless the host check says the URL is local or vouched. |
| `cc_project=<id>; cc_project_src=<source>` | The run has an attribution project with a valid id and a known source. |
| `cc_prev_msg=<msg_id>`, `cc_prev_prompt_index`, `cc_prev_turn_index` | First-party only, in the request right after a compaction. They name the response before it. |

The block has no cache marker.

## Cache Lifetime

Sources: [How Claude Code Uses Prompt Caching: Cache Lifetime](https://code.claude.com/docs/en/prompt-caching#cache-lifetime) and [Environment Variables](https://code.claude.com/docs/en/env-vars).

| Item | Status | Effect |
| --- | --- | --- |
| Main conversation | <Documented /> | The cache lasts one hour on a Claude subscription within plan usage, and five minutes otherwise. |
| Subagents, workflows, forks, compaction, and titles | <Documented /> | The cache lasts five minutes, except for some helper requests that the server sets. |
| `promptCacheTtl`, `CLAUDE_CODE_PROMPT_CACHE_TTL` | <Documented /> | Sets `5m` or `1h` for the main conversation. |
| `subagentPromptCacheTtl`, `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` | <Documented /> | Sets `5m` or `1h` for everything else. |
| `ENABLE_PROMPT_CACHING_1H` | <Documented /> | Asks for one hour in both groups. |
| `FORCE_PROMPT_CACHING_5M` | <Documented /> | Forces five minutes. It wins over the other items. |
| `DISABLE_PROMPT_CACHING` | <Documented /> | Turns caching off. The suffixes `_HAIKU`, `_SONNET`, `_OPUS`, and `_FABLE` turn it off for one model family. |
| `DISABLE_PROMPT_CACHING_MYTHOS` | <Undocumented /> | Turns caching off for the Mythos models. |
| `experimental.cacheTtl` in an agent definition | <Undocumented /> | Sets `5m` or `1h` for the requests of that agent when no `subagentPromptCacheTtl` setting or variable is set. The program ignores `1h` while a Claude subscription is in overage (the program, `chunk-2x9ma4k7.js@978103`). |
| `CLAUDE_CODE_MESSAGES_PROMPT_CACHE_TTL` | <Undocumented /> | Appears in the env schema. No source states what it does. |

Unset, `promptCacheTtl` means one hour on a Claude subscription within its usage limits and five minutes on an API key, Bedrock, Vertex, or Foundry. Unset, `subagentPromptCacheTtl` means five minutes unless `ENABLE_PROMPT_CACHING_1H=1`. Each environment variable wins over its setting (the program, `chunk-3dhh2g49.js@273684`). The cache ledger counts a TTL of `5m` as 300,000 ms and `1h` as 3,600,000 ms (`chunk-3hya3c3s.js@207`).

The cache is per machine and per folder, because the prompt holds memory paths and the working directory.

## The Cache Line of `/usage`

`/usage` prints one line that starts with `Prompt cache (main):`. It shows only after the session sent a request (the program, `chunk-2x9ma4k7.js@1165674`). Claude Code joins the parts below with ` · `.

| Part | Text | Source of the number |
| --- | --- | --- |
| Requests | `N request` or `N requests` | Requests of the main conversation. |
| Hit ratio | `N% of input tokens from cache` | `cache_read / (cache_read + cache_creation + uncached input)`. It is left out until it is known. |
| Misses | `no misses`, or `N miss (last T ago — likely cause: ..., N tokens re-cached)` | A miss is a request whose cached prefix shrank without a compaction to explain it. |
| Expected rebuilds | `N expected rebuild (compaction or tool-result clearing)` | Shown only when above zero. A compaction or a tool-result clearing announced the drop. |
| State | `warm (<ttl> TTL, last activity T ago)`, or `cold — idle T, next turn re-caches ~N tokens`, or `no prompt caching reported by the API` | The TTL of the last request and the time since it. When Claude Code has no token count after a compaction, the cold text reads `next turn re-caches the compacted prompt`. |

The `likely cause:` text is a list with a comma between the items. A cause can add a count: `tool definitions changed (+2/-0)` or `system prompt changed (+120 chars)`.

| Cause text | Meaning |
| --- | --- |
| `system prompt changed` | The system text differs from the last request. |
| `tool definitions changed` | The tool list differs. |
| `model changed`, `fast mode toggled` | You switched model or fast mode. |
| `cache scope or TTL changed` | The marker scope or TTL differs. |
| `beta headers changed` | The beta list differs. |
| `effort changed`, `thinking toggled`, `thinking display changed` | A thinking or effort setting changed. |
| `auto mode toggled`, `usage-limit state changed` | Auto mode or the usage-limit state changed. |
| `extra request fields changed`, `deferred tool loading changed` | A body field differs. |
| `earlier messages changed` | Old messages were rewritten. |
| `idle past the 5m TTL`, `idle past the 1h TTL` | The gap since the last activity is longer than the TTL. |
| `prompt unchanged — likely server-side` | Nothing differs and the gap is under five minutes. |
| `unknown` | No cause matched. |

Source: the program, `chunk-byyfpk0c.js@56059` (the cause names and texts).

## What Breaks the Cache

Source: [How Claude Code Uses Prompt Caching](https://code.claude.com/docs/en/prompt-caching).

| Action | Status | Effect |
| --- | --- | --- |
| Switch model | <Documented /> | Full miss. `/model` asks first while the cache is warm. |
| Change effort | <Documented /> | Full miss on most models. Opus 5.5, Sonnet 5.5, Haiku 5.5, and Fable 5.1 keep the cache. |
| Turn on fast mode | <Documented /> | One miss, because a header joins the cache key. |
| Add or remove MCP tools that are not deferred | <Documented /> | A miss. Deferred tools keep the first tool list for the conversation. |
| Deny a whole tool | <Documented /> | A miss, because its definition leaves the list. |
| Run `/compact` | <Documented /> | A new prefix starts. |
| Upgrade Claude Code | <Documented /> | A miss. |
| Enable a plugin with skills, agents, or hooks | <Documented /> | No miss, because Claude Code appends the content. |

## Per-Turn Values

Some models can take their effort level and the current time with each message.
Claude Code then sends them in a system entry of the message, with the betas `per-turn-control-2026-07-01` and `timing-2026-09-09`.
These values are <Undocumented />. The capability flags `per_turn_effort` and `per_turn_timing` mark the models that accept them. See [Models](models.md#capabilities).

## Facts From Probes

A local stub of the Messages API showed these facts.
No model call left the machine.

- A model name with the `[1m]` suffix adds the `context-1m-2025-08-07` beta. Without the suffix, Claude Code never sends it.
- The call to `/v1/messages/cache_touch` needs a subscriber login and the `cache-keepalive-2026-09-03` beta.
  It repeats every 30 seconds (10 to 120), with the body `{"request_id": ...}`.

## What You Can Change

| Goal | How |
| --- | --- |
| Keep the cache alive longer | Set `CLAUDE_CODE_PROMPT_CACHE_TTL=1h` or `ENABLE_PROMPT_CACHING_1H=1`. |
| Make a gateway happy | Set `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`. |
| Add a field to every request | Set `CLAUDE_CODE_EXTRA_BODY` to JSON. |
| Turn caching off | Set `DISABLE_PROMPT_CACHING=1`, or one family variant. |
| Avoid a miss | Pick the model and effort at the start of a session. |
| Keep machine facts out of the system prompt | Use `--exclude-dynamic-system-prompt-sections`. It moves the working folder, environment, memory paths, and git status into the first user message. See [The System Prompt](system-prompt.md). |

## Example

You switch models in the middle of a task with `/model`.
The next request has no cache hits, because each model has its own cache.
Pick the model at the start of a session to avoid this.

```bash
ENABLE_PROMPT_CACHING_1H=1 claude --model sonnet
```

## Related Pages

- [The System Prompt](system-prompt.md)
- [Context and Compaction](context-and-compaction.md)
- [The Agent Loop](agent-loop.md)
- [Models](models.md)
- [API Endpoints](../reference/api/endpoints.md) and [API Betas](../reference/api/betas.md) pages in Reference.
