---
title: MCP Env Vars
description: Every env var that changes how Claude Code starts, times out, limits, and authenticates MCP servers.
sidebar_position: 7
---

These env vars change how Claude Code starts, times out, limits, and authenticates MCP servers. For example, `MCP_TIMEOUT=30000` gives a server 30 seconds to start. Change a slow server's timeout here, or limit big results with `MAX_MCP_OUTPUT_TOKENS`.

Export the variable in the shell, or add it to `env` in a settings file. Some are switches, such as `ENABLE_CLAUDEAI_MCP_SERVERS` and `MCP_CONNECTION_NONBLOCKING`.

## Documented Variables

Each name links to its row on the env var pages, which hold the status, the values, the defaults, and the notes. Official pages: [Connect Claude Code to Tools via MCP](https://code.claude.com/docs/en/mcp), [Environment Variables](https://code.claude.com/docs/en/env-vars), and [Settings Reference](https://code.claude.com/docs/en/settings-reference). [Plugin and MCP Env Vars](../../configure/env-vars/plugins-and-mcp.md) and the other env var pages list all env vars of Claude Code.

- [`MCP_TIMEOUT`](../../configure/env-vars/plugins-and-mcp.md#variables): Startup timeout of one server.
- [`MCP_TOOL_TIMEOUT`](../../configure/env-vars/plugins-and-mcp.md#variables): Timeout of one tool call.
- [`CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`](../../configure/env-vars/plugins-and-mcp.md#variables): Idle timeout of a call.
- [`MCP_CONNECT_TIMEOUT_MS`](../../configure/env-vars/plugins-and-mcp.md#variables): Wait during blocking startup.
- [`MCP_CONNECTION_NONBLOCKING`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets whether startup waits for servers.
- [`MCP_SERVER_CONNECTION_BATCH_SIZE`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets how many local servers connect at once.
- [`MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets how many remote servers connect at once.
- [`CLAUDE_CODE_MCP_STARTUP_WAIT_MS`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets the first-turn wait in non-interactive mode.
- [`MAX_MCP_OUTPUT_TOKENS`](../../configure/env-vars/context-and-compaction.md#variables): Token limit of a result.
- [`CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH`](../../configure/env-vars/plugins-and-mcp.md#variables): Length limit of descriptions and instructions.
- [`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`](../../configure/env-vars/plugins-and-mcp.md#variables): Delay before a call moves to the background.
- [`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`](../../configure/env-vars/agents-and-teams.md#variables): Turns off all background tasks.
- [`CLAUDE_AUTO_BACKGROUND_TASKS`](../../configure/env-vars/agents-and-teams.md#variables): Allows auto background in `-p`.
- [`CLAUDE_CODE_MCP_ALLOWLIST_ENV`](../../configure/env-vars/plugins-and-mcp.md#variables): Gives stdio servers a minimal env.
- [`ENABLE_TOOL_SEARCH`](../../configure/env-vars/tools-and-bash.md#variables): Sets the tool search mode. See [MCP Runtime](runtime.md#timing-and-recovery).
- [`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`](../../configure/env-vars/models-and-effort.md#variables): Strips beta fields.
- [`ENABLE_CLAUDEAI_MCP_SERVERS`](../../configure/env-vars/plugins-and-mcp.md#variables): Controls the fetch of connectors.
- [`MCP_DISCOVERY_CACHE`](../../configure/env-vars/plugins-and-mcp.md#variables): Turns the discovery cache on or off.
- [`MCP_DISCOVERY_CACHE_TTL_S`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets entry age without a refresh.
- [`MCP_DISCOVERY_CACHE_MAX_STALE_S`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets the maximum entry age.
- [`MCP_DISCOVERY_CACHE_STRIKES`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets failed refreshes before Claude Code discards an entry.
- [`MCP_SDK_GENERATION`](../../configure/env-vars/plugins-and-mcp.md#variables): Pins the client runtime.
- [`MCP_PROTOCOL_NEGOTIATION`](../../configure/env-vars/plugins-and-mcp.md#variables): Probes for revision 2026-07-28.
- [`MCP_CLIENT_SECRET`](../../configure/env-vars/auth-and-accounts.md#variables): Gives the OAuth client secret.
- [`MCP_OAUTH_CALLBACK_PORT`](../../configure/env-vars/auth-and-accounts.md#variables): Fixes the OAuth callback port.
- [`CLAUDE_AGENT_SDK_MCP_NO_PREFIX`](../../configure/env-vars/plugins-and-mcp.md#variables): Drops the name prefix.
- [`CLAUDE_CODE_REMOTE_MCP_CONFIG`](../../configure/env-vars/remote-and-cloud-sessions.md#variables): Gives the path of the delivered server file.

## Variables Claude Code Sets for Servers

Claude Code puts these in the env of a stdio server or a `headersHelper`.

- [`CLAUDE_PROJECT_DIR`](../../configure/env-vars/plugins-and-mcp.md#variables): Gives the project root.
- [`CLAUDE_CODE_SESSION_ID`](../../configure/env-vars/sessions-and-storage.md#variables), [`CLAUDECODE`](../../configure/env-vars/tools-and-bash.md#variables): Mark the session.
- [`CLAUDE_CODE_SUBPROCESS_ENV_SCRUB`](../../configure/env-vars/tools-and-bash.md#variables): Strips credentials.
- [`CLAUDE_CODE_MCP_SERVER_NAME`](../../configure/env-vars/plugins-and-mcp.md#variables), [`CLAUDE_CODE_MCP_SERVER_URL`](../../configure/env-vars/plugins-and-mcp.md#variables): Tell a `headersHelper` the server.

## Undocumented Variables

No official page lists these.[^undoc] They can change without notice.

- [`ENABLE_MCP_LARGE_OUTPUT_FILES`](../../configure/env-vars/plugins-and-mcp.md#variables): Switch for result files.
- [`CLAUDE_CODE_MCP_APPS_HOST`](../../configure/env-vars/plugins-and-mcp.md#variables): Declares MCP Apps support.
- [`CLAUDE_CODE_SKIP_PLUGIN_LOCAL_MCP_SERVERS`](../../configure/env-vars/plugins-and-mcp.md#variables): Skips local plugin servers.
- [`CLAUDE_CODE_SKIP_PLUGIN_MCP_BUNDLES`](../../configure/env-vars/plugins-and-mcp.md#variables): Skips MCPB sources of plugins.
- [`CLAUDE_CODE_SKIP_PLUGIN_MCP_SERVERS`](../../configure/env-vars/plugins-and-mcp.md#variables): Skips plugin servers.
- [`CLAUDE_CODE_SKIP_PLUGIN_MCP_SERVERS_EXCEPT`](../../configure/env-vars/plugins-and-mcp.md#variables): Exempts plugin servers from the skip.
- [`CLAUDE_CODE_ENABLE_REFRESH_MCP_TOOLS`](../../configure/env-vars/plugins-and-mcp.md#variables): Adds a refresh tool.
- [`MCP_TRUNCATION_PROMPT_OVERRIDE`](../../configure/env-vars/plugins-and-mcp.md#variables): Picks the truncation prompt.
- [`MCP_OAUTH_CLIENT_METADATA_URL`](../../configure/env-vars/auth-and-accounts.md#variables): Overrides the CIMD URL.
- [`CLAUDE_CODE_SYNC_PLUGINS_MCP_TIMEOUT_MS`](../../configure/env-vars/plugins-and-mcp.md#variables): Timeout of the plugin MCP sync.
- [`CLAUDE_CODE_MCP_CONNECTOR_PREWAIT_MS`](../../configure/env-vars/plugins-and-mcp.md#variables): First-turn wait for connectors.
- [`CLAUDE_CODE_MCP_PREWAIT_SERVERS`](../../configure/env-vars/plugins-and-mcp.md#variables), [`CLAUDE_CODE_MCP_PREWAIT_SERVERS_MS`](../../configure/env-vars/plugins-and-mcp.md#variables): Name servers to wait for.
- [`CLAUDE_CODE_MCP_MEMORY_CGROUP`](../../configure/env-vars/plugins-and-mcp.md#variables): Sets the memory cap class of MCP processes.
- [`CLAUDE_CODE_TERMINAL_MCP_TOOLS`](../../configure/env-vars/plugins-and-mcp.md#variables): Lists MCP tool names.
- [`CLAUDE_AGENT_SDK_DISABLE_MCP_MANIFESTS`](../../configure/env-vars/plugins-and-mcp.md#variables): Stops SDK manifest capture.
- [`CLAUDE_CODE_BRIDGE_MCP_CARRIER`](../../configure/env-vars/remote-and-cloud-sessions.md#variables): Marks a bridge MCP carrier.
- [`CLAUDE_CODE_ENABLE_XAA`](../../configure/env-vars/auth-and-accounts.md#variables): Turns XAA on. See [MCP Authentication](auth.md#xaa).
- [`MCP_XAA_IDP_CLIENT_SECRET`](../../configure/env-vars/auth-and-accounts.md#variables): Gives the IdP client secret for XAA.

## Example

```bash title="Slow server, big results, no connector fetch"
export MCP_TIMEOUT=60000
export MCP_TOOL_TIMEOUT=300000
export MAX_MCP_OUTPUT_TOKENS=50000
export ENABLE_CLAUDEAI_MCP_SERVERS=false
claude
```

```json title="The same in settings"
{ "env": { "MCP_TIMEOUT": "60000", "MAX_MCP_OUTPUT_TOKENS": "50000" } }
```

## How It Works

```mermaid
flowchart TD
  A[Session start] --> B[Batch connect: 3 local, 20 remote]
  B --> C{"<code>MCP_TIMEOUT</code> hit?"}
  C -->|yes| F[Mark failed]
  C -->|no| D[Connected]
  D --> E["Tool call uses <code>MCP_TOOL_TIMEOUT</code> and idle timeout"]
  E --> G["Result checked against <code>MAX_MCP_OUTPUT_TOKENS</code>"]
```

## Related Pages

- [MCP Runtime](runtime.md)
- [MCP Authentication](auth.md)
- [Plugin Loading](../plugins/loading.md#env-vars) for plugin env vars

## Sources

[^undoc]: The program, for example `chunk-54d1gdxa.js:13891` for `ENABLE_MCP_LARGE_OUTPUT_FILES`, `chunk-bzyb60p0.js:202820` for `CLAUDE_CODE_SKIP_PLUGIN_LOCAL_MCP_SERVERS`, `chunk-bzyb60p0.js:80647` for `CLAUDE_CODE_SYNC_PLUGINS_MCP_TIMEOUT_MS`, and `chunk-bzyb60p0.js:134730` for `MCP_TRUNCATION_PROMPT_OVERRIDE`.
