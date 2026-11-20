---
title: MCP and Channels Settings
description: Keys that decide which MCP servers, claude.ai connectors, and channels Claude Code may use.
sidebar_position: 7
---

These keys decide which MCP servers and channels Claude Code may use. An MCP server gives Claude extra tools. A channel is a plugin that can push messages into a session. Administrators use these keys to allow or block servers. Allow and block lists need a managed source to bind users. `enableAllProjectMcpServers`, `disableClaudeAiConnectors`, and `channelsEnabled` are switches.

## Example

### Approve Project Servers Except One

This file approves the servers in `.mcp.json` and rejects the one named `risky-server`.

```json title=".claude/settings.json"
{
  "enableAllProjectMcpServers": true,
  "disabledMcpjsonServers": ["risky-server"]
}
```

## Keys

Official page: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, the facts come from the settings schema.[^schema] Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `allowAllClaudeAiMcps` | <Documented /> <ManagedOnly /> | boolean | - | Load the claude.ai connectors Claude Code fetches itself alongside a deployed `managed-mcp.json`. It is off by default. This keeps the lockdown. | Managed settings only |
| `allowClaudeInChromeWithManagedMcp` | <Documented /> <ManagedOnly /> | boolean | - | Let the built-in Claude in Chrome server run alongside a deployed `managed-mcp.json`. This key works in device managed settings only. `deniedMcpServers` and the organization Chrome setting still block it. | Managed settings only |
| `allowedChannelPlugins` | <Documented /> | array | - | Replace the default allowlist of channel plugins that can push messages. Needs `channelsEnabled: true`. | Managed settings only |
| `allowedMcpServers` | <Documented /> | array | - | Allowlist which MCP servers users can add. Each entry has exactly one of `serverName`, `serverCommand` (an exact array), or `serverUrl` (a wildcard pattern such as `https://*.example.com/*`). Not set means allow all. Servers from `managedMcpServers` and `managed-mcp.json` entries with no `${VAR}` in `command`, `args`, `url`, or header values load without being listed. An entry with `${VAR}` in any of those must match the list. A `managed-mcp.json` stdio server that uses `${VAR}` only in `env` is not filtered.[^v305] Use `deniedMcpServers` to keep one off. | Any settings file |
| `allowManagedMcpServersOnly` | <Documented /> <ManagedOnly /> | boolean | - | Make the managed MCP allowlist the only one that applies. `deniedMcpServers` still merges from all sources. The schema text adds that a user can deny, in user settings, a server that the organization provides. Users can still add servers, but only the admin allowlist applies.[^v328-mcp-schema] | Managed settings only |
| `channelsEnabled` | <Documented /> | boolean | - | Allow channels for your organization. On Teams and Enterprise it is off by default. On Console it is on by default unless managed settings exist. | Managed settings only |
| `deniedMcpServers` | <Documented /> | array | - | Block specific MCP servers by URL, command, or name. Entries have the same shapes. It applies in all scopes, also for the organization. An entry found only in a project's `.claude/settings.json` or `.claude/settings.local.json` does not apply to a server that the organization provides. Those servers come from `managed-mcp.json`, `managedMcpServers`, or a plugin that managed settings list in `enabledPlugins`. An entry with `serverName` set to `claude.ai <name>` blocks the server of that name. It also blocks a server that a host adds with the display name `<name>`. A host adds such a server in the `mcp_set_servers` request, and the program keeps the `displayName` of the config it gets.[^v328-mcp-schema][^v328-denied-cloud] | Any settings file |
| `desktopMcpServersListScope` | <Undocumented /> <ManagedOnly /> | string | `"code"` | Choose where your MCP allow list and deny list apply to servers added in the Claude desktop app. `"code"` covers Code tab sessions and the Artifact pane. `"all"` covers every tab, with the deny list too. `"off"` leaves the allow list off for those servers. Any other value counts as `all`. The CLI reads no value from it, but written alone in a higher managed source it makes that source lead, so write it beside the list it scopes.[^desktop-mcp-scope] | Managed settings only |
| `disableClaudeAiConnectors` | <Documented /> | boolean | - | Turn off claude.ai connectors so Claude Code doesn't fetch them. `true` in any source wins. It also stops a `claudeai-proxy` server from `--mcp-config`. | Any settings file |
| `disabledMcpjsonServers` | <Documented /> | array of string | - | Reject specific servers from a project's `.mcp.json`. It blocks in every permission mode and every folder. | Any settings file |
| `enableAllProjectMcpServers` | <Documented /> | boolean | - | Approve every server in project `.mcp.json` files without a prompt. Claude Code ignores it in an untrusted folder when it comes from the checked-in `.claude/settings.json`. | Any settings file |
| `enabledMcpjsonServers` | <Documented /> | array of string | - | Approve specific servers from a project's `.mcp.json`. The same trust rule applies. An entry must match the server name exactly: an entry in another spelling asks again. A rejection in `disabledMcpjsonServers` still matches a name written in another spelling.[^exact-match] | Any settings file |
| `managedMcpServers` | <Documented /> | object | - | Provide remote MCP servers to every user alongside the ones they add. It accepts only `http` and `sse` servers, keyed by name. The entries cannot hold `command`, `args`, `env`, or `headersHelper`. They cannot hold `${VAR}`. The URL must start with `https://`. Users cannot remove them. `deniedMcpServers` still applies. | Managed settings only |

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [MCP](../../extend/mcp/index.md) covers servers, config, and runtime.
- [Control MCP Server Access for Your Organization](https://code.claude.com/docs/en/managed-mcp) is the guide for administrators.
- [Plugins and MCP Variables](../env-vars/plugins-and-mcp.md) lists the matching variables.

## Sources

[^schema]: The program, its bundled settings schema, for example the `enabledMcpjsonServers` entry at `chunk-t39fw2cy.js:8494`.
[^v305]: The program, `chunk-t39fw2cy.js:8534` (the `allowedMcpServers` schema text, which names `command`, `args`, `url`, and header values as the fields that count).
[^exact-match]: The program, `chunk-be81kym3.js:1172` (`$652b6e` selects exact matching). The gate `tengu_misty_oasis` is named at `chunk-be81kym3.js:835` and is on by default (`$688ed9_2.read($7cece2, !0)` at `chunk-be81kym3.js:841`).
[^v328-mcp-schema]: The program, its bundled settings schema, `chunk-t39fw2cy.js:8717` and `chunk-t39fw2cy.js:8538`.
[^v328-denied-cloud]: The program, `chunk-hg1yqkjk.js:202310` (a `serverName` entry blocks the server of that name) and `chunk-hg1yqkjk.js:202374` (a dynamic server with a `displayName` is blocked by the entry `claude.ai <name>`), `chunk-yzbs7cc9.js:892` (the request `mcp_set_servers`), and `chunk-fc94807g.js:21` (a config with no `readFrom` gets `scope` `dynamic`; the `displayName` stays, and `chunk-fc94807g.js:30` drops it only when a `scope` other than `dynamic` or `claudeai` is set). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^desktop-mcp-scope]: The program, `chunk-t39fw2cy.js:8719` (the `desktopMcpServersListScope` key) and `chunk-t39fw2cy.js:8725` (its field text).
