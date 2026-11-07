---
title: MCP Commands
description: Every claude mcp subcommand and flag, and the /mcp command inside a session.
sidebar_position: 4
---

The `claude mcp` command adds, lists, and removes MCP servers from the shell.
Inside a session, the `/mcp` command shows the state of each server.
For example, `claude mcp list` prints each server and tells you if Claude Code connects to it.

Flags pick the scope, the transport, env vars, headers, and OAuth fields. The commands write to `~/.claude.json` or `.mcp.json`, depending on the scope.

## Subcommands

Source: [Connect Claude Code to Tools via MCP](https://code.claude.com/docs/en/mcp), [Control MCP Server Access for Your Organization](https://code.claude.com/docs/en/managed-mcp), and `claude mcp --help`.

| Command | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| `claude mcp add [options] <name> <commandOrUrl> [args...]` | <Documented /> | Adds a server. | Writes to the scope and prints `Added ...`. Put `--` before a stdio command. Then Claude Code does not parse its flags. Claude Code rejects a reserved name. |
| `claude mcp add-json [options] <name> <json>` | <Documented /> | Adds a server from a JSON string. | Accepts `stdio`, `sse`, `http`, and `ws`. The JSON is the entry object, not the `mcpServers` wrapper. |
| `claude mcp add-from-claude-desktop [options]` | <Documented /> | Imports servers from Claude Desktop. | macOS and WSL only. You pick interactively. Claude Code rejects a name with other characters. A duplicate gets a suffix such as `server_1`. |
| `claude mcp get <name>` | <Documented /> | Shows one server. | Health-checks approved servers and shows `Issue:` on a failure. An unapproved `.mcp.json` server shows `Pending approval`. A plugin stdio server shows `Command: stdio` and `NAME=[REDACTED]`. |
| `claude mcp list` | <Documented /> | Lists servers. | Shows `Connected`, `Needs authentication`, `Failed to connect`, `Pending approval`, or `Disabled for this project`. Warnings show here. |
| `claude mcp remove [options] <name>` | <Documented /> <Caution note="Removes stored OAuth tokens and the client registration of a remote server" /> | Removes a server. | Without `--scope` it removes from the scope where the server exists. It removes stored OAuth tokens and the client registration of a remote server. |
| `claude mcp login [options] <name>` | <Documented /> | Runs OAuth for a server. | Works for `http`, `sse`, and claude.ai connectors. Without a local browser it prints the URL and asks for the redirect URL. |
| `claude mcp logout <name>` | <Documented /> | Clears stored OAuth credentials. | Does not remove the server. |
| `claude mcp reset-project-choices` | <Documented /> | Resets approvals. | Clears every approved and rejected `.mcp.json` server for this project. |
| `claude mcp serve [options]` | <Documented /> | Runs Claude Code as an MCP server. | Over stdio, or over HTTP with `--transport http`. It prints nothing at start. It offers the Claude Code tools to the client. The client must ask you to confirm. Options: `--transport <transport>`. `--port <port>` with `--transport http` (the default `0` lets the kernel pick, and the server binds to `127.0.0.1` only). `--result-format <raw\|rendered>` (`raw` is the JSON of the tool output, and `rendered` is the text the model would see). `--session-tunnel` with `--transport http --port 28471` dials the session tunnel that relays tool calls. It also reads one JSON line (session id, token, API address) from stdin. |
| `claude mcp xaa setup` | <Gated note="CLAUDE_CODE_ENABLE_XAA" /> | Sets the IdP connection for XAA. | Options: `--issuer <url>`, `--client-id <id>`, `--client-secret`, `--callback-port <port>`. Writes `xaaIdp`. The secret comes from `MCP_XAA_IDP_CLIENT_SECRET`. |
| `claude mcp xaa login` | <Gated note="CLAUDE_CODE_ENABLE_XAA" /> | Caches an IdP `id_token`. | Runs the OIDC browser login. Options: `--force` and `--id-token <jwt>` (stores a ready JWT). |
| `claude mcp xaa show` | <Gated note="CLAUDE_CODE_ENABLE_XAA" /> | Shows the current IdP connection config. | Prints the issuer, the client ID, the callback port when set, whether Claude Code stores a client secret, and whether it caches an `id_token`. |
| `claude mcp xaa clear` | <Gated note="CLAUDE_CODE_ENABLE_XAA" /> | Clears the IdP connection config and the cached `id_token`. | Removes `xaaIdp` from the user settings and the stored secret and token. |

## Flags

| Flag | Status | What It Does | How It Works | Used By |
| --- | --- | --- | --- | --- |
| `-s, --scope <scope>` | <Documented /> | Picks the scope. | `local` (default), `user`, or `project`. On `remove`, the default is the scope where the server exists. | `add`, `add-json`, `add-from-claude-desktop`, `remove` |
| `-t, --transport <transport>` | <Documented /> | Picks the transport. | `stdio` (default), `sse`, or `http`. `ws` is not accepted. | `add` |
| `-e, --env <env...>` | <Documented /> | Sets env vars of a stdio server. | `KEY=value`. Put another option between `--env` and the name. | `add` |
| `-H, --header <header...>` | <Documented /> | Sets headers of a remote server. | `"Name: value"` | `add` |
| `--client-id <clientId>` | <Documented /> | Sets the OAuth client ID. | Only for `http` and `sse`. | `add` |
| `--client-secret` | <Documented /> | Prompts for the OAuth client secret. | Masked input. `MCP_CLIENT_SECRET` skips the prompt. Claude Code stores it in the keychain (macOS) or a credentials file. You set it only when you add the server. | `add`, `add-json` |
| `--callback-port <port>` | <Documented /> | Fixes the OAuth callback port. | For servers with a pre-registered `http://localhost:PORT/callback`. For `xaa setup`, an integer from 1 to 65535. | `add` |
| `--xaa` | <Gated note="CLAUDE_CODE_ENABLE_XAA" /> | Enables XAA for the server. | Hidden unless you set the gate. Needs `xaa setup`, `--client-id`, and `--client-secret`. Without the gate, Claude Code prints `--xaa requires CLAUDE_CODE_ENABLE_XAA=1`. | `add` |
| `--web` | <Gated note="tengu_twinkling_aurora" /> | Adds the server as a claude.ai connector, not to the local config. | Takes only a name and an `https://` address. Run `print.cli319.mcp-add-web` (hypothesis: the gate is off; prediction: refusal; result: exit 1): `--web isn't available yet. To add it to your local config, remove --web and use --transport http for an https address.` The program also refuses an address that looks like it has a secret in it. | `add` |
| `--no-browser` | <Documented /> | Prints the authorization URL. | For SSH and headless sessions. You paste the redirect URL back. | `login` |
| `-d, --debug`, `--verbose` | <Documented /> | Debug output, and a verbose override. | None. | `serve` |

## The `/mcp` Command

| Command | Status | What It Does | How It Works |
| --- | --- | --- | --- |
| `/mcp` | <Documented /> | Opens the MCP panel. | Shows status, tool count, `cached` state, and `Issue:`. You can enable, disable, reconnect, authenticate, and clear authentication. |
| `/mcp reconnect all` | <Documented /> | Retries every failed server. | The interactive terminal needs `2.1.284` or later. |
| `/mcp enable\|disable\|reconnect <server>` | <Documented /> | Controls a server without the panel. | Claude Code suggests it when a background session has no terminal attached. |
| `/mcp__<server>__<prompt>` | <Documented /> | Runs an MCP prompt. | See [MCP Runtime](runtime.md#resources-and-prompts). |

## Example

```bash title="Add, check, and remove a server"
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
claude mcp add-json weather '{"type":"http","url":"https://example.com/mcp"}' --scope user
claude mcp list
claude mcp get sentry
claude mcp remove weather --scope user
```

## How It Works

```mermaid
flowchart TD
  A["<code>claude mcp add</code>"] --> B{"<code>--scope</code>"}
  B -->|"<code>local</code>"| C["<code>~/.claude.json</code> projects path"]
  B -->|"<code>user</code>"| D["<code>~/.claude.json</code> <code>mcpServers</code>"]
  B -->|"<code>project</code>"| E["<code>.mcp.json</code>"]
  C --> F[Next session connects]
  D --> F
  E --> F
```

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `Cannot add MCP server`, `Cannot remove MCP server`, `Project-scope MCP server changes`, `Invalid scope:`, `Invalid transport type`, `Invalid header`, `Server added, but the client secret`, `Warning: --client-id`, `Warning: The command`, `If this is an HTTP server`, `If this is an SSE server`, `If this is a remote server`, `To remove from a specific scope`, `Specify a scope with -s`, `Can't read .mcp.json` | <Undocumented /> | Claude Code refused `claude mcp add` or `claude mcp remove`, or the command printed a warning. | One of these causes applies. Enterprise or managed settings control the MCP servers. The host application registers the type. The scope is not allowed. The transport type or header format is wrong. `.mcp.json` is not a regular file or is too large. You gave an OAuth option for a server that is not HTTP or SSE. |
| Various | <Undocumented /> | **Claude Desktop import.** The Claude Desktop integration is not supported or has no config. | It works on macOS and WSL only, or Claude Code could not find the config file in Windows. |
| Various | <Undocumented /> | **MCP server controls.** Claude Code refused an MCP server control or config file. | One of these causes applies. A server name is not in the listing. A request needs a name and an id. Claude Code could not read a `.mcp.json` or `managed-mcp.json` file. The terminal is still starting up. MCP error text or a config is too long or too deeply encoded. Claude Code does not start a server process because it is shutting down. A tool runs on another machine and cannot run here. |
| `Cannot change .mcp.json here` | <Undocumented /> | `claude mcp add` refused to write a `.mcp.json` file. | The folder is a `connector-downloads` folder that has a `.gitignore`. Claude Code saves files from claude.ai connectors there and does not read `.mcp.json` there. Move or rename the folder. Probe case `print.err319.mcp-add-connector-downloads` printed this text. Without the `.gitignore`, the control case printed no error. |
| `Invalid environment variable format` | <Undocumented /> | `claude mcp add` refused an `-e` value. | A value after `-e` has no `=`. The text is `Invalid environment variable format: <value>, environment variables should be added as: -e KEY1=value1 -e KEY2=value2`. Put the server name before `-e`, because `-e` takes many values. Probe case `print.err319.mcp-add-bad-env` printed this text and exited with code 1. |

## Related Pages

- [MCP](index.md)
- [Server Configuration](config.md)
- [MCP Authentication](auth.md)
- [CLI Subcommands](../../configure/cli/subcommands.md)
