---
title: Atom, Files, and HTTP Types
description: "Types of atoms, the clock wait, the env result, file entries and options, HTTP, and JSON values."
sidebar_position: 1
---

## Types with Fields

Each type below has its own table of fields.

### `Atom`

A named value with its initial, as `atom(ref, initial)` makes it. A read is never `undefined`: while nothing is written, it reads as the initial. Object with fields `ref`, `initial`, `shape?`. Plain frozen data, the own data of the plugin: pass it to `read`, `update`, `derive` and `memberOf`. The engine knows nothing of it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `ref` | <Documented /> | The address of the named value. | Type: `StateAddress`. Read-only. |
| `initial` | <Documented /> | The value that it reads as while nothing is written. | Type: `T`. Read-only. |
| `shape` | <Documented /> | The tag that the value is kept under, when the atom was given one. A stored value under another tag reads as absent (Shaped). | Type: `string`. Optional. Read-only. |

### `AtomOptions`

The options of `atom`: `shape`, a tag that the value is kept under. A reload of the code of the plugin that names another tag then finds the value absent. Object with fields `shape`. Bump it when the idea of the code about the value changed. The engine keeps whole what the old code wrote, and the tag is how the new code declines it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `shape` | <Documented /> | A tag that the value is kept under. A reload of the plugin that names another tag finds the value absent. | Type: `string`. |

### `ClockWait`

The argument of the `$.clock` waits (`sleep`, `after`, `every`): how long, in milliseconds, before the dispatch resolves. Object with fields `ms`. Used by `clock.sleep`, `clock.after`, `clock.every`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `ms` | <Documented /> | The wait, a non-negative number of milliseconds. | Type: `number`. |

### `Derived`

A value computed from other values, as `derive(sources, fn)` makes it. `read` runs `fn` again only when the version of a source moved. Object with fields `sources`, `compute`. It holds nothing on the host: the cache is the own cache of the plugin. A reload of its code loses the cache, and the next read rebuilds it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `sources` | <Documented /> | The atoms and references that it is computed from, read in this order. | Type: `readonly (Atom<unknown> \| StateAddress)[]`. Read-only. |
| `compute` | <Documented /> | The function over the values of the sources, in the order they were given. | Type: `(...values: never[]) => T`. Read-only. |

### `EnvSetResult`

What `$.env.set` resolves to and what the `{ value }` of an `env.set` hook holds: `{}` once the variable is set or unset, or why it was not. Object with fields `deny?`. Used by `$.env.set`, `env.set`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `deny` | <Documented /> | Absent when the write was made. Otherwise it says why not, in one line. | Type: `string`. Optional. In a session that takes settings from its organization, the engine holds a write by a plugin that is not built in. The own `{ deny }` of a hook rejects the caller. |

### `FsAncestor`

One file that `$.fs.ancestors` found. It has the directory that it stands in. It has the name that the caller asked for it by. It has its text as the memory loader of the engine reads it. Object with fields `dir`, `name`, `content`, `parts`. Used by `$.fs.ancestors`, `fs.ancestors`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `dir` | <Documented /> | The directory the file stands in, absolute. | Type: `string`. |
| `name` | <Documented /> | The spelling the caller asked for it by. | Type: `string`. |
| `content` | <Documented /> | The text of the file, with what its `@include`s bring after it. | Type: `string`. |
| `parts` | <Documented /> | The file and then each file that its `@` imports brought, in load order, with path and text for each. `content` is these texts joined. | Type: `readonly FsAncestorPart[]`. |

### `FsAncestorPart`

One file of an ancestor entry: the file itself or one it imported. Object with fields `path`, `content`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `path` | <Documented /> | The path of the file, absolute. | Type: `string`. |
| `content` | <Documented /> | Its text as the memory loader of the engine reads it. | Type: `string`. |

### `FsAncestorsRequest`

The argument of `$.fs.ancestors`. It has the file names to look for in each directory, the file to walk down to, and the directory to walk beneath. Object with the fields `names`, `of?`, `below?`. Where a rule limits the reads of the session, a file is found only where every name on its path may be read. Used by `$.fs.ancestors`, `fs.ancestors`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `names` | <Documented /> | Relative `.md` file names, each looked for in every directory. | Type: `readonly string[]`. |
| `of` | <Documented /> | The file that the walk goes on down to the directory of, relative to the working directory or absolute. If absent, the walk ends at the working directory. | Type: `string`. Optional. The file to walk down to. Without `below`, a plain name or one under `.claude` is judged as the start-up load is. With no file bound the call rejects. |
| `below` | <Documented /> | The directory that the walk starts beneath, relative to the working directory or absolute. If absent, the walk starts at the filesystem root. | Type: `string`. Optional. The directory the walk stays inside. Only directories strictly inside it are read. |

### `FsBytes`

What `$.fs.read(path, { as: "bytes" })` resolves with: the bytes of the file, base64, since only plain data crosses into the environment of a plugin. Object with fields `base64`. Used by `fs.read`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `base64` | <Documented /> | The content of the file, standard padded base64. `Uint8Array.fromBase64(base64)` gives the bytes back. | Type: `string`. |

### `FsEntry`

One entry of `$.fs.list`: the entry itself, with a link not followed. Object with fields `name`, `kind`, `size`, `mtimeMs`, `isLink`. Used by `$.fs.list`, `fs.list`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `name` | <Documented /> | The name of the entry (no directory part). | Type: `string`. |
| `kind` | <Documented /> | `file`, `dir`, or `other`, of the entry itself. A symbolic link is `other` (`$.fs.stat` says what it leads to, and with `resolve` where). | Type: `'file' \| 'dir' \| 'other'`. |
| `size` | <Documented /> | Bytes, for a file. | Type: `number`. |
| `mtimeMs` | <Documented /> | Last modification, milliseconds since the epoch, for a file, as `$.fs.stat` spells it. It is 0 for a directory, a link or any other kind. | Type: `number`. A listing reads the size and time of regular files only. `$.fs.stat` answers for a directory. |
| `isLink` | <Documented /> | True when the entry is a symbolic link. | Type: `boolean`. |

### `FsReadBytesOptions`

The options of `$.fs.read` that ask for the bytes. The call then answers `{ base64 }`. Object with fields `as`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `as` | <Documented /> | `bytes`. | Type: `'bytes'`. |

### `FsReadOptions`

The options of `$.fs.read`. Object with fields `as`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `as` | <Documented /> | `bytes` answers `{ base64 }` for a binary file. `text` (the default) answers the text of the file. | Type: `FsReadAs`. |

### `FsStat`

What `$.fs.stat` resolves with: what the path leads to, whether the path itself is a symbolic link, and where it lands when asked. Object with fields `kind`, `size`, `mtimeMs`, `isLink`, `realPath?`. Used by `$.fs.stat`, `fs.stat`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | `file`, `dir`, or `other`, of what the path leads to. The call follows a link, and a link that leads nowhere is `other`. | Type: `'file' \| 'dir' \| 'other'`. |
| `size` | <Documented /> | Bytes, for a file. | Type: `number`. |
| `mtimeMs` | <Documented /> | Last modification, milliseconds since the epoch. | Type: `number`. |
| `isLink` | <Documented /> | True when the path itself is a symbolic link. `kind`, `size` and `mtimeMs` then describe what it points at, or the link when that is gone. | Type: `boolean`. |
| `realPath` | <Documented /> | Where the path landed when asked with `{ resolve: true }`: absolute, with every symbolic link followed and `.` and `..` folded. Otherwise absent. | Type: `string`. Optional. Absent when the path leads nowhere or a hook withheld it. A deny-list on spellings is best effort. An allow-list on `realPath` is the stronger guard. |

### `FsStatOptions`

The options of `$.fs.stat`. Object with fields `resolve`. Used by `$.fs.stat`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `resolve` | <Documented /> | True to resolve where the path lands as well. | Type: `boolean`. The answer then carries `realPath` when the path leads somewhere, at the cost of one more file system call. It shows where the path landed then. It is not a hold on what a tool opens afterwards. |

### `HttpInit`

Options of `$.http.fetch`. Object with fields `method?`, `headers?`, `body?`, `auth?`, `socketPath?`. Used by `$.http.fetch`, `http.fetch`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `method` | <Documented /> | `GET` (default), `POST`, ... | Type: `string`. Optional. |
| `headers` | <Documented /> | Request headers. | Type: `Record<string, string>`. Optional. |
| `body` | <Documented /> | The request body, as text. Since `2.1.321`, bytes that are not UTF-8 go as `{ base64 }`, which only an engine request carries. | Type: `HttpBody`, which is `string \| { base64: string }`. Optional. |
| `compress` | <Documented /> | Since `2.1.321`: what the engine does to the body beneath the hooks, on an engine request alone. `body` is the plain body. Delete this and the body leaves as written. Set this and the engine compresses it. For exact bytes, delete this and write them with your own `content-encoding` header. | Type: `HttpCompress`, which is `boolean \| 'gzip' \| 'deflate' \| 'br' \| 'zstd' \| { encoding, level?: number }`. Optional. Example: `next({ ...e, init: { ...e.init, compress: undefined } })` (`captures/2.1.321/types.diff`; the program rejects a plugin call with `a body of bytes and compress ride engine requests alone`). |
| `auth` | <Documented /> | The handle that `$.session.authorize()` answered: the engine sets the credential header of the session itself, only for a first-party host. | Type: `string`. Optional. It rides https only. While `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set, a request that carries it is refused, whichever plugin asks. |
| `socketPath` | <Documented /> | The absolute path of a Unix domain socket that the request goes over instead of TCP (near 100 B at most). There is one for each session, in a private directory. | Type: `string`. Optional. A Unix socket to use instead of TCP. The URL still gives the path, query, and Host. No proxy. No relative path. |

### `HttpResponse`

What `$.http.fetch` resolves with. Object with fields `status`, `ok`, `headers`, `text`. Used by `$.http.fetch`, `http.fetch`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `status` | <Documented /> | The HTTP status code. | Type: `number`. |
| `ok` | <Documented /> | True for a 2xx status. | Type: `boolean`. |
| `headers` | <Documented /> | Response headers, lower-cased names. | Type: `Record<string, string>`. |
| `text` | <Documented /> | The body, as text. Since `2.1.321`, it is empty while `isStreaming` is set. | Type: `string`. |
| `isStreaming` | <Documented /> | Since `2.1.321`: set on what `next(e)` gives for an engine request. The body stays the engine's and streams to its reader, and hooks read the status and headers. Pass it on, with other headers or status if you like, and the body goes on under them. Answer without it and `text` is the body instead. | Type: `true`. Optional. |
| `sendIndex` | <Documented /> | Since `2.1.321`: set beside `isStreaming`. It says which of the request's sends gave this answer. Pass it on, and the body of that send is the one that goes on. | Type: `number`. Optional. |

### `JsonValue`

Plain data is what JSON holds. It is also what crosses whole between the hooks module and the surface module of a plugin. Examples are the props of a `Client` and the data of a post. Union. Fields: `[key: string]`. A function, a class instance, `undefined` or a cycle is not plain data. The engine refuses one where it checks, and drops it where it clones.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[key: string]` | <Documented /> | Any property of a plain object, whose value is again plain data. | Type: `JsonValue`. |

## Related Pages

- [Files, State, Clock, HTTP, Process, and Settings Types](index.md)
- [Mod API Types](../index.md)
