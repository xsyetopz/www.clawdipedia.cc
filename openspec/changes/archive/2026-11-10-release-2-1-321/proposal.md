# Proposal: Release Claude Code 2.1.321

## Why

The site tracks `2.1.319`. [`2.1.321`](https://github.com/anthropics/claude-code/releases/tag/v2.1.321) came out on 2026-11-09.
The release page does not name a `2.1.320` release.
One hop, `2.1.319` to `2.1.321`, covers every change.

## What Changes

### 1. Track `2.1.321`

Run the runbook in `tools/release/README.md` from `2.1.319` to `2.1.321`, and give every item a page or an exclusion.
From `captures/2.1.321/diff/report.md`:

- 14 new environment variables, 1 changed.
- 3 new flags (`plugin restore-set-aside --cowork`, `--discard`, and `remote-control --settings`).
- 1 new command (`claude plugin restore-set-aside`), 1 changed.
- 1 changed setting (`forceLoginMethod`).
- 3 new endpoints (`host_requests`, `host_requests/{id}/result`, `/v1/privacy-consents/checkup`).
- 24 new error texts and 10 gone.
- 2 new Mod API items (`ui.cancelNotify`).
- 3 new models (`claude-fable-5-1[1m]`, `claude-fable-5-2`, `claude-mythos-5-2`) and 1 gone (`claude-fable-5[1m]`).
- 66 new gates and 35 gone. A pattern exclusion covers them.

State a release-notes item only after a check in the program or a probe.

### 2. Settle the Open Rows by Experiment

Each new row gets a read site and a run.
The print group `cli321` covers `remote-control --settings`, the `self-hosted-runner` options and errors,
the `daemon` subcommands, and `plugin restore-set-aside`.

### 3. Release

Bump `src/version.ts`, regenerate `schemas/` and the surface snapshot, bump the plugins and cc-inspect, and write one `CHANGELOG.md` entry.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `tracked-release-docs`: the tasks list each left-out release-notes item by its notes line, with its reason.
  The prompt pages in `docs/prompts/` name the tracked version too, because `release:all` does not render them.

## Impact

`docs/`, `tools/release/`, `tools/surface/`, `schemas/`, `src/version.ts`, `plugin/`, `cli/`, `inspect/`,
`.claude-plugin/marketplace.json`, and `CHANGELOG.md`.
