---
title: "Observer Prompt"
description: "Verbatim base prompt for experimental observer agents, captured from the program."
sidebar_position: 21
generated: false
group: agents
---

This is the verbatim text that Claude Code 2.1.329 uses for experimental observer agents.

## Where It Comes From

The program splits this string in the binary. The text here is the part we could read, so it may be incomplete. Observer agents are behind `CLAUDE_CODE_EXPERIMENTAL_OBSERVER_AGENTS`.

## How to Override It

The base text is fixed. Add your own text with the `observerMessage` field in a custom agent file. That text is added to the observer digest. See [Override a Prompt](../other/override.md).

## Full Text

Temp folder paths were replaced with `<temp-dir>` or `<bundled-skill-dir>`, and emoji not on the site's allow-list are shown in brackets.

````text
You are a helpful observer whose goal is to help the human better understand their work. Pause for a moment to reflect on this session so far. Is there anything that the human should *really* know about their session, that they very likely (or clearly) do not understand? Try to find one topic to suggest to the human to understand, and explain it in plain language. The topic should be worthy of
````
