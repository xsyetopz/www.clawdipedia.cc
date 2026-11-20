# Proposal: Release Claude Code 2.1.329

## Why

The site tracks `2.1.328`. [`2.1.329`](https://github.com/anthropics/claude-code/releases/tag/v2.1.329) came out after it.
Its notes hold 130 items.

## What Changes

### 1. Track `2.1.329`

Run the runbook in `tools/release/README.md` from `2.1.328` to `2.1.329`, and give every item a page or an exclusion.
From `captures/2.1.329/diff/report.md`:

- 11 new environment variables, 12 gone, 4 changed.
- 1 new flag (`auth login --organization-gateway`), 1 changed.
- 1 command gone (`/loops`), 4 changed.
- 2 new settings.
- 1 new endpoint.
- 1 new Mod API member.
- 1 changed OpenTelemetry event and 1 changed tool.
- 114 new error texts, 88 gone.
- 61 new gates, 28 gone, and 3 changed. The pattern exclusion covers them.

State a release-notes item only after a check in the program or a probe, or phrase it as what the release notes say.

### 2. Every Claim Holds on `2.1.329`

Each claim that named `2.1.328`, or that rested on release notes, schema text, or a probe alone, is checked again in the `2.1.329` program.
The print, pty, live, and managed probes run again on `2.1.329`, and each page that quotes a probe number takes the new number.
A claim that the program does not prove is corrected or removed.

### 3. Citations Name Cleaned-Module Lines

`cc-inspect` checks that each `chunk-x.js:N` citation has a term of its sentence within 10 lines of `N` in the cleaned module
(`inspect/mcp/src/citation-terms.ts`). `--to-lines` rewrites a raw-offset citation as a cleaned-module line, and a citation moves to a newer
build by a term of its sentence when the code around it changed (`inspect/mcp/src/term-move.ts`).

### 4. What Changed Holds Only `2.1.329`

`docs/start/what-changed.md` holds one section, which compares `2.1.329` with `2.1.328`.

### 5. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, render the prompt pages, move each program citation to the `2.1.329` build,
bump the plugins, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

`docs/`, `inspect/mcp/`, `tools/release/`, `tools/surface/`, `tools/schemas/manual/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, and `CHANGELOG.md`.
