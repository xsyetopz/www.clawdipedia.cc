---
title: Fast Mode
description: Where fast mode works, its controls, the models and Vertex regions that support it, the texts it prints, the fallback to standard speed, and the request field it sends.
sidebar_position: 5
---

Fast mode asks the API for faster output from the same model at a higher price. Use it when you want quicker answers and accept the higher cost. Turn it on with `/fast`, the flag `--fast-mode`, or the setting `fastMode`. Fast mode also works on Vertex in the regions `global`, `us`, and `eu`.[^v322]

## Example

Start a print-mode session on Vertex with fast mode on:

```bash
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID=my-project
export CLOUD_ML_REGION=us-east5
export VERTEX_REGION_CLAUDE_FABLE_5_2=global
claude -p --model claude-fable-5-2 --fast-mode on "Reply with 'OK'."
```

## Where Fast Mode Works

Claude Code has one capability name for each provider that supports fast mode.[^capability]

| Provider | Status | Capability | Result of `/fast on` |
| --- | --- | --- | --- |
| Anthropic API (`firstParty`) | <Documented /> | `fast_mode` | Fast mode goes on.[^fast-first-party] |
| Vertex | <Differs /> | `vertex_fast_mode` | Fast mode goes on in the regions `global`, `us`, and `eu`.[^fast-vertex-regions] |
| Each other provider | <Documented /> | None | `Fast mode is not available on this provider`.[^fast-other] |

The official page [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#requirements), section "Requirements", says that fast mode is not available on Google Cloud's Agent Platform. Claude Code `2.1.328` supports it there.
For all other providers the text is `Fast mode is not available on this provider`.[^provider-text]

## Controls

| Item | Status | What it does |
| --- | --- | --- |
| `/fast` `[on\|off]` | <Documented /> | Without an argument, it opens a panel in the interactive terminal, and it toggles fast mode in print mode.[^fast-toggle] Another argument gives `Unknown argument "maybe". Use: /fast [on\|off]`.[^fast-bad-arg] |
| `--fast-mode <on\|off>` | <Undocumented /> | Sets `fastMode` in the flag settings of the session.[^fast-flag] Another value does nothing. On Vertex with `--fast-mode on`, `/fast on` works in print mode, and a prompt on `claude-fable-5-2` goes out with `speed: "fast"`.[^fast-flag-case] |
| `fastMode` | <Differs /> | On the Anthropic API, `true` in a settings file starts each session with fast mode on. On Vertex, Claude Code ignores a saved value: only a flag setting (`--settings '{"fastMode": true}'` or `--fast-mode on`) or `/fast` turns fast mode on.[^fast-mode-vertex] The description of the key ends with `On Vertex a saved value is ignored: use /fast each session.`[^fast-mode-text] The official docs do not state the Vertex rule. |
| `fastModePerSessionOptIn` | <Documented /> | Each session starts with fast mode off. In managed settings, it also refuses `/fast on` outside the interactive terminal. |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | <Documented /> | Turns fast mode off on each provider. On Vertex, `/fast on` then gives `Fast mode is not available`.[^fast-disabled] |
| `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK`, `CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS` | <Documented /> | Change the organization check on the Anthropic API. On Vertex, Claude Code makes no organization check, so they do nothing there.[^org-check] |
| `CLAUDE_CODE_MODEL_CAPABILITIES` | <Undocumented /> | The capabilities `fast_mode` and `vertex_fast_mode` turn fast mode on or off for a model. See [Models](#models). |
| `CLOUD_ML_REGION`, `VERTEX_REGION_CLAUDE_FABLE_5_2` | <Differs /> | Set the Vertex region that fast mode checks. See [Vertex Regions](#vertex-regions). |
| `chat:fastMode` (`meta+o`) | <Documented /> | The keybinding action for fast mode.[^keybinding] |

In print mode, `/fast` works only when a flag setting has `fastMode: true`.
Without it, or with `--settings '{"fastMode": false}'`, the result is `Fast mode unavailable: Fast mode is not available in the Agent SDK`.[^fast-print]
See [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#toggle-fast-mode), section "Toggle fast mode".[^toggle-source]

## Models

A model supports fast mode when its catalog entry has the capability of the provider.[^model-support]

| Provider | Models | Default fast model |
| --- | --- | --- |
| Anthropic API | `claude-opus-4-8`, `claude-opus-5`, `claude-opus-5-5`, `claude-fable-5-2`, `claude-mythos-5-2`[^catalog-first-party] | `opus`, or `opus[1m]`[^default-fast] |
| Vertex | `claude-fable-5-2`, `claude-mythos-5-2`[^catalog-vertex] | `claude-fable-5-2` |

On the Anthropic API, a name that the catalog does not know supports fast mode when it contains `opus-4-8` or `opus-5`. On Vertex, such a name does not.
The official page names Fable 5.2, Opus 5.5, Opus 5, and Opus 4.8. The entry for `claude-mythos-5-2` is from the program only (<Undocumented />).

When the current model does not support fast mode, `/fast on` also changes the model to the default fast model. The result text then has `model set to`:

| Provider and model | Result text |
| --- | --- |
| Vertex, `claude-opus-5-5`[^case-vertex-global] | ``↯ Fast mode ON · model set to `Fable 5.2` · 2x Fable 5.2 standard price (this session only)`` |
| Vertex, `claude-fable-5-2`[^case-vertex-fable] | `↯ Fast mode ON · 2x Fable 5.2 standard price (this session only)` |
| Vertex, `claude-mythos-5-2`[^case-vertex-mythos] | `↯ Fast mode ON · 2x Mythos 5.2 standard price (this session only)` |
| Anthropic API, `claude-sonnet-5`[^case-first-party-sonnet] | ``↯ Fast mode ON · model set to `Opus 5.5` · $8/$40 per Mtok (this session only)`` |
| Anthropic API, `claude-opus-5-5`[^fast-first-party] | `↯ Fast mode ON · $8/$40 per Mtok (this session only)` |

A run as a Vertex client shows the change in the requests.[^vertex-run] The session starts with `--model claude-opus-5-5` and gets the prompts `Reply with 'OK'.`, `/fast on`, `Reply with 'OK'.`, `/fast off`, and `Reply with 'OK'.`:

1. Request 1 goes to `…/models/claude-opus-5-5:streamRawPredict` and has no `speed` field.
2. After `/fast on`, request 2 goes to `…/models/claude-fable-5-2:streamRawPredict` and has `"speed":"fast"`.
3. After `/fast off`, request 3 goes to `claude-fable-5-2` and has no `speed` field. The model does not change back.

### Capability Override

`CLAUDE_CODE_MODEL_CAPABILITIES` wins over the catalog (<Undocumented />).

| Value | Result |
| --- | --- |
| `claude-opus-5-5=vertex_fast_mode` on Vertex[^case-cap-on] | `↯ Fast mode ON · 2x Opus 5.5 standard price (this session only)`. The model stays `claude-opus-5-5`, and `fast_mode_state` is `on`. |
| `claude-fable-5-2=-vertex_fast_mode` on Vertex, model `claude-fable-5-2`[^case-cap-off] | The text says `Fast mode ON`, but `fast_mode_state` stays `off`. With the same value, the next request has no `speed` field. |
| `claude-sonnet-5=fast_mode` on the Anthropic API[^case-cap-first-party] | `↯ Fast mode ON · $2/$10 per Mtok (this session only)`. The model stays `claude-sonnet-5`. |

### Fable 5.2 and Mythos 5.2

On `claude-fable-5-2` and `claude-mythos-5-2`, fast mode is on only after you chose it on one of these two models.[^fable-choice]
A flag setting with `fastMode: true` counts as that choice for the session.[^fable-flag]
On the Anthropic API, `/fast` in the interactive terminal saves the choice in `.claude.json` as `fastModeChosenOnFableOrMythos` (<Undocumented />).[^fable-key] The value is `true` when the model is one of these two, and `false` for each other model. On Vertex, the choice lasts for the session only.
See [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#switch-models-while-fast-mode-is-on), section "Switch models while fast mode is on".[^fable-source]

## Vertex Regions

On Vertex, fast mode needs the region `global`, `us`, or `eu`.[^region-need]
Claude Code checks the region of the current model when that model supports fast mode. If not, it checks the region of `claude-fable-5-2`.[^region-check]
The region of a model is the value of its `VERTEX_REGION_*` variable. When that variable is not set, or the model has none, it is the default Vertex region, which `CLOUD_ML_REGION` sets.[^region-default]
The refusal text names the variable of the checked model, and `CLOUD_ML_REGION` for a model without one.[^region-text]

| Region variables | Result |
| --- | --- |
| `CLOUD_ML_REGION` is `global`, `us`, or `eu`[^case-region-ok] | Fast mode ON |
| `CLOUD_ML_REGION=us-east5`[^case-region-east5] | `Fast mode unavailable: Fast mode needs Vertex region global, us or eu · set VERTEX_REGION_CLAUDE_FABLE_5_2 to one of them and restart`, with the reason `disabled_by_env` |
| `CLOUD_ML_REGION=us-east5`, `VERTEX_REGION_CLAUDE_FABLE_5_2=eu`[^case-region-model] | Fast mode ON |
| `CLOUD_ML_REGION=global`, `VERTEX_REGION_CLAUDE_FABLE_5_2=europe-west1`[^case-region-bad] | The same refusal as for `us-east5` |
| `CLOUD_ML_REGION=global`, `VERTEX_REGION_CLAUDE_MYTHOS_5_2=us-east5`, model `claude-mythos-5-2`[^case-region-mythos] | Fast mode ON. Claude Code reads no region variable for Mythos 5.2. |

## What `/fast` Saves

| Where | What `/fast on` writes | The ON text ends with |
| --- | --- | --- |
| Anthropic API, interactive terminal | `fastMode: true` in the user settings file, and `fastModeChosenOnFableOrMythos` in `.claude.json` | Nothing |
| Anthropic API, print mode | No file. It sets `fastMode` in the flag settings of the session. | `(this session only)` |
| Vertex | No file. It sets `fastMode` in the flag settings of the session. | `(this session only)` |

On the Anthropic API in the interactive terminal, `/fast off` removes `fastMode` from the user settings file.
In print mode, the off text is `Fast mode OFF (this session only)`.[^case-off] In the interactive terminal, it is `Fast mode OFF`, on Vertex too.
With a remote workspace, Claude Code sends `fastMode` and the model to the workspace in the control request `apply_flag_settings`.[^remote-workspace]

## Availability Reasons and Texts

When fast mode cannot go on, `/fast on` prints `Fast mode unavailable:` and a text.[^unavailable-prefix] The stream-json `result` event has the reason in `fast_mode_disabled_reason`.[^reason-field]
In the print cases, the texts for `not_first_party` and for `CLAUDE_CODE_DISABLE_FAST_MODE` come without that prefix.

| Reason | Status | Text | When |
| --- | --- | --- | --- |
| `not_first_party` | <Differs /> | `Fast mode is not available on this provider` | The provider is not the Anthropic API or Vertex. The docs say: a provider other than the Anthropic API. |
| `disabled_by_env` | <Documented /> | `Fast mode is not available` | `CLAUDE_CODE_DISABLE_FAST_MODE` is set. |
| `disabled_by_env` | <Undocumented /> | `Fast mode needs Vertex region global, us or eu · set VERTEX_REGION_CLAUDE_FABLE_5_2 to one of them and restart` | The Vertex region is not `global`, `us`, or `eu`. The variable is the one of the checked model. |
| `model_not_allowed` | <Differs /> | `<model> is not in your organization's allowed models` | `availableModels` does not allow the default fast model, and the current model cannot run fast mode. Claude Code also gives this reason after Vertex refuses fast mode for the model with status `400`, which the docs do not state. |
| `preference` | <Documented /> | `Fast mode has been disabled by your organization` | Managed settings have `fastMode: false`, or `fastModePerSessionOptIn: true` outside the interactive terminal, or the organization turned fast mode off. |
| `sdk_opt_in_required` | <Documented /> | `Fast mode is not available in the Agent SDK` | Print mode or the SDK without `fastMode: true` in the flag settings. |
| `pending` | <Undocumented /> | `Checking fast mode availability` | The organization check is not complete. Anthropic API only. |
| `free` | <Documented /> | `Fast mode requires a paid subscription`, or `Fast mode unavailable during evaluation. Please purchase credits.` with an API key | Anthropic API only.[^free] |
| `extra_usage_disabled` | <Documented /> | `Fast mode requires usage credits` | Anthropic API only. |
| `network_error` | <Documented /> | `Fast mode unavailable due to network connectivity issues` | Anthropic API only. |
| `unknown` | <Documented /> | `Fast mode is currently unavailable` | Anthropic API only, or a server gate that turns fast mode off. |

The reason names are from [Agent SDK Reference: TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage), section "`SDKResultMessage`". The texts are from [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#requirements), section "Requirements", and the program.[^reason-source]
The official pages do not have the texts for `not_first_party`, `sdk_opt_in_required`, and `pending`, or the text `Fast mode requires a paid subscription`.

## Fallback to Standard Speed

When a request with `speed: "fast"` fails, Claude Code sends it again at standard speed.[^fallback]

| Provider | Response | Status | What Claude Code does |
| --- | --- | --- | --- |
| Vertex | `400` with `fast mode`, `speed: extra inputs`, or `` `speed` parameter `` in the message | <Undocumented /> | Uses standard speed for that model until the session ends. The reason becomes `model_not_allowed`. `/fast on` clears it. |
| Vertex | `403` or `404` | <Undocumented /> | Starts a cooldown of 30 minutes with the reason `refused`. `fast_mode_state` is `cooldown`. |
| Each | `429`, or an overloaded error | <Documented /> | When the response asks for a wait below 20 seconds, Claude Code waits and tries fast mode again. If not, it starts a cooldown with the reason `rate_limit` or `overloaded`. The cooldown is the time from the response, and at least 10 minutes. It is 30 minutes when the response gives no time.[^cooldown] The docs do not give the times. |
| Each | A `429` with the header `anthropic-ratelimit-unified-overage-disabled-reason` | <Documented /> | Sends the request again at standard speed without a cooldown. For a reason that means no credits are left, it shows the notification `fast-mode-overage-rejected` one time for each turn.[^overage] |

The test for a Vertex refusal does not run on the Anthropic API.[^vertex-refusal]
A run with a stub that refuses each fast request (`provider: "vertex"`, `fastRefusal`) gave these results on `claude-fable-5-2`:[^refusal-run]

| `fastRefusal` | Requests | `fast_mode_state` | `fast_mode_disabled_reason` | Debug log line |
| --- | --- | --- | --- | --- |
| `400` | 2 | `off` | `model_not_allowed` | `Fast mode rejected for claude-fable-5-2; using standard speed for it this session` |
| `403` | 2 | `cooldown` | None | `Fast mode cooldown triggered (refused), duration 1800s` |
| `404` | 2 | `cooldown` | None | Not read |

The `/fast` panel shows one of these lines during a cooldown, by the reason:[^cooldown-panel]

- `Fast mode is busy right now` for `overloaded`
- `Fast mode paused: your cloud provider refused a fast request`, with ` · trying again in ` and the time, for `refused`
- `You've hit your fast limit`, with ` · resets in ` and the time, for `rate_limit`

A notification shows when the cooldown starts, by the reason:[^cooldown-texts]

- `Fast mode is busy right now · resets in` and the time
- `Fast limit reached, fast mode paused · resets in` and the time
- `Fast mode paused: your cloud provider refused a fast request · trying again in` and the time

When the cooldown ends, a notification shows `Trying fast mode again` after a `refused` cooldown. Other cooldowns show `Fast limit reset · now using fast mode`.[^cooldown-end]

When the cooldown ends, the debug log has `Fast mode cooldown expired, re-enabling fast mode`.
See [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#handle-rate-limits), section "Handle rate limits".[^cooldown-source]

## Request

A fast request has `speed: "fast"` in the body.[^speed-body]

| Run | Provider | `speed` | Beta `fast-mode-2026-02-01` |
| --- | --- | --- | --- |
| Print case[^case-request-first-party] | Anthropic API, `--settings '{"fastMode": true}'` | `fast` | In the header `anthropic-beta` |
| Print case[^case-request-off] | Anthropic API, no settings | Not sent | Not sent |
| Print case[^case-request-disabled] | Anthropic API, `CLAUDE_CODE_DISABLE_FAST_MODE=1` | Not sent | Not sent |
| cc-inspect `code` `cli`, `provider: "vertex"` | Vertex, `claude-fable-5-2` | `fast` | Not sent. The body has `"anthropic_version":"vertex-2023-10-16"`. |

The system prompt has one sentence about fast mode. On Vertex, it ends with `switches the session to a model that does`. On the Anthropic API, it ends with `switches the session to Claude Opus`.[^system-prompt]

## Price Text

The text after `Fast mode ON` depends on the provider.[^price-text]
On the Anthropic API, it is the fast price of the model, such as `$8/$40 per Mtok`. On Vertex, it is `2x <model> standard price`.
The panel says `Draws from usage credits at a higher rate` on the Anthropic API and `Billed at a higher rate` on Vertex.

Claude Code holds these fast prices in US dollars for each million tokens:[^prices]

| Model | Status | Input | Output | Cache write (5 minutes) | Cache write (1 hour) | Cache read |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-fable-5-2`, `claude-mythos-5-2` | <Documented /> | 16 | 80 | 20 | 32 | 0.4 |
| `claude-opus-5-5` | <Documented /> | 8 | 40 | 10 | 16 | 0.4 |
| `claude-opus-4-8`, `claude-opus-5` | <Documented /> | 10 | 50 | 12.5 | 20 | 1 |
| `claude-opus-4-6`, `claude-opus-4-7` | <Undocumented /> | 30 | 150 | 37.5 | 60 | 3 |
| `claude-sonnet-5` | <Undocumented /> | 2 | 10 | 2.5 | 4 | 0.2 |

The official page gives the input and output prices of the first three rows for Fable 5.2, Opus 5.5, Opus 5, and Opus 4.8. The cache prices, the Mythos 5.2 entry, and the last two rows are from the program.
The last two rows apply when a capability override turns fast mode on for another model.[^case-cap-first-party] A model that is not in the first four rows gets its price from the model catalog of the program, as `claude-sonnet-5` does.[^price-tier] Only a model with no catalog price gets 30 and 150.

## The Panel

In the interactive terminal, `/fast` without an argument opens a panel.[^panel]

| Part | Text |
| --- | --- |
| Title | `Fast mode`, and `(research preview)` for some models |
| Subtitle | `High-speed mode for <model>. Draws from usage credits at a higher rate. Separate rate limits apply.` On Vertex, `Billed` replaces `Draws from usage credits`. |
| Keys | Space toggles, Enter confirms, Escape cancels |
| Progress | `Running PreModelSwitch hooks…`, `Applying fast mode…`, `Waiting for the workspace…` |
| Results | `Kept Fast mode ON`, `Kept Fast mode OFF`, `Fast mode OFF`, `Fast mode unchanged (cancelled)`, `Fast mode was not changed: applying it failed`, `Fast mode was not changed: the PreModelSwitch check failed` |
| Link | `https://code.claude.com/docs/en/fast-mode` |

No pty probe covers the panel on Vertex. These texts are from the program.

## Result Fields

Each stream-json `result` event has the fast mode state.[^result-state]

| Field | Status | Values |
| --- | --- | --- |
| `fast_mode_state` | <Documented /> | `off`, `cooldown`, `on` |
| `fast_mode_disabled_reason` | <Documented /> | `free`, `preference`, `extra_usage_disabled`, `network_error`, `unknown`, `not_first_party`, `disabled_by_env`, `model_not_allowed`, `sdk_opt_in_required`, `pending`. It is absent when nothing blocks fast mode, and during a cooldown. |

See [Agent SDK Reference: TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage), section "`SDKResultMessage`".

The `result` event of a `/fast on` turn that also changes the model has `fast_mode_state: "off"`. The next request has `speed: "fast"`, and its `result` event has `on`.[^result-switch]

## Related Pages

- [Models and Providers](index.md) lists the pages of this section and shows an example.
- [Providers and Gateways](providers.md) lists the Vertex region variables.
- [Model Catalog, Aliases, and Pricing](model-catalog.md) lists the capabilities of each model.
- [Models and Effort](../env-vars/models-and-effort.md) lists the fast mode environment variables.

## Sources

[^v322]: The program, `chunk-xethrx83.js:386835` (the regions `global`, `us`, and `eu`) and `chunk-xethrx83.js:386894`. Every program offset on this page is from the program `2.1.328`.
[^capability]: The program, `chunk-xethrx83.js:384776`.
[^fast-first-party]: Probe case `print.cli322.fast-first-party`.
[^fast-vertex-regions]: Probe cases `print.cli322.fast-vertex-global`, `.fast-vertex-us`, `.fast-vertex-eu`.
[^fast-other]: Probe cases for Bedrock and Foundry: `print.cli322.fast-bedrock`, `.fast-foundry`.
[^provider-text]: The program, `chunk-xethrx83.js:387115`.
[^fast-toggle]: Probe case `print.cli322.fast-vertex-toggle`.
[^fast-bad-arg]: Probe case `print.cli322.fast-vertex-bad-argument`. The program, `chunk-hve1957v.js:22673`.
[^fast-flag]: The program, `chunk-fax8acnd.js:3817`.
[^fast-flag-case]: Probe case `print.cli322.fast-vertex-flag`, and a cc-inspect run for the `speed: "fast"` field.
[^fast-mode-vertex]: The program, `chunk-xethrx83.js:388233`.
[^fast-mode-text]: The program, `chunk-jkpzhr7r.js:280817`.
[^fast-disabled]: Probe case `print.cli322.fast-vertex-disabled`.
[^org-check]: The program, `chunk-xethrx83.js:385001`.
[^keybinding]: The program, `chunk-g4fdykqa.js:1721`.
[^fast-print]: Probe cases `print.cli322.fast-vertex-no-settings` and `.fast-vertex-settings-off`.
[^toggle-source]: The program, `chunk-xethrx83.js:387115`, and the official page section cited in the sentence.
[^model-support]: The program, `chunk-xethrx83.js:388859`.
[^catalog-first-party]: The program, `chunk-b60sxmve.js:14294`, `chunk-b60sxmve.js:15286`, `chunk-b60sxmve.js:16390`, `chunk-b60sxmve.js:19592`, `chunk-b60sxmve.js:21715`.
[^default-fast]: The program, `chunk-xethrx83.js:387948`.
[^catalog-vertex]: The program, `chunk-b60sxmve.js:19605`, `chunk-b60sxmve.js:21728`.
[^case-vertex-global]: Probe case `print.cli322.fast-vertex-global`.
[^case-vertex-fable]: Probe case `print.cli322.fast-vertex-fable`.
[^case-vertex-mythos]: Probe case `print.cli322.fast-vertex-mythos`.
[^case-first-party-sonnet]: Probe case `print.cli322.fast-first-party-sonnet`.
[^vertex-run]: A run of the cc-inspect `code` action `cli` as a Vertex client.
[^case-cap-on]: Probe case `print.cli322.fast-vertex-capability-on`.
[^case-cap-off]: Probe case `print.cli322.fast-vertex-capability-off`. A cc-inspect run with the same value showed the next request without a `speed` field.
[^case-cap-first-party]: Probe case `print.cli322.fast-capability-first-party`.
[^fable-choice]: The program, `chunk-xethrx83.js:392670`, `chunk-xethrx83.js:392774`.
[^fable-flag]: The program, `chunk-xethrx83.js:392893`.
[^fable-key]: The program, `chunk-xethrx83.js:393073`.
[^fable-source]: The program, `chunk-xethrx83.js:392729`, and the official page section cited in the sentence.
[^region-need]: The program, `chunk-xethrx83.js:386894`, `chunk-xethrx83.js:387310`.
[^region-check]: The program, `chunk-xethrx83.js:386920`, `chunk-xethrx83.js:386997`.
[^region-default]: The program, `chunk-51eneejf.js:5625`.
[^region-text]: The program, `chunk-51eneejf.js:5788`.
[^case-region-ok]: Probe cases `print.cli322.fast-vertex-global`, `.fast-vertex-us`, `.fast-vertex-eu`.
[^case-region-east5]: Probe case `print.cli322.fast-vertex-us-east5`.
[^case-region-model]: Probe case `print.cli322.fast-vertex-model-region`.
[^case-region-bad]: Probe case `print.cli322.fast-vertex-model-region-bad`.
[^case-region-mythos]: Probe case `print.cli322.fast-vertex-mythos-region`.
[^case-off]: Probe case `print.cli322.fast-vertex-off`.
[^remote-workspace]: The program, `chunk-43kcvxxw.js:2616`.
[^unavailable-prefix]: The program, `chunk-43kcvxxw.js:1905`.
[^reason-field]: The program, `chunk-xethrx83.js:386045`, `chunk-xethrx83.js:387115`.
[^free]: The program, `chunk-xethrx83.js:385623`.
[^reason-source]: The program, `chunk-xethrx83.js:387115`, and the official pages cited in the sentence.
[^fallback]: The program, `chunk-56bhcxay.js:3280250`.
[^cooldown]: The program, `chunk-56bhcxay.js:3282358`, `chunk-56bhcxay.js:3298145` (the 20-second wait limit and the 10-minute floor), `chunk-xethrx83.js:389377` (the 30-minute default), `chunk-xethrx83.js:389428`, `chunk-xethrx83.js:391481`.
[^overage]: The program, `chunk-xethrx83.js:394916`.
[^vertex-refusal]: The program, `chunk-56bhcxay.js:3293561`.
[^refusal-run]: A cc-inspect run.
[^cooldown-panel]: The program, `chunk-j2wfp6sf.js:576397`.
[^cooldown-texts]: The program, `chunk-j2wfp6sf.js:1941590-1942127`.
[^cooldown-end]: The program, `chunk-j2wfp6sf.js:1941590`.
[^cooldown-source]: The official page section cited in the sentence, and the program, `chunk-56bhcxay.js:3282358`.
[^speed-body]: The program, `chunk-56bhcxay.js:3375741`, `chunk-56bhcxay.js:3381872`.
[^case-request-first-party]: Probe case `print.cli322.fast-request-first-party`.
[^case-request-off]: Probe case `print.cli322.fast-request-first-party-off`.
[^case-request-disabled]: Probe case `print.cli322.fast-request-first-party-disabled`.
[^system-prompt]: The program, `chunk-56bhcxay.js:2895826`.
[^price-text]: The program, `chunk-43kcvxxw.js:1708`.
[^prices]: The program, `chunk-xethrx83.js:401462`, `chunk-xethrx83.js:405032`.
[^price-tier]: The program, `chunk-xethrx83.js:401045` for the 30 and 150 row and `chunk-xethrx83.js:401482` for the catalog price with that fallback.
[^panel]: The program, `chunk-j2wfp6sf.js:572428`.
[^result-state]: The program, `chunk-20bv8pca.js:467012`.
[^result-switch]: Probe case `print.cli322.fast-vertex-global` and the cc-inspect run in [Models](#models).
