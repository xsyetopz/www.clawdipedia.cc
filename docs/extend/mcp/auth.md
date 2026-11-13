---
title: MCP Authentication
description: OAuth options, headersHelper, enterprise XAA sign-in, and claude.ai connectors for MCP servers.
sidebar_position: 5
---

Some MCP servers need you to sign in.
Claude Code supports OAuth, a script that makes headers, and managed sign-in for enterprises.
For example, `/mcp` opens a panel where you start the OAuth sign-in for a server.
This page describes the options only. It does not walk through any account sign-in.

OAuth works for `http` and `sse` servers. Headers work for `http`, `sse`, and `ws` servers. Use the server `oauth` fields, `headers`, `headersHelper`, and env vars to change it. Turn it off with `claude mcp logout`, `Clear authentication` in `/mcp`, `disableClaudeAiConnectors`, or `ENABLE_CLAUDEAI_MCP_SERVERS`. Tokens are in secure storage.

## OAuth Options

Source: [Connect Claude Code to Tools via MCP](https://code.claude.com/docs/en/mcp), [Environment Variables](https://code.claude.com/docs/en/env-vars), and the program for the rows marked <Undocumented /> or <Gated />.

| Item | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| OAuth flow | <Documented /> | Signs in to a remote server. | A `401` or `403` marks a server as needing auth. `/mcp` or `claude mcp login` runs the flow. A `401` on a signed-in server refreshes the token and retries once. |
| `oauth.clientId` | <Documented /> | Gives a pre-configured client ID. | For servers with no dynamic client registration. Claude Code also finds a Client ID Metadata Document (CIMD) on its own. |
| `oauth.callbackPort` | <Documented /> | Fixes the callback port. | The redirect URI is `http://localhost:PORT/callback`. A positive integer. |
| `oauth.authServerMetadataUrl` | <Documented /> | Skips the discovery chain. | Must start with `https://`. The default order is [RFC 9728](https://www.rfc-editor.org/rfc/rfc9728) `/.well-known/oauth-protected-resource`, then [RFC 8414](https://www.rfc-editor.org/rfc/rfc8414) `/.well-known/oauth-authorization-server`. |
| `oauth.scopes` | <Documented /> | Pins the requested scopes. | One space-separated string, at least one character. It overrides the scopes in metadata. Claude Code adds `offline_access` if the server advertises it. |
| `oauth.xaa` | <Gated note="CLAUDE_CODE_ENABLE_XAA=1" /> | Enables XAA for the server. | Boolean. Without the gate Claude Code says `Remove 'oauth.xaa'`. |
| `--client-id`, `--client-secret`, `--callback-port` | <Documented /> | Set the OAuth fields when you add a server. | See [MCP Commands](cli.md#flags). You set the secret only at add time. |
| `MCP_CLIENT_SECRET`, `MCP_OAUTH_CALLBACK_PORT` | <Documented /> | Env forms of the secret and port. | The secret skips the prompt. Login and `/mcp` never read it again. |
| `MCP_OAUTH_CLIENT_METADATA_URL` | <Undocumented /> | Overrides the CIMD URL. | The program logs `Using CIMD URL from env`. |
| Token storage | <Documented /> | Keeps tokens. | Claude Code stores tokens securely and refreshes them. The client secret is in the macOS keychain or a credentials file. `Clear authentication` in `/mcp` and `claude mcp logout` remove them. |
| v2 runtime checks | <Documented /> | Hardens OAuth. | Fails on an unexpected issuer. Sends credentials only to `https` or loopback token endpoints. |
| Local OAuth refusal | <Documented /> | Handles hosted connectors. | Microsoft 365, Gmail, and Google Calendar hosts need claude.ai. Claude Code shows `is Anthropic-hosted and doesn't support local OAuth`. |
| No OAuth fallback | <Documented /> | Respects your header. | If the server rejects a configured `Authorization` header (static or from a helper), the connection fails. There is no auth prompt. |

## `headersHelper`

A `headersHelper` is a shell command that prints request headers.
Use it for short-lived tokens.

| Item | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| Command | <Documented /> | Prints headers. | A shell command. The output is a JSON object of strings. It reaches its timeout after 10 s. It overrides static `headers`. It runs on each connect and again after a `401` or `403`. |
| `CLAUDE_CODE_MCP_SERVER_NAME`, `CLAUDE_CODE_MCP_SERVER_URL` | <Documented /> | Tell the helper which server it serves. | Set only for the helper. The URL hides a live credential value as `REDACTED`. |
| `CLAUDE_PLUGIN_ROOT` | <Documented /> | The plugin folder. | Set only for a plugin server. |
| Working folder | <Documented /> | Resolves relative paths. | The plugin folder, the project folder, the primary working folder, or `~/.claude` (user, managed, connector). It depends on where you configure the server. |
| Env scrub | <Documented /> | Hides credential variables. | Project `.mcp.json`, plugin, and project agent servers receive no variables with `TOKEN`, `SECRET`, `PASSWORD`, `KEY`, or `AUTH` in the name, plus a fixed list. |
| Trust rule | <Documented /> | Runs the helper late. | Project and local servers run it only after the trust dialog for the folder that declares them. Until then, Claude Code uses only static `headers`. |
| `${user_config.*}` | <Documented /> | Plugin options. | Not allowed. Claude Code reports the server as misconfigured. Before `2.1.207` it substituted them. |
| Policy refusal | <Documented /> | Refuses a plugin helper. | A marketplace entry with `headersHelper` must inline its full manifest with `strict: false`. Otherwise Claude Code refuses to run it. |

## XAA

XAA (SEP-990) signs you in through an enterprise identity provider (IdP).
It is off. Set `CLAUDE_CODE_ENABLE_XAA=1` to turn it on.

| Item | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| XAA | <Gated note="CLAUDE_CODE_ENABLE_XAA=1" /> | Signs in through an enterprise IdP. | All XAA servers share one IdP connection. Claude Code swaps a cached IdP `id_token` for a server token. Servers with `oauth.xaa` use it. |
| Gate | <Gated note="CLAUDE_CODE_ENABLE_XAA=1" /> | Turns XAA on. | An env var. |
| Setup | <Gated note="CLAUDE_CODE_ENABLE_XAA=1" /> | Stores the IdP data. | `claude mcp xaa setup` writes `xaaIdp`. The secret comes from `MCP_XAA_IDP_CLIENT_SECRET` and goes to the keychain. |
| Login | <Gated note="CLAUDE_CODE_ENABLE_XAA=1" /> | Caches the IdP token. | `claude mcp xaa login`. Without it Claude Code says `no IdP connection`. |

## Claude.ai Connectors

Connectors are MCP servers that you configure in claude.ai.
Claude Code fetches them only when you use a claude.ai login.

| Item | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| Fetch | <Documented /> | Loads the connectors of your account. | Only with a claude.ai subscription login. Not with an API key, `ANTHROPIC_AUTH_TOKEN`, `apiKeyHelper`, a cloud provider, a profile, or a `setup-token` token. Works in the terminal, VS Code, JetBrains, and the SDK. |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | <Documented /> | Switch for the fetch. | `false` stops it for the shell session. |
| `disableClaudeAiConnectors` | <Documented /> | Switch in settings. | See [MCP Settings and Policy](settings.md#settings-keys). |
| Per-tool controls | <Documented /> | Organization policy on connector tools. | `ask` prompts on each call. `blocked` hides the tool. See `toolPermissions` in [Server Configuration](config.md#server-options). |
| Session token rejected | <Documented /> | A separate state from a connector problem. | Run `/login`, then reconnect. Authorizing the connector again does not help. |
| Cloud and desktop sessions | <Documented /> | Other delivery paths. | A cloud host or the desktop app delivers connectors. `disableClaudeAiConnectors` does not act on them. |

## Example

```json title=".mcp.json: OAuth with a fixed port, and a header helper"
{
  "mcpServers": {
    "crm": {
      "type": "http",
      "url": "https://crm.example.com/mcp",
      "oauth": {
        "clientId": "my-client-id",
        "callbackPort": 8765,
        "scopes": "read write"
      }
    },
    "internal": {
      "type": "http",
      "url": "https://tools.example.com/mcp",
      "headersHelper": "./scripts/mcp-headers.sh"
    }
  }
}
```

The helper script prints `{"Authorization": "Bearer <token>"}` to stdout. Then it exits.

## How It Works

```mermaid
sequenceDiagram
  participant C as Claude Code
  participant S as MCP server
  C->>S: Connect with headers or helper output
  S-->>C: 401 or 403
  Note over C: Mark as needing authentication
  Note over C: You run /mcp or claude mcp login
  C->>S: OAuth flow
  S-->>C: Token
  C->>S: Retry with token
  S-->>C: 401 later
  C->>S: Refresh token and retry once
```

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `XAA`, `authServerMetadataUrl must`, `Configured auth server metadata`, `HTTP ${…} fetching configured auth server`, `Unexpected auth result`, `Invalid authorization URL`, `No TTY available to prompt for client secret`, `Enter OAuth client secret`, `Unable to build claude.ai connector auth URL`, `Server type "${…}" does not support OAuth`, `No OAuth flow in progress`, `Invalid callback URL`, `MCP OAuth failed`, `OAuth flow completed without`, `No available ports for OAuth redirect`, `clientMetadataUrl must` | <Undocumented /> | An MCP OAuth or XAA (cross-app access) sign-in step failed. | Discovery of protected resource metadata or authorization server metadata failed or did not match, the token endpoint is not HTTPS, the token exchange or jwt-bearer grant failed or returned an unexpected shape, XAA is not enabled (`CLAUDE_CODE_ENABLE_XAA=1`), no IdP connection is configured, or the callback URL does not belong to this sign-in. In `2.1.311`, the server now names an authorization server other than the one you signed in with (`XAA: authorization server changed`). If the move is expected, run `claude mcp remove` for the server and add it again with its client secret (`chunk-mghdt42f.js:847`). |
| `Could not check "${…}" against your organization's connector list in time` | <Undocumented /> | A sign-in to an MCP server was stopped, because Claude Code could not get your organization's list of claude.ai connectors in time. | The sign-in waits for that list first. When the wait ends without a list, and the fetch of the list itself did not fail, the text is `Could not check "${…}" against your organization's connector list in time. Try signing in again later.` Sign in again later. Source: the program (`chunk-2x9ma4k7.js:4330619`). |
| `Could not check "${…}" against your organization's connector settings, so the sign-in was stopped.`, `Could not check this MCP server against your organization's connector settings, so the sign-in was stopped.` | <Undocumented /> | A sign-in to an MCP server was stopped, because the check against your organization's connector settings did not finish. | The first form names the server. It follows a failed wait for the connector list. The second form has no name. It applies to a server that a plugin or a plugin agent declares, when the `require_connector_block_on_plugin_servers` flag is not off. The check also runs on the headers that the server gets. Sign in again later, or ask your administrator. Source: the program (`chunk-2x9ma4k7.js:4330619` and `chunk-mghdt42f.js:6533`). |
| `Too many named hosts` | <Undocumented /> | The check of a server against the connector block list stopped, because the headers of the server name more than 32 distinct hosts. | The check reads the `host`, `x-forwarded-host`, and `forwarded` headers of the server. A set of more than 32 hosts throws this plain error, with no other text. Name fewer hosts in those headers. Source: the program (`chunk-2x9ma4k7.js:4314036`). The program does not show here what a caller does with the error. |

## Related Pages

- [MCP](index.md)
- [MCP Commands](cli.md)
- [MCP Env Vars](env.md)
- [Settings: Authentication](../../configure/settings/auth.md) for the sign-in of Claude Code itself
