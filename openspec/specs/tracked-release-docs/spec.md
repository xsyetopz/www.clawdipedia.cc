# Tracked-Release-Docs Specification

## Purpose

Keep the site in step with the one Claude Code version named in `src/version.ts`, so each user-facing change of that version is on its page with a source, and no page states a fact the program does not hold.

## Requirements

### Requirement: Release Notes Coverage

For the tracked version, each release-notes item that a user can use or change SHALL appear on the page of its topic, cited as a link to the release tag or as "the program".
An item SHALL be stated only after it is confirmed in the program (a module and offset) or in a probe case.
An item with no such evidence, and each VS Code, Cloud sessions, Claude Tag, or Code Review item, SHALL be left out and listed as left out in the change's tasks.

#### Scenario: Confirmed Item

- **WHEN** the notes say the Monitor tool runs on Bedrock, and `cc-inspect` finds that check in the `2.1.310` binary
- **THEN** the `Monitor` row in `docs/reference/tools/shell-and-web.md` states it with a citation

#### Scenario: Unconfirmed Item

- **WHEN** a notes item has no module, offset, or probe case in the binary
- **THEN** no page states it, and the tasks list it as left out with the reason

### Requirement: Surface Diff Coverage

Each item that `release:diff` reports as added, removed, or changed between the previous and the tracked version SHALL be on a page or in `tools/surface/exclusions.json` with a reason, and a removed item SHALL be gone from every page that states it as current.

#### Scenario: New Env Var

- **WHEN** the diff reports `CLAUDE_CODE_RETRY_WATCHDOG_SCOPE` as added and not in the docs
- **THEN** after the change it has a row in `docs/configure/env-vars/` or an exclusion with a reason, and `bun run surface:check` exits 0

#### Scenario: Removed Gate

- **WHEN** the diff reports `tengu_amber_sentinel` as removed
- **THEN** `docs/reference/surface-coverage.md` no longer lists it

### Requirement: Version Labels

Each current-behavior version label SHALL name the tracked version only after the labelled fact is
checked against that version.
Change notes and dated probe records SHALL keep their versions.
`docs/start/what-changed.md` SHALL hold only the tracked version's section, and that section SHALL
compare the tracked version with the release before it.
The site SHALL NOT keep a section, a table, or a page for any older release. For an older release,
the page SHALL link the official changelog at `https://code.claude.com/docs/en/changelog`.

#### Scenario: Label Sweep

- **WHEN** the change is done and someone runs `grep -rn '2\.1\.312' docs`
- **THEN** each line it prints is a change note, a dated record, or a line of the `2.1.314` section
  that names what the behavior was before

#### Scenario: One Section Only

- **WHEN** a reader opens What Changed after the release to `2.1.314`
- **THEN** the page holds the `2.1.314` section and no other release section, and `docs/` has no
  release archive page

#### Scenario: Fact Map

- **WHEN** `bun run release:facts -- --check` runs after the older sections are removed
- **THEN** it reports no `unmapped` fact, and `tools/release/facts/map.json` has no key under a
  removed page

### Requirement: Tracked Version Stamp

`src/version.ts`, `schemas/`, `schemas/surface.json`, and the plugin and marketplace texts SHALL name the same tracked version, and `bun run verify:locked` SHALL pass.

#### Scenario: Release Check

- **WHEN** `src/version.ts` names `2.1.310` and `bun run verify:locked` runs
- **THEN** it exits 0, and `schemas:check`, `surface:check`, and `plugin:check` agree on `2.1.310`

#### Scenario: Version Mismatch

- **WHEN** `schemas/surface.json` names `2.1.309` while `src/version.ts` names `2.1.310`
- **THEN** `bun run schemas:check` exits non-zero (the `binary-surface-map` Committed Surface Copy requirement)
