---
title: Style Guide
description: The rules for writing pages on this site, with templates, examples, and the checks that enforce them.
sidebar_position: 2
---

This guide tells you how to write a page for this site.
Follow it so every page looks and reads the same.
Run `just verify verify-project` before you open a pull request. It runs the format check, the type check, the code lint, markdownlint, the tests, the docs check, the schema check, and the build. Git hooks run on every commit. The `commit-msg` hook checks that the message is a Conventional Commit.

## Core Rules

1. Write only what a reader can use, change, or turn on and off.
2. Rewrite sources in your own words. Do not copy.
3. Never invent a fact. Check it with a run or the program text. If no check can settle it, leave it out.
4. Use only the emojis that this guide allows (see Table Marks). Use badges for provenance.
5. Do not use Anthropic or Claude logos, or any wording that says the site is official.

## Simple English

Write like Simple English Wikipedia.

- Use common words. Say "use", not "utilize".
- Keep sentences short. Aim for under 20 words.
- Put one idea in each sentence.
- Explain each term the first time it appears.
- Use active voice and present tense.
- Speak to the reader as "you".

| Avoid | Write |
| --- | --- |
| The configuration is subsequently persisted to disk by the harness. | Claude Code saves the setting to a file. |
| One may leverage the flag to facilitate non-interactive invocation. | Use the flag to run without a prompt. |
| Hooks get triggered, whereupon the matcher is evaluated. | A hook runs. Then Claude Code checks the matcher. |

## Title Case

Use Title Case for every heading, page title, and sidebar label.

- Capitalize the first and last word.
- Capitalize nouns, verbs, adjectives, adverbs, and pronouns.
- Keep articles, short conjunctions, and short prepositions lowercase: `a`, `an`, `the`, `and`, `but`, `or`, `for`, `in`, `of`, `on`, `to`, `with`, `at`, `by`.
- Capitalize longer prepositions, such as `From`, `Behind`, and `Without`. The `title-case-style` rule of `just lint` sets the case of each heading word; run `bun run markdownlint-cli2 --fix` to apply it.
- Words in inline code keep their exact spelling.
- Put code identifiers in headings in backticks (flags, env vars, keys, tool, event, and type names, file names). Page titles and sidebar labels stay plain text.

| Wrong | Right |
| --- | --- |
| How to configure the status line | How to Configure the Status Line |
| Skills And Commands | Skills and Commands |
| Setting Up `settings.json` | Setting Up `settings.json` |

`bun run check:docs` checks page titles and sidebar labels too. It flags lowercase words that are not on the small-word list.
It skips text in code spans.

## Front Matter

Every page needs these keys.

```yaml
---
title: Status Line
description: Show your own text under the prompt, and every JSON field the command receives.
sidebar_position: 7
---
```

- `title` is in Title Case. Do not add an H1. The title is the H1.
- `description` is one sentence. It shows in search results.
- `sidebar_position` sets the order inside the folder.

## Page Layout

A surface page has this order.

1. A 2 to 4 sentence intro.
2. Item tables, grouped by topic.
3. An Example section with a real config or command.
4. Related pages and sources.

### Item Table Template

```markdown
| Item | Status | What it does | Default | Where to set it |
| --- | --- | --- | --- | --- |
| `exampleEnabled` | <Documented /> | Turns the example on. | `true` | `settings.json` |
| `EXAMPLE_FLAG` | <Undocumented /> <Gated note="server gate" /> | Shows the example panel. | Off | Environment variable |
```

Every table of items has a `Status` column with one or more badges.

## Badges

The badge components are global. Do not import them.

| Component | Use it when |
| --- | --- |
| `<Documented />` | An official docs page names the item. |
| `<Undocumented />` | Only the program shows the item. |
| `<Differs />` | The docs and the program disagree. Say how in the row. |
| `<Gated />` | The item works only behind a flag or server gate. Say which. |

`Gated` and `Differs` take an optional `note`. The note shows as a tooltip.

```mdx
<Gated note="CLAUDE_CODE_EXAMPLE=1" />
<Differs note="Docs say 30 seconds, the program uses 60." />
```

You can place several badges in one cell. Separate them with a space.

## The Leave-Out Rule

List only items a user can use. Leave out these items.

- Removed items and items that do nothing.
- Items that exist only for tests.
- Items for Anthropic staff, such as those behind `USER_TYPE=ant`.

Keep a gated item only if a user can turn it on or it is live for some accounts. Mark it <Gated />.

## Inline Code

Put every code item in backticks: commands, flags, paths, keys, environment variables, tool names, and literal values.
Write `--print`, not --print. Write `~/.claude/settings.json`, not the plain path.

## Visuals

### Mermaid

Use `flowchart`, `sequenceDiagram`, or `stateDiagram-v2`. Keep labels short.

````markdown
```mermaid
flowchart LR
  Prompt --> Hook
  Hook --> Tool
  Tool --> Result
```
````

### File Trees

Do not draw trees with box characters. Wrap a nested list in the `<FileTree>` component.
Write one item on each line. Give a folder a trailing `/`. Put a short note after the name.

````markdown
<FileTree>

- `~/.claude/`
  - `settings.json` your settings
  - `skills/`
    - `my-skill/`
      - `SKILL.md`

</FileTree>
````

It looks like this.

<FileTree>

- `~/.claude/`
  - `settings.json` your settings
  - `skills/`
    - `my-skill/`
      - `SKILL.md`

</FileTree>

### Table Marks

Use these marks in a table cell that answers yes, no, or unknown. An example is a boolean column of an item table.

| Mark | Meaning | Write |
| --- | --- | --- |
| ✅ | Yes | `✅`, or `✅ Yes. <detail>` when text follows |
| ❌ | No | `❌`, or `❌ No. <detail>` when text follows |
| Unknown | Unknown or not stated | the word `Unknown` |

- Do not use a mark where Yes or No is part of a value, such as a default that is literally "no".
- Never put a mark in a heading, a sidebar label, or link text.
- For a short clarification, put `\*` after the mark (`✅\*`). Then write `\* The note.` right after the table. Use `\*\*` for a second note.
- `bun run check:docs` rejects every emoji that is not on the allow-list in `tools/check/docs.ts`.

### Status Labels

Put one of these components in the `Status` column, after the provenance badges. The name cell holds only the identifier.
Each has one meaning. A provenance badge stays the primary status.

| Component | Meaning | Use it when |
| --- | --- | --- |
| `<ManagedOnly />` | Managed only | The schema has `x-managed-only: true` for the key |
| `<Experimental />` | Experimental | The key name has `EXPERIMENTAL` or `experimental`, or the program or the vendor pages call it experimental or beta |
| `<Deprecated note="..." />` | Deprecated | The program or the vendor pages call it deprecated. Put the replacement in `note` when the row names one |
| `<Caution note="..." />` | Caution | It deletes data, skips a safety check or permission, or sends data off the machine. Use it sparingly. Long warnings stay admonitions |

- Never invent a status or a `note`. Cite the source in the row or the page.
- `<Experimental />` does not replace `<Gated />`. Use it only where "experimental" is the stated status.
- Do not use an emoji for these. `bun run check:docs` rejects them.

### Admonitions

Use `:::tip`, `:::note`, `:::warning`, and `:::danger`. Add a title in brackets if it helps.

```markdown
:::tip[Use a Temp Folder]
Run a probe with a temp `HOME` and `CLAUDE_CONFIG_DIR`.
:::
```

### Code Examples

Give a code block a language and, when useful, a title.

````markdown
```json title="~/.claude/settings.json"
{
  "model": "sonnet"
}
```
````

Every surface page has at least one worked example.

Examples in `ts`, `tsx`, `js`, `jsx`, `json`, and `jsonc` blocks follow the repo `.oxlintrc.json` and `bun fmt`. This covers formatting, lint rules, and typed const arrows instead of `function` declarations. Run `bun run check:examples` (add `--fix` for safe fixes). To skip a block that must stay verbatim, such as program output or a wire format, add `skip-lint` to its fence: ` ```json skip-lint title="..." `. The check skips blocks in `docs/prompts/`.

### Example Hosts

Use `example.com` for a host in a page example. [IANA](https://www.iana.org/help/example-domains) reserves it for this use. It needs no permission.

Do not use `example.com` in a test or a probe. The same IANA page states that `example.com` "is not a service" and that you must "avoid relying on it for testing and monitoring purposes". A test that reaches it depends on a host that nobody promises to keep.

In a test or a probe, use a name under `.invalid`, such as `probe.invalid`. [RFC 2606 section 2](https://www.rfc-editor.org/rfc/rfc2606#section-2) reserves `.invalid` for a name that never resolves. So the request stays on the machine. Use `127.0.0.1` with a port when the test needs a server that answers.

An email address in a test, such as a git author, may keep `example.com`. Git never resolves an email address. So no request leaves the machine.

## MDX Gotchas

Pages are MDX, not plain Markdown. These characters break the build when they sit in prose.

| Problem | Fix |
| --- | --- |
| `{` or `}` in text | Put a backslash before it, or put the text in backticks. |
| `<` in text, such as `<cwd>` | Put it in backticks, or write `&lt;`. |
| `\|` in a table code cell | Write `\|`. |
| A bare URL with angle brackets | Use a normal link: `[Title](https://example.com)`. |
| An import in a page | Not needed. Badges are global. |

Lines inside code fences are safe.

## Links

- Link to other pages with a relative file path: `[Hooks](../extend/hooks/index.md)`.
- Name official pages by their Title Case page names. Link each one to its URL: `[Hooks Reference](https://code.claude.com/docs/en/hooks)`. Add `#anchor` when you name a section. Link the changelog, GitHub, and other outside sources the same way. "The program" stays plain text.
- The build fails on a broken link or anchor. Fix it. Do not remove it.

## Sources

Every fact needs a source.

- Official docs: link to the page.
- The program: write "Source: the program" and name the string, key, or type in inline code.
- Probe results: link to the Probes page.

Leave out anything you could not check.

## Checks

| Command | What it does |
| --- | --- |
| `bun run lint` | Runs oxlint on the code and markdownlint on the Markdown files. |
| `bun run check:docs` | Finds emojis that are not allowed, unlinked sources, missing front matter, and Title Case errors. It prints `file:line`. |
| `bun run build` | Builds the site. Broken links and anchors fail the build. |
| `just verify` | Runs the format check, the type check, `bun run lint`, the guard, and the tests. |
| `just verify-project` | Runs `bun run check:docs`, the example, schema, and surface checks, the build, and the plugin and deploy checks. |
