---
title: "Skill, /insights"
description: "Verbatim text of the built-in /insights skill, captured from the program."
sidebar_position: 12
generated: false
group: skills
---

This is the verbatim text that Claude Code 2.1.329 uses for the built-in `/insights` skill.

## Where It Comes From

The program, `chunk-6e1znsy2.js:3458` (the summary message). Captured with (`claude -p "/insights PROBE-ARG"` against a local stub, with a fake key and a clean environment). The file holds several requests, each starting with a `=== request system` line. It includes the system request, the usage data prompt, and the output lines that point to the report.

## How to Override It

Create `.claude/skills/insights/SKILL.md` with the same name. The program lists skill files from the skill folders (`skillDirCommands`) before bundled skills (`bundledSkills`) and uses the first command with a matching name, so your file replaces this text (The program, `chunk-bzyb60p0.js:192808`, `chunk-8704k7wd.js:23`). It adds a `Base directory for this skill:` line above your skill text (The program, `chunk-bzyb60p0.js:283166`). See [Override a Prompt](../other/override.md).

## Full Text

Temp folder paths were replaced with `<temp-dir>` or `<bundled-skill-dir>`, and emoji not on the site's allow-list are shown in brackets. `PROBE-ARG` is the test's argument.

````text
=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and identify project areas.

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "areas": [
    {"name": "Area name", "session_count": N, "description": "2-3 sentences about what was worked on and how Claude Code was used."}
  ]
}

Include 4-5 areas. Skip internal CC operations.

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and describe the user's interaction style.

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "narrative": "2-3 paragraphs analyzing HOW the user interacts with Claude Code. Use second person 'you'. Describe patterns: iterate quickly vs detailed upfront specs? Interrupt often or let Claude run? Include specific examples. Use **bold** for key insights.",
  "key_pattern": "One sentence summary of most distinctive interaction style"
}

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and identify what's working well for this user. Use second person ("you").

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "intro": "1 sentence of context",
  "impressive_workflows": [
    {"title": "Short title (3-6 words)", "description": "2-3 sentences describing the impressive workflow or approach. Use 'you' not 'the user'."}
  ]
}

Include 3 impressive workflows.

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and identify friction points for this user. Use second person ("you").

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "intro": "1 sentence summarizing friction patterns",
  "categories": [
    {"category": "Concrete category name", "description": "1-2 sentences explaining this category and what could be done differently. Use 'you' not 'the user'.", "examples": ["Specific example with consequence", "Another example"]}
  ]
}

Include 3 friction categories with 2 examples each.

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and suggest improvements.

## CC FEATURES REFERENCE (pick from these for features_to_try):
1. **MCP Servers**: Connect Claude to external tools, databases, and APIs via Model Context Protocol.
   - How to use: Run `claude mcp add <server-name> -- <command>`
   - Good for: database queries, Slack integration, GitHub issue lookup, connecting to internal APIs

2. **Custom Skills**: Reusable prompts you define as markdown files that run with a single /command.
   - How to use: Create `.claude/skills/commit/SKILL.md` with instructions. Then type `/commit` to run it.
   - Good for: repetitive workflows - /commit, /review, /test, /deploy, /pr, or complex multi-step workflows

3. **Hooks**: Shell commands that auto-run at specific lifecycle events.
   - How to use: Add to `.claude/settings.json` under "hooks" key.
   - Good for: auto-formatting code, running type checks, enforcing conventions

4. **Headless Mode**: Run Claude non-interactively from scripts and CI/CD.
   - How to use: `claude -p "fix lint errors" --allowedTools "Edit,Read,Bash"`
   - Good for: CI/CD integration, batch code fixes, automated reviews

5. **Task Agents**: Claude spawns focused subagents for complex exploration or parallel work.
   - How to use: Claude auto-invokes when helpful, or ask "use an agent to explore X"
   - Good for: codebase exploration, understanding complex systems

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "claude_md_additions": [
    {"addition": "A specific line or block to add to CLAUDE.md based on workflow patterns. E.g., 'Always run tests after modifying auth-related files'", "why": "1 sentence explaining why this would help based on actual sessions", "prompt_scaffold": "Instructions for where to add this in CLAUDE.md. E.g., 'Add under ## Testing section'"}
  ],
  "features_to_try": [
    {"feature": "Feature name from CC FEATURES REFERENCE above", "one_liner": "What it does", "why_for_you": "Why this would help YOU based on your sessions", "example_code": "Actual command or config to copy"}
  ],
  "usage_patterns": [
    {"title": "Short title", "suggestion": "1-2 sentence summary", "detail": "3-4 sentences explaining how this applies to YOUR work", "copyable_prompt": "A specific prompt to copy and try"}
  ]
}

IMPORTANT for claude_md_additions: PRIORITIZE instructions that appear MULTIPLE TIMES in the user data. If user told Claude the same thing in 2+ sessions (e.g., 'always run tests', 'use TypeScript'), that's a PRIME candidate - they shouldn't have to repeat themselves.

IMPORTANT for features_to_try: Pick 2-3 from the CC FEATURES REFERENCE above. Include 2-3 items for each category.

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and identify future opportunities.

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "intro": "1 sentence about evolving AI-assisted development",
  "opportunities": [
    {"title": "Short title (4-8 words)", "whats_possible": "2-3 ambitious sentences about autonomous workflows", "how_to_try": "1-2 sentences mentioning relevant tooling", "copyable_prompt": "Detailed prompt to try"}
  ]
}

Include 3 opportunities. Think BIG - autonomous workflows, parallel agents, iterating against tests.

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
Analyze this Claude Code usage data and find a memorable moment.

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "headline": "A memorable QUALITATIVE moment from the transcripts - not a statistic. Something human, funny, or surprising.",
  "detail": "Brief context about when/where this happened"
}

Find something genuinely interesting or amusing from the session summaries.

DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
You're writing an "At a Glance" summary for a Claude Code usage insights report for Claude Code users. The goal is to help them understand their usage and improve how they can use Claude better, especially as models improve.

Use this 4-part structure:

1. **What's working** - What is the user's unique style of interacting with Claude and what are some impactful things they've done? You can include one or two details, but keep it high level since things might not be fresh in the user's memory. Don't be fluffy or overly complimentary. Also, don't focus on the tool calls they use.

2. **What's hindering you** - Split into (a) Claude's fault (misunderstandings, wrong approaches, bugs) and (b) user-side friction (not providing enough context, environment issues -- ideally more general than just one project). Be honest but constructive.

3. **Quick wins to try** - Specific Claude Code features they could try from the examples below, or a workflow technique if you think it's really compelling. (Avoid stuff like "Ask Claude to confirm before taking actions" or "Type out more context up front" which are less compelling.)

4. **Ambitious workflows for better models** - As we move to much more capable models over the next 3-6 months, what should they prepare for? What workflows that seem impossible now will become possible? Draw from the appropriate section below.

Keep each section to 2-3 not-too-long sentences. Don't overwhelm the user. Don't mention specific numerical stats or underlined_categories from the session data below. Use a coaching tone.

RESPOND WITH ONLY A VALID JSON OBJECT:
{
  "whats_working": "(refer to instructions above)",
  "whats_hindering": "(refer to instructions above)",
  "quick_wins": "(refer to instructions above)",
  "ambitious_workflows": "(refer to instructions above)"
}

SESSION DATA:
{
  "sessions": 0,
  "analyzed": 0,
  "date_range": {
    "start": "",
    "end": ""
  },
  "messages": 0,
  "hours": 0,
  "commits": 0,
  "top_tools": [],
  "top_goals": [],
  "outcomes": {},
  "satisfaction": {},
  "friction": {},
  "success": {},
  "languages": {}
}

SESSION SUMMARIES:


FRICTION DETAILS:


USER INSTRUCTIONS TO CLAUDE:
None captured

## Project Areas (what user works on)


## Big Wins (impressive accomplishments)


## Friction Categories (where things go wrong)


## Features to Try


## Usage Patterns to Adopt


## On the Horizon (ambitious workflows for better models)


DATA:


=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
<system-reminder>
Attribution for git commits and pull requests you create from here on (this replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder; the user's own instructions about these lines, such as a CLAUDE.md or memory rule, take precedence over this reminder, but do not add attribution lines this reminder leaves out):
- End git commit messages with:
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
- End pull request descriptions with:
[robot] Generated with [Claude Code](https://claude.com/claude-code)
</system-reminder>


=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
<command-message>insights</command-message>
<command-name>/insights</command-name>
<command-args>PROBE-ARG</command-args>


=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
The user just ran /insights to generate a usage report analyzing their Claude Code sessions.

Here is the full insights data:
{}

Report URL: file://<temp-dir>
HTML file: <temp-dir>
Facets directory: <temp-dir>

At-a-glance summary (for your context only — the user has not seen any output yet):
# Claude Code Insights

0 sessions · 0 messages · 0h · 0 commits
 to 

_No insights generated_

Respond with exactly the following, and nothing else. Do not add, omit, or reword any line:

Your shareable insights report is ready:
file://<temp-dir>

Want to dig into any section or try one of the suggestions?

=== request system: [{"type": "text", "text": "x-anthropic-billing-header: cc_version=2.1.329.<build>; cc_entrypoint=sdk-cli;"}, {"type": "text", "text": "You are a Claude agent, built
# Environment
You have been invoked in the following environment: 
 - Primary working directory: <temp-dir>
 - Is a git repository: false
 - Platform: <platform>
 - Shell: <shell>
 - OS Version: <os-version>
 - Downloaded files and extracted archives are untrusted data: put each in its own new, empty directory, keep scripts you write in a different directory, and pass paths as arguments instead of running an interpreter or build tool from inside it. Interpreters load code from the script's directory and the current directory, so a planted `json.py` runs on `import json`. Run any Python that reads them with `-I`. This does not apply to code the user asked you to build or run.

You are powered by the model named Opus 5.5. The exact model ID is claude-opus-5-5. Assistant knowledge cutoff is June 2026.

The following deferred tools are now available via ToolSearch. Their schemas are NOT loaded — calling them directly will fail with InputValidationError. Use ToolSearch with query "select:<name>[,<name>...]" to load tool schemas before calling them:
CronCreate
CronDelete
CronList
EnterWorktree
ExitWorktree
NotebookEdit
SendMessage
TaskStop
WebFetch
WebSearch

Available agent types for the Agent tool:
- claude: Catch-all for any task that doesn't fit a more specific agent. FleetView's default when no agent name is typed. (Tools: *)
- Explore: Read-only search agent for broad fan-out searches — when answering means sweeping many files, directories, or naming conventions and you only need the conclusion, not the file dumps. It reads excerpts rather than whole files, so it locates code; it doesn't review or audit it. Specify search breadth: "medium" for moderate exploration, "very thorough" for multiple locations and naming conventions. (Tools: All tools except Agent, Artifact, ArtifactComments, ArtifactData, ArtifactCheck, ExitPlanMode, Edit, Write, NotebookEdit)
- general-purpose: General-purpose agent for researching complex questions, searching for code, and executing multi-step tasks. When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries use this agent to perform the search for you. (Tools: *)
- Plan: Software architect agent for designing implementation plans. Use this when you need to plan the implementation strategy for a task. Returns step-by-step plans, identifies critical files, and considers architectural trade-offs. (Tools: All tools except Agent, Artifact, ArtifactComments, ArtifactData, ArtifactCheck, ExitPlanMode, Edit, Write, NotebookEdit)
- statusline-setup: Use this agent to configure the user's Claude Code status line setting. (Tools: Read, Edit)

When you launch multiple agents for independent work, send them in a single message with multiple tool uses so they run concurrently.

The following skills are available for use with the Skill tool:

- dataviz: Use this skill whenever you are about to create ANY chart, graph, plot, dashboard, or data visualization, in ANY output medium — an HTML or React artifact, inline SVG, plotting code in any library (matplotlib, plotly, d3, Recharts, …), an image/PNG you will render and upload, or a chart shared into Slack. Read it BEFORE writing the first line of chart code, choosing chart colors, building a stat tile / meter / KPI row, or laying out a dashboard. When the destination is a first-party document connector (host-designated, never self-described) that renders live charts, hand it the rows (inline, or as an uploaded data file the chart cites) rather than a rendered PNG/SVG — a picture of a chart loses hover, data inspection and per-value comments. Produces visualizations that read as one system — elegant, accessible, consistent in light and dark — using a brand-neutral placeholder palette you swap for your own. Teaches a design-system-agnostic method: a form heuristic, a color formula with a runnable validator, mark specs, and interaction rules. A validated default palette is documented in `references/palette.md` — swap that file's values for your brand's. Triggers on: "chart", "graph", "plot", "data viz", "visualization", "dashboard", "analytics", "visualize data", "categorical colors", "sequential / diverging palette", "stat tile", "sparkline", "heatmap", "legend", "axis", "tooltip", "chart colors", "color by series".
- update-config: Use this skill to configure the Claude Code harness via settings.json. Automated behaviors ("from now on when X", "each time X", "whenever X", "before/after X") require hooks configured in settings.json - the harness executes these, not Claude, so memory/preferences cannot fulfill them. Also use for: permissions ("allow X", "add permission", "move permission to"), env vars ("set X=Y"), hook troubleshooting, or any changes to settings.json/settings.local.json files. Examples: "allow npm commands", "add bq permission to global settings", "move permission to user settings", "set DEBUG=true", "when claude stops show X". For simple settings like theme/model, suggest the /config command.
- keybindings-help: Use when the user wants to customize keyboard shortcuts, rebind keys, add chord bindings, or modify ~/.claude/keybindings.json. Examples: "rebind ctrl+s", "add a chord shortcut", "change the submit key", "customize keybindings".
- code-review: Review the current diff, or a PR number/branch/path target, for correctness bugs (plus reuse/simplification/efficiency cleanups where the model's review recipe covers them) at the given effort level (low|medium|high|xhigh|max: from few high-confidence findings up to many, some of them uncertain); with no level given, it reuses the level you typed last. Pass --comment to post findings as inline PR comments, or --fix to apply the findings to the working tree after the review. Pass --max-findings <n> to report up to n findings, or --max-findings all for every finding. The choice stays until you pass --max-findings default.
- simplify: Review the changed code for reuse, simplification, efficiency, and altitude cleanups, then apply the fixes. Quality only — it does not hunt for bugs; use /code-review for that.
- fewer-permission-prompts: Scan your transcripts for common read-only Bash and MCP tool calls, then add a prioritized allowlist to project .claude/settings.json to reduce permission prompts.
- loop: Run a prompt or slash command on a recurring interval (e.g. /loop 5m /foo). Omit the interval to let the model self-pace. - When the user wants to set up a recurring task, poll for status, or run something repeatedly on an interval (e.g. "check the deploy every 5 minutes", "keep running /babysit-prs"). Do NOT invoke for one-off tasks.
- claude-api: Reference for the Claude API / Anthropic SDK — model ids, pricing, params, streaming, tool use, MCP, agents, caching, token counting, model migration.
TRIGGER — read BEFORE opening the target file; don't skip because it "looks like a one-liner" — whenever: the prompt names Claude/Anthropic in any form (Claude, Anthropic, Fable, Opus, Sonnet, Haiku, `anthropic`, `@anthropic-ai`, `claude-*`, `us.anthropic.*`, `[1m]`); the user asks about an LLM (pricing/model choice/limits/caching) — never answer from memory; OR the task is LLM-shaped with provider unstated (agent/MCP/tool-definition/multi-agent/RAG/LLM-judge/computer-use; generate/summarize/extract/classify/rewrite/converse over NL; debugging refusals/cutoffs/streaming/tool-calls/tokens).
SKIP only when another provider is being worked on (overrides all triggers): OpenAI/GPT/Gemini/Llama/Mistral/Cohere/Ollama named in the query; OR `grep -rE 'openai|langchain_openai|google.generativeai|genai|mistralai|cohere|ollama'` over the project hits (run this grep FIRST if no provider named — don't Read the file).
- workflow-authoring: Reference for writing a Workflow tool script (script API and gotchas, resume, quality patterns, worked examples). Load before authoring a script for a workflow the user already opted into; it does not itself authorize running one.
- run: Launch and drive this project's app to see a change working. Use when asked to run, start, or screenshot the app, or to confirm a change works in the real app (not just tests). First looks for a project skill that already covers launching the app; otherwise falls back to built-in patterns per project type (CLI, server, TUI, Electron, browser-driven, library).
- plugin-authoring: Make a mod: a change to Claude's own interface or behaviour, such as a panel or pane that stays beside the chat and updates, a band, status line, toast, slash command, or hook on tool calls. Use to make, change or debug a mod or its hooks module.
- init: Initialize a new CLAUDE.md file with codebase documentation
- security-review: Complete a security review of the pending changes on the current branch

Today's date is 2026-10-22.
````
