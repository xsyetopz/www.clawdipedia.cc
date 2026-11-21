---
title: Version Control
description: The $.vcs noun and the vcs.detect, vcs.diff, vcs.isolate, vcs.list, vcs.status, and vcs.release events, with their types and errors.
sidebar_position: 18
---

`$.vcs` lets a mod work with a version control system, whichever system keeps the folder. Six events cover the life of a working copy. `vcs.detect` says which system keeps a folder. `vcs.diff` says what changed in a copy. `vcs.isolate` makes a copy for a subagent or a session. `vcs.list` lists the copies of a repository. `vcs.status` says what a copy holds. `vcs.release` takes a copy away.

Without a mod, Claude Code answers for Git. A hook can answer for another system, or it can change what Claude Code does for Git. Each call rejects in a session with no disk.[^types] The type file marks the calls and the events as experimental, so they may change.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).

## Example

```javascript
on("vcs.isolate", async ($, e, next) => {
  if (!(await $.fs.exists(`${e.from}/.acme`))) {
    return next(e);
  }
  const argv = ["acme", "copy", "--name", e.name, "--base", e.base];
  const made = await $.process.run(argv, { cwd: e.from });
  if (made.exitCode !== 0) {
    return { deny: made.stderr };
  }
  const [path, revision] = made.stdout.trim().split("\n");
  return { path, vcs: "acme", revision };
});
```

The example comes from the type file.[^types] `next(e)` makes the copy as Claude Code would without the hook.

## Members

Every call checks its input first. A call that Claude Code cannot serve raises `${…}: $.vcs.<name> is not available in this mode`.[^calls-gate] A call also asks the `tool.check` hooks for permission: `fs.list` on its folder, and the answer is `{ deny }`, `[]`, `{ kept }`, or `{ unknown }` (as the call says) with the text `this folder may not be read` when a hook refuses.[^calls-gate]

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.vcs.detect` | <Documented /> | Returns the working copy a folder is in. It is the event `vcs.detect`. `null` means the folder is in none. | `(input: VcsDetectInput) => Promise<VcsDetectResult>`. `path` can be any file's path. Claude Code uses the nearest folder that exists above it. The call is asked anew each time, through the other hooks, and it skips the calling hook. A relative `path` is under the working directory. It rejects where the session's files are on another machine, and for a network location.[^detect-call] | Run time. |
| `$.vcs.diff` | <Documented /> | Returns what changed in a working copy. It is the event `vcs.diff`. `{ unknown }` means that no hook can say. | `(input: VcsDiffInput) => Promise<VcsDiffResult>`. The call takes a folder, is asked anew each time, and is refused where `$.vcs.detect` is.[^diff-call] | Run time. |
| `$.vcs.isolate` | <Documented /> | Asks the hooks to isolate a folder. It is the event `vcs.isolate`. Nothing moves into the copy. | `(input: VcsIsolateInput) => Promise<VcsIsolateResult>`. Below the hooks, Claude Code makes a Git worktree, and it answers the same one when this mod asks again under the name. It answers `{ deny }` outside Git and before workspace trust is accepted. It also answers `{ deny }` where a managed rule would refuse the mod's own run of `git worktree add` or `git fetch`, where Git fails, and for a name that is taken, has the form of an agent's name, or has a part that begins with `-`. A `from` that a managed rule keeps this mod from listing is denied before the hooks.[^isolate-call] | Run time. |
| `$.vcs.list` | <Documented /> | Lists the working copies of the repository that holds `path`. It is the event `vcs.list`. | `(input: VcsListInput) => Promise<VcsListResult>`. Claude Code answers Git's worktrees for the repository the session is in, once the person trusts it, and none for any other. The call takes a folder and is refused where `$.vcs.detect` is. Claude Code raises `process.run` of `git worktree list` as the caller, with no output, and `fs.list` on `path` and on each worktree. It answers none where the first is refused, and it names only the copies that the second read.[^list-call] | Run time. |
| `$.vcs.release` | <Documented /> | Asks the hooks to take a working copy away. It is the event `vcs.release`. | `(input: VcsReleaseInput) => Promise<VcsReleaseResult>`. Claude Code removes only a worktree that it made on this mod's own `$.vcs.isolate` in this process, with its branch. It answers `{ kept }` for any other folder, for a folder in use, and, without `isDiscard`, for a folder that holds work. It answers the same where a managed rule would refuse the mod's own run of `git worktree remove --force` or `git branch -D`, or its `$.fs.list` of the folder.[^release-call] | Run time. |
| `$.vcs.status` | <Documented /> | Asks what a working copy holds. It is the event `vcs.status`. | `(input: VcsStatusInput) => Promise<VcsStatusResult>`. Claude Code answers for the trusted workspace's Git repository, its worktrees, and this mod's own copies. For any other folder it answers `{ unknown }`. It reads the whole copy, with paths from its top, and writes nothing. `unpublished` counts from where a copy that Claude Code made began, else from `since`, else the commits that no remote-tracking branch holds. The answer is `{ unknown }` where a managed rule would refuse the mod's own run of `git status`, or its `$.fs.list` of a changed path or of the folder.[^status-call] | Run time. |

## Engine Events

A hook for `vcs.status` or `vcs.release` can use a matcher on `vcs`. It then hears only the copies of that system. A hook for `vcs.isolate` can use `{ for: "agent" }` or `{ for: "session" }`.[^types] A hook that fails passes the call through, or is skipped, as each row says.

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `vcs.detect` | <Documented /> | Fires when Claude Code asks which version control system a folder uses. | Input `VcsDetectInput`. Result `VcsWorkingCopy` or `null`. `next(e)` resolves to the working copy beneath. Claude Code asks for a conversation's first request, after a compaction, and when the loop's own folder changes. Core answers Git. Copies nest: answer where your copy is as near as the one beneath or nearer, else return the one beneath. The `root` that a hook answers must answer as itself at `detect` of that `root`, and every copy of one repository answers the same `mainRoot`. A system other than Git puts its name and branch in the environment block, drops the Git status block, and, for the session, drops the commit and pull-request steps of the shell tools. Git's safety cautions stay. Trust, settings, memory, permissions, and the sandbox never read it. A hook that fails passes the call through. It is not raised where the session's files are on another machine.[^detect-event] | `on('vcs.detect', ...)`. Also `$.vcs.detect(...)`. |
| `vcs.diff` | <Documented /> | Fires when a mod asks what changed in a working copy, as `/diff` does where `vcs.detect` names a system other than Git. | Input `VcsDiffInput`. Result `VcsDiffResult`. Match the hook on `vcs`. Core answers `{ unknown: null }`, and `/diff` then looks for Git. A hook's own reason shows instead. Git is not served here yet: `/diff` reads it itself. A hook that fails passes the call through. It is not raised where the session's files are on another machine.[^diff-event] | `on('vcs.diff', ...)`. Also `$.vcs.diff(...)`. |
| `vcs.isolate` | <Documented /> | Fires when a working copy is needed, before anything is made. | Input `VcsIsolateInput`. Result `VcsIsolateResult`. Claude Code raises it for a subagent that runs with `isolation: "worktree"` (the Agent tool, a workflow's `agent()`). It raises it for a session through EnterWorktree, the `--worktree` flag, a Remote Control spawn in a worktree, or an app that is about to open one. No hook hears a review reference (`--worktree "#123"`, a URL), a sub-folder that Remote Control picked, or a `name` with a part that starts with a dash.[^isolate-event] | `on('vcs.isolate', ...)`. Also `$.vcs.isolate(...)`. |
| `vcs.list` | <Documented /> | Fires when Claude Code asks for the working copies of the repository that holds `path`. | Input `VcsListInput`. Result `VcsListResult`. Claude Code asks when EnterWorktree is to enter a copy by its path, when a mod calls `$.vcs.list`, and when a session that a mod's copy recorded resumes after a restart. `next(e)` answers Git's worktrees, the main one among them, or none. A hook that fails is skipped.[^list-event] | `on('vcs.list', ...)`. Also `$.vcs.list(...)`. |
| `vcs.status` | <Documented /> | Fires when Claude Code asks what changed in a working copy and what removing it would lose. | Input `VcsStatusInput`. Result `VcsStatusResult`. Claude Code asks when the subagent or the Remote Control session that worked there ends, when ExitWorktree is to remove the session's copy, and when the session exits inside it. `next(e)` answers for a copy that Claude Code made, and `{ unknown }` for any other. A hook can keep a worktree that Claude Code made, but it cannot call it clean where Claude Code finds work there.[^status-event] | `on('vcs.status', ...)`. Also `$.vcs.status(...)`. |
| `vcs.release` | <Documented /> | Fires when Claude Code would take a working copy away: it read clean with nothing unpublished, or the person chose to discard what it holds (`isDiscard`). | Input `VcsReleaseInput`. Result `VcsReleaseResult`. Claude Code raises it at the end of a subagent or a Remote Control session, and from ExitWorktree and the exit dialog. `next(e)` removes a copy that Claude Code made and answers `{ kept }` for any other. A copy that a mod made goes only by a hook's own hand, and it is kept where no mod hooks this.[^release-event] | `on('vcs.release', ...)`. Also `$.vcs.release(...)`. |

## How a Hook Makes a Copy

`next(e)` on `vcs.isolate` makes the copy as Claude Code would without the hook: a `WorktreeCreate` hook where one is set, else a Git worktree. On a mod's own `$.vcs.isolate` call, `next(e)` makes a Git worktree for that mod, in a trusted workspace only, and runs no `WorktreeCreate` hook. Answer `{ path, vcs }` instead and the copy is the mod's. Claude Code checks the folder, runs no version control there, and asks `vcs.status` and `vcs.release` about it. `{ deny }` refuses the copy.[^isolate-event]

A module that answered the classic `WorktreeCreate` event with `worktreePath` should answer `vcs.isolate` instead. The type file marks `worktreePath` as deprecated for a module, and the old answer still works.[^types]

Claude Code can ask again for a name that it already made, by `--worktree <name>` and by a resume. It relies on these rules:

- `vcs.isolate` twice with one name is the same copy.
- A fresh copy's `vcs.status` is empty and answers the same `revision`.
- `vcs.release` right after `vcs.isolate` changes nothing that `from` can observe.
- Releasing a copy that is already gone counts as released.

Where a second folder costs too much, answer `path: e.from`. The agent is then isolated in place. It runs in its parent's folder, under the parent's fences and guards. This gives no file isolation, and Claude Code removes, locks, and sweeps nothing there. Answer `vcs.status` and `vcs.release` for that work alone. At launch and at a spawn no session is bound, so some `$` calls reject.[^isolate-event]

`vcs.isolate` can be asked for the setting `worktree.baseRef`, which the event gives as `base`: `fresh` or `head`.[^base-ref]

## Types

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `VcsChange` | <Documented /> | One uncommitted change in a working copy. | `path` (relative to the copy's folder, parts joined by `/`) and `state`: `'modified'`, `'added'`, `'deleted'`, `'untracked'`, or `'conflict'`. A rename is `deleted` plus `added`. |
| `VcsDetectInput` | <Documented /> | The input of `vcs.detect`. | `path`: the folder, absolute. It is pinned, so no hook passes another one down. |
| `VcsDetectResult` | <Documented /> | What a `vcs.detect` hook returns. | `VcsWorkingCopy \| null`. |
| `VcsDiffFile` | <Documented /> | One changed file of a `vcs.diff` answer. | `path` (relative to the copy's `root`, with `/`, listed once), `renamedFrom` (`string \| null`), `added`, `removed` (lines; 0 where they are not counted), `isBinary`, `isUntracked`, `patch?` (unified hunks from the first `@@`, with no file headers). Each name is at most 4096 characters. |
| `VcsDiffInput` | <Documented /> | The input of `vcs.diff`. Every key is pinned. | `path` (a folder of the copy, absolute), `vcs` (the system `vcs.detect` names there), `base` (`'head'`: what is checked out, or `'default'`: where this work left the mainline), `paths?` (files or folders to keep, relative to `root`; absent means the whole copy and empty means none), `isStatOnly?` (`true` leaves every `patch` out). |
| `VcsDiffResult` | <Documented /> | What a `vcs.diff` hook returns. | `{ base, files }`, where `base` is a label for what the files were compared with, or `{ unknown }` with the reason. A null `unknown` is core's: no hook answered. |
| `VcsIsolateInput` | <Documented /> | The input of `vcs.isolate`. Every field is pinned. | `name` (letters, digits, `.`, `_`, and `-`, in parts joined by `/`), `from` (the folder the copy is made from, absolute), `for` (`'agent'` or `'session'`), `agentId?`, `parentAgentId?` (what a hook passes to `$.agent.call` to run a tool as that loop), `base` (`'fresh'` or `'head'`). |
| `VcsIsolateResult` | <Documented /> | What a `vcs.isolate` hook returns and what `next(e)` resolves to. | `{ path, vcs, branch?, revision? }`, or `{ deny }`. `path` is absolute, is already there, has no `.` or `..` part, is no link itself, is on no network share, and is no folder that holds `from`. A folder with no `.git` is refused inside a Git checkout. `from` itself isolates in place, for an agent only. `vcs` is a short lowercase slug, and it grants nothing. `branch` is shown only where it is one token of 1 to 100 ASCII letters, digits, and `._/@#:+-`. `revision` is opaque to Claude Code. It hands it back as `since`. After a `next(e)` that answered with a copy, another `path` or a deny fails the hook and that copy stands. |
| `VcsListedCopy` | <Documented /> | One working copy that `vcs.list` answers. | `path` (absolute), `vcs`, `branch?`. A copy whose path holds `<`, `>`, or a character that does not print is left off the list. |
| `VcsListInput` | <Documented /> | The input of `vcs.list`. | `path`: a folder of the repository, absolute and pinned. |
| `VcsListResult` | <Documented /> | What a `vcs.list` hook returns. | `readonly VcsListedCopy[]`, possibly empty. |
| `VcsReleaseInput` | <Documented /> | The input of `vcs.release`. Every field is pinned. | `path` (absolute; from Claude Code its links are resolved, so know a copy by `name`), `name`, `vcs`, `agentId?`, `isDiscard` (`true` where the person chose to lose what the copy holds), `reason` (plain words, for example "the subagent ended"). |
| `VcsReleaseResult` | <Documented /> | What a `vcs.release` hook returns and what `next(e)` resolves to. | `{ isReleased: true, note? }`, or `{ kept }` with the reason. `note` is one short line about how to get discarded work back. ExitWorktree and the exit message show it. A hook's `isReleased` counts only where the folder is gone or empty, or this process isolated that `name` in place there. |
| `VcsStatusInput` | <Documented /> | The input of `vcs.status`. Every field is pinned. | `path` (absolute), `name?` (absent: the whole copy at `path`), `vcs?`, `since?` (the `revision` that `vcs.isolate` answered), `agentId?`. |
| `VcsStatusResult` | <Documented /> | What a `vcs.status` hook returns and what `next(e)` resolves to. | `{ changes, unpublished, revision? }`, or `{ unknown }` with the reason, which keeps the copy. `unpublished` is how many revisions removing the copy would lose. A `revision` that differs from `since` says that work was made here and is safe elsewhere. |
| `VcsWorkingCopy` | <Documented /> | One working copy, as `vcs.detect` answers it. | `vcs` (a short lowercase slug; core says `git`), `root` (absolute), `mainRoot` (`string \| null`), `revision`, `branch`, `defaultBranch`, `remote` (each `string \| null`). Any slug but `git` and core's own for the folder drops the Git status block and the commit steps. It carries no other privilege. Claude Code takes off whatever may be a credential from `remote`. |

## Errors

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `A vcs.isolate hook refused to make a copy:` | <Undocumented /> | A `vcs.isolate` hook answered `{ deny }`, and Claude Code made no copy. The text ends with the reason, kept to its first 300 and last 100 characters. | The spawn or the tool shows it as its error. If `next(e)` had already failed, the error of that failure shows instead.[^err-refused] |
| `Cannot use the ${…} hook's folder: ${…} may lead to a network location.` | <Undocumented /> | A hook answered a folder that may lead to a network location. | The folder is refused for any hook except `WorktreeCreate`.[^err-network] A mod's own `$.vcs.isolate` for such a `from` answers `{ deny }` with `${…} may lead to a network location`. `$.vcs.status` answers `{ unknown }` for such a folder.[^err-network-own] |
| `Cannot use the ${…} hook's folder: its path holds an angle bracket or a character that does not print.` | <Undocumented /> | The folder that a hook answered has `<`, `>`, or a character that does not print. | Claude Code checks the folder first, so no other check runs.[^err-bracket] |
| `Cannot use the vcs.isolate hook's folder: ${…} could not be pinned down (${…}).` | <Undocumented /> | Claude Code could not resolve the folder that a `vcs.isolate` hook answered to one real path. | The text ends with the reason in parentheses.[^err-pinned] |
| `${…} is, or holds, ${…}, which the copy was to stand apart from.` | <Undocumented /> | The folder that a hook answered is, or holds, the folder the copy is made from or the folder that Claude Code started in. | The first `${…}` is the folder of the hook with its prefix `Cannot use the ${…} hook's folder:`. The copy must stand apart from both folders.[^err-apart] |
| `Worktree mode needs a git repository, WorktreeCreate hooks or a mod, and the mod installed here is not loaded.` | <Undocumented /> | A Remote Control worktree spawn mode found no git repository and no `WorktreeCreate` hook in its folder, and the mod that could hook `vcs.isolate` is not loaded here. | The runner checks the three before it starts. When the check is certain that none holds, the text is `Worktree mode needs a git repository or WorktreeCreate hooks. Directory ${…} has neither.`[^err-mode] |
| `no WorktreeCreate hook is enabled` | <Undocumented /> | In the worktree request of an app, a mod hooks `vcs.isolate` and its `next(e)` can only use a `WorktreeCreate` hook, and none is enabled. | `next(e)` denies with this text. The program reads it as "not configured" for that request.[^err-no-hook] |
| `${…} is not an absolute path.` | <Undocumented /> | The folder that a hook answered is not an absolute path. | The first `${…}` is the folder of the hook with its prefix `Cannot use the ${…} hook's folder:`. Claude Code checks it after the angle bracket check.[^err-absolute] |
| `The name ${…} is another worktree's or branch's, or has the form of an agent's` | <Undocumented /> | A mod called `$.vcs.isolate` with a `name` that Claude Code cannot use for a new copy. | The call answers `{ deny }` with this text.[^err-name] |
| `The folder is not in a Git repository` | <Undocumented /> | A mod called `$.vcs.isolate` for a `from` that is in no Git repository. | The call answers `{ deny }` with this text.[^err-no-git] |
| `Workspace trust is not accepted there` | <Undocumented /> | A mod called `$.vcs.isolate` for a `from` in a folder where the person has not accepted workspace trust. | The call answers `{ deny }` with this text.[^err-trust] |
| `this mod may not run Git here` | <Undocumented /> | A managed rule keeps the mod from running `git worktree add` or `git fetch` for `$.vcs.isolate`. | The call answers `{ deny }` with this text. `$.vcs.release` answers `{ kept }` with it where a managed rule keeps the mod from running Git.[^err-no-git-run] |

## Related Pages

- [Mod API Overview](../index.md)
- [Hooks, `on`, and `next`](../events/hooks.md)
- [Agent](agent.md)
- [Session](session.md)
- [Classic Event Types](../types/classic/index.md)

## Sources

[^types]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-0yef3dc4.js:6`, published as `schemas/claude-code.d.ts`, `$.vcs`, the `vcs.*` entries of `EventOf` and `ResultOf`, `VcsChange`, `VcsDetectInput`, `VcsDetectResult`, `VcsDiffFile`, `VcsDiffInput`, `VcsDiffResult`, `VcsIsolateInput`, `VcsIsolateResult`, `VcsListedCopy`, `VcsListInput`, `VcsListResult`, `VcsReleaseInput`, `VcsReleaseResult`, `VcsStatusInput`, `VcsStatusResult`, and `VcsWorkingCopy`.
[^calls-gate]: The program, `chunk-bzyb60p0.js:217284` (`is not available in this mode`) and `chunk-bzyb60p0.js:217305` (the `fs.list` check and `this folder may not be read`).
[^detect-call]: The program, `chunk-bzyb60p0.js:217161` (`the session's files are on another machine`), `chunk-bzyb60p0.js:217163` (the network location test), and `chunk-bzyb60p0.js:217151` (the nearest folder that exists). The text `a network location is not reached from here` is at `chunk-bzyb60p0.js:195325`.
[^diff-call]: The program, `$4d53d7` at `chunk-bzyb60p0.js:217173` (the check, which first runs the check of `vcs.detect`) and `chunk-bzyb60p0.js:217192` (the hooks of `vcs.diff`).
[^isolate-call]: The program, `chunk-bzyb60p0.js:217309` (the input check) and `chunk-2p0e1k2g.js:959` (`may lead to a network location`) with `chunk-2p0e1k2g.js:961` (the dash rule). The type file `schemas/claude-code.d.ts`, `$.vcs.isolate`, holds the other denials.
[^list-call]: The program, `chunk-bzyb60p0.js:217330` (the call), `chunk-bzyb60p0.js:217350` (`git worktree list` through `process.run`), and `chunk-bzyb60p0.js:217347` (`fs.list`).
[^release-call]: The program, `chunk-bzyb60p0.js:217359` (the input check). The type file `schemas/claude-code.d.ts`, `$.vcs.release`, holds the rules for what Claude Code removes.
[^status-call]: The program, `chunk-bzyb60p0.js:217377` (the input check) and `chunk-2p0e1k2g.js:928` (`this folder may lead to a network location`). The type file `schemas/claude-code.d.ts`, `$.vcs.status`, holds the rest.
[^detect-event]: The program, `chunk-bzyb60p0.js:8687` (the event `vcs.detect`). The type file `schemas/claude-code.d.ts`, `vcs.detect`, holds the rules.
[^diff-event]: The program, `chunk-bzyb60p0.js:8688` (the event `vcs.diff`). The type file `schemas/claude-code.d.ts`, `vcs.diff`, holds the rules.
[^isolate-event]: The program, `chunk-bzyb60p0.js:8689` (the event `vcs.isolate`) and `chunk-bzyb60p0.js:93163` (the hook is asked first, and Claude Code makes the copy itself when none is). The type file `schemas/claude-code.d.ts`, `vcs.isolate`, holds the callers and the rules.
[^list-event]: The program, `chunk-bzyb60p0.js:8690` (the event `vcs.list`) and `chunk-bzyb60p0.js:93170` (the hook is asked). The type file `schemas/claude-code.d.ts`, `vcs.list`, holds the callers.
[^status-event]: The program, `chunk-bzyb60p0.js:8691` (the event `vcs.status`) and `chunk-bzyb60p0.js:93184` (the hook is asked). The type file `schemas/claude-code.d.ts`, `vcs.status`, holds the callers.
[^release-event]: The program, `chunk-bzyb60p0.js:8692` (the event `vcs.release`) and `chunk-bzyb60p0.js:93227` (the hook is asked). The type file `schemas/claude-code.d.ts`, `vcs.release`, holds the callers.
[^base-ref]: The program, `chunk-bzyb60p0.js:93159` (`worktree.baseRef`, `fresh` by default).
[^err-refused]: The program, `chunk-2p0e1k2g.js:477` (the text) and `chunk-2p0e1k2g.js:474` (the failure of `next(e)` shows its own error).
[^err-network]: The program, `chunk-bzyb60p0.js:97648`.
[^err-network-own]: The program, `chunk-2p0e1k2g.js:959` (`isolate`) and `chunk-2p0e1k2g.js:928` (`status`).
[^err-bracket]: The program, `chunk-2p0e1k2g.js:359`.
[^err-pinned]: The program, `chunk-2p0e1k2g.js:416`.
[^err-apart]: The program, `chunk-2p0e1k2g.js:372`.
[^err-mode]: The program, `chunk-jy29ybqd.js:7833`.
[^err-no-hook]: The program, `chunk-4m3xfy89.js:692` (the text) and `chunk-4m3xfy89.js:706` (the outcome `not_configured`).
[^err-absolute]: The program, `chunk-2p0e1k2g.js:362`.
[^err-name]: The program, `chunk-2p0e1k2g.js:857` (the text) and `chunk-2p0e1k2g.js:969` (`{ deny }`).
[^err-no-git]: The program, `chunk-2p0e1k2g.js:885` (the text).
[^err-trust]: The program, `chunk-2p0e1k2g.js:887` (the text).
[^err-no-git-run]: The program, `chunk-2p0e1k2g.js:764` (the text) and `chunk-2p0e1k2g.js:892` (`git worktree add` and `git fetch`), and `chunk-2p0e1k2g.js:946` (`{ kept }`).
