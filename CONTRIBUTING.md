# Contributing

Thank you for helping. Keep the site accurate, simple, and unofficial.

1. Read the Style Guide: `docs/contributing/style-guide.md`.
2. Write in Simple English with Title Case headings. Use no emojis.
3. List only items a user can use, change, or switch. Skip removed, inert, test-only, and Anthropic-internal items.
4. Cite a source for every fact. Never invent.
5. Run `bun run verify` and fix every problem before you open a pull request.
6. Do not add Anthropic or Claude logos, or any wording that suggests the site is official.

`bun install` installs git hooks (lefthook). Before each commit they run these gates on staged files:

- `format`: Biome formats code and re-stages it.
- `lint:code`: Biome lint.
- `typecheck`: `bun --check`, when TypeScript files change.
- `lint`: markdownlint on docs.
- `check:docs` and `schemas:check`: docs and schema checks, when those files change.

`git push` runs `bun run verify:locked`. CI runs each gate as its own step.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Notable changes are listed in the [Changelog](CHANGELOG.md).
