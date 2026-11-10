# Tracked-Release-Docs

## MODIFIED Requirements

### Requirement: Release Notes Coverage

For the tracked version, each release-notes item that a user can use or change SHALL appear on the page of its topic, cited as a link to the release tag or as "the program".
An item SHALL be stated only after it is confirmed in the program (a module and offset) or in a probe case.
An item with no such evidence, and each VS Code, Cloud sessions, Claude Tag, or Code Review item, SHALL be left out and listed as left out in the change's tasks.
The tasks SHALL list each left-out item one at a time, by its line in `captures/<version>/notes.md`, with its reason. A group name alone, such as "VS Code", SHALL NOT stand for the items in it.

#### Scenario: Confirmed Item

- **WHEN** the notes say the Monitor tool runs on Bedrock, and `cc-inspect` finds that check in the `2.1.310` binary
- **THEN** the `Monitor` row in `docs/reference/tools/shell-and-web.md` states it with a citation

#### Scenario: Unconfirmed Item

- **WHEN** a notes item has no module, offset, or probe case in the binary
- **THEN** no page states it, and the tasks list it as left out with the reason

#### Scenario: Each Notes Line Accounted For

- **WHEN** someone takes each item line of `captures/2.1.321/notes.md`
- **THEN** the line is either stated on a page that the tasks name, or listed by its line number in the tasks as left out with a reason

### Requirement: Tracked Version Stamp

`src/version.ts`, `schemas/`, `schemas/surface.json`, the plugin and marketplace texts, and the prompt pages in `docs/prompts/` SHALL name the same tracked version, and `bun run verify:locked` SHALL pass.
The prompt pages SHALL be rendered from `captures/<version>/prompts` of the tracked version with `bun tools/capture-prompts/render.ts`, because `release:all` does not render them.

#### Scenario: Release Check

- **WHEN** `src/version.ts` names `2.1.310` and `bun run verify:locked` runs
- **THEN** it exits 0, and `schemas:check`, `surface:check`, and `plugin:check` agree on `2.1.310`

#### Scenario: Version Mismatch

- **WHEN** `schemas/surface.json` names `2.1.309` while `src/version.ts` names `2.1.310`
- **THEN** `bun run schemas:check` exits non-zero (the `binary-surface-map` Committed Surface Copy requirement)

#### Scenario: Prompt Pages

- **WHEN** the release to `2.1.321` is done and someone runs `grep -rln 'cc_version=2\.1\.319' docs/prompts`
- **THEN** it prints nothing
