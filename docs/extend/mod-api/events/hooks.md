---
title: Hooks and the Hook Chain
description: The register entry point, the on function, the arguments of a hook, what happens when a hook fails, and the time budgets.
sidebar_position: 2
---

A hook is a function that Claude Code calls when an event happens.
You register it with `on`.
It can watch the event, change it, or answer it.
The events themselves are on the page of their namespace. See the [Mod API Overview](../index.md) for the map.

Remove the `on` call to turn a hook off. `disableAllHooks` stops installed mods.

Official pages: [React to Events](https://code.claude.com/docs/en/plugins/mods/events), [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference), [Mods Overview](https://code.claude.com/docs/en/plugins/mods/overview#how-a-mod-works).

## Example

This mod refuses every Bash command that contains `rm -rf`.

```javascript title="hooks/register.js"
export const register = (on) => {
  on("tool.call", { tool: "Bash", command: /rm -rf/u }, async () => ({
    deny: "No rm -rf here.",
  }));
};
```

## Entry Point and Registration

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `register(on, options)` | <Documented /> | The entry point. The module exports it. `on` registers hooks. `options` holds the `userConfig` values with defaults filled in. | Runs once when the module loads, and again after a reload. The engine drops its return value. The engine awaits a promise. `$` does not exist yet. | The hooks module named in `hooks/hooks.json`. |
| `on(pattern, hook)` | <Documented /> | Registers `hook` on the events that `pattern` selects. | `pattern` is an event name, a glob (`*`, `classic.*`), or a negation (`!tool.describe`). A repeat registration throws. A plugin's registrations nest in order, first outermost. | Inside `register` only. |
| `on(pattern, matcher, hook)` | <Documented /> | The same, narrowed by a matcher. A matcher is a partial of the event input. | A leaf matches by `===` or by `RegExp`. An array means any of. An object is a partial of an object. Example: `{ tool: 'Bash', command: /^p4 / }`. | Inside `register` only. |
| `on(...).catch(handler)` | <Documented /> | Sets the handler that runs when the hook throws or overruns its budget. | A second `.catch` on one registration throws. So does one after `register` returned. An answer from the handler within the grace time stands as the hook result. | Inside `register` only, on the returned registration. |
| Pattern `*` and negation | <Documented /> | `*` selects every event. `!x` selects every event except `x`. | `*` and a negation do not select a telemetry event for an installed plugin. Hook it by name or with `telemetry.*`. A glob hook types `e` as the union of the selected events. | Inside `register` only. |

## Arguments of a Hook

A hook is `async ($, e, next) => result`.
Hooks on `turn.step` and `process.spawn` are async generators.

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$` | <Documented /> | The Mod API object. Frozen. Holds the core nouns and every noun that the `engine.create` steps added. | Write each call in full, as in `$.fs.read('notes.md')`. | Every hook and every closure a hook drew. |
| `e` | <Documented /> | The event input. Deeply frozen plain data. | To change it, pass a copy to `next`, as in `next({ ...e, text })`. The engine refuses a change to a field marked pinned in the type. | Every hook. |
| `next(e)` | <Documented /> | The rest of the chain, as middleware. It runs the hooks beneath, then the engine. It resolves to the event result. | Called with no argument it rejects. A hook that returns without `next` ends the chain. Returning nothing is a failure. On a streaming event (`turn.step`, `process.spawn`) it returns a `HookStream`. | Every hook. |
| `next.to(e, tier)` | <Documented /> | Continues the dispatch at a later tier (`user`, `append`, `builtin`, or `core`). The links between are skipped. | Managed hooks only. `prepend` may name `user`, `append`, `builtin`, or `core`. `user` skips each `prepend` peer below the hook, never one above it, and an outer `next.to` to a deeper tier still wins (since `2.1.311`). `append` may name `core`. No user hook skips the organization. | Mods in `prependPlugins` or `appendPlugins`. |
| `next.signal` | <Documented /> | An `AbortSignal` that aborts when the engine abandons the dispatch. | It aborts when the user interrupts, when a hook above settled first, or when this hook ran out of budget. Pass it to `$.clock.sleep` and other waits. | Every hook. |
| `next.origin` | <Documented /> | `{ plugin, tier }` of who raised the dispatch. The engine is `{ plugin: 'engine', tier: 'core' }`. | The host sets it. A plugin cannot write it. Every hook of one dispatch sees the same origin. | Every hook. |
| `next.is(pattern, e)` | <Documented /> | A type predicate. It says whether `pattern` selects this dispatch event. | Narrows `e` for a hook on a glob or on `*`. Under a matcher the narrowing includes it. | Glob and `*` hooks. |
| `next.event` | <Documented /> | The name of the dispatch event, as a value. | Use it in a glob hook to log or switch on. | Every hook. |
| `next.trace` | <Documented /> | A list of `TraceEntry`: what settled beneath on the latest `next()` call. | One entry for each link beneath, nearest first. Empty before the hook calls `next`. Frozen data. | Every hook. |
| `next.budget` | <Documented /> | `{ ms, remainingMs }`: the time limit of the hook and what remains. | Read fresh at each access. It stands still while a `next` or `$` call is in flight. In a `.catch` handler it is the grace time. At `session.end` it reads the exit bound, which never stops. | Every hook. |
| `next.error` | <Differs note="The type file types kind as throw or timeout. The docs add re-entry and next.error.cause." /> | In a `.catch` handler only. Why the hook failed: `kind`, `message`, `budget`. | The docs add the kind `re-entry` (the event came from a call by that hook or by your mod's code outside its hooks) and `next.error.cause`. | `.catch` handlers. |
| `next.called` | <Documented /> | In a `.catch` handler only. True when the hook called `next`. | In a handler `next` is replay-safe. When `called` is true, `next(e)` returns what the last call settled to and runs nothing again. | `.catch` handlers. |

## Failure Behavior

The engine skips a hook that throws, overruns its budget, or returns a wrong shape.
The hooks beneath and the engine run in its place, or its last `next` result stands.
So a guard fails open unless its registration carries a `.catch` that refuses in its place.

Since 2.1.304, when a plugin that runs first skips one of your mod's hooks, the transcript shows a line naming the event and the plugin: `its <event> hook was skipped. "<plugin>" runs first and sent the event on past it.` (the program's text).
The type file gives this advice at each event where an answer can refuse.

| Event | Status | What happens when the hook fails | The advice |
| --- | --- | --- | --- |
| `tool.call` | <Documented /> | The tool runs. | Add `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`. |
| `tool.check` | <Documented /> | The verdict beneath stands. | Add a `.catch` that refuses. |
| `ui.resolve` | <Documented /> | The engine skips the hook. | None. |
| `ui.fault` | <Documented /> | A `Client` born in that redraw that fails is heard too, and the engine draws nothing again for it. | To go on, ask with `$.ui.invalidate`. |
| `ui.focus` | <Documented /> | The focus stays where it was. | `next(e)` lands the focus on `e.element` and redraws. |
| `agent.offer` | <Documented /> | The offer passes through. | None. |
| `agent.spawn` | <Documented /> | The subagent starts. | Add `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`. |
| `prompt.submit` | <Documented /> | The prompt goes through. | Add `.catch(($, e, next) => next.called ? next(e) : { drop: "no" })`. |
| `prompt.mention` | <Documented /> | The engine reads the file. | Add `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`. |
| `command.run` | <Documented /> | The command runs. | Add `.catch(($, e, next) => next.called ? next(e) : { text: "no" })`. |
| `command.describe` | <Documented /> | The description passes through. | None. |
| `config.set` | <Documented /> | The engine writes the row. | Add `.catch(($, e, next) => next.called ? next(e) : { deny: "no" })`. |
| `config.describe` | <Documented /> | The row passes through. | None. |
| `skill.prompt` | <Documented /> | The text passes through. | None. |
| `attribution.text` | <Documented /> | The text passes through. | None. |
| `plugin.register` | <Documented /> | The module joins. | Add `.catch(($, e, next) => next.called ? next(e) : { refuse: "no" })`. |
| `turn.complete` | <Documented /> | The answer stays as it was. | None. |
| `engine.create` | <Documented /> | It fails, and its plugin unloads, when it replaces another plugin's noun, in `user` also past its own stub, or adds a seated name. | None. |

## Budgets

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| Hook time per event | <Documented /> | 10 seconds of the hook's own code. | The clock stops during `next` and `$` calls, but a `$.clock.sleep` counts. `HookBudget.ms` is 10000. A streaming hook counts its own code only, never a `yield` or a read beneath. | Every hook. |
| `prompt.edit` hook time | <Documented /> | 50 milliseconds. | `HookBudget` has one `ms` value. The program sets the 50 millisecond value on the event (`budgetMs`). It replaces the 10 second default. If a hook fails, the editor's own edit stands. | `prompt.edit` hooks. |
| `.catch` grace | <Documented /> | 1 second. | `HookBudget.catchMs` is 1000. The handler gets a fresh budget. | `.catch` handlers. |
| Linger after abort | <Documented /> | 5 seconds. | `HookBudget.lingerMs` is 5000. Past it the engine reports the hook as lingering. The dispatch continued without it. | Every hook. |
| `session.end` hooks together | <Documented /> | The `SessionEnd` hook budget, 1.5 seconds by default. | The whole chain shares one short wall-clock bound that `next.budget` reads. | `session.end` hooks. |

## Related Pages

- [Mod API Overview](../index.md)
- [Event Table Types](../types/events.md)
- [Files, Nouns, and Gates](../nouns-and-gates.md)
- [Hook Machinery Types](../types/hooks.md)
