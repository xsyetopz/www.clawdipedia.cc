---
title: "Custom Output Style with Keep Coding Instructions, Lean Prompt"
description: "The same keep flag on the lean prompt. The diff shows whether it does anything."
sidebar_position: 8
---

The same keep flag on the lean prompt. The diff shows whether it does anything. Add `keep-coding-instructions: true` to the style's front matter on a lean model.

## Size

| Part | Characters |
| --- | --- |
| `system[0]` | 78 |
| `system[1]` | 62 |
| `system[2]` | 5,785 |
| `messages[0].content[0]` | 592 |
| `messages[0].content[1]` | 16 |
| `messages[1].content[0]` | 9,185 |
| System blocks only | 5,925 |
| Everything shown here | 16,008 |
| Tools sent | 12 |

Sizes count the text after the placeholders are in place. Each placeholder counts at its own length.

## What to Notice

- On the lean prompt the key changes nothing. The wiki says this too (`keep-coding-instructions` has no effect on the short prompt), and the capture agrees.

## Full Text

This variant sends exactly the same text and tools as [Custom Output Style](./style-custom.md). The page for that variant has the full text.

## Compared to the Default

The diff below starts from [Custom Output Style](./style-custom.md). Lines that start with `-` are only in the baseline. Lines that start with `+` are only here.

There are no differences in the text.

The tool list is the same as the baseline.
