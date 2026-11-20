---
title: "Override a Prompt"
description: "Which built-in prompt texts in Claude Code 2.1.329 you can replace, append to, or turn off, and how."
sidebar_position: 2
generated: false
group: other
index:
  change: "✅ Yes. The page lists each prompt you can replace, append to, or turn off."
  toggle: "Per prompt. See the page."
  where: "Flags, env vars, settings, and files."
  status: Undocumented
---

Some built-in prompt texts can be changed. This page lists each one, says whether you can replace it, append to it, or turn it off, and shows how. Rows with the source "Probe" were run on 2.1.329 against the local stub, and the requests are in `captures/2.1.329/prompts`. Rows with the source "The program" come from the 2.1.329 program code.

- **Replace** means the original text is gone and yours takes its place.
- **Append** means the original stays and your text is added.
- **Turn Off** means the text is removed.
- **Indirect** means the text stays the same, but it tells the model to use something you control.
- **No** means we found no way to change the text.

A subscription (OAuth) login sends the same body keys, the same tool names, and 4 system blocks as an API key (live probe `live.oauth-parity` on 2.1.329, with the prompt `Reply with 'OK'.`). The server accepted the login (the message request got HTTP 200). The system text differs by one line, which only the API key side has. The probe runs Sonnet 5.5 on the subscription and Opus 5.5 on the key. The login also sends three betas that the key does not: `oauth-2025-04-20`, `extended-cache-ttl-2025-04-11`, and `tool-provenance-2026-10-26`.

## Agent Merge Rule

Agents are merged by name. The later source wins: `built-in`, `plugin`, `userSettings` (`~/.claude/agents`), `projectSettings` (`.claude/agents`), `flagSettings` (`--agents` JSON), `policySettings` (managed settings) (The program, `chunk-hg1yqkjk.js:140332`). A same-named file therefore replaces a built-in agent completely: body, tools, and model. The probes show this for `Explore` (project file) and `general-purpose` (`--agents`).

## Main System Prompt

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [Main system prompt](../defaults/system-prompt.md) | Replace | `--system-prompt` or `--system-prompt-file`. | Probe |
| [Main system prompt](../defaults/append-system-prompt.md) | Append | `--append-system-prompt` or `--append-system-prompt-file`. | Probe |
| [Main thread agent](../agents/agent-main.md) | Replace | `--agent`. | Probe |
| Auto memory section | Turn Off | [`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`](../context-and-memory/memory-off.md) (probe), or the `autoMemoryEnabled: false` setting (The program, `chunk-aq3ms068.js:2394`). | Probe |
| Git commit and PR rules in the Bash tool text | Turn Off | [`includeGitInstructions: false`](../context-and-memory/git-instructions-off.md) (probe), or `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`, which wins over the setting (The program, `chunk-hg1yqkjk.js:103931`). | Probe |
| Chrome integration prompt | Turn Off | `CLAUDE_CODE_DISABLE_CFC_PROMPT=1`. | The program |
| Resume prompt (`Continue from where you left off.`) | Replace | `CLAUDE_CODE_RESUME_PROMPT=<text>`. | The program |
| Managed memory | Append | `claudeMd` in managed settings only. CLAUDE.md-style text is added as org memory. | The program |

## Subagents and Built-In Agents

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [Explore agent](../agents/subagent-explore.md) | Replace | A [same-named agent file](../agents/override-agent-file.md), `.claude/agents/Explore.md`. You get no read-only tool list unless you set `tools`. | Probe |
| [Explore and Plan agents](../agents/disable-explore-plan.md) | Turn Off | `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` removes both from the agent list. | Probe |
| [Plan agent](../agents/subagent-plan.md) | Replace | Same rule as Explore: a same-named agent file. | The program |
| [general-purpose agent](../agents/subagent-general-purpose.md) | Replace | [`--agents`](../agents/override-agents-flag.md) JSON with the same name, or a same-named agent file. | Probe |
| [statusline-setup agent](../agents/subagent-statusline-setup.md) | Replace | A same-named agent file. | The program |
| [claude agent](../agents/subagent-claude.md) | Replace | A same-named agent file. | The program |
| [claude agent](../agents/subagent-claude.md) | Turn Off | `CLAUDE_CODE_DISABLE_AGENT_VIEW=1` or the `disableAgentView` setting. | The program |
| [web-fetch agent](../agents/subagent-web-fetch.md) | Replace | A same-named agent file. Off by default. `CLAUDE_CODE_WEB_FETCH_AGENT=1` turns it on and `CLAUDE_CODE_DISABLE_WEB_FETCH` turns it off. | The program |
| [claude-code-guide agent](../agents/subagent-claude-code-guide.md) | Replace | A same-named agent file. The [agent merge rule](#agent-merge-rule) applies to it. Not offered when the entry point is `sdk-ts`, `sdk-py`, or `sdk-cli` (The program, `chunk-hg1yqkjk.js:140207`), so it is not available in `-p`. The interactive session offers it (probe `pty.captures.guide`). | The program |
| [Workflow subagent](../agents/subagent-workflow.md) | No | No override found. | The program |
| [comment-thread-analyst agent](../agents/subagent-comment-thread-analyst.md) | No | No override found. | The program |
| [Coordinator and worker prompts](../agents/coordinator-mode.md) | No | No text override. Coordinator mode replaces the agent list and the main prompt. `--append-system-prompt` is still added. | The program |
| All subagent prompts | Append | [`--append-subagent-system-prompt <text>`](../agents/override-append-subagent.md) or `--append-subagent-system-prompt-file <file>`. Print mode only. Hidden from `--help`. It reaches nested subagents (The program, `chunk-txash88y.js:3632`). | Probe |
| All built-in agents | Turn Off | [`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`](../agents/disable-builtin-agents.md) in print mode removes the whole agent list. | Probe |
| Memory text for subagents | Turn Off | Set `CLAUDE_CODE_MEMORY_SUBAGENT_APPEND` and the memory block is not appended. Only matters with memory stores. | The program |
| Custom agent fields | Append | Frontmatter fields `initialPrompt`, `observer`, `observerMessage`, `omitClaudeMd`, and `skills` are text you set. | The program |
| [Observer prompt](../agents/observer.md) | Append | `observerMessage` in agent frontmatter. The base text is fixed. | The program |

The flags `--system-prompt` and `--append-system-prompt` do not reach built-in subagents. See [Subagent with --system-prompt and --append-system-prompt](../agents/subagent-with-prompt-flags.md).

## Slash Commands and Skills

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [/init](../commands/command-init.md) | Replace | A [command file](../commands/override-command-init.md), `.claude/commands/init.md`. `~/.claude/commands` works too: the program reads the `commands` folder (The program, `chunk-hg1yqkjk.js:280732`) in the `.claude` folder of the user (`chunk-hg1yqkjk.js:48856`). | Probe |
| [/security-review](../commands/command-security-review.md) | Replace | Same rule as `/init`. | The program |
| [/simplify](../skills/command-simplify.md) | Replace | A [same-named skill](./override-skill-simplify.md), `.claude/skills/simplify/SKILL.md`. The program lists skill files (`skillDirCommands`) before bundled skills (`bundledSkills`) and uses the first name match (The program, `chunk-hg1yqkjk.js:190384`, `chunk-hg1yqkjk.js:190396`, `chunk-6d5r944q.js:117`). It adds a `Base directory for this skill:` line (The program, `chunk-hg1yqkjk.js:99482`). | The program |
| [/debug](../skills/command-debug.md) | Replace | Same rule as `/simplify`. | The program |
| [/code-review](../skills/skill-code-review.md) and its `/review` alias | Replace | Same rule as `/simplify`. | The program |
| Other bundled skills: [batch](../skills/skill-batch.md), [claude-api](../skills/skill-claude-api.md), [dataviz](../skills/skill-dataviz.md), [deep-research](../skills/skill-deep-research.md), [doctor](../skills/skill-doctor.md), [fewer-permission-prompts](../skills/skill-fewer-permission-prompts.md), [goal](../skills/skill-goal.md), [insights](../skills/skill-insights.md), [loop](../skills/skill-loop.md), [plugin-authoring](../skills/skill-plugin-authoring.md), [run](../skills/skill-run.md), [run-skill-generator](../skills/skill-run-skill-generator.md), [team-onboarding](../skills/skill-team-onboarding.md), [update-config](../skills/skill-update-config.md), [verify](../skills/skill-verify.md), [workflow-authoring](../skills/skill-workflow-authoring.md) | Replace | A same-named skill file. No bundled skill in this build sets the program flag `cannotBeShadowed` that blocks a same-named skill (The program, `chunk-bn4xmax8.js:210`). | The program |

`/recap`, `/auto-mode-setup`, and `/autocompact` sent no model request, so they have no prompt to change. `/pr-comments` does not exist.

## Output Styles

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| Built-in styles: [Explanatory](../output-styles/style-explanatory.md), [Learning](../output-styles/style-learning.md), [Proactive](../output-styles/style-proactive.md), [Concise](../output-styles/style-concise.md) | Replace | You cannot edit them. A [custom style file with the same `name`](../output-styles/style-override-builtin.md), such as `~/.claude/output-styles/explanatory.md`, replaces one. | Probe |

## Compaction

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [Compaction prompt](../context-and-memory/compact-custom.md) | Append | Text after `/compact` goes under `Additional Instructions:`. | Probe |
| [Compaction prompt](../context-and-memory/compact-custom.md) | Append | Standard output of a `PreCompact` hook goes in the same place, after your text. | Probe |
| [Compaction prompt](../context-and-memory/compact.md) | Indirect | A `## Compact Instructions` section in CLAUDE.md is not copied into the compaction text. The compaction text tells the model to look for it in the context it already has. | Probe |

The base text stays in every case. The program picks one of several base texts by a server flag. The `control` text was seen.

## Hooks

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [Prompt hook](../hooks/hook-prompt.md) | No | You write `prompt` (`$ARGUMENTS` is the hook JSON) and `model`. The system text is fixed. It is different on [`Stop`](../hooks/hook-prompt-stop.md). | Probe |
| [Agent hook](../hooks/hook-agent.md) | No | You write `prompt` and `model`. Without `model`, it uses the small fast model (a Haiku model) when `ANTHROPIC_SMALL_FAST_MODEL` or `ANTHROPIC_DEFAULT_HAIKU_MODEL` is set or the requests go to the Anthropic API. In other setups it uses the main model (The program, `chunk-hg1yqkjk.js:261782`, `chunk-aq3ms068.js:21742`). The system text is fixed and has a `StructuredOutput` tool. | Probe |

## Auto Mode

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [Auto mode classifier](../modes/auto-classifier.md) | Append | The [`autoMode` setting](../modes/auto-classifier-custom.md) has `allow`, `soft_deny`, `hard_deny`, `environment`, and `classifyAllShell`. `"$defaults"` keeps the built-in rules at that spot. | Probe |
| [Auto mode classifier](../modes/auto-classifier-custom.md) | Replace | A list without `"$defaults"` replaces the built-in rules. In the test, `soft_deny` lost 72 default rules. | Probe |

The `autoMode` object is also sent to the server in `safeguards.classifier_context` on the main request. The test used the local fallback classifier.

## Plan Mode

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| [Plan mode workflow](../modes/plan-mode-instructions.md) | Replace | `--plan-mode-instructions <text>` (hidden flag) replaces the phases. The read-only preamble and the `ExitPlanMode` footer stay (The program, `chunk-txash88y.js:3640`). | Probe |

## Other

| Prompt | Override | How | Source |
| --- | --- | --- | --- |
| Tool descriptions | No | `--tools`, `--allowedTools`, and `--disallowedTools` only add or remove tools. `toolAliases` is an SDK option for names, not text (The program, `chunk-w03c3634.js:16733`). MCP tool text comes from the server. | The program |
| [Session title and branch name](./title-and-branch-name.md) | No | No override found. See also [session naming](./session-naming.md). | The program |
| [Memory selection](../context-and-memory/memory-selection.md) and [extraction](../context-and-memory/memory-extraction.md) | No | No override found. | The program |
| SDK `systemPrompt` presets | No | The SDK package passes flags to the program. The flags that give system prompt text are `--system-prompt[-file]`, `--append-system-prompt[-file]`, and `--append-subagent-system-prompt[-file]` (The program, `chunk-txash88y.js:3371`). | The program |

## Examples

### Replace the Explore Agent

Save this as `.claude/agents/Explore.md`. The name must match.

```markdown
---
name: Explore
description: Find files and answer questions about the code.
tools: Read, Grep, Glob
---

You search the codebase and report what you find. Do not edit files.
```

### Append to Every Subagent

This works in print mode only. The flag is hidden from `--help`.

```bash
claude -p --append-subagent-system-prompt "Answer in one short paragraph." "Use a subagent to find where login is handled."
```

### Keep the Auto Mode Defaults

Add your own rule and keep the built-in rules with `"$defaults"`.

```json
{
  "autoMode": {
    "soft_deny": ["$defaults", "Never push to the main branch."]
  }
}
```

### Replace a Bundled Skill

Save this as `.claude/skills/simplify/SKILL.md`. The skill name matches the built-in `/simplify`, and the program uses your file because skill files (`skillDirCommands`) come before bundled skills (`bundledSkills`) in the command list (The program, `chunk-hg1yqkjk.js:190396`).

```markdown
---
name: simplify
description: Simplify the code I changed.
---

Review the changed code. Remove dead code and extra layers. Keep behavior the same.
```

## Cases with No Override

- **Tool descriptions.** You can add or remove tools. You cannot change their text.
- **Hook prompt system text.** You write only the `prompt` and `model`.
- **Subagents and the main thread flags.** `--system-prompt` and `--append-system-prompt` do not reach built-in subagents. Use `--append-subagent-system-prompt`.
- **Compact Instructions in CLAUDE.md.** The `## Compact Instructions` section is not copied into the compaction text. It works only because the model is told to look for it in its context.
