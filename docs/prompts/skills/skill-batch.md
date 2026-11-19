---
title: "Skill, /batch"
description: "Verbatim text of the built-in /batch skill, captured from the program."
sidebar_position: 4
generated: false
group: skills
---

This is the verbatim text that Claude Code 2.1.328 uses for the built-in `/batch` skill.

## Where It Comes From

Captured from the program. The text is the notice that `/batch` shows when the folder is not a git repository. The notice says `/batch` needs a git repository, or WorktreeCreate and WorktreeRemove hooks for another version-control system.

## How to Override It

Create `.claude/skills/batch/SKILL.md` with the same name. The program lists skill files from the skill folders before bundled skills and uses the first command with a matching name, so your file replaces this text (The program, `chunk-56bhcxay.js:2630374`, `chunk-458m0skd.js:2592`). It adds a `Base directory for this skill:` line above your skill text (The program, `chunk-56bhcxay.js:3885828`). See [Override a Prompt](../other/override.md).

## Full Text

`PROBE-ARG` is the test's argument.

````text
<command-message>batch</command-message>
<command-name>/batch</command-name>
<command-args>PROBE-ARG</command-args>

The `/batch` command runs each agent in its own isolated worktree, and none can be created here: this directory is not in a git repository and no WorktreeCreate hook is configured. Run `/batch` from inside a git repository, or configure WorktreeCreate and WorktreeRemove hooks in settings.json for another version-control system.
````
