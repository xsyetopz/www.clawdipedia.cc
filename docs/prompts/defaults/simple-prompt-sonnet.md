---
title: "Simple Prompt Switch on Sonnet"
description: "CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1 on Sonnet 5.5."
sidebar_position: 5
---

`CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` on Sonnet 5.5. Set `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` and use `--model claude-sonnet-5-5`.

## Size

| Part | Characters |
| --- | --- |
| `system[0]` | 78 |
| `system[1]` | 62 |
| `system[2]` | 5,521 |
| `messages[0].content[0]` | 594 |
| `messages[0].content[1]` | 16 |
| `messages[1].content[0]` | 9,098 |
| System blocks only | 5,661 |
| Everything shown here | 15,659 |
| Tools sent | 12 |

Sizes count the text after the placeholders are in place. Each placeholder counts at its own length.

## What to Notice

- The text and tools are the same as the default on Sonnet 5.5. In this release the "short" prompt is already what Sonnet gets.

## Full Text

This variant sends exactly the same text and tools as [Default, Sonnet 5.5](./default-sonnet.md). The page for that variant has the full text.

## Compared to the Default

The diff below starts from [Default, Sonnet 5.5](./default-sonnet.md). Lines that start with `-` are only in the baseline. Lines that start with `+` are only here.

There are no differences in the text.

The tool list is the same as the baseline.
