---
title: Clock, HTTP, Process, Env, and Settings
description: The five $ nouns that reach the machine - time and timers, web requests, commands, environment variables, and merged settings.
sidebar_position: 14
---

These five nouns reach the machine: `$.clock` for time and timers, `$.http` for web requests, `$.process` for commands, `$.env` for environment variables, and `$.settings` for the merged settings.
`$.process` works in the CLI only.
`$.settings` can only read.

A policy can refuse a call. For example, the organization's web-fetch policy can refuse `$.http.fetch`.

Official pages: [Use the Mods API](https://code.claude.com/docs/en/plugins/mods/api), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.314 program (`schemas/claude-code.d.ts`).
"Run time" appears in a "Where it can be used" cell. It means in a hook, in a closure that a hook drew, or in a timer callback. It does not mean inside `register`.

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
| `$.http.fetch` | <Documented /> | Fetches `url` through the host, never the plugin's own network. Resolves `{ status, ok, headers, text }` once the host reads the body. | `(url, init?) => Promise<HttpResponse>`. Fetches an http or https URL. The organization's web-fetch policy can refuse it. `init.auth` takes a handle from [`$.session.authorize()`](session.md). The engine uses it only on https to `api.anthropic.com`. | Run time. |
| `$.process.run` | <Documented /> | Runs a command on the host by its argument list (no shell). Resolves `{ exitCode, stdout, stderr }` once it exits, with any exit code. | `(argv, init?) => Promise<ProcessRunResult>`. Timeout 30 seconds by default, 10 minutes at most. The call cuts output at 4,194,304 bytes. | CLI only. |
| `$.process.spawn` | <Documented /> | Starts a command on the host by its argument list (no shell) and streams what it writes, then how it ended. | `(request) => HookStream`. Leaving the loop, `next.signal`, or an unload kills the child. | CLI only. |
| `$.env.get` | <Documented /> | Resolves the value of a variable, or `undefined` when unset. | `(name) => Promise<string \| undefined>`. `name` must be a string literal. `claude plugin validate` lists the names your module reads. | The name must be a literal in the module source. |
| `$.env.set` | <Documented /> | Sets the variable for this process and everything it starts later, or unsets it when `value` is `undefined`. | `(name, value) => Promise<EnvSetResult>`. `name` must be a string literal. Resolves `{}` or `{ deny }`. | The name must be a literal in the module source. |
| `$.settings.read` | <Documented /> | Resolves the settings merged over every source, one source's settings as loaded (`{ source }`), or the value of one top-level key (`{ key }`, with an optional `source`), `undefined` when the settings hold none. | `(args?: { source? } \| { key, source? }) => Promise<Settings \| unknown>`. Returns a snapshot of plain data. A read of one key is the read of the merged object, projected, and raises no event of its own. With no hook, the merge takes a scalar from the last source that has it, joins lists, and merges objects. A `settings.read` hook gets each settings layer (`layers`) and rewrites the merged settings (new in 2.1.304). | Run time. |

## Events Raised by These Calls

For each call, a hook above the caller returns `next(e)`, `{ deny: reason }`, or `{ value }`.

| Item | Status | The argument | Input and value |
| --- | --- | --- | --- |
| `clock.now` | <Documented /> | `$.clock.now()` | Input `NoArgs`. Value `number`. |
| `clock.sleep` | <Documented /> | `$.clock.sleep(ms, { signal })`. The signal does not cross. It aborts the dispatch. | Input `ClockWait`. Value `void`. |
| `clock.after` | <Documented /> | `$.clock.after(ms, fn)`. `fn` stays in the plugin's environment. | Input `ClockWait`. Value `void`. |
| `clock.every` | <Documented /> | `$.clock.every(ms, fn)`. One dispatch for each period. | Input `ClockWait`. Value `void`. |
| `http.fetch` | <Documented /> | `$.http.fetch(url, init)` | Input `{ url: string, init?: HttpInit }`. Value `HttpResponse`. |
| `process.run` | <Documented /> | `$.process.run(argv, init)` | Input `{ argv: readonly string[], init?: ProcessRunInit }`. Value `ProcessRunResult`. |
| `process.spawn` | <Documented /> | `$.process.spawn(request)`. It streams. `{ deny }` kills a running child. | Input `ProcessSpawnRequest`. Value `ProcessSpawnResult`. |
| `settings.read` | <Documented /> | `$.settings.read({ source })`, `$.settings.read()` | Input `SettingsReadArgs`. Value `Settings`. Since 2.1.304 the hook also gets each settings layer (`layers`) and rewrites the merged settings. A managed mod can use this to make an organization's setting a ceiling, including `cleanupPeriodDays`, which the retention sweep uses. Each layer is `{ source, settings }`, lowest precedence first. `source` is a settings source or `plugin`. A source with no settings, or one the engine bars from the read, is left out. |
| `env.get` | <Documented /> | `$.env.get(name)`. The type pins `name`. | Input `{ name: string }`. Value `string \| undefined`. |
| `env.set` | <Documented /> | `$.env.set(name, value)`. The type pins `name`. No `value` unsets. | Input `{ name: string, value?: string }`. Value `EnvSetResult`. |

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `${…}: http.fetch: ${…}`, `http.fetch: ${…}` | <Undocumented /> | A `$.http.fetch` call was refused. The text is the plugin name, `http.fetch:`, and the reason. A request from the engine itself has no plugin name. | The reason is one of these. `refused:` and the reason of the auth check. `unknown auth handle; $.session.authorize() mints one`. A request body over the character limit, or an answer body over the byte limit. Source: the program (`chunk-ne1755n5.js:4035859`). |
| `a body of bytes and compress ride engine requests alone` | <Undocumented /> | A plugin passed a body that is not a string, or passed `compress`, to `$.http.fetch`. | Full text: `${plugin}: http.fetch: a body of bytes and compress ride engine requests alone`. Only requests of the engine itself may carry bytes or `compress`. Pass the body as a string and drop `compress`. Source: the program (`chunk-ne1755n5.js:4035859`). |
| `http.fetch: a body of bytes cannot be redacted` | <Undocumented /> | A request of the engine to an event endpoint has a body of bytes, and the program cannot redact bytes. | The program passes a string body through the `http.fetch` hooks to redact it. It refuses a body of bytes sent to that path. The text has no plugin name. Source: the program (`chunk-ne1755n5.js:4029149`). |

## Related Pages

- [Mod API Overview](../index.md)
- [Files, Store, and State](fs-store-state.md)
- [Files, State, Clock, HTTP, Process, and Settings Types](../types/infra/index.md) (shapes of `HttpInit`, `ProcessRunInit`, `Settings`, and more)
