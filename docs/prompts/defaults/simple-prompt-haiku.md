---
title: "Simple Prompt Switch on Haiku"
description: "CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1 on Haiku 5.5."
sidebar_position: 6
---

`CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` on Haiku 5.5. Set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` and use `--model claude-haiku-5-5`.

## Size

| Part | Characters |
| --- | --- |
| `system[0]` | 78 |
| `system[1]` | 62 |
| `system[2]` | 8,364 |
| `messages[0].content[0]` | 593 |
| `messages[0].content[1]` | 16 |
| `messages[1].content[0]` | 9,147 |
| System blocks only | 8,504 |
| Everything shown here | 18,550 |
| Tools sent | 12 |

Sizes count the text after the placeholders are in place. Each placeholder counts at its own length.

## What to Notice

- The text is the same as the default on Haiku 5.5. The extra paragraphs stay, so they are not part of the full or short switch.

## Full Text

This variant sends exactly the same text and tools as [Default, Haiku 5.5](./default-haiku.md). The page for that variant has the full text.

## Compared to the Default

The diff below starts from [Default, Haiku 5.5](./default-haiku.md). Lines that start with `-` are only in the baseline. Lines that start with `+` are only here.

There are no differences in the text.

The tool list is the same as the baseline.
