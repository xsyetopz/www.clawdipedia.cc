# Tasks: Release Claude Code 2.1.321

Each release-notes item is `(proposed)` until a check in the program or a probe confirms it.
Do not let a page state a `(proposed)` item.

## 1. Toolkit Run

- [x] 1.1 `bun run release:diff -- --from 2.1.319 --to 2.1.321`, which writes `captures/2.1.321/diff/report.md`.
- [x] 1.2 `bun tools/surface/coverage.ts --all`: 0 unmapped.
- [x] 1.3 Print probes: group `cli321` (`tools/release/probes/print/`).
- [x] 1.4 `bun run release:probe:managed -- --to 2.1.321`. It needs the user to run the `sudo` install command.
- [x] 1.5 `bun run release:facts -- --check`.

## 2. Pages From the Diff

Source: `captures/2.1.321/diff/report.md`.

- [x] 2.1 A row for each of the 14 new environment variables (`docs/configure/env-vars/`).
- [x] 2.2 `remote-control --settings`: `configure/cli/remote-control.md`.
- [x] 2.3 `claude plugin restore-set-aside`, with `--cowork` and `--discard`: `extend/plugins/cli.md`.
- [x] 2.4 The changed `forceLoginMethod` description: `configure/settings/auth.md`.
- [x] 2.5 The 3 new endpoints: `reference/api/endpoints.md`.
- [x] 2.6 Error texts, each on the page the diff names; mark the 10 removed texts.
- [x] 2.7 `$.ui.cancelNotify`: `extend/mod-api/`.
- [x] 2.8 The models: `model-catalog.md` and `undocumented.md`.
- [x] 2.9 Gates: 66 new and 35 gone, covered by the pattern exclusion. Only generated pages name them.

## 3. Release-Notes Items

Source: the notes of [`2.1.321`](https://github.com/anthropics/claude-code/releases/tag/v2.1.321).
Each item line of `captures/2.1.321/notes.md` (lines 3 to 120) is in 3.6 or in 3.7.

- [x] 3.1 The self-hosted runner page, with the exit 0 for a refused on-demand runner: `configure/cli/self-hosted-runner.md`.
- [x] 3.2 The `daemon` subcommands and `rm` flags: `configure/cli/subcommands.md`.
- [x] 3.3 `claude-fable-5-2` as the default Fable model, and saved Fable 5.1 picks that move to `fable`.
- [x] 3.4 `CLAUDE_CODE_PLUGIN_DIR_WATCH=0` for the mod reload in headless sessions.
- [x] 3.5 Managed `extraKnownMarketplaces` take-overs: set-aside data and `claude plugin restore-set-aside`.
- [x] 3.6 Stated items, by notes line:
  - 3: `configure/models-and-providers/model-catalog.md` (the price is left out).
  - 4: `configure/cli/remote-control.md`.
  - 14, 78, 99: `extend/skills-and-commands/slash-commands.md`.
  - 15: `extend/hooks/session-events.md`.
  - 16: `configure/cli/flags.md`.
  - 32: `reference/tools/shell-and-web.md` (the new error text).
  - 63: `extend/hooks/input-and-output.md`.
  - 68, 97, 98, 100, 101, 103, 105, 106, 114: `start/what-changed.md`.
  - 69: `extend/skills-and-commands/frontmatter.md`.
  - 93: `configure/settings/auth.md` (the `forceLoginMethod` part only).
  - 96, 110, 116: `extend/mod-api/nouns-and-gates.md`.
  - 108, 109: `configure/cli/subcommands.md`.
  - 113: `configure/permissions/rules.md`.
  - 117: `configure/cli/remote-control.md`.
  - 118: `extend/plugins/cli.md`.
- [x] 3.7 Left-out items, by notes line, with the reason:
  - Cloud sessions, left out by the spec: 23, 46, 50, 71, 75, 76, 112.
  - VS Code, left out by the spec: 119, 120.
  - No check in the program and no probe case for the item: 5, 6, 7, 8, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21,
    22, 24, 25, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 48, 49, 51, 52,
    53, 54, 55, 56, 57, 58, 60, 61, 62, 64, 65, 66, 67, 70, 72, 73, 74, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
    89, 92, 94, 95, 102, 104, 107, 111, 115.
  - Searched in the `2.1.321` program, and not found, so the row came off `configure/cli/subcommands.md`:
    - 59: no `omitResource` text.
    - 80: no sign-in limit message.
    - 90: no gateway error message that drops the user name and password.
    - 91: the gateway gives `resets <Mon> <day>` from the UTC date, not a local time (`chunk-dbyxjq34.js:1479945`).
  - 93: the Ultra words in the session-feedback message and the `allowedProviders` description have no check.

## 4. What Changed

- [x] 4.1 `docs/start/what-changed.md` holds only the `2.1.321` section, compared with `2.1.319`.
- [x] 4.2 Drop the `2.1.319` fact ids from `tools/release/facts/map.json`, and map the new facts.
- [x] 4.3 `docs/reference/probes.md` lists the `cli321` print cases.

## 5. Release

- [x] 5.1 `src/version.ts` reads `2.1.321`.
- [x] 5.2 `bun run schemas` and `bun run surface`.
- [x] 5.3 `bun run version:bump` for the affected plugins.
- [x] 5.4 One `CHANGELOG.md` entry for `2.1.321`.
- [x] 5.5 `bun run schemas:check`, `bun run verify:locked`, `just verify`, then commit.
