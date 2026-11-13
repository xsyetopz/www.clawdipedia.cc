---
title: Hooks, Plugins, and Skills Settings
description: Keys for hooks, plugins, marketplaces, skills, permissions, the status line, and output styles.
sidebar_position: 6
---

These keys control hooks, plugins, marketplaces, skills, permissions, and the status line.
Many are managed-only keys that let an administrator lock down what users can load.
The `hooks`, `permissions`, and `statusLine` objects are large, so their own pages explain them.

Managed-only keys need a managed source. `disableAllHooks`, `disableBundledSkills`, and `enabledPlugins` are switches.

## Keys

Source: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, Source: the program (its bundled settings schema).
Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `additionalMarketplaces` | <Documented /> | object | - | Write `extraKnownMarketplaces` under this alias name. Do not set both in one file. Needs Claude Code `2.1.232` or later. If both are set, Claude Code ignores the alias and warns. | Any settings file |
| `allowedHttpHookUrls` | <Documented /> | array of string | - | Limit which URLs HTTP hooks can target. | Any settings file |
| `allowedMarketplaces` | <Documented /> <ManagedOnly /> | array | - | Write `strictKnownMarketplaces` under this alias name. Do not set both in one file. Needs Claude Code `2.1.232` or later. | Managed settings only |
| `allowManagedHooksOnly` | <Documented /> <ManagedOnly /> | boolean | - | Run only the hooks your organization deploys and the hooks of managed-enabled plugins. It also narrows `statusLine` and `fileSuggestion`. It also blocks hooks and mods that are not the organization's. | Managed settings only |
| `allowManagedPermissionRulesOnly` | <Documented /> <ManagedOnly /> | boolean | - | Make managed settings the only settings source of permission rules. Since `2.1.305`, plugins that Claude Desktop mounts by path no longer keep their `allowed-tools` when your organization's managed settings set it ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). | Managed settings only |
| `appendPlugins` | <Differs note="Docs say user or managed scope. The schema says managed only." /> <ManagedOnly /> | array of string | - | List managed plugins whose hooks run last, in the listed order. The docs list the scope as user or managed. The schema marks it managed-only. Listed ids run innermost. | User or managed settings |
| `blockedMarketplaces` | <Documented /> | array | - | Block plugin marketplace sources for your organization. Claude Code checks it before download. | Managed settings only |
| `disableAllHooks` | <Differs note="The schema also says it stops the statusLine command. The Hooks Reference names only hooks." /> | boolean | - | Turn off hooks, a custom status line, and a custom `@` file suggestion command at once. Managed hooks stay unless you set it in managed settings. In managed settings it also stops organization mods. In user settings, what the organization manages keeps running. When `true` outside managed settings, only a managed `statusLine` runs. With no managed `statusLine`, the status line is off. | Any settings file |
| `disableAutoMode` | <Documented /> | enum: `disable` | - | Remove auto mode from the permission mode cycle. | Any settings file |
| `disableBundledSkills` | <Documented /> | boolean | - | Turn off the skills and workflows included with Claude Code. | Any settings file |
| `disableCommandPluginSources` | <Documented /> <ManagedOnly /> | boolean | - | Block plugins that install by running a marketplace-declared command. It turns off `command` plugin sources. | Managed settings only |
| `disableSideloadFlags` | <Documented /> <ManagedOnly /> | boolean | - | Reject the CLI flags that sideload plugins, subagents, and MCP servers. It covers `--plugin-dir`, `--plugin-url`, `--agents`, and `--mcp-config`. | Managed settings only |
| `disableSkillShellExecution` | <Documented /> | boolean | - | Stop skills and custom commands from running inline shell. | Any settings file |
| `enabledPlugins` | <Documented /> | object | - | Turn individual plugins on or off per scope. Keys look like `"name@marketplace"` with a value of `true` or `false`. The layers apply in this order: user, project, local, flag, policy. To turn off a project plugin for yourself, set `false` in `.claude/settings.local.json`. Only `true` turns on a marketplace plugin. A list of versions is accepted but leaves the plugin off; `/plugin` and `claude plugin list` say why (the program, `chunk-xvwfyath.js:25832`). | Any settings file |
| `extraKnownMarketplaces` | <Documented /> | object | - | Register marketplaces for a repository or an organization. The value is a map of name to `{ "source": ... }`. Project values apply after you trust the folder. In managed settings, a declared name cannot be added from another source, an entry for it from elsewhere is hidden, and the plugins the declared marketplace lists are installed again from it. Data saved for a taken-over marketplace is set aside for `cleanupPeriodDays`. Options and secrets stay set aside until `claude plugin restore-set-aside` ([2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321); the program, `chunk-y3tc9w2j.js:20945`). | Any settings file |
| `hooks` | <Documented /> | object | - | Run your own commands as hooks at points in Claude Code's lifecycle. | Any settings file |
| `httpHookAllowedEnvVars` | <Documented /> | array of string | - | Limit which env vars HTTP hooks can put in headers. | Any settings file |
| `outputStyle` | <Documented /> | string | - | Change Claude's role, tone, and output format with an output style. | Any settings file |
| `permissions` | <Documented /> | object | - | Set allow, ask, and deny rules and the starting permission mode. | Any settings file |
| `pluginConfigs` | <Documented /> | object | - | Store the answers you gave a plugin's configuration dialog. It holds `options` and `mcpServers` by plugin id. | User or managed settings |
| `pluginConfigs.*.mcpServers` | <Documented /> | object | - | Per-server user configuration values, keyed by server name. Each value is a string, number, boolean, or array of strings. | User or managed settings |
| `pluginConfigs.*.options` | <Documented /> | object | - | Non-sensitive option values from the plugin's `userConfig`, keyed by option name. Claude Code stores sensitive values in secure storage. | User or managed settings |
| `pluginSuggestionMarketplaces` | <Documented /> | array of string | - | Choose which marketplaces can surface plugin install suggestions in `/plugin`. Without it, no marketplace suggestion shows. The tips for the own plugins of Anthropic stay (the schema text of `2.1.319` says "Anthropic's own plugins" where `2.1.316` named only the `frontend-design` tip). Runs: a user-settings value gives no warning line, and a string gives `Expected array, but received string` (cases `print.cli319.plugin-sugg.user`, `.bad-type`). The tip comes from the startup tip list. It needs the key in a managed tier, the marketplace registered on the machine, and its source declared in `extraKnownMarketplaces` or `strictKnownMarketplaces` of managed settings (otherwise the debug log says `Skipping plugin suggestion tips for marketplace`). A managed tier on macOS needs root, so no run shows the tip. | Managed settings only |
| `pluginTrustMessage` | <Documented /> <ManagedOnly /> | string | - | Add your own text to the plugin trust warning. | Managed settings only |
| `prependPlugins` | <Differs note="Docs say user or managed scope. The schema says managed only." /> <ManagedOnly /> | array of string | - | List managed plugins whose hooks run first, in the listed order. The docs list the scope as user or managed. The schema marks it managed-only. Listed ids run outermost. | User or managed settings |
| `skillListingBudgetFraction` | <Documented /> | number | `0.01` (1%) | Reserve more or less context for the skill listing. | Any settings file |
| `skillListingMaxDescChars` | <Documented /> | integer | 1536 | Cap each skill's description length in the skill listing. | Any settings file |
| `skillOverrides` | <Documented /> | object | - | Hide or collapse a skill without editing its SKILL.md. | Any settings file |
| `skipDangerousModePermissionPrompt` | <Documented /> <Caution /> | boolean | - | Skip the confirmation dialog before bypassPermissions mode. | User, local, or managed settings |
| `statusLine` | <Documented /> | object | - | Run your own command to render a status line below the prompt. | Any settings file |
| `strictKnownMarketplaces` | <Documented /> | array | - | Allowlist the marketplace sources users can add and install from. Claude Code checks it before download. It does not register anything. | Managed settings only |
| `strictPluginOnlyCustomization` | <Documented /> <ManagedOnly /> | boolean or array of: `skills`, `agents`, `hooks`, `mcp` | - | Block skills, agents, hooks, and MCP servers from user and project sources. `true` locks all four. `false` locks nothing. Claude Code drops an unknown array entry with a warning. A value that is not valid acts as `true`. Managed sources and plugin items are not blocked. Source: the program. | Managed settings only |
| `syncClaudeAiPlugins` | <Documented /> | boolean | - | Stop loading the plugins enabled on your claude.ai account and stop downloading new ones. | User, local, or managed settings |
| `syncClaudeAiSkills` | <Documented /> | boolean | - | Stop loading the skills enabled on your claude.ai account and stop downloading new ones. | User, local, or managed settings |

## Example

### Turn On a Plugin and a Hook

This file turns on one plugin. It runs `echo done` when a turn ends. It stops skills from running inline shell.

```json title=".claude/settings.json"
{
  "enabledPlugins": { "my-plugin@my-marketplace": true },
  "hooks": {
    "Stop": [{ "hooks": [{ "type": "command", "command": "echo done" }] }]
  },
  "disableSkillShellExecution": true
}
```

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Hooks](../../extend/hooks/index.md), [Plugins](../../extend/plugins/index.md), and [Skills and Commands](../../extend/skills-and-commands/index.md) explain those features.
- [Permissions](../permissions/index.md) covers `permissions`.
- [Plugins and MCP Variables](../env-vars/plugins-and-mcp.md) lists the matching variables.
