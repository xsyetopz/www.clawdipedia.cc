---
title: Files, State, Clock, HTTP, Process, and Settings Types
description: "Types behind $.fs, $.store, $.state, $.clock, $.http, $.process, $.env, and $.settings."
sidebar_position: 5
---

These types describe the calls on `$.fs`, `$.store`, `$.state`, `$.clock`, `$.http`, `$.process`, `$.env`, and `$.settings`. They cover files, stored values, timers, web requests, child processes, and settings. Use them to type the input and result of these calls in your mod.

## Pages

| Page | What is in it |
| --- | --- |
| [Atom, Files, and HTTP Types](atoms-files-http.md) | `Atom` to `JsonValue`: atoms, clock wait, env result, the `$.fs` types, and the `$.http` types. |
| [Process, Settings, State, and Timer Types](process-settings-state.md) | `ProcessRunInit` to `Timer`: the `$.process` types, settings reads, sleep options, the `$.state` types, and timers. |

## Example

This call runs a child process and reads its exit code and output. The types below describe the input and the result.

```ts
const { exitCode, stdout } = await $.process.run(["git", "status"]);
```

## Types without Fields

These types are aliases, unions, or plain shapes. Each row gives its use and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `AtomFunction` | <Documented /> | `atom(ref, initial)`: a named value with its initial, so a read is never `undefined`. Give it `{ shape }` for a key declared `Shaped<T>`. | Alias of the call form of `atom`. Pure: it builds a frozen description and calls nothing. Example: `atom({ plugin: "counter", key: "count" } as const, 0)`. |
| `DeriveFunction` | <Documented /> | `derive(sources, fn)`: a value computed from atoms and references, cached by their versions. `read` runs `fn` again only when one moved. | Alias of `(sources, compute) => Derived<T>`. Pure: it builds a description. Reading it while drawing subscribes the drawing to every source. |
| `FsReadAs` | <Documented /> | How `$.fs.read` answers: `text` (UTF-8, the default) or `bytes` (base64). | Alias of `'text' \| 'bytes'`. Used by `fs.read`. |
| `FsReadCall` | <Documented /> | `$.fs.read`: the text of the file, or with `{ as: "bytes" }` its bytes as `{ base64 }`. | Alias of `{ (path: string): Promise<string>, (path: string, options: FsReadBytesOptions): Promise<FsBytes>, (path: string, options: FsReadOptions): Promise<string \| FsBytes>, }`. Used by `$.fs.read`. |
| `MemberOfFunction` | <Documented /> | `memberOf(family, e)`: the member of a family for the instance being drawn, keyed by `e.requestId`. For an atom over a family, it is the atom of that member. | Alias of the call forms of `memberOf`. It picks one member of a state family for a render instance. Example: `read($, memberOf(isOpen, e))`. |
| `ReadFunction` | <Documented /> | `read($, source)`: the value of an atom (its initial while absent), of a derived value, or under a plain reference. It makes one `$.state.get` for each value. | Alias of the call forms of `read`. Called while a `ui.render` hook draws, it subscribes the drawing. Example: `const n = await read($, count)`. |
| `Settings` | <Documented /> | What `$.settings.read` answers: an object keyed as a settings.json is (`permissions`, `env`, `hooks`, `model`, `enabledPlugins`, ...). | Alias of `Readonly<Record<string, unknown>>`. Each key is as the settings docs describe it. A snapshot in plain data: a write to it changes nothing. A `settings.read` hook gets each settings layer (`layers`, each with `settings`) and rewrites this merged value.[^settings-layers] Used by `$.settings.read`, `settings.read`. |
| `SettingsSource` | <Documented /> | One source of settings by the name a plugin gives it, lowest precedence first. The engine name is the same word with `Settings` appended. | Alias of `'user' \| 'project' \| 'local' \| 'flag' \| 'policy'`. They match `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json`, `--settings`, and managed settings. |
| `StateDollar` | <Documented /> | What `read` and `update` of the state library take of `$`: its `state` noun, on which they make the calls that a hook would make itself. | Alias of `Pick<CoreEngineInterface, 'state'>`. |
| `StateGetEvent` | <Documented /> | `e` of `state.get`: one variant for each value that a contract declares, so a matcher on `plugin` and `key` narrows it. While none does, it is the untyped address. | Alias of `[DeclaredPair] extends [never] ? StateAddress : DeclaredEvents<DeclaredPair>['get']`. Example: `on("state.get", { plugin: "swarm" }, ($, e, next) => next(e))`. Used by `state.get`. |
| `StateRef` | <Documented /> | A typed reference to one named value: the owning plugin and the key, both literals, and for a StateFamily key the `id` of the member. | Alias of the reference to a state value: `plugin` and `key`, plus `id` for a family. Write it once as a constant, with `plugin` and `key` as literals in the source. |
| `StateSetEvent` | <Documented /> | `e` of `state.set`: one variant for each value that a contract declares, so a matcher on `plugin` and `key` narrows `e.value`. While none does, it is the untyped write. | Alias of the `state.set` event type. `plugin`, `key`, and `id` are pinned. A hook may rewrite `value`. Example: `next({ ...e, value: false })`. Used by `state.set`. |
| `StateValue` | <Documented /> | The type of the value under key `K` of plugin `P`, as its contract declares it in PluginState. For a family key, it is the member type of the StateFamily. | Alias of `PluginState[P][K] extends StateFamily<infer Member> ? Member : PluginState[P][K]`. Used by `$.state.get`, `$.state.set`. |
| `TimerCall` | <Documented /> | A timer on `$.clock` (`after`, `every`): `fn` runs after `ms` milliseconds, once or until `cancel()`. | Alias of `(ms: number, fn: () => void) => Timer`. Used by `$.clock.after`, `$.clock.every`. |
| `UpdateFunction` | <Documented /> | `update($, target, fn)`: reads the value, applies `fn` here in the environment of the plugin, writes with `ifVersion`, and tries again on a miss. | Alias of the call forms of `update`. A handler uses it instead of `$.state.set(ref, stale + 1)`. Two presses before a redraw both land. |
| `atom` | <Documented /> | A named value with its initial. `read` answers the initial while nothing is written, so never `undefined`. Pure, and it runs in the environment of the plugin. | Alias of `export const atom: AtomFunction`. |
| `derive` | <Documented /> | A value computed from atoms and references, cached by their versions. | Alias of `export const derive: DeriveFunction`. Example: `const busy = derive([workers], list => list.filter(w => w.isBusy).length)`. |
| `memberOf` | <Documented /> | The member of a family for the instance being drawn, keyed by `e.requestId`. | Alias of `export const memberOf: MemberOfFunction`. Example: `const open = await read($, memberOf(isOpen, e))`. |
| `read` | <Documented /> | Reads an atom, a derived value or a reference through `$.state.get`. While a `ui.render` hook draws, that subscribes the drawing. | Alias of `export const read: ReadFunction`. Example: `const n = await read($, count)`. |
| `update` | <Documented /> | Reads, applies `fn` in the environment of the plugin, writes with `ifVersion`, and tries again on a miss. A handler closure calls it. | The `update` function, typed as `UpdateFunction`. Reads the current value, writes `change(value)`, and resolves what it wrote. Example: `update($, count, n => n + 1)`. |

## Related Pages

- [Mod API Overview](../../index.md)
- [Files, Store, and State](../../calls/fs-store-state.md)
- [Clock, HTTP, Process, Env, and Settings](../../calls/clock-http-process-env-settings.md)
- [Mod API Types](../index.md)

## Sources

[^settings-layers]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-dm9xqacz.js:6`, published as `schemas/claude-code.d.ts`: `SettingsLayer`, `SettingsReadInput`, and `$.settings.read`, where what the hooks answer is what every reader of the merged settings reads.
