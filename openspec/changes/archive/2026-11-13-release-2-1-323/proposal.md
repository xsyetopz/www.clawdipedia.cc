# Proposal: Release Claude Code 2.1.323

## Why

The site tracks `2.1.322`. [`2.1.323`](https://github.com/anthropics/claude-code/releases/tag/v2.1.323) came out on 2026-11-12.
Its notes hold 295 items, against one in `2.1.322`.

## What Changes

### 1. Track `2.1.323`

Run the runbook in `tools/release/README.md` from `2.1.322` to `2.1.323`, and give every item a page or an exclusion.
From `captures/2.1.323/diff/report.md`:

- 84 new environment variables, 1 gone (`CLAUDE_CODE_GB_REFRESH_INTERVAL_MS`), 4 changed. The first run reported 56 gone because of the env extractor defect below.
- 5 new flags, 2 gone, 1 changed.
- 1 new command (`claude workspace-trust`), 1 gone (`claude drop-worktree-registrations`), 6 changed.
- 2 new settings (`clawdFileProgressEnabled`, `precomputeArmTokens`), 3 changed (`subagentStatusLine` has no effect now).
- 1 new nested setting key (`permissions.blockFileToolReadsOutsideWorkingDirectories`), 5 changed.
- 1 new tool (`Yield`), 4 changed.
- 2 new endpoints, 1 gone.
- 69 new error texts, 29 gone.
- 163 new gates and 39 gone. The pattern exclusion covers them.

State a release-notes item only after a check in the program or a probe.

### 2. What Changed Holds Only `2.1.323`

`docs/start/what-changed.md` drops the `2.1.322` section and holds one section, which compares `2.1.323` with `2.1.322`.
`tools/release/facts/map.json` drops the `2.1.322` fact ids.

### 3. Tooling

- `release:diff` holds one parsed program at a time. Before the fix, the `2.1.323` run reached 8.5 GB and was stopped.
- The env extractor groups names by declaration. Before the fix, a name list split over two declarations dropped 55 names, and the diff reported them as gone.
- The OpenTelemetry page anchor and its `user.groups` attribute match the program.
- A `cli323` print probe group checks `unsetOptionCount`, `claude workspace-trust`, `subagentStatusLine`, and the `claude mcp add --help` examples.

### 4. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, render the prompt pages, move each program citation to the `2.1.323` build,
bump the plugins and cc-inspect, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

`docs/`, `tools/release/`, `tools/surface/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, `inspect/`, and `CHANGELOG.md`.
