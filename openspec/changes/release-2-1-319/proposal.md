# Proposal: Release Claude Code 2.1.319

## Why

The site tracks `2.1.316`. Three releases came after it: [`2.1.317`](https://github.com/anthropics/claude-code/releases/tag/v2.1.317) (2026-11-03), [`2.1.318`](https://github.com/anthropics/claude-code/releases/tag/v2.1.318) (2026-11-04), and `2.1.319`.
On 2026-11-06, `2.1.319` has no release on GitHub, so its changes come from the program only.
One hop, `2.1.316` to `2.1.319`, covers every change.

## What Changes

### 1. Track `2.1.319`

Run the runbook in `tools/release/README.md` from `2.1.316` to `2.1.319`, and give every item a page or an exclusion.
From `captures/2.1.319/diff/report.md` and `bun tools/surface/coverage.ts --all`:

- 53 new environment variables, 5 gone, 4 changed.
- 4 new flags (`add --web`, `ultrareview --list`, `--max-cost`, `--output`).
- 2 new slash commands (`/project`, `/use-case`), 2 gone (`/claim-credit`, `/memory-types`), 2 changed.
- 2 new settings (`disableReplyCheck`, `disableWindowsBashCommandSplit`), 4 changed.
- 2 new keybinding items, 4 new Mod API calls (`theme.set`, `theme.clear`), 4 new betas, 6 new endpoints, 3 new tools, 2 changed tools.
- 68 unmapped error texts, and 38 map or exclusion entries that no longer match the program.
- 181 new gates and 29 gone. A pattern exclusion covers them.

State a release-notes item only after a check in the program or a probe.

### 2. Settle the Open Rows by Experiment

Each new row gets a read site and a run: a print case against the stub, a pty case, or the env sweep.
The nested `CLAUDE.md` limit and the post-turn memory gate get their own print cases.
The stub gets a cloud memory MCP route for the post-turn memory gate.

### 3. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, bump the plugins and cc-inspect, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The `tracked-release-docs` requirements already describe this release.

## Impact

`docs/`, `tools/release/`, `tools/surface/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, `inspect/`,
`.claude-plugin/marketplace.json`, and `CHANGELOG.md`.
