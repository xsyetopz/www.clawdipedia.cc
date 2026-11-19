---
title: Process, Settings, State, and Timer Types
description: "Types of process runs and spawns, settings reads, sleep options, state addresses, reads, and writes, and timers."
sidebar_position: 2
---

These types describe the `$.process` calls, settings reads, sleep options, the `$.state` calls, and timers. Use them to type the input and result of these calls in your mod.

## Types with Fields

Each type below has its own table of fields.

### `ProcessRunInit`

Options of `$.process.run`. Object with fields `cwd?`, `env?`, `stdin?`, `timeoutMs?`. Used by `$.process.run`, `process.run`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `cwd` | <Documented /> | The working directory of the child, relative to the working directory of the session, or absolute. If absent, it is the working directory of the session. | Type: `string`. Optional. |
| `env` | <Documented /> | Variables set over the environment of the host process. | Type: `Record<string, string>`. Optional. |
| `stdin` | <Documented /> | Text written to the standard input of the child, then closed. | Type: `string`. Optional. |
| `timeoutMs` | <Documented /> | How long the child may run before the engine kills it and the call rejects, in milliseconds. It is 30 seconds when absent, and ten minutes at most. | Type: `number`. Optional. |

### `ProcessRunResult`

What `$.process.run` resolves with once the child has exited. Object with fields `exitCode`, `stdout`, `stderr`, `isStdoutTruncated`, `isStderrTruncated`. Example: `const { stdout } = await $.process.run(["git", "log"])`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `exitCode` | <Documented /> | The exit status of the child. A child that a signal ended reads as 1. | Type: `number`. |
| `stdout` | <Documented /> | What the child wrote to standard output, as text: its first 4194304 bytes (4 MiB). The engine reads and drops the rest (`isStdoutTruncated`). | Type: `string`. The limit counts bytes, not characters, and applies to standard output alone: standard error has the same limit again. A cut inside a multi-byte character drops that character. |
| `stderr` | <Documented /> | What the child wrote to standard error, as text: its first 4194304 bytes (4 MiB). The engine reads and drops the rest (`isStderrTruncated`). | Type: `string`. |
| `isStdoutTruncated` | <Documented /> | True when the child wrote more than 4194304 bytes to standard output and `stdout` is only the first of them. False when `stdout` is whole. | Type: `boolean`. |
| `isStderrTruncated` | <Documented /> | True when the child wrote more than 4194304 bytes to standard error and `stderr` is only the first of them. False when `stderr` is whole. | Type: `boolean`. |

### `ProcessSpawnChunk`

One piece of the output of a spawned child as `$.process.spawn` streams it: which pipe it came from, and the text. Object with the fields `stream`, `text`. The engine decodes the text as UTF-8 as it arrived. A line may span two pieces. The engine never splits a multi-byte character. Used by `$.process.spawn`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `stream` | <Documented /> | The pipe the text came from. | Type: `'stdout' \| 'stderr'`. |
| `text` | <Documented /> | What the child wrote, decoded, never empty, and never cut. | Type: `string`. Nothing of the stream is dropped: once 1048576 characters wait unread, the child blocks on its next write until the loop pulls. |

### `ProcessSpawnRequest`

The argument of `$.process.spawn(request)`, and the `e` that its hooks see: the command by its argument vector and how the child starts. Object with fields `argv`, `cwd?`, `env?`, `input?`. It follows the rules of `$.process.run`: no shell, the session's working directory by default, and the host's environment with `env` over it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `argv` | <Documented /> | The command and its arguments, with `argv[0]` the executable. | Type: `readonly string[]`. |
| `cwd` | <Documented /> | The working directory of the child, relative to the working directory of the session, or absolute. If absent, it is the working directory of the session. | Type: `string`. Optional. |
| `env` | <Documented /> | Variables set over the environment of the host process. | Type: `Record<string, string>`. Optional. |
| `input` | <Documented /> | Text written to the standard input of the child, which is then closed. If absent, standard input is closed from the start. | Type: `string`. Optional. A string today. A later form may take the text in pieces. |

### `ProcessSpawnResult`

How a spawned child ended, as the stream of `$.process.spawn` returns it once every piece is read: its exit code, or the signal that did it. Object with fields `code`, `signal`. Used by `$.process.spawn`, `process.spawn`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `code` | <Documented /> | The exit status of the child. It is null when a signal ended it. | Type: `number \| null`. |
| `signal` | <Documented /> | What ended the child from outside (`SIGTERM`), It is null when the child exited by itself. On Windows a killed child reads as an exit code, and this is null. | Type: `string \| null`. |

### `SettingsReadArgs`

What `$.settings.read(args)` takes. Object with fields `source?`. Used by `$.settings.read`, `settings.read`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `source` | <Documented /> | The one source to read, as loaded. If absent, the settings merged over every source, as the engine runs under them. | Type: `SettingsSource`. Optional. |

### `SleepOptions`

Options of `$.clock.sleep`. Object with fields `signal?`. Used by `$.clock.sleep`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `signal` | <Documented /> | Aborting it rejects the sleep at once. | Type: `AbortSignal`. Optional. |

### `StateAddress`

Which named value a `$.state` call is about, as it crosses to the host: the owning plugin, the key, and the `id` of a family member. Object with fields `plugin`, `key`, `id?`. The untyped form of a StateRef, identity, pinned on every `next`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | The plugin that owns the value. | Type: `string`. |
| `key` | <Documented /> | The key of the value in that plugin. | Type: `string`. |
| `id` | <Documented /> | The member of a family, when the key is a `StateFamily`. | Type: `string`. Optional. |

### `StateFamily`

A key of PluginState that holds one value of type `T` for each `id` (one for each drawn row or worker). Its reference must carry `id: string`. Object with the field `byId`. It is only a marker in the registry. `$.state.get` on a member answers `T`. Example: `interface PluginState { notes: { isOpen: StateFamily<boolean> } }`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `byId` | <Documented /> | The type of the value held for each `id`. A marker only: no value has this shape. | Type: `T`. Read-only. |

### `StateName`

Which named value: the plugin that owns it and its key there, both literals where a contract declares the value. Generic alias of `{ readonly plugin: P, readonly key: K, }`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | The plugin that owns the value. | Type: `P`. Read-only. |
| `key` | <Documented /> | The key of the value in that plugin. | Type: `K`. Read-only. |

### `StateRead`

What `$.state.get` answers: the value and the version it stands at. A value never written is `undefined` at version 0. Generic alias of `{ value: T \| undefined, version: number, }`. The version goes up by one on every write that lands. Hand it back as `ifVersion` to write only if nobody wrote in between. Used by `$.state.get`, `state.get`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `value` | <Documented /> | The value, or `undefined` if it was never written. | Type: `T \| undefined`. |
| `version` | <Documented /> | The version the value stands at. 0 for a value never written. | Type: `number`. |

### `StateSetOptions`

The options of `$.state.set`: `ifVersion` makes the write conditional on the value still standing at that version (compare-and-set). Object with fields `ifVersion?`. Used by `$.state.set`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `ifVersion` | <Documented /> | Write only if the value still stands at this version. | Type: `number`. Optional. |

### `StateSetResult`

What `$.state.set` answers: whether the write landed, and the version the value stands at now. A landed write has a new version. A missed write has the current version. Object with fields `isSet` and `version`. `isSet` is false only for a write given `ifVersion` that another write beat. Nothing changes then, and `$.state.get` reads what stands.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `isSet` | <Documented /> | `true`: the write landed. | Type: `true`. |
| `version` | <Documented /> | The version the value stands at now. | Type: `number`. |
| `isSet` | <Documented /> | `false`: another write beat it and nothing changed. | Type: `false`. |
| `version` | <Documented /> | The version the value stands at now. | Type: `number`. |

### `StateWrite`

A `$.state.set` as it crosses to the host and as its hooks see it when no contract declares the value. It has the address, the value, and the condition. Combines `StateAddress`. Object with the fields `value`, `previous?`, `ifVersion?`. `previous` is what stood there when the write was raised.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `value` | <Documented /> | The value to write. | Type: `unknown`. |
| `previous` | <Documented /> | What stood there when the write was raised. The host sets it. | Type: `unknown`. Optional. |
| `ifVersion` | <Documented /> | Write only if the value still stands at this version. | Type: `number`. Optional. |

### `Timer`

A pending timer from `$.clock.after` / `$.clock.every`. Object with fields `cancel`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `cancel` | <Documented /> | Stops it. A stopped timer never fires again. | Type: `() => void`. |

### `WasmCompileInput`

What a hook on `wasm.compile` receives. It holds the bytes that are about to compile, and the file that they were read from when the call named one. Used by `$.wasm.compile`, `wasm.compile`.[^wasm-compile]

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `path` | <Documented /> | The file under the folder of the calling plugin, as `claude plugin validate` prints it. | Type: `string`. Optional. Uses `/` as the separator. Absent for bytes made at run time. Pinned: `next(e)` passes it on. |
| `base64` | <Documented /> | The binary: the file as read for this call, or the bytes as they were when the call was made. | Type: `string`. A hook may replace it. |

## Related Pages

- [Files, State, Clock, HTTP, Process, and Settings Types](index.md)
- [Mod API Types](../index.md)

## Sources

[^wasm-compile]: `schemas/claude-code.d.ts`, `WasmCompileInput`. The program, `chunk-56bhcxay.js:4983325`.
