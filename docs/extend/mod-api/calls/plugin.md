---
title: Plugin and Engine
description: The $.plugin noun, the plugin.register and engine.create events, and the types that describe a plugin and the engine object.
sidebar_position: 5
---

`$.plugin` names the plugin.
`plugin.register` lets a mod refuse another module.
`engine.create` builds `$` and lets a mod add a noun.
A plugin ships the types of its noun in the `.d.ts` file that `types` names in `plugin.json`.

Return `{ refuse }` from `plugin.register` to keep a module out. `plugin.json` names the `types` file.

Official page: [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.323 program (`schemas/claude-code.d.ts`).

## Example

This hook keeps user mods out.

```javascript
on("plugin.register", { tier: "user" }, () => ({ refuse: "managed only" }));
```

This `engine.create` hook adds a noun.

```javascript
on("engine.create", async ($, e, next) => {
  const built = await next(e);
  return { ...built, voice: { say: async (text) => {} } };
});
```

## Members of the Plugin Noun

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.plugin.name` | <Documented /> | The name from `plugin.json`. Debug-log and `$.ui.log` lines carry it. | Type `string`. | Anywhere in the module (a plain value). |
| `$.plugin.root` | <Documented /> | The plugin's directory (the one holding `plugin.json`), absolute. | Type `string`. | Anywhere in the module (a plain value). |

## Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `plugin.register` | <Documented /> | Fires once for each hooks module about to join the chain, at load and at reload. Core allows by default. | Input `PluginRegisterInput`. Result `PluginRegisterResult`: `{ allow: true }` or `{ refuse }`. A refused module never joins. The engine skips a judge that fails, and the module joins. | Hook via `on('plugin.register', ...)`. |
| `engine.create` | <Documented /> | Runs while the engine builds `$`, once per load or reload of this plugin, before any other hook of it. `next(e)` resolves to `$` built so far. | Input `EngineCreateInput`. Result `EngineCreateResult`. A step may add nouns to `$` only when the hook names `engine.create`: a `*`, namespace, or negated hook only observes ([v2.1.323 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.323)). If no hook names `engine.create`, `claude plugin validate` reports that the plugin never adds nouns (the program, `chunk-xq1041h8.js:43699`). Outside `user` it may also withhold nouns. If it replaces another plugin's noun, it fails and the plugin unloads. | Hook via `on('engine.create', ...)`. |

## Types

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `CoreEngineInterface` | <Documented /> | The plugin's identity (`plugin`) and the nouns core adds to `$` as the innermost step of the `engine.create` fold. | A finished `$` has every core noun that no outer step withheld and every noun that plugins added. |
| `EngineCreateInput` | <Documented /> | The input of `engine.create`. | Field `plugins`: the modules this fold builds, first outermost (managed plugins first, so an organization plugin's withholding wins). At a first load it is all plugins. At a reload it is this plugin only. Write the hook after `next`: `const built = await next(e)`. |
| `EngineCreateResult` | <Documented /> | What an `engine.create` hook returns: `$` as built so far with this plugin's nouns added, less any it withheld. | `EngineInterface` plus a record of nouns. Every declared noun is optional here. |
| `EngineInterface` | <Documented /> | `$`, the first parameter of every hook. Frozen. | A plugin adds a noun by declaration merging: `declare module "claude-code" { interface EngineInterface { voice: Voice } }`. |
| `EngineInterfaceBuilt` | <Documented /> | What `next(e)` resolves to at `engine.create`: `$` as the steps beneath built it. | Open to nouns no declaration names yet. A withheld noun is a stub on it. |
| `NoEngineInterface` | <Documented /> | What an `engine.create` hook gets as `$`: nothing. | Every property reads as `never`, so `$.model` inside the hook is a compile error. |
| `INSTRUCTION_FILE_KINDS` | <Documented /> | Every tier an instruction file can belong to. | `["managed", "user", "project", "local", "memory"]` |
| `InstructionFile` | <Documented /> | One instruction file behind the `claudeMd` block. | `path` (absolute), `kind`, `content` (comments and front matter already stripped), and `parent?` (the file whose `@` import brought this one). |
| `InstructionFileKind` | <Documented /> | The tier of an instruction file. | One of the values of `INSTRUCTION_FILE_KINDS`. |
| `PluginOptions` | <Documented /> | A plugin's options as `register(on, options)` gets them: the values of its `userConfig` fields, defaults filled in. | A read-only record of string, number, boolean, or string list. Stored in `pluginConfigs[<plugin>].options` of settings. |
| `PluginRegisterInput` | <Documented /> | The input of `plugin.register`: one hooks module about to load. The type pins every field. | `name`, `tier` (never `core`), `root`, `version?`, `provenance` (`<name>@<marketplace>`, `<name>@inline` for `--plugin-dir`, `<name>@builtin`), and `uses`. |
| `PluginRegisterResult` | <Documented /> | What a `plugin.register` hook returns. | `{ allow: true }` lets the module load. `{ refuse: reason }` stops it. The debug log names the plugin and the reason. |
| `PluginRegisterUses` | <Documented /> | What a hooks module uses, as the host scanned its source. These are the lists `claude plugin validate` prints. | `events` (the patterns of the `on` calls), `calls` (`noun.method`), `env?` (names in `$.env.get` and `$.env.set`), `state?` (`{ plugin, key }`). A module that spells `on`, `$`, `$.env`, or a `$.state` reference in a non-literal way does not load. |
| `PluginStamp` | <Documented /> | Whose element: the plugin whose hook drew it. The runtime stamps it. | Field `plugin`. Two plugins under one `hover.scope` string never share a group. |
| `PluginState` | <Documented /> | The named values plugins keep in the session (`$.state`), by plugin name and key. Empty by default. | A plugin declares its keys by declaration merging. Example: `interface PluginState { swarm: { workers: Worker[] } }`. |

## Related Pages

- [Mod API Overview](../index.md)
- [Hooks and the Hook Chain](../events/hooks.md)
- [Files, Nouns, and Gates](../nouns-and-gates.md)
