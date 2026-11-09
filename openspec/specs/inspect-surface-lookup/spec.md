# Inspect-Surface-Lookup Specification

## Purpose

Let an agent list the items of any kind of surface in an installed Claude Code binary with one cc-inspect call, instead of free-text binary searches.

## Requirements

### Requirement: List Surface Items by Kind

cc-inspect SHALL have a `surface` tool that takes a `kind`, an optional `version` (a version or a path, as the other tools take), and an optional `name` filter.
It SHALL return the items of that kind in that binary, with each item's name, module, offset, and the literal default, values, or gate when the code shows them.
Without `kind`, it SHALL return each supported kind with its item count.
A computed value SHALL be shown as `unknown`.

#### Scenario: List One Kind

- **WHEN** an agent calls `surface` with `kind: "env"` and `version: "2.1.309"`
- **THEN** the reply lists the env var names that the program reads, each with a module and offset

#### Scenario: Filter by Name

- **WHEN** an agent calls `surface` with `kind: "env"` and `name: "BEDROCK"`
- **THEN** the reply lists only the env vars whose names contain `BEDROCK`

#### Scenario: Kinds Overview

- **WHEN** an agent calls `surface` with no `kind`
- **THEN** the reply lists every supported kind with its count for that binary

### Requirement: Errors of the Lookup

`surface` SHALL return an error that names the supported kinds when `kind` is unknown, and an error that names the installed versions when `version` is not found.

#### Scenario: Unknown Kind

- **WHEN** an agent calls `surface` with `kind: "nope"`
- **THEN** the reply is an error that lists the supported kinds

### Requirement: Same Items as the Snapshot

For one binary, `surface` SHALL return the same items as the surface snapshot of that binary, because both use the same extractors.

#### Scenario: Snapshot Agreement

- **WHEN** `surface` and the snapshot command run on the same binary for one kind
- **THEN** both give the same set of names

### Requirement: Read Only

`surface` SHALL only read the binary, and SHALL never run it or write files.

#### Scenario: No Writes

- **WHEN** `surface` runs
- **THEN** no file under the binary's folder or the config folder changes
