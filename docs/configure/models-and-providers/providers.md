---
title: Providers and Gateways
description: The provider switches, endpoint and region variables, provider model names, Vertex region variables, and gateways.
sidebar_position: 4
---

## Providers

The program knows these provider keys: `first_party`, `bedrock`, `vertex`, `foundry`, `anthropic_aws`, `anthropic_google_cloud`, `mantle`, and `gateway`.
These environment variables choose the provider.
When you set several, the order is: gateway, Bedrock, Foundry, Claude Platform on AWS, Google Cloud, Mantle, Vertex.

| Env var | Status | Provider |
| --- | --- | --- |
| `CLAUDE_CODE_USE_BEDROCK` | <Documented /> | Amazon Bedrock. |
| `CLAUDE_CODE_USE_VERTEX` | <Documented /> | Google Cloud Agent Platform (Vertex). |
| `CLAUDE_CODE_USE_FOUNDRY` | <Documented /> | Microsoft Foundry. |
| `CLAUDE_CODE_USE_MANTLE` | <Documented /> | The Mantle endpoint of Amazon Bedrock. With Bedrock on, `anthropic.*` model IDs route to Mantle. |
| `CLAUDE_CODE_USE_ANTHROPIC_AWS` | <Documented /> | Claude Platform on AWS. |
| `CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD` | <Undocumented /> | Claude Platform on Google Cloud. |
| `CLAUDE_CODE_USE_GATEWAY` | <Undocumented /> | A host-managed gateway. It needs `ANTHROPIC_BASE_URL` and a token. |

The Anthropic API, `anthropic_aws`, `anthropic_google_cloud`, and `gateway` providers use the first-party names, so the name tables below leave them out.

### Endpoint and Region Variables

| Env var | Status | Provider | Effect |
| --- | --- | --- | --- |
| `ANTHROPIC_BEDROCK_BASE_URL` | <Documented /> | Bedrock | Overrides the endpoint URL. |
| `ANTHROPIC_BEDROCK_MANTLE_BASE_URL` | <Documented /> | Mantle | Overrides the Mantle endpoint. The default is `https://bedrock-mantle.<region>.api.aws`. |
| `ANTHROPIC_BEDROCK_REGION_PREFIX` | <Documented /> | Bedrock | Cross-region profile prefix that Claude Code tries first. |
| `ANTHROPIC_BEDROCK_SERVICE_TIER` | <Documented /> | Bedrock | Claude Code sends it in the `X-Amzn-Bedrock-Service-Tier` header. |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | <Documented /> | Bedrock, Mantle | Region of the Haiku-class model. |
| `AWS_REGION`, `AWS_DEFAULT_REGION`, `AWS_PROFILE` | <Documented /> | Bedrock | Standard AWS region and profile. The region order is: `AWS_REGION`, `AWS_DEFAULT_REGION`, shared config, `us-east-1`. |
| `ANTHROPIC_VERTEX_BASE_URL` | <Documented /> | Vertex | Overrides the endpoint URL. |
| `ANTHROPIC_VERTEX_PROJECT_ID` | <Documented /> | Vertex | The GCP project. It is the last choice after `GCLOUD_PROJECT` and `GOOGLE_CLOUD_PROJECT`. |
| `ANTHROPIC_FOUNDRY_BASE_URL` | <Documented /> | Foundry | The full base URL of the resource. It wins over the resource name. |
| `ANTHROPIC_FOUNDRY_RESOURCE` | <Documented /> | Foundry | The resource name. It builds `https://<resource>.services.ai.azure.com`. |
| `ANTHROPIC_AWS_BASE_URL`, `ANTHROPIC_AWS_WORKSPACE_ID` | <Documented /> | Claude Platform on AWS | Endpoint and workspace. |
| `ANTHROPIC_GOOGLE_CLOUD_BASE_URL`, `_LOCATION`, `_PROJECT`, `_WORKSPACE_ID` | <Undocumented /> | Claude Platform on Google Cloud | Endpoint, location, project, and workspace (full names start with `ANTHROPIC_GOOGLE_CLOUD`). |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH`, `CLAUDE_CODE_SKIP_VERTEX_AUTH`, `CLAUDE_CODE_SKIP_FOUNDRY_AUTH`, `CLAUDE_CODE_SKIP_MANTLE_AUTH`, `CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH` | <Documented /> | Each provider | Skip client-side auth, for a gateway that signs requests itself. |
| `CLAUDE_CODE_SKIP_ANTHROPIC_GOOGLE_CLOUD_AUTH` | <Undocumented /> | Claude Platform on Google Cloud | The same, for that provider. |

### Provider Names

Each cell is the model name for that provider. A dash means the provider has none.
A row is <Documented /> when a docs page such as Amazon Bedrock or Model Configuration names the model. A row is <Undocumented /> when only the program has the names.

| `id` | Status | `first_party` | `bedrock` | `vertex` | `foundry` | `mantle` |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-3-5-haiku` | <Undocumented /> | `claude-3-5-haiku-20241022` | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | `claude-3-5-haiku@20241022` | `claude-3-5-haiku` | - |
| `claude-haiku-4-5` | <Documented /> | `claude-haiku-4-5-20251001` | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | `claude-haiku-4-5@20251001` | `claude-haiku-4-5` | `anthropic.claude-haiku-4-5` |
| `claude-haiku-5-5` | <Documented /> | `claude-haiku-5-5` | `us.anthropic.claude-haiku-5-5` | `claude-haiku-5-5` | `claude-haiku-5-5` | `anthropic.claude-haiku-5-5` |
| `claude-3-5-sonnet` | <Undocumented /> | `claude-3-5-sonnet-20241022` | `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | `claude-3-5-sonnet-v2@20241022` | `claude-3-5-sonnet` | - |
| `claude-3-7-sonnet` | <Undocumented /> | `claude-3-7-sonnet-20250219` | `us.anthropic.claude-3-7-sonnet-20250219-v1:0` | `claude-3-7-sonnet@20250219` | `claude-3-7-sonnet` | - |
| `claude-sonnet-4-0` | <Undocumented /> | `claude-sonnet-4-20250514` | `us.anthropic.claude-sonnet-4-20250514-v1:0` | `claude-sonnet-4@20250514` | `claude-sonnet-4` | - |
| `claude-sonnet-4-5` | <Documented /> | `claude-sonnet-4-5-20250929` | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` | `claude-sonnet-4-5@20250929` | `claude-sonnet-4-5` | - |
| `claude-sonnet-4-6` | <Documented /> | `claude-sonnet-4-6` | `us.anthropic.claude-sonnet-4-6` | `claude-sonnet-4-6` | `claude-sonnet-4-6` | - |
| `claude-sonnet-5` | <Documented /> | `claude-sonnet-5` | `us.anthropic.claude-sonnet-5` | `claude-sonnet-5` | `claude-sonnet-5` | `anthropic.claude-sonnet-5` |
| `claude-sonnet-5-5` | <Documented /> | `claude-sonnet-5-5` | `us.anthropic.claude-sonnet-5-5` | `claude-sonnet-5-5` | `claude-sonnet-5-5` | `anthropic.claude-sonnet-5-5` |
| `claude-opus-4-0` | <Undocumented /> | `claude-opus-4-20250514` | `us.anthropic.claude-opus-4-20250514-v1:0` | `claude-opus-4@20250514` | `claude-opus-4` | - |
| `claude-opus-4-1` | <Documented /> | `claude-opus-4-1-20250805` | `us.anthropic.claude-opus-4-1-20250805-v1:0` | `claude-opus-4-1@20250805` | `claude-opus-4-1` | - |
| `claude-opus-4-5` | <Documented /> | `claude-opus-4-5-20251101` | `us.anthropic.claude-opus-4-5-20251101-v1:0` | `claude-opus-4-5@20251101` | `claude-opus-4-5` | - |
| `claude-opus-4-6` | <Documented /> | `claude-opus-4-6` | `us.anthropic.claude-opus-4-6-v1` | `claude-opus-4-6` | `claude-opus-4-6` | - |
| `claude-opus-4-7` | <Documented /> | `claude-opus-4-7` | `us.anthropic.claude-opus-4-7` | `claude-opus-4-7` | `claude-opus-4-7` | `anthropic.claude-opus-4-7` |
| `claude-opus-4-8` | <Documented /> | `claude-opus-4-8` | `us.anthropic.claude-opus-4-8` | `claude-opus-4-8` | `claude-opus-4-8` | `anthropic.claude-opus-4-8` |
| `claude-opus-5` | <Documented /> | `claude-opus-5` | `us.anthropic.claude-opus-5` | `claude-opus-5` | `claude-opus-5` | `anthropic.claude-opus-5` |
| `claude-opus-5-5` | <Documented /> | `claude-opus-5-5` | `us.anthropic.claude-opus-5-5` | `claude-opus-5-5` | `claude-opus-5-5` | `anthropic.claude-opus-5-5` |
| `claude-fable-5` | <Documented /> | `claude-fable-5` | `us.anthropic.claude-fable-5` | `claude-fable-5` | `claude-fable-5` | `anthropic.claude-fable-5` |
| `claude-fable-5-1` | <Documented /> | `claude-fable-5-1` | `us.anthropic.claude-fable-5-1` | `claude-fable-5-1` | `claude-fable-5-1` | `anthropic.claude-fable-5-1` |
| `claude-fable-5-2` | <Documented /> | `claude-fable-5-2` | `us.anthropic.claude-fable-5-2` | `claude-fable-5-2` | `claude-fable-5-2` | `anthropic.claude-fable-5-2` |
| `claude-mythos-5` | <Documented /> | `claude-mythos-5` | - | - | - | - |
| `claude-mythos-5-1` | <Undocumented /> | `claude-mythos-5-1` | - | - | - | - |
| `claude-mythos-5-2` | <Undocumented /> | `claude-mythos-5-2` | - | - | - | - |

### Vertex Region Variables

Each model has an environment variable that sets its region on Vertex. [Environment Variables](https://code.claude.com/docs/en/env-vars) in the official docs lists them.
The Mythos models have none, because they have no Vertex name.

| `id` | Status | Env var |
| --- | --- | --- |
| `claude-3-5-haiku` | <Documented /> | `VERTEX_REGION_CLAUDE_3_5_HAIKU` |
| `claude-haiku-4-5` | <Documented /> | `VERTEX_REGION_CLAUDE_HAIKU_4_5` |
| `claude-haiku-5-5` | <Documented /> | `VERTEX_REGION_CLAUDE_HAIKU_5_5` |
| `claude-3-5-sonnet` | <Documented /> | `VERTEX_REGION_CLAUDE_3_5_SONNET` |
| `claude-3-7-sonnet` | <Documented /> | `VERTEX_REGION_CLAUDE_3_7_SONNET` |
| `claude-sonnet-4-0` | <Documented /> | `VERTEX_REGION_CLAUDE_4_0_SONNET` |
| `claude-sonnet-4-5` | <Documented /> | `VERTEX_REGION_CLAUDE_4_5_SONNET` |
| `claude-sonnet-4-6` | <Documented /> | `VERTEX_REGION_CLAUDE_4_6_SONNET` |
| `claude-sonnet-5` | <Documented /> | `VERTEX_REGION_CLAUDE_5_SONNET` |
| `claude-sonnet-5-5` | <Documented /> | `VERTEX_REGION_CLAUDE_5_5_SONNET` |
| `claude-opus-4-0` | <Documented /> | `VERTEX_REGION_CLAUDE_4_0_OPUS` |
| `claude-opus-4-1` | <Documented /> | `VERTEX_REGION_CLAUDE_4_1_OPUS` |
| `claude-opus-4-5` | <Documented /> | `VERTEX_REGION_CLAUDE_4_5_OPUS` |
| `claude-opus-4-6` | <Documented /> | `VERTEX_REGION_CLAUDE_4_6_OPUS` |
| `claude-opus-4-7` | <Documented /> | `VERTEX_REGION_CLAUDE_4_7_OPUS` |
| `claude-opus-4-8` | <Documented /> | `VERTEX_REGION_CLAUDE_4_8_OPUS` |
| `claude-opus-5` | <Documented /> | `VERTEX_REGION_CLAUDE_5_OPUS` |
| `claude-opus-5-5` | <Documented /> | `VERTEX_REGION_CLAUDE_5_5_OPUS` |
| `claude-fable-5` | <Documented /> | `VERTEX_REGION_CLAUDE_FABLE_5` |
| `claude-fable-5-1` | <Documented /> | `VERTEX_REGION_CLAUDE_FABLE_5_1` |
| `claude-fable-5-2` | <Undocumented /> | `VERTEX_REGION_CLAUDE_FABLE_5_2` |

### Gateways

A gateway is a server between Claude Code and a model API.
Set `ANTHROPIC_BASE_URL` to point at it. That variable changes where requests go, not which model answers.
Pin the model IDs the gateway serves with the `ANTHROPIC_DEFAULT_*_MODEL` variables. Let the picker find them with `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`.
A gateway that does not serve `claude-fable-5-1` rejects it, so the `fable` alias falls back to `claude-fable-5` on gateways.

## Related Pages

- [Models and Providers](index.md) lists the pages of this section and shows an example.
