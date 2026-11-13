# Tracked-Release-Docs

## MODIFIED Requirements

### Requirement: Tracked Version Stamp

`src/version.ts`, `schemas/`, `schemas/surface.json`, the plugin texts, and the prompt pages in `docs/prompts/` SHALL name the same tracked version, and `bun run verify:locked` SHALL pass.
The prompt pages SHALL be rendered from `captures/<version>/prompts` of the tracked version with `bun tools/capture-prompts/render.ts`, because `release:all` does not render them.
Each program citation in `docs/` SHALL name a module of the tracked build, and `bun run check:citations` SHALL pass.

#### Scenario: Release Check

- **WHEN** `src/version.ts` names `2.1.310` and `bun run verify:locked` runs
- **THEN** it exits 0, and `schemas:check`, `surface:check`, and `plugin:check` agree on `2.1.310`

#### Scenario: Version Mismatch

- **WHEN** `schemas/surface.json` names `2.1.309` while `src/version.ts` names `2.1.310`
- **THEN** `bun run schemas:check` exits non-zero (the `binary-surface-map` Committed Surface Copy requirement)

#### Scenario: Prompt Pages

- **WHEN** the release to `2.1.322` is done and someone runs `grep -rln 'cc_version=2\.1\.321' docs/prompts`
- **THEN** it prints nothing

#### Scenario: Program Citations

- **WHEN** the release to `2.1.322` is done and `bun run check:citations` runs
- **THEN** it exits 0, because no page cites a chunk file that only the `2.1.321` build has
