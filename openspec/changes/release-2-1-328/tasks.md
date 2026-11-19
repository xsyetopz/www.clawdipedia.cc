# Tasks: Release Claude Code 2.1.328

Ids are lines of the release notes in `captures/2.1.328/notes-2.1.328.md`. Lines 3 to 146 hold the 144 items.

## 1. Tooling

- [x] 1.1 `cc-inspect` moves a `:A-B` citation only when both ends move and stay in order (`inspect/mcp/src/citations.ts`, with a test in `inspect/mcp/test/move-citations.test.ts`).
- [x] 1.2 `bun tools/surface/coverage.ts --fix` drops stale map and exclusion entries and carries an entry to the unmapped item that rewords it (`tools/surface/carry.ts`, with `tools/surface/carry.test.ts`).
- [x] 1.3 `bun tools/check/docs.ts --fix` writes the actual counts to `docs/reference/undocumented.md` (`fixCounts` in `tools/undocumented-counts.ts`, with a test).
- [x] 1.4 The surface map covers `2.1.328`, and `surface:check` reports that every item is mapped or excluded.
- [x] 1.5 The print probe runs 547 cases, the live probe runs 17, and the managed probe runs 61. `release:compare -- 2.1.327 2.1.328` reports 684 shared cases and 79 changed.

## 2. Notes Items Stated on a Page

- [x] 2.1 Stated, each checked in the program or by a probe: 3, 4, 7, 8, 10, 12-15, 28, 86, 126-128, 132, 134, 136, 139, 140, 142.

## 3. Notes Items Left Out, With Reason

- [x] 3.1 Not on this site by scope (VS Code, web, Desktop, cloud sessions, Remote Control, and other products): 5, 24, 29, 46-54, 56, 83, 120, 122, 135, 144-146.
- [x] 3.2 A terminal drawing fix with no setting, key, or text that a page states: 19, 66-68.
- [x] 3.3 A fix with no setting, flag, or text that a page states: 6, 9, 11, 16-18, 20-23, 25-27, 30-45, 55, 57-65, 69-82, 84, 85, 87-119, 121, 123-125, 129-131, 133, 137, 138, 141, 143.

## 4. What Changed

- [x] 4.1 `docs/start/what-changed.md` holds only "Version 2.1.328", which compares `2.1.328` with `2.1.327`.
- [x] 4.2 `tools/release/facts/map.json` maps every fact, and `release:facts -- --check` passes.

## 5. Release

- [x] 5.1 Bump `src/version.ts`, run `bun run schemas`, `bun run surface`, and `bun run surface:check`.
- [x] 5.2 Move program citations to `2.1.328`, and run `bun run check:citations`.
- [x] 5.3 Bump clawdipedia-docs, clawdipedia-docs-cli, and cc-inspect, and add the `CHANGELOG.md` entries.
- [x] 5.4 Run `just verify`, then push.
