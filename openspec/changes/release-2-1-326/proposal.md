# Proposal: Release Claude Code 2.1.326

## Why

The site tracks `2.1.323`. [`2.1.325`](https://github.com/anthropics/claude-code/releases/tag/v2.1.325) came out on 2026-11-13,
and [`2.1.326`](https://github.com/anthropics/claude-code/releases/tag/v2.1.326) on 2026-11-16. No `2.1.324` release exists.
The notes hold 139 items for `2.1.325` and 367 for `2.1.326`.

## What Changes

### 1. Track `2.1.326`

Run the runbook in `tools/release/README.md` from `2.1.323` to `2.1.326`, and give every item a page or an exclusion.
From `captures/2.1.326/diff/report.md`:

- 25 new environment variables, 1 gone (`CLAUDE_CODE_DECSTBM`).
- 7 new flags, 51 changed.
- 1 new command, 15 changed.
- 3 changed settings, 1 new nested setting key, 5 changed.
- 3 new tools, 1 gone, 1 changed.
- 6 new endpoints, 1 gone.
- 148 new error texts, 90 gone.
- 14 new Mod API items.
- 201 new gates and 48 gone. The pattern exclusion covers them.

State a release-notes item only after a check in the program or a probe.

### 2. What Changed Holds Only `2.1.326`

`docs/start/what-changed.md` drops the `2.1.323` section and holds one section, which compares `2.1.326` with `2.1.323`.
`tools/release/facts/map.json` drops the `2.1.323` fact ids.

### 3. Tooling

- The `.mcp.json` schema capture skips other declarations of the same statement, which `2.1.326` adds.
- The hand-typed schema fields follow the `2.1.326` code.

### 4. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, render the prompt pages, move each program citation to the `2.1.326` build,
bump the plugins, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

`docs/`, `tools/release/`, `tools/schemas/`, `tools/surface/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, and `CHANGELOG.md`.
