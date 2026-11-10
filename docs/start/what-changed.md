---
title: What Changed
description: What changed in Claude Code 2.1.322, the release this site covers, against 2.1.321, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.322`, the release this site covers, against `2.1.321`, the release before it.
It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.322`, the version shown in the navbar.

## Version 2.1.322

Sources: the release notes of [`2.1.322`](https://github.com/anthropics/claude-code/releases/tag/v2.1.322) (November 10, 2026), and a comparison of the `2.1.321` and `2.1.322` programs. The notes hold one item, which is the first two rows. Rows marked with the program, or with a case id, come from the program and not from release notes.

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Fast mode on Vertex | <Documented /> | `/fast`, `--fast-mode on`, and a flag setting `fastMode: true` turn fast mode on with Vertex in the regions `global`, `us`, and `eu` ([2.1.322 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.322); cases `print.cli322.fast-vertex-global`, `.fast-vertex-us`, `.fast-vertex-eu`). In another region, `/fast on` names the region variable to set (case `print.cli322.fast-vertex-us-east5`). | [Fast Mode](../configure/models-and-providers/fast-mode.md) |
| Fall back to standard speed on Vertex | <Documented /> | When Vertex refuses a fast request, the program sends it again at standard speed. A `400` refusal keeps that model at standard speed until the session ends. A `403` or `404` refusal starts a cooldown of 30 minutes ([2.1.322 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.322); cc-inspect runs with `fastRefusal`). | [Fast Mode](../configure/models-and-providers/fast-mode.md#fallback-to-standard-speed) |
| Model capability `vertex_fast_mode` | <Undocumented /> | A new capability that `claude-fable-5-2` and `claude-mythos-5-2` have. `CLAUDE_CODE_MODEL_CAPABILITIES` can give it to another model or take it away (the program; cases `print.cli322.fast-vertex-capability-on`, `.fast-vertex-capability-off`). | [Model Catalog](../configure/models-and-providers/model-catalog.md#capabilities) |
| `fastMode` in a settings file on Vertex | <Undocumented /> | The program ignores a saved value on Vertex. `/fast on` there lasts for the session only (the program; case `print.cli322.fast-vertex-global`). | [Model Settings](../configure/settings/model.md) |
| `/fast` texts | <Undocumented /> | On a provider without fast mode, the text is now `Fast mode is not available on this provider` (cases `print.cli322.fast-bedrock`, `.fast-foundry`). On Vertex, the ON text has `2x <model> standard price` and no dollar price. A cooldown can show `Fast mode was refused for this project` and `Trying fast mode again` (the program). | [Fast Mode](../configure/models-and-providers/fast-mode.md#availability-reasons-and-texts) |
| The fast mode sentence of the system prompt | <Undocumented /> | On Vertex, the sentence ends with `switches the session to a model that does` (the program). | [Fast Mode](../configure/models-and-providers/fast-mode.md#request) |
| Fast mode probes | <Undocumented /> | The `cli322` probe group runs `/fast` for each provider, region, model, and switch. | [Release Probes](../reference/probes.md) |

The comparison of the two programs names no added and no removed environment variable, flag, command, setting, hook, or endpoint.

## Earlier Releases

This site keeps no page for an older release. The official [Changelog](https://code.claude.com/docs/en/changelog) lists every release.

## Example

You update to `2.1.322` and use Claude Code with Vertex in the region `us-east5`.
Set the region of Fable 5.2 to `global`. Then start a session with fast mode on:

```bash
claude --version
export VERTEX_REGION_CLAUDE_FABLE_5_2=global
claude --model claude-fable-5-2 --fast-mode on
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
