# Inspect-Release-Diff Specification

## Purpose

Let one cc-inspect run show what changed in the code between two Claude Code installs, and how each change behaves, with no model call and few tokens.

## Requirements

### Requirement: Clean Install

cc-inspect SHALL turn each JavaScript module of an install into cleaned text: each declared local name replaced by a name from its scope position, then formatted with `bun fmt`.
Strings, property names, and export names SHALL keep their text.
It SHALL write the cleaned modules and a function index (each function's module, offset, fingerprint, and cleaned text hash) to `captures/<version>/clean/`, and reuse that cache on the next call.

#### Scenario: Two Builds of the Same Code

- **WHEN** the same fixture app is minified twice with different local names, and both are cleaned
- **THEN** the cleaned texts are equal

#### Scenario: Cached Install

- **WHEN** an install was cleaned before, and the clean step runs again for it
- **THEN** it reads `captures/<version>/clean/` and parses no module

### Requirement: Diff Two Versions

The cc-inspect `release` tool SHALL have a `diff` action that takes two versions (`from` and `to`) and an optional `name` filter.
It SHALL list the functions added, gone, and changed, matched by fingerprint, each with its module and offset in both versions and a capped diff of the cleaned text.
It SHALL give a count summary first.

#### Scenario: Gate Removed

- **WHEN** an agent calls `release` with `action: "diff"`, `from: "2.1.309"` and `to: "2.1.310"` and `name: "Monitor"`
- **THEN** the reply lists the changed `isEnabled` of the `Monitor` tool, from a check of `tengu_amber_sentinel` to one without it

#### Scenario: Same Code

- **WHEN** both versions are the same install
- **THEN** the reply lists 0 added, 0 gone, and 0 changed functions

### Requirement: Explain a Function

The `release` tool SHALL have an `explain` action that takes a `version` and a name (a string, an env name, a gate, or a tool name).
For the function that holds it, it SHALL state where (module and offset), what (the cleaned code, capped), who (its callers), when (the gates, env reads, and `isEnabled` that guard it), how (`no-op`, `stub`, or `handled`), and why (the matched release-notes line, when there is one).

#### Scenario: No-Op Command

- **WHEN** an agent calls `release` with `action: "explain"` for the `/loops` command on `2.1.310`
- **THEN** the reply says its `isEnabled` is a `no-op` that returns false

#### Scenario: Unknown Name

- **WHEN** the name is not in the install
- **THEN** the reply says it was not found, and suggests no function

### Requirement: Check Release Notes

The `release` tool SHALL have a `notes` action that takes a `version`, reads its release notes from `captures/<version>/notes.md` (fetched with `gh release view` when missing), and marks each line `matched`, `gated`, or `unmatched` against the `diff` action and the `release:diff` items, with the matched function or item.

#### Scenario: Matched Line

- **WHEN** the `notes` action runs for `2.1.310`
- **THEN** the Monitor, effort, and AppArmor lines are `matched` or `gated`, each with a module and offset

#### Scenario: Server-Side Line

- **WHEN** a notes line names nothing found in the diff
- **THEN** it is `unmatched`, and no function is suggested

### Requirement: Query in Plain Words

The cc-inspect `code` tool SHALL have a `find` action that takes a `version` and a plain-words `query`, and returns at most 10 code units ranked by the query words found in their strings, property names, and labels, each with module, offset, and a short excerpt.
cc-inspect SHALL offer the MCP prompts `release_review` and `explain_change`, which name the tools to call in order.

#### Scenario: Plain-Words Query

- **WHEN** an agent calls `code` with `action: "find"` and "sleep Monitor until-loop" on `2.1.310`
- **THEN** the reply lists the unit that refuses a long leading `sleep`, with its module and offset

#### Scenario: Prompt List

- **WHEN** an agent lists the server's prompts
- **THEN** `release_review` and `explain_change` are listed

### Requirement: Few Tools

The cc-inspect MCP server SHALL offer exactly 4 tools, `sessions`, `code`, `surface`, and `release`, each with a one-sentence description, and related operations SHALL be values of an `action` or `kind` parameter of one tool.
Parameters with the same meaning SHALL have the same name in each tool: `version`, `query`, `name`, and `limit`.

#### Scenario: Tool List

- **WHEN** an agent lists the server's tools
- **THEN** it gets `sessions`, `code`, `surface`, and `release`, and no other tool

#### Scenario: Unknown Action

- **WHEN** an agent calls a tool with an `action` it does not have
- **THEN** the reply is an error that lists the actions of that tool
