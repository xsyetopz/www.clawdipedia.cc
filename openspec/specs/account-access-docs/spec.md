# Account-Access-Docs Specification

## Purpose

Document how Claude Code learns the user's account and plan, and how it decides which models and features that account may use, from the program alone and without publishing its source or any secret.

## Requirements

### Requirement: Account Facts Page

The site SHALL have a page that lists each account fact the program reads (for example the plan type and the rate limit tier), the endpoint or file it comes from, where the program keeps it, and when it is fetched again.
Each fact SHALL cite "the program" with a module and offset, or a probe case.
A field SHALL be named only when it is found in `schemas/` or `schemas/claude-code.d.ts`, or it SHALL be marked as unconfirmed.

#### Scenario: Plan Type Source

- **WHEN** a reader looks up how the program knows the plan is Max
- **THEN** the page names the source of the plan type and its stored key, with a citation

### Requirement: Model Access Rules

The page SHALL state how the program decides that a model, such as a Fable or Mythos model, is offered or refused for an account, including each gate, server field, and user-settable variable or setting that changes it, and the text a user sees on a refusal.

#### Scenario: Gated Model

- **WHEN** a model is offered only behind a server gate
- **THEN** the page names the gate, says that users cannot set it, and links the model's row in `docs/configure/models-and-providers.md`

### Requirement: No Sensitive Content

The page SHALL NOT quote more than one short line of program source for each fact, and SHALL NOT show a token, a key, an account id, or the content of a credential file.

#### Scenario: Credential Store

- **WHEN** the page names the file that holds the login
- **THEN** it gives the path and the key names only, and no value
