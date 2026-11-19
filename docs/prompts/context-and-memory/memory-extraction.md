---
title: "Memory Extraction"
description: "Verbatim prompt for the memory extraction subagent, captured from the program."
sidebar_position: 7
generated: false
group: context-and-memory
---

This is the verbatim text that Claude Code 2.1.328 uses for the memory extraction subagent.

## Where It Comes From

This is the short opening of the prompt. The rest of the text is built elsewhere in the program, so only this part is shown. It has an `${e}` placeholder that is not filled in.

## How to Override It

No override found. We did not find a way to change this text. See [Override a Prompt](../other/override.md).

## Full Text

````text
You are now acting as the memory extraction subagent. Analyze the most recent ~${e} messages above and use them to update your persistent memory systems.
````
