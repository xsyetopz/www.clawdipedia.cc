---
title: "Skill, /code-review"
description: "Verbatim text of the built-in /code-review skill, captured from the program."
sidebar_position: 6
generated: false
group: skills
---

This is the verbatim text that Claude Code 2.1.329 uses for the built-in `/code-review` skill.

## Where It Comes From

Bundled skill. Captured from the program with `PROBE-ARG`, the argument the test used in place of your input. The `/review` alias has the same text.

## How to Override It

Create `.claude/skills/code-review/SKILL.md` with the same name. The program lists skill files from the skill folders (`skillDirCommands`) before bundled skills (`bundledSkills`) and uses the first command with a matching name, so your file replaces this text (The program, `chunk-hg1yqkjk.js:190384`, `chunk-6d5r944q.js:115`). It adds a `Base directory for this skill:` line above your skill text (The program, `chunk-hg1yqkjk.js:279997`). See [Override a Prompt](../other/override.md).

## Full Text

Temp folder paths were replaced with `<temp-dir>` or `<bundled-skill-dir>`, and emoji not on the site's allow-list are shown in brackets. `PROBE-ARG` is the test's argument.

````text
Review target: `PROBE-ARG`

`high effort → 8 inline angles → dedup (no verify) → ≤10 findings`

You are reviewing for **recall** at high effort: catch every real bug a careful
reviewer would catch in one sitting. At this level, catching real bugs matters
more than avoiding false positives. Err on the side of surfacing.

## Phase 0 — Gather the diff

Run `git diff @{upstream}...HEAD` (or `git diff main...HEAD` / `git diff HEAD~1`
if there's no upstream) to get the unified diff under review. If there are
uncommitted changes, or the range diff is empty, also run `git diff HEAD` and
include the working-tree changes in scope — the review often runs before the
commit. If a PR number, branch name, or file path was passed as an argument,
review that target instead. Treat this diff as the review scope.

## Phase 1 — Find candidates (3 correctness angles + 3 cleanup angles + 1 altitude angle + 1 conventions angle, up to 6 each)

Run **8 independent finder angles** in sequence yourself, in THIS context — do NOT spawn subagents for them. Each
surfaces **up to 6 candidate findings** with `file`, `line`, a one-line
`summary`, and a concrete `failure_scenario`.

### Angle A — line-by-line diff scan

Read every hunk in the diff, line by line. Then Read the enclosing function for
each hunk — bugs in unchanged lines of a touched function are in scope (the PR
re-exposes or fails to fix them). For every line ask: what input, state, timing,
or platform makes this line wrong? Look for inverted/wrong conditions,
off-by-one, null/undefined deref, missing `await`, falsy-zero checks,
wrong-variable copy-paste, error swallowed in catch, unescaped regex metachars.

### Angle B — removed-behavior auditor

For every line the diff DELETES or replaces, name the invariant or behavior it
enforced, then search the new code for where that invariant is re-established.
If you can't find it, that's a candidate: a removed guard, a dropped error
path, a narrowed validation, a deleted test that was covering a real case.

### Angle C — cross-file tracer

For each function the diff changes, find its callers (Grep for the symbol) and
check whether the change breaks any call site: a new precondition, a changed
return shape, a new exception, a timing/ordering dependency. Also check callees:
does a parallel change in the same PR make a call unsafe?

### Reuse

The angles above hunt for bugs; this one and the next two hunt for cleanup in
the changed code. Flag new code that re-implements something the codebase
already has — Grep shared/utility modules and files adjacent to the change,
and name the existing helper to call instead.

### Simplification

Flag unnecessary complexity the diff adds: redundant or derivable state,
copy-paste with slight variation, deep nesting, dead code left behind. Name
the simpler form that does the same job.

### Efficiency

Flag wasted work the diff introduces: redundant computation or repeated I/O,
independent operations run sequentially, blocking work added to startup or
hot paths. Also flag long-lived objects built from closures or captured
environments — they keep the entire enclosing scope alive for the object's
lifetime (a memory leak when that scope holds large values); prefer a
class/struct that copies only the fields it needs. Name the cheaper
alternative.

### Altitude

Check that each change fixes the root cause at the right depth rather than
patching a symptom with a fragile bandaid. Special cases layered on shared
infrastructure are a sign the fix isn't deep enough — prefer the simpler, more
general change to the underlying mechanism over adding special cases, and name
that change.

### Conventions (CLAUDE.md)

Find the CLAUDE.md files that govern the changed code: the user-level
~/.claude/CLAUDE.md, the repo-root CLAUDE.md, plus any CLAUDE.md or
CLAUDE.local.md in a directory that is an ancestor of a changed file (a
directory's CLAUDE.md only applies to files at or below it). Read each one
that exists, then check the diff for clear violations of the rules they state.

Only flag a violation when you can quote the exact rule and the exact line
that breaks it — no style preferences, no vague "spirit of the doc"
inferences. In the finding, name the CLAUDE.md path and quote the rule so the
report can cite it. If no CLAUDE.md applies, return nothing for this angle.

Cleanup, altitude, and conventions candidates use the same
`file`/`line`/`summary` shape; in `failure_scenario`, state the concrete
cost (what is duplicated, wasted, harder to maintain, or which CLAUDE.md rule
is broken) instead of a crash. Correctness bugs always outrank cleanup,
altitude, and conventions findings when the output cap forces a cut.

Pass every candidate with a nameable failure scenario through — finders that
silently drop half-believed candidates are the dominant cause of misses.

## Phase 2 — Dedup only (no verify)

Pool all candidates. Dedup near-duplicates only (same defect, same location, same reason → keep one). Do NOT run verifiers; do NOT re-judge. Sort by severity.

## Output

Target **at least 5 findings**. If fewer genuine findings exist, emit what you have — do not invent to hit the floor.

Return findings as a JSON array of at most 10 objects:

```json
[
  {
    "file": "path/to/file.ext",
    "line": 123,
    "summary": "one-sentence statement of the bug",
    "failure_scenario": "concrete inputs/state → wrong output/crash"
  }
]
```

Ranked most-severe first. If more than 10 survive, keep the 10 most
severe. If nothing survives, return `[]`. Do not call the
ReportFindings tool even if it is available - this review's
output contract is the JSON block above.
````

## Other Variants

The text above is the variant the capture produced. The program builds other variants of this skill from the same module. The variants differ in the `Phase 0` text, in a block for a pull request target, and in a level line. The texts below come from the code, not from a capture.

### Phase 0 With Origin/HEAD

The program picks the model family's cell, and the cell picks the text. For a model that is not `claude-sonnet-5`, `claude-opus-4-8`, or `claude-opus-5`, the `default` family applies. Its cells are `bugs-low-v1`, `bugs-conventions-v1`, `bugs-conventions-xhigh-v1`, and `bugs-conventions-max-v1` (The program, `chunk-z758pdbe.js:2426`, `chunk-z758pdbe.js:2441`). The `bugs-conventions-v1` cell, for example, uses this `Phase 0` instead of the one shown above (The program, `chunk-z758pdbe.js:1552`, `chunk-z758pdbe.js:2368`).

````text
## Phase 0 — Gather the diff

Unless a review target is named above, run `git diff origin/HEAD...HEAD` by
itself, exactly as written, to get the unified diff under review: the whole branch
against the default branch. Only if that fails, or it and `git diff HEAD` both
print nothing, run `git diff main...HEAD`, with the default branch's name in place
of `main` if it has another (`git branch -a` lists the branches), or
`git diff HEAD~1` if you can't tell the base. Three forms need permission, so
never write them: `@{upstream}` or `@{u}` next to `..` or `...`, commands
grouped in parentheses, and shell variables such as `$?`. If there are
uncommitted changes, or the range diff is empty, also run `git diff HEAD` and
include the working-tree changes in scope — the review often runs before the
commit. If a PR number, branch name, or file path was passed as an argument,
review that target instead. Treat this diff as the review scope.
````

The `low` text in these cells also reads `git diff origin/HEAD...HEAD` instead of `git diff @{upstream}...HEAD` (The program, `chunk-z758pdbe.js:1889`).

### Pull Request or Merge Request Target

When the argument is a pull request number, a GitHub pull request URL, or, with a GitLab project, a merge request number, the program adds a block after the `Review target:` line. It names the target and gives the command that reads its diff: `gh pr diff` for GitHub or `glab mr diff` for GitLab, with the number after it (The program, `chunk-z758pdbe.js:2588`, `chunk-z758pdbe.js:2599`, `chunk-z758pdbe.js:2964`). The block starts like this, with the target name and the command filled in:

````text
That target is <name>, and its own diff is this review's scope. Get the diff with this command, run alone, with nothing chained, piped or redirected:

<command>

It replaces every `git diff` command that the instructions below give for gathering the diff.
````

The block goes on to tell the model not to trust local files that lack the diff's added lines, and to give each subagent the diff itself. It also gives a fixed sentence to use if the command fails. With `--fix`, or for a URL target, the model replies "so nothing was reviewed." and posts nothing (The program, `chunk-z758pdbe.js:2626`). With `--comment`, it says "so this review and its comments are of the checked-out code." and reviews the checked-out code (The program, `chunk-z758pdbe.js:2628`). Otherwise it says "This review is of the checked-out branch instead" and reviews the checked-out branch (The program, `chunk-z758pdbe.js:2629`).

### Level Line

When the session declares the `ReportFindings` tool, and the cell name starts with `bugs-`, the program adds one more instruction (The program, `chunk-z758pdbe.js:2864`, `chunk-z758pdbe.js:2868`):

````text
In every ReportFindings call for this review, set `level` to `<level>`.
````

`<level>` is the effort level that the run uses, such as `high`. The program declares the tool to the skill when the environment variable `CLAUDE_CODE_REPORT_FINDINGS` is set. It skips the tool when the print output format is `text` or `json`. The format is the value of `--output-format` in print mode (`-p`), and its default is `text`; `stream-json` does not skip the tool. (The program, `chunk-z758pdbe.js:2509`, `chunk-z758pdbe.js:2512`, `chunk-txash88y.js:2039` (`--output-format` falls back to `"text"`), `chunk-txash88y.js:3401` (`--output-format <format>`, with the choices `text`, `json`, and `stream-json`), and `chunk-kgzzwvwc.js:7023-7025` (`printOutputFormat`).)
