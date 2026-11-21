---
title: SDK and Automation
description: Environment variables for programs that host Claude Code, the Agent SDK, and automation.
sidebar_position: 15
---

These variables help a program that runs Claude Code as a child process. They say which surface started it, how session events reach the host, and which binary the Agent SDK looks for.

Most people never set them. Hosts such as the Agent SDK set them for you. To use one, set it in the environment of the child process before the process starts. Project `env` cannot set most of them before trust.

This page lists 31 variables.

## Example

```bash
CLAUDE_CODE_ENTRYPOINT=sdk-cli claude -p "List the files" --output-format stream-json
```

`CLAUDE_CODE_ENTRYPOINT` tells Claude Code which host started it. The host sets it before the process starts.

## Variables

The table is sorted by name. See [Environment Variables](index.md#how-to-read-the-tables) for what each column and badge means.

| Variable | Status | What it does | Values and default | Notes |
| --- | --- | --- | --- | --- |
| `ANTHROPIC_ENVIRONMENT_ID` | <Undocumented /> | Gives the default environment ID for a work item call that passes none. The bundled Anthropic SDK `EnvironmentWorker` reads it. | Text. The call fails with an error if no ID comes from any source | Bundled SDK work polling. Not set from project `env` before trust |
| `ANTHROPIC_ENVIRONMENT_KEY` | <Undocumented /> | Gives the fallback environment key. A work item needs it when its secret has no `sessions_token`. The bundled Anthropic SDK `EnvironmentWorker` reads it. | Text | Bundled SDK work polling. Not set from project `env` before trust |
| `ANTHROPIC_SESSION_ID` | <Undocumented /> | Gives the default session ID for a work item. The bundled Anthropic SDK `EnvironmentWorker` reads it. | Text. The call fails with an error if no ID comes from any source | Bundled SDK work polling. Not set from project `env` before trust |
| `ANTHROPIC_WEBHOOK_SIGNING_KEY` | <Undocumented /> | Gives the default webhook signing key. The bundled SDK client reads it. It is `null` when unset. | Text. SDK constructor default | Bundled SDK client. Not set from project `env` before trust |
| `ANTHROPIC_WORK_ID` | <Undocumented /> | Gives the default work item ID. The bundled Anthropic SDK `EnvironmentWorker` reads it. | Text. The call fails with an error if no ID comes from any source | Bundled SDK work polling. Not set from project `env` before trust |
| `ANTHROPIC_WORK_SECRET` | <Undocumented /> | Gives the default work secret. The bundled Anthropic SDK `EnvironmentWorker` reads it. | Text | Bundled SDK work polling. Not set from project `env` before trust |
| `CLAUDE_CODE_CONFIG_PROBE` | <Undocumented /> | In the IDE config probe, skips the `awsAuthRefresh` and `gcpAuthRefresh` commands and the credential helper prefetch. The process also drops any user message it queues for itself, so it answers only the request of its host. The debug log then reads "Dropped a user message that this process queued for itself". | On or off, off by default. Also in a list of host-controlled names | IDE config probe, Bedrock and Vertex auth refresh |
| `CLAUDE_CODE_EDITOR_CODELIVERY` | <Undocumented /> | Lets a relayed human message carry an `artifact_followup` ack with an `https` URL of at most 2048 characters. | On or off, off by default | Relay and remote sessions only |
| `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS` | <Documented /> | Adds `session_state_changed` system messages to the output stream. | On or off, off by default. When set, Claude Code emits a normal event. Otherwise it emits a host-only event if `CLAUDE_CODE_SDK_READS_SESSION_STATE` is set | SDK and `--print` stream-json |
| `CLAUDE_CODE_EMIT_USER_PROMPT_SUBMIT_HOOK_EVENTS` | <Undocumented /> | Makes Claude Code send `hook_started` and `hook_response` system messages for `UserPromptSubmit` hooks. | On or off, off by default. Claude Code reads it once and removes it from its environment | SDK and print mode |
| `CLAUDE_CODE_ENTRYPOINT` | <Undocumented /> | Names the surface that started Claude Code, such as `cli`, `sdk-ts`, `claude-vscode`, or `remote`. Many code paths branch on it. | Text. When it is empty, Claude Code sets it at startup (`mcp` for `mcp serve`, `sdk-cli` for SDK CLI). The TS SDK sets it to `sdk-ts` | All sessions |
| `CLAUDE_CODE_ENTRYPOINT_ON_REQUESTS` | <Undocumented /> | Sets the name that requests go out under in the `cc_entrypoint=` part of the billing header. Claude Code reads it only when `CLAUDE_CODE_ENTRYPOINT` is `claude-desktop-3p`. It ignores the value, with a debug message, when requests already go out under an entrypoint name. It unsets the variable after it reads it. | Text of 1 to 32 characters from `a-z`, `0-9`, `_`, and `-`. It must start with a letter, must not start with `sdk`, and must not be reserved (an entrypoint name, anything starting with `remote`, or `local_projects`).[^entrypoint-on-requests] | Claude Desktop third-party only |
| `CLAUDE_CODE_GENTLE_PARASOL` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Overrides a feature flag experiment, which applies a secondary reminder to model requests. | Text. Logs `secondary_reminder` when applied | API requests |
| `CLAUDE_CODE_HOOK_HEARTBEAT_INTERVAL_MS` | <Undocumented /> <Gated note="A feature flag, on by default, turns the heartbeat on" /> | Sets the interval of the hook heartbeat. While a hook runs, Claude Code sends `tool_progress` messages with `heartbeat: true` at this interval. See [Stream JSON](/extend/headless/stream-json).[^heartbeat] | Whole number of milliseconds, `100` to `30000`. Default `30000` | SDK and print mode |
| `CLAUDE_CODE_HOST_ALLOW_RESETS_DENIAL_STREAK` | <Undocumented /> | Lets an approval of a host app reset the count of auto mode blocks in a row. A block of the auto mode classifier then sends the permission request of the next call with the reason code `denial_limit_host_reset`.[^host-streak] | `1` turns it on. Any other value, or no value, leaves it off. The host app sets it in the environment of the child | Host apps |
| `CLAUDE_CODE_HUMBLE_HAMMOCK` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces the `echoWireToolInputs` behavior on or off ahead of the flag. In a probe, it adds `wire_tool_inputs` (raw `tool_use.input`) to the assistant event when a tool runs. See Probes. | On, off, or unset. Unset falls back to `echoWireToolInputs` and then to a feature flag | All sessions |
| `CLAUDE_CODE_JIT_POLICY_AFTER_STARTUP` | <Undocumented /> | Sets the Bun JIT policy 10 seconds after start. Without it, Claude Code sets the policy to `1`. | On or off. Whole number `1` to `100`, digits only. A truthy value loads a module that applies the value | All sessions, Bun build |
| `CLAUDE_CODE_LARCH_CISTERN` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Overrides the `larch_cistern` experiment value for the model. In a probe, it adds a "Corrections" section to the system prompt (avoid excessive self-correction). See Probes. | On or off. A false value counts as unset. It goes to the same per-model helper as `CLAUDE_CODE_AMBER_ASTROLABE` | All sessions |
| `CLAUDE_CODE_PLAIN_DELTA_FAST_PATH` | <Undocumented /> | Lets streamed text deltas go straight to output in a headless run when nothing else needs them. The debug log counts them for each turn. | On or off, off by default | SDK and print mode |
| `CLAUDE_CODE_POLL_EVENTS` | <Undocumented /> | Lets a host send poll events to the session as `<event>` envelopes. Claude Code rejects them when the host did not set it. | On or off. Poll events also need permission mode `auto` | SDK and host sessions |
| `CLAUDE_CODE_REMOVE_PROMPT_STRINGS` | <Undocumented /> | Removes listed strings from prompts for prompt ablation tests. It overrides the `remove_prompt_strings` client data. | JSON text. A bad value logs a warning. A feature flag controls the telemetry event | All sessions |
| `CLAUDE_CODE_REPLY_GATE_POLICY` | <Undocumented /> | Gives the reply check a JSON policy: which reply tools end a turn, the text to ask with, and how many times to ask after a person or a server event. `disableReplyCheck` in managed settings turns the check off. | A JSON object with `terminal_tools`, `ask_text`, `max_asks_after_person`, and `max_asks_after_server_event`. Text that is not a JSON object is refused with an error in the debug log | All sessions. Claude Code lists `reply_gate_policy_v1` in the `init` capabilities when it accepts the value and `reply_gate_policy_refused_v1` when it refuses it.[^reply-gate] |
| `CLAUDE_CODE_SDK_READS_STARTUP_MARKS` | <Undocumented /> | Tells Claude Code that the SDK host reads startup marks. The Agent SDK sets it for `startup()` and `prewarm()`. The CLI then writes lines with a `startup_mark` field. | On or off | SDK and print mode |
| `CLAUDE_CODE_SDK_READS_SESSION_STATE` | <Undocumented /> | Tells Claude Code that the SDK host reads session state. Claude Code then sends `session_state_changed` events marked `sdk_host_only`. | On or off. Claude Code sets it to `1` in the SDK child env unless the host already set it | SDK and print mode. Claude Code sets it |
| `CLAUDE_CODE_SIMULATE_PROXY_USAGE` | <Undocumented /> | Simulates proxy use in request shaping. Claude Code then skips steps such as the thinking display update. A probe run saw no `anthropic-beta` header. | On or off | API requests |
| `CLAUDE_CODE_SUPERVISED` | <Undocumented /> | Tells Claude Code that a supervisor restarts it. On an uncaught exception it then exits at once instead of staying alive. | On or off | Supervised or managed runs |
| `CLAUDE_CODE_TETHER_LIVE` | <Undocumented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces the tether-live gate on or off. It replaces the feature flag and also gates the kept-reminder delivery. | On or off. Needs the first-party provider. Without it, the flag decides, and only for some builds or users | First-party provider only |
| `CLAUDE_CODE_STREAM_EVENT_HOLD_MS` | <Undocumented /> | Holds the `stream_event` text deltas of stream-json output for this many milliseconds. Claude Code joins held deltas into fewer lines and prints them when the time ends. It prints at once on any other message, after 100 held lines, or on exit. | Whole number from `1` to `2000`, digits only. It has no effect while `CLAUDE_CODE_STREAM_EVENT_MAX_LINE_BYTES` is set to a bad value | SDK and print mode, stream-json output. Claude Code removes it from the env of child processes in a cloud session |
| `CLAUDE_CODE_STREAM_EVENT_MAX_LINE_BYTES` | <Undocumented /> | Sets the largest size in bytes of one joined stream-json line when `CLAUDE_CODE_STREAM_EVENT_HOLD_MS` is set. A joined line that would be larger prints as separate lines. | Whole number of at least `1`, digits only. Unset means no line limit. A bad value logs a warning and turns the hold off | SDK and print mode, stream-json output. Claude Code removes it from the env of child processes in a cloud session |
| `CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS` | <Undocumented /> | Makes each hold of `CLAUDE_CODE_STREAM_EVENT_HOLD_MS` last this long, if longer, after the host sends the control request `set_has_subscribers` with `has_subscribers` set to `false`. After `true` or `null`, the time of the first variable applies again. | A number of milliseconds. It needs `CLAUDE_CODE_STREAM_EVENT_HOLD_MS` and `CLAUDE_CODE_STREAM_EVENT_MAX_LINE_BYTES` | SDK and print mode, stream-json output. A reply of 8 text deltas, 400 ms apart, with `HOLD_MS` at `100` gave 8 delta lines.[^no-subscriber] |
| `SDK_NATIVE_BIN` | <Undocumented /> | Sets the native binary file name that the Agent SDK looks for. | Text, `claude` by default. Joined to the platform package path `@anthropic-ai/claude-agent-sdk-<os>-<arch>` | Agent SDK launch. Not set from project `env` before trust |

## How It Works

A host starts `claude` with its own environment. When `CLAUDE_CODE_ENTRYPOINT` is empty, Claude Code sets it: `mcp` for `mcp serve`, `sdk-cli` for the SDK command line. Other variables here turn on extra stream events or tell Claude Code that a supervisor restarts it.

## Related Pages

- [Environment Variables](index.md): how Claude Code reads variables and which value wins.
- [Headless and Print Mode](../../extend/headless/index.md)
- [Remote and Cloud Sessions](remote-and-cloud-sessions.md)
- [Undocumented Items](../../reference/undocumented.md): every item that only the program shows.

## Sources

The program and the [Environment Variables](https://code.claude.com/docs/en/env-vars) page of the official docs.

[^entrypoint-on-requests]: The program strings only, `chunk-865at33z.js:47661` (the read, `CLAUDE_CODE_ENTRYPOINT_ON_REQUESTS`). Not run.
[^heartbeat]: The `tengu_mellow_pulse` feature flag turns the heartbeat on.
[^reply-gate]: Probe cases `env319b.reply-gate.unset`, `valid`, and `invalid`.
[^no-subscriber]: The program, `chunk-094mb179.js:612`. Probe cases `env319b.stream-hold.spaced-false-0` (8 lines), `spaced-false-3000` (2 lines, the deltas joined), `spaced-true-3000`, `spaced-null-3000`, and `spaced-untold-3000` (8 lines each).
[^host-streak]: The program, `chunk-bzyb60p0.js:51100` (`CLAUDE_CODE_HOST_ALLOW_RESETS_DENIAL_STREAK`) and `chunk-52tptcsk.js:1556` (`denial_limit_host_reset`).
