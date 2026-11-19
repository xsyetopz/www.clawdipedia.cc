---
title: Files, Store, and State
description: The $.fs, $.store, and $.state nouns, the state helpers you import from claude-code, and the events these calls raise.
sidebar_position: 13
---

Use these nouns to keep data. `$.fs` reads and writes files as the Claude Code process. `$.store` keeps values of the plugin between sessions. `$.state` holds named values with versions during a session. When a state value changes, the engine draws again each render hook that reads it.

There is no switch to turn them on. A file is at most 4 MiB. `$.store` holds at most 4 MiB of JSON. `$.fs` uses the real file system. `$.store` and `$.state` belong to the plugin.

Official pages: [Draw in the Interface](https://code.claude.com/docs/en/plugins/mods/interface) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types]

"Run time" in a "Where it can be used" cell means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

```javascript
on("turn.complete", async ($, e, next) => {
  const count = Number((await $.store.get("count")) ?? 0) + 1;
  await $.store.set("count", count);
  return next(e);
});
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.fs.read` | <Documented /> | Reads a file and returns its text. With `{ as: "bytes" }` it returns the bytes as `{ base64 }`. | Four call forms. Rejects when the file is missing or the answer is over 4 MiB. `options.as` is `"text"` (default) or `"bytes"`. `options.offset` (bytes from the start, 0 by default) and `options.length` (at most 4 MiB) read a range of bytes of a file; a range on a pipe, a socket, a device, or a directory rejects. A text range that cuts a character gives U+FFFD at that edge.[^types][^fs-range] | Run time. |
| `$.fs.write` | <Documented /> | Writes `text` to a file, creating it and its directories as needed. | `(path, text) => Promise<void>`. `path` is relative to the working directory, or absolute. `text` is the whole new content. | Run time. |
| `$.fs.list` | <Documented /> | Lists a directory: `{ name, kind, size, mtimeMs, isLink }` for each entry. | `(path?) => Promise<FsEntry[]>`. A symbolic link is `other` with `isLink`. | Run time. |
| `$.fs.exists` | <Documented /> | Returns whether the path exists. | `(path) => Promise<boolean>`. Rejects only for a network location. | Run time. |
| `$.fs.stat` | <Documented /> | Returns `{ kind, size, mtimeMs, isLink }` of the path. Rejects when missing. | `(path, options?) => Promise<FsStat>`. With `{ resolve: true }` it also gives `realPath`. A missing path rejects with `ENOENT`. | Run time. |
| `$.fs.ancestors` | <Documented /> | Reads the named instruction files in every directory above the session's first working directory, the way the engine reads CLAUDE.md. | `(request) => Promise<readonly FsAncestor[]>`. Returns the `.md` files on the path from the root to a file, root first. | Run time. |
| `$.store.get` | <Documented /> | Returns the value under `key`, or `undefined` when unset. | `(key) => Promise<unknown>`. | Run time. |
| `$.store.set` | <Documented /> | Sets `key` to `value`, which must be JSON data. | `(key, value) => Promise<void>`. Rejects a function, a cycle, or a store over 4 MiB. | Run time. |
| `$.store.delete` | <Documented /> | Removes `key`. | `(key) => Promise<void>`. | Run time. |
| `$.store.keys` | <Documented /> | Returns every key set, in insertion order. | `() => Promise<string[]>`. | Run time. |
| `$.state.get` | <Documented /> | Resolves the value under `ref` and its version. A value never written is `undefined` at version 0. | `(ref) => Promise<StateRead>`. `plugin` and `key` must be literals in the source. Resolves `{ value, version }`. | Run time. |
| `$.state.set` | <Documented /> | Writes `value` under `ref`, which must be this plugin's own. The engine draws again the sites that read it while drawing, at the redraw rate. | `(ref, value, options?) => Promise<StateSetResult>`. `ifVersion` writes only at that version. Resolves `{ isSet, version }`. | Not while a `ui.render` hook draws. |

## State Helpers Imported From `claude-code`

These helpers are pure code. They run in the plugin's own environment.

| Item | Status | What it does | How it works |
| --- | --- | --- | --- |
| `atom` | <Documented /> | A named value with an initial value. `read` gives the initial value until code writes a value, so never `undefined`. | Type `AtomFunction`. |
| `derive` | <Documented /> | A value computed from atoms and references, cached by their versions. | Type `DeriveFunction`. Example: `derive([workers], list => list.filter(w => w.isBusy).length)`. |
| `memberOf` | <Documented /> | A family's member for the instance being drawn, keyed by `e.requestId`. | Type `MemberOfFunction`. Example: `await read($, memberOf(isOpen, e))`. |
| `read` | <Documented /> | Reads an atom, a derived value, or a reference through `$.state.get` while a `ui.render` hook draws. That subscribes the drawing. | Type `ReadFunction`. Example: `await read($, count)`. |
| `update` | <Documented /> | Reads, applies `fn`, writes with `ifVersion`, and tries again on a miss. A handler closure calls it. | Type `UpdateFunction`. Example: `<Button key="more" onPress={() => update($, count, n => n + 1)} />`. |

## Events Raised by These Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `fs.read` | <Documented /> | `$.fs.read(path, { as })`. `as` is `text` unless the caller asked for `bytes`. | Input `{ path: string, as: FsReadAs, offset?: number, length?: number }`. Value `string \| FsBytes`. |
| `fs.write` | <Documented /> | `$.fs.write(path, text)` | Input `{ path: string, text: string }`. Value `void`. |
| `fs.list` | <Documented /> | `$.fs.list(path)` | Input `{ path: string }`. Value `FsEntry[]`. |
| `fs.exists` | <Documented /> | `$.fs.exists(path)` | Input `{ path: string }`. Value `boolean`. |
| `fs.stat` | <Documented /> | `$.fs.stat(path, { resolve })`. `resolve` is false unless asked. | Input `{ path: string, resolve: boolean }`. Value `FsStat`. |
| `fs.ancestors` | <Documented /> | `$.fs.ancestors({ names, of, below })` | Input `FsAncestorsRequest`. Value `readonly FsAncestor[]`. |
| `store.get` | <Documented /> | `$.store.get(key)` | Input `{ key: string }`. Value `unknown`. |
| `store.set` | <Documented /> | `$.store.set(key, value)` | Input `{ key: string, value: unknown }`. Value `void`. |
| `store.delete` | <Documented /> | `$.store.delete(key)` | Input `{ key: string }`. Value `void`. |
| `store.keys` | <Documented /> | `$.store.keys()` | Input `NoArgs`. Value `string[]`. |
| `state.get` | <Documented /> | `$.state.get(ref)`: the reference itself (`plugin`, `key`, and a family member's `id`). Pinned. | Input `StateGetEvent`. Value `StateRead`. |
| `state.set` | <Documented /> | `$.state.set(ref, value, { ifVersion })` plus `previous`, what stood there. | Input `StateSetEvent`. Value `StateSetResult`. Only the value's owner raises it. |

## Related Pages

- [Mod API Overview](../index.md)
- [Clock, HTTP, Process, Env, and Settings](clock-http-process-env-settings.md)
- [Files, State, Clock, HTTP, Process, and Settings Types](../types/infra/index.md) (shapes of `FsEntry`, `FsStat`, `StateRef`, and more)

## Sources

[^fs-range]: The program, `chunk-syremzmn.js:298467` (the mod side sends `offset` and `length`), `chunk-56bhcxay.js:4567234` (the host passes them on), `chunk-56bhcxay.js:4564236` (the range read, its refusal of a pipe, socket, device or directory, and its UTF-8 decode), and `chunk-yg8ff21f.js:229` (the 4194304-byte limit).

[^types]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, published as `schemas/claude-code.d.ts`, `FsReadCall`, `FsReadOptions`, `FsEntry`, `FsStat`, `FsAncestor`, `FsAncestorsRequest`, `StateRead`, `StateSetResult`, `AtomFunction`, `DeriveFunction`, `MemberOfFunction`, `ReadFunction`, `UpdateFunction`, and the `fs.*`, `store.*`, and `state.*` entries of `EventOf` and `ResultOf`.
