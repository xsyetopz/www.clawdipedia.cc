---
title: Auth Settings
description: Keys that tell Claude Code how to sign in and how to get credentials from your own scripts.
sidebar_position: 4
---

These keys control sign-in rules and credential helpers.
A helper is a script of your own that prints a token or a header.
Claude Code runs the helper when it needs a fresh value.

The helper keys point at your own command. The `forceLogin*` keys restrict sign-in methods.

## Keys

Source: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, Source: the program (its bundled settings schema).
Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `allowedProviders` | <Documented /> <ManagedOnly /> | array of: `anthropic`, `customEndpoint`, `bedrock`, `vertex`, `foundry`, `anthropicAws`, `mantle`, `gateway` | - | Limit which API providers a machine may use. This key works in managed settings only. Claude Code removes unknown entries. An empty list admits nothing. Claude Code refuses a session on an unlisted provider at startup, at login, and on the next API call. Claude Code admits `customEndpoint` (any other base URL) only for a value pinned in the `env` block of the same managed source. Source: the program. | Managed settings only |
| `apiKeyHelper` | <Documented /> | string | - | Generate the API credential with your own command. | Any settings file |
| `awsAuthRefresh` | <Documented /> | string | - | Refresh expired Bedrock credentials in `.aws` with your own command. | Any settings file |
| `awsCredentialExport` | <Documented /> | string | - | Supply Bedrock credentials as JSON from your own command. | Any settings file |
| `forceLoginGatewayUrl` | <Documented /> | string | - | Set the gateway URL the login screen connects to. Pairs with `forceLoginMethod: "gateway"`. Claude Code ignores it in project, local, flag, and server-managed settings. | User or managed settings |
| `forceLoginMethod` | <Documented /> | enum: `claudeai`, `console`, `gateway` | - | Restrict login to claude.ai, Claude Console, or a cloud gateway. Since `2.1.321`, the program describes `claudeai` as "a Claude subscription (individual, Team, or Enterprise plans)" (`chunk-413pygry.js:278782`). `2.1.319` said "Claude Pro/Max" (`chunk-qmnffndf.js:275918`). | Any settings file |
| `forceLoginOrgUUID` | <Documented /> | array or string | - | Pin claude.ai logins to your organization. It takes one UUID or an array. In managed settings, login fails for any other account. | Any settings file |
| `gatewayInternalNetworks` | <Documented /> <ManagedOnly /> | array of string | - | Let `/login` reach a cloud gateway on public IPv4 space your organization uses internally. It allows up to 4 IPv4 blocks, each `/8` to `/32`. | Managed settings only |
| `gcpAuthRefresh` | <Documented /> | string | - | Refresh Google Cloud credentials with your own command. | Any settings file |
| `otelHeadersHelper` | <Documented /> | string | - | Generate rotating OpenTelemetry headers with your own command. | Any settings file |
| `proxyAuthHelper` | <Documented /> | string | - | Run your own command that prints a `Proxy-Authorization` header value. Claude Code reads it from the highest-priority source only. | Settings files |
| `xaaIdp` | <Undocumented /> | object | - | Set the XAA (SEP-990) identity provider once. Every XAA-enabled MCP server reuses it. `claude mcp xaa setup` writes it as an object `{ issuer, clientId, callbackPort? }`. | User settings |
| `xaaIdp.callbackPort` | <Undocumented /> <Gated note="Needs CLAUDE_CODE_ENABLE_XAA=1 in the environment" /> | integer above 0 | - | Fixed loopback callback port for the IdP OIDC login. Set it only if the IdP does not honor RFC 8252 port-any matching. Source: the settings schema | User settings |
| `xaaIdp.clientId` | <Undocumented /> <Gated note="Needs CLAUDE_CODE_ENABLE_XAA=1 in the environment" /> | string | - | Claude Code's `client_id` registered at the IdP. Required. Source: the settings schema | User settings |
| `xaaIdp.issuer` | <Undocumented /> <Gated note="Needs CLAUDE_CODE_ENABLE_XAA=1 in the environment" /> | URL | - | The IdP issuer URL for OIDC discovery. Required. Source: the settings schema | User settings |

## Example

### Get the API Key From a Script

The first key runs `~/bin/get-key.sh` to get the API key. The second limits sign-in to Claude Console.

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "apiKeyHelper": "~/bin/get-key.sh",
  "forceLoginMethod": "console"
}
```

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `Login failed: Unable to create API key` | <Undocumented /> | A Console sign-in that makes an API key got no key back. | The token has no `user:inference` scope, so Claude Code asks the server for an API key, and the answer has no key. Run: `claude auth login --console` against a local stand-in server that gave a token with the scopes `org:create_api_key user:profile` and answered `create_api_key` with `{}`. It printed `Login failed: Unable to create API key. The server accepted the request but did not return a key.` and exited with code 1. Probe case `print.err319.console-login-no-key`. |
| `The recommended sign-in isn't available on this machine` | <Undocumented /> | The keyless Console sign-in of `/login` found no folder for its profile, so it goes on with the API-key sign-in. | The profile folder comes from `ANTHROPIC_CONFIG_DIR`, `XDG_CONFIG_HOME`, or `HOME`. With all three empty and no API key, the screen showed `The recommended sign-in isn't available on this machine (no Anthropic config directory was found), so this sign-in will create an API key.` The debug log had `Keyless Console sign-in unavailable here, continuing with the API-key sign-in: Cannot locate the Anthropic config directory. Set ANTHROPIC_CONFIG_DIR (or HOME) and try again.` `claude auth login --console` does not use this sign-in. Probe case `pty.cli319.login-console-profile-no-dir`. |
| Various | <Undocumented /> | **Login and accounts.** Claude Code refused a sign-in, sign-out, token, or profile step. | You gave both `--console` and `--claudeai`. The policy does not permit `setup-token`. An API key or provider setting takes precedence over a profile. A workload identity federation machine signs in on its own. A profile name or config file is not valid. The code is not valid. An account call such as the org UUID or an API key creation failed. A cloud session poll found no access token (`No access token for polling`). |
| Various | <Undocumented /> | **Cloud gateway sign-in.** `claude auth login --gateway-json` or the gateway login of `/login` stopped. | `claude auth login --gateway-json` found no gateway to use: `Cloud gateway sign-in isn't available with this machine's settings. If your organization manages this machine's settings, a gateway in your own settings file isn't used.` A person runs `--gateway-json` by hand in a terminal: `This command is run by the VS Code extension, not by hand. To sign in from a terminal, run /login in Claude Code.` It runs inside a Claude Code session: `Cloud gateway sign-in needs a person to answer its questions, so it cannot run inside a Claude Code session. Sign in from the Claude Code panel in VS Code, or run /login in Claude Code.` The interactive gateway login ends with no new sign-in: `Login interrupted.` (exit code 1; `Login successful.` prints on success). Source: the program (`chunk-ahanvcne.js`). |
| Various | <Undocumented /> | **Organization check after sign-in.** The sign-in itself worked, but Claude Code could not check it against your organization. It writes the reason, then the line "The sign-in was saved but could not be checked against your organization yet; Claude Code checks it again when it next starts." to standard error and carries on. | The organization config call failed or gave no answer. The sign-in stays saved, so the next start checks it again. Source: the program (`chunk-k1jvy9za.js:605`). |
| Various | <Undocumented /> | **Grove settings.** A Grove setting or notice could not be read or changed. | The request failed or the answer has no `grove_enabled` value. |
| Various | <Undocumented /> | **Billing and usage requests.** A billing, usage, or metrics request failed. | The text names the request (for example `prepaid/credits`, `payment_method`, `auto_reload_settings`, `metrics_enabled`) and says it is unavailable, with the reason. |
| Various | <Undocumented /> | **Provider and model setup.** A provider or model setting is not valid. | A project or region value has characters that the request path does not allow. A Foundry resource name is not valid. A model catalog entry or alias is not valid. A fallback model cannot be used. Managed policy settings could not be read, so `allowedProviders` cannot be checked (`Unable to read managed policy settings, which may restrict the API providers this machine may use (allowedProviders)`). In 2.1.321 the text can hold a detail after `(allowedProviders)`, and it ends with the policy lines, or with `Contact your administrator.` when there are none (`chunk-qfakytpa.js:280883`). |
| `Invalid Authorization header value` | <Undocumented /> | **Header values.** Before each request, Claude Code checks the API key, the auth token, and each custom header with the HTTP runtime. A value the runtime refuses stops the request, and no request is sent. The text names the source of the value. The `X-Api-Key` and other header texts follow the same pattern. | Run: `ANTHROPIC_CUSTOM_HEADERS=$'Authorization: a\u0100b' claude -p "Reply with 'OK'."` sent no request and exited 1. The reply starts with `Invalid ANTHROPIC_CUSTOM_HEADERS`, and the debug log had `Invalid Authorization header value from ANTHROPIC_CUSTOM_HEADERS: it contains a non-ASCII character at character 2 (3 characters).` (case `print.err319.custom-headers-bad-authorization`). The runtime takes control bytes such as `\x01`, so a value with only those passes the check. Source: the program (`chunk-d9t0b6zk.js@395405`). |
| `${…} invalid:` | <Undocumented /> | **Apps gateway Claude Desktop overlay.** The apps gateway refused the Claude Desktop settings that it serves, because a key or entry is not in the Claude Desktop schema that the gateway bundles. The full text is `${…} invalid:`, then each key, then `: unknown to the apps gateway's bundled Claude Desktop schema, and Claude Desktop would drop or misread the entry or key that holds such a field; check the spelling, or upgrade the gateway if the field is new`. | The gateway reads the keys that the overlay sets. A key that the bundled schema does not know, and that would change what Claude Desktop reads, ends the load with this text. A key that is unknown but harmless only gives a warning that ends with `Sent to Claude Desktop as written.` Check the spelling of the key. Upgrade the gateway when the field is new. Since `2.1.321`: `2.1.319` does not have this text. Source: the program (`chunk-dbyxjq34.js:1387099` and `chunk-dbyxjq34.js:1389722`). The program does not show here which call supplies the `${…}` label. |
| `This request would go to a model that is not allowed` | <Undocumented /> | A side request of a user-delegated session was stopped before it left the machine, because its model is not on the list of allowed models. | The check runs only when `CLAUDE_CODE_USER_DELEGATED_SESSION_DIRECT_API` is set. The allowed models come from `CLAUDE_CODE_USER_DELEGATED_SESSION_ALLOWED_CHECK_MODELS`, which holds `claude-opus-5` and `claude-opus-5-5` when unset. A model override that maps to a listed model also passes. On Foundry only a listed name passes. Use a listed model. Source: the program (`chunk-ne1755n5.js:3054426`, `chunk-ne1755n5.js:3179637`, and `chunk-b6d7kq9m.js:19156`). |

## Claude Apps Gateway Server Key

The key `oidc.user_id_claim` belongs to the server configuration of the Claude apps gateway, not to a Claude Code settings file.
No file under `schemas/` holds it. The program defines it as an optional non-empty string.
The [`2.1.312` changelog](https://code.claude.com/docs/en/changelog) names it, but the [`oidc` table](https://code.claude.com/docs/en/claude-apps-gateway-config#oidc) of the gateway configuration page does not.

| Key | Status | What it does | Notes |
| --- | --- | --- | --- |
| `oidc.user_id_claim` | <Differs /> | Names the `id_token` claim that identifies a person. Default `sub`. | New in `2.1.312`. The token must still carry a non-empty `sub`. If the named claim is not a non-empty string, sign-in fails with `USER_ID_CLAIM_MISSING` and the message says to check `oidc.scopes`. Source: `chunk-gs1pnh66.js` lines 57717, 61506, and 61545. |

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Authentication](https://code.claude.com/docs/en/authentication) explains the login methods in the official docs.
- [Auth and Account Variables](../env-vars/auth-and-accounts.md) lists the auth environment variables.
- [Cloud Provider Variables](../env-vars/cloud-providers.md) covers Bedrock, Vertex, and Foundry.
