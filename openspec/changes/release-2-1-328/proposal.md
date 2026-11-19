# Proposal: Release Claude Code 2.1.328

## Why

The site tracks `2.1.327`. [`2.1.328`](https://github.com/anthropics/claude-code/releases/tag/v2.1.328) came out after it.
Its notes hold 144 items.

## What Changes

### 1. Track `2.1.328`

Run the runbook in `tools/release/README.md` from `2.1.327` to `2.1.328`, and give every item a page or an exclusion.
From `captures/2.1.328/diff/report.md`:

- 9 new environment variables, 3 gone, 4 changed.
- 4 new flags.
- 1 changed command.
- 1 new setting, 2 changed.
- 1 new tool, 2 changed.
- 1 new beta.
- 3 new endpoints, 5 gone.
- 3 new Mod API members.
- 72 new error texts, 180 gone.
- 70 new gates, 33 gone, and 9 changed. The pattern exclusion covers them.

State a release-notes item only after a check in the program or a probe, or phrase it as what the release notes say.

### 2. What Changed Holds Only `2.1.328`

`docs/start/what-changed.md` drops the `2.1.327` section and holds one section, which compares `2.1.328` with `2.1.327`.
`tools/release/facts/map.json` drops the `2.1.327` fact ids.

### 3. Range Citations Move as One

`cc-inspect` moves a `:A-B` citation only when both ends find their code and the result keeps `A` before `B`.
A range whose ends land out of order keeps its numbers and moves only its chunk name, so `check:citations` flags it for a hand fix.

### 4. Surface Coverage Fixes Itself

`bun tools/surface/coverage.ts --fix` drops map and exclusion entries whose names the program no longer holds,
and carries an entry to the unmapped item that rewords it (`tools/surface/carry.ts`).

### 5. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, render the prompt pages, move each program citation to the `2.1.328` build,
bump the plugins, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

`docs/`, `inspect/mcp/`, `tools/release/`, `tools/surface/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, and `CHANGELOG.md`.
