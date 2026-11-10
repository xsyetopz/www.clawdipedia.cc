# Release Runbook

How to update this docs site when a new Claude Code version ships. The toolkit lives in this folder.
The design is in `openspec/changes/archive/2026-10-21-release-toolkit/design.md`. Every `bun run release:*` command is defined in `package.json`.

The toolkit runs the program only against a local stub with a fake key. Results are JSON under `captures/<version>/`. Prose is written later, from the diff.

## Read First

- Run `bun run release:schemas` before you commit any schema. `release:diff` reads both binaries, so both versions must be installed.
- Bump `src/version.ts` only in step 12. `--from` defaults to that value, so an early bump makes the old side wrong.
- `release:prompts` renders `docs/prompts/` unless you pass `--no-render`. With `--only`, it never renders. Review `git diff docs/prompts/` after a full run.
- `bun run release:facts -- --check` prints `probe print.sweep does not list fact ...` until `release:probe:print` runs again with the new fact lists. These are warnings, and the exit code stays 0.
- `release:probe:pty` takes about 11 minutes. Run it when the machine is idle, because the status line cases measure timing.
- pty probes need an idle machine (no other sessions running gates or builds). Step times count from the READY screen. An invalid case is retried once, and compare lists invalid runs separately (`invalid-run`): never edit docs from them.
- Probes put a `security` shim first on PATH (`<home>/.probe-bin`), so the program never touches the macOS keychain.
- Never commit `captures/` or `.env`. Both are gitignored. Do not use `git add -f` on them.
- Secrets go only through `tools/release/secret-runner.sh`. Never print, log, or commit a token. Never open `.env` yourself.
- Prompts sent to the model are always `Reply with 'OK'.` (`PROMPT` in `tools/release/lib/env.ts`). Do not use `hi` or other text. A case that needs other input must give a `promptReason`.
- Live runs (`release:probe:live`) use subscription quota. Ask the user every run. Pass `--yes` only after the user has said yes in this session.
- If a managed folder from an earlier run is still installed, run its cleanup command before `release:probe:managed`. The baseline phase is invalid otherwise.

## Prerequisites

- Bun `1.4.4`, `python3` 3.8 or newer, and `strings`. `openssl` is needed only for the live fault tests.
- Docker, running, for `release:probe:print`. The `api319` gateway cases start a temporary `postgres:17-alpine` container and remove it after the case. The first run pulls the image, so it needs network access. Without Docker those cases stop with an error that names the install step. Install Docker from <https://docs.docker.com/get-docker/>.
- The new binary is installed at `~/.local/share/claude/versions/<to>`. The user installs it. `release:check` fails without it.
- The OLD binary is installed at `~/.local/share/claude/versions/<from>`. `release:diff` needs it. `release:check` only warns when it is missing.
- For `compare`: toolkit results for `<from>` in `captures/<from>/` (`print/` and `pty/` from an earlier toolkit run). `release:diff` creates `captures/<from>/surface.json`, so the folder exists even with no results. Then every probed fact shows as `changed` (new case, no result for the old version). `compare` warns on stderr and at the top of `compare.md` when it finds none. If they are missing, run `bun run release:probe:print -- --to <from>` and `bun run release:probe:pty -- --to <from>` first, with the old binary still installed.

## Flags

| Flag | Used by | Meaning |
| --- | --- | --- |
| `--from V` | most | Old version. Default: `CLAUDE_CODE_VERSION` in `src/version.ts`. |
| `--to V` | most | New version. Default: the installed binary behind `~/.local/bin/claude`. |
| `--only a,b` | probes, prompts | Run only these case ids or group prefixes. |
| `--dry` | most | Print the plan and skip the work. |
| `--yes` | `probe:live` | Skip the `y/N` question. Only after the user says yes. |
| `--samples` | `compare` | Include trimmed sample text. |
| `--check` | `facts` | Check the fact map against the docs and the probes. Writes nothing except its `run.json` entry. |
| `--all` | `facts` | Include `gap` and `info` facts, not only `change` facts. |
| `--no-render` | `prompts` | Skip the rewrite of `docs/prompts/`. |
| `--selftest` | `check` | Run the env-leak self-test instead of the preflight. |

Pass flags after `--`, for example `bun run release:probe:print -- --only hooks.posttooluse`.

## Runbook Steps

Steps 1 to 8 are unattended and safe in a fresh session. Steps 9 and 10 need the user. Read each command's output before you go on.

1. **Preflight.** `bun run release:check`
   - Writes `captures/<to>/env.json`. Exits 1 if the new binary, `python3`, or `strings` is missing.
   - User: only to install a missing binary.

2. **Hold the version.** No command. Keep `src/version.ts` at the old version until step 12.

3. **Schemas.** `bun run release:schemas`, then `bun run schemas:check`.
   - Regenerates `schemas/*.json` in the working tree: the zod schemas (`generate.ts`), the code-derived schemas
     (`code.ts`: status line, transcript, OpenTelemetry, frontmatter, `~/.claude.json`), and `claude-code.d.ts`.
     `code.ts` reads the probes of `<from>`, so `x-observed` marks stay and the diff shows code changes only.
     Writes `captures/<to>/schemas-diff.json` (git HEAD against the new files) and `types.diff`.
   - To refresh the `x-observed-type` notes first, run `bun run schemas:observe` (add `-- --user` to also read your own `~/.claude` files, types only).
     It rewrites `tools/schemas/observed/`.
   - User: no.

4. **Diff.** `bun run release:diff`. Read `captures/<to>/diff/report.md` first. It shows which docs pages are affected.
   - Takes a surface snapshot of each binary (`captures/<version>/surface.json`) and compares the items of each kind. Each added or changed item names the page that takes it, from `tools/surface/map.json`, `tools/surface/exclusions.json`, and the docs tables.
   - Writes `captures/<to>/diff/*.json` and `report.md`. The files `strings-env.json`, `flags.json`, `commands.json`, `settings.json`, `hooks.json`, and `gates.json` keep their names for `release:facts` and `release:compare`.
   - Then `bun run release:clean -- --from <from> --to <to>`. It cleans each module of both binaries (stable local names) and indexes their functions into `captures/<version>/clean/`, about 14 s for each version the first time.
   - With the clean step done, read the code diff through the `cc-inspect` tool `release`:
     - `diff` with `from` and `to` lists the changed, added, and gone functions. Pass `name` to keep those that hold a text, such as a tool name.
     - `notes` with `version: <to>` marks each line of the release notes as matched, gated, or unmatched. It runs `gh release view` once and caches the notes in `captures/<to>/notes.md`.
     - `explain` with `name` gives where a name's code is, who uses it, the gates and env reads that guard it, and whether it is a no-op, a stub, or handled.
     - The `code` action `find` finds code by plain words. The MCP prompt `release_review` runs these steps in order.
   - The server finds this cache only when it starts in the repo root, or with `CC_INSPECT_CACHE` set to the repo's `captures/`. Otherwise it cleans again into `~/.cache/cc-inspect`.
   - A match is a lead to read, not a proof. Read the code before a page states it.
   - User: no.

5. **Prompts.** `bun run release:prompts`. Add `-- --no-render` to skip the render.
   - Writes `captures/<to>/prompts/<id>/`. Renders `docs/prompts/` unless `--no-render` is set.
   - User: no.

6. **Print probes.** `bun run release:probe:print`. Runs the env sweep first, then the named probes.
   - Writes `captures/<to>/print/<case>.json` and `print/sweep.json`.
   - User: no.

7. **Pty probes.** `bun run release:probe:pty`. Takes about 11 minutes. Cases run one at a time.
   - Writes `captures/<to>/pty/<case>.json`, with `.raw`, `.idx` (timing), and `.screen.txt` beside it.
   - User: no. Run it on an idle machine.

8. **Facts and compare.** `bun run release:facts -- --check` (`release:all` runs this too), then `bun run release:facts`, then `bun run release:compare`.
   - `facts` writes `captures/<to>/facts.json`. `compare` writes `captures/<to>/compare/<from>..<to>.json` and `compare/compare.md`, the worklist (see below).
   - User: no.

9. **Managed probes.** `bun run release:probe:managed`
   - The tool builds a stage in a temp dir and prints one `sudo /bin/bash <stage>/install.sh` command. Read the script first. The user runs it in a second terminal and types the password once. The tool then runs each phase and prints `sudo /bin/bash <stage>/cleanup.sh`. The user runs that too.
   - The script installs the variants `main`, `true`, `false`, and `owned`. In `owned`, the user who ran sudo owns the folder, so the run shows the note that the program adds to managed files this account could have written.
   - Writes `captures/<to>/managed/<case>.json`.
   - User: yes (sudo and the password).

10. **Live probes.** `bun run release:probe:live`. Run `bun run release:probe:live -- --dry` first to test the pipeline offline (fake token, local stub, dead proxy, no network).
    - Prints the plan and the cost, then asks `y/N`. The secret runner reads `CLAUDE_CODE_OAUTH_TOKEN` from `.env`. The agent never reads `.env`.
    - Writes `captures/<to>/live/<case>.json`, with `cacheWarm` where it applies. One attempt per case, no retry.
    - User: yes. Explicit consent every run.

11. **Docs.** Update the docs pages from the worklist in `captures/<to>/compare/compare.md`. Each edit cites the case id it came from. Run `bun run lint` and `bun run check:docs` on the changed pages, and `bun run check:citations`, which fails on each program citation in `docs/` that names a chunk file the build of `src/version.ts` does not have.
    `docs/start/what-changed.md` holds only the `<to>` section, and that section compares `<to>` with `<from>`. Delete the `<from>` section and drop its fact ids from `tools/release/facts/map.json`. The site keeps no section and no page for an older release: What Changed links the official changelog for those.
    - User: no.

12. **Release.** Bump `src/version.ts` to `<to>`. Run `bun run schemas` again, so the generator stamps the new version. Run `bun run surface` to commit the snapshot `schemas/surface.json` and render the Surface Coverage page, then `bun run surface:check`. Run `bun run version:bump -- clawdipedia-docs patch` (or `just bump clawdipedia-docs patch`), which also sets the Claude Code version in the plugin manifests and the skill bodies; bump `clawdipedia-docs-cli` and `cc-inspect` too when `inspect/` changed. Then run `bun run schemas:check` and `bun run verify:locked`. Have the change reviewed, then commit with Conventional Commits and push. The pre-push hook runs `verify:locked` again.
    - User: no.

## Shortcut: `release:all`

`bun run release:all` runs check, schemas, diff, clean, prompts, probe:print, probe:pty, facts, and compare, in that order.

- It passes `--no-render` to prompts, so it never edits `docs/prompts/`.
- It rewrites `schemas/*.json` in the working tree (see step 12).
- It runs `facts --check` before `facts`. That step writes nothing and fails only on an unmapped fact. The `print.sweep does not list fact` warnings keep exit 0.
- It accepts only `--from`, `--to` and `--dry`. Any other argument exits 2.
- It stops at the first failed check, schemas, diff, clean or prompts step and prints the commands you still need to run by hand, with the same `--from`, `--to` and `--dry`.
- If probe:print, probe:pty or `facts --check` exits non-zero, it still runs the later steps (so a flaky pty case still gives a worklist). It then exits non-zero and names the failed steps.
- It never runs steps 9 and 10. It prints them under "Needs you".

## Where Results Go

Results sit in `captures/`, which is gitignored.

```text
captures/<to>/
  run.json              one entry per step run for this version, plus one for `all` (name, args, times, exit)
  env.json              preflight data
  diff/                 report.md and the *.json diffs
  schemas-diff.json
  prompts/<id>/
  print/                <case>.json and sweep.json
  pty/                  <case>.json, with .raw, .idx, .screen.txt
  managed/              <case>.json
  live/                 <case>.json
  facts.json
  compare/              <from>..<to>.json and compare.md
captures/<version>/strings.txt    cached strings dump (tens of MB), from the print sweep
captures/<version>/surface.json   surface snapshot, from release:diff and surface
```

`release:check` prints the size of each version folder. Delete old versions by hand.

## Reading the Worklist

Open `captures/<to>/compare/compare.md`.

- `## Worklist` lists each fact whose result is `changed` or `not-run`, with its file, line, and kind. It also lists names in `diff/` that no fact covers.
- `not-run` means no probe result covers the fact. Facts of kind `manual` always show as `not-run`.
- `## Cases` lists the changed, added, and removed data for each case id.
- A changed result is not a probe failure. Probes exit non-zero only when a case could not run.
- Never use a live result with `cacheWarm: true` as a doc number.
- `--samples` adds the trimmed sample text. The positional form also works: `bun run release:compare -- 2.1.305 2.1.306`.

## Optional: Name Guesses with `humanify`

[humanify](https://github.com/jehna/humanify) (`humanifyjs` 2.2.2) asks a model for a name for each local of one module. It is a reading aid only: its names are guesses, so never state one as a fact, and never feed its output to the diff. It costs one model call per local, so run it on one small module, not on a binary. It uses the API key, not the subscription.

```sh
mkdir -p /tmp/hf && (cd /tmp/hf && bun add --ignore-scripts humanifyjs@2.2.2)
tools/release/secret-runner.sh apikey /bin/sh -c 'OPENAI_API_KEY="$ANTHROPIC_API_KEY" OPENAI_BASE_URL=https://api.anthropic.com/v1 HOME=/tmp/hf exec bun /tmp/hf/node_modules/.bin/humanify openai -m claude-haiku-5-5 -o /tmp/hf/out <module.js>'
```

- `--ignore-scripts` skips the native build of `isolated-vm`, which fails and which the `openai` command does not need.
- Trial (2.1.310 release, on the 501-byte minified `inspect/mcp/test/fixtures/clean-app.ts`): 23 calls, 8,881 input and 913 output tokens. Good guesses: `readBooleanEnvFlag`, `parseSleepCommand`. Wrong guesses: the class exported as `Monitor` became `FeatureGate`, and the sleep limit became `maxIterations`.

## Fact Map

- Facts are version-labelled sentences in `docs/`, such as "since 2.1.304". `tools/release/facts/map.json` is hand-edited. It maps each fact to a probe or to a kind.
- Kinds: `behaviour`, `env`, `flag`, `command`, `setting`, `hook`, `gate`, `schema`, `manual`, `static`, `external`.
- `release:facts -- --check` fails on an `unmapped` fact. Add a `map.json` entry for each new fact.
- A probe result lists the fact ids it checks in its `facts` array.
  Writing the result adds every fact that `map.json` maps to the case. `--check` warns when the probe and the map disagree, so rerun the probe after you map a fact to it.

## Selftest

```sh
CLAUDE_CODE_FOO=1 bun tools/release/cli.ts check --selftest
```

The same check runs as `bun run release:check -- --selftest`. It checks that a parent `CLAUDE_CODE_*` variable, such as `CLAUDE_CODE_FOO=1` above, does not reach the program. It ends with `selftest ok` or `selftest failed`. Run it after any change to `tools/release/`.

## Lint

- Markdownlint for this file: `bunx markdownlint-cli2 tools/release/README.md`. The `lint` script checks it too.
