---
title: "Simple Prompt Switch on Opus"
description: "CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1 on Opus 5.5."
sidebar_position: 7
---

`CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` on Opus 5.5. Set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` and use `--model claude-opus-5-5`.

## Size

| Part | Characters |
| --- | --- |
| `system[0]` | 78 |
| `system[1]` | 62 |
| `system[2]` | 5,788 |
| `messages[0].content[0]` | 592 |
| `messages[0].content[1]` | 16 |
| `messages[1].content[0]` | 9,094 |
| System blocks only | 5,928 |
| Everything shown here | 15,920 |
| Tools sent | 12 |

Sizes count the text after the placeholders are in place. Each placeholder counts at its own length.

## What to Notice

- The text is the same as the default on Opus 5.5.

## Full Text

This variant sends exactly the same text and tools as [Default, Lean Prompt](./default-lean.md). The page for that variant has the full text.

## Compared to the Default

The diff below starts from [Default, Lean Prompt](./default-lean.md). Lines that start with `-` are only in the baseline. Lines that start with `+` are only here.

There are no differences in the text.

The tool list is the same as the baseline.
