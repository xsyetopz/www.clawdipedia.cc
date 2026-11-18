---
title: Effort, Thinking, and Fallback
description: The effort levels, the thinking controls, fallback models, retries, and the automatic switch for unrecognized model names.
sidebar_position: 3
---

Effort sets how hard the model works on a turn. Thinking controls how the model reasons before it answers. Fallback and retry settings decide what happens when a request fails. Change these when you want a different balance of cost and quality, or when you run Claude Code through a proxy or a custom model name.

## Example

```bash
claude --effort high --fallback-model sonnet
```

The session runs at `high` effort. If the main model is overloaded, Claude Code tries `sonnet`.

## Effort

The effort levels are `low`, `medium`, `high`, `xhigh`, and `max`.
A level the model does not accept runs as the highest accepted level below it.
The effort cost index scales the cost of a level against `high`, which is `1`.
It comes from the catalog (<Undocumented />). `claude-opus-4-7` has the default `xhigh` and no index. Other models not listed have no default effort in the catalog.

| Item | Status | What it does |
| --- | --- | --- |
| `--effort <level>` | <Documented /> | Sets the effort for a session. `ultracode` sets `xhigh` and turns on the workflow mode. |
| `CLAUDE_CODE_EFFORT_LEVEL` | <Documented /> | Sets the effort. It wins over `--effort`, `/effort`, and settings. `auto` uses the model default. |
| `effortLevel`, `maxEffortLevel`, `modelSettings` | <Documented /> | Settings for the default level and a cap. |
| `output_config.effort` | <Documented /> | The request field that carries the level. Since `2.1.310`, when the server refuses it, the request goes again without it, and it stays off for that model until the process ends.[^effort-field] |
| `per-turn-control-2026-07-01` | <Undocumented /> | A beta that lets some models take the effort with each message. |
| `ultrathink` | <Documented /> | A word in a prompt that asks for deeper thinking on that turn only. Since `2.1.311`, in the interactive terminal on the Anthropic API, it runs the turn at `xhigh` effort on Opus 5.5, Sonnet 5.5, Haiku 5.5, and Fable 5.1. It does so on Fable 5.2 and Mythos 5.2 too. Typed while Claude is working, it raises the rest of that turn. The rainbow on the word shows only where it can raise effort (see the note below). |
| Default effort | <Documented /> | The default is `high`, except `medium` for Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.2, and Mythos 5.2, and `xhigh` for Opus 4.7. |
| Cache warning | <Undocumented /> | Since `2.1.312`, the dialog `Switch model?` or `Change effort level?` says `This conversation is cached for the current model. Switching to` the new value in bold `means the full history gets re-read.`[^cache-warning] The old text ended with `on your next message`. |
| Effort note in the prompt | <Undocumented /> | The prompt shows the level and `/effort`. Since `2.1.312`, it shows `may wait for your next message` in place of `/effort` only while the request has not yet carried the shown level (see the note below). |
| Spinner effort | <Undocumented /> | The spinner adds the text `with <level> effort`. Since `2.1.312`, the level is the one the request carried (see the note below). |

The `ultrathink` boost works on models whose catalog entry has the capability `per_turn_effort`. Six models have it, among them Fable 5.2 and Mythos 5.2.[^per-turn] At submit, Claude Code sets the turn effort to `xhigh`. A prompt typed during a turn gets the same level.[^ultrathink-submit] A gate decides whether a model can take the boost. The prompt colors the word only when the model passes.[^ultrathink-gate]

The text of the prompt note did not change in `2.1.312`. Only the flag changed. In `2.1.311`, the flag was true after a step key press while Claude was working, on a model that passes the per-turn check, and it cleared when Claude stopped. Since `2.1.312`, the flag is true when the request sent a level, no turn effort is set, the sent level differs from the shown level, and the model passes the per-turn check.[^note-flag] The note clears when one of these stops being true. Claude Code then removes the `effort-level` notification.[^note-clear] Claude Code builds the prompt text in one place.[^prompt-text]

The request puts its level in `output_config.effort` and sends it with the stream start.[^request-level] Claude Code stores it as the sent level.[^sent-level] The spinner reads the sent level first. It uses the resolved level only when no sent level is stored.[^spinner-level] In `2.1.311`, the spinner function took no sent level.

| `id` | Default effort | Index (`low`, `medium`, `high`, `xhigh`, `max`) |
| --- | --- | --- |
| `claude-fable-5` | high | 0.6, 0.77, 1, 1.74, 1.91 |
| `claude-fable-5-1` | high | 0.75, 0.86, 1, 1.38, 1.74 |
| `claude-fable-5-2` | medium | none |
| `claude-haiku-5-5` | medium | 0.38, 0.52, 1, 2.03, 4.34 |
| `claude-mythos-5-1` | high | 0.75, 0.86, 1, 1.38, 1.74 |
| `claude-mythos-5-2` | medium | none |
| `claude-opus-4-7` | xhigh | none |
| `claude-opus-4-8` | high | 0.72, 0.9, 1, 1.65, 1.88 |
| `claude-opus-5` | high | 0.67, 0.76, 1, 1.6, 1.7 |
| `claude-opus-5-5` | medium | 0.48, 0.66, 1, 1.66, 3.44 |
| `claude-sonnet-5` | high | 0.47, 0.74, 1, 2.41, 5.59 |
| `claude-sonnet-5-5` | medium | 0.49, 0.54, 1, 1.87, 5.5 |

### Where the Saved Level Comes From

For the main session, `CLAUDE_CODE_EFFORT_LEVEL` wins over saved levels.
Among saved levels, Claude Code takes the first source that applies:

1. The level saved for the model in `modelSettings`. It reads the settings files from the highest priority down, and a policy or flag file counts first.
2. A top-level `effortLevel` from a project, local, policy, or flag settings file. It applies to every model.
3. A top-level `effortLevel` in your user settings file. This is the older form. It applies only to a fixed list of older models that Claude Code pins, and only while no other file sets a top-level `effortLevel`. A new install pins none, so the key does nothing there.
4. The model default.

To set a floor for a newer model in your user file, write it inside `modelSettings`.[^model-settings]
For a subagent, the order is the agent file `effort`, the inherited effort, `CLAUDE_CODE_SUBAGENT_EFFORT`, then the order above (see [Models and Effort](../env-vars/models-and-effort.md)).

See [Model Configuration](https://code.claude.com/docs/en/model-config), section "Adjust effort level".[^effort-source]

## Thinking

See [Model Configuration](https://code.claude.com/docs/en/model-config) and [Environment Variables](https://code.claude.com/docs/en/env-vars).

| Item | Status | What it does |
| --- | --- | --- |
| `thinking: {type: "adaptive"}` | <Documented /> | Lets the model choose how long it thinks. Newer models always use it. |
| `MAX_THINKING_TOKENS` | <Documented /> | Sets a fixed thinking budget. `0` turns thinking off on the Anthropic API. It cannot turn thinking off on Opus 5.5, Sonnet 5.5, Haiku 5.5, and the Fable models. |
| `CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING` | <Documented /> | Returns to the fixed budget on Opus 4.6 and Sonnet 4.6. It has no effect on newer models. |
| `CLAUDE_CODE_DISABLE_THINKING` | <Documented /> | Omits the `thinking` field, for proxies that reject it. |
| `alwaysThinkingEnabled`, `showThinkingSummaries` | <Documented /> | Settings for thinking. `Option+T` or `Alt+T` toggles it. |
| `--thinking <enabled\|adaptive\|disabled>` | <Undocumented /> | This flag is hidden and works in print mode. `enabled` equals `adaptive`. |
| `--thinking-display <summarized\|omitted\|highlights>` | <Undocumented /> | This flag is hidden. It sets how thinking text comes back. |
| `--max-thinking-tokens` | <Undocumented /> <Deprecated note="Use --thinking" /> | This flag is hidden and deprecated. Use `--thinking`. |

## Fallback and Retries

See [Model Configuration](https://code.claude.com/docs/en/model-config) and [Error Reference: Automatic Retries](https://code.claude.com/docs/en/errors#automatic-retries).

| Item | Status | What it does |
| --- | --- | --- |
| `--fallback-model <model...>`, `fallbackModel` | <Documented /> | A chain of up to three models for overload and server errors. |
| `CLAUDE_CODE_NO_MODEL_FALLBACK` | <Undocumented /> | Forbids the substitution of a model. |
| `CLAUDE_CODE_MAX_RETRIES` | <Documented /> | The number of retries. The default is 10. The maximum is 15. |
| `CLAUDE_CODE_RETRY_WATCHDOG` | <Documented /> | Retries `429` and `529` errors without end and removes the cap. Off by default. Since `2.1.310`, `CLAUDE_CODE_RETRY_WATCHDOG_SCOPE=capacity` keeps only that part. Since `2.1.311`, it no longer retries a `429` or `529` that the API marked not to retry with the header `x-should-retry: false`.[^should-retry] This holds in watchdog mode too. A rate-limit header with the value `fetch_error` still allows a retry. |
| `CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS`, `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` | <Documented /> | The start wait and the longest wait after a `529`. The defaults are 500 and 32000. The base delay accepts 500 to 32000. Since `2.1.323`, the longest wait accepts 32000 to 300000.[^overload-delay] |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_WAIT_MS` | <Undocumented /> <Gated note="A server gate decides whether it applies" /> | Since `2.1.323`, it accepts 300000 to 3600000. Only the main thread reads it. Claude Code ignores it when `CLAUDE_CODE_MAX_RETRIES` or `CLAUDE_CODE_RETRY_WATCHDOG` is set. The server gate defaults to on there.[^max-wait] |
| `API_TIMEOUT_MS` | <Documented /> | The request timeout. The default is 600000. |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS` | <Documented /> | Stream silence and first-byte deadlines. Claude Code sets the defaults. A value below 5 minutes for `CLAUDE_STREAM_IDLE_TIMEOUT_MS` counts as 5 minutes. |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | <Documented /> | Stops the retry without streaming after a stream fails. It is off by default. |

The rules for these are on [Models](../../how-it-works/models.md#fallback) and [Retries and Timeouts](../../how-it-works/models.md#retries-and-timeouts).

## Automatic Switches and the Prompt for Unrecognized Names

Both rows are about a model name that Claude Code does not recognize, such as a custom deployment name or an inference profile ARN.

| Item | Status | Effect | Notes |
| --- | --- | --- | --- |
| `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK` | <Undocumented /> | Turns off the automatic switch to another model after a flagged message. | The setting `switchModelsOnFlag` is a second control.[^refusal] |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | <Documented /> | `0` keeps the full system prompt. | Since `2.1.312`, an unrecognized name gets the short prompt. See [Names That Claude Code Does Not Recognize](../../how-it-works/system-prompt.md#names-that-claude-code-does-not-recognize). |

## Related Pages

- [Models and Providers](index.md) lists the pages of this section and shows an example.

## Sources

[^effort-field]: The program, `chunk-m14bt1pz.js:168442-168453`.
[^cache-warning]: The program, `chunk-cfxefa64.js:64254`, `chunk-cfxefa64.js:64290-64295`. Also the [`2.1.312` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.312).
[^per-turn]: The program, `chunk-f892tj2r.js:221`, `chunk-f892tj2r.js:448`, `chunk-f892tj2r.js:753`, `chunk-f892tj2r.js:847`, `chunk-f892tj2r.js:896`, `chunk-f892tj2r.js:1001`. Also the [Claude Code changelog](https://code.claude.com/docs/en/changelog).
[^ultrathink-submit]: The program (`2.1.327`), `chunk-p47p1nn1.js:3794-3806` for the submit, where the turn effort is `xhigh` when the model passes the gate, and `chunk-8g2nr9dn.js:5947-5972` for a prompt that joins the turn while it runs, called at `chunk-8g2nr9dn.js:16739`.
[^ultrathink-gate]: The program. The prompt input colors a word only when the gate `chunk-rthqjjhy.js:29275` passes for the model (it needs ultrathink on, and `chunk-rthqjjhy.js:29536` checks that the model can run the turn at `xhigh`): `chunk-cfxefa64.js:990610` picks the words, and `chunk-cfxefa64.js:994390` paints each letter with a rainbow color. The word finder is `chunk-qpav394c.js:37293`. The SDK schema says "The terminal colors the word by this rule", `chunk-rj3e7agr.js:484442`.
[^note-flag]: The program and the [`2.1.312` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.312), `chunk-cfxefa64.js:67245-67270`.
[^note-clear]: The program, `chunk-cfxefa64.js:67258`.
[^prompt-text]: The program, `chunk-cfxefa64.js:13338`.
[^request-level]: The program, `chunk-m14bt1pz.js:3281207` and `chunk-m14bt1pz.js:3356273`.
[^sent-level]: The program, `chunk-rvc7d09c.js:8060`.
[^spinner-level]: The program, `chunk-rthqjjhy.js:30570` and `chunk-br8rsn5f.js:9750`.
[^model-settings]: The program, `chunk-rthqjjhy.js:26687`, `chunk-rthqjjhy.js:27090`.
[^effort-source]: [Model Configuration](https://code.claude.com/docs/en/model-config), section "Adjust effort level", and the program, `chunk-rthqjjhy.js:26687`.
[^should-retry]: The program, `chunk-m14bt1pz.js:162762`.
[^overload-delay]: The program, `chunk-2ew0jg68.js:80683`. The default is in `chunk-asj6f58y.js:335569`.
[^max-wait]: The program, `chunk-2ew0jg68.js:80683` and `chunk-m14bt1pz.js:3170354`. The gate is `tengu_steady_heron`.
[^refusal]: The program, `chunk-18d5r2hb.js:15973-15982`, which reads the variable and the `switchModelsOnFlag` setting.
