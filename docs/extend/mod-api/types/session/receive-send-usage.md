---
title: Session Receive, Send, and Usage Types
description: "Types of rate limits, receive, repo, resume, send, start, usage, and version."
sidebar_position: 3
---

## Types with Fields

Each type below has its own table of fields.

### `SessionRateLimit`

One rate-limit window as the rate-limit notices read it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | Which window: `five_hour`, `seven_day`, or a Claude gateway's `spend_limit`. | Type: `string`. |
| `percentUsed` | <Documented /> | How much of the window is used, 0 to 100 with at most one decimal: 23.5, or 7, never 7.000000000000001. It is past 100 on an exceeded spend limit. | Type: `number`. |
| `resetsAt` | <Documented /> | When the window resets, as an ISO 8601 timestamp. | Type: `string`. Optional. |

### `SessionReceiveEvent`

An external-event wake that the text of the delivery parsed as (a GitHub relay event, the notice of a signal). It has the attributes of the envelope and its JSON body.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `source` | <Documented /> | The producing service (`github`, `artifact-room` for a page's events). | Type: `string`. |
| `kind` | <Documented /> | The discriminator of the event (`pull_request.closed`, `check_suite`). | Type: `string`. |
| `from` | <Documented /> | The sender-kind attribute of the envelope as the server stamped it. `system` is the own event of a relay. `rc_owner` is the own relayed message of the user. Absent when the envelope carries none. | Type: `string`. Optional. |
| `data` | <Documented /> | The JSON body of the envelope (`{ pr: "acme/app#12", outcome: "merged" }`). | Type: `Record<string, unknown>`. The payload of the event. For `artifact-room` it holds `artifact`, `events`, and `overflow`. |
| `untrustedKeys` | <Documented /> | The `data` keys whose values are free text that a third party wrote (the `author` and `comment` of a commenter), as the producer marked them. | Type: `readonly string[]`. Empty when none. The server asserts the value of every other key, not these. |

### `SessionReceiveInput`

The input of `session.receive`: one inbound delivery, sanitized, before it is queued (a relay's event, a peer's message, a message for an agent). Used by `session.receive`, `$.session.receive`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `origin` | <Documented /> | Where the delivery came from, as the bridge classified it, the key that a matcher narrows on. `next(e)` passes it on as received. | Type: `SessionReceiveOrigin`. |
| `text` | <Documented /> | The body of the delivery as the model would read it (the text blocks of a content-block delivery, joined). | Type: `string`. |
| `event` | <Documented /> | The external-event wake that the text parsed as (`source` `github` for the event of a subscribed pull request), passed on as received. | Type: `SessionReceiveEvent`. Optional. Present only when the server itself rendered the delivery as a wake. `untrustedKeys` name third-party text. |
| `agentId` | <Documented /> | The id of the loop that the delivery is for, when it is one of the agents of this session (`$.agent.list()` lists it). Absent for the main conversation. | Type: `string`. Optional. Pinned: a rewrite that changes it is refused. It is the agent id of the receiver. |

### `SessionReceiveOrigin`

Where an inbound delivery came from, as the bridge classified it from the stamps of the server: the `e.origin` of `prompt.submit`, less what never arrives.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | `bridge` is the own message of the user from a Remote Control client. `unclassified` is one that nobody could place. The rest are as at `prompt.submit`. | Type: `'bridge' \| 'task-notification' \| 'scheduled-trigger' \| 'peer-send-message' \| 'projects-relay' \| 'slack-ping' \| 'unclassified'`. `task-notification` is the event of a relay or a trigger. |
| `kind` | <Documented /> | `peer` is the model of another session or agent. `coordinator` is the main conversation to an agent of its own. | Type: `'peer' \| 'coordinator'`. |
| `plugin` | <Documented /> | Which plugin's `$.session.send` composed it, AS THE SENDER SAYS. Absent for a message that the sending model wrote itself. | Type: `string`. Optional. A claim over a same-user channel, exactly as trustworthy as the name of the sender. Name it in a log line. Never key a guard on it. |
| `kind` | <Documented /> | A delivery through the agent-team mailbox of this session: `coordinator` from the harness of the lead, `peer` from a teammate or when unverified. | Type: `'peer' \| 'coordinator'`. |
| `plugin` | <Documented /> | Which plugin's `$.session.send` composed it, as the mailbox entry says. Absent for a message that the sending model wrote itself. | Type: `string`. Optional. |
| `teammate` | <Documented /> | The name of the sending member in the team (`team-lead` for the lead): the stamp of the harness when `isVerified`, else whatever the writer put. | Type: `string`. Example: `on("session.receive", { origin: { teammate: "researcher" } }, hook)`. |
| `isVerified` | <Documented /> | Whether this process can vouch for the mailbox entry: it wrote the entry (the process of the lead, for its own sends and the sends of in-process teammates), or it is a teammate in its own pane that accepted the signature of the lead on the entry. Since `2.1.323`, a teammate in its own pane can also be `true`. | Type: `boolean`. `false` means this process could not check the entry, or the entry failed the check. The process of the lead cannot check the send of a pane teammate. A pane teammate can check only what its lead sends, with a key from that lead. A failed check is no proof of forgery: after a restart, such a teammate fails every entry its lead writes (`schemas/claude-code.d.ts`). |

### `SessionReceiveResult`

What a `session.receive` hook returns and what `next(e)` resolves to: the delivery that was queued, `{ text }`, or `{ consumed: reason }`. `next(e)` resolves once the delivery is queued. A hook that answers without `next` queues nothing. Used by `session.receive`, `$.session.receive`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The body that the delivery was queued with. From core, `e.text` as it arrived at the bottom. | Type: `string`. A rewrite passes it down, `next({ ...e, text })`. |
| `consumed` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `consumed` | <Documented /> | Takes the delivery, answered without `next`: it is not queued, not written to the transcript and never reaches the model. | Type: `string`. The reason is logged, the plugin named. |
| `text` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `SessionRepo`

What `$.session.repo()` answers: the root of the repository and its origin remote, when the session is in one. Used by `$.session.repo`, `session.repo`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `root` | <Documented /> | The root of the repository, absolute: the root of the main working tree for a worktree. | Type: `string`. |
| `remote` | <Documented /> | The URL of the `origin` remote as git has it (push URL preferred), or null when the repository has none. | Type: `string \| null`. |
| `internal` | <Documented /> | Whether the remote is one of the repositories that this build treats as its own. False in a build that has none or when the remote is unrecognized. | Type: `boolean`. True for a repository on the own list of the build. A plugin may read it to act differently in a public repository. |
| `name` | <Documented /> | The repository that the allowlist matched, as `owner/name`. Null when `internal` is false. | Type: `string \| null`. A working copy without a remote that the engine still recognises is named by its own checkout configuration. The name of a remote is its path. |

### `SessionResume`

How to come back to the session that ended: what `claude --resume` takes.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | What `claude --resume <id>` takes, the own id of the ending session. | Type: `string`. It resumes a session that wrote a transcript: one that never ran a prompt, or ran with persistence off, left nothing under this id. |

### `SessionSendAddress`

Whom `$.session.send` addresses. It is a recipient as the SendMessage tool names one (a string), or a session or an agent of this session by id. Union. Fields: `agentId`, `sessionId`. The engine spells the two id forms before the send. A `session.send` hook reads that spelling on `e.to`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sessionId` | <Documented /> | One of the own sessions of the person: what its `$.session.id()` answers on this machine, or a Remote Control or cloud id (`session_...`). | Type: `string`. The engine does not deliver to a session that is not running now. The result says so. |
| `agentId` | <Documented /> | A subagent or teammate of this session: the id that `$.agent.list()` lists and `agent.spawn` answered. | Type: `string`. A finished subagent is resumed from its transcript with the message, as the tool does. The `teammateId` of a live teammate reaches it too. |

### `SessionSendArgs`

The input of `session.send` as the `$.session.send(args)` of a plugin takes it. The engine sets `origin` (the calling plugin) and `agentId`. Used by `$.session.send`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | The recipient: the own spelling of the tool (a name, an agent id, a received `from` address), or `{ sessionId }` / `{ agentId }`. | Type: `SessionSendAddress`. |
| `text` | <Documented /> | The text of the message, non-empty. | Type: `string`. |

### `SessionSendInput`

The input of `session.send`: one plain-text message about to leave this conversation for another agent or session, the dual of `session.receive`. Used by `session.send`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | Whom it goes to, as the SendMessage tool spells a recipient: a name as ListAgents lists it, an agent id, or a received `from` address. | Type: `string`. The `{ sessionId }` or `{ agentId }` of a plugin arrives already spelled. `next({ ...e, to })` readdresses it, and the engine judges it again. |
| `text` | <Documented /> | The text of the message as the recipient will read it inside the envelope of the engine. `next({ ...e, text })` is what is sent, with no new approval. | Type: `string`. |
| `origin` | <Documented /> | Who is sending: the model through its SendMessage tool, or a plugin through `$.session.send`. Pinned: a rewrite that changes it is refused. | Type: `SessionSendOrigin`. |
| `agentId` | <Documented /> | The id of the loop that sends, when the model of a subagent or teammate sends (`$.agent.list()` lists it). Absent for a send of the main conversation. | Type: `string`. Optional. Pinned: it is the agent id of the sender. The `session.receive` of the receiver gets the `agentId` of its own loop. |

### `SessionSendOrigin`

Who is sending at `session.send`: the model through its SendMessage tool, or a plugin through `$.session.send`. The engine stamps it, and it is pinned. The `session.receive` of the receiver reads the name of a plugin on its own `e.origin.plugin`, beside the `peer` or `coordinator` kind that it keeps.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The own SendMessage tool call of the model, in the main conversation or in the loop of a subagent or teammate (`e.agentId` says which). | Type: `'model'`. |
| `kind` | <Documented /> | A `$.session.send` of a plugin, its `$.tool.call` of SendMessage, or the model inside an agent that it spawned. Its other hooks still see it. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the sending plugin, which the receiver reads as the `plugin` of its `session.receive` origin and displays beside the sender. | Type: `string`. |

### `SessionSendResult`

What a `session.send` hook returns and `next(e)` and `$.session.send` resolve to: whether the message was delivered, and why not when not. Delivered means queued at the recipient, not read. Used by `session.send`, `$.session.send`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isDelivered` | <Documented /> | True: the message reached the queue or inbox of its recipient. | Type: `true`. |
| `reason` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isDelivered` | <Documented /> | False: nothing was delivered. A hook that answers this without `next` refuses the send, and the model reads `reason` as the result of the tool. | Type: `false`. |
| `reason` | <Documented /> | Why not, as the SendMessage tool words it. It is nobody by that name, several by it, the recipient gone or refusing, or a refusal by a hook. | Type: `string`. Example: `on('session.send', { to: 'prod' }, () => NOT_FROM_HERE)`. |

### `SessionStartInput`

The input of `session.start`: the session that the process starts with, read the way `$.session` reads it at that moment. Used by `session.start`, `$.session.start`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `cwd` | <Documented /> | The directory the session runs in, absolute (`$.session.cwd()`). | Type: `string`. |
| `surface` | <Documented /> | Where the session draws at start (`$.session.surfaces()[0]`): `terminal` under the REPL, null for a `-p` run or the SDK, which draw nowhere yet. | Type: `RenderSurface \| null`. |
| `isInteractive` | <Documented /> | Whether a person is at the prompt: true under the REPL, false for a `-p` run or the SDK. | Type: `boolean`. |

### `SessionStartResult`

What a `session.start` hook returns and what `next(e)` resolves to: `{ cwd }`, echoed by core, The own value of a hook does not change the session. Used by `session.start`, `$.session.start`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `cwd` | <Documented /> | The working directory of the session. | Type: `string`. |

### `SessionUsage`

What `$.session.usage()` answers: when the session began, the fill of the context window, the rate-limit windows of the account and the cost of the session. These are the figures of the status line. The engine leaves out a figure that it lacks, and never sets it to zero. Used by `$.session.usage`, `session.usage`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `startedAt` | <Documented /> | When the session that these figures count from began, in the milliseconds of `$.clock.now()`: its start, or for a resumed session its first start. | Type: `number`. When the session counts from. `/clear` starts it over at that moment. |
| `context` | <Documented /> | The live context window: the `context_window` figures of the status line. | Type: `SessionContextUsage`. |
| `rateLimits` | <Documented /> | The rate-limit windows that the last API response reported (`five_hour`, `seven_day`, the `spend_limit` of a gateway). Empty when none has a reading. | Type: `SessionRateLimit[]`. |
| `cost` | <Documented /> | What the session has cost so far, as /cost totals it. Absent only where the host keeps no cost ledger (the CLI always has one). | Type: `SessionCost`. Optional. |

### `SessionUsageArgs`

What `$.session.usage(args)` takes: nothing for the figures of the status line alone, `breakdown` to have the window broken down as /context breaks it. Used by `$.session.usage`, `session.usage`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `breakdown` | <Documented /> | Asks for `context.breakdown` and says how it is counted (ContextBreakdownDetail). If absent, the call computes none and is free. | Type: `ContextBreakdownDetail`. Optional. `full` sends one token-count request for each tool and memory file, as /context does. `summary` estimates locally and sends none. |
| `columns` | <Documented /> | The width that the grid of the breakdown will be drawn in, in terminal columns. If absent, the full-width grid. Read only with `breakdown`. | Type: `number`. Optional. Under 80 the grid is the narrow one that /context draws there, 5 wide. The breakdown of a thin client is the one of the remote workspace, whose grid ignores this. |

### `SessionVersion`

What `$.session.version()` answers: the version of the engine that the session runs on, the release that version is built from, and when it was built. The same three values as the own analytics rows of the engine. Used by `$.session.version`, `session.version`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `version` | <Documented /> | The engine's full version, as `claude --version` prints it. | Type: `string`. A release's is `2.1.280`, a development build's adds the build's date, time and commit (`2.1.280-dev.20260920.t101500.sha1a2b3c4`). |
| `base` | <Documented /> | The release the version is built from, its semantic core and channel: `2.1.280` for that release, `2.1.280-dev` for a development build of it. | Type: `string`. Optional. Absent when the version is not spelled as a release. |
| `builtAt` | <Documented /> | When the binary was built, an ISO 8601 timestamp (`2026-09-20T10:15:00Z`). Absent in a run from source that stamps none. | Type: `string`. Optional. |

## Related Pages

- [Session Types](index.md)
- [Mod API Types](../index.md)
