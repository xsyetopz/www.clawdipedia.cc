---
title: Prompt Edit, Fill, Media, and Submit Types
description: "Types of the prompt edit, fill, and paint calls, media, mentions, origins, sections, and submit."
sidebar_position: 2
---

## Types with Fields

Each type below has its own table of fields.

### `PromptEditInput`

The input of `prompt.edit` (prompt-edit/): one edit that the person makes in the prompt box. It has the draft before the edit and the splice that the editor made of it. Used by `prompt.edit`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `origin` | <Documented /> | Who edits (PromptEditOrigin): the person at the composer. Pinned: `next(e)` passes it on as received. | Type: `PromptEditOrigin`. |
| `key` | <Documented /> | The one key that made the edit, in the shape of `Client` `onKey`. Absent for a paste, the newline of a keybinding, and a burst of keys folded into one edit. | Type: `ClientKeyEvent`. Optional. Pinned: which key the person pressed is a fact. A hook may not change it. |
| `text` | <Documented /> | The draft before the edit. `next({ ...e, text })` applies the edit to another draft instead. | Type: `string`. |
| `cursor` | <Documented /> | Where the caret of the person stood in `text` before the edit, 0 to `text.length`. | Type: `number`. |
| `start` | <Documented /> | Where in `text` the edit begins: the start of the span that it replaces, or where what was typed goes in. A bare cursor move begins where it lands. | Type: `number`. |
| `end` | <Documented /> | Where the replaced span of `text` ends: `start` for an insertion or a move, past it for a deletion (Backspace, a kill). | Type: `number`. |
| `inputText` | <Documented /> | What goes in between `start` and `end`: the typed or pasted text. It is `''` for a deletion or a move. | Type: `string`. `next({ ...e, inputText })` puts in another, and the cursor lands after it. |

### `PromptEditOrigin`

Who edits the prompt box at `prompt.edit`, as the engine stamps it where the edit starts. It is a closed set that a matcher narrows on. `next(e)` passes it on as received. No hook sets one.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The person, typing or pasting into the main prompt box. | Type: `'composer'`. |

### `PromptEditResult`

What a `prompt.edit` hook returns and what `next(e)` resolves to: the box after the edit (PromptBox), which the editor then displays. From core: `e.text` with the splice applied. Rewrite it to change what lands. Answer `{ text: e.text, cursor: e.cursor }` without `next` to consume the key.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `decorations` | <Documented /> | Runs to paint over the own `text` of this answer (PromptDecoration). None when absent. | Type: `PromptDecoration[]`. Optional. Kept on the same characters while the answer to the next edit is pending. Then the list of that answer replaces them. |

### `PromptFillArgs`

The input of `prompt.fill` as the `$.prompt.fill(args)` of a plugin takes it. It has no `origin` (the engine sets the calling plugin), and `mode` is optional. Used by `$.prompt.fill`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | What the box is to take (PromptFillInput `text`). | Type: `string`. |
| `mode` | <Documented /> | Where it goes (PromptFillMode). It is `replace` when left out. | Type: `PromptFillMode`. Optional. |
| `decorations` | <Documented /> | Runs to paint over `text` (PromptDecoration). Offsets into `text` as given. The engine moves them to where it lands. None when absent. | Type: `PromptDecoration[]`. Optional. The next `prompt.edit` answer replaces them. They are gone at the next change of the draft. |
| `cursor` | <Documented /> | Where the caret stands after the write: an offset into the whole draft the box then holds. Left out: past the text for `insert`, else at the end. | Type: `number`. Optional. Clamped to the draft and moved to the start of a character it falls inside. A value that is not an integer is refused. Since `2.1.309`. |

### `PromptPaintArgs`

What a plugin's `$.prompt.paint(args)` takes, and a hook on `prompt.paint` sees as `e` and may rewrite. Whose runs they are is the caller's name, which no argument or hook sets. Used by `$.prompt.paint`, `prompt.paint`. Since `2.1.311`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The draft that `decorations` were computed for. Nothing paints unless the box reads exactly this. | Type: `string`. Optional. May be left out only with an empty list. |
| `decorations` | <Documented /> | The runs of this plugin over the draft (PromptDecoration). They replace those that it painted before. An empty list clears them. | Type: `PromptDecoration[]`. The runs of other plugins stand, and a later one wins for each style key. The next change of the draft drops them, but for a `prompt.edit` hook in the terminal. |

### `PromptPainted`

What `$.prompt.paint` resolves to: whether the runs were painted, and the box as it stands (PromptBox). A mod whose text went stale computes again from `text`. The box goes to a plugin whose module calls `$.prompt.read`, through the hooks on it. A plugin that never does, or is refused there, gets the empty box. Used by `$.prompt.paint`. Since `2.1.311`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isPainted` | <Documented /> | True once the runs stand over the draft, or a clear took them off. False where the box does not read `text`, or where no box can take them. | Type: `boolean`. |
| `text` | <Documented /> | The draft as it stands, which the call did not change. It is `''` where no box is drawn or the caller may not read it (see above). | Type: `string`. |
| `cursor` | <Documented /> | Where the person types next: an offset into `text`, which the call did not move. | Type: `number`. |

### `PromptFilled`

What `$.prompt.fill` resolves to: whether the box took the text, and the box afterwards (PromptBox) as the own `$.prompt.read()` of the caller reads it. The box goes to a plugin whose module calls `$.prompt.read`. A plugin that never does gets the empty box. Used by `$.prompt.fill`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isFilled` | <Documented /> | True once the box holds the text. False where no box could take it or a hook kept it out (PromptFillResult). | Type: `boolean`. |
| `refusal` | <Documented /> | Why the engine refused the text: `no_composer` (no box) or `dialog` (a dialog holds the keys). A refusal by a hook carries no cause. | Type: `'no_composer' \| 'dialog'`. Optional. |
| `text` | <Documented /> | The draft after the fill. It is unchanged when `isFilled` is false. It is `''` where no box is drawn or the caller may not read it (see above). | Type: `string`. |
| `cursor` | <Documented /> | Where the person types next: an offset into `text`. It is where the `cursor` of the call put it. Else it is past the text of the fill for `insert`, and at the end for `replace` and `append`. | Type: `number`. |

### `PromptFillInput`

The input of `prompt.fill` (prompt-fill/): a text about to be put in the prompt box as the draft of the person. It goes over the draft, after it, or at the cursor. Used by `prompt.fill`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | What the box takes. The person edits it or presses Enter. `next({ ...e, text })` writes another. | Type: `string`. The box takes it without the code points that a terminal draws as nothing, as the composer removes them when a person sends. All else lands as written. |
| `mode` | <Documented /> | Where the text goes (PromptFillMode): over the draft, after it, or in at the cursor. `next({ ...e, mode })` moves it. If left out of a rewrite, it is kept. | Type: `PromptFillMode`. |
| `origin` | <Documented /> | Who writes (PromptFillOrigin). The engine sets it where the write starts. Pinned: `next(e)` passes it on as received. | Type: `PromptFillOrigin`. |
| `decorations` | <Documented /> | Runs to paint over `text` once it lands (PromptDecoration), as offsets into `text`. Absent when the call named none. | Type: `PromptDecoration[]`. Optional. What the chain passes down is what paints. A hook strips them so. Example: `next({ ...e, decorations: [] }))`. |
| `cursor` | <Documented /> | Where the caret stands after the write (PromptFillArgs `cursor`), an offset into the whole draft. Absent when the call named none. | Type: `number`. Optional. What the chain passes down moves the caret. Left out of a rewrite, the box places it by `mode`. Example: `next({ ...e, cursor: 0 })`. Since `2.1.309`. |

### `PromptFillOrigin`

Who writes the prompt box at `prompt.fill`, as the engine stamps it where the write starts. It is a closed set that a matcher narrows on. `next(e)` passes it on as received. No hook sets one.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The engine writing the box on its own account. Reserved for its own sites, and none of them raises `prompt.fill` as shipped. | Type: `'engine'`. |
| `kind` | <Documented /> | The `$.prompt.fill` of a plugin. | Type: `'plugin'`. |
| `name` | <Documented /> | The name of the filling plugin. | Type: `string`. |

### `PromptFillResult`

What a `prompt.fill` hook returns and what `next(e)` resolves to: whether the text went into the prompt box. Used by `prompt.fill`, `$.prompt.fill`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isFilled` | <Documented /> | True once the box holds the text. False where no box can take it (a dialog holds the keys, a headless session has none). | Type: `boolean`. A hook that answers `{ isFilled: false }` without `next` keeps the text out. |
| `refusal` | <Documented /> | Why the engine refused the text: `no_composer` (no prompt box) or `dialog` (a dialog holds the keys). A refusal by a hook carries none. Treat an absent cause as unknown. | Type: `'no_composer' \| 'dialog'`. Optional. |

### `PromptMedia`

What `$.prompt.media({ id })` answers: the bytes of one attached item as the engine would send them now, or why there are none to read. The engine reads an image after its resize. One call answers at most 4 MiB. Only a mod that managed settings install gets an answer. Used by `$.prompt.media`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The kind of the item. | Type: `'image' \| 'document'`. |
| `mediaType` | <Documented /> | The MIME type of the bytes answered (`image/png`), after the resize. | Type: `string`. |
| `base64` | <Documented /> | The slice of the item for this call, base64. The strings of the slices, joined in order, are the base64 of the whole item. | Type: `string`. |
| `size` | <Documented /> | How many bytes the whole item holds, decoded. | Type: `number`. |
| `next` | <Documented /> | The offset that the following slice starts at. Absent on the last one. | Type: `number`. Optional. |
| `unreadable` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `unreadable` | <Documented /> | Why the model will not receive the item as media. The engine could not process it, and sends a line of text in its place. | Type: `string`. |
| `type` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `mediaType` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `base64` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `size` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `next` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Why the engine refuses this read. No submission in flight carries the id for this caller, the item is not held as inline bytes, or the offset is past its end. | Type: `string`. |
| `type` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `mediaType` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `base64` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `size` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `next` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `unreadable` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `PromptMediaArgs`

What `$.prompt.media(args)` takes: which attached item of the prompt being submitted to read, and from where in it. Used by `$.prompt.media`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `id` | <Documented /> | The handle of the item, as `e.attachments` of the `prompt.submit` in flight lists it. | Type: `string`. |
| `offset` | <Documented /> | Where the slice starts, in bytes of the item: the `next` of an earlier read. If absent, the start. | Type: `number`. Optional. |

### `PromptMentionInput`

The input of `prompt.mention`: one file that a prompt names after an `@`, as the engine resolved it and before the engine reads it for the model. A hook rewrites `path`, `offset`, and `limit`. `mention` and `agentId` are pinned. Used by `prompt.mention`, `$.prompt.mention`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `mention` | <Documented /> | What followed the `@`: a path as the person typed it, with a fragment included (`#L10-20`). Pinned: what the prompt said. | Type: `string`. |
| `path` | <Documented /> | The absolute path of the file, as the engine resolved the mention. | Type: `string`. `next({ ...e, path })` reads another file. The deny rules judge it where it lands, with links followed. One read for each mention: a second `next` settles with the first. |
| `offset` | <Documented /> | The first line read, counted from 1, when the mention names lines (`#L10`). Absent for a whole file. A rewrite is where the read starts. | Type: `number`. Optional. |
| `limit` | <Documented /> | How many lines are read when the mention names lines (`#L10-20` reads 11). Absent for a whole file. A rewrite is how many are read. | Type: `number`. Optional. |
| `agentId` | <Documented /> | The loop whose prompt carries the mention: the id of a subagent, the `id` that `$.agent.list()` gives it. Absent on main. | Type: `string`. Optional. Pinned: a different value is refused, one left out is kept. |

### `PromptMentionResult`

What a `prompt.mention` hook returns and what `next(e)` resolves to: how the file was attached (`{ type, context? }`), or `{ deny: reason }`. The text of the file belongs to its attachment, which `prompt.attachment` rewrites. A hook that answers without `next` reads no file. Used by `prompt.mention`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | How the engine attached the file. It is null when it attached nothing: no file is there, it is too large, or it cannot be read. | Type: `PromptMentionAttached \| null`. From a hook answering without `next`: null, nothing was read. |
| `context` | <Documented /> | What the model reads after the mentioned files of the prompt and the person never sees. Each entry is one block. From core, none. | Type: `readonly string[]`. Optional. An answer keeps every entry that its `next` gave. Past 100,000 characters (200,000 together) the model reads a head and a path. |
| `deny` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `deny` | <Documented /> | Refuses the mention. The engine attaches nothing of the file, and forgets a read already made. The debug log names the reason. | Type: `string`. From core: a deny rule covers the path. The engine drops a context beside it. The engine skips a hook that throws. |
| `type` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `context` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

### `PromptOrigin`

Where a `prompt.submit` submission came from, as the engine knows it at the site that queued it. It is a closed set, never a text prefix. `e.origin.kind` tells the own Enter of the user from a notification, a peer session, a schedule, or another plugin. No hook sets it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | The own gesture of the user at the terminal, as the engine stamped it (never presumed from an unstamped command). | Type: `'composer'`. Enter at the prompt, typed or queued, or a click on a transcript link. The engine never stamps a channel that it cannot attest (a same-user socket). That channel arrives as `unclassified`. |
| `kind` | <Documented /> | The message of the user through the Remote Control bridge (a phone or web client). | Type: `'bridge'`. |
| `kind` | <Documented /> | The own turn of the SDK host (`claude -p`, the Agent SDK), not typed at a terminal. | Type: `'sdk'`. |
| `kind` | <Documented /> | The notification of a background task, dequeued when the session went idle or delivered into a running turn (`turnId` set). | Type: `'task-notification'`. |
| `kind` | <Documented /> | A scheduled task, routine or /loop that fires its stored prompt. | Type: `'scheduled-trigger'`. |
| `kind` | <Documented /> | A message from another Claude session ("Another Claude session sent a message"), as a turn of its own or delivered into a running one. | Type: `'peer'`. |
| `kind` | <Documented /> | A SendMessage delivery from another session, authored by the model and framed as a notification. | Type: `'peer-send-message'`. |
| `kind` | <Documented /> | A delivery that a coordinating session composed for one of its threads. | Type: `'projects-relay'`. |
| `kind` | <Documented /> | A message from a channel that an MCP server relays (Slack, Telegram). | Type: `'channel'`. |
| `server` | <Documented /> | The name of the channel server. | Type: `string`. |
| `kind` | <Documented /> | A hand-off from a coordinating session to a worker session. | Type: `'coordinator'`. |
| `kind` | <Documented /> | A report from a background observer agent to the agent that it observes. | Type: `'observer'`. |
| `kind` | <Documented /> | An activity digest delivered to an observer agent. | Type: `'observer-activity'`. |
| `kind` | <Documented /> | A programmatic follow-up to a UI action of the user. The user started it, but did not type it this turn. | Type: `'auto-continuation'`. |
| `kind` | <Documented /> | A turn with no provenance that the engine can name. It is one that the ingress could not classify, or a command queued with no stamp at all. | Type: `'unclassified'`. An idle notice or a delivery receipt that the engine queued isMeta with no stamp is one too. The engine frames that shape as a non-user source. |
| `kind` | <Documented /> | The owner of the session pinging it from Slack. | Type: `'slack-ping'`. |
| `kind` | <Documented /> | The `$.prompt.submit` of a plugin. | Type: `'plugin'`. The model reads the prompt under the name of the plugin ("The &lt;name> plugin sent a message: ...") unless the plugin submitted it `asUser`. |
| `name` | <Documented /> | The name of the submitting plugin. | Type: `string`. |
| `asUser` | <Documented /> | True when the plugin submitted the text as the own words of the person (`$.prompt.submit({ text, asUser: true })`). | Type: `true`. Optional. The model reads it bare. The origin is still the plugin for every hook and provenance gate. |

### `PromptSectionInput`

The input of `prompt.section`: one named section of the system prompt, at the moment the engine assembles it. From 2.1.302 to 2.1.322, the engine builds shared sections such as `lean_body` without a `prompt.section` call, so a hook does not see them (the program, `chunk-9r1hbf9p.js:2492236`, `TTn`). A `prompt.compose` hook does. Used by `prompt.section`, `$.prompt.section`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Differs note="Docs say every named section; the program skips shared sections such as lean_body." /> | The section's id (`env_info_simple`, `memory`, ...), the same on every model and the one `prompt.compose` lists, the key a matcher narrows on. A `prompt.section` hook sees only sections the engine asks about by name. Shared sections such as `lean_body` are not among them from 2.1.302 to 2.1.322, but `prompt.compose` lists them. | Type: `string`. |
| `text` | <Documented /> | The text of the section as core computed it, or null when core omits it. | Type: `string \| null`. |

### `PromptSectionResult`

What a `prompt.section` hook returns: the text that the prompt carries for that section, or null to leave it out. Used by `prompt.section`, `$.prompt.section`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text that the prompt carries for that section, or `null` to leave it out. | Type: `string \| null`. |
| `breakPromptCache` | <Documented /> | Sends a changed answer at the next turn (new in `2.1.321`). It rewrites the cache from the system prompt on and drops the earlier thinking of the model. | Type: `boolean`. Optional. Left out, a changed answer waits for a new thread or a compaction. The outermost hook's answer says it, so a hook above that keeps it spreads what `next` gave. |

### `PromptSubmitArgs`

The input of `prompt.submit` as the call of a plugin takes it. `PromptSubmitInput` leaves out `origin`, `turnId`, `wait`, `context`, `command` and `isMeta`. The engine sets `origin`, `turnId`, `wait`, `command` and `isMeta`, and the hooks attach `context`. The engine carries over the rest of `PromptSubmitInput` (`text`, `attachments`, and so on). `origin` is the name of the calling plugin and `wait` is false, because the prompt of a plugin runs once the session is idle. Used by `$.prompt.submit`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `asUser` | <Documented /> | Submit the text as the own words of the person. The model reads it bare, without the "The &lt;plugin> plugin sent a message" frame. Absent means framed. | Type: `true`. Optional. The origin that hooks see stays `{ kind: 'plugin', name, asUser: true }`. The engine does not expand `@file` mentions and pasted images for the prompt of a plugin. |

### `PromptSubmitAttachment`

A pasted or attached non-text item of a submitted prompt. It holds the kind of the item, never its bytes. `$.prompt.media` reads the bytes by the `id` of the item.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `type` | <Documented /> | The kind of the item. | Type: `'image' \| 'audio' \| 'document'`. |
| `mediaType` | <Documented /> | The MIME type of the item (`image/png`), when known. | Type: `string`. Optional. |
| `filename` | <Documented /> | The name of the pasted file, when it had one. | Type: `string`. Optional. |
| `id` | <Documented /> | The handle of the engine for the item while this `prompt.submit` is in flight. `$.prompt.media({ id })` reads its bytes, for a mod that managed settings install. | Type: `string`. Optional. Opaque. The engine sets it, as it sets the whole list. Whatever a hook passes down for it, the hooks beneath read the value of the engine. |

### `PromptSubmitCommand`

The slash command that a submission runs, as the engine tells `prompt.submit`. It is the command as the hooks of `command.run` left it, with their change of arguments included. Example: `const typed = { name: 'review', args: 'the diff' } // "/review the diff"`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | Which command, without its slash (`compact`, `hello`), with aliases and folds resolved. It is the `command` of `command.run`. | Type: `string`. |
| `args` | <Documented /> | Everything after the command: what was typed, or what a `command.run` hook left of it. It is `""` when there was nothing. | Type: `string`. |

### `PromptSubmitInput`

The input of `prompt.submit`: the prompt as typed, after the input became a user message and before it enters the session. Used by `prompt.submit`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The text of the prompt as typed, with pastes already expanded. It is what will reach the model, or the line of a slash command as `command.run` left it (`command`). | Type: `string`. |
| `command` | <Documented /> | The slash command that the submission runs (PromptSubmitCommand). The engine sets it. The engine then does not apply a rewrite of `text`, and the person is told. | Type: `PromptSubmitCommand`. Optional. A `{ drop }` stops a skill or prompt command before it renders. Pinned: a changed value fails the hook. |
| `isMeta` | <Documented /> | True on a prompt that the person does not see as typed. The engine sets it. Delivered into a running turn, it takes a rewrite. When it starts a turn, it takes none. | Type: `true`. Optional. Pinned: if left out, it is put back. If changed, it fails the hook. Example: `($, e, next) => (e.isMeta && bad(e) ? { drop: 'no' } : next(masked(e)))`. |
| `attachments` | <Documented /> | Present only when the submission carried images or other non-text items. | Type: `readonly PromptSubmitAttachment[]`. Optional. |
| `context` | <Documented /> | What the model reads beside the prompt and the user never sees. Each entry is one block after the prompt as typed. Absent as the engine raises it. | Type: `readonly string[]`. Optional. A hook attaches blocks on the way down. Past 100,000 characters (200,000 together) the model reads a head and a path. |
| `turnId` | <Documented /> | The id of the model turn that was running when the prompt was submitted (the `turnId` of `turn.start`): typed over that turn, or delivered into it. | Type: `string`. Optional. A queued delivery reaches the model inside a running turn. Absent for a prompt typed while the session was idle. |
| `wait` | <Documented /> | Whether the user asked the prompt to wait its turn (`chat:queueSubmit`, `ctrl+x enter` by default). It is true for that submission, false otherwise. | Type: `boolean`. The engine queues every prompt typed mid-turn. The flag is for hooks. A hook that cancels the running turn can leave a waiting prompt alone. |
| `origin` | <Documented /> | Where the submission came from (PromptOrigin). The engine sets it where it queued the submission: the Enter of the user, a notification, a peer, a plugin. | Type: `PromptOrigin`. `next(e)` passes it on as received. No hook may set one. |

### `PromptSubmitResult`

What a `prompt.submit` hook returns and what `next(e)` resolves to: the prompt that entered, `{ text, context?, origin? }`, or `{ drop: reason }`. `next(e)` resolves once the prompt entered the session, not when the turn ends. Used by `prompt.submit`, `$.prompt.submit`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `text` | <Documented /> | The prompt that entered. From core, it is the text that arrived at the bottom. A rewrite passes it down, `next({ ...e, text })`. | Type: `string`. |
| `context` | <Documented /> | What entered beside the prompt for the model. The user never sees it. From core, it is the context that arrived (`e.context`). | Type: `readonly string[]`. Optional. Each entry is one block after the prompt as typed. The engine does not attach context added after `next` resolved, and logs it. |
| `origin` | <Documented /> | Where the prompt entered from. From core, it is `e.origin` as received. If absent, the prompt is the own prompt of the user. | Type: `PromptOrigin`. Optional. A hook may put back the origin that it received. It may not set another. |
| `drop` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `drop` | <Documented /> | The prompt did not enter. A hook refused it, a settings hook beneath blocked it, or the engine itself did (a Stop stands, or a limit of the host). | Type: `string`. The user sees the text of a hook as the reason. The engine logs its own reason. A drop after `next(e)` was answered fails the hook. |
| `text` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `context` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |
| `origin` | <Documented /> | Never set in this form. | Type: `undefined`. Optional. |

## Related Pages

- [Turn and Prompt Types](index.md)
- [Mod API Types](../index.md)
