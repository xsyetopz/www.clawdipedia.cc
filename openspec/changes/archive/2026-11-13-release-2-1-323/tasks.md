# Tasks: Release Claude Code 2.1.323

Line numbers are lines of `captures/2.1.323/notes.md`, which holds the release notes.

## 1. Tooling

- [x] 1.1 `release:diff` holds one parsed program at a time.
- [x] 1.2 The env extractor groups names by declaration, so a split name list no longer drops 55 names (`c6c8f27b`).
- [x] 1.3 The OpenTelemetry page anchor and `user.groups` attribute match the program (`d4f439a7`).
- [x] 1.4 Release probes `cli323` for `unsetOptionCount`, `claude workspace-trust`, `subagentStatusLine`, and `claude mcp add --help` (`440c6252`).

## 2. Notes Items Stated on a Page

- [x] 2.1 Plugins and mods: 4, 5, 6, 13, 17, 18, 77, 80, 84, 88, 190, 222, 223, 224, 225, 250.
- [x] 2.2 Settings, permissions, and status line: 12, 22, 48-51, 52, 53, 54-70 (part), 97, 98, 197, 215, 249.
- [x] 2.3 CLI, sessions, and accounts: 8, 138, 147, 186, 226 (part: `--trust-workspace`), 230.
- [x] 2.4 Environment, models, network, and telemetry: 3, 9, 14, 16, 111, 142, 160-162, 164, 170, 200, 205, 206, 209, 241.
- [x] 2.5 Tools and subagents: 113, 118, 235, 236 (part).
- [x] 2.6 Commands: 221 (`claude mcp add --help`, case `print.cli323.mcp-add-help`), 231 (`/stickers`, already on the page).

## 3. Notes Items Left Out, With Reason

- [x] 3.1 Not on this site by scope: 251-264 (VS Code), 265-283 (web), 287-295 (Claude Tag), 296 (Code Review), 177, 180-185, 247, 248 (cloud sessions), 243, 284-286 (Remote Control), 7, 140 (Desktop), 74, 76, 193, 229 (cloud, Docs connector, Desktop, Cowork), 105 (claude.ai input), 119 (remote sessions), 136, 198 (apps gateway), 220 (sandboxed sessions).
- [x] 3.2 Internal fix with no page or setting: 20, 21, 24, 30, 103, 108, 110, 116, 126.
- [x] 3.3 No code found for the new text: 109, 135.
- [x] 3.4 No page states the old behavior: 107, 124.
- [x] 3.5 Tools pass: 10, 27, 31, 54, 95, 114, 120, 121, 123, 137, 141, 178, 179, 194, 196, 199, 203, 204, 212, 233, 234, 237, 238, 239, 242.
- [x] 3.6 Models pass: 19, 26, 28, 29, 99, 101, 102, 127-129, 131, 132, 134, 139, 144-146, 148, 201.
- [x] 3.7 Hooks, environment, and permissions passes: 96, 106, 117, 143, 207, 208, 218, 226 (part).
- [x] 3.8 No page edit needed, the page already holds it: 15, 133.

## 4. Notes Items From the Second Check

- [x] 4.1 Stated: 11, 47, 104, 149 (part), 240 (`b73b06da`); 153, 163, 232 (`4cfbcac0`); 87, 93, 149 (rest), 202, 216, 227, 246 (next commit).
- [x] 4.2 Left out, a fix with no setting, flag, or text that a page states: 23, 25, 32-34, 36-46, 71-73, 78, 79, 81, 82, 85, 86, 89-92, 94, 100, 112, 115, 122, 125, 130, 150-152, 154-158, 166-169, 171-176, 187-189, 191, 192, 195, 244, 245.
- [x] 4.3 Left out, no code found for the change: 35 (`TOKEN_EXPIRED` hits only AWS and MSAL libraries), 210 (no hit for dontAsk near /mcp), 211 (searches `session_paused`, and idle or lifetime near pause), 213, 214, 217 (several searches, no hit), 219 (no text about a hook-rewritten input that asks again), 75, 83, 159, 228 (about 4 searches each, no program code found).

## 5. What Changed

- [x] 5.1 `docs/start/what-changed.md` holds only "Version 2.1.323" (`b73b06da`).
- [x] 5.2 `tools/release/facts/map.json` maps every fact, and `release:facts -- --check` passes.

## 6. Release

- [x] 6.1 Bump `src/version.ts`, run `bun run schemas`, `bun run surface`, and `bun run surface:check` (`3b4d8783`).
- [x] 6.2 Render the prompt pages, move program citations to `2.1.323`, and run `bun run check:citations` (`d50fa049`, `50379ae1`).
- [x] 6.3 Bump clawdipedia-docs and clawdipedia-docs-cli to 3.0.5 and cc-inspect to 0.18.1, and add a `CHANGELOG.md` entry (`50379ae1`).
- [x] 6.4 Run `just verify` and `just verify-project`. Both pass in CI run 43467457910 on `435b3ef6`, which also deployed. Locally, the site build stops at the 8 GB memory limit for one process. To make CI pass: track `badge.tsx` under its lowercase name, install the plugin server dependencies in the TypeScript workflow, and download the darwin-arm64 build that `check:citations` reads.
