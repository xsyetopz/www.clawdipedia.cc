---
title: Models
description: How Claude Code picks the model, effort, and thinking mode, what the capability flags do, how fallback and retries work, and which timeouts apply.
sidebar_position: 7
---

A model is the Claude version that answers you.
Effort is how hard the model thinks before it answers.
An API call is one request to the model server.
This page explains how Claude Code chooses each of these and what happens when a call fails.
The full list of models, aliases, and providers is on [Models and Providers](../configure/models-and-providers/index.md).

## Choosing the Model

Sources: [Model Configuration](https://code.claude.com/docs/en/model-config) and [Hooks Reference](https://code.claude.com/docs/en/hooks).

```mermaid
flowchart TD
  A[Model request] --> B{"<code>/model</code> chosen in the session?"}
  B -- yes --> Use[Use it]
  B -- no --> C{"<code>--model</code> flag?"}
  C -- yes --> Use
  C -- no --> D{"<code>ANTHROPIC_MODEL</code> set?"}
  D -- yes --> Use
  D -- no --> E{model setting?}
  E -- yes --> Use
  E -- no --> E2{"<code>ANTHROPIC_DEFAULT_MODEL</code> set?"}
  E2 -- yes --> Use
  E2 -- no --> F[Default alias, by account and provider]
  Use --> G{Alias or full name?}
  G -- alias --> H[Resolve to a model for your provider]
  G -- full name --> I[Send as is]
  H --> J[Check the catalog: window, limits, capabilities]
  I --> J
```

Other pages list the items that set the model. They are flags, environment variables, settings, aliases such as `default`, `opusplan`, and `best`, the `[1m]` suffix, and the switch hooks. See [Choose a Model](../configure/models-and-providers/model-catalog.md#choose-a-model) and [Aliases](../configure/models-and-providers/model-catalog.md#aliases).

A switch of the model is a cache miss. See [Request and Cache](request-and-cache.md#what-breaks-the-cache).

## Effort

The effort levels are `low`, `medium`, `high`, `xhigh`, and `max`.
A level that the model does not accept runs as the highest accepted level below it.
Source: [Model Configuration](https://code.claude.com/docs/en/model-config).

The flags, variables, settings, request field, and default level for each model are in [Effort](../configure/models-and-providers/effort-thinking-and-fallback.md#effort).
The cache warning, the prompt note, and the spinner text for an effort change are in the same section.

## Thinking

Sources: [Model Configuration](https://code.claude.com/docs/en/model-config) and [Environment Variables](https://code.claude.com/docs/en/env-vars).

The thinking flags, variables, and settings are in [Thinking](../configure/models-and-providers/effort-thinking-and-fallback.md#thinking).

`MAX_THINKING_TOKENS` cannot turn thinking off on Opus 5.5, Sonnet 5.5, Haiku 5.5, and the Fable models.
`CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` has no effect on newer models.

## Capabilities

The model catalog gives each model a list of capability flags.
The code tests a flag to enable a feature for that model.
The flag list, with what each flag does and how many models have it, is in [Capabilities](../configure/models-and-providers/model-catalog.md#capabilities).
The flags `effort`, `max_effort`, `xhigh_effort`, and `adaptive_thinking` say which effort levels and which thinking mode a model accepts.
The betas `per-turn-control-2026-07-01` and `timing-2026-09-09` match the flags `per_turn_effort` and `per_turn_timing`.

## Fallback

```mermaid
flowchart TD
  Call[Request to the main model] --> R{Result}
  R -- ok --> Done[Stream the reply]
  R -- overload or server error --> Chain{Fallback chain set?}
  Chain -- yes --> Next[Try the next model for this turn]
  Chain -- no --> Retry[Retry rules]
  R -- refusal flagged as biology or cybersecurity --> CB[Run again on that category fallback model]
  Next --> Done
  CB --> Stay[Session stays on that model]
```

- A fallback chain (`--fallback-model`, `fallbackModel`) holds at most three models.
  It covers overload and server errors, and not auth, billing, rate-limit, request-size, or transport errors.
  The switch lasts for the current turn. The next turn tries the main model first.
  Source: [Model Configuration: Fallback Model Chains](https://code.claude.com/docs/en/model-config#fallback-model-chains).
- Content-based fallback applies to the Fable models, Opus 5.5, Sonnet 5.5, and Opus 5.
  A request that is flagged as biology or cybersecurity runs again on the fallback model of that category.
  The session then stays on that model.
  Source: [Model Configuration: Automatic Model Fallback](https://code.claude.com/docs/en/model-config#automatic-model-fallback).
- `CLAUDE_CODE_NO_MODEL_FALLBACK` forbids the substitution of a model (<Undocumented />, a message in the program names it).

## Retries and Timeouts

Sources: [Error Reference: Automatic Retries](https://code.claude.com/docs/en/errors#automatic-retries) and [Environment Variables](https://code.claude.com/docs/en/env-vars).

The variables, with their defaults, are in [Fallback and Retries](../configure/models-and-providers/effort-thinking-and-fallback.md#fallback-and-retries).

Since `2.1.311`, Claude Code does not retry a `429` or `529` that the API marked with `x-should-retry: false`, and that includes unattended mode (`CLAUDE_CODE_RETRY_WATCHDOG`).
Before, such a request could hold a turn for minutes, or for good in that mode.
Source: the [Claude Code changelog](https://code.claude.com/docs/en/changelog), and the program (`chunk-2x9ma4k7.js:153069`; the old rule was in the 2.1.310 program, which is not in the `2.1.321` capture).

When a request is too long for the context, Claude Code tries again with a smaller `max_tokens`. It compacts when that is not enough.
Since `2.1.311`, a session on a standard window (not 1M) that sends more than 200K tokens and gets the error "Usage credits required for 1M context" compacts the conversation and goes on, where it stopped before.
Source: the [Claude Code changelog](https://code.claude.com/docs/en/changelog), and the program (`chunk-fxkn94rg.js:7801` checks for that refusal on a model whose window is standard, then the code at `chunk-fxkn94rg.js:13826` to `:13930` runs the reactive compaction).
The loop also recovers from a stop at `max_tokens` and from a bad tool call. See [The Agent Loop](agent-loop.md#recovery-inside-the-loop).

## Example

Run one hard task with a stronger model and more thinking.
Make a script fail sooner by lowering the retry count.

```bash
claude --model opus --effort high
CLAUDE_CODE_MAX_RETRIES=3 claude -p "summarize this repo"
```

## Related Pages

- [Models and Providers](../configure/models-and-providers/index.md)
- [Request and Cache](request-and-cache.md)
- [Context and Compaction](context-and-compaction.md)
- [Settings](../configure/settings/index.md) and [Environment Variable](../configure/env-vars/index.md) pages in Configure.
