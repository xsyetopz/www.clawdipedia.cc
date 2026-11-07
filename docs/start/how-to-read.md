---
title: How to Read These Docs
description: What the badges mean, what the tables show, where the facts come from, and which release this site covers.
sidebar_position: 1
---

This site explains Claude Code in plain words.
Each page names what an item does, where you set it, and which switch turns it on or off.
This page shows you how to read the marks and tables on those pages.

:::note[Unofficial Site]
This is a community project. It is not made by or tied to Anthropic.
Official docs are the first place to check for supported behavior.
:::

## Badges

A badge is a small colored label in the `Status` column of a table.
Hover over a badge to see what it means.

| Badge | What it means |
| --- | --- |
| <Documented /> | An official docs page names this item. |
| <Undocumented /> | Only the program shows this item. It can change without notice. |
| <Differs /> | The official docs and the program disagree. The row says how. |
| <Gated note="Example: a flag name" /> | It works only behind a flag or a server gate. The row says which one. |

An item can carry more than one badge.
For example, an item can be <Undocumented /> and <Gated /> at the same time.

:::warning
Treat <Undocumented /> items with care.
They work today, but nobody promises they will work in the next release.
:::

## Status Labels

Four more labels can follow the badges in the `Status` column.
Each has one meaning. A label adds a fact that the provenance badges above do not carry. It never replaces a badge.

| Label | What it means |
| --- | --- |
| <ManagedOnly /> | The setting works only in managed (organization policy) settings. The source is the `x-managed-only` flag in the managed settings schema. |
| <Experimental /> | The program or the official docs call it experimental or beta. |
| <Deprecated note="Example: use the new name" /> | It is deprecated. Hover over the label to see what replaces it, when the row names one. |
| <Caution note="Example: deletes data" /> | It has a side effect to notice. It deletes data, skips a safety check or permission, or sends data off your machine. |

The name cell holds only the item name. The label is plain text. A screen reader reads it with the other badges.

## Marks in Tables

A table cell that answers a question uses a mark or a word.

| Mark | What it means |
| --- | --- |
| ✅ | Yes. |
| ❌ | No. |
| Unknown | Neither the official docs nor the program say. |

Text can follow a mark, such as "✅ Yes. Type `/` to see the list."
A star after a mark, such as ✅\*, points to a note under the table that starts with the same star.
In a table cell, a screen reader says "Yes" or "No" for a mark that stands alone.
The marks never replace the words in a heading or a link.

## Item Tables

Tables list single items.
They use columns such as `Item`, `Status`, `What it does`, `Default`, and `Where to set it`.

## Only Usable Items Are Listed

The site lists only things you can use, change, or switch.
It leaves out removed items, items that do nothing, items that exist only for tests, and items for Anthropic staff.
If an item is not here, you should not rely on it.

## Where Facts Come From

Every fact has a source.

- Official docs: the page links to the official page by its title.
- The program: the page says "Source: the program" and names the string, key, or type in inline code.
- Probes: some facts come from running the program against a local stub. No model call leaves the machine.

A fact that no check settles is left out.

## One Release Only

This site tracks only the newest release.
The current release is shown in the top bar, for example "Tracks 2.1.314".
There are no old versions of the docs.
The [What Changed](what-changed.md) page lists breaking changes in the current release, against the release before it.
For an earlier release, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How the Text Is Written

The text uses Simple English: common words, short sentences, and one idea at a time.
Every code item, such as a command, a path, a key, or an environment variable, is in `inline code`.
For more help, read the [Style Guide](../contributing/style-guide.md).
