# Contributing

Thank you for helping. Keep the site accurate, simple, and unofficial.

1. Read the Style Guide: `docs/contributing/style-guide.md`.
2. Write in Simple English with Title Case headings. Use no emojis.
3. List only items a user can use, change, or switch. Skip removed, inert, test-only, and Anthropic-internal items.
4. Cite a source for every fact. Never invent.
5. Run `just verify verify-project` and fix every problem before you open a pull request.
6. Do not add Anthropic or Claude logos, or any wording that suggests the site is official.

`just setup` installs the pinned tools and points git at `.githooks`. `just setup-project` installs the dependencies of the plugin servers. The git hooks run these checks:

- `pre-commit`: `just pre-commit`, which runs the guard: no suppression comments, no foreign tools, and no drift from the shared configs.
- `commit-msg`: the message must be a Conventional Commit.

`just verify` runs the format check (`bun fmt`), the type check, oxlint, markdownlint, the guard, and the tests. `just verify-project` runs the site checks: docs, examples, schemas, surface, build, `llms.txt`, plugins, and deploy config. CI runs both before it deploys.

Follow the [Code of Conduct](CODE_OF_CONDUCT.md). Notable changes are listed in the [Changelog](CHANGELOG.md).
