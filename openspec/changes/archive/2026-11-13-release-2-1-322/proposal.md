# Proposal: Release Claude Code 2.1.322

## Why

The site tracks `2.1.321`. [`2.1.322`](https://github.com/anthropics/claude-code/releases/tag/v2.1.322) came out on 2026-11-10.
Its notes hold one item: fast mode on Vertex in the `global`, `us`, and `eu` regions, with a fall back to standard speed when Vertex refuses it.

## What Changes

### 1. Track `2.1.322`

Run the runbook in `tools/release/README.md` from `2.1.321` to `2.1.322`.
`captures/2.1.322/diff/report.md` names no added and no removed surface item. It names two changed items:

- The description of the `fastMode` setting.
- The `/project` command (minified names only).

The change is in the code that no surface kind lists: the provider check of fast mode, the Vertex region check, the model capability `vertex_fast_mode`,
the price text, the retry rule after a refusal, and the texts of `/fast`.
State each one only after a check in the program or a probe.

### 2. Settle the Fast Mode Rows by Experiment

- The print group `cli322` runs `/fast` for each provider, region, model, and switch.
- The cc-inspect `code` `cli` action runs the program as a Vertex client against the stub (`provider: "vertex"`), and the stub refuses fast mode on request (`fastRefusal`).
  It shows the request, and the state after a refusal with status 400, 403, and 404.
- One new page, `docs/configure/models-and-providers/fast-mode.md`, holds the rules. Each row that names fast mode on another page agrees with it.

### 3. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, render the prompt pages, move each program citation to the `2.1.322` build,
bump the plugins and cc-inspect, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracked-release-docs`: the Tracked Version Stamp requirement no longer names marketplace texts, because this repository holds no marketplace file.
  It now names the program citations in `docs/`, which `bun run check:citations` checks against the tracked build.

## Impact

`docs/`, `tools/release/`, `tools/check/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, `inspect/`, and `CHANGELOG.md`.
