# Binary-Surface-Map Specification

## Purpose

List every functional surface of a Claude Code version by kind, tie each item to the docs page that covers it or to a stated exclusion, and fail the checks when an item is neither.

## Requirements

### Requirement: Surface Snapshot

The snapshot command SHALL read one installed Claude Code binary, given by version or path, and write every extracted surface item, grouped by kind, to `captures/<version>/surface.json`.
Each item SHALL have a `kind`, a `name`, the `version`, and the module and offset where it was found.
An item SHALL hold a default, a value list, or a gate only when the code shows it as a literal. A computed value SHALL be written as `unknown`.
The snapshot SHALL cover each kind listed in `design.md`.

#### Scenario: Snapshot of the Installed Version

- **WHEN** the snapshot command runs for `2.1.309` with that binary installed
- **THEN** `captures/2.1.309/surface.json` exists, names `2.1.309`, and holds a non-empty list for each kind

#### Scenario: Missing Binary

- **WHEN** the snapshot command runs for a version that is not installed
- **THEN** it exits non-zero, names the missing path, and writes no file

### Requirement: Committed Surface Copy

The snapshot command SHALL also write `schemas/surface.json` for the site version, with the same items minus module and offset, sorted by kind and name, so that two runs on the same binary give the same file.
`schemas:check` SHALL fail when `schemas/surface.json` has the wrong shape or names another version than `src/version.ts`.
When the binary of the site version is installed, it SHALL also fail when the file differs from a fresh run. When the binary is missing (as in CI), it SHALL skip that comparison and print that it skipped it, as `plugin:check` does for `claude plugin validate`.

#### Scenario: Stable Output

- **WHEN** the snapshot command runs twice on the same binary
- **THEN** `schemas/surface.json` is the same byte for byte

#### Scenario: Check with No Binary

- **WHEN** `schemas:check` runs on a machine with no Claude Code binary installed
- **THEN** it validates the shape and version of `schemas/surface.json`, prints that the fresh-run comparison was skipped, and exits 0 when both are right

### Requirement: Coverage Check

The coverage check SHALL map each item of `schemas/surface.json` to either a docs page whose table or text names the item, or an entry of the exclusion list with a non-empty reason.
It SHALL fail and list the items with neither, as `<kind>:<name>`.
It SHALL also fail on an exclusion entry or a mapping that names no item of the snapshot, so that stale entries do not pile up.
It SHALL run in `bun run verify`.

#### Scenario: Unmapped Item

- **WHEN** the snapshot holds `env:CLAUDE_CODE_EXAMPLE` and no page or exclusion names it
- **THEN** the coverage check exits non-zero and prints `env:CLAUDE_CODE_EXAMPLE`

#### Scenario: Stale Exclusion

- **WHEN** the exclusion list names an item that the snapshot does not hold
- **THEN** the coverage check exits non-zero and names the stale entry

### Requirement: Coverage Page

The site SHALL have one generated page under `docs/reference/` that lists, for each kind, the count of items, and each item with a link to its page or its exclusion reason.
`docs/reference/undocumented.md` SHALL take its counts from the snapshot, not from hand-kept numbers.

#### Scenario: Page Matches the Snapshot

- **WHEN** the coverage page is generated from `schemas/surface.json`
- **THEN** the item count of each kind on the page equals the count of that kind in the snapshot

### Requirement: Items in Their Sections

Each mapped item of `2.1.309` SHALL appear in the docs section of its kind, in a table row with a status badge (`<Documented />`, `<Undocumented />`, `<Differs />`, or `<Gated />`), following `docs/contributing/style-guide.md`.
A row that states a payload field SHALL state only fields found in `schemas/claude-code.d.ts` or a schema in `schemas/`.
Items of claude.ai, Cowork, Claude Design, and artifacts that the binary holds SHALL be mapped like any other item.

#### Scenario: New Env Var Row

- **WHEN** the snapshot holds an env var that no page names
- **THEN** after this change a row for it is in the matching page of `docs/configure/env-vars/`, with a badge and "the program" as its source

### Requirement: Release Diff From Snapshots

The release diff SHALL compare the surface snapshots of the old and the new version for each kind the extractors cover, and SHALL list added, removed, and changed items by kind in `captures/<to>/diff/report.md`.
For a kind with no extractor, it SHALL keep the `strings` comparison.

#### Scenario: Added Item Between Versions

- **WHEN** the new version has an item that the old one lacks
- **THEN** `report.md` lists it under its kind as added, with the page that should take it
