---
title: "Skill, /deep-research"
description: "Verbatim text of the built-in /deep-research skill, captured from the program."
sidebar_position: 8
generated: false
group: skills
---

This is the verbatim text that Claude Code 2.1.329 uses for the built-in `/deep-research` skill.

## Where It Comes From

Bundled skill. Captured from the program with `PROBE-ARG`, the argument the test used in place of your input.

## How to Override It

Create `.claude/skills/deep-research/SKILL.md` with the same name. The program lists skill files from the skill folders (`skillDirCommands`) before bundled skills (`bundledSkills`) and uses the first command with a matching name, so your file replaces this text (The program, `chunk-bzyb60p0.js:192808`, `chunk-8704k7wd.js:23`). It adds a `Base directory for this skill:` line above your skill text (The program, `chunk-bzyb60p0.js:283166`). See [Override a Prompt](../other/override.md).

## Full Text

`PROBE-ARG` is the test's argument.

````text
<command-message>deep-research</command-message>
<command-name>/deep-research</command-name>
<command-args>PROBE-ARG</command-args>

Run the "deep-research" workflow.

Deep research harness — fan-out web searches, fetch sources, adversarially verify claims, synthesize a cited report.

When the user wants a deep, multi-source, fact-checked research report on any topic. BEFORE invoking, check if the question is specific enough to research directly — if underspecified (e.g., "what car to buy" without budget/use-case/region), ask 2-3 clarifying questions to narrow scope. Then pass the refined question as args, weaving the answers in.

Phases:
- Scope: Decompose question (from args) into 5 search angles
- Search: 5 parallel WebSearch agents, one per angle
- Fetch: URL-dedup, fetch top 15 sources, extract falsifiable claims
- Verify: 3-vote adversarial verification per claim (need 2/3 refutes to kill)
- Synthesize: Merge semantic dupes, rank by confidence, cite sources

Invoke: Workflow({ name: "deep-research", args: "PROBE-ARG" })

If the user asks you to modify this workflow or write a new script, load the `workflow-authoring` skill first.
````
