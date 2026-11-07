---
title: Model Settings
description: Keys that choose the model, the effort level, thinking, fast mode, cache lifetime, and model allow and block lists.
sidebar_position: 3
---

These keys choose the model Claude Code uses and how hard it thinks.
Administrators also use them to allow or block models.
Several keys have a matching environment variable that wins over the key.

Use `/model` or edit a settings file. `fastMode`, `alwaysThinkingEnabled`, and `enforceAvailableModels` switch features.

## Keys

Source: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, Source: the program (its bundled settings schema).
Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `advisorModel` | <Documented /> | string | - | Pick which model answers when Claude asks the advisor tool. | Any settings file |
| `alwaysThinkingEnabled` | <Documented /> | boolean | - | Turn extended thinking off for every session. | Any settings file |
| `availableModels` | <Documented /> | array of string | - | Restrict which models people can pick. It accepts family aliases (`opus`), version prefixes (`opus-4-5`), and full model IDs. An empty array leaves only the default model. | Any settings file |
| `availableModelsMatch` | <Documented /> <ManagedOnly /> | enum: `prefix`, `exact` | - | Make each `availableModels` model ID entry permit only the version it names. `prefix` is the default. `exact` stops an entry from allowing other versions. | Managed settings only |
| `deniedModels` | <Documented /> <ManagedOnly /> | array of string | - | Block specific models, even ones `availableModels` permits. A family alias blocks the family. Claude Code does not start if no allowed model is left for Default. | Managed settings only |
| `effortLevel` | <Documented /> | enum: `low`, `medium`, `high`, `xhigh` | - | Set a default effort level for models without a saved level of their own. Claude Code saves levels for supported models. | Any settings file |
| `enforceAvailableModels` | <Documented /> | boolean | - | Keep the `/model` Default choice inside your `availableModels` allowlist. It has no effect when `availableModels` is unset or empty. | Any settings file |
| `fallbackModel` | <Documented /> | array of string | - | Name backup models for when the primary is overloaded. Claude Code tries the models in order. The `--fallback-model` flag wins. `default` expands to the default model. | Any settings file |
| `fastMode` | <Documented /> | boolean | - | Turn fast mode on for sessions where it's available. | Any settings file |
| `fastModePerSessionOptIn` | <Documented /> | boolean | - | Require people to turn fast mode on each session. Each session starts with fast mode off. | Any settings file |
| `maxEffortLevel` | <Documented /> | string | - | Cap the effort level for every model or per model, on every provider. The lowest value across files wins. Claude Code does not clamp an effort set through `CLAUDE_CODE_EXTRA_BODY`. | Any settings file |
| `model` | <Documented /> | string | - | Change the model Claude Code starts with. | Any settings file |
| `modelOverrides` | <Documented /> | object | - | Map model IDs to your provider's IDs, such as Bedrock ARNs. Usually set in managed settings. Since `2.1.305`, `/effort` and `/autocompact` settings apply even when the model name differs from a `modelOverrides` value by letter case or a `[1m]` tag ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). | Any settings file |
| `modelPicker` | <Documented /> | object | - | Choose which models the `/model` picker lists, in your own order and with your own labels. Claude Code reads it only from managed, `--settings`, and user settings. The first source that sets it wins whole. | User or managed settings |
| `modelPicker.options` | <Documented /> | array of rows | - | The rows the `/model` picker shows, in order. Each row has a required `model` and optional `label`, `description`, and `behavesAs`. | User or managed settings |
| `modelPicker.replaceBuiltInOptions` | <Documented /> | boolean | `false` | Set `true` to show only these rows, **Default**, and the current model. Unset adds these rows after the built-in lineup. | User or managed settings |
| `modelPricing` | <Documented /> <ManagedOnly /> | object | - | Report spend at your organization's contracted rates instead of list price. `overrides` maps a model ID to USD rates per million tokens. The figures stay estimates. | Managed settings only |
| `modelPricing.multiplier` | <Documented /> | number above 0, up to 10 | - | Scales every cost Claude Code computes. Below 1 is a discount. Above 1 is a markup. | Managed settings only |
| `modelPricing.overrides.*.cacheRead` | <Documented /> | number, 0 to 10000 | - | USD per million cache-read tokens for this model ID. A row needs all four rates. | Managed settings only |
| `modelPricing.overrides.*.cacheWrite` | <Documented /> | number, 0 to 10000 | - | USD per million cache-write tokens for this model ID. It covers five-minute and one-hour writes. | Managed settings only |
| `modelPricing.overrides.*.input` | <Documented /> | number, 0 to 10000 | - | USD per million input tokens for this model ID. | Managed settings only |
| `modelPricing.overrides.*.output` | <Documented /> | number, 0 to 10000 | - | USD per million output tokens for this model ID. | Managed settings only |
| `modelSettings` | <Documented /> | object: model name to `{effortLevel, maxEffortLevel, autoCompactWindow}` | - | Keep a saved effort level (`low`, `medium`, `high`, `xhigh`), a top effort cap (`maxEffortLevel`), or an auto-compact window (`"auto"` or 100000 to 1000000 tokens) for each model. `/autocompact` saves here. Claude Code drops invalid values. Across settings files the lowest cap wins. Source: the program. | Any settings file |
| `modelSettings.*.autoCompactWindow` | <Documented /> | `"auto"` or 100000 to 1000000 | - | Set the auto-compact window for one model, in tokens. `"auto"` uses the window tuned for the model. In one settings file it replaces the top-level `autoCompactWindow` for that model. `/autocompact` saves here. | Any settings file |
| `modelSettings.*.effortLevel` | <Documented /> | `low`, `medium`, `high`, or `xhigh` | - | The saved effort level for one model. In one settings file it takes precedence over the top-level `effortLevel`. | Any settings file |
| `modelSettings.*.maxEffortLevel` | <Documented /> | `low`, `medium`, `high`, `xhigh`, or `max` | - | The top effort level for one model. In one settings file it replaces the top-level `maxEffortLevel` for that model. `max` removes the cap. Across settings files the lowest cap wins. | Any settings file |
| `promptCacheTtl` | <Documented /> | string | - | Choose the prompt cache lifetime for the main conversation. The values are `5m` or `1h`. When unset, it is 1 hour on a subscription and 5 minutes on an API key or cloud provider. `CLAUDE_CODE_PROMPT_CACHE_TTL` wins. | Any settings file |
| `showThinkingSummaries` | <Documented /> | boolean | - | See summaries of Claude's thinking instead of a collapsed stub. | Any settings file |
| `subagentPromptCacheTtl` | <Documented /> | string | - | Choose the prompt cache lifetime for subagent requests. The values are `5m` or `1h`. When unset, it is 5 minutes unless `ENABLE_PROMPT_CACHING_1H=1`. `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL` wins. | Any settings file |
| `switchModelsOnFlag` | <Documented /> | boolean | - | Switch models automatically or pause when a safety classifier flags a request. | Any settings file |
| `totalTokensReminder` | <Undocumented /> | enum: `off`, `infinite`, `fixed`, `countdown`, `padded-countdown` | `padded-countdown`, else `off` | Add a "tokens left" reminder to the system prompt and after each tool result. Modes: `off`, `infinite`, `fixed`, `countdown`, `padded-countdown`. The default is `padded-countdown` for a model that carries the `total_tokens_reminder` capability, and `off` for one that does not. Sonnet 5.5 and Opus 5.5 lost that capability in `2.1.314`. `CLAUDE_CODE_TOTAL_TOKENS_REMINDER` wins. | Settings files |
| `totalTokensReminderAfterUserTurn` | <Undocumented /> | boolean | On | Repeat the "tokens left" reminder after each user prompt. When off, it shows only in the system prompt and after tool results. `CLAUDE_CODE_TOTAL_TOKENS_REMINDER_AFTER_USER_TURN` wins. | Settings files |
| `totalTokensReminderBudget` | <Undocumented /> | integer | `15000000` | Set the starting token budget of `padded-countdown`. `CLAUDE_CODE_TOTAL_TOKENS_REMINDER_BUDGET` wins. | Settings files |

## Example

### Opus at High Effort with a Fallback

This file starts each session on Opus at high effort. If Opus is overloaded, Claude Code tries Sonnet. The main conversation keeps its prompt cache for one hour.

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "model": "opus",
  "effortLevel": "high",
  "fallbackModel": ["sonnet"],
  "promptCacheTtl": "1h"
}
```

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Model and Effort Variables](../env-vars/models-and-effort.md) lists the variables that win over these keys.
- [Models](../../how-it-works/models.md) explains how Claude Code makes model, effort, and retry choices.
- [Models and Providers](../models-and-providers/index.md) lists the model catalog and aliases.
- [Model Configuration](https://code.claude.com/docs/en/model-config) explains aliases and effort in the official docs.
