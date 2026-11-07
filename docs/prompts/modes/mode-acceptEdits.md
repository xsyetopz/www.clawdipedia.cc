---
title: "Permission Mode, Accept Edits"
description: "Starts in acceptEdits permission mode."
sidebar_position: 2
---

Starts in `acceptEdits` permission mode. Run `claude --permission-mode acceptEdits`.

## Size

| Part | Characters |
| --- | --- |
| `system[0]` | 78 |
| `system[1]` | 62 |
| `system[2]` | 5,747 |
| `messages[0].content[0]` | 592 |
| `messages[0].content[1]` | 16 |
| `messages[1].content[0]` | 9,005 |
| System blocks only | 5,887 |
| Everything shown here | 15,790 |
| Tools sent | 12 |

Sizes count the text after the placeholders are in place. Each placeholder counts at its own length.

## What to Notice

- `acceptEdits` does not change the text. The mode only changes what asks for permission.

## Full Text

This variant sends exactly the same text and tools as [Default, Lean Prompt](../defaults/default-lean.md). The page for that variant has the full text.

## Compared to the Default

The diff below starts from [Default, Lean Prompt](../defaults/default-lean.md). Lines that start with `-` are only in the baseline. Lines that start with `+` are only here.

There are no differences in the text.

The tool list is the same as the baseline.
