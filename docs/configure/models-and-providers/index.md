---
title: Models and Providers
description: The model catalog, every alias, effort and thinking controls, provider names for Bedrock, Vertex, Foundry, and Mantle, gateways, pricing, and capability flags.
sidebar_position: 1
---

Claude Code has a built-in list of 22 models.
It also knows the model names of each cloud provider, and a set of short aliases such as `opus`.
You choose a model with a flag, an environment variable, a setting, or the `/model` command.
For example, run `claude --model opus`. Or set `ANTHROPIC_MODEL`, `ANTHROPIC_DEFAULT_*_MODEL`, or the `model` and `modelOverrides` settings.
Pick a provider with `CLAUDE_CODE_USE_BEDROCK` and its siblings. Limit choices with `availableModels`.
Settings live in `~/.claude/settings.json` (user), `.claude/settings.json` (project), managed settings, and your shell environment.
The pages below list every model, alias, and provider switch. To see how Claude Code makes the choice at run time, read [Models](../../how-it-works/models.md).

## Pages in This Section

| Page | What it holds |
| --- | --- |
| [Model Catalog, Aliases, and Pricing](model-catalog.md) | How to choose a model, the aliases, the catalog, other model IDs, pricing, and capability flags. |
| [Effort, Thinking, and Fallback](effort-thinking-and-fallback.md) | The effort levels, the thinking controls, fallback models, retries, and automatic switches. |
| [Providers and Gateways](providers.md) | The provider switches, endpoint and region variables, provider model names, Vertex regions, and gateways. |
| [Fast Mode](fast-mode.md) | Where fast mode works, its controls, models, Vertex regions, texts, fallback to standard speed, and request field. |

## Example

Pin Opus and Sonnet on Amazon Bedrock. Then start Claude Code on a 1M window of Opus.

```bash
export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1
export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-8'
export ANTHROPIC_DEFAULT_SONNET_MODEL='us.anthropic.claude-sonnet-4-5-20250929-v1:0'
claude --model opus[1m] --effort high
```

Limit what users can pick in managed settings:

```json title="managed-settings.json"
{
  "availableModels": ["sonnet", "claude-opus-4-8"],
  "modelOverrides": {
    "claude-opus-4-8": "arn:aws:bedrock:us-east-2:123456789012:application-inference-profile/opus-prod"
  }
}
```

## Related Pages

- [Models](../../how-it-works/models.md)
- [Request and Cache](../../how-it-works/request-and-cache.md)
- [The System Prompt](../../how-it-works/system-prompt.md)
- [Settings](../settings/index.md), [Environment Variables](../env-vars/index.md), and [CLI](../cli/index.md) pages in Configure.
