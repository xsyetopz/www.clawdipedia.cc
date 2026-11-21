---
title: The Agent Loop
description: How a turn runs from your prompt to the final answer, where each hook and mod event fires, how the loop recovers from errors, and why a turn ends.
sidebar_position: 2
---

A turn is everything that happens from your prompt to the final answer.
Inside a turn, the model asks for tools. Claude Code runs them. The model reads the results.
This repeats until the model answers without a tool call.
You can act at each stage with a hook, a mod event, a setting, or an environment variable. To change a stage, find it in the tables below. The Example section shows a hook that blocks a `Bash` call.

## Example

This hook in `.claude/settings.json` runs a script before every `Bash` call.
If the script exits with code 2, Claude Code blocks the call. The reason goes back to the model.

```json title=".claude/settings.json"
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": ".claude/hooks/check-bash.sh" }
        ]
      }
    ]
  }
}
```

## The Turn at a Glance

```mermaid
sequenceDiagram
  participant You
  participant CC as Claude Code
  participant Model
  You->>CC: Prompt
  Note over CC: UserPromptSubmit hooks
  CC->>Model: Request<br/>(system, tools, messages)
  Model-->>CC: Streamed reply with<br/>a tool_use block
  Note over CC: Permission check and<br/>PreToolUse hooks
```

Then Claude Code runs the tool and sends the result back to the model.

```mermaid
sequenceDiagram
  participant CC as Claude Code
  participant Model
  participant Tool
  CC->>Tool: Run the tool
  Tool-->>CC: Result
  Note over CC: PostToolUse hooks
  CC->>Model: Request with the tool result
```

The turn ends when the model answers without a tool call.

```mermaid
sequenceDiagram
  participant You
  participant CC as Claude Code
  participant Model
  Model-->>CC: Final text, no tool call
  Note over CC: Stop hooks
  CC-->>You: Answer
```

## The Stages

Official pages for the events: [Hooks Reference: Hook Lifecycle](https://code.claude.com/docs/en/hooks#hook-lifecycle) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference#events).[^stages]

```mermaid
flowchart TD
  S1[1. Input] --> S2[2. Command expansion]
  S2 --> S3[3. Context pickup]
  S3 --> S4[4. Message prep]
  S4 --> S5[5. Auto compaction]
  S5 --> S6[6. Attachments]
  S6 --> S7[7. Request build]
  S7 --> S8[8. Stream]
  S8 --> Q{Tool call?}
  Q -- Yes --> S9[9. Tools]
  S9 --> S10[10. Next round]
  S10 --> S3
  Q -- No --> S11[11. Stop]
```

| Stage | Status | What happens | Where you can act |
| --- | --- | --- | --- |
| 1. Input | <Documented /> | Claude Code reads your text. A message you type during a turn joins at a safe point. | `UserPromptSubmit` hook, `prompt.submit` mod event |
| 2. Command expansion | <Documented /> | A slash command or skill name turns into a prompt. | `UserPromptExpansion` hook |
| 3. Context pickup | <Documented /> | Claude Code adds nested memory, `@` mentions, and file-change notes. | `InstructionsLoaded` hook, `prompt.mention` and `prompt.attachment` mod events |
| 4. Message prep | <Undocumented /> | Large tool results become references. Claude Code looks up the facts of the model. | `PreModelSwitch` and `PostModelSwitch` hooks |
| 5. Auto compaction | <Documented /> | Claude Code compacts the conversation if it is over the threshold. See [Context and Compaction](context-and-compaction.md). | `PreCompact` and `PostCompact` hooks |
| 6. Attachments | <Undocumented /> | Claude Code adds reminders and notes about the mode. | `prompt.attachment` mod event |
| 7. Request build | <Documented /> | Claude Code builds the `system`, `tools`, and `messages` parts. See [Request and Cache](request-and-cache.md). | `prompt.section`, `prompt.compose`, and `tool.describe` mod events |
| 8. Stream | <Documented /> | Claude Code sends the request and reads the events, with retries and fallbacks. See [Models](models.md). | `MessageDisplay` hook |
| 9. Tools | <Documented /> | Each tool call passes the permission check and then runs. | Tool hooks (next section) |
| 10. Next round | <Undocumented /> | The tool results join the messages. The loop starts again at stage 3. | `PostToolBatch` hook |
| 11. Stop | <Documented /> | With no tool call, the `Stop` hooks run. A hook that blocks sends its reason back to the model. | `Stop` and `StopFailure` hooks |

The mod events `turn.start`, `turn.step`, and `turn.complete` wrap the whole turn.
See the [Mod API](../extend/mod-api/index.md) pages in Extend.

## The Tool Stage

Official pages: [Hooks Reference](https://code.claude.com/docs/en/hooks) and [Environment Variables](https://code.claude.com/docs/en/env-vars).

```mermaid
flowchart TD
  Call[Model asks for a tool] --> Perm[Permission rules and mode]
  Perm -- deny --> Denied[Tool result: denied]
  Perm -- ask --> Req["<code>PermissionRequest</code> hook and prompt"]
  Req -- reject --> Denied
  Perm -- allow --> Pre["<code>PreToolUse</code> hook"]
  Req -- approve --> Pre
  Pre -- block --> Denied
  Pre -- continue --> Run[Run the tool]
  Run -- ok --> Post["<code>PostToolUse</code> hook"]
  Run -- error --> Fail["<code>PostToolUseFailure</code> hook"]
  Post --> Batch["<code>PostToolBatch</code> hook"]
  Fail --> Batch
  Denied --> Batch
  Batch --> Next[Back to the model]
```

| Step | Status | What happens |
| --- | --- | --- |
| Permission check | <Documented /> | Your rules and the permission mode decide to allow, ask, or deny. See Permission Flow in this section. |
| `PreToolUse` hook | <Documented /> | The hook can block or change the call. |
| `PermissionRequest` hook | <Documented /> | The hook runs when a decision is needed. |
| Run | <Documented /> | Read-only tools and subagents run in parallel, up to `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY` (default 10). Other tools run one after another. |
| `PostToolUse` and `PostToolUseFailure` hooks | <Documented /> | They run after each call. |
| `PostToolBatch` hook | <Documented /> | It runs after a batch of parallel calls and before the next model call. It can stop the loop. |
| Shell working directory | <Undocumented /> | A Bash command does not run in the launch folder when the working directory is gone. The command fails with `Working directory "<path>" is gone` (deleted, moved, replaced by a link, or unreadable) and the model can issue it again. An agent in a worktree that was removed is refused too, and a session pinned to its folder stays blocked until the folder is back.[^cwd] |

## Recovery Inside the Loop

The loop does not fail on every error. It tries to fix the problem and continue.

| Case | Status | What Claude Code does |
| --- | --- | --- |
| The output stops at `max_tokens` | <Undocumented /> | It adds a nudge message and asks again, up to 3 times.[^nudge-count] |
| The response is cut off | <Undocumented /> | It does the same. |
| A subagent's text reply hits the output token limit | <Undocumented /> | The nudge tells the subagent that its caller gets no answer in pieces, and asks for the whole answer again, more briefly. A second cut gets a harder nudge: the whole answer in at most half the length of the last try, or a first line that says it is partial.[^sub-limit] |
| A reply is cut at 32,000 output tokens on an unrecognized model | <Undocumented /> | A model is unrecognized when it has no entry in the model list, is not a `claude-3` Opus, Sonnet, or Haiku model, has no configured limit, and `CLAUDE_CODE_MAX_OUTPUT_TOKENS` is not set above 0. Such a model has a default of 32,000 and an upper limit of 128,000 output tokens. The continuation of a cut reply uses 128,000.[^cut-limit] |
| A `tool_use` block has no valid call | <Undocumented /> | It drops the reply and asks once more. Then it ends with a message that the tool call could not be parsed. |
| The model sends only thinking | <Undocumented /> | It sends one nudge. |
| A safety refusal | <Documented /> | It runs again on the fallback model of that category. See [Models](models.md#fallback). |
| The API refuses a request on an unrecognized model | <Undocumented /> | When the request asks for more than 32,000 output tokens, Claude Code sends it again once with `max_tokens` set to 32,000. It does not read a limit from the error text.[^max-tokens] |
| The context is too long | <Documented /> | It lowers `max_tokens` or compacts. |
| Autocompact refills 3 times in a row | <Documented /> | It ends the turn with an error that starts `Autocompact is thrashing`. See [Troubleshooting](https://code.claude.com/docs/en/troubleshooting) in the official docs. |
| A `Stop` hook blocks | <Documented /> | It sends the reason back to the model. After `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` blocks in a row (default 8), it ends the turn. |
| `--max-turns` is reached | <Documented /> | It ends the run. See the [CLI Reference](https://code.claude.com/docs/en/cli-reference) in the official docs. |

## How a Turn Ends

The loop returns a `reason`. Claude Code records it in telemetry.
The chat does not show it.
A result message of the Agent SDK and of `--output-format stream-json` carries it as `terminal_reason`.
All reasons are <Undocumented />, because only the Agent SDK pages name some of them.

```mermaid
stateDiagram-v2
  [*] --> Running
  Running --> completed: No tool call, Stop hooks agree
  Running --> max_turns: Turn limit reached
  Running --> aborted: You press Esc
  Running --> hook_stopped: A hook stops the turn
  Running --> error: API or setup failure
  completed --> [*]
  max_turns --> [*]
  aborted --> [*]
  hook_stopped --> [*]
  error --> [*]
```

| `reason` | Meaning |
| --- | --- |
| `completed` | The turn ended in the normal way. |
| `max_turns` | The turn reached the turn limit. |
| `aborted_streaming`, `aborted_tools` | You stopped the turn (for example with `Esc`) while the model streamed or tools ran. |
| `hook_stopped`, `stop_hook_prevented` | A hook stopped the turn. |
| `tool_deferred` | A hook deferred a tool call. |
| `tool_deferred_unavailable` | Claude Code could not resume a deferred tool call. |
| `background_requested` | The turn moved to a background session. |
| `blocking_limit` | The context hit the blocked level. See [Context and Compaction](context-and-compaction.md#when-compaction-runs). |
| `rapid_refill_breaker` | Autocompact refilled the context too fast. |
| `model_error`, `api_error`, `image_error` | The API or an image failed. |
| `malformed_tool_use_exhausted` | The model sent a tool call that could not be parsed, and the retries failed too. Claude Code retries the call before the turn ends.[^v307] |
| `prompt_too_long` | The prompt did not fit the context window. |
| `budget_exhausted` | The run used all of its budget. |
| `structured_output_retry_exhausted` | The model did not give valid structured output after the allowed retries. |
| `turn_setup_failed` | Claude Code failed to set up the turn. |

## What You Can Change

| Goal | How |
| --- | --- |
| Check or edit every prompt before it runs | A `UserPromptSubmit` hook. |
| Block or rewrite a tool call | A `PreToolUse` hook or a permission rule. |
| Force the model to keep working | A `Stop` hook that blocks. Mind `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`. |
| Limit tool parallelism | Set `CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY`. |
| Limit the number of turns | Use `--max-turns` in print mode. |
| Rewrite a part of the system prompt | A mod listening to `prompt.section` or `prompt.compose`. See [The System Prompt](system-prompt.md). |
| Change the compaction point | See [Context and Compaction](context-and-compaction.md#controls). |

## Related Pages

- [Architecture](architecture.md)
- [Request and Cache](request-and-cache.md)
- [Context and Compaction](context-and-compaction.md)
- [Hooks](../extend/hooks/index.md), [Tools](../reference/tools/index.md), [Subagents](../extend/subagents/index.md), and [Mod API](../extend/mod-api/index.md) pages in Extend and Reference.

## Sources

[^stages]: The program, `chunk-bzyb60p0.js:68525` (the `PreModelSwitch` hook) and `chunk-bzyb60p0.js:10391` (the `prompt.attachment` mod event), for the stages that the official pages do not cover.
[^cwd]: The program, `chunk-bzyb60p0.js:251637` (`Working directory "<path>" is gone`), `chunk-bzyb60p0.js:248285` (the agent in a removed worktree), and `chunk-bzyb60p0.js:251691` (the pinned session).
[^sub-limit]: The program, `chunk-0ha8wex8.js:198` (the first nudge, "Your caller does not receive an answer in pieces") and `chunk-0ha8wex8.js:202` (the second nudge, "Output token limit hit again").
[^max-tokens]: The program, `chunk-bzyb60p0.js:156693` (`lowerAfter` sets the cap to the 32000 value), and `chunk-bzyb60p0.js:169492` (call site, which skips a 401 and a policy-blocked error).
[^nudge-count]: The program, `chunk-k5r71ad2.js:10268` (the limit of 3, compared with `maxOutputTokensRecoveryCount`) and `chunk-k5r71ad2.js:10267-10269` (the counter `maxOutputTokensRecoveryCount` ends the retries after the third).
[^cut-limit]: The program, `chunk-865at33z.js:24423` (the 32,000 and 128,000 values, and the `claude-3` models before it at `chunk-865at33z.js:24420`), `chunk-865at33z.js:24408` (the condition for an unrecognized model, with `CLAUDE_CODE_MAX_OUTPUT_TOKENS`), and `chunk-bzyb60p0.js:156683` (`continuesCutReply`, the limit for a reply that continues a cut reply, used only for such a model).
[^v307]: The program, `chunk-k5r71ad2.js:17576`.
