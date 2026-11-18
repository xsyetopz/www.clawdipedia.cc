---
title: Hook Events
description: All 33 hook events, when each fires, what input it gets, and which output fields it accepts.
sidebar_position: 4
---

Claude Code has 33 hook events. Each event fires at one point in a session, gets its own input fields, and accepts its own output fields. Use this page to find the event that fits your check.

Add the event key to the `hooks` map to turn an event on. Remove it to turn the event off. The groups are tool, tool result, session, prompt and turn, agent and task, and other events. The fields that every event shares are on [Input and Output](input-and-output.md).[^hooks-reference]

## Example

This `SessionStart` hook adds your open tickets as context.

```json title=".claude/settings.json"
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{ "type": "command", "command": ".claude/hooks/tickets.sh" }]
      }
    ]
  }
}
```

```bash title=".claude/hooks/tickets.sh"
#!/bin/bash
# Plain stdout on SessionStart becomes context for Claude.
echo "Open tickets: $(gh issue list --limit 5 --json title -q '.[].title' | paste -sd ';' -)"
```

## All Events

| Event | Group | Fires when | Matcher | Can block |
| --- | --- | --- | --- | --- |
| [`PreToolUse`](tool-events.md#pretooluse) | Tool | Before a tool runs. | Tool name | ✅ |
| [`PermissionRequest`](tool-events.md#permissionrequest) | Tool | A permission prompt would show. | Tool name | ❌ (use a decision) |
| [`PermissionDenied`](tool-events.md#permissiondenied) | Tool | Auto mode denies a call. | Tool name | ❌ |
| [`PostToolUse`](tool-events.md#posttooluse) | Tool result | A tool call succeeds. | Tool name | ❌ |
| [`PostToolUseFailure`](tool-events.md#posttoolusefailure) | Tool result | A tool call fails. | Tool name | ❌ |
| [`PostToolBatch`](tool-events.md#posttoolbatch) | Tool result | All tool calls of a batch finish. | None | ✅ |
| [`SessionStart`](session-events.md#sessionstart) | Session | A session starts or resumes. | Start source | ❌ |
| [`Setup`](session-events.md#setup) | Session | `--init-only`, or `--init` or `--maintenance` with `-p`. | CLI flag | ❌ |
| [`SessionEnd`](session-events.md#sessionend) | Session | A session ends. | End reason | ❌ |
| [`InstructionsLoaded`](session-events.md#instructionsloaded) | Session | A `CLAUDE.md` or rules file loads. | Load reason | ❌ |
| [`ConfigChange`](session-events.md#configchange) | Session | A settings or skill file changes. | Config source | ✅ |
| [`CwdChanged`](session-events.md#cwdchanged) | Session | A shell command changes the directory. | None | ❌ |
| [`FileChanged`](session-events.md#filechanged) | Session | A watched file changes on disk. | File names | ❌ |
| [`DirectoryAdded`](session-events.md#directoryadded) | Session | You add a directory with `/add-dir`. | Add source | ❌ |
| [`UserPromptSubmit`](session-events.md#userpromptsubmit) | Prompt | You submit a prompt. | None | ✅ |
| [`UserPromptExpansion`](session-events.md#userpromptexpansion) | Prompt | A typed command expands to a prompt. | Command name | ✅ |
| [`MessageDisplay`](session-events.md#messagedisplay) | Prompt | Assistant text streams to the screen. | None | ❌ |
| [`Notification`](session-events.md#notification) | Prompt | Claude Code sends a notification. | Notification type | ❌ |
| [`Stop`](session-events.md#stop) | Prompt | The main agent finishes. | None | ✅ (keeps working) |
| [`StopFailure`](session-events.md#stopfailure) | Prompt | The turn ends on an API error. | Error type | ❌ |
| [`SubagentStart`](agent-events.md#subagentstart) | Agent | A subagent starts or resumes. | Agent type | ❌ |
| [`SubagentStop`](agent-events.md#subagentstop) | Agent | A subagent finishes. | Agent type | ✅ (keeps working) |
| [`TaskCreated`](agent-events.md#taskcreated) | Agent | `TaskCreate` makes a task. | None | ✅ |
| [`TaskCompleted`](agent-events.md#taskcompleted) | Agent | A task changes to done. | None | ✅ |
| [`TeammateIdle`](agent-events.md#teammateidle) | Agent | A teammate is about to go idle. | None | ✅ (keeps working) |
| [`PreCompact`](agent-events.md#precompact-and-postcompact) | Other | Before a compaction. | Trigger | ✅ |
| [`PostCompact`](agent-events.md#precompact-and-postcompact) | Other | After a compaction. | Trigger | ❌ |
| [`PreModelSwitch`](agent-events.md#premodelswitch-and-postmodelswitch) | Other | Before a requested model switch. | Target model | ✅ |
| [`PostModelSwitch`](agent-events.md#premodelswitch-and-postmodelswitch) | Other | After the model changes. | Target model | ❌ |
| [`Elicitation`](agent-events.md#elicitation-and-elicitationresult) | Other | An MCP server asks you for input. | Server name | ✅ (declines) |
| [`ElicitationResult`](agent-events.md#elicitation-and-elicitationresult) | Other | You answered an MCP question. | Server name | ✅ |
| [`WorktreeCreate`](agent-events.md#worktreecreate-and-worktreeremove) | Other | Claude Code needs a worktree. | None | ✅ (fails) |
| [`WorktreeRemove`](agent-events.md#worktreecreate-and-worktreeremove) | Other | Claude Code removes a hook-made worktree. | None | ✅ (fails) |

## Event Pages

| Page | Events |
| --- | --- |
| [Tool Hook Events](tool-events.md) | Tool events, tool result events, and the `PostToolUse` `tool_response` shapes. |
| [Session, Prompt, and Turn Hook Events](session-events.md) | Session events, and prompt and turn events. |
| [Agent, Task, and Other Hook Events](agent-events.md) | Agent and task events, compaction, model switch, elicitation, and worktree events. |

## Probe Findings

A print-mode probe showed these shapes.[^probe-print] A `Workflow` call has `tool_input` `{script}`, and its `PostToolUse` `tool_response` has `status` (`async_launched`), `taskId`, `taskType` (`local_workflow`), `workflowName`, `runId`, `summary`, and `transcriptDir`. A `Skill` call has `tool_input` `{skill}` and `tool_response` `{success, commandName}`. An MCP tool's `tool_response` is the list of content blocks that the server returned, for example `[{"type":"text","text":"pong"}]`. Built-in tool outputs differ per tool (see [`PostToolUse` `tool_response` Shapes](tool-events.md#posttooluse-tool_response-shapes)). We did not probe every built-in tool, and `WebFetch`, `ScheduleWakeup`, and `NotebookEdit` calls did not reach `PostToolUse` in our run.

## Related Pages

- [Hooks](index.md): the overview.
- [Configuration](configuration.md): matchers and timeouts.
- [Input and Output](input-and-output.md): common fields, decisions, and exit codes.
- [Subagent Runtime](../subagents/runtime.md): subagents and teams.

## Sources

[^hooks-reference]: [Hooks Reference](https://code.claude.com/docs/en/hooks), the `HookInput` types in the program type file, and the hook output schema in the program, `chunk-rj3e7agr.js:291182`.
[^probe-print]: Probed in `-p`.
