---
title: "Session Title and Branch Name"
description: "How Claude Code 2.1.328 gets a session title and a git branch name."
sidebar_position: 5
generated: false
group: other
---

The program holds no local prompt for the session title and the git branch name. It asks the service for them.

## Where It Comes From

The program posts the first session message to `/api/organizations/:orgUUID/dust/generate_title_and_branch`. The reply has a `title` and a `branch_name`. If the request is not sent or fails, the title is made from the message text and the branch is `claude/task`. A branch name that does not match the expected pattern is replaced with `claude/task`. The program sends no request when a policy verdict is missing, or when a HIPAA or data-retention taint is in effect.[^source]

## How to Override It

No override found. See [Override a Prompt](./override.md).

## Sources

[^source]: The program, `chunk-56bhcxay.js:2494111`.
