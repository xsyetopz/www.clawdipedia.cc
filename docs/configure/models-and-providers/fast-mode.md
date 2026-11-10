---
title: Fast Mode
description: Where fast mode works, its controls, the models and Vertex regions that support it, the texts it prints, the fallback to standard speed, and the request field it sends.
sidebar_position: 5
---

Fast mode asks the API for faster output from the same model at a higher price.
You turn it on with `/fast`, the flag `--fast-mode`, or the setting `fastMode`.
Since `2.1.322`, fast mode also works on Vertex in the regions `global`, `us`, and `eu` ([`2.1.322` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.322)).
The offsets on this page are from the program `2.1.322`.

## Where Fast Mode Works

The program has one capability name for each provider that supports fast mode (`chunk-yqezv9gr.js:387876`).

| Provider | Status | Capability | Result of `/fast on` |
| --- | --- | --- | --- |
| Anthropic API (`firstParty`) | <Documented /> | `fast_mode` | Fast mode goes on. Case: `print.cli322.fast-first-party`. |
| Vertex | <Differs /> | `vertex_fast_mode` | Fast mode goes on in the regions `global`, `us`, and `eu`. Cases: `print.cli322.fast-vertex-global`, `.fast-vertex-us`, `.fast-vertex-eu`. |
| Each other provider | <Documented /> | None | `Fast mode is not available on this provider`. Cases for Bedrock and Foundry: `print.cli322.fast-bedrock`, `.fast-foundry`. |

The official page [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#requirements), section "Requirements", says that fast mode is not available on Google Cloud's Agent Platform. The program `2.1.322` supports it there.
In `2.1.321`, the text for all other providers was `Fast mode is only available when using the Anthropic API directly`. Since `2.1.322`, it is `Fast mode is not available on this provider` (`chunk-yqezv9gr.js:390215`).

## Controls

| Item | Status | What it does |
| --- | --- | --- |
| `/fast` `[on\|off]` | <Documented /> | Without an argument, it opens a panel in the interactive terminal, and it toggles fast mode in print mode (case `print.cli322.fast-vertex-toggle`). Another argument gives `Unknown argument "maybe". Use: /fast [on\|off]` (case `print.cli322.fast-vertex-bad-argument`; `chunk-r6jbvj4z.js:19076`). |
| `--fast-mode <on\|off>` | <Undocumented /> | Sets `fastMode` in the flag settings of the session (`chunk-23mn5fhk.js:3597`). Another value does nothing. On Vertex with `--fast-mode on`, `/fast on` works in print mode (case `print.cli322.fast-vertex-flag`), and a prompt on `claude-fable-5-2` goes out with `speed: "fast"` (a cc-inspect run). |
| `fastMode` | <Differs /> | On the Anthropic API, `true` in a settings file starts each session with fast mode on. On Vertex, the program ignores a saved value: only a flag setting (`--settings '{"fastMode": true}'` or `--fast-mode on`) or `/fast` turns fast mode on (`chunk-yqezv9gr.js:391333`). Since `2.1.322`, the description of the key ends with `On Vertex a saved value is ignored: use /fast each session.` (`chunk-mttfbqwj.js:293469`). The official docs do not state the Vertex rule. |
| `fastModePerSessionOptIn` | <Documented /> | Each session starts with fast mode off. In managed settings, it also refuses `/fast on` outside the interactive terminal. |
| `CLAUDE_CODE_DISABLE_FAST_MODE` | <Documented /> | Turns fast mode off on each provider. On Vertex, `/fast on` then gives `Fast mode is not available` (case `print.cli322.fast-vertex-disabled`). |
| `CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK`, `CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS` | <Documented /> | Change the organization check on the Anthropic API. On Vertex, the program makes no organization check, so they do nothing there (`chunk-yqezv9gr.js:388101`). |
| `CLAUDE_CODE_MODEL_CAPABILITIES` | <Undocumented /> | The capabilities `fast_mode` and `vertex_fast_mode` turn fast mode on or off for a model. See [Models](#models). |
| `CLOUD_ML_REGION`, `VERTEX_REGION_CLAUDE_FABLE_5_2` | <Differs /> | Set the Vertex region that fast mode checks. See [Vertex Regions](#vertex-regions). |
| `chat:fastMode` (`meta+o`) | <Documented /> | The keybinding action for fast mode (`chunk-f3snxxsj.js:1539`). |

In print mode, `/fast` works only when a flag setting has `fastMode: true`.
Without it, or with `--settings '{"fastMode": false}'`, the result is `Fast mode unavailable: Fast mode is not available in the Agent SDK` (cases `print.cli322.fast-vertex-no-settings` and `.fast-vertex-settings-off`).
Source: [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#toggle-fast-mode), section "Toggle fast mode", and the program.

## Models

A model supports fast mode when its catalog entry has the capability of the provider (`chunk-yqezv9gr.js:391959`).

| Provider | Models | Default fast model |
| --- | --- | --- |
| Anthropic API | `claude-opus-4-8`, `claude-opus-5`, `claude-opus-5-5`, `claude-fable-5-2`, `claude-mythos-5-2` (`chunk-9s0rpt1f.js:14288`, `:15280`, `:16384`, `:19586`, `:21709`) | `opus`, or `opus[1m]` (`chunk-yqezv9gr.js:391048`) |
| Vertex | `claude-fable-5-2`, `claude-mythos-5-2` (`chunk-9s0rpt1f.js:19599`, `:21722`) | `claude-fable-5-2` |

On the Anthropic API, a name that the catalog does not know supports fast mode when it contains `opus-4-8` or `opus-5`. On Vertex, such a name does not.
The official page names Fable 5.2, Opus 5.5, Opus 5, and Opus 4.8. The entry for `claude-mythos-5-2` is from the program only (<Undocumented />).

When the current model does not support fast mode, `/fast on` also changes the model to the default fast model. The result text then has `model set to`:

| Case | Provider and model | Result text |
| --- | --- | --- |
| `print.cli322.fast-vertex-global` | Vertex, `claude-opus-5-5` | ``↯ Fast mode ON · model set to `Fable 5.2` · 2x Fable 5.2 standard price (this session only)`` |
| `print.cli322.fast-vertex-fable` | Vertex, `claude-fable-5-2` | `↯ Fast mode ON · 2x Fable 5.2 standard price (this session only)` |
| `print.cli322.fast-vertex-mythos` | Vertex, `claude-mythos-5-2` | `↯ Fast mode ON · 2x Mythos 5.2 standard price (this session only)` |
| `print.cli322.fast-first-party-sonnet` | Anthropic API, `claude-sonnet-5` | ``↯ Fast mode ON · model set to `Opus 5.5` · $8/$40 per Mtok (this session only)`` |
| `print.cli322.fast-first-party` | Anthropic API, `claude-opus-5-5` | `↯ Fast mode ON · $8/$40 per Mtok (this session only)` |

A run of the cc-inspect `code` action `cli` as a Vertex client shows the change in the requests. The session starts with `--model claude-opus-5-5` and gets the prompts `Reply with 'OK'.`, `/fast on`, `Reply with 'OK'.`, `/fast off`, and `Reply with 'OK'.`:

1. Request 1 goes to `…/models/claude-opus-5-5:streamRawPredict` and has no `speed` field.
2. After `/fast on`, request 2 goes to `…/models/claude-fable-5-2:streamRawPredict` and has `"speed":"fast"`.
3. After `/fast off`, request 3 goes to `claude-fable-5-2` and has no `speed` field. The model does not change back.

### Capability Override

`CLAUDE_CODE_MODEL_CAPABILITIES` wins over the catalog (<Undocumented />).

| Case | Value | Result |
| --- | --- | --- |
| `print.cli322.fast-vertex-capability-on` | `claude-opus-5-5=vertex_fast_mode` on Vertex | `↯ Fast mode ON · 2x Opus 5.5 standard price (this session only)`. The model stays `claude-opus-5-5`, and `fast_mode_state` is `on`. |
| `print.cli322.fast-vertex-capability-off` | `claude-fable-5-2=-vertex_fast_mode` on Vertex, model `claude-fable-5-2` | The text says `Fast mode ON`, but `fast_mode_state` stays `off`. In a cc-inspect run with the same value, the next request has no `speed` field. |
| `print.cli322.fast-capability-first-party` | `claude-sonnet-5=fast_mode` on the Anthropic API | `↯ Fast mode ON · $30/$150 per Mtok (this session only)`. The model stays `claude-sonnet-5`. |

### Fable 5.2 and Mythos 5.2

On `claude-fable-5-2` and `claude-mythos-5-2`, fast mode is on only after you chose it on one of these two models (`chunk-yqezv9gr.js:395769`, `:395873`).
A flag setting with `fastMode: true` counts as that choice for the session (`chunk-yqezv9gr.js:395992`).
On the Anthropic API, `/fast` in the interactive terminal saves the choice in `.claude.json` as `fastModeChosenOnFableOrMythos` (<Undocumented />, `chunk-yqezv9gr.js:396173`). The value is `true` when the model is one of these two, and `false` for each other model. On Vertex, the choice lasts for the session only.
Source: [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#switch-models-while-fast-mode-is-on), section "Switch models while fast mode is on", and the program.

## Vertex Regions

On Vertex, fast mode needs the region `global`, `us`, or `eu` (`chunk-yqezv9gr.js:389931`).
The program checks the region of the current model when that model supports fast mode. If not, it checks the region of `claude-fable-5-2` (`chunk-yqezv9gr.js:390038`).
The region of a model is the value of its `VERTEX_REGION_*` variable. When that variable is not set, or the model has none, it is the default Vertex region, which `CLOUD_ML_REGION` sets (`chunk-4qw1tk01.js:5607`).
The refusal text names the variable of the checked model, and `CLOUD_ML_REGION` for a model without one (`chunk-4qw1tk01.js:5768`).

| Case | Region variables | Result |
| --- | --- | --- |
| `print.cli322.fast-vertex-global`, `.fast-vertex-us`, `.fast-vertex-eu` | `CLOUD_ML_REGION` is `global`, `us`, or `eu` | Fast mode ON |
| `print.cli322.fast-vertex-us-east5` | `CLOUD_ML_REGION=us-east5` | `Fast mode unavailable: Fast mode needs Vertex region global, us or eu · set VERTEX_REGION_CLAUDE_FABLE_5_2 to one of them and restart`, with the reason `disabled_by_env` |
| `print.cli322.fast-vertex-model-region` | `CLOUD_ML_REGION=us-east5`, `VERTEX_REGION_CLAUDE_FABLE_5_2=eu` | Fast mode ON |
| `print.cli322.fast-vertex-model-region-bad` | `CLOUD_ML_REGION=global`, `VERTEX_REGION_CLAUDE_FABLE_5_2=europe-west1` | The same refusal as for `us-east5` |
| `print.cli322.fast-vertex-mythos-region` | `CLOUD_ML_REGION=global`, `VERTEX_REGION_CLAUDE_MYTHOS_5_2=us-east5`, model `claude-mythos-5-2` | Fast mode ON. The program reads no region variable for Mythos 5.2. |

## What `/fast` Saves

| Where | What `/fast on` writes | The ON text ends with |
| --- | --- | --- |
| Anthropic API, interactive terminal | `fastMode: true` in the user settings file, and `fastModeChosenOnFableOrMythos` in `.claude.json` | Nothing |
| Anthropic API, print mode | No file. It sets `fastMode` in the flag settings of the session. | `(this session only)` |
| Vertex | No file. It sets `fastMode` in the flag settings of the session. | `(this session only)` |

On the Anthropic API in the interactive terminal, `/fast off` removes `fastMode` from the user settings file.
In print mode, the off text is `Fast mode OFF (this session only)` (case `print.cli322.fast-vertex-off`). In the interactive terminal, it is `Fast mode OFF`, on Vertex too.
With a remote workspace, the program sends `fastMode` and the model to the workspace in the control request `apply_flag_settings`.
Source: the program (`chunk-28z06fjm.js:2543`).

## Availability Reasons and Texts

When fast mode cannot go on, `/fast on` prints `Fast mode unavailable:` and a text (`chunk-28z06fjm.js:1833`). The stream-json `result` event has the reason in `fast_mode_disabled_reason` (`chunk-yqezv9gr.js:389145`, `:390215`).
In the print cases, the texts for `not_first_party` and for `CLAUDE_CODE_DISABLE_FAST_MODE` come without that prefix.

| Reason | Status | Text | When |
| --- | --- | --- | --- |
| `not_first_party` | <Differs /> | `Fast mode is not available on this provider` | The provider is not the Anthropic API or Vertex. The docs say: a provider other than the Anthropic API. |
| `disabled_by_env` | <Documented /> | `Fast mode is not available` | `CLAUDE_CODE_DISABLE_FAST_MODE` is set. |
| `disabled_by_env` | <Undocumented /> | `Fast mode needs Vertex region global, us or eu · set VERTEX_REGION_CLAUDE_FABLE_5_2 to one of them and restart` | The Vertex region is not `global`, `us`, or `eu`. New in `2.1.322`. The variable is the one of the checked model. |
| `model_not_allowed` | <Differs /> | `<model> is not in your organization's allowed models` | `availableModels` does not allow the default fast model, and the current model cannot run fast mode. The program also gives this reason after Vertex refuses fast mode for the model with status `400`, which the docs do not state. |
| `preference` | <Documented /> | `Fast mode has been disabled by your organization` | Managed settings have `fastMode: false`, or `fastModePerSessionOptIn: true` outside the interactive terminal, or the organization turned fast mode off. |
| `sdk_opt_in_required` | <Documented /> | `Fast mode is not available in the Agent SDK` | Print mode or the SDK without `fastMode: true` in the flag settings. |
| `pending` | <Undocumented /> | `Checking fast mode availability` | The organization check is not complete. Anthropic API only. |
| `free` | <Documented /> | `Fast mode requires a paid subscription`, or `Fast mode unavailable during evaluation. Please purchase credits.` with an API key | Anthropic API only (`chunk-yqezv9gr.js:388723`). |
| `extra_usage_disabled` | <Documented /> | `Fast mode requires usage credits` | Anthropic API only. |
| `network_error` | <Documented /> | `Fast mode unavailable due to network connectivity issues` | Anthropic API only. |
| `unknown` | <Documented /> | `Fast mode is currently unavailable` | Anthropic API only, or a server gate that turns fast mode off. |

Source for the reason names: [Agent SDK Reference: TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage), section "`SDKResultMessage`". Source for the texts: [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#requirements), section "Requirements", and the program.
The official pages do not have the texts for `not_first_party`, `sdk_opt_in_required`, and `pending`, or the text `Fast mode requires a paid subscription`.

## Fallback to Standard Speed

When a request with `speed: "fast"` fails, the program sends it again at standard speed (`chunk-9r1hbf9p.js:2853411`).

| Provider | Response | Status | What the program does |
| --- | --- | --- | --- |
| Vertex | `400` with `fast mode`, `speed: extra inputs`, or `` `speed` parameter `` in the message | <Undocumented /> | Uses standard speed for that model until the session ends. The reason becomes `model_not_allowed`. `/fast on` clears it. |
| Vertex | `403` or `404` | <Undocumented /> | Starts a cooldown of 30 minutes with the reason `refused`. `fast_mode_state` is `cooldown`. |
| Each | `429`, or an overloaded error | <Documented /> | When the response asks for a wait below 20 seconds, the program waits and tries fast mode again. If not, it starts a cooldown with the reason `rate_limit` or `overloaded`. The cooldown is the time from the response, and at least 10 minutes. It is 30 minutes when the response gives no time (`chunk-9r1hbf9p.js:2869771`, `chunk-yqezv9gr.js:392469`). The docs do not give the times. |
| Each | A `429` with the header `anthropic-ratelimit-unified-overage-disabled-reason` | <Documented /> | Sends the request again at standard speed without a cooldown. For a reason that means no credits are left, it shows the notification `fast-mode-overage-rejected` one time for each turn (`chunk-yqezv9gr.js:398016`). |

The test for a Vertex refusal is at `chunk-9r1hbf9p.js:2865231`. It does not run on the Anthropic API.
A cc-inspect run with a stub that refuses each fast request (`provider: "vertex"`, `fastRefusal`) gave these results on `claude-fable-5-2`:

| `fastRefusal` | Requests | `fast_mode_state` | `fast_mode_disabled_reason` | Debug log line |
| --- | --- | --- | --- | --- |
| `400` | 2 | `off` | `model_not_allowed` | `Fast mode rejected for claude-fable-5-2; using standard speed for it this session` |
| `403` | 2 | `cooldown` | None | `Fast mode cooldown triggered (refused), duration 1800s` |
| `404` | 2 | `cooldown` | None | Not read |

The interactive terminal shows these texts during a cooldown (`chunk-vr3fdvn1.js:561175`, `:1832089`, `:1832438`):

- `Fast mode overloaded and is temporarily unavailable`
- `Fast mode was refused for this project` (new in `2.1.322`)
- `You've hit your fast limit`, with ` · resets in ` and the time
- `Trying fast mode again` (new in `2.1.322`)

When the cooldown ends, the debug log has `Fast mode cooldown expired, re-enabling fast mode`.
Source: [Speed Up Responses with Fast Mode](https://code.claude.com/docs/en/fast-mode#handle-rate-limits), section "Handle rate limits", the [`2.1.322` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.322), and the program.

## Request

A fast request has `speed: "fast"` in the body (`chunk-9r1hbf9p.js:2952032`).

| Case or run | Provider | `speed` | Beta `fast-mode-2026-02-01` |
| --- | --- | --- | --- |
| `print.cli322.fast-request-first-party` | Anthropic API, `--settings '{"fastMode": true}'` | `fast` | In the header `anthropic-beta` |
| `print.cli322.fast-request-first-party-off` | Anthropic API, no settings | Not sent | Not sent |
| `print.cli322.fast-request-first-party-disabled` | Anthropic API, `CLAUDE_CODE_DISABLE_FAST_MODE=1` | Not sent | Not sent |
| cc-inspect `code` `cli`, `provider: "vertex"` | Vertex, `claude-fable-5-2` | `fast` | Not sent. The body has `"anthropic_version":"vertex-2023-10-16"`. |

The system prompt has one sentence about fast mode. On Vertex since `2.1.322`, it ends with `switches the session to a model that does`. On the Anthropic API, it ends with `switches the session to Claude Opus` (`chunk-9r1hbf9p.js:2503138`).

## Price Text

The text after `Fast mode ON` depends on the provider (`chunk-28z06fjm.js:1579`).
On the Anthropic API, it is the fast price of the model, such as `$8/$40 per Mtok`. On Vertex, it is `2x <model> standard price`.
The panel says `Draws from usage credits at a higher rate` on the Anthropic API and `Billed at a higher rate` on Vertex.

The program holds these fast prices in US dollars for each million tokens (`chunk-yqezv9gr.js:402250`, `:402885`):

| Model | Status | Input | Output | Cache write (5 minutes) | Cache write (1 hour) | Cache read |
| --- | --- | --- | --- | --- | --- | --- |
| `claude-fable-5-2`, `claude-mythos-5-2` | <Documented /> | 16 | 80 | 20 | 32 | 0.4 |
| `claude-opus-5-5` | <Documented /> | 8 | 40 | 10 | 16 | 0.4 |
| `claude-opus-4-8`, `claude-opus-5` | <Documented /> | 10 | 50 | 12.5 | 20 | 1 |
| Each other model | <Undocumented /> | 30 | 150 | 37.5 | 60 | 3 |

The official page gives the input and output prices of the first three rows for Fable 5.2, Opus 5.5, Opus 5, and Opus 4.8. The cache prices, the Mythos 5.2 entry, and the last row are from the program.
The last row applies when a capability override turns fast mode on for another model (case `print.cli322.fast-capability-first-party`).

## The Panel

In the interactive terminal, `/fast` without an argument opens a panel (`chunk-vr3fdvn1.js:557300`).

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

Each stream-json `result` event has the fast mode state (`chunk-smzekmsg.js:424692`).

| Field | Status | Values |
| --- | --- | --- |
| `fast_mode_state` | <Documented /> | `off`, `cooldown`, `on` |
| `fast_mode_disabled_reason` | <Documented /> | `free`, `preference`, `extra_usage_disabled`, `network_error`, `unknown`, `not_first_party`, `disabled_by_env`, `model_not_allowed`, `sdk_opt_in_required`, `pending`. It is absent when nothing blocks fast mode, and during a cooldown. |

Source: [Agent SDK Reference: TypeScript](https://code.claude.com/docs/en/agent-sdk/typescript#sdkresultmessage), section "`SDKResultMessage`".

The `result` event of a `/fast on` turn that also changes the model has `fast_mode_state: "off"`. The next request has `speed: "fast"`, and its `result` event has `on` (case `print.cli322.fast-vertex-global` and the cc-inspect run in [Models](#models)).

## Example

Start a print-mode session on Vertex with fast mode on:

```bash
export CLAUDE_CODE_USE_VERTEX=1
export ANTHROPIC_VERTEX_PROJECT_ID=my-project
export CLOUD_ML_REGION=us-east5
export VERTEX_REGION_CLAUDE_FABLE_5_2=global
claude -p --model claude-fable-5-2 --fast-mode on "Reply with 'OK'."
```

## Related Pages

- [Models and Providers](index.md) lists the pages of this section and shows an example.
- [Providers and Gateways](providers.md) lists the Vertex region variables.
- [Model Catalog, Aliases, and Pricing](model-catalog.md) lists the capabilities of each model.
- [Models and Effort](../env-vars/models-and-effort.md) lists the fast mode environment variables.
