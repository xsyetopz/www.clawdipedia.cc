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

Each `$` call is also an event with the same name, such as `fs.read`. A hook on it can pass the call on, refuse it with `{ deny }`, or answer it with `{ value }`. The dispatch skips the calling hook, so a plugin does not trap itself. A person's hooks do not hear a call that an organization's mod makes, or what is raised beneath it while it runs.[^v328-tier-calls]

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
| `allowManagedModsOnly` | <Documented /> | Only organization mods and built-in mods run their hooks. | An option of the built-in guard `sec-default`. An app that embeds Claude Code can also switch it on through the plugin options that it passes.[^embed-mods-only] | Managed settings. |
| `allowModsToOverrideDenyRules` | <Documented /> | Lets an installed mod approve a call that a `deny` rule refuses. | An option of the built-in guard. | Managed settings. |
| `prependPlugins`, `appendPlugins` | <Differs note="Docs say user or managed scope. The schema says managed only." /> <ManagedOnly /> | Plugin ids that run before or after user mods. They set the order only: an organization plugin that neither list names is in `prepend`, after the listed ones. | Only plugins in these tiers can call `next.to`. Rows: [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys). | Managed settings. |
| `disableSideloadFlags` | <Documented /> <ManagedOnly /> | Rejects `--plugin-dir` and `--plugin-url`. | Row: [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys). | Managed settings. |
| `--safe-mode`, `--bare` | <Documented /> | No installed hooks module loads. | The text in the program is "installed plugins are disabled, none of their hooks or hooks modules load, built-in plugins load regardless".[^safe-mode-text] | CLI flags. |
| Rollout switch | <Gated note="Remote flag" /> | Installed hooks modules wait for a rollout flag. A message says installed mods are turned off remotely.[^rollout-gate] | Built-in plugins and organization plugins load regardless. | Installed plugins. |
| `CLAUDE_CODE_PLUGIN_DIRS`, `CLAUDE_CODE_PLUGIN_DIR_WATCH` | <Documented /> | Load plugin dirs as `--plugin-dir` does. Reload on save: on by default in interactive sessions, off in print mode for `--plugin-dir` folders unless set to `1`. Print mode reloads mods in `.claude/skills` unless set to `0` | None. | Environment. |
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

Claude Code registers up to 14 built-in plugins at start.[^registry] Each id is `<name>@builtin`, and the name is `cc-plugin-<name>` for every plugin but `claude-platform`. The settings and flags that stop installed mods do not stop them.

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
| `cc-plugin-easel` | Draws charts in the transcript. | Normal run, the `remote_cowork` entry point, or a cloud worker session[^easel-worker] |
| `claude-platform` | Connects Claude to the Claude Platform developer docs, and offers the `claude-api` skill. Its name has no `cc-plugin-` prefix.[^platform-name] | Normal run |
| `cc-plugin-privacy` | Refuses a call when it sends your account email as the identity of a client, for example beside a User-Agent. It checks `Write`, `Edit`, `NotebookEdit`, `WebFetch`, and MCP tool calls, and the script files that a shell call names, as well as `Bash`, `Monitor`, and `PowerShell` calls.[^privacy-scope] It refuses with a deny and does not ask you. The refusal tells Claude to use a generic client name, to ask you for a real contact that a site needs, and that you can set the address in an environment variable or run the command yourself with `!`. It lets the MCP call of a settings hook pass. | A server gate, which is on by default[^privacy-gate] |
| `cc-plugin-hipaa-default` | In HIPAA mode, refuses a call that a plugin or a settings hook makes itself, unless it is the organization's. It refuses a call to an MCP tool that an administrator blocked, and a call to a tool, a file, or a process that a managed deny rule covers. Only policy settings can turn it off.[^hipaa-default] | Always. It is available only in HIPAA mode, or when the policy answer is missing under a HIPAA record. |

The `cc-plugin-privacy` check is a `tool.check` hook, and it reads the account email with `session.identity`. It looks for `curl -A`, `wget -U`, a `--user-agent` or `-user` option, `user-agent`, `user_agent`, or `ua:` text, a `From` header, and text such as `set_identity`, `mailto=`, or `--identity`. It also tests the percent-encoded `%40` form of the address, and a `git config user.email` or `GIT_AUTHOR_EMAIL` text in a line that has such an identity. A `WebFetch` call is refused when its `url` holds the address. For a shell call, the hook reads up to 8 script files that the command names, in the working folder and without links, and checks their text the same way. The hook also answers `session.identity` for other mods: it denies a mod of the `user` tier, and it removes `contextEmail` from the answer for a mod of any tier but `builtin`. The plugin sets `defaultEnabled: true` and `enabledFromTrustedSettingsOnly`.[^privacy]

"Normal run" means the entry point is not `local-agent` and does not start with `remote`. A plugin can also hide itself with its own `isAvailable` test. For example, `cc-plugin-easel` needs a feature flag that is off by default, Linux or macOS, no managed `managed-mcp.json` file, and no `hipaa` or `zdr` data policy.[^easel]

### Enable Test

Claude Code decides each built-in plugin in this order.[^enable-order]

1. A plugin that fails `isAvailable`, or that failed to load, is not listed.
2. With `enabledFromPolicyOnly`, only the policy settings value of `cc-plugin-<name>@builtin` counts.
3. With `enabledFromTrustedSettingsOnly`, only the trusted settings value counts. `cc-plugin-sec-default` sets both flags. `cc-plugin-privacy` sets only this one. `cc-plugin-hipaa-default` sets both, like `cc-plugin-sec-default`.
4. Otherwise the `enabledPlugins` key of your settings counts. A plugin that a directory you added with `--add-dir` also lists is read by the loader for that case.
5. A value that is set decides: only `true` turns the plugin on. With no value, the plugin uses its `defaultEnabled`, and that is `true` when the plugin sets none.

Only `cc-plugin-sec-default` and `cc-plugin-hipaa-default` set both policy-only flags. `cc-plugin-privacy` sets `enabledFromTrustedSettingsOnly`. The other built-in plugins read `enabledPlugins` from your settings.[^enabled-plugins] Only `cc-plugin-responsive-mode` and `cc-plugin-you-should-know` set `defaultEnabled: false`. To turn one on, set its id as the key:

```json
{
  "enabledPlugins": {
    "cc-plugin-you-should-know@builtin": true
  }
}
```

See [Hooks, Plugins, and Skills Settings](../../configure/settings/hooks-and-plugins.md#keys) for `enabledPlugins`.

`cc-plugin-responsive-mode` sets `defaultEnabled: false`. It is also available only outside the Slack and Teams entry points and background, daemon, or teammate sessions, and only while a server gate that you cannot set is on.[^responsive] So turn it on with `enabledPlugins` and expect it to be missing when the gate is off.

## Related Pages

- [Mod API Overview](index.md)
- [Hooks, `on`, and `next`](events/hooks.md)

## Sources

[^modules-text]: The program, `chunk-jkpzhr7r.js:57159`.
[^validate]: The program, `chunk-eyez668q.js:50642`.
[^validate-form]: The program, `chunk-56bhcxay.js:1014972` and `chunk-eyez668q.js:45018`.
[^types-dir]: The program, `chunk-56bhcxay.js:5110139`.
[^embed-mods-only]: The program, `chunk-jkpzhr7r.js:165565` (the list of policy plugin options, `allowManagedModsOnly` and `forceHotReloadPrompt`) and `chunk-jkpzhr7r.js:166026` (the copy of those options, when boolean, from the settings it is given into the policy plugin options).
[^off-text]: The program, `chunk-xqszk37f.js:3236`.
[^safe-mode-text]: The program, `chunk-56bhcxay.js:5131025`.
[^written-mods]: The program, `chunk-4ekmrthb.js:5707`.
[^prompt-edit]: The program, `chunk-syremzmn.js:194600`.
[^registry]: The program, `chunk-pk4bzvs1.js:482` (`oLe`), the start function that calls the registry one plugin at a time. It lists 14 plugins.
[^hipaa-default]: The program, `chunk-d3mbd1zj.js:7611` for the description and the flags, `chunk-ym16qx7x.js:288` for `isAvailable` (`Cgt`, which reads `wo("hipaa")`), and `chunk-nvvfbx3p.js:3241` for the missing-answer check (`Bmo`).
[^easel-worker]: The program, `chunk-pk4bzvs1.js:1825`. The plugin also registers when the session is a cloud worker: `CLAUDE_CODE_REMOTE` is `true` and `CLAUDE_CODE_ENVIRONMENT_KIND` is unset (`un`, `chunk-427dvgs1.js:2337`), the entry point is `remote`, `remote_desktop`, or `remote_projects`, and `CLAUDE_CODE_REMOTE_SESSION_ID` is set. It also registers for a self-hosted runner child with one of these entry points. `chunk-56bhcxay.js:850283` holds the test, and `chunk-374y7r0w.js:7888` and `chunk-374y7r0w.js:8083` hold the entry points (`C`, then `Nin`: the entries of `C` that start with `remote`, less `remote_cowork` and `remote_mobile`).
[^platform-name]: The program, `chunk-2jfxv5rx.js:24737` (`var a="claude-platform"`). The program has no `cc-plugin-claude-test` registry call; `chunk-9n6y18w2.js:15430` only cleans an old data folder of it.
[^rollout-gate]: The program, the gate `tengu_plugin_hooks_modules` at `chunk-xethrx83.js:728148` and the message at `chunk-xqszk37f.js:3090`.
[^tips-mermaid]: The program, `chunk-bgvyhd4f.js:8511` for the tips description and `chunk-3jdt5qfx.js:6996` for the Mermaid description. Each plugin sits behind a gate, `tengu_tips_mod` and `tengu_mermaid_mod`.
[^privacy-gate]: The program, `chunk-vaa1bcfr.js:6712`. The gate is `tengu_wise_newt`.
[^privacy-scope]: The program, `chunk-vaa1bcfr.js:8625` (the tool list and the script read). The program, `chunk-vaa1bcfr.js:10964`, lets a call through when `origin.hookOwner` is set (the MCP call of a settings hook).
[^privacy]: The program, `chunk-vaa1bcfr.js:8338` for the match, the refusal text at `chunk-vaa1bcfr.js:9024`, the `tool.check` hook at `chunk-vaa1bcfr.js:10883`, and the `session.identity` hook at `chunk-vaa1bcfr.js:11596`.
[^easel]: The program, `chunk-pk4bzvs1.js:482` (the normal run test, `i`), and `chunk-6sr15enc.js:6918` (`isAvailable`: the flag from `chunk-6sr15enc.js:6636`, `tengu_joyful_otter` with default `false`, the platform, the managed MCP file test that `chunk-56bhcxay.js:4779557` sets and `chunk-56bhcxay.js:4775552` runs, and the data policies).
[^enable-order]: The program, `chunk-e3mrctpm.js:77246`.
[^enabled-plugins]: The program, `chunk-yznsjrsv.js:32811`, `chunk-vaa1bcfr.js:12267`, `chunk-d3mbd1zj.js:7611` (`cc-plugin-hipaa-default`, named at `chunk-ym16qx7x.js:357`), `chunk-e3mrctpm.js:77246`.
[^responsive]: The program, `chunk-czf317f1.js:583` (`_Ls`: the session test, the Slack and Teams test, and the gate `tengu_quiet_ember`), `chunk-374y7r0w.js:8270` (`OM`), and `chunk-374y7r0w.js:4628` (`PBe`).
[^v328-tier-calls]: The type file `schemas/claude-code.d.ts`, `EventCalls` and the text on the `$` calls (Tier).
