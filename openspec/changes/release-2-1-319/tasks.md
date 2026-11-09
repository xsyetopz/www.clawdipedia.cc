# Tasks: Release Claude Code 2.1.319

Each release-notes item is `(proposed)` until a check in the program or a probe confirms it.
Do not let a page state a `(proposed)` item.
`2.1.319` has no GitHub release and no changelog entry on 2026-11-06, so its rows come from the program.
The owner chose not to run `ultrareview` live, so its page links the official [Ultrareview](https://code.claude.com/docs/en/ultrareview) page.

## 1. Toolkit Run

- [x] 1.1 `bun run release:diff -- --from 2.1.316 --to 2.1.319`, which writes `captures/2.1.319/diff/report.md`.
- [x] 1.2 `bun tools/surface/coverage.ts --all`: 9477 items, 0 unmapped.
- [x] 1.3 Print probes: groups `api319`, `cli319`, `env319a`, `env319b`, `err319`, and `evalcreds`
  (`tools/release/probes/print/`). The `api319.gateway.*` cases need Docker (`postgres:17-alpine`).
- [x] 1.4 Pty probes: group `cli319` (`tools/release/probes/pty/cli319.ts`).
- [x] 1.5 Live probes: `api319.*`, `err319`, `cli319.*`, and `code-mode` (`tools/release/probes/live/cases.ts`).
  Captures are in `captures/2.1.319/live`. The live `ultrareview` steps were removed by the owner's decision.
- [x] 1.6 `bun run release:probe:managed`. It needs the user to run two `sudo` commands. The new `owned` variant tests the "not verified" note.
- [x] 1.7 `bun run release:facts -- --check` and `bun run release:all`.

## 2. Pages From the Diff

Source: `captures/2.1.319/diff/report.md`.

- [x] 2.1 A row or an exclusion for each of the 53 new environment variables, and the 2 removed
  (`docs/configure/env-vars/`). The 4 changed: `CLAUDE_CODE_MEMORY_PUSH_DELETE_MODE` gains `recorded`.
- [x] 2.2 `claude mcp add --web`: `extend/mcp/cli.md` (`print.cli319.mcp-add-web`).
- [x] 2.3 `ultrareview --list`, `--max-cost`, `--output`: `configure/cli/subcommands.md#ultrareview-eval-flags` (`print.cli319.ultrareview-*`).
- [x] 2.4 `/project` and `/use-case` rows, and the `/claim-credit` row removed: `slash-commands.md` (`pty.cli319.slash.*`).
- [x] 2.5 `disableReplyCheck` and `disableWindowsBashCommandSplit`: `configure/settings/enterprise.md`.
- [x] 2.6 Changed settings `attributionProject`, `sshHostCommands`, `cleanupPeriodDays`, `pluginSuggestionMarketplaces`.
- [x] 2.7 `SessionTabs` and `app:closeSession`: `configure/keybindings/unbound-and-reserved.md` (`pty.cli319.keybinding.*`).
- [x] 2.8 `$.theme.set` and `$.theme.clear`: `extend/mod-api/ui/` (`print.cli319.theme.engine`).
- [x] 2.9 The 4 new betas: `reference/api/betas.md` (`print.api319.beta.*`, `print.api319.gateway.request-tags-*`).
- [x] 2.10 The new endpoints: `reference/api/endpoints.md`.
- [x] 2.11 The tools `WrapUp` and `ReadWidgetContext`, and the changed `ExitPlanMode`: `reference/tools/` (`print.api319.tool.*`).
- [x] 2.12 Error texts, each on the page the diff names (`print.err319.*`, `live err319`).
- [x] 2.13 Gates: 181 new and 29 gone, covered by the pattern exclusion. Only generated pages name them.
- [x] 2.14 Code Mode: `print.env319a.code-mode.*` and `live.code-mode`.

## 3. Release-Notes Items

Source: the notes of [`2.1.317`](https://github.com/anthropics/claude-code/releases/tag/v2.1.317)
and [`2.1.318`](https://github.com/anthropics/claude-code/releases/tag/v2.1.318).
Leave out VS Code, Cloud sessions, Claude Tag, Code Review, the self-hosted runner, and Remote Control.

- [x] 3.1 `CLAUDE_CODE_DISABLE_NESTED_SESSION_ID`: `configure/env-vars/sessions-and-storage.md`.
- [x] 3.2 `OTEL_EXPORTER_OTLP_TIMEOUT` and the per-signal timeouts: `configure/env-vars/telemetry-and-debug.md`.
- [x] 3.3 `CLAUDE_CODE_CONFIG_LOCK_WAIT_MS`: `env319a.config-lock-wait.*`.
- [x] 3.4 Gateway cost route `/v1/organizations/analytics/cost`: `reference/api/endpoints.md`.
- [x] 3.5 Server-side auto mode check and `PermissionDenied` `retry`: `configure/permissions/auto-mode.md` (`print.err319.auto-mode-print-refused`).
- [x] 3.6 `loginExpiresAt` and `credential_expires_at`: `configure/cli/subcommands.md`, `extend/headless/stream-json.md` (`print.notes319.login-expiry.*`).
- [x] 3.7 OpenTelemetry attributes `anthropic.plan`, `anthropic.seat_type`, `anthropic.provider`, `anthropic.custom_base_url`: `reference/opentelemetry.md` (`print.notes319.otel-attrs.*`).
- [x] 3.8 Gateway options `assume_role` and `admin.identity_retention_days`: `configure/cli/subcommands.md` (`print.api319.gateway.assume-role-*`, `identity-retention-*`).
- [x] 3.9 The `effort` option of `$.model.fork` (`extend/mod-api/types/model.md`, `print.fork319.model-fork.*`) and the `NODE_EXTRA_CA_CERTS` fix (`configure/env-vars/network-and-proxy.md`, `print.cacerts319.*`).

## 4. What Changed

- [x] 4.1 `docs/start/what-changed.md` holds only the `2.1.319` section, compared with `2.1.316`.
- [x] 4.2 Drop the `2.1.316` fact ids from `tools/release/facts/map.json`, and map the new facts.
  The file has working-tree changes, and `release:facts --check` has not run in this pass.
- [x] 4.3 `docs/reference/probes.md` lists the `2.1.319` print, pty, and live cases.

## 5. Release

- [x] 5.1 `src/version.ts` reads `2.1.319`.
- [x] 5.2 `bun run schemas` and `bun run surface`: `schemas/` and `schemas/surface.json` changed.
- [x] 5.3 `bun run version:bump -- clawdipedia-docs patch`, with `clawdipedia-docs-cli`. `plugin/mcp/package.json`,
  `cli/package.json`, and `.claude-plugin/marketplace.json` still read `3.0.1`.
- [x] 5.4 One `CHANGELOG.md` entry for `2.1.319`. The file has only the `cc-inspect` 0.13.0 entry.
- [x] 5.5 `bun run schemas:check`, `bun run verify:locked`, `check:docs`, then commit.
