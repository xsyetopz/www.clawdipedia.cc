---
title: Plugin and Engine
description: The $.plugin noun, the plugin.register and engine.create events, and the types that describe a plugin and the engine object.
sidebar_position: 5
---

`$.plugin` names the plugin. The `plugin.register` event lets a mod refuse another module. The `engine.create` event builds `$` and lets a mod add a noun.

Return `{ refuse }` from `plugin.register` to keep a module out. To ship the types of a new noun, put them in a `.d.ts` file and name it as `types` in `plugin.json`.

Official page: [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference).[^types]

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
| `$.plugin.root` | <Documented /> | The plugin's directory (the one holding `.claude-plugin/plugin.json`), absolute. | Type `string`. | Anywhere in the module (a plain value). |

## Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `plugin.register` | <Documented /> | Fires once for each plugin about to load, with a hooks module or without one, at load and at reload. Core allows by default. | Input `PluginRegisterInput`. Result `PluginRegisterResult`: `{ allow: true }` or `{ refuse }`. A refused plugin never joins, and none of its other parts take effect: command hooks, MCP and LSP servers, skills, commands, agents, output styles, themes, monitors, settings, and `bin/` (a monitor armed before the refusal runs on). The engine skips a judge that fails, and the plugin joins. Since `2.1.326`, a hook narrows what loads: pass `provides` on with entries removed, and those parts stay out while the rest load.[^provides] | Hook via `on('plugin.register', ...)`. |
| `engine.create` | <Documented /> | Runs while the engine builds `$`, once per load or reload of this plugin, before any other hook of it. `next(e)` resolves to `$` built so far. | Input `EngineCreateInput`. Result `EngineCreateResult`. A step may add nouns to `$` only when the hook names `engine.create`: a `*`, namespace, or negated hook only observes.[^v323] If no hook names `engine.create`, `claude plugin validate` reports that the plugin never adds nouns.[^validate] In the `prepend` and `append` tiers it may also withhold nouns. If it replaces another plugin's noun, it fails and the plugin unloads. | Hook via `on('engine.create', ...)`. |

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
| `InstructionFile` | <Documented /> | One instruction file behind the `claudeMd` block. | `path` (absolute), `kind`, `content` (comments and front matter already stripped), `parent?` (the file whose `@` import brought this one), and `isUnverified?` (`true` where this session's own account could have written the file, or a person's own plugin or one in the `builtin` tier added or rewrote a `managed` file; the host sets it). |
| `InstructionFileKind` | <Documented /> | The tier of an instruction file. | One of the values of `INSTRUCTION_FILE_KINDS`. |
| `PluginOptions` | <Documented /> | A plugin's options as `register(on, options)` gets them: the values of its `userConfig` fields, defaults filled in. | A read-only record of string, number, boolean, or string list. Stored in `pluginConfigs[<plugin>].options` of settings. |
| `PluginRegisterInput` | <Documented /> | The input of `plugin.register`: one hooks module about to load. The type pins every field. | `name`, `tier` (never `core`; the tier the plugin is judged in, which for a hooks module is where its hooks stand in the chain), `root`, `version?`, `provenance` (`<name>@<marketplace>`, `<name>@inline` for `--plugin-dir`, `<name>@builtin`), and `uses`. Since `2.1.326` it also holds `provides` (`PluginProvides`), `unread` (the kinds whose list may be short because the host could not read something), and `requiredByOrganization?` (`true` where the app that started the session handed over the plugin by path and said its organization requires or auto-installs it; it gives no permission). Since `2.1.327`, `requiredByOrganization` sets `tier` for a plugin with no hooks module only, and it moves neither the tier of a module nor the tier that the `provider` of an event reads.[^v2327] Every field is pinned but `provides`, which only narrows. |
| `PluginProvides` | <Documented /> | Since `2.1.326`, what a plugin provides, kind by kind, as the host read it off the folder of the plugin: the lists that `claude plugin validate` prints. | Lists `modules`, `hooks`, `mcpServers`, `lspServers`, `monitors`, `skills`, `commands`, `agents`, `outputStyles`, `themes`, `workflows`, and `bin`. Text is as written, before `${}` expansion, with no env, headers, or option values. A `url`, and a `target` that is a URL, lose their login, query, and fragment. A list with an entry removed is an allowlist for its kind. A list that is not a subset of the one received is refused, and so is `themes` or `bin` narrowed. Settings are not listed. |
| `PluginHookEntry` | <Documented /> | Since `2.1.326`, one settings hook that a plugin ships (`hooks.json` or the `hooks` of its manifest). | Fields `event`, `matcher?`, and `type`: `command` (`command`, `args?`), `http` (`url`), `prompt` or `agent` (`prompt`), or `mcp_tool` (`server`, `tool`). |
| `PluginRegisterResult` | <Documented /> | What a `plugin.register` hook returns. | `{ allow: true }` lets the module load. `{ refuse: reason }` stops the whole plugin. The debug log names the plugin and the reason. |
| `PluginRegisterUses` | <Documented /> | What a hooks module uses, as the host scanned its source. These are the lists `claude plugin validate` prints. | `events` (the patterns of the `on` calls), `calls` (`noun.method`), `env?` (names in `$.env.get` and `$.env.set`), `state?` (`{ plugin, key }`). A module that spells `on`, `$`, `$.env`, or a `$.state` reference in a non-literal way does not load. |
| `PluginStamp` | <Documented /> | Whose element: the plugin whose hook drew it. The runtime stamps it. | Field `plugin`. Two plugins under one `hover.scope` string never share a group. |
| `PluginState` | <Documented /> | The named values plugins keep in the session (`$.state`), by plugin name and key. Empty by default. | A plugin declares its keys by declaration merging. Example: `interface PluginState { swarm: { workers: Worker[] } }`. |

## Related Pages

- [Mod API Overview](../index.md)
- [Hooks and the Hook Chain](../events/hooks.md)
- [Files, Nouns, and Gates](../nouns-and-gates.md)

## Sources

[^types]: The program, the Mod API type file loaded at `chunk-gf0qnxzg.js:257`, published as `schemas/claude-code.d.ts`, `CoreEngineInterface`, `EngineCreateInput`, `EngineCreateResult`, `EngineInterface`, `EngineInterfaceBuilt`, `NoEngineInterface`, `INSTRUCTION_FILE_KINDS`, `InstructionFile`, `InstructionFileKind`, `PluginOptions`, `PluginRegisterInput`, `PluginProvides`, `PluginHookEntry`, `PluginRegisterResult`, `PluginRegisterUses`, `PluginStamp`, and `PluginState`.
[^provides]: The program, `chunk-m14bt1pz.js:241756`.
[^v323]: [`2.1.323` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.323).
[^validate]: The program, `chunk-ke2xb8ty.js:49355`.
[^v2327]: The program, the Mod API type file loaded at `chunk-gf0qnxzg.js:257`, the text of `PluginRegisterInput` and `Tier`.
