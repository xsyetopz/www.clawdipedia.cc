# CLAUDE.md

- Use Bun `1.4.4`; run `bun install` to set up dependencies and Git hooks.
- Write in Simplified Technical English; use Chicago Title Case for titles, headings, and sidebar labels.
- Use `<Documented />`, `<Undocumented />`, `<Differs />`, or `<Gated />` for documentation status. Place additional status labels in the Status column, not before item names.
- Document only functionality users can access or configure. Never invent or make up something of your own.
- Cite external claims with links to exact pages and sections; attribute binary findings to "the program".
- Regenerate schemas with `bun run schemas` when needed; do not manually edit generated files.
- Use `bun run version:bump` for version changes; bump affected plugins and keep their version files consistent.
- Only use `CLAUDE_CODE_OAUTH_TOKEN` for live runs when explicitly requested. Load it inside the child process, never expose it, and use temporary `HOME` and `CLAUDE_CONFIG_DIR`.

<!-- bedrock -->
- Run each task through `just`. `just` lists the recipes. Check each change with the narrowest one, such as `just rust::test` or `just lint`, and run `just verify` once before you finish a change that alters behavior.
- Fix the cause of each lint, type, or guard error in the code. Keep the shared configs as they are; the bedrock that wrote them owns them.
- Put project recipes in `project.just`. The `justfile` and `.just/` are shared and get replaced on the next adopt.
- Write commit messages as Conventional Commits; the commit-msg hook checks them.
- When a recipe reports a missing tool, run `just setup`, which installs the pinned ones. Install any it can't, such as `just`, Bun, rustup, or Xcode, with the system's package manager, then rerun the recipe. Tell the user what you installed, and keep the check instead of skipping it.
<!-- /bedrock -->

<!-- typescript-bedrock -->
- Install with `bun install`, and run one-off tools with `bunx`.
- Check each change with the narrowest command: `bun test <file>`, `bun check`, `bun run lint`, or `bun fmt`.
- Fix the cause of each lint or type error in the code, and keep the lint and `tsconfig` settings as they are.
- Pin each dependency version once, in `workspaces.catalog`, and reference it as `catalog:`.
- Give a JSDoc comment to each declaration a package exports from its `exports`, `main`, or `module` entry; internal code needs none.
- Use Bun APIs where Bun has one, such as `Bun.file`, `Bun.$`, and `Bun.spawn`.
- Change shared lint, type, and Markdown rules in `typescript-bedrock`, which the repo configs extend.
<!-- /typescript-bedrock -->
