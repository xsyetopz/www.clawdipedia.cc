---
title: Clock, HTTP, Process, Env, and Settings
description: "The $ nouns that reach the machine: time and timers, web requests, commands, environment variables, and merged settings."
sidebar_position: 14
---

These nouns let a mod reach the machine: `$.clock` for time and timers, `$.http` for web requests, `$.process` for commands, `$.env` for environment variables, and `$.settings` for the merged settings. `$.wasm` compiles WebAssembly in the environment of the module.

`$.process` works in the CLI only. `$.settings` can only read. A policy can refuse a call. For example, the organization's web-fetch policy can refuse `$.http.fetch`.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api) and [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types]

"Run time" in a "Where it can be used" cell means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

## Example

```javascript
on("session.start", async ($, e, next) => {
  const { exitCode, stdout } = await $.process.run([
    "git",
    "status",
    "--short",
  ]);
  if (exitCode === 0) {
    $.ui.log(stdout);
  }
  $.clock.every(1000, () => $.ui.status("polling"));
  return next(e);
});
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.clock.now` | <Documented /> | Resolves the milliseconds since the epoch, now. | `() => Promise<number>`. | Run time. |
| `$.clock.sleep` | <Documented /> | Resolves after `ms` milliseconds. Rejects at once when `signal` aborts. | `(ms, options?) => Promise<void>`. The hook's budget continues during the wait. Pass `signal: next.signal` to end the wait with the dispatch. | Run time. |
| `$.clock.after` | <Documented /> | Calls `fn` once after `ms` milliseconds. `cancel()` before then stops it. | `(ms, fn) => Timer`. `fn` runs when the `clock.after` dispatch resolves. It never runs when a hook refuses the dispatch. | Run time. |
| `$.clock.every` | <Documented /> | Calls `fn` every `ms` milliseconds (at least 1) until `cancel()`. | `(ms, fn) => Timer`. Runs `fn` once for each period. A refused period ends the interval. | Run time. |
| `$.http.fetch` | <Documented /> | Fetches `url` through the host, never the plugin's own network. Resolves `{ status, ok, headers, text }` once the host reads the body. | `(url, init?) => Promise<HttpResponse>`. Fetches an http or https URL. The organization's web-fetch policy can refuse it. `init.auth` takes a handle from [`$.session.authorize()`](session.md). It rides https only, and the engine sets the session's credential header itself, only for a first-party host. A model request that a hook edits keeps the session's credential under it, at its own URL and method, while `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set.[^v328-fetch-cred] | Run time. |
| `$.process.run` | <Documented /> | Runs a command on the host by its argument list (no shell). Resolves `{ exitCode, stdout, stderr }` once it exits, with any exit code. | `(argv, init?) => Promise<ProcessRunResult>`. Timeout 30 seconds by default, 10 minutes at most. The call cuts output at 4,194,304 bytes. | CLI only. |
| `$.process.spawn` | <Documented /> | Starts a command on the host by its argument list (no shell) and streams what it writes, then how it ended. | `(request) => HookStream`. Leaving the loop, `next.signal`, or an unload kills the child. | CLI only. |
| `$.process.hookEnv` | <Documented /> | Returns the variables that name the session and this plugin, as its command hook gets them, to pass as the `env` of a child. `run` and `spawn` set none of them. | `() => Promise<Record<string, string>>`. Holds `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ATTENDED`, `CLAUDE_PID`, `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, and `TRACEPARENT` while a trace passes on. The call makes the data folder of the plugin, and rejects when it cannot.[^hook-env] | CLI only. |
| `$.env.get` | <Documented /> | Resolves the value of a variable, or `undefined` when unset. | `(name) => Promise<string \| undefined>`. `name` must be a string literal. `claude plugin validate` lists the names your module reads. | The name must be a literal in the module source. |
| `$.env.set` | <Documented /> | Sets the variable for this process and everything it starts later, or unsets it when `value` is `undefined`. | `(name, value) => Promise<EnvSetResult>`. `name` must be a string literal. Resolves `{}` or `{ deny }`. | The name must be a literal in the module source. |
| `$.wasm.compile` | <Documented /> | Compiles a WebAssembly binary and resolves with its `WebAssembly.Module`, to instantiate with the standard API. A module that calls `compile` has a `WebAssembly` global, the standard API less every other way to compile. Any other module has none. | `(source: string \| ArrayBuffer \| ArrayBufferView) => Promise<WebAssembly.Module>`. `source` is a string literal that names a `.wasm` file of the plugin, relative to the calling file, or bytes made at run time. Either may hold 64 MiB. A path that is no literal does not load. The engine supplies no imports (no WASI), and locally nothing caps memory, so set `maximum`. A hook above reads the bytes, replaces them, or refuses (`WasmCompileInput`). Rejects with a `WebAssembly.CompileError` for bytes that are no module, for a module that defines or imports a shared memory. Locally, nothing stops a loop that stays inside WebAssembly, so have long code call an import that throws past a deadline [^wasm] The hosted server runs the module too. There a mod's memory and stack are bounded, and what WebAssembly takes counts as script does: a deep recursion or a `grow` past the bound ends the hook, and a loop ends by the hook's deadline. A module with no room rejects, and so does a file changed since the mod loaded. Exceptions, tags, and SIMD are not there.[^v328-wasm-host] | The path must be a literal in the module source. `claude plugin validate` lists each file with its size, SHA-256, imports, and exports. |
| `WebAssembly` global | <Documented /> | The standard API over the modules that `$.wasm.compile` answers, frozen. A module that calls `compile` has it. | `new WebAssembly.Module` throws, and `compile` and `instantiate` over bytes reject, and both name `$.wasm.compile`. `validate` answers true for what `$.wasm.compile` takes. No memory is shared. It holds `Module` (`imports`, `exports`, `customSections`), `Instance`, `instantiate`, `validate`, `Memory`, `Table`, `Global`, `Tag`, `JSTag`, `Exception`, `Suspending`, `promising`, and the errors `CompileError`, `LinkError`, `RuntimeError`, and `SuspendError`. | Run time, in a module that calls `$.wasm.compile`. |
| `$.settings.read` | <Documented /> | Resolves the settings merged over every source, one source's settings as loaded (`{ source }`), or the value of one top-level key (`{ key }`, with an optional `source`), `undefined` when the settings hold none. | `(args?: { source? } \| { key, source? }) => Promise<Settings \| unknown>`. Returns a snapshot of plain data. A read of one key is the read of the merged object, projected, and raises no event of its own. With no hook, the merge takes a scalar from the last source that has it, joins lists, and merges objects. A `settings.read` hook gets each settings layer (`layers`) and rewrites the merged settings. | Run time. |

## Events Raised by These Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `clock.now` | <Documented /> | `$.clock.now()` | Input `NoArgs`. Value `number`. |
| `clock.sleep` | <Documented /> | `$.clock.sleep(ms, { signal })`. The signal does not cross. It aborts the dispatch. | Input `ClockWait`. Value `void`. |
| `clock.after` | <Documented /> | `$.clock.after(ms, fn)`. `fn` stays in the plugin's environment. | Input `ClockWait`. Value `void`. |
| `clock.every` | <Documented /> | `$.clock.every(ms, fn)`. One dispatch for each period. | Input `ClockWait`. Value `void`. |
| `http.fetch` | <Documented /> | `$.http.fetch(url, init)` | Input `{ url: string, init?: HttpInit }`. Value `HttpResponse`. A request of the engine itself, such as a model request, also raises this event, with `next.origin.plugin` set to `"engine"`. For such a request, `init.body` can be `{ base64 }`, `init.compress` can be set, and the answer can carry `isStreaming` and `sendIndex`. A plugin's own `$.http.fetch` cannot pass these (see Errors below). [^fetch-engine] |
| `process.run` | <Documented /> | `$.process.run(argv, init)` | Input `{ argv: readonly string[], init?: ProcessRunInit }`. Value `ProcessRunResult`. |
| `process.spawn` | <Documented /> | `$.process.spawn(request)`. It streams. `{ deny }` kills a running child. | Input `ProcessSpawnRequest`. Value `ProcessSpawnResult`. |
| `process.hookEnv` | <Documented /> | `$.process.hookEnv()` | Input `NoArgs`. Value `Record<string, string>`. |
| `settings.read` | <Documented /> | `$.settings.read({ source })`, `$.settings.read()` | Input `SettingsReadInput`. Value `Settings`. The hook also gets each settings layer (`layers`) and rewrites the merged settings. No key is closed to a hook.[^settings-layers] Each layer is `{ source, settings }`, lowest precedence first. `source` is a settings source or `plugin`. A source with no settings, or one the engine bars from the read, is left out. |
| `env.get` | <Documented /> | `$.env.get(name)`. The type pins `name`. | Input `{ name: string }`. Value `string \| undefined`. |
| `env.set` | <Documented /> | `$.env.set(name, value)`. The type pins `name`. No `value` unsets. | Input `{ name: string, value?: string }`. Value `EnvSetResult`. |
| `wasm.compile` | <Documented /> | `$.wasm.compile(source)` | Input `WasmCompileInput`. Value `WasmBytes`. |

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `${…}: http.fetch: ${…}`, `http.fetch: ${…}` | <Undocumented /> | A `$.http.fetch` call was refused. The text is the plugin name, `http.fetch:`, and the reason. A request from the engine itself has no plugin name. | The reason is one of these. `refused:` and the reason of the auth check. `unknown auth handle; $.session.authorize() mints one`. A request body over the character limit, or an answer body over the byte limit.[^fetch-errors] |
| `a body of bytes and compress ride engine requests alone` | <Undocumented /> | A plugin passed a body that is not a string, or passed `compress`, to `$.http.fetch`. | Full text: `${plugin}: http.fetch: a body of bytes and compress ride engine requests alone`. Only requests of the engine itself may carry bytes or `compress`. Pass the body as a string and drop `compress`.[^bytes-body] |
| `http.fetch: a body of bytes cannot be redacted` | <Undocumented /> | A request of the engine to an event endpoint has a body of bytes, and the program cannot redact bytes. | The program passes a string body through the `http.fetch` hooks to redact it. It refuses a body of bytes sent to that path. The text has no plugin name.[^redact] |

## Related Pages

- [Mod API Overview](../index.md)
- [Files, Store, and State](fs-store-state.md)
- [Files, State, Clock, HTTP, Process, and Settings Types](../types/infra/index.md) (shapes of `HttpInit`, `ProcessRunInit`, `Settings`, and more)

## Sources

[^types]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-dm9xqacz.js:6`, published as `schemas/claude-code.d.ts`, `ClockWait`, `Timer`, `TimerCall`, `SleepOptions`, `HttpInit`, `HttpResponse`, `ProcessRunInit`, `ProcessRunResult`, `ProcessSpawnRequest`, `ProcessSpawnResult`, `SettingsReadOverloads`, `SettingsReadInput`, `SettingsLayer`, `EnvSetResult`, `WasmBytes`, and `WasmCompileInput`.
[^hook-env]: The program, `chunk-hg1yqkjk.js:214907` (the op) and `chunk-hg1yqkjk.js:51776` (the variable list).
[^wasm]: The program, `chunk-hg1yqkjk.js:214375` and `chunk-43hq1cm6.js:2464`.
[^fetch-engine]: The program, `chunk-hg1yqkjk.js:193623` and `chunk-hg1yqkjk.js:193650`, and the `http.fetch` types of the type file.
[^fetch-errors]: The program, `chunk-hg1yqkjk.js:193741`.
[^bytes-body]: The program, `chunk-hg1yqkjk.js:193761`.
[^redact]: The program, `chunk-hg1yqkjk.js:193425`.
[^v328-wasm-host]: The type file `schemas/claude-code.d.ts`, `$.wasm.compile`.
[^v328-fetch-cred]: The type file `schemas/claude-code.d.ts`, `$.http.fetch`.

[^settings-layers]: The program, the Mod API type file `claude-code.d.ts`, bundled at `chunk-dm9xqacz.js:6`, published as `schemas/claude-code.d.ts`: `SettingsLayer`, `SettingsReadInput`, and `$.settings.read`, where what the hooks answer is what every reader of the merged settings reads.
