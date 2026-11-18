# Proposal: Release Claude Code 2.1.327

## Why

The site tracks `2.1.326`. [`2.1.327`](https://github.com/anthropics/claude-code/releases/tag/v2.1.327) came out on 2026-11-17.
Its notes hold 173 items.

## What Changes

### 1. Track `2.1.327`

Run the runbook in `tools/release/README.md` from `2.1.326` to `2.1.327`, and give every item a page or an exclusion.
From `captures/2.1.327/diff/report.md`:

- 18 new environment variables, 14 gone, 5 changed.
- 4 new flags, 1 changed.
- 5 changed commands.
- 3 new settings, 4 new nested setting keys, 4 changed.
- 2 changed tools.
- 1 new beta.
- 3 new endpoints, 1 gone.
- 78 new error texts, 22 gone.
- 81 new gates and 29 gone. The pattern exclusion covers them.

The extractor reports `CI`, `TEAMCITY_VERSION`, `NODE_REPL_EXTERNAL_MODULE`, `NODE_COMPILE_CACHE`, `NODE_REDIRECT_WARNINGS`, and `NODE_V8_COVERAGE` as gone, but the program still reads them, so their pages keep them.

State a release-notes item only after a check in the program or a probe, or phrase it as what the release notes say.

### 2. What Changed Holds Only `2.1.327`

`docs/start/what-changed.md` drops the `2.1.326` section and holds one section, which compares `2.1.327` with `2.1.326`.
`tools/release/facts/map.json` drops the `2.1.326` fact ids.

### 3. Citations Name the Chunk and the Place

Every citation to the program names the chunk and the place in it, such as `chunk-m14bt1pz.js:1472473`, or a range `:A-B`.
`cc-inspect` 0.18.2 adds a citation form check (`inspect/mcp/src/citation-form.ts`), and `bun run check:citations` runs it.
The check flags a chunk with no place, a backward range, and a program footnote that names no chunk.

### 4. Schema Fields Without a Verified Type

`2.1.326` marked 441 schema fields `x-unverified`: 373 in `claude-code-otel.json` and 68 in `claude-code-transcript.json`.
Each one gets a type in `tools/schemas/manual/`, read from the `2.1.327` code. No `x-unverified` mark is left.

### 5. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, render the prompt pages, move each program citation to the `2.1.327` build,
bump the plugins, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Impact

`docs/`, `inspect/mcp/`, `tools/check/`, `tools/release/`, `tools/surface/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, and `CHANGELOG.md`.
