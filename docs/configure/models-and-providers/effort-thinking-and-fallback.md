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
| `output_config.effort` | <Documented /> | The request field that carries the level. When the server refuses it, the request goes again without it, and it stays off for that model until the process ends.[^effort-field] |
| `per-turn-control-2026-07-01` | <Undocumented /> | A beta that lets some models take the effort with each message. |
| `ultrathink` | <Documented /> | A word in a prompt that asks for deeper thinking on that turn only. It runs the turn at `xhigh` effort on Opus 5.5, Sonnet 5.5, Haiku 5.5, and Fable 5.1. It does so on Fable 5.2 and Mythos 5.2 too. Typed while Claude is working, it raises the rest of that turn. The rainbow on the word shows only where it can raise effort (see the note below). |
| Default effort | <Documented /> | The default is `high`, except `medium` for Opus 5.5, Sonnet 5.5, Haiku 5.5, Fable 5.2, and Mythos 5.2, and `xhigh` for Opus 4.7. |
| Cache warning | <Undocumented /> | The dialog `Switch model?` or `Change effort level?` says `This conversation is cached for the current model. Switching to` the new value in bold `means the full history gets re-read.` A hook reason replaces this text.[^cache-warning] |
| Effort note in the prompt | <Undocumented /> | The prompt shows the level and `/effort`. It shows `may wait for your next message` in place of `/effort` only while the request has not yet carried the shown level (see the note below). |
| Spinner effort | <Undocumented /> | The spinner adds the text `with <level> effort`. The level is the one the request carried (see the note below). |

The `ultrathink` boost works on models whose catalog entry has the capability `per_turn_effort`. Six models have it, among them Fable 5.2 and Mythos 5.2.[^per-turn] At submit, Claude Code sets the turn effort to `xhigh`. A prompt typed during a turn gets the same level.[^ultrathink-submit] A gate decides whether a model can take the boost. The prompt colors the word only when the model passes.[^ultrathink-gate]
The boost needs all of these:

- Ultrathink is on. `CLAUDE_CODE_DISABLE_ULTRATHINK` is not set, and the `tengu_turtle_carbon` flag is on (it defaults to on).
- The session is interactive, or it runs from the VS Code extension or from Claude Desktop, and that host is not a child session.
- The effort level in use is below `xhigh`. At `xhigh` or `max` the turn already runs at that level, and no boost is sent.
- The session is not remote, and `CLAUDE_CODE_EFFORT_LEVEL` is not set. A value of `auto` or `unset` also turns the boost off.
- The model accepts effort levels, has the `per_turn_effort` capability, and has the `xhigh_effort` capability.
- The provider is the Anthropic API, Claude Platform on AWS, Claude Platform on Google Cloud, or Foundry. Bedrock, Vertex, Mantle, and gateways do not pass.
- `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` is not set, and HIPAA mode is off.
- The server has not refused the `per-turn-control-2026-07-01` beta or the mid-conversation system beta in this session.[^ultrathink-conditions]

A prompt that a remote client marks with `ultrathink_typed` uses a wider session test. A session that is not interactive also passes when it has a remote entrypoint (`remote`, `remote_desktop`, or `remote_mobile`) or when `CLAUDE_CODE_ENVIRONMENT_KIND` is `bridge` and the session is not a child session. All other conditions stay the same.[^ultrathink-remote]

The flag for the note is true when the request sent a level, no turn effort is set, the sent level differs from the shown level, and the model passes the per-turn check.[^note-flag] The note clears when one of these stops being true. Claude Code then removes the `effort-level` notification.[^note-clear] Claude Code builds the prompt text in one place.[^prompt-text]

The request puts its level in `output_config.effort` and sends it with the stream start.[^request-level] Claude Code stores it as the sent level.[^sent-level] The spinner reads the sent level first. It uses the resolved level only when no sent level is stored.[^spinner-level]

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
| `CLAUDE_CODE_RETRY_WATCHDOG` | <Documented /> | Retries `429` and `529` errors without end and removes the cap. Off by default. `CLAUDE_CODE_RETRY_WATCHDOG_SCOPE=capacity` keeps only that part. It does not retry a `429` or `529` that the API marked not to retry with the header `x-should-retry: false`.[^should-retry] This holds in watchdog mode too. A rate-limit header with the value `fetch_error` still allows a retry. |
| `CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS`, `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` | <Documented /> | The start wait and the longest wait after a `529`. The defaults are 500 and 32000. The base delay accepts 500 to 32000. The longest wait accepts 32000 to 300000.[^overload-delay] |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_WAIT_MS` | <Undocumented /> <Gated note="A server gate decides whether it applies" /> | It accepts 300000 to 3600000. Only the main thread reads it. Claude Code ignores it when `CLAUDE_CODE_MAX_RETRIES` or `CLAUDE_CODE_RETRY_WATCHDOG` is set. The server gate defaults to on there.[^max-wait] |
| `API_TIMEOUT_MS` | <Documented /> | The request timeout. The default is 600000. |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS`, `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS` | <Documented /> | Stream silence and first-byte deadlines. Claude Code sets the defaults. A value below 5 minutes for `CLAUDE_STREAM_IDLE_TIMEOUT_MS` counts as 5 minutes. |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | <Documented /> | Stops the retry without streaming after a stream fails. It is off by default. |

The rules for these are on [Models](../../how-it-works/models.md#fallback) and [Retries and Timeouts](../../how-it-works/models.md#retries-and-timeouts).

## Automatic Switches and the Prompt for Unrecognized Names

Both rows are about a model name that Claude Code does not recognize, such as a custom deployment name or an inference profile ARN.

| Item | Status | Effect | Notes |
| --- | --- | --- | --- |
| `CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK` | <Undocumented /> | Turns off the automatic switch to another model after a flagged message. | The setting `switchModelsOnFlag` is a second control.[^refusal] |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | <Documented /> | `0` keeps the full system prompt. | An unrecognized name gets the short prompt. See [Names That Claude Code Does Not Recognize](../../how-it-works/system-prompt.md#names-that-claude-code-does-not-recognize). |

## Related Pages

- [Models and Providers](index.md) lists the pages of this section and shows an example.

## Sources

[^effort-field]: The program, `chunk-bzyb60p0.js:168435-168440` (`leavesEffortSupportAlone` and the `output_config.effort` retry). A background request that the program marks as leaving effort support alone keeps its effort field for the next requests to that model.
[^cache-warning]: The program, `chunk-3pqaw3hv.js:65709` (the title) and `chunk-3pqaw3hv.js:65745-65750` (the text; a hook reason replaces it).
[^per-turn]: The program, `chunk-zhr7rpv7.js:224`, `chunk-zhr7rpv7.js:451`, `chunk-zhr7rpv7.js:758`, `chunk-zhr7rpv7.js:852`, `chunk-zhr7rpv7.js:901`, and `chunk-zhr7rpv7.js:1007` (the `per_turn_effort` capability of six catalog entries). Also the [Claude Code changelog](https://code.claude.com/docs/en/changelog).
[^ultrathink-submit]: The program, `chunk-08bv0y93.js:3879-3880` for the submit, where the turn effort is `xhigh` when the model passes the gate, and `chunk-k5r71ad2.js:6943-6947` (`ultrathink_effort`) for a prompt that joins the turn while it runs.
[^ultrathink-gate]: The program. The prompt input colors a word only when the gate `chunk-3pqaw3hv.js:62731` (`$df0e55`) passes for the model, which is the check `chunk-k67pwqya.js:1610-1612`. `chunk-bq31aqv6.js:1470` finds the word `ultrathink`, and `chunk-3pqaw3hv.js:63017` (`$1a940b`) paints each letter with a rainbow color. The SDK schema says "The terminal colors the word by this rule", `chunk-xfj2cwfv.js:14125`.
[^ultrathink-conditions]: The program. The check is `chunk-k67pwqya.js:1610-1612` for a typed word that the prompt colors, and `chunk-k67pwqya.js:1624-1629` (`$4a1414`, which checks that the level is below `xhigh`) for the submit and for a word typed while a turn runs. For a normal prompt it uses the same test as the color. Ultrathink on is `chunk-865at33z.js:24569-24573` (`CLAUDE_CODE_DISABLE_ULTRATHINK` and `tengu_turtle_carbon`). The session is interactive through `chunk-f9x2f6cx.js:6906-6907` (`isInteractive`), or it is the `claude-vscode` entrypoint (`chunk-3t7ve0wy.js:582-586`), or it is `claude-desktop` or `claude-desktop-3p` (`chunk-3t7ve0wy.js:139-143`). The model check is `chunk-k67pwqya.js:1632-1638`: it needs a model that accepts effort, a session that is not remote (`chunk-t7fzcstv.js:53-54`), and `CLAUDE_CODE_EFFORT_LEVEL` read by `chunk-k67pwqya.js:1300-1304` to be undefined (`auto` and `unset` give `null`). The turn effort `xhigh` must stay `xhigh`, which needs `xhigh_effort` (`chunk-k67pwqya.js:1049-1051`). The `per_turn_effort` capability and the provider are at `chunk-865at33z.js:17287-17289`. The provider list is `chunk-xfj2cwfv.js:6962-6964` (first-party, Claude Platform on AWS and Google Cloud, and Foundry), and `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS` and HIPAA mode switch the beta off at `chunk-xfj2cwfv.js:6966-6970`. The refused-beta check is `chunk-865at33z.js:17301-17303` (`$09503b`), with the names `per-turn-control-2026-07-01` at `chunk-xfj2cwfv.js:6816` and `mid-conversation-system-2026-04-07` at `chunk-xfj2cwfv.js:6815`.
[^ultrathink-remote]: The program. `$4a1414` takes a third argument. When it is true, it uses `$883486` (`chunk-k67pwqya.js:1613-1622`) in place of `$2de35a` (`chunk-k67pwqya.js:1610-1612`). The only callers that pass true give it the `ultrathinkTyped` value of a user message. The submit does this at `chunk-08bv0y93.js:3879-3880` (it sets `xhigh`; the value is `ultrathinkTyped` at `chunk-08bv0y93.js:2475`), and a message that joins a running turn does it at `chunk-k5r71ad2.js:6943`. The value comes from the `ultrathink_typed` field of the message (`chunk-s3qtr6en.js:7934-7937`). The schema marks the field "@internal" and says the sender claims it, `chunk-xfj2cwfv.js:12457`. The extra branch is a remote entrypoint (`chunk-3t7ve0wy.js:64`, `chunk-3t7ve0wy.js:526-533`) or `CLAUDE_CODE_ENVIRONMENT_KIND` of `bridge` outside a child session (`chunk-6e68m1dj.js:122-126`).
[^note-flag]: The program, `chunk-3pqaw3hv.js:68766` (`a376` holds the `sentEffort` and `turnEffort` test).
[^note-clear]: The program, `chunk-3pqaw3hv.js:68780` (`a211($b5c745)` removes the `effort-level` notification when `a376` is false).
[^prompt-text]: The program, `chunk-3pqaw3hv.js:14309`.
[^request-level]: The program, `chunk-bzyb60p0.js:167460` (`output_config`) and `chunk-bzyb60p0.js:171360` (`sentEffort` on the `message_start` event).
[^sent-level]: The program, `chunk-9rvw567f.js:446` (`sentEffort` set by `setSentEffort`) and `chunk-3pqaw3hv.js:109433` (`setSentEffort`).
[^spinner-level]: The program, `chunk-k67pwqya.js:1685-1692` (`$a88266`, the level `a4` that the spinner gets comes before the resolved level) and `chunk-pv97d3wp.js:595` (`sentEffort` goes in as `a20`).
[^model-settings]: The program, `chunk-k67pwqya.js:1453` and `chunk-k67pwqya.js:1136` (`modelSettings`).
[^effort-source]: [Model Configuration](https://code.claude.com/docs/en/model-config), section "Adjust effort level", and the program, `chunk-k67pwqya.js:1453` (`effortLevel` inside `modelSettings`).
[^should-retry]: The program, `chunk-bzyb60p0.js:162653`.
[^overload-delay]: The program, `chunk-c203g5kd.js:3488-3489` (`min: 500, max: 32000` and `min: 32000, max: 300000`). The defaults are in `chunk-865at33z.js:13805` (`500`) and `chunk-865at33z.js:13820` (`32000`).
[^max-wait]: The program, `chunk-c203g5kd.js:3490` (`min: 300000, max: 3600000`) and `chunk-bzyb60p0.js:160664-160671` (`CLAUDE_CODE_OVERLOADED_RETRY_MAX_WAIT_MS`). The gate is `tengu_steady_heron`.
[^refusal]: The program, `chunk-gq1dr8pm.js:14651-14660`, which reads the variable and the `switchModelsOnFlag` setting.
