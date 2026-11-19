---
title: MCP Settings and Policy
description: Settings keys, allow and deny lists, project approval, managed-mcp.json, and launch flags that decide which MCP servers can run.
sidebar_position: 3
---

These settings decide which MCP servers may run and which ones a project may use. Administrators use them for allow lists and deny lists. For example, `{ "enableAllProjectMcpServers": true }` approves every server in a project `.mcp.json` file.

Most keys also work in your own settings. They live in settings files, `~/.claude.json`, `.mcp.json`, and `managed-mcp.json`. To turn a control on, set one of these switches: `disabledMcpjsonServers`, `enableAllProjectMcpServers`, `deniedMcpServers`, `--strict-mcp-config`, and `disableClaudeAiConnectors`.

## Settings Keys

Official pages: [Connect Claude Code to Tools via MCP](https://code.claude.com/docs/en/mcp), [Control MCP Server Access for Your Organization](https://code.claude.com/docs/en/managed-mcp), [Settings Reference](https://code.claude.com/docs/en/settings-reference), and [Channels Reference](https://code.claude.com/docs/en/channels-reference).

These keys sit in the settings files. Each key has one row, with its type, what it does, and where to set it, on [MCP and Channels Settings](../../configure/settings/mcp-and-channels.md#keys).

- Approve or reject servers from a project `.mcp.json`: [`enableAllProjectMcpServers`](../../configure/settings/mcp-and-channels.md#keys), [`enabledMcpjsonServers`](../../configure/settings/mcp-and-channels.md#keys), and [`disabledMcpjsonServers`](../../configure/settings/mcp-and-channels.md#keys).
- Allow or block servers for users: [`allowedMcpServers`](../../configure/settings/mcp-and-channels.md#keys), [`deniedMcpServers`](../../configure/settings/mcp-and-channels.md#keys), and [`allowManagedMcpServersOnly`](../../configure/settings/mcp-and-channels.md#keys).
- Give servers to every user: [`managedMcpServers`](../../configure/settings/mcp-and-channels.md#keys).
- Let connectors and Claude in Chrome run beside `managed-mcp.json`: [`allowAllClaudeAiMcps`](../../configure/settings/mcp-and-channels.md#keys) and [`allowClaudeInChromeWithManagedMcp`](../../configure/settings/mcp-and-channels.md#keys).
- Turn off the connectors Claude Code fetches: [`disableClaudeAiConnectors`](../../configure/settings/mcp-and-channels.md#keys).
- Allow channels: [`channelsEnabled`](../../configure/settings/mcp-and-channels.md#keys) and [`allowedChannelPlugins`](../../configure/settings/mcp-and-channels.md#keys).
- Store the IdP connection for XAA: [`xaaIdp`](../../configure/settings/auth.md#keys) <Undocumented />. `claude mcp xaa setup` writes it. See [MCP Authentication](auth.md#xaa).

## State Keys in `~/.claude.json`

These keys sit under `projects["<path>"]`.

| Key | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| `disabledMcpServers` | <Documented /> | A per-project opt-out list. | Covers user, plugin, managed, connector, and default-on built-in servers. A connector uses its display name, such as `claude.ai Slack`. |
| `enabledMcpServers` | <Documented /> | A per-project opt-in list. | Only for built-in servers that default to off, such as `computer-use`. Claude Code ignores other entries. |
| `hasTrustDialogAccepted` | <Documented /> | The workspace trust flag. | `true` lets a `headersHelper` of a project or local server run without the dialog. |

## Files and Flags

| Item | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| `.mcp.json` | <Documented /> | Holds project servers. | At the project root. Interactive sessions ask for approval. `claude -p`, the SDK, and cloud sessions load it without a prompt. |
| `~/.claude.json` | <Documented /> | Holds local and user servers. | `claude mcp add` writes it. |
| `managed-mcp.json` | <Documented /> | A fixed server set from the organization. | Gives the organization exclusive control. Claude Code ignores other sources. In a probe, Claude Code dropped user and project servers with no warning, which matches the [official page](https://code.claude.com/docs/en/managed-mcp#disable-mcp-entirely). See [Managed Folder Probe](../../reference/probes.md#managed-folder-probe). Claude in Chrome and connectors stay blocked unless you set the two `allow` keys above. Since `2.1.326`, when the file appears during a session, Claude Code shows a notice that your organization now manages MCP servers and only allowed servers load from now on. If the file cannot be read, the notice says your own servers will not load. If the account that runs Claude Code could have written the file, Claude Code ignores a late file and logs it, and a restart applies it.[^managed-late] |
| `--mcp-config <configs...>` | <Documented /> | Loads servers from files or strings. | Space-separated. Scope `dynamic`. `headersHelper` runs in the primary working folder. |
| `--strict-mcp-config` | <Documented /> | Uses only the `--mcp-config` servers. | Skips the approval prompt for project servers it does not load (`2.1.246` and later). |
| `--plugin-dir-no-mcp <path>` | <Undocumented /> | Loads an inline plugin without its MCP servers. | Hidden flag. The SDK form is `skipMcpDiscovery`. |
| `--channels <servers...>` | <Documented /> | Registers channel notifications of the listed servers. | Hidden flag. Space-separated names. See [MCP Runtime](runtime.md#elicitation-and-channels). |
| `--dangerously-load-development-channels <servers...>` | <Documented /> <Caution /> | Loads channel servers that are not on the allowlist. | Hidden flag for local channel development. Shows a confirmation dialog. |
| `--setting-sources` | <Documented /> | Excludes project settings. | Keeps a project `.mcp.json` out. |

## Approval Rules

- `claude mcp list` and `claude mcp get` read approvals only from files outside the repository until you trust the folder.
- In an untrusted folder, these sources apply: `~/.claude/settings.json`, managed settings, and `--settings`.
- An untracked `.claude/settings.local.json` applies only in a trusted folder. Before `2.1.207` it always applied.
- In `bypassPermissions` mode, Claude Code skips the project prompt when you set `skipDangerousModePermissionPrompt` in user or managed settings.

## Example

```json title="Managed settings: lock down MCP"
{
  "allowManagedMcpServersOnly": true,
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverUrl": "https://*.example.com/*" }
  ],
  "deniedMcpServers": [{ "serverCommand": ["bunx", "untrusted-server"] }],
  "disableClaudeAiConnectors": true
}
```

## How It Works

```mermaid
flowchart TD
  A[Server found in a source] --> B{"In <code>deniedMcpServers</code>?"}
  B -->|yes| X[Blocked]
  B -->|no| C{Allowlist set and matches?}
  C -->|no, list set| X
  C -->|yes or no list| D{"From project <code>.mcp.json</code>?"}
  D -->|yes| E{Approved?}
  E -->|no| P[Pending approval]
  E -->|yes| G[Connect]
  D -->|no| G
```

## Related Pages

- [MCP](index.md)
- [Server Configuration](config.md)
- [MCP Commands](cli.md) for `claude mcp reset-project-choices`
- [MCP and Channels Settings](../../configure/settings/mcp-and-channels.md)

## Sources

[^managed-late]: The program, `chunk-56bhcxay.js:239272`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
