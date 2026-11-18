---
title: Files, Nouns, and Gates
description: The files and manifest keys of a mod, every noun on the object $, the settings that stop mods, the limits, and the built-in mods.
sidebar_position: 3
---

A mod has a few files, one object named `$` with 20 nouns, and a short list of switches that can stop it. The tables below list them all, with the limits that apply.

The one file that makes a plugin a mod is `modules` in `hooks/hooks.json`. A manifest has no `mods` key. Mods live in the plugin folder, `plugin.json`, `hooks/hooks.json`, and settings files.

These switches stop mods: `disableAllHooks`, `allowManagedHooksOnly`, `allowManagedModsOnly`, `--safe-mode`, and `--bare`. A remote rollout switch also gates installed mods.

Official pages: [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference), [Mods Overview](https://code.claude.com/docs/en/plugins/mods/overview), [Plugins Reference](https://code.claude.com/docs/en/plugins-reference), and [Manage Mods for Your Organization](https://code.claude.com/docs/en/plugins/mods/admin).

## Example

```json title="hooks/hooks.json"
{ "modules": ["./register.js"] }
```

```json title=".claude/settings.json"
{ "disableAllHooks": false }
```

## Files and Manifest Keys

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `hooks/hooks.json` key `modules` | <Documented /> | The path of the hooks module. | One path only. The module and each file it imports end in `.ts`, `.tsx`, `.jsx`, `.js`, `.mjs`, `.cjs`, `.mts`, or `.cts`. The text in the program is "`hooks.json` `modules` names one hooks module per plugin".[^modules-text] | Plugin `hooks/` folder. |
| `register(on, options)` | <Documented /> | The export that the loader reads. The loader reads nothing else. | See [Hooks](events/hooks.md). | The hooks module. |
| Manifest key `types` | <Documented /> | Path to the type contract of the plugin. It starts with `./`. | A self-contained `.d.ts` with no import, export-from, require, or reference. It declares the noun in `declare module 'claude-code' { interface EngineInterface { ... } }` and the `PluginState` values. `claude plugin validate` checks it, and reports an error when the contract declares nouns but the module has no hook on `engine.create` by name.[^validate] `validate` also lists what the `engine.create` hook does to `$`, as `adds to $`, `adds to $ unless it's there`, `withholds from $`, and `replaces on $`, and it fails a hook that is not in the one accepted form: one hook, no matcher, a named or inline function.[^validate-form] | `plugin.json` |
| Manifest key `dependencies` | <Documented /> | Plugins that must be enabled. | A mod that lists a plugin here gets its contract at `.claude-plugin/types/<plugin>/index.d.ts` when the engine loads the mod from a folder the person owns. | `plugin.json` |
| Manifest key `userConfig` | <Documented /> | Fields whose values reach `register` as `options`. | The engine fills in defaults. Values are in `pluginConfigs` of settings. A required field with no value fails the load. `PluginOptions` is a read-only record of string, number, boolean, or string list. | `plugin.json` |
| `.claude-plugin/types/` | <Documented /> | The engine writes `claude-code/index.d.ts`, `claude-code-tools/`, `claude-code-mcp/`, and one folder for each dependency here. | The engine writes them again after an update. The engine skips a file whose text already matches, and replaces a folder that stands where a file belongs. A mod that has no tsconfig gets one that extends `.claude-plugin/types/tsconfig.json`. A mod that has a `jsconfig.json` gets no new `tsconfig.json`, and an existing `tsconfig.json` stays as it is.[^types-dir] | A mod loaded from a folder the person owns. |
| Tests `*.test.ts`, `*.test.tsx` | <Documented /> | `claude plugin test [dir]` runs them. | See [Testing](calls/testing.md). | Plugin folder. |

## The Dollar Object

`$` is the first argument of every hook. It is frozen. It has `plugin`, 20 nouns, and every noun that an `engine.create` hook added. Write each call in full, such as `$.fs.read('notes.md')`.

Each `$` call is also an event with the same name, such as `fs.read`. A hook on it can pass the call on, refuse it with `{ deny }`, or answer it with `{ value }`. The dispatch skips the calling hook alone, so a plugin does not trap itself.

| Item | Status | What it does | Members | Page |
| --- | --- | --- | --- | --- |
| `$.plugin` | <Documented /> | This plugin as loaded: its manifest name and its directory. | `name`, `root` | [Plugin](calls/plugin.md) |
| `$.ui` | <Documented /> | Display: a line under an open dialog, redraws, log lines, panes, scroll, focus, the clipboard. | `notice`, `invalidate`, `blit`, `resolve`, `log`, `ask`, `toast`, `notify`, `cancelNotify`, `status`, `open`, `close`, `panes`, `scroll`, `focus`, `copy`, `selection`, `view` | [UI](ui/ui.md) |
| `$.model` | <Documented /> | Completions through the session's own client. | `complete`, `fork`, `classify` | [Model, Audio, and MCP](calls/model-audio-mcp.md) |
| `$.audio` | <Documented /> | Sound: clip playback and platform speech. | `play`, `speak` | [Model, Audio, and MCP](calls/model-audio-mcp.md) |
| `$.mcp` | <Documented /> | The engine's MCP servers: call a tool of a connected one, or connect one the plugin lists. | `call`, `connect` | [Model, Audio, and MCP](calls/model-audio-mcp.md) |
| `$.session` | <Documented /> | The running session as plain data, compacting it, and sending a message to another agent or session. | `messages`, `cwd`, `root`, `model`, `turns`, `id`, `repo`, `surfaces`, `surface`, `usage`, `version`, `compact`, `send`, `append`, `identity` | [Session](calls/session.md) |
| `$.turn` | <Documented /> | The running model turn: ending it. | `abort` | [Turn and Prompt](calls/turn-prompt.md) |
| `$.prompt` | <Documented /> | Submitting a prompt as a user turn, and the prompt box: read, write, paint, or propose into. | `submit`, `read`, `media`, `fill`, `paint`, `suggest`, `compose` | [Turn and Prompt](calls/turn-prompt.md) |
| `$.tool` | <Documented /> | The tools the model has in this session, and running one. | `list`, `call`, `check`, `register` | [Tool, Command, and Config](calls/tool-command-config.md) |
| `$.command` | <Documented /> | The slash commands the person can run, and running one. | `list`, `run`, `register` | [Tool, Command, and Config](calls/tool-command-config.md) |
| `$.config` | <Documented /> | Every row of the `/config` menu, including each enabled plugin's `userConfig` fields. | `list`, `set` | [Tool, Command, and Config](calls/tool-command-config.md) |
| `$.telemetry` | <Documented /> | Analytics records and feature marks. | `log`, `mark` | [Telemetry](calls/telemetry.md) |
| `$.agent` | <Documented /> | Subagents. | `spawn`, `list`, `register` | [Agent](calls/agent.md) |
| `$.fs` | <Documented /> | The file system as the engine process reaches it. A relative path is under the session's working directory. Text is UTF-8. | `read`, `write`, `list`, `exists`, `stat`, `ancestors` | [Files, Store, and State](calls/fs-store-state.md) |
| `$.store` | <Documented /> | This plugin's key-value store. It lasts across sessions and hot reloads. Values are JSON. | `get`, `set`, `delete`, `keys` | [Files, Store, and State](calls/fs-store-state.md) |
| `$.state` | <Documented /> | Named values the host holds for the session, each with a version. They survive a hot reload. | `get`, `set` | [Files, Store, and State](calls/fs-store-state.md) |
| `$.clock` | <Documented /> | Time and timers, each an event through the host. | `now`, `sleep`, `after`, `every` | [Clock, HTTP, Process, Env, and Settings](calls/clock-http-process-env-settings.md) |
| `$.http` | <Documented /> | The network, through the host. | `fetch` | [Clock, HTTP, Process, Env, and Settings](calls/clock-http-process-env-settings.md) |
| `$.process` | <Documented /> | Commands on the host, run as the user of the session. CLI only. | `run`, `spawn` | [Clock, HTTP, Process, Env, and Settings](calls/clock-http-process-env-settings.md) |
| `$.settings` | <Documented /> | What the settings files, `--settings`, and managed policy hold. Read only. | `read` | [Clock, HTTP, Process, Env, and Settings](calls/clock-http-process-env-settings.md) |
| `$.env` | <Documented /> | The environment of this process. Every Bash child, MCP server, and `$.process.run` command started later inherits it. | `get`, `set` | [Clock, HTTP, Process, Env, and Settings](calls/clock-http-process-env-settings.md) |

## Modules

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `claude-code` | <Documented /> | Types only. `import type { Register, On, EngineInterface } from 'claude-code'`. At run time the import is empty. | Exports 585 declarations. The values `atom`, `derive`, `memberOf`, `read`, and `update` are the state helpers. See [Files, Store, and State](calls/fs-store-state.md#state-helpers-imported-from-claude-code). | Hooks modules and contracts. |
| `claude-code/testing` | <Documented /> | The kit for `claude plugin test`: `test`, `describe`, `expect`, `mock`, `tier`. | See [Testing](calls/testing.md). | `*.test.ts` and `*.test.tsx` |
| Globals `h`, `Fragment`, `JSX` | <Documented /> | JSX compiles against them. | See [Surfaces, Elements, and Render Sites](ui/ui-elements.md#jsx-and-globals). | Files with JSX. |

## Gates That Stop Mods

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `disableAllHooks` | <Differs note="The schema also says it stops the statusLine command. The Hooks Reference names only hooks." /> | No mod or hook of an installed plugin runs. Built-in mods load. | Row: [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys). | Settings files. |
| `allowManagedHooksOnly` | <Documented /> <ManagedOnly /> | Blocks hooks and mods that are not the organization's. | The text in the program is "hooks modules are turned off here (`disableAllHooks`, `allowManagedHooksOnly` or a policy)".[^off-text] Row: [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys). | Managed settings. |
| `allowManagedModsOnly` | <Documented /> | Only organization mods and built-in mods run their hooks. | An option of the built-in guard `sec-default`. | Managed settings. |
| `allowModsToOverrideDenyRules` | <Documented /> | Lets an installed mod approve a call that a `deny` rule refuses. | An option of the built-in guard. | Managed settings. |
| `prependPlugins`, `appendPlugins` | <Differs note="Docs say user or managed scope. The schema says managed only." /> <ManagedOnly /> | Plugin ids that run before or after user mods. Since `2.1.327`, they set the order only: an organization plugin that neither list names is in `prepend`, after the listed ones. | Only plugins in these tiers can call `next.to`. Rows: [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys). | Managed settings. |
| `disableSideloadFlags` | <Documented /> <ManagedOnly /> | Rejects `--plugin-dir` and `--plugin-url`. | Row: [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys). | Managed settings. |
| `--safe-mode`, `--bare` | <Documented /> | No installed hooks module loads. | The text in the program is "installed plugins are disabled, none of their hooks or hooks modules load, built-in plugins load regardless".[^safe-mode-text] | CLI flags. |
| Rollout switch | <Gated note="Remote flag" /> | Installed hooks modules wait for a rollout flag. A message says installed mods are turned off remotely.[^rollout-gate] | Built-in plugins and organization plugins load regardless. | Installed plugins. |
| `CLAUDE_CODE_PLUGIN_DIRS`, `CLAUDE_CODE_PLUGIN_DIR_WATCH` | <Documented /> | Load plugin dirs as `--plugin-dir` does. Reload on save: on by default in interactive sessions, off in print mode for `--plugin-dir` folders unless set to `1`. Print mode reloads mods in `.claude/skills` unless set to `0` [^v321] | None. | Environment. |
| Mods that Claude writes | <Documented /> | A mod that Claude writes into the project turns on without a question in `auto` and `bypassPermissions` modes, also under managed `allowUnsandboxedCommands: false` or `allowManagedDomainsOnly`. It does not load in `dontAsk` mode. | See the sources.[^written-mods] | Project mods, by permission mode. |

## Limits

Hooks and Mod API calls run under time and size limits. Claude Code skips a hook that is too slow.

| Limit | Value |
| --- | --- |
| Own time of one hook for one event | 10 seconds, or 50 milliseconds for a `prompt.edit` hook (the event sets it)[^prompt-edit] |
| A `.catch` handler | 1 second |
| All `session.end` hooks together | 1.5 seconds unless you change the `SessionEnd` hook budget |
| `$.process.run` | 30 seconds by default, 10 minutes at most |
| `$.model.complete` `maxTokens` | 1024 by default, up to 64,000 or the output limit of the model |
| `$.fs.read` and `$.fs.write` | 4 MiB for one file |
| `$.http.fetch` body and response | 4 MiB each, 30 seconds, 5 redirects |
| `$.store` | 4 MiB of JSON in all |
| `$.session.messages()` | The newest 4,096 entries |
| `$.ui.invalidate('ui.render')` | 10 redraws a second, or 30 in the terminal for the visible pane |
| `$.ui.toast` | 4 seconds unless you pass `timeoutMs` |
| A pane that nobody asked for | Placed from 144 terminal columns, 110 after the person opened it once |
| Names of commands, tools, subagent types, and panes | Letters, digits, `_`, and `-`, up to 64 characters |
| One `claude plugin test` test | 5 seconds unless the test sets `timeoutMs` |

## Built-In Mods

Claude Code `2.1.316` registers up to 13 built-in plugins at start.[^registry] Each id is `cc-plugin-<name>@builtin`. The settings and flags that stop installed mods do not stop them.

| Name in `/plugin` | What it does | Registered when |
| --- | --- | --- |
| `cc-plugin-sec-default` | Guards what your organization manages from the mods a user installs. You cannot turn it off. | Always |
| `cc-plugin-agents-md` | Loads `AGENTS.md` as project instructions. | Always |
| `cc-plugin-telemetry` | Sends the analytics records that Claude Code and its built-in mods log. | Always |
| `cc-plugin-plugin-authoring` | Gives Claude the `plugin-authoring` skill for writing mods. It holds no mod code. | `CLAUDE_CODE_ENTRYPOINT` is not `local-agent` |
| `cc-plugin-mods-guide` | Shows a small panel over the question card when Claude explains how mods work, until you answer the card. | `CLAUDE_CODE_ENTRYPOINT` is not `local-agent` |
| `cc-plugin-tips` | Shows the tip line under the spinner while Claude works, picked once a turn from the tips that fit the session.[^tips-mermaid] | Not `local-agent`, and the entry point does not start with `remote` |
| `cc-plugin-mermaid` | Draws the flowcharts and sequence diagrams in a reply's `mermaid` code fences in place, as box-drawing text.[^tips-mermaid] | Not `local-agent`, and the entry point does not start with `remote` |
| `cc-plugin-responsive-mode` | Claude replies in one sentence before it thinks or uses tools, on every prompt. | Normal run, or the `remote` entry point |
| `cc-plugin-diff` | Takes over `/diff` and draws its pane. | Not `local-agent`, and the entry point does not start with `remote` |
| `cc-plugin-you-should-know` | Displays a note above the prompt when a side agent finds something you might have missed. Off until you turn it on. | `CLAUDE_CODE_ENTRYPOINT` is not `local-agent` |
| `cc-plugin-easel` | Draws charts in the transcript. | Normal run, or the `remote_cowork` entry point |
| `cc-plugin-claude-platform` | A built-in plugin of the same registry. | Normal run |
| `cc-plugin-claude-test` | A built-in plugin of the same registry. | Normal run |
| `cc-plugin-privacy` | Refuses a call when it sends your account email as the identity of a client, for example beside a User-Agent. Since `2.1.326`, it checks `Write`, `Edit`, `NotebookEdit`, `WebFetch`, and MCP tool calls, and the script files that a shell call names, and not only `Bash`, `Monitor`, and `PowerShell` calls. It refuses with a deny and does not ask you. The refusal tells Claude to use a generic client name, to ask you for a real contact that a site needs, and that you can set the address in an environment variable or run the command yourself with `!`. | A server gate, which is on by default[^privacy-gate] |

The `cc-plugin-privacy` check is a `tool.check` hook, and it reads the account email with `session.identity`. It looks for `curl -A`, `wget -U`, a `--user-agent` or `-user` option, `user-agent`, `user_agent`, or `ua:` text, a `From` header, and text such as `set_identity`, `mailto=`, or `--identity`. It also tests the percent-encoded `%40` form of the address, and a `git config user.email` or `GIT_AUTHOR_EMAIL` text in a line that has such an identity. A `WebFetch` call is refused when its `url` holds the address. For a shell call, the hook reads up to 8 script files that the command names, in the working folder and without links, and checks their text the same way. The hook also answers `session.identity` for other mods: it denies a mod of the `user` tier, and it removes `contextEmail` from the answer for a mod of any tier but `builtin`. The plugin sets `defaultEnabled: true` and `enabledFromTrustedSettingsOnly`.[^privacy]

"Normal run" means the entry point is not `local-agent` and does not start with `remote`. A plugin can also hide itself with its own `isAvailable` test. For example, `cc-plugin-easel` needs Linux or macOS and no `hipaa` or `zdr` data policy.[^easel]

### Enable Test

Claude Code decides each built-in plugin in this order.[^enable-order]

1. A plugin that fails `isAvailable`, or that failed to load, is not listed.
2. With `enabledFromPolicyOnly`, only the policy settings value of `cc-plugin-<name>@builtin` counts.
3. With `enabledFromTrustedSettingsOnly`, only the trusted settings value counts. `cc-plugin-sec-default` sets both flags. `cc-plugin-privacy` sets only this one.
4. Otherwise the `enabledPlugins` key of your settings counts. A plugin that a directory you added with `--add-dir` also lists is read by the loader for that case.
5. A value that is set decides: only `true` turns the plugin on. With no value, the plugin uses its `defaultEnabled`, and that is `true` when the plugin sets none.

Only `cc-plugin-sec-default` sets both policy-only flags. `cc-plugin-privacy` sets `enabledFromTrustedSettingsOnly`, and it has set it since at least `2.1.322`. The other built-in plugins read `enabledPlugins` from your settings.[^enabled-plugins] Only `cc-plugin-responsive-mode` and `cc-plugin-you-should-know` set `defaultEnabled: false`. To turn one on, set its id as the key:

```json
{
  "enabledPlugins": {
    "cc-plugin-you-should-know@builtin": true
  }
}
```

See [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys) for `enabledPlugins`.

`cc-plugin-responsive-mode` sets `defaultEnabled: false`. It is also available only outside the Teams surface, and only while a server gate that you cannot set is on.[^responsive] So turn it on with `enabledPlugins` and expect it to be missing when the gate is off.

## Related Pages

- [Mod API Overview](index.md)
- [Hooks, `on`, and `next`](events/hooks.md)

## Sources

[^modules-text]: The program, `chunk-ja5z738t.js:58235`.
[^validate]: The program, `chunk-ke2xb8ty.js:49355`.
[^validate-form]: The program, `chunk-m14bt1pz.js:974992` and `chunk-ke2xb8ty.js:43773`.
[^types-dir]: The program, `chunk-m14bt1pz.js:4997583`.
[^off-text]: The program, `chunk-3v3y00c0.js:3230`.
[^safe-mode-text]: The program, `chunk-m14bt1pz.js:5018302`.
[^v321]: [`2.1.321` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321).
[^written-mods]: [`2.1.321` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321). The program, `chunk-svvp5w6a.js:5707`.
[^prompt-edit]: The program, `chunk-b0yr0k8v.js:193534`.
[^registry]: The program, `chunk-syz79m2z.js:0`, the start function that calls the registry one plugin at a time.
[^rollout-gate]: The program (`2.1.327`), the gate `tengu_plugin_hooks_modules` at `chunk-asj6f58y.js:758548` and the message at `chunk-3v3y00c0.js:3084`.
[^tips-mermaid]: The program (`2.1.327`), `chunk-4mdk5bh7.js:276-277` for the tips description and `chunk-x2aesrg6.js:185` for the Mermaid description.
[^privacy-gate]: The program, `chunk-9w197n8j.js:6439`. The gate is `tengu_wise_newt`.
[^privacy]: The program, `chunk-9w197n8j.js:8065` for the match, the refusal text at `chunk-9w197n8j.js:8751`, the `tool.check` hook at `chunk-9w197n8j.js:10610`, and the `session.identity` hook at `chunk-9w197n8j.js:11294`.
[^easel]: The program, `chunk-syz79m2z.js:0`.
[^enable-order]: The program, `chunk-dafpvz32.js:80614`.
[^enabled-plugins]: The program, `chunk-4zn1ct5c.js:31994`, `chunk-9w197n8j.js:11965`, `chunk-dafpvz32.js:80614`.
[^responsive]: The program, `chunk-rknqan46.js:583`.
