# Tasks: Release Claude Code 2.1.329

Ids are lines of the release notes in `captures/2.1.329/notes-2.1.329.md`. Lines 3 to 132 hold the 130 items.

## 1. Tooling

- [x] 1.1 `cc-inspect` 0.19.1 checks the terms of each citation against the cleaned module (`inspect/mcp/src/citation-terms.ts`, with `inspect/mcp/test/citation-terms.test.ts`).
- [x] 1.2 `cc-inspect` rewrites raw-offset citations as cleaned-module lines with `--to-lines` (`inspect/mcp/src/citation-lines.ts`).
- [x] 1.3 `cc-inspect` moves a citation by a term of its sentence (`inspect/mcp/src/term-move.ts`, with `inspect/mcp/test/move-citations-term.test.ts`).
- [x] 1.4 The surface map covers `2.1.329`, and `surface:check` reports that every item is mapped or excluded.
- [x] 1.5 The print probe runs 547 cases, the pty probe 60, the live probe 16, and the managed probe 61 on `2.1.329`.

## 2. Notes Items Stated on a Page

- [x] 2.1 Stated, each checked in the program or by a probe: 3-8, 10, 13, 23, 36, 37, 44-46, 56, 64, 74, 76, 86, 97, 98, 100-102, 104-108, 110, 112-115.

## 3. Notes Items Left Out, With Reason

- [x] 3.1 Not on this site by scope (VS Code, web, Desktop, cloud sessions, Remote Control, and other products): 12, 30, 31, 39, 48, 50, 84, 85, 91-93, 116-132.
- [x] 3.2 A terminal drawing fix with no setting, key, or text that a page states: 52, 78-80, 83.
- [x] 3.3 A fix with no setting, flag, or text that a page states: 9, 11, 14-22, 24-29, 32-35, 38, 40-43, 47, 49, 51, 53-55, 57-63, 65-73, 75, 77, 81, 82, 87-90, 94-96, 99, 103, 109, 111.

## 4. What Changed

- [x] 4.1 `docs/start/what-changed.md` holds only "Version 2.1.329", which compares `2.1.329` with `2.1.328`.
- [x] 4.2 `tools/release/facts/map.json` maps every fact, and `release:facts -- --check` passes.

## 5. Release

- [x] 5.1 Bump `src/version.ts`, run `bun run schemas`, `bun run surface`, and `bun run surface:check`.
- [x] 5.2 Move program citations to `2.1.329`, and run `bun run check:citations`.
- [x] 5.3 Bump clawdipedia-docs, clawdipedia-docs-cli, and cc-inspect, and add the `CHANGELOG.md` entries.
- [x] 5.4 Run `just verify`, then push.
