# Tasks: Release Claude Code 2.1.322

Each release-notes item is `(proposed)` until a check in the program or a probe confirms it.
Do not let a page state a `(proposed)` item.

## 1. Toolkit Run

- [x] 1.1 `bun run release:diff -- --from 2.1.321 --to 2.1.322`, which writes `captures/2.1.322/diff/report.md`.
- [x] 1.2 Print probes: group `cli322` (`tools/release/probes/print/`), 26 cases.
- [x] 1.3 cc-inspect: the `code` `cli` options `provider: "vertex"` and `fastRefusal`, the outcome lines, and the query lines of a shown file, each with a test.
- [x] 1.4 `bun run release:all`, which ends with `captures/2.1.322/compare/compare.md`.
- [ ] 1.5 `bun run release:probe:managed -- --to 2.1.322`. It needs the user to run the `sudo` install command.
- [ ] 1.6 `bun run release:probe:live -- --yes`.
- [x] 1.7 `bun run release:facts -- --check`.

## 2. Pages From the Diff

Source: `captures/2.1.322/diff/report.md`. It names no added and no removed surface item.

- [x] 2.1 The changed `fastMode` description: `configure/settings/model.md`.
- [x] 2.2 The capability `vertex_fast_mode`: `configure/models-and-providers/model-catalog.md`.
- [x] 2.3 Each difference that `captures/2.1.322/compare/compare.md` names, on the page that states the old result.

## 3. Release-Notes Items

Source: the notes of [`2.1.322`](https://github.com/anthropics/claude-code/releases/tag/v2.1.322).
`captures/2.1.322/notes.md` holds one item.

- [x] 3.1 Fast mode on Vertex in the regions `global`, `us`, and `eu`: `configure/models-and-providers/fast-mode.md` (cases `print.cli322.fast-vertex-*`).
- [x] 3.2 The fall back to standard speed after a Vertex refusal: the same page (cc-inspect runs with `fastRefusal` 400, 403, and 404).
- [x] 3.3 The rows that name fast mode on other pages agree with the new page: `slash-commands.md`, `env-vars/models-and-effort.md`, `settings/model.md`,
  `cli/flags.md`, `model-catalog.md`, `providers.md`, `reference/api/betas.md`, `reference/api/endpoints.md`, and `how-it-works/system-prompt.md`.

## 4. What Changed

- [x] 4.1 `docs/start/what-changed.md` holds only the `2.1.322` section, compared with `2.1.321`.
- [x] 4.2 Drop the `2.1.321` fact ids from `tools/release/facts/map.json`, and map the new facts.
- [x] 4.3 `docs/reference/probes.md` lists the `cli322` print cases and the cc-inspect runs.

## 5. Release

- [ ] 5.1 `src/version.ts` reads `2.1.322`.
- [ ] 5.2 `bun run schemas` and `bun run surface`.
- [ ] 5.3 Render the prompt pages for `2.1.322`.
- [ ] 5.4 `bun tools/check/citations.ts --move-from` the `2.1.321` build, then check the `module` moves and the 6 unmapped citations by hand.
- [ ] 5.5 `bun run version:bump` for the affected plugins.
- [ ] 5.6 One `CHANGELOG.md` entry for `2.1.322`.
- [ ] 5.7 `bun run check:citations`, `bun run schemas:check`, `bun run verify:locked`, `just verify`, `just verify-project`, then commit.
