# Tasks: Release Claude Code 2.1.326

Ids are lines of the release notes: `325` is `captures/2.1.326/notes-2.1.325.md`, and `326` is `captures/2.1.326/notes-2.1.326.md`.

## 1. Tooling

- [x] 1.1 The `.mcp.json` schema capture skips other declarations of the same statement, and the hand-typed schema fields follow the `2.1.326` code (`74075b24`).
- [x] 1.2 The surface map covers `2.1.326`, and `surface:check` reports that every item is mapped or excluded (`752c822f`).
- [x] 1.3 The PTY probe runs 54 cases, all valid. `release:compare -- 2.1.323 2.1.326` reports 601 shared cases and 80 changed. The 61 cases that only `2.1.323` has are `managed.*` and need the owner's `sudo` step.

## 2. Notes Items Stated on a Page

- [x] 2.1 Stated, each checked in the program or by a probe: `325`: 8, 10, 11, 13, 14, 26, 27, 41, 43, 44, 52, 54, 55, 62, 87, 89-91, 95, 98-100, 103-108, 112-117, 123-125, 140; `326`: 3-7, 11, 12, 16, 18, 19, 21, 22, 30, 32, 39, 41, 53, 56, 57, 60, 61, 67, 89, 90, 125, 132, 151, 154, 184, 189, 237, 239, 240, 250-254, 258, 260, 263-265, 268, 289, 293-295, 298, 299, 301-304, 306, 307, 309-311, 313, 315, 316, 321-325, 328-333, 336-338, 340, 341, 344, 346, 350.

## 3. Notes Items Left Out, With Reason

- [x] 3.1 Not on this site by scope (VS Code, web, Desktop, cloud sessions, Remote Control, and other products): `325`: 4, 24, 25, 42, 45-47, 58, 68, 73, 86, 102, 118-120, 127-139, 141; `326`: 23, 34, 85, 93-101, 103, 105-108, 155, 156, 176, 241, 248, 249, 256, 257, 327, 335, 339, 353-369.
- [x] 3.2 A terminal drawing fix with no setting, key, or text that a page states: `326`: 10, 14, 15, 86, 109-122, 201-203, 229, 245, 285.
- [x] 3.3 A fix with no setting, flag, or text that a page states: `325`: 3, 6, 7, 9, 12, 15-23, 37, 40, 48-51, 53, 57, 59-61, 63-67, 69, 74-85, 93, 97, 109, 122; `326`: 13, 17, 20, 24-29, 31, 33, 35, 37, 38, 40, 42-46, 48-50, 54, 59, 62-66, 68-75, 79-84, 87, 88, 91, 92, 102, 104, 123, 124, 126-129, 131, 133-150, 152, 153, 157-175, 177-183, 185-188, 190-200, 204-228, 230-232, 242-244, 246, 247, 259, 262, 266, 269-284, 286, 288, 291, 348.
- [x] 3.4 A sign-in and credential fix with no setting or text that a page states. `fast-mode.md` already gives the right cause of the organization message: `325`: 29-36, 38, 39, 88, 92, 96.
- [x] 3.5 No program code found for the new text: `325`: 5, 28, 56, 94, 101, 110, 111, 121, 126; `326`: 8, 9, 36, 47, 51, 52, 55, 58, 76-78, 130, 235, 238, 255, 261, 267, 287, 290, 292, 296, 300, 305, 308, 312, 317, 326, 334, 342, 343, 345, 347, 349, 351, 352.
- [x] 3.6 Too vague to tie to one setting or behavior: `325`: 70-72; `326`: 233, 234, 236, 297, 314, 318-320.

## 4. Readability

- [x] 4.1 Each page leads with what a thing does, how to change it, and why. Evidence for program findings moves into footnotes under `## Sources`, and server flag names and module names leave the prose.

## 5. What Changed

- [x] 5.1 `docs/start/what-changed.md` holds only "Version 2.1.326".
- [x] 5.2 `tools/release/facts/map.json` maps every fact, and `release:facts -- --check` passes.

## 6. Release

- [x] 6.1 Bump `src/version.ts`, run `bun run schemas`, `bun run surface`, and `bun run surface:check` (`752c822f`).
- [x] 6.2 Render the prompt pages, move program citations to `2.1.326`, and run `bun run check:citations` (`00e63093`).
- [x] 6.3 Bump clawdipedia-docs and clawdipedia-docs-cli to 3.0.6, and add a `CHANGELOG.md` entry (`e6f29849`, bundles `4d23fa73`).
- [x] 6.4 Run `just verify` and `just verify-project`, push, and check CI (CI run `43990581907`; the local site build passes the server bundle and stops at the 8 GB process limit, so CI builds the site).
- [x] 6.5 Run `release:probe:live -- --yes` (16 cases ok, 0 invalid).
