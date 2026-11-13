---
title: Extra Keys and Global Config
description: Keys the settings schema leaves out, desktop-only keys, and the keys of the global config file ~/.claude.json.
sidebar_position: 10
---

Some keys are not in the settings schema, or they live in another file.
This page covers the auto mode and display keys, the keys that only the desktop app reads, and the global config keys of `~/.claude.json`.
The global config file is not a settings file. Claude Code writes it. `/config` changes some of its keys.

All keys here work in `2.1.322`. Edit a settings file for the first two tables. Use `/config` or edit `~/.claude.json` for the global config keys in the last table. Most keys are booleans.

## Auto Mode, Voice, and Display Keys

The program adds these keys itself, so the schema files do not list them.
Source: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, Source: the program.

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `skipAutoPermissionPrompt` | <Documented /> | boolean | - | Skip the one-time notice Claude Code shows when you first enter auto mode yourself rather than through the built-in default. | User or managed settings |
| `useAutoModeDuringPlan` | <Documented /> | boolean | `true` | Let the auto mode classifier review shell commands in plan mode. Set `false` to get prompts instead. | User, local, or managed settings |
| `autoMode` | <Documented /> | object | - | Add your own rules to the auto mode classifier. It takes `allow`, `soft_deny`, `hard_deny`, and `environment` lists and a `classifyAllShell` boolean. `"$defaults"` in a list keeps the built-in rules. | User or managed settings |
| `permissions.disableAutoMode` | <Documented /> | enum: `disable` | - | Remove auto mode from the permission mode cycle. It is the same as the top-level `disableAutoMode`. | Any settings file |
| `disableDeepLinkRegistration` | <Documented /> | enum: `disable` | - | Stop Claude Code from registering the `claude-cli://` link handler with the operating system. | Any settings file |
| `voiceEnabled` | <Documented /> | boolean | - | Turn on voice dictation (hold to talk). See also `voice` in [Interface Settings](ui.md). | Any settings file |
| `defaultView` | <Undocumented /> | enum: `chat`, `transcript` | - | Choose the default transcript view. `chat` shows only `SendUserMessage` checkpoints. `transcript` shows everything. | Settings files |
| `axScreenReader` | <Documented /> | boolean | - | Render screen-reader friendly output. The `CLAUDE_AX_SCREEN_READER` variable and the `--ax-screen-reader` flag win. Since `2.1.305` the program ignores it in project and local settings, and says "Screen reader mode is off: project settings can't turn it on" if only they ask. | Any settings file |

## Other Keys

The first rows are sub-keys of an object key. Only the desktop app reads the last rows.

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `disablePluginDirectory` | <Undocumented /> | boolean | - | Let an administrator turn the plugin directory off. | Managed settings only |
| `isolation.required` | <Undocumented /> | boolean | - | Sub-key of `isolation`. A lower settings file may set `true` over managed settings. | Settings files |
| `isolation.persistHome` | <Undocumented /> | boolean | - | Sub-key of `isolation`. The bundle gives no description. | Settings files |
| `remoteControl.shareHostProfile` | <Undocumented /> | enum | - | Sub-key of `remoteControl`. The strict values are `off` and `basic`. | Settings files |
| `remoteTools.allowUnattendedServing` | <Undocumented /> | boolean | - | Sub-key of `remoteTools`. The bundle gives no description. | Settings files |
| `attribution.sessionUrl` | <Documented /> | boolean | - | Leave the claude.ai session link out of cloud and Remote Control commits. | Any settings file |
| `sshHostAllowlist` | <Documented /> | array of string | Unset, so the app allows any host | Limit the hosts that Desktop SSH sessions may reach. Only the desktop app reads it. | Managed settings only |
| `disableBrowserExternalNavigation` | <Documented /> | boolean | Unset, so external browsing is on | Turn off external browsing in the desktop Browser pane. Only `true` takes effect. | Managed settings only |
| `browserExternalPageTools` | <Documented /> | string | Unset, so the tools work on external pages | Stop Claude from using its tools on external pages in the desktop Browser pane. The value is `"disabled"`. | Managed settings only |
| `disableMobileSimulatorTools` | <Documented /> | boolean | Unset | Block Claude's tools in the desktop iOS Simulator pane. Only `true` takes effect. | Managed settings only |
| `disableDesktopLocalSessions` | <Documented /> | boolean | - | Turn off Desktop Code sessions that run on the device. SSH and cloud sessions stay on. Not in the 2.1.305 program (no schema entry or reader). The [official docs](https://code.claude.com/docs/en/settings-reference#disabledesktoplocalsessions) say the desktop app reads it (v1.37937.0 or later), and only `true` takes effect. | Managed settings only |

## Global Config Keys

These keys live in `~/.claude.json`, not in a settings file.
The `/config` command writes them.
Source: [Settings Reference](https://code.claude.com/docs/en/settings-reference)

| Key | Status | What It Does |
| --- | --- | --- |
| `autoConnectIde` | <Documented /> | Connect to a running VS Code or JetBrains IDE automatically from an external terminal. |
| `autoInstallIdeExtension` | <Documented /> | Turn off automatic install of the IDE extension from a VS Code terminal. |
| `claudeInChromeDefaultEnabled` | <Documented /> | Turn on Chrome integration when a session starts, in the interactive CLI and the VS Code extension. |
| `copyFullResponse` | <Documented /> | Make `/copy` copy the full response without showing the picker. |
| `copyOnSelect` | <Documented /> | Turn off automatic copying of text you select with the mouse in fullscreen rendering and agent view. |
| `defaultToAgentsView` | <Documented /> | Open agent view instead of a new conversation when you run `claude` with no arguments. |
| `diffTool` | <Documented /> | Choose whether Claude's proposed file changes open in the VS Code or JetBrains diff viewer or stay in the terminal. |
| `externalEditorContext` | <Documented /> | Show Claude's last response as comments when you press Ctrl+G to edit. |
| `fastModeChosenOnFableOrMythos` | <Undocumented /> | On the Anthropic API, `/fast` writes `true` when it turns fast mode on with the model `claude-fable-5-2` or `claude-mythos-5-2`, and `false` in each other case. With `true`, a saved `fastMode: true` also applies on these two models (the program, `chunk-x4fdscgs.js:407767`, `:408067`). On Vertex, the program does not read or write the key. See [Fast Mode](../models-and-providers/fast-mode.md#fable-52-and-mythos-52). |
| `leftArrowOpensAgents` | <Documented /> | Turn off the `←` shortcut that backgrounds the session and opens agent view. |
| `prStatusFooterEnabled` | <Documented /> | Turn off the prompt footer's PR review status badge and the pull request check behind it. |

:::note[Sub-Keys]
Source: the program.

- `remoteTools.allowUnattendedServing` (default `true`): set `false` in managed or user settings to stop cloud sessions in auto mode from running commands here without approval. Claude Code ignores project, local, and `--settings` values.
- `remoteControl.shareHostProfile`: `off`, `basic`, or `full`. It sets what a Remote Control environment reports about this machine. `off` reports nothing. `basic` reports the OS, architecture, and detected developer tools. `full` adds the names of MCP servers set on this machine. Managed, `--settings`, and user settings set it. The most restrictive wins. Project and local settings can only lower it.
- `isolation.persistHome` and `isolation.required`: the program gives no description. A lower-trust source may set `persistHome` only to `false` and `required` only to `true`.

:::

## Example

### Turn On Auto Mode Rules and Voice

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "autoMode": {
    "classifyAllShell": true
  },
  "useAutoModeDuringPlan": true,
  "voiceEnabled": true
}
```

This file makes the classifier check every shell command. It lets the classifier review shell commands in plan mode. It turns on voice dictation.

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes and precedence.
- [Interface Settings](ui.md) has the `voice` key.
- [Auto Mode](../permissions/auto-mode.md) covers `autoMode`.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
