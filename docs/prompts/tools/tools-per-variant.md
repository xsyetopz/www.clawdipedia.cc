---
title: "Tools per Variant"
description: "Which tools each system prompt variant sends, and how the tool text differs."
sidebar_position: 1
---

Tools are part of what the model reads. Each request carries a list of tools, and each tool has a name, a description, and a schema. This page compares the lists across variants.

## Default Tool List

The default list has 12 tools on Opus 5.5. The columns show the length of the description and of the JSON schema, in characters.

| Tool | Description | Schema |
| --- | --- | --- |
| [`Agent`](./tools.md#agent) | 3,225 | 1,942 |
| [`Bash`](./tools.md#bash) | 1,934 | 1,720 |
| [`Edit`](./tools.md#edit) | 360 | 552 |
| [`ListAgents`](./tools.md#listagents) | 777 | 316 |
| [`Read`](./tools.md#read) | 790 | 1,071 |
| [`ReportFindings`](./tools.md#reportfindings) | 574 | 1,545 |
| [`ScheduleWakeup`](./tools.md#schedulewakeup) | 3,396 | 1,392 |
| [`Skill`](./tools.md#skill) | 1,417 | 327 |
| [`ToolSearch`](./tools.md#toolsearch) | 952 | 406 |
| [`Workflow`](./tools.md#workflow) | 3,496 | 1,775 |
| [`DeferredToolPlaceholder`](./tools.md#deferredtoolplaceholder) | 83 | 33 |
| [`Write`](./tools.md#write) | 240 | 348 |

## Differences by Variant

Each row compares one variant to the default list. Variants with the same tools and text as the default are grouped at the end.

| Variant | Tools | Difference |
| --- | --- | --- |
| [Full Prompt](../defaults/full-prompt.md) | 12 | changes the text or schema of `Agent`, `Bash`, `Edit`, `Read`, `Write`. |
| [Bare Mode](../defaults/bare.md) | 3 | removes `Agent`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. changes the text or schema of `Bash`, `Edit`, `Read`. |
| [Simple Mode Env Var](../defaults/simple-env.md) | 3 | removes `Agent`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. changes the text or schema of `Bash`, `Edit`, `Read`. |
| [Exclude Dynamic Sections, Full Prompt](../defaults/exclude-dynamic-full.md) | 12 | changes the text or schema of `Agent`, `Bash`, `Edit`, `Read`, `Write`. |
| [Custom Output Style on the Full Prompt](../output-styles/style-custom-full.md) | 12 | changes the text or schema of `Agent`, `Bash`, `Edit`, `Read`, `Write`. |
| [Custom Output Style with Keep Coding Instructions](../output-styles/style-custom-keep.md) | 12 | changes the text or schema of `Agent`, `Bash`, `Edit`, `Read`, `Write`. |
| [Permission Mode, Plan](../modes/mode-plan.md) | 12 | changes the text or schema of `Bash`. |
| [Subagent, General Purpose](../agents/subagent-general-purpose.md) | 8 | removes `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`. |
| [Subagent, Explore](../agents/subagent-explore.md) | 5 | removes `Agent`, `Edit`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`, `Write`. |
| [Subagent, Plan](../agents/subagent-plan.md) | 5 | removes `Agent`, `Edit`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`, `Write`. |
| [Subagent, Custom Agent](../agents/subagent-custom.md) | 8 | removes `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`. |
| [Subagent, Statusline Setup](../agents/subagent-statusline-setup.md) | 2 | removes `Agent`, `Bash`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. |
| [Subagent, Claude (FleetView)](../agents/subagent-claude.md) | 8 | removes `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`. |
| [Subagent, Web Fetch](../agents/subagent-web-fetch.md) | 1 | adds `WebFetch`. removes `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. |
| [Override a Built-in Agent with a File](../agents/override-agent-file.md) | 8 | removes `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`. |
| [Override a Built-in Agent with --agents](../agents/override-agents-flag.md) | 8 | removes `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`. |
| [Append to Every Subagent Prompt](../agents/override-append-subagent.md) | 5 | removes `Agent`, `Edit`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`, `Write`. |
| [Turn Off All Built-in Agents](../agents/disable-builtin-agents.md) | 12 | changes the text or schema of `Agent`. |
| [Override /simplify with a Skill File](../other/override-skill-simplify.md) | 12 | changes the text or schema of `Bash`. |
| [Prompt Hook Request](../hooks/hook-prompt.md) | 0 | removes `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. |
| [Agent Hook Request](../hooks/hook-agent.md) | 10 | adds `StructuredOutput`. removes `Agent`, `ScheduleWakeup`, `Workflow`. |
| [Auto Mode Classifier](../modes/auto-classifier.md) | 0 | removes `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. |
| [Auto Mode Classifier, Custom Rules](../modes/auto-classifier-custom.md) | 0 | removes `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. |
| [Plan Mode, Custom Workflow](../modes/plan-mode-instructions.md) | 12 | changes the text or schema of `Bash`. |
| [Git Instructions Turned Off](../context-and-memory/git-instructions-off.md) | 12 | changes the text or schema of `Bash`. |
| [Subagent with --system-prompt and --append-system-prompt](../agents/subagent-with-prompt-flags.md) | 5 | removes `Agent`, `Edit`, `ListAgents`, `ReportFindings`, `ScheduleWakeup`, `Workflow`, `Write`. |
| [Prompt Hook on Stop](../hooks/hook-prompt-stop.md) | 0 | removes `Agent`, `Bash`, `Edit`, `ListAgents`, `Read`, `ReportFindings`, `ScheduleWakeup`, `Skill`, `ToolSearch`, `Workflow`, `DeferredToolPlaceholder`, `Write`. |
| [All Tools Sent Upfront](../defaults/tools-upfront.md) | 21 | adds `CronCreate`, `CronDelete`, `CronList`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `NotebookEdit`, `SendMessage`, `TaskStop`, `WebFetch`, `WebSearch`. removes `ToolSearch`, `DeferredToolPlaceholder`. |

## Same Tools as the Default

[Default, Sonnet 5.5](../defaults/default-sonnet.md), [Default, Haiku 5.5](../defaults/default-haiku.md), [Simple Prompt Switch on Sonnet](../defaults/simple-prompt-sonnet.md), [Simple Prompt Switch on Haiku](../defaults/simple-prompt-haiku.md), [Simple Prompt Switch on Opus](../defaults/simple-prompt-opus.md), [Exclude Dynamic Sections](../defaults/exclude-dynamic.md), [Output Style, Explanatory](../output-styles/style-explanatory.md), [Output Style, Learning](../output-styles/style-learning.md), [Output Style, Proactive](../output-styles/style-proactive.md), [Output Style, Concise](../output-styles/style-concise.md), [Custom Output Style](../output-styles/style-custom.md), [Custom Output Style with Keep Coding Instructions, Lean Prompt](../output-styles/style-custom-keep-lean.md), [Append System Prompt](../defaults/append-system-prompt.md), [Replace System Prompt](../defaults/system-prompt.md), [Replace and Append Together](../defaults/system-prompt-append.md), [With a CLAUDE.md File](../context-and-memory/claude-md.md), [Inside a Git Repository](../context-and-memory/git-repo.md), [Main Thread Custom Agent](../agents/agent-main.md), [Permission Mode, Accept Edits](../modes/mode-acceptEdits.md), [Permission Mode, Don't Ask](../modes/mode-dontAsk.md), [Brief Mode](../defaults/brief.md), [Compaction Prompt](../context-and-memory/compact.md), [Turn Off the Explore and Plan Agents](../agents/disable-explore-plan.md), [Command, /init](../commands/command-init.md), [Command, /security-review](../commands/command-security-review.md), [Skill, /simplify](../skills/command-simplify.md), [Skill, /debug](../skills/command-debug.md), [Override /init with a Command File](../commands/override-command-init.md), [Compaction Prompt, Custom Instructions](../context-and-memory/compact-custom.md), [Auto Memory Turned Off](../context-and-memory/memory-off.md), [Custom Output Style with a Built-in Name](../output-styles/style-override-builtin.md).

## Bare Mode Tools

| Tool | Description | Schema |
| --- | --- | --- |
| `Bash` | 22 | 1,483 |
| `Edit` | 29 | 552 |
| `Read` | 35 | 1,071 |
