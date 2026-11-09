---
title: Hook Machinery Types
description: "Types that describe how on, next, matchers, and traces are typed."
sidebar_position: 4
---

These types give the shapes of `on`, `next`, matchers, and traces.
A mod author rarely writes them by hand, because your editor fills them in from the type files in `.claude-plugin/types/`.
They help when a type error is hard to read.

## Example

The editor gives `e` and `next` their types here from the machinery types below. This sketch shows only the call shape. See the Hooks page for the full rules.

```ts
on("tool.call", { tool: "Bash" }, async ($, e, next) => next(e));
```

## Types without Fields

These types are aliases, unions, or plain shapes. Each row gives its use and its shape.

| Type | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `Register` | <Documented /> | The entry of the hooks module: `export function register(on, options)`. `on` registers hooks. `options` is the configuration of the plugin (PluginOptions). | Alias of `(on: On, options: PluginOptions) => unknown`. The options are fixed for one activation. A change reloads the plugin. The engine awaits a returned promise. |
| `On` | <Documented /> | Registers `hook` on the events that `pattern` selects: one by name, every one under a namespace (`classic.*`), all (`*`), or all but some (`!tool.*`). | Alias of two call forms: `on(pattern, hook)` and `on(pattern, matcher, hook)`. A matcher narrows the inputs that a hook sees. It returns the `Registration`. |
| `CatchHandler` | <Documented /> | The handler that `on(...).catch(handler)` takes for a hook of type `F`. It has the `($, e, next)` of the hook. The engine runs it afresh when the hook throws, misreturns or overruns. | Alias for the handler type of `.catch`. `next` carries `error` and `called`. A return within the grace time is the hook result. `undefined` makes the hook absent. |
| `TraceOutcome` | <Documented /> | What the chain decided for one link, as `next.trace` names it. | Alias of `'caught' \| 'expired' \| 'kept' \| 'passed' \| 'rejected' \| 'returned' \| 'skipped'`. `returned` means the result of the hook itself stood. `skipped` means it failed before `next`. |
| `Tier` | <Documented /> | One of the five tiers of the chain (TIERS), outermost first. It is on every `next.trace` entry, and `next.to(e, tier)` names it. | Alias of the five tier names. `prepend` and `append` are managed plugins. `user` is what a person installs. `builtin` is bundled. `core` is the engine. |
| `TIERS` | <Documented /> | The five tiers of the chain, outermost first. Earlier means outer, and outer means more authority. Hooks on the same event nest in this order and in no other way. | Constant list `["prepend", "user", "append", "builtin", "core"]`. The order in which hooks run, outermost first. |
| `TargetTier` | <Documented /> | A tier `next.to(e, tier)` may name: one a floor can reach past a tier of less authority to, so never `prepend`, which nothing skips to. `user` is for a `prepend` hook alone, and skips the peers below it. | Alias of `Exclude<Tier, 'prepend'>`. Since `2.1.311`; in `2.1.310` it also excluded `user`. |
| `PluginOptions` | <Documented /> | The options of a plugin as `register(on, options)` receives them: the values of the fields that its manifest's `userConfig` declares, with defaults filled in. | Alias of a read-only record of string, number, boolean, or string list. It lives in `pluginConfigs[<plugin>].options` of settings. A required field with no value fails the load. |
| `Pattern` | <Documented /> | What `on(pattern, hook)` and `next.is(pattern, e)` take: the name of an event, a glob (`*`, `classic.*`), or a negation of either (`!tool.describe`). | Alias of `EventName \| Glob \| Negation`. |
| `Glob` | <Documented /> | Every event (`*`), or every event under a namespace (`classic.*`: each one whose name starts with `classic.`). | Alias of `` '*' \| `${Namespace}.*` ``. `*` does not select a telemetry event for an installed plugin. A hook names a telemetry event (`telemetry.log`, or `telemetry.*` for all). |
| `Negation` | <Documented /> | `!` before a name or a glob: every event except the ones it selects. `!*` would select none, so it is no pattern. | Alias of `` `!${Exclude<EventName \| Glob, '*'>}` ``. It names no event, so like `*` it selects no telemetry event for an installed plugin. A hook handles those events by name. |
| `Args` | <Documented /> | The argument of event `N`: `e` in its hooks, and what its call takes. For a union of names, the union of their arguments. | Generic alias of `EventOf[N]`. |
| `Frozen` | <Documented /> | `T` with every property read-only to every depth, and arrays and tuples kept as declared. This is the type of the `e` of a hook. | Helper type that makes `e` read-only to every depth. `e.command = 'x'` is a type error. `next({ ...e, command: 'x' })` compiles. |
| `GlobHook` | <Documented /> | The hook that `on(pattern, hook)` takes for a glob or a negation: one function placed on every selected event, with `e` and the result typed as their union. | Helper type for a hook on a glob pattern. `next.event` says which event a run is. `next.is(pattern, e)` narrows `e` to one event. |
| `GlobNext` | <Documented /> | `next` in a hook on a glob or a negation. It has one overload for each selected event, then one over their union for an `e` that is not yet narrowed. | Helper type for `next` in a glob hook. It has `to`, `signal`, `is`, `event`, `origin`, `trace`, and `budget`. |
| `GlobNextResult` | <Documented /> | What `next(e)` resolves to in a glob hook before `next.is` narrows `e`: the NextResult of each selected event, as a union. | Object with fields `[K in N]`. |
| `Hook` | <Documented /> | One hook, `($, e, next)`, on event `E`. | Generic alias of `Events[E]`. |
| `HookFor` | <Documented /> | The hook type for each pattern, as one conditional type. For an event it is Events. For `*` it is AnyEventHook. For a glob it is GlobHook, over the events that the glob selects. | Helper type that picks the hook type for a pattern. It keeps the two-argument `on` as one signature, so tool-name completion works. |
| `HookOf` | <Documented /> | The hook that event `E` takes. For a streaming event (StreamingEventName), it is an async generator over its chunks. Otherwise it is `($, e, next) => result`. | Alias of `Events[E]`. |
| `ImpossibleKeys` | <Documented /> | The keys of object pattern `P` that object member `E` cannot satisfy, `D` levels down. It is `never` when there is none, which keeps the member. | Helper type. It finds keys of a matcher that the event does not have, or whose value can never match. |
| `IndexFree` | <Documented /> | An object with the declared keys of `T` and no other keys: it leaves out the string and number index signatures. KnownKeys reads the keys of it. | Object with fields `[K in keyof T as string extends K ? never : number extends K ? never : K]`. |
| `IsDiscriminant` | <Documented /> | Whether tag key `K` selects members of `I`. It does when each member gives it ONE literal (`component: "ToolUse"` on the ToolUse variant). | Helper type. A key that has the same union on every event variant is a filter at run time. The type narrowing leaves it out. |
| `IsLiteralValued` | <Documented /> | Whether `V` is made of literals only: `"a" \| "b"` is, `string` is not. | Alias of `string extends V ? false : number extends V ? false : boolean extends V ? false : [V] extends [string \| number \| boolean] ? true : false`. |
| `IsSingleLiteral` | <Documented /> | Whether `V` is exactly one string, number or boolean literal. | Alias of `[V] extends [string \| number \| boolean] ? IsUnion<V> extends true ? false : true : false`. |
| `IsUnion` | <Documented /> | Whether `T` is a union of two or more members. | Generic alias of `T extends unknown ? [U] extends [T] ? false : true : never`. |
| `KeptMembers` | <Documented /> | The members of the argument union `E` that matcher `P` can match, as declared. This is what `next` takes, so a rewrite may change a field that the matcher pinned. | Helper type. It drops an event variant when the matcher names a key the variant lacks, or a value it cannot have. |
| `KnownKeys` | <Documented /> | The declared keys of `T`, without the string and number index signatures. | Helper type that lists the named keys of a type and ignores its index signature. |
| `LateOverload` | <Documented /> | The events whose overload must come after the rest, so that it does not shadow them. | Alias of `'classic.PreToolUse' \| 'turn.abort' \| NoArgsEvent`. These events get their type after the others, because they share a shape with others. |
| `Literal` | <Documented /> | What a matcher value selects by: itself, or `unknown` for a RegExp, which selects nothing. | Alias of `X extends RegExp ? unknown : X`. |
| `MatchedEvent` | <Documented /> | The argument that a matched hook receives: `e` narrowed by `M` (Narrowed), for each event that the registration covers. | Alias of `MatchedNames<P, M> extends infer N extends EventName ? N extends unknown ? Narrowed<Args<N>, M> : never : never`. |
| `MatchedHook` | <Documented /> | The hook that `on(pattern, matcher, hook)` takes: `($, e, next)` with `e` narrowed by the matcher (MatchedEvent). The result is tagged the same way. | Helper type for a hook that has a matcher. On a streaming event it is the generator form. `next.is` narrows as the matcher does. |
| `MatchedNames` | <Documented /> | The events that a matched registration on `P` covers: the event named. For a glob, it is every selected event whose input has each key that the matcher names. | Helper type. It lists the event names that a pattern and a matcher select together. |
| `MatchedResult` | <Documented /> | What a matched hook returns: the result of the event, narrowed by `M`. This applies where the result is a union tagged by the tag keys of the matcher. | Alias of `MatchedNames<P, M> extends infer N extends EventName ? N extends unknown ? Select<EventResult<N>, Selection<Args<N>, M>> : never : never`. |
| `MatchedStreamHook` | <Documented /> | The hook that `on(event, matcher, hook)` takes on a streaming event: the generator form. `e` is narrowed by the matcher, and `next(e)` is the stream beneath. | Alias of `($: EngineInterface, e: Frozen<MatchedEvent<P, M>>, next: MatchedStreamNext<P, M>) => StreamHookBody<Chunk<P>, MatchedResult<P, M>>`. |
| `MatchedStreamNarrowings` | <Documented /> | What `next.is(pattern, e)` of a matched streaming hook narrows `e` to: the argument of the streaming event, narrowed by the matcher. | Object with fields `[K in P]`. |
| `MatchedStreamNext` | <Documented /> | The `next` of a matched streaming hook. It has the variants that the matcher keeps and the result tagged the same way. `next.is` narrows as the matcher does. | Alias of `StreamNext<P, KeptEvent<P, M>, MatchedResult<P, M>, MatchedStreamNarrowings<P, M>>`. |
| `MatcherData` | <Documented /> | Any matcher at all, for a field typed `unknown` (the input of a tool, the output of a result). The engine accepts these kinds and does not check them there. | Union of the four matcher kinds: a scalar (`===`), a `RegExp` (tests the value as a string), an array (any of), and an object (partial match). |
| `MatcherFor` | <Documented /> | The matcher type for each pattern: a Matcher of the `e` of the event named, or of each event that a glob or a negation selects. | Helper type. It gives the matcher type for a pattern. A mistake in a name fails to compile where it is written. |
| `MatcherKeys` | <Documented /> | The declared keys of every variant of `I` (index signatures aside). | Alias of `I extends unknown ? KnownKeys<I> : never`. |
| `MatcherOne` | <Documented /> | What matches one value of type `V`, by the kinds of the runtime. A scalar leaf takes the value or a RegExp. An object takes a partial of it. | Helper type. It gives what may match one value. For an array it matches one element. |
| `MatcherValue` | <Documented /> | What a matcher gives a key whose value is `V` on this variant and `Across` over every variant. It is one MatcherOne, or an array of them matched as one-of. | Helper type. It allows one matcher or a list of matchers for a key. `{ tool: ['Bash', 'Read'] }` is valid. |
| `MatcherValueAcross` | <Documented /> | The type of key `K` across the variants of `I` that declare it, read variant by variant. MatcherValueOf reads this for a key as wide as `symbol`. | Alias of `I extends unknown ? K extends KnownKeys<I> ? I[K & keyof I] : never : never`. |
| `MatcherValueOf` | <Documented /> | The type of key `K` across the variants of `I` that declare it. It is one read of their table by key (MatcherValues), for a key that some variant declares. | Helper type. It reads the matcher type of a key across all variants of an event. |
| `MatcherValues` | <Documented /> | The type of each declared key of `I` across the variants that declare it, as one table by key. TypeScript builds the table once for each `I`, then reads it at a key. | Helper type. It joins the key entries of every event variant into one table. |
| `NarrowDepth` | <Documented /> | How many object or array levels a matcher narrows `e` through, counted as the length of a tuple. It is the own limit of the runtime, which refuses a deeper matcher. | Alias of `8`. Past it a field keeps its declared type, and nothing becomes `any`. |
| `Narrowed` | <Documented /> | `e` in a matched hook. It has the members of the argument union `E` that matcher `P` can match. Each member has the keys that `P` names narrowed to what a match implies. | Helper type. It narrows an event type with a matcher. A scalar narrows to a literal. Other keys stay as declared. |
| `NarrowedByAny` | <Documented /> | A value of declared type `V` under a one-of, folded over the tuple into `Found`: the union of what each alternative narrows `V` to (NarrowedByOne). | Helper type. It narrows by a one-of list. An alternative that cannot match adds nothing. |
| `NarrowedByOne` | <Documented /> | A value of declared type `V` under one matcher node `Q` that is not a one-of, member of `V` by member. A member that cannot match is `never`. | Helper type. It narrows by one matcher value. A `RegExp` keeps the member. An object recurses one level down. |
| `NarrowedMember` | <Documented /> | One object member `E` under object pattern `P`, `D` levels down: `never` when a key of `P` is impossible on it (ImpossibleKeys), else `E` narrowed. | Helper type. It narrows each key that the matcher names. Other keys stay as declared. |
| `NarrowedValue` | <Documented /> | A value of declared type `V` where the matcher gives `Q`, `D` levels down: NarrowedByAny under a one-of (an array), NarrowedByOne otherwise. | Helper type. It stops narrowing at a set depth, and for a field typed `unknown`, such as the input of a tool. |
| `NonEmpty` | <Documented /> | Array type `V`, of element `Item`, once some element of it is known to match: a tuple of at least one `Item`, readonly when `V` is. | Helper type. It turns an array into a non-empty tuple, so `e` is still valid where the declared array is taken. |
| `OpenMatcher` | <Documented /> | The keys that a variant with a string index signature (the input of an MCP tool) takes beyond its own. They are the key of another variant as typed there, and others free. | Object type. A wrong value for a key that an event declares (`command: 5`) fails to compile on every variant. |
| `OrderedOverloads` | <Documented /> | One call signature for each event in `Names`, intersected, with the ambiguous ones (LateOverload) after the rest: `next` for a hook that covers several events. | Helper type that orders the call forms of `next`. An empty group adds nothing. |
| `Overloads` | <Documented /> | One call signature per event in `Names`, intersected into an overload set. | Alias of `UnionToIntersection<{ [N in Names]: (e: Args<N>) => Promise<NextResult<N>>, }[Names]>`. |
| `PatternOver` | <Documented /> | The patterns that `next.is` takes in a hook that covers the events `N`: their names, `*`, a glob over one of their namespaces, or a negation. | Helper type for the first argument of `on`. A name that no event has is a compile error. |
| `Select` | <Documented /> | The members of `T` assignable to `S`, or all of `T` when none is. | Alias of `[Extract<T, S>] extends [never] ? T : Extract<T, S>`. |
| `Selected` | <Documented /> | The events that a pattern selects, as a union of names. They are the one named, every one under the namespace of a glob, or every one that a negation does not exclude. | Helper type. It turns a pattern (`*`, `!name`, `ns.*`, or a name) into the list of event names it selects. |
| `Selection` | <Documented /> | The literal that matcher `M` holds each tag key of `I` to: one-of arrays flattened, RegExps widened to `unknown`. | Object with fields `[K in keyof M & TagKeys<I, keyof M>]`. |
| `Shaped` | <Documented /> | A value kept with a shape tag, as an `atom` given `{ shape }` keeps it. A reload whose code names another tag reads the value as absent. | Object with the fields `shape` and `value`. Declare a key as `Shaped<T>` in `PluginState` when its atom names a shape. |
| `ShapedValue` | <Documented /> | What an atom given a shape reads and takes for a key declared `Shaped<T>`: `T`. For a key declared otherwise it is `never`, so that atom does not compile. | Alias of `V extends Shaped<infer T> ? T : never`. |
| `SourceValues` | <Documented /> | The values that the function of `derive` receives for its sources, in their order. They are the own value of an atom or of a derived value, and the value of a plain reference or `undefined`. | Object with fields `[I in keyof S]`. |
| `StreamHook` | <Documented /> | The hook that a streaming event takes: `async function* ($, e, next) {}`. It yields the chunks of the event and returns its result. | Helper type for a streaming hook. `return yield* next(e)` passes the stream on. `for await (const c of next(e)) yield f(c)` changes it. |
| `StreamHookBody` | <Documented /> | What a hook on a streaming event evaluates to: the async generator that an `async function*` makes. It yields `C` and returns `R` or nothing. | Object with the field `result?`. Returning nothing lets the result of the last `next(e)` stand. The hook must be a generator. |
| `TagKeys` | <Documented /> | The keys among `Among` that a matcher may use to select variants of `I`. Their values are literals in every variant, with one literal for each variant (IsDiscriminant). | Helper type. It finds the keys of a matcher that tag one event variant. |
| `UnionToIntersection` | <Documented /> | The intersection of the members of a union (`A \| B` to `A & B`), made by inferring one parameter type from the contravariant positions. | Alias of `(U extends unknown ? (member: U) => void : never) extends (member: infer I) => void ? I : never`. |

## Types with Fields

Each type below has its own table of fields.

### `Registration`

What `on(...)` returns for a hook of type `F`: the registration, which takes one `.catch` (CatchHandler). Without it a failed hook is absent. Object with the field `catch`. A second `.catch` on one registration throws. A guard should refuse in `.catch` when `next` was not called.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `catch` | <Documented /> | Sets the handler that runs when the hook throws or overruns its budget. The answer of the handler within the grace time stands as the result of the hook for the dispatch. | Type: `(handler: CatchHandler<F>) => void`. The budget is `ms` of `HookBudget` and the grace is `catchMs`. `claude plugin validate` lists each gating hook. Read-only. |

### `Next`

The rest of the chain, as one hook receives it. The engine makes it once for each dispatch for each hook. It is frozen, and `next(e)` resolves to the downstream result. Callable type. Each call runs the hooks below, with core last. A call with no argument rejects. A hook that returns without calling it ends the chain.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in N]` | <Documented /> | What `next.is` narrows `e` to, for each event `K` in `N`: an optional value of any type. | Type: `unknown`. Optional. |
| `[K in N]` | <Documented /> | The default for each event `K` in `N`: the event argument `Args<K>`. | Type: `Args<K>`. |
| `to` | <Documented /> | Continues this dispatch at a tier: `next(e)` with every link between the own tier of this hook and that tier skipped, by tier and narrowing only. | Type: `object`. Lets a managed hook skip to a lower tier. It never skips a tier with more authority, so a user hook cannot skip the tier of the organization. Read-only. |
| `signal` | <Documented /> | Aborts when the call this dispatch belongs to is abandoned. Either the user interrupted, a hook above settled first, or this hook exhausted its budget. | Type: `AbortSignal`. Anything the hook started (timers, requests) should stop on it. It is an AbortSignal of the own environment of the plugin, driven by the signal of the chain. Read-only. |
| `is` | <Documented /> | Whether `pattern` (a name, a glob, a negation) selects the event of this dispatch, as a type predicate on `e`: `next.is("tool.call", e)`. | Type: `<M extends PatternOver<N>>(pattern: M, e: unknown) => e is ...`. Narrows `e` to the events that the pattern names. A name outside the events of the hook is a compile error. Read-only. |
| `event` | <Documented /> | The name of the event of this dispatch, as a value, for a glob hook to log or switch on. | Type: `N`. Read-only. |
| `origin` | <Documented /> | Who raised this dispatch: the name of the calling plugin and the tier it sits in (Origin). The engine reads `{ plugin: "engine", tier: "core" }`. | Type: `Origin`. Only the host sets it. A plugin cannot write it. Every hook of one dispatch sees the same origin. Read-only. |
| `trace` | <Documented /> | What settled beneath this hook on its latest `next()` call, the one started last: one entry for each link beneath, nearest first, with the engine last. | Type: `readonly TraceEntry<N, E, O>[]`. Empty before a call to `next`. Read-only data. Read-only. |
| `budget` | <Documented /> | How much time this hook runs under and how much is left (NextBudget). It is read fresh on each access. HookBudget says what the clock counts. | Type: `NextBudget`. The clock stops while a `next` or `$` call of the hook is in flight. In a `.catch` handler it is the grace time. Read-only. |

### `StarNext`

`next` in a `*` hook. The set of events is open at runtime, so `e` is `unknown` until `next.is(pattern, e)` narrows it to events that it knows. Callable type with the fields `to`, `signal`, `is`, `event`, `origin`, `trace`, `budget`. It has one call form for each known event.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `to` | <Documented /> | Continues this dispatch at a tier, like `to` of Next (for a managed hook). An `e` that is still unknown resolves to `unknown`. | Type: `(e: unknown, tier: TargetTier) => Promise<unknown>`. Read-only. |
| `signal` | <Documented /> | Aborts when the call this dispatch belongs to is abandoned. Either the user interrupted, a hook above settled first, or this hook exhausted its budget. | Type: `AbortSignal`. Read-only. |
| `is` | <Documented /> | Whether `pattern` (a name, a glob, a negation) selects the event of this dispatch, as a type predicate on `e`. | Type: `<M extends Pattern>(pattern: M, e: unknown) => e is Frozen<Args<Selected<M>>>`. Read-only. |
| `event` | <Documented /> | The name of the event of this dispatch, as a value. | Type: `EventName`. Read-only. |
| `origin` | <Documented /> | Who raised this dispatch: the name of the calling plugin and its tier. | Type: `Origin`. Read-only. |
| `trace` | <Documented /> | What settled beneath this hook on its latest `next()` call: one entry for each link beneath, nearest first. | Type: `readonly TraceEntry<EventName, unknown, unknown>[]`. Read-only. |
| `budget` | <Documented /> | How much time this hook runs under and how much is left. | Type: `NextBudget`. Read-only. |

### `StreamNext`

The rest of the chain as a hook on a streaming event receives it. It is Next, except that `next(e)` is the stream beneath (HookStream), not a promise. Type with the fields `to` and `trace`. Each call opens a fresh stream, so a hook that calls it twice makes two. A hook that does not call it yields its own chunks.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in N]` | <Documented /> | What `next.is` narrows `e` to, for each event `K` in `N`: an optional value of any type. | Type: `unknown`. Optional. |
| `[K in N]` | <Documented /> | The default for each event `K` in `N`: the event argument `Args<K>`. | Type: `Args<K>`. |
| `to` | <Documented /> | Continues this dispatch at a tier, like `to` of Next: the stream beneath, with the links between the tier of this hook and that tier skipped. | Type: `(e: E, tier: TargetTier) => HookStream<Chunk<N>, O>`. Read-only. |
| `trace` | <Documented /> | What settled beneath on the latest `next()` stream, like `trace` of Next. The entry of a streaming link counts the chunks it yielded up (`chunks`). | Type: `readonly TraceEntry<N, E, O>[]`. Read-only. |

### `Caught`

What `next` carries into a `.catch` handler and nowhere else: why the hook failed, and whether it called `next` before it failed. Object with the fields `error` and `called`. Inside a `.catch` handler `next` is replay-safe. When `called`, `next(e)` returns the result of the last call.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `error` | <Documented /> | Why the hook failed (HookFailure). It is undefined on the `next` of an ordinary hook, so its presence says that a handler is running. | Type: `HookFailure`. Read-only. |
| `called` | <Documented /> | True when the failed hook called `next()` or `next.to()` at least once, settled or in flight. The handler runs after that call settles. | Type: `boolean`. Read-only. |

### `HookFailure`

Why a hook failed, as its `.catch` handler reads it on `next.error`. It is plain frozen data. Object with the fields `kind`, `message?`, `budget`. `throw` means it threw. `timeout` means it outran its budget.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `kind` | <Documented /> | `throw` when the hook threw, returned what the site refuses, or its worker ended. `timeout` when it outran its budget. | Type: `'throw' \| 'timeout'`. Read-only. |
| `message` | <Documented /> | What was thrown or why the worker ended. For a timeout, it is what the last `next()` rejected with. It is absent for a timeout with nothing rejected. | Type: `string`. Optional. Read-only. |
| `budget` | <Documented /> | The grace that the handler runs under, in milliseconds. Past it, the hook is absent as if it had no handler. | Type: `number`. Read-only. |

### `HookBudget`

The time bounds that every hook runs under, in milliseconds. These members type the constants of the engine, and `next.budget` reads the live one. Object with the fields `ms`, `catchMs`, `lingerMs`. Each bounds the own time of the hook. The clock stops during a `next(e)` or `$` call of the hook.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `ms` | <Documented /> | The budget of a hook for each dispatch, from its call to its return. Past it the hook is absent (the engine asks its `.catch`, else runs `next(e)` on its behalf). | Type: `10_000`. A streaming hook counts only the time that its own code runs, not the time at a `yield`. Read-only. |
| `catchMs` | <Documented /> | The grace of a `.catch` handler: a fresh budget from the moment the engine calls it, on the same clock. Its `next` replay and its `$` calls are free. | Type: `1_000`. Past it the hook is absent as if it had no handler. `next.error.budget` and `next.budget.ms` both read it there. `engine.create` has no budget. Read-only. |
| `lingerMs` | <Documented /> | How long a hook may keep running after `next.signal` aborted (the person interrupted, a hook above settled first, or the hook exhausted its own budget). | Type: `5_000`. Past it the engine reports the hook as lingering. The dispatch had already gone on without it when the signal aborted. Read-only. |

### `NextBudget`

The budget that the code reading `next.budget` runs under: the whole allowance and what is left of it now. It is plain data, read fresh on each access. Object with the fields `ms`, `remainingMs`. Where nothing meters the hook, `ms` is 0 and `remainingMs` is `Infinity`.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `ms` | <Documented /> | The whole budget in milliseconds, 0 where nothing meters this `next`. | Type: `number`. On `session.end` it is no more than what is left of the one short bound of the whole dispatch. Read-only. |
| `remainingMs` | <Documented /> | What is left of it now, in milliseconds. It is never below 0, and it is Infinity where nothing meters. It stands still while a `next` or `$` call is in flight. | Type: `number`. On `session.end` the clock never stops, so a later hook starts with what the earlier ones left. Read-only. |

### `TraceEntry`

One settled run of a link beneath the caller, as `next.trace` lists it: data, not a handle. Object with the fields `index`, `plugin`, `tier`, `event`, `outcome`, `reason?`, `ms`, `chunks?`, `received`, `returned`. One entry for each link in the chain.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `index` | <Documented /> | The place of the link in the chain. 0 is the outermost. | Type: `number`. Read-only. |
| `plugin` | <Documented /> | The plugin of the hook, `"engine"` for the own core or bottom of the engine. | Type: `string`. Read-only. |
| `tier` | <Documented /> | The tier of the link (Tier), `"core"` for the own core or bottom of the engine. | Type: `Tier`. Read-only. |
| `event` | <Documented /> | The event the link ran on. | Type: `N`. Read-only. |
| `outcome` | <Documented /> | What the chain decided for this link. | Type: `TraceOutcome`. Read-only. |
| `reason` | <Documented /> | Why the link was skipped without running, when it was: `bypassed by <plugin>`, whose `next.to` went beneath this tier. Absent when it ran. | Type: `string`. Optional. Read-only. |
| `ms` | <Documented /> | Its own wall time, without the time that its `next()` calls were in flight. | Type: `number`. The entry of the engine is everything beneath the last hook: in a hooks module, the host round trip. Read-only. |
| `chunks` | <Documented /> | How many chunks the link yielded up, on a streaming event. Absent on every other event. A link left mid-stream counts what it yielded before. | Type: `number`. Optional. Read-only. |
| `received` | <Documented /> | The argument the link received. | Type: `E`. Read-only. |
| `returned` | <Documented /> | What the link settled on. Undefined when it was skipped or rejected. | Type: `O \| undefined`. Read-only. |

### `Origin`

Who raised a dispatch, as `next.origin` holds it: the name of the calling plugin and the tier it sits in. The engine reads `engine` in `core`. Object with the fields `plugin`, `tier`. Names the plugin and the tier of the caller. The host sets it. A plugin cannot write it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `plugin` | <Documented /> | Whose hook made the `$` call, by name. `"engine"` for a call site. `"client"` for the `ui.message` post of a `Client` surface module. | Type: `string`. Read-only. |
| `tier` | <Documented /> | Where that plugin sits among the tiers of the chain (Tier). `"core"` for the engine. The tier of the owning plugin for a `client` post. | Type: `Tier`. Read-only. |

### `Matcher`

What `on(event, matcher, hook)` takes for an argument of type `I`: the shape of the `e` that the hook wants, as a partial of it at any depth. Type of the second argument of `on`. A leaf is `===` or a `RegExp`. An array means any of. An object is a partial match of an object.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `[K in KnownKeys<I>]` | <Documented /> | For each key of the event argument, an optional matcher value for it. | Type: `MatcherValue<I[K & keyof I], MatcherValueOf<All, K>>`. Optional. |

### `HookStream`

What `next(e)` returns on a streaming event: the stream of everything beneath, chunk by chunk. Its return value is the result from beneath. `yield* next(e)` forwards the chunks and gives the result. `$.process.spawn` and `$.turn.step` use it.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `result` | <Documented /> | Settles with what beneath returned after the stream is read to its end. Rejects if the stream is closed before that. | Type: `Promise<R>`. Read-only. |

### `HooksModule`

What a hooks module exports: `register`, and nothing else that the loader reads.

| Field | Status | What it is for | Type and limits |
| --- | --- | --- | --- |
| `register` | <Documented /> | The hooks module's entry function. | Type: `Register`. |

## Related Pages

- [Mod API Overview](../index.md)
- [Hooks and the Hook Chain](../events/hooks.md)
- [Event Table Types](events.md)
- [Mod API Types](index.md)
