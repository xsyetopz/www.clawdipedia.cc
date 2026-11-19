---
title: "Skill, /goal"
description: "Verbatim text of the built-in /goal skill, captured from the program."
sidebar_position: 11
generated: false
group: skills
---

This is the verbatim text that Claude Code 2.1.328 uses for the built-in `/goal` skill.

## Where It Comes From

The program, `chunk-m5tvvpnw.js:1541` (the text) and `chunk-zcykke27.js:7146` (the `Goal set` line). The text is the message after `/goal` sets a goal. It says a session-scoped Stop hook is active and blocks stopping until the condition holds. `PROBE-ARG` is the test's goal text.

## How to Override It

Create `.claude/skills/goal/SKILL.md` with the same name. The program lists skill files from the skill folders before bundled skills and uses the first command with a matching name, so your file replaces this text (The program, `chunk-56bhcxay.js:2630374`, `chunk-458m0skd.js:2592`). It adds a `Base directory for this skill:` line above your skill text (The program, `chunk-56bhcxay.js:3885828`). See [Override a Prompt](../other/override.md).

## Full Text

`PROBE-ARG` is the test's argument.

````text
<command-name>/goal</command-name>
            <command-message>goal</command-message>
            <command-args>PROBE-ARG</command-args>

<local-command-stdout>Goal set: PROBE-ARG</local-command-stdout>


A session-scoped Stop hook is now active with condition: "PROBE-ARG". Briefly acknowledge the goal, then immediately start (or continue) working toward it — treat the condition itself as your directive and do not pause to ask the user what to do. The hook will block stopping until the condition holds. It auto-clears once the condition is met — do not tell the user to run `/goal clear` after success; that's only for clearing a goal early.
````
