# Clawdipedia

An unofficial, community-run documentation site for Claude Code.
It is not made by or tied to Anthropic. "Claude" and "Claude Code" name the product the site describes.

The site covers every surface of Claude Code that you can use, change, or turn on and off.
That includes items the official docs never name. They carry an Undocumented badge.
It tracks one release only: `2.1.314` (see `src/version.ts`). There are no versioned docs.

Live site: <https://clawdipedia.cc/>

## Run It

You need [Bun](https://bun.sh) `1.4.4` (see `.bun-version`).

```sh
bun install
bun run start     # dev server
bun run build     # production build into build/
bun run serve     # serve the build
bun run verify    # typecheck + format + lint + checks + build, run this before a pull request
```

## Deploy

A Cloudflare Worker serves <https://clawdipedia.cc/> as static assets. GitHub Actions deploys it, so
Cloudflare Workers Builds is not connected to this repository. `.github/workflows/ci.yml` runs every
check and the build on each push and pull request. On a push to `main` it then runs
`bunx wrangler deploy`, which uploads `build/`. Every check runs before that step, so a failed check
stops the deploy. A pull request never reaches it.

`wrangler.jsonc` holds the Worker name, the assets directory, and the routing. It needs no change
for a deploy. Deploys need two repository secrets:

| Secret | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | a token from the "Edit Cloudflare Workers" template, scoped to the one account |
| `CLOUDFLARE_ACCOUNT_ID` | the account that holds the Worker |

Wrangler reads both from the environment, which its System Environment Variables page documents. No
Cloudflare credential is in this repository. The token is a GitHub Actions secret, and the deploy
step is the only step that reads it. Set both with the GitHub CLI:

```sh
gh secret set CLOUDFLARE_API_TOKEN     # paste the token, then press Ctrl-D
gh secret set CLOUDFLARE_ACCOUNT_ID
```

`wrangler.jsonc` sets no route. `clawdipedia.cc` is a custom domain on the Worker, set in the
dashboard, so a deploy does not change it.

`bun run deploy:check` validates `wrangler.jsonc` against `build/` and deploys nothing. It needs no
Cloudflare login. `bun run verify` runs it last, after the build, and so does the workflow.

The site publishes absolute URLs under `https://clawdipedia.cc/`. `docusaurus.config.ts` holds `url`
and `baseUrl`, and `tools/schemas/build.ts` holds the `$id` base of every JSON Schema. Change both
together, then run `bun run schemas`.

## Plugins

The repo also holds three Claude Code plugins. The marketplace `xsyetopz`, in the repo [xsyetopz/bedrock](https://github.com/xsyetopz/bedrock), lists them:

- `clawdipedia-docs`: an MCP server with four tools (`search_docs`, `read_page`, `list_pages`, `get_schema`) and a skill. It reads four sources, picked with `source`: `clawdipedia` (this site, the default), `platform` (platform.claude.com/docs), `code` (code.claude.com/docs), and `claude-resources` (claude.com/resources).
- `clawdipedia-docs-cli`: the same lookups as an `clawdipedia-docs` command that the Bash tool runs, plus a skill. It has no MCP server, so it adds no tool list to the context. It works only in Claude Code and needs Bun.
- `cc-inspect`: an MCP server and a skill that read your session transcripts and the installed Claude Code program.

```sh
claude plugin marketplace add xsyetopz/bedrock
claude plugin install clawdipedia-docs@xsyetopz   # or clawdipedia-docs-cli, or cc-inspect
```

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the Style Guide page at `docs/contributing/style-guide.md`.
Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Notable changes are listed in the [Changelog](CHANGELOG.md).

The "only usable items" rule: list only things a user can use, change, or switch on and off.
Leave out items that are removed, inert, test-only, or for Anthropic staff.

## Layout

```text
docs/        pages (Markdown and MDX)
src/         theme tweaks, badge components, version constant
tools/       check/docs.ts (emoji, front matter, Title Case)
```

## License

[CC BY 4.0](LICENSE-docs) and [MIT](LICENSE).
