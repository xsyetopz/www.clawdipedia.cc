---
title: Session Receive, Send, and Usage Types
description: "Types of rate limits, receive, repo, resume, send, start, usage, and version."
sidebar_position: 3
---

These types describe rate limits, inbound and outbound messages, the repository, resume, start, usage, and version of `$.session`. A mod reads them from `$.session` and from the `session.*` hooks.

## Types with Fields

Each type below has its own table of fields.

### `SessionRateLimit`

One rate-limit window, as the rate-limit notices read it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The window: `five_hour`, `seven_day`, or the `spend_limit` of a Claude gateway. | Type: `string`. |
| `percentUsed` | <Documented /> | How much of the window is used, from 0 to 100, with at most one decimal: `23.5` or `7`, never `7.000000000000001`. On an exceeded spend limit, it is past 100. | Type: `number`. |
| `resetsAt` | <Documented /> | When the window resets, as an ISO 8601 timestamp. | Type: `string`. Optional. |

### `SessionReceiveEvent`

An external-event wake that the engine parsed from the text of the delivery (a GitHub relay event, or the notice of a signal). It has the attributes of the envelope and its JSON body.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `source` | <Documented /> | The service that produced the event (`github`, or `artifact-room` for the events of a page). | Type: `string`. |
| `kind` | <Documented /> | The kind of the event (`pull_request.closed`, `check_suite`). | Type: `string`. |
| `from` | <Documented /> | The sender-kind attribute of the envelope, as the server stamped it. `system` is a relay's own event. `rc_owner` is the user's own relayed message. Absent when the envelope carries none. | Type: `string`. Optional. |
| `data` | <Documented /> | The JSON body of the envelope (`{ pr: "acme/app#12", outcome: "merged" }`). | Type: `Record<string, unknown>`. The payload of the event. For `artifact-room` it holds `artifact`, `events`, and `overflow`. |
| `untrustedKeys` | <Documented /> | The `data` keys whose values are free text that a third party wrote (the `author` and `comment` of a commenter). The producer marks these keys. | Type: `readonly string[]`. Empty when there are none. The server asserts the value of every other key, but not the values of these keys. |

### `SessionReceiveInput`

The input of `session.receive`: one inbound delivery, sanitized, before the engine queues it (the event of a relay, a message from a peer, or a message for an agent). Used by `session.receive`, `$.session.receive`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `origin` | <Documented /> | Where the delivery came from, as the bridge classified it. A matcher narrows on this key. `next(e)` passes it on as received. | Type: `SessionReceiveOrigin`. |
| `text` | <Documented /> | The body of the delivery as the model would read it. For a content-block delivery, it is the text blocks joined. | Type: `string`. |
| `event` | <Documented /> | The external-event wake that the engine parsed from the text (`source` `github` for the event of a subscribed pull request). The engine passes it on as received. | Type: `SessionReceiveEvent`. Optional. Present only when the server itself rendered the delivery as a wake. `untrustedKeys` names the keys that hold third-party text. |
| `agentId` | <Documented /> | The id of the loop that the delivery is for, when the loop is one of the agents of this session (`$.agent.list()` lists it). Absent for the main conversation. | Type: `string`. Optional. Pinned: a rewrite that changes it is refused. It is the agent id of the receiver. |

### `SessionReceiveOrigin`

Where an inbound delivery came from, as the bridge classified it from the stamps of the server. It is the `e.origin` of `prompt.submit`, minus the origins that never arrive here.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | `bridge` is the user's own message from a Remote Control client. `unclassified` is a delivery that nobody could place. The other values are the same as at `prompt.submit`. | Type: `'bridge' \| 'task-notification' \| 'scheduled-trigger' \| 'peer-send-message' \| 'projects-relay' \| 'slack-ping' \| 'unclassified'`. `task-notification` is the event of a relay or a trigger. |
| `kind` | <Documented /> | `peer` is the model of another session or agent. `coordinator` is the main conversation, writing to an agent of its own. | Type: `'peer' \| 'coordinator'`. |
| `plugin` | <Documented /> | The plugin whose `$.session.send` composed the delivery, as the sender says. Absent for a message that the sending model wrote itself. | Type: `string`. Optional. It is a claim over a same-user channel, and it is exactly as trustworthy as the name of the sender. Name it in a log line. Never key a guard on it. |
| `kind` | <Documented /> | A delivery through the agent-team mailbox of this session. `coordinator` comes from the harness of the lead. `peer` comes from a teammate, or from a sender that is unverified. | Type: `'peer' \| 'coordinator'`. |
| `plugin` | <Documented /> | The plugin whose `$.session.send` composed the delivery, as the mailbox entry says. Absent for a message that the sending model wrote itself. | Type: `string`. Optional. |
| `teammate` | <Documented /> | The name of the sending member in the team (`team-lead` for the lead). It is the stamp of the harness when `isVerified` is true. Otherwise it is whatever the writer put there. | Type: `string`. Example: `on("session.receive", { origin: { teammate: "researcher" } }, hook)`. |
| `isVerified` | <Documented /> | Whether this process can vouch for the mailbox entry. It can when it wrote the entry (the process of the lead, for its own sends and the sends of in-process teammates), or when it is a teammate in its own pane that accepted the signature of the lead on the entry. Since `2.1.323`, a teammate in its own pane can also be `true`. | Type: `boolean`. `false` means this process could not check the entry, or the entry failed the check. The process of the lead cannot check the send of a pane teammate. A pane teammate can check only what its lead sends, with a key from that lead. A failed check is no proof of forgery: after a restart, such a teammate fails every entry that its lead writes.[^verified] |

### `SessionReceiveResult`

What a `session.receive` hook returns and what `next(e)` resolves to. It is the delivery that the engine queued (`{ text }`), or `{ consumed: reason }`. `next(e)` resolves once the engine queues the delivery. A hook that answers without `next` queues nothing. Used by `session.receive`, `$.session.receive`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The body that the engine queued the delivery with. From core, it is `e.text` as it arrived at the bottom. | Type: `string`. To rewrite the text, pass it down with `next({ ...e, text })`. |
| `consumed` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `consumed` | <Documented /> | Takes the delivery, answered without `next`. The engine does not queue it or write it to the transcript, and it never reaches the model. | Type: `string`. The engine logs the reason and names the plugin. |
| `text` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `SessionRepo`

What `$.session.repo()` answers: the root of the repository and its origin remote, when the session is in a repository. Used by `$.session.repo`, `session.repo`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `root` | <Documented /> | The absolute root of the repository. For a worktree, it is the root of the main working tree. | Type: `string`. |
| `remote` | <Documented /> | The URL of the `origin` remote as git has it (push URL preferred), or null when the repository has none. | Type: `string \| null`. |
| `internal` | <Documented /> | Whether the remote is one of the repositories that this build treats as its own. False in a build that has none, or when the remote is unrecognized. | Type: `boolean`. True for a repository on the build's own list. A plugin may read it to act differently in a public repository. |
| `name` | <Documented /> | The repository that the allowlist matched, as `owner/name`. Null when `internal` is false. | Type: `string \| null`. A working copy without a remote that the engine still recognizes is named by its own checkout configuration. The name of a remote is its path. |

### `SessionResume`

How to come back to the session that ended. It is what `claude --resume` takes.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | What `claude --resume <id>` takes. It is the id of the ending session. | Type: `string`. It resumes a session that wrote a transcript. A session that never ran a prompt, or ran with persistence off, left nothing under this id. |

### `SessionSendAddress`

The recipient of `$.session.send`. It is a recipient as the `SendMessage` tool names one (a string), or a session or an agent of this session by id. It is a union with the fields `agentId` and `sessionId`. The engine spells the two id forms before the send. A `session.send` hook reads that spelling on `e.to`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sessionId` | <Documented /> | One of the user's own sessions. It is what `$.session.id()` answers on this machine, or a Remote Control or cloud id (`session_...`). | Type: `string`. The engine does not deliver to a session that is not running now. The result says so. |
| `agentId` | <Documented /> | A subagent or teammate of this session. It is the id that `$.agent.list()` lists and `agent.spawn` answered. | Type: `string`. The engine resumes a finished subagent from its transcript with the message, as the tool does. The `teammateId` of a live teammate reaches the teammate too. |

### `SessionSendArgs`

The input of `session.send` as the `$.session.send(args)` of a plugin takes it. The engine sets `origin` (the calling plugin) and `agentId`. Used by `$.session.send`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | The recipient. Use the spelling of the tool (a name, an agent id, or a received `from` address), or `{ sessionId }` or `{ agentId }`. | Type: `SessionSendAddress`. |
| `text` | <Documented /> | The text of the message. It must not be empty. | Type: `string`. |

### `SessionSendInput`

The input of `session.send`: one plain-text message that is about to leave this conversation for another agent or session. It is the counterpart of `session.receive`. Used by `session.send`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | The recipient, as the `SendMessage` tool spells it: a name as `ListAgents` lists it, an agent id, or a received `from` address. | Type: `string`. The `{ sessionId }` or `{ agentId }` of a plugin arrives already spelled. `next({ ...e, to })` readdresses the message, and the engine judges it again. |
| `text` | <Documented /> | The text of the message as the recipient will read it inside the envelope of the engine. `next({ ...e, text })` is what the engine sends, with no new approval. | Type: `string`. |
| `origin` | <Documented /> | Who is sending: the model through its `SendMessage` tool, or a plugin through `$.session.send`. Pinned: a rewrite that changes it is refused. | Type: `SessionSendOrigin`. |
| `agentId` | <Documented /> | The id of the loop that sends, when the model of a subagent or teammate sends (`$.agent.list()` lists it). Absent for a send from the main conversation. | Type: `string`. Optional. Pinned: it is the agent id of the sender. The `session.receive` of the receiver gets the `agentId` of its own loop. |

### `SessionSendOrigin`

Who is sending at `session.send`: the model through its `SendMessage` tool, or a plugin through `$.session.send`. The engine stamps it, and it is pinned. The `session.receive` of the receiver reads the name of a plugin on its own `e.origin.plugin`, beside the `peer` or `coordinator` kind that it keeps.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The own `SendMessage` tool call of the model, in the main conversation or in the loop of a subagent or teammate (`e.agentId` says which). | Type: `'model'`. |
| `kind` | <Documented /> | A `$.session.send` of a plugin, its `$.tool.call` of `SendMessage`, or the model inside an agent that the plugin spawned. The other hooks of the plugin still see the send. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the sending plugin. The receiver reads it as the `plugin` of its `session.receive` origin and displays it beside the sender. | Type: `string`. |

### `SessionSendResult`

What a `session.send` hook returns and what `next(e)` and `$.session.send` resolve to. It says whether the message was delivered, and if not, why not. Delivered means queued at the recipient. It does not mean read. Used by `session.send`, `$.session.send`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isDelivered` | <Documented /> | True: the message reached the queue or the inbox of its recipient. | Type: `true`. |
| `reason` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `isDelivered` | <Documented /> | False: nothing was delivered. A hook that answers this without `next` refuses the send, and the model reads `reason` as the result of the tool. | Type: `false`. |
| `reason` | <Documented /> | Why the message was not delivered, as the `SendMessage` tool words it. The causes are: nobody has that name, several have it, the recipient is gone or refuses, or a hook refused the send. | Type: `string`. Example: `on('session.send', { to: 'prod' }, () => NOT_FROM_HERE)`. |

### `SessionStartInput`

The input of `session.start`: the session that the process starts with, as `$.session` reads it at that moment. Used by `session.start`, `$.session.start`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `cwd` | <Documented /> | The absolute directory that the session runs in (`$.session.cwd()`). | Type: `string`. |
| `surface` | <Documented /> | Where the session draws at start (`$.session.surfaces()[0]`). It is `terminal` under the REPL. It is null for a `-p` run or the SDK, which draw nowhere yet. | Type: `RenderSurface \| null`. |
| `isInteractive` | <Documented /> | Whether a user is at the prompt. True under the REPL, false for a `-p` run or the SDK. | Type: `boolean`. |

### `SessionStartResult`

What a `session.start` hook returns and what `next(e)` resolves to: `{ cwd }`, which core echoes back. A value that a hook returns does not change the session. Used by `session.start`, `$.session.start`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `cwd` | <Documented /> | The working directory of the session. | Type: `string`. |

### `SessionStopInput`

The input of `session.stop`. Since `2.1.326`, it tells what the Stop of the person found. It is the record of the engine: a hook observes it, and `next(e)` passes it on. Used by `session.stop`, `$.session.stop`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isTurnRunning` | <Documented /> | Whether a turn of the main conversation was under way. | Type: `boolean`. At the terminal, a command that the person waits on also counts. A prompt that has not started reads false. |

The result of a `session.stop` hook is `SessionStopResult`, which is `{ isTurnRunning }`. Core echoes it, and a value that a hook returns changes nothing.[^session-stop]

### `SessionUsage`

What `$.session.usage()` answers: when the session began, the fill of the context window, the rate-limit windows of the account, and the cost of the session. These are the figures of the status line. The engine leaves out a figure that it lacks. It never sets such a figure to zero. Used by `$.session.usage`, `session.usage`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `startedAt` | <Documented /> | When the session that these figures count from began, in the milliseconds of `$.clock.now()`. It is the start of the session, or the first start of a resumed session. | Type: `number`. The time that the session counts from. `/clear` starts it over at that moment. |
| `context` | <Documented /> | The live context window. It holds the `context_window` figures of the status line. | Type: `SessionContextUsage`. |
| `rateLimits` | <Documented /> | The rate-limit windows that the last API response reported (`five_hour`, `seven_day`, the `spend_limit` of a gateway). Empty when no window has a reading. | Type: `SessionRateLimit[]`. |
| `cost` | <Documented /> | What the session has cost so far, as `/cost` adds it up. Absent only where the host keeps no cost ledger (the CLI always has one). | Type: `SessionCost`. Optional. |

### `SessionUsageArgs`

What `$.session.usage(args)` takes. Pass nothing for the figures of the status line alone. Pass `breakdown` to get the window broken down as `/context` breaks it down. Used by `$.session.usage`, `session.usage`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `breakdown` | <Documented /> | Asks for `context.breakdown` and says how to count it (`ContextBreakdownDetail`). If you leave it out, the call computes no breakdown and costs nothing. | Type: `ContextBreakdownDetail`. Optional. `full` sends one token-count request for each tool and memory file, as `/context` does. `summary` estimates locally and sends no request. |
| `columns` | <Documented /> | The width that the grid of the breakdown is drawn in, in terminal columns. If you leave it out, the grid has full width. The engine reads it only with `breakdown`. | Type: `number`. Optional. Under 80, the grid is the narrow one that `/context` draws there, 5 squares wide. The breakdown of a thin client is the breakdown of the remote workspace, and its grid ignores this value. |

### `SessionVersion`

What `$.session.version()` answers: the version of the engine that the session runs on, the release that the version is built from, and the build time. These are the same three values as in the analytics rows of the engine. Used by `$.session.version`, `session.version`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `version` | <Documented /> | The full version of the engine, as `claude --version` prints it. | Type: `string`. A release is `2.1.280`. A development build adds the date, the time, and the commit of the build (`2.1.280-dev.20260920.t101500.sha1a2b3c4`). |
| `base` | <Documented /> | The release that the version is built from, as its semantic core and channel: `2.1.280` for that release, `2.1.280-dev` for a development build of it. | Type: `string`. Optional. Absent when the version is not spelled as a release. |
| `builtAt` | <Documented /> | When the binary was built, as an ISO 8601 timestamp (`2026-09-20T10:15:00Z`). Absent in a run from source that stamps none. | Type: `string`. Optional. |

## Related Pages

- [Session Types](index.md)
- [Mod API Types](../index.md)

## Sources

[^verified]: The type file `schemas/claude-code.d.ts`.
[^session-stop]: `schemas/claude-code.d.ts`, `SessionStopInput`. The program, `chunk-4h798pp0.js:10027`.
