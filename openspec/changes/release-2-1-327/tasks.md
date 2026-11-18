# Tasks: Release Claude Code 2.1.327

Ids are lines of the release notes in `captures/2.1.327/notes-2.1.327.md`. Lines 3 to 175 hold the 173 items.

## 1. Tooling

- [x] 1.1 `cc-inspect` 0.18.2 adds the citation form check (`inspect/mcp/src/citation-form.ts`, with `inspect/mcp/test/citation-form.test.ts`), and `check:citations` runs it on `docs/` and `tools/surface/exclusions.json`.
- [x] 1.2 Each of the 441 `x-unverified` schema fields of `2.1.326` gets a type in `tools/schemas/manual/`, read from the `2.1.327` code. `bun run schemas` writes no `x-unverified` mark.
- [x] 1.3 The surface map covers `2.1.327`, and `surface:check` reports that every item is mapped or excluded. The comparison reports `CI`, `TEAMCITY_VERSION`, `NODE_REPL_EXTERNAL_MODULE`, `NODE_COMPILE_CACHE`, `NODE_REDIRECT_WARNINGS`, and `NODE_V8_COVERAGE` as gone, but the program still reads them, so their rows stay.
- [x] 1.4 The print probe runs 547 cases, the PTY probe runs 54, and the live probe runs 17. The owner ran the `sudo` step of `release:probe:managed`, and its 61 cases ran. `release:compare -- 2.1.326 2.1.327` reports 678 shared cases and 53 changed, and no `managed.*` case is among the changed.
- [x] 1.5 The three plugin bundles are rebuilt with `bun run plugin:build`, so the transcript schema in `inspect/mcp/dist/server.js` is the one for `2.1.327`.

## 2. Notes Items Stated on a Page

- [x] 2.1 Stated, each checked in the program or by a probe: 3-14, 20, 24, 25, 29-31, 33-35, 37, 41-43, 47-54, 57-59, 67-69, 72-75, 77, 80, 88, 89, 98, 104, 107, 108, 110-113, 115-120, 123, 127-131, 133-158, 160-162.

## 3. Notes Items Left Out, With Reason

- [x] 3.1 Not on this site by scope (VS Code, web, Desktop, cloud sessions, Remote Control, and other products): 16, 27, 40, 55, 61, 63-66, 82, 91, 163, 165-175.
- [x] 3.2 A terminal drawing fix with no setting, key, or text that a page states: 38, 39, 83-87, 96, 97, 99, 100, 164.
- [x] 3.3 A fix with no setting, flag, or text that a page states: 15, 17-19, 21-23, 26, 28, 32, 36, 44-46, 56, 60, 62, 70, 71, 76, 78, 79, 81, 90, 92-95, 101-103, 105, 106, 109, 114, 121, 122, 124-126, 132, 159.

## 4. What Changed

- [x] 4.1 `docs/start/what-changed.md` holds only "Version 2.1.327", which compares `2.1.327` with `2.1.326`.
- [x] 4.2 `tools/release/facts/map.json` maps every fact, and `release:facts -- --check` passes.

## 5. Release

- [x] 5.1 Bump `src/version.ts`, run `bun run schemas`, `bun run surface`, and `bun run surface:check`.
- [x] 5.2 Render the prompt pages, move program citations to `2.1.327`, and run `bun run check:citations`.
- [x] 5.3 Bump clawdipedia-docs and clawdipedia-docs-cli to 3.0.7 and cc-inspect to 0.18.2, and add the `CHANGELOG.md` entries.
- [x] 5.4 The environment variable index counts 1675 variables, the rows of the variable tables.
- [x] 5.5 Run `just verify`, then push.
