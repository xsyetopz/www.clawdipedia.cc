# CLAUDE.md

- Use Bun `1.4.4`; run `bun install` to set up dependencies and Git hooks.
- Write in Simplified Technical English; use Chicago Title Case for titles, headings, and sidebar labels.
- Use `<Documented />`, `<Undocumented />`, `<Differs />`, or `<Gated />` for documentation status. Place additional status labels in the Status column, not before item names.
- Document only functionality users can access or configure. Never invent or make up something of your own.
- Cite external claims with links to exact pages and sections; attribute binary findings to "the program".
- Regenerate schemas with `bun run schemas` when needed; do not manually edit generated files.
- Use `bun run version:bump` for version changes; bump affected plugins and keep their version files consistent.
- Only use `CLAUDE_CODE_OAUTH_TOKEN` for live runs when explicitly requested. Load it inside the child process, never expose it, and use temporary `HOME` and `CLAUDE_CONFIG_DIR`.

## Fuck Around and Find Out

Work by FAFO. Before you state a fact about Claude Code, a setting, a tool, or a prompt, write a hypothesis, predict what one check will show, run the check, and let its result decide. Run the check where undoing is free: `/tmp/probe-*`, a fake Messages API, `--debug-file`, `--no-session-persistence`, or a worktree. Measure what can be measured, by legal means, before you mark a row unchecked or ask the user. Record the hypothesis, the prediction, the command, and the result beside the finding, and call a claim with no run a hypothesis.

Before you call a built-in text or behavior fixed, look for an override and test it: a same-named agent, skill, command, or output style, a setting, an env var, a hidden flag, or a hook that rewrites the input.

## One Obvious Way

Give each job one way to be done, and make it the obvious one. When a maintained tool or list already does the job, use it and delete our copy. Ship one path per job, and make it the only one.

Build each rebuild from a clean slate. When a new path replaces an old one, delete the old path along with its tests, settings, and docs, so the new path stands alone. Treat a required tool as required: when it is missing, stop with an error that names the step that installs it.
