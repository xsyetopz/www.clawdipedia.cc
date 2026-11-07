---
title: Hook Input and Output
description: The JSON that hooks receive, the JSON and exit codes they answer with, and what each answer does.
sidebar_position: 8
---

Each hook gets a JSON description of what happened. It answers with an exit code, or with exit 0 and a JSON object.
The answer tells Claude Code to continue, to block, or to add context.
For example, exit code 2 with a message on `stderr` blocks a `PreToolUse` call and tells Claude why.

You control the answer your hook gives, not the input. Each event decides which fields it reads.

## Example

A command hook reads the input. Then it answers with JSON to ask you before it runs `terraform apply`.

```bash title=".claude/hooks/ask-terraform.sh"
#!/bin/bash
input=$(cat)
cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
if [[ "$cmd" == terraform\ apply* ]]; then
  cat <<'JSON'
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "terraform apply changes real infrastructure"
  }
}
JSON
fi
exit 0
```

The script exits 0 and prints one JSON object. Claude Code reads the object. Then it shows a permission prompt.

## Common Input Fields

A command hook reads this JSON on `stdin`. An HTTP hook gets it as the POST body.

| Field | Status | What it holds | Notes |
| --- | --- | --- | --- |
| `session_id` | <Documented /> | The session identifier. | A string. |
| `transcript_path` | <Documented /> | The path to the conversation JSONL file. | Claude Code writes it async, so it can lag. On `Stop`, use `last_assistant_message`. See [Transcript Format](../../reference/transcript-format.md). |
| `cwd` | <Documented /> | The working directory when the hook runs. | Follows `cd` and worktrees. |
| `prompt_id` | <Documented /> | The UUID of the prompt in progress. | Equals `prompt.id` in OpenTelemetry events. Absent before the first input. |
| `scratchpad_dir` | <Differs note="In the docs and the program string list, but missing from BaseHookInput in the type file." /> | The session scratchpad folder. | Needs 2.1.257. Sent on most events. |
| `permission_mode` | <Documented /> | `default`, `plan`, `acceptEdits`, `auto`, `dontAsk`, or `bypassPermissions`. | Claude Code sends manual mode as `default`. Not on every event. |
| `effort` | <Documented /> | An object `{level}` with `low`, `medium`, `high`, `xhigh`, or `max`. | Only in tool-use context, and only when the model supports effort. Claude Code sends it on tool events, `Stop`, and `SubagentStop`. |
| `hook_event_name` | <Documented /> | The name of the event. | In the type file it is a literal on each event type, not on `BaseHookInput`. |
| `agent_id` | <Documented /> | The subagent or in-process teammate that the hook fires in. | Absent on the main thread. On task and teammate events it names the actor (2.1.290). |
| `agent_type` | <Documented /> | The agent name. | Set in a subagent, or on the main thread with `--agent`. |
| `mcp_server` | <Documented /> | An object `{name, source}` for an MCP tool. | Needs 2.1.274. `source` is an open set: `sdk`, `plugin`, `user`, `project`, `local`, `dynamic`, `managed`, `enterprise`, `claudeai`, `agent`. |

## Universal Output Fields

A hook prints one JSON object to `stdout`. Then it exits 0.
Every event accepts these keys. Some events drop them. [Events](events.md) says which.

| Field | Status | What it does | Notes |
| --- | --- | --- | --- |
| `continue` | <Documented /> | `false` stops Claude after the hook. | Beats event decisions. `TaskCreated` ignores it. `TaskCompleted` also ignores it when it comes from `TaskUpdate`. |
| `stopReason` | <Documented /> | The message to show when `continue` is `false`. | Stays in the conversation. |
| `systemMessage` | <Documented /> | A warning for you. | Some events drop it or send it somewhere else. See the table below. |
| `terminalSequence` | <Documented /> | An escape sequence that Claude Code writes for you. | Allowed: OSC `0`, `1`, `2`, `9`, `99`, `777`, and BEL. Interactive mode only. Works on events that drop other fields. Not for `WorktreeCreate` command hooks. |
| `decision` | <Differs note="Docs: only block. Program enum: approve or block for any event. On PreToolUse both are deprecated." /> | A top-level block. | See Decision Patterns below. |
| `reason` | <Documented /> | The text for the block. | You or Claude sees it, by event. |
| `hookSpecificOutput` | <Documented /> | An event-specific object. | Needs `hookEventName` set to the event name. |
| `{"async":true,"asyncTimeout":n}` | <Undocumented /> | A first reply that moves the hook to the background. | See [Configuration](configuration.md#timeouts). Command hooks only. |
| 10,000 character cap | <Documented /> | Applies to `additionalContext`, `systemMessage`, `initialUserMessage`, and plain `stdout`. | Each string alone. If a string is over the cap, Claude Code saves it to a file. The model gets the path and the first 2,000 characters. |

### What `continue` and `systemMessage` Do per Event

A probe ran a command hook on each event in `-p` mode. "Stops" means the model made no more requests. Some messages show only in the interactive screen, so "Not shown" means not shown in `-p` `stream-json`. Source: [Probes](../../reference/probes.md#subagents-and-hooks).

| Event | `continue: false` | `systemMessage` |
| --- | --- | --- |
| `SessionStart` | Not honored. The session went on. | Not shown. |
| `UserPromptSubmit` | Honored. No model request. The result is `Operation stopped by hook: <stopReason>`. | Shown as `UserPromptSubmit says: ...`, but not together with a stop. |
| `UserPromptExpansion` | Honored, with the same result text. | Shown as `UserPromptExpansion says: ...`. |
| `PreToolUse` | Honored. The loop stops after the hook. The `stopReason` is not shown. | Shown as `PreToolUse:Bash says: ...`. |
| `PostToolUse` | Honored. The loop stops. | Shown only without a stop. |
| `PostToolUseFailure` | Not honored. | Shown. |
| `PostToolBatch` | Honored. | Shown. |
| `Stop` | The text `Stop hook stopped continuation: <stopReason>` enters the conversation. | Shown as `Stop says: ...`. |
| `SubagentStart`, `SubagentStop`, `SessionEnd` | The hook ran. No visible effect. | Not shown. |
| `InstructionsLoaded`, `Setup` | No effect. | Not shown. |

`PermissionRequest`, `PermissionDenied`, `Notification`, and `PreCompact` do not fire in `-p`. They fired in a probe of the interactive screen (2.1.305, local stub, fake key). The rows below are from that run. Source: [Interactive Probes](../../reference/probes.md#interactive-probes).

| Event | `continue: false` | `systemMessage` |
| --- | --- | --- |
| `PermissionRequest` | Not honored. A hook that also allowed the call still ran the tool. Use `hookSpecificOutput.decision.behavior`. | Not shown on screen or in the transcript. |
| `PermissionDenied` | Not honored. The model made its next request. | Not shown. |
| `Notification` | Not honored. The permission dialog stayed open and worked. | Not shown. |
| `PreCompact` | Not honored. Compaction ran and `PostCompact` fired. Block it with `decision: "block"` or exit 2. | Not parsed. Claude Code prints the raw `stdout` JSON on the hook's `completed successfully` line. |

### What Fires and What Is Honored in the Interactive Screen

| Event | When it fires | What a reply does |
| --- | --- | --- |
| `PermissionRequest` | Before the permission dialog opens, in the same second as `PreToolUse`. It also fires in `auto` mode, but only when auto mode falls back to a dialog (checked after 3 blocked actions in a row). It did not fire for a plain auto mode denial. | `decision.behavior: "allow"`: no dialog, the tool ran, the line says `Allowed by PermissionRequest hook`. `"deny"` with `message`: no dialog, not run, the model gets the `message` text, the line says `Denied by PermissionRequest hook`. `deny` with `interrupt: true`: not run, the turn stops with `Interrupted`. Claude Code ignores exit 2 with no output and a top-level `decision: "block"`. The normal dialog opens. `{}` or no output: the normal dialog. |
| `PermissionDenied` | Only for an auto mode denial. A manual "No" in the dialog does not fire it. The input has `tool_use_id` and `reason` (`mcp_server` is absent for a built-in tool). | `hookSpecificOutput.retry: true` with a verdict (on 2.1.319, a `flagged` verdict of the server-side check): the denial stands, and the model gets the extra text `The PermissionDenied hook indicated you may retry this tool call.` after the tool result. With no verdict, it changes nothing. |
| `Notification` | The permission dialog fires it after about 6 seconds. Answer sooner and it never fires. The input has `notification_type` and `message` (no `title` in these runs). | Cannot change the dialog. For `idle_prompt` nothing visible changed. |
| `PreCompact` | On `/compact`, with `trigger: "manual"` and `custom_instructions`. With too few messages (`Not enough messages to compact.`) it does not fire. `PostCompact` follows with `compact_summary`. | `decision: "block"` with `reason`: `Compaction blocked by PreCompact hook: [cmd]: <reason>`. Exit 2: `Compaction blocked by PreCompact hook: [cmd]`. |

On 2.1.319, an auto mode run with a custom base URL that gives no server-side verdict shows the dialog `Auto mode can't check actions in this session`. It fires a `Notification` with `notification_type: "agent_needs_input"`. A custom base URL that refuses the dangerous-tool-use beta with HTTP 400 shows the same dialog.

## Decision Patterns

| Pattern | Status | What it does | Events |
| --- | --- | --- | --- |
| Top-level `decision: "block"` | <Documented /> | Blocks. `reason` is the message. | `UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop`, `ConfigChange`, `PreCompact`, `TaskCreated` |
| `hookSpecificOutput.permissionDecision` | <Documented /> | `allow`, `deny`, `ask`, or `defer`. `defer` works only in `-p`. | `PreToolUse`. `PreModelSwitch` has no `defer`. |
| `hookSpecificOutput.decision.behavior` | <Documented /> | `allow` or `deny`. Needs a `decision` object. | `PermissionRequest` |
| `continue: false` or exit 2 | <Documented /> | Stops the teammate. | `TeammateIdle`, `TaskCompleted` |
| Path return | <Documented /> | A command prints the path. An HTTP hook returns `worktreePath`. A failure fails the creation. | `WorktreeCreate` |
| Context only | <Documented /> | `additionalContext`. It cannot block. | `SessionStart`, `SubagentStart`, `PostModelSwitch`, `Setup`, `Notification` |
| None | <Documented /> | Side effects only. | `SessionEnd`, `PostCompact`, `InstructionsLoaded`, `StopFailure`, `CwdChanged`, `DirectoryAdded`, `FileChanged`. The last two still return `watchPaths`. |

## Exit Codes

| Exit code | Status | What it does | Notes |
| --- | --- | --- | --- |
| 0 | <Documented /> | Success. | Claude Code reads JSON from `stdout`. Plain `stdout` becomes context only on `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart`, and `PostModelSwitch`. Claude never sees `stderr` from an exit 0 hook. |
| 2 | <Documented /> | A blocking error on events that can block. | `stderr` is the reason. Claude Code reads JSON fields. They cannot override the block. `Elicitation` and `ElicitationResult` ignore them. |
| 1 | <Documented /> | Not a block. | Exit 1 is a non-blocking error. Use exit 2 for policy. |
| Any other code | <Documented /> | A non-blocking error. | The action continues. The notice has the first line of `stderr`. JSON on `stdout` can still decide. |
| Invalid JSON | <Documented /> | A non-blocking error. | The rules for one object, text, and several JSON lines are in the Exit code 0 section of the Hooks Reference. |

:::tip
Pick one style per hook. Use exit codes alone, or exit 0 with JSON. If you mix them, exit 2 keeps its blocking effect. Claude Code still reads the JSON fields.
:::

### What Exit 2 Does per Event

| Effect | Status | Events |
| --- | --- | --- |
| Blocks the action | <Documented /> | `PreToolUse`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `SubagentStop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `ConfigChange` (not `policy_settings`), `PostToolBatch`, `PreCompact`, `PreModelSwitch`, `Elicitation`, `ElicitationResult` |
| Fails the step | <Documented /> | `WorktreeCreate` always. `WorktreeRemove` if the folder still exists. |
| Shows `stderr` to Claude, no block | <Documented /> | `PostToolUse`, `PostToolUseFailure` |
| Shows `stderr` to you, no block | <Documented /> | `SubagentStart`, `SessionStart`, `SessionEnd`, `CwdChanged`, `FileChanged`, `PostCompact`, `PostModelSwitch` |
| Ignored | <Documented /> | `PermissionRequest`, `PermissionDenied`, `Notification`, `Setup`, `StopFailure`, `InstructionsLoaded`, `MessageDisplay`, and `DirectoryAdded` (its `stderr` goes to the debug log) |

## HTTP Responses

| Response | Status | What it does |
| --- | --- | --- |
| 2xx with an empty body | <Documented /> | Success. The same as exit 0 with no output. |
| 2xx with a JSON object | <Documented /> | Claude Code parses it like command JSON. A body that fails validation is a non-blocking error. |
| 2xx with other text, non-2xx, or a connection error | <Documented /> | A non-blocking error. Claude Code does not add the text to context. `onFailure: "block"` blocks. |

## How It Works

```mermaid
flowchart TD
    A[Hook ends] --> B{Exit code}
    B -- 2 --> C{Event can block?}
    C -- yes --> D["Block, <code>stderr</code><br/>is the reason"]
    C -- no --> E["Show <code>stderr</code><br/>by event rules"]
    B -- 0 --> F{"Output is one<br/>JSON object?"}
    F -- yes --> G["Read fields,<br/>apply decision"]
    F -- no --> H["Plain text, context<br/>on four events"]
    B -- other --> I["Non-blocking error,<br/>action continues"]
```

## Exact Fields

The hook input is in the `*HookInput` types in the Mod API type file `https://clawdipedia.cc/schemas/claude-code.d.ts`. The hook output is in `https://clawdipedia.cc/schemas/claude-code-hook-output.json`. The program's own validator makes it, with one definition for each `hookSpecificOutput`.
It lists every field of this release. Build on the fields it names. Look each one up there before you rely on it.

## Related Pages

- [Hooks](index.md): the overview.
- [Events](events.md): the fields of each event.
- [Handlers](handlers.md): what each handler type can return.
- [Agent Loop](../../how-it-works/agent-loop.md): a `PreToolUse` exit 2 example in context.

Source: [Hooks Reference](https://code.claude.com/docs/en/hooks) and the program (`BaseHookInput`, `McpServerProvenance`, `ClassicResultFields`, and the hook output schema).
We checked the exit code 2 table against the Hooks Reference. The `continue` and `systemMessage` results come from probes in `-p` mode with a local stub (see [Probes](../../reference/probes.md#subagents-and-hooks)).
