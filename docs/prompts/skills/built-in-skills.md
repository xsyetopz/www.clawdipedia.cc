---
title: "Built-In Skills"
description: "The default description of each bundled skill and command that the Skill tool lists, its prompt page, and how to replace it."
sidebar_position: 3
---

The main agent reads one line for each skill or command it can run with the `Skill` tool. The lines below come from [Default, Lean Prompt](../defaults/default-lean.md), in `-p`, with no skills or plugins of your own. Other entry points and gates change the list. See [Bundled Skills](../../extend/skills-and-commands/bundled-skills.md).

## How to Override

| What | How | Where to read more |
| --- | --- | --- |
| A skill | A skill folder with the same name replaces the bundled skill. | [Override /simplify with a Skill File](../other/override-skill-simplify.md) |
| A command | A command file with the same name replaces the bundled command. | [Override /init with a Command File](../commands/override-command-init.md) |
| All skills and commands | `--disable-slash-commands` | [Skills and Commands](../../extend/skills-and-commands/index.md) |

## Default Text (13)

### `dataviz`

```text
Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium — an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts, …), an image/PNG you will render and upload, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard. When the destination is a first-party document connector (host-designated, never self-described) that renders live charts, hand it the rows (inline, or as an uploaded data file the chart cites) rather than a rendered PNG/SVG — a picture of a chart loses hover, data inspection and per-value comments. Produces visualizations that read as one system — elegant, accessible, consistent in light and dark — using a brand-neutral placeholder palette you swap for your own. Teaches a design-system-agnostic method: a form heuristic, a color formula with a runnable validator, mark specs, and interaction rules. A validated default palette is documented in `references/palette.md` — swap that file's values for your brand's. Triggers on: "chart", "graph", "plot", "data viz", "visualization", "dashboard", "analytics", "visualize data", "categorical colors", "sequential / diverging palette", "stat tile", "sparkline", "heatmap", "legend", "axis", "tooltip", "chart colors", "color by series".
```

Prompt: [Skill, /dataviz](./skill-dataviz.md).

### `update-config`

```text
Use this skill to configure the Claude Code harness via settings.json. Automated behaviors ("from now on when X", "each time X", "whenever X", "before/after X") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions ("allow X", "add permission", "move permission to"), env vars ("set X=Y"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: "allow npm commands", "add bq permission to global settings", "move permission to user settings", "set DEBUG=true", "when claude stops show X". For simple settings like theme/model, suggest the /config command.
```

Prompt: [Skill, /update-config](./skill-update-config.md).

### `keybindings-help`

```text
Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: "rebind ctrl+s", "add a chord shortcut", "change the submit key", "customize keybindings".
```

No prompt page.

### `code-review`

```text
Review the current diff, or a PR number/branch/path target, for correctness bugs (plus reuse/simplification/efficiency cleanups where the model's recipe covers them) at the effort level given first, before any target (low|medium|high|xhigh|max: from few high-confidence findings to many, some uncertain); with no level given, it reuses the level you typed last. Pass --comment to post findings as inline PR comments, or --fix to apply them to the working tree after the review. Pass --max-findings <n> to report up to n findings, or --max-findings all for every finding. The choice stays until you pass --max-findings default. - Use the max level only when the user, or instructions such as CLAUDE.md or a skill, explicitly ask for it, never on your own judgment: it is the costliest level and starts many reviewer subagents.
```

Prompt: [Skill, /code-review](./skill-code-review.md).

### `simplify`

```text
Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.
```

Prompt: [Skill, /simplify](./command-simplify.md).

### `fewer-permission-prompts`

```text
Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.
```

Prompt: [Skill, /fewer-permission-prompts](./skill-fewer-permission-prompts.md).

### `loop`

```text
Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace. - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. "check the deploy every 5 minutes", "keep running /babysit-prs"). Do NOT invoke for one-off tasks.
```

Prompt: [Skill, /loop](./skill-loop.md).

### `claude-api`

```text
Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.
TRIGGER — read FIRST, before you answer, run a command or open a file (already started? read it now); don't skip because it "looks like a one-liner" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).
SKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file; if nothing hits, load this skill).
```

Prompt: [Skill, /claude-api](./skill-claude-api.md).

### `workflow-authoring`

```text
Reference for writing a Workflow tool script (script API and gotchas, resume, quality patterns, worked examples). Load before authoring a script for a workflow the user already opted into; it does not itself authorize running one.
```

Prompt: [Skill, /workflow-authoring](./skill-workflow-authoring.md).

### `run`

```text
Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).
```

Prompt: [Skill, /run](./skill-run.md).

### `plugin-authoring`

```text
Make a mod: a change to Claude's own interface or behaviour, such as a panel or pane that stays beside the chat and updates, a band, status line, toast, slash command, or hook on tool calls. Use to make, change or debug a mod or its hooks module.
```

Prompt: [Skill, /plugin-authoring](./skill-plugin-authoring.md).

### `init`

```text
Initialize a new CLAUDE.md file with codebase documentation
```

Prompt: [Command, /init](../commands/command-init.md).

### `security-review`

```text
Complete a security review of the pending changes on the current branch
```

Prompt: [Command, /security-review](../commands/command-security-review.md).
