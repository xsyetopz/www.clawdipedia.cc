---
title: Auth Settings
description: Keys that tell Claude Code how to sign in and how to get credentials from your own scripts.
sidebar_position: 4
---

These keys control sign-in rules and credential helpers. A helper is a script of your own that prints a token or a header. Claude Code runs the helper when it needs a fresh value, so you do not store a secret in a settings file. Set a helper key to your command to use one. Set a `forceLogin*` key to restrict the sign-in methods that people on a machine can use.

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

## Keys

Official page: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, the facts come from the settings schema.[^schema] Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `allowNestedModelAccessUnderForceLogin` | <Undocumented /> <ManagedOnly /> | boolean | - | For self-hosted runner hosts only. Set `true` to let a Claude Code that a runner session's command starts use the runner's model access (`--nested-model-access`), even when this machine's managed settings set `forceLoginOrgUUID` or `forceLoginMethod`. Claude Code asks the runner which organization the session owner's sign-in belongs to. It stops if the pin does not allow that organization or the runner does not answer. Without the key, the nested Claude Code stays signed out. Any program on the machine can pretend to be the runner, so the pin is no longer a security boundary with this key. Never set it in a profile that reaches people's own computers. Claude Code reads it only from this machine's own administrator sources: MDM, the managed settings file, or a policy helper they name. It ignores the key in server-managed, user, project, local, and `--settings` sources.[^nested-login] | Managed settings only |
| `allowedProviders` | <Documented /> <ManagedOnly /> | array of: `anthropic`, `customEndpoint`, `bedrock`, `vertex`, `foundry`, `anthropicAws`, `mantle`, `gateway` | - | Limit which API providers a machine may use. This key works in managed settings only. Claude Code removes unknown entries. An empty list admits nothing. Claude Code refuses a session on an unlisted provider at startup, at login, and on the next API call. Claude Code admits `customEndpoint` (any other base URL) only for a value pinned in the `env` block of the same managed source.[^providers] | Managed settings only |
| `apiKeyHelper` | <Documented /> | string | - | Generate the API credential with your own command. | Any settings file |
| `awsAuthRefresh` | <Documented /> | string | - | Refresh expired Bedrock credentials in `.aws` with your own command. | Any settings file |
| `awsCredentialExport` | <Documented /> | string | - | Supply Bedrock credentials as JSON from your own command. | Any settings file |
| `forceLoginGatewayUrl` | <Documented /> | string | - | Set the gateway URL the login screen connects to. Pairs with `forceLoginMethod: "gateway"`. Claude Code ignores it in project, local, flag, and server-managed settings. | User or managed settings |
| `forceLoginMethod` | <Documented /> | enum: `claudeai`, `console`, `gateway` | - | Restrict login to claude.ai, Claude Console, or a cloud gateway. `claudeai` means "a Claude subscription (individual, Team, or Enterprise plans)".[^force-login] | Any settings file |
| `forceLoginOrgUUID` | <Documented /> | array or string | - | Pin claude.ai logins to your organization. It takes one UUID or an array. In managed settings, login fails for any other account. | Any settings file |
| `gatewayInternalNetworks` | <Documented /> <ManagedOnly /> | array of string | - | Let `/login` reach a cloud gateway on public IPv4 space your organization uses internally. It allows up to 4 IPv4 blocks, each `/8` to `/32`. | Managed settings only |
| `gcpAuthRefresh` | <Documented /> | string | - | Refresh Google Cloud credentials with your own command. | Any settings file |
| `otelHeadersHelper` | <Documented /> | string | - | Generate rotating OpenTelemetry headers with your own command. | Any settings file |
| `proxyAuthHelper` | <Documented /> | string | - | Run your own command that prints a `Proxy-Authorization` header value. Claude Code reads it from the highest-priority source only. | Settings files |
| `xaaIdp` | <Undocumented /> | object | - | Set the XAA (SEP-990) identity provider once. Every XAA-enabled MCP server reuses it. `claude mcp xaa setup` writes it as an object `{ issuer, clientId, callbackPort? }`. | User settings |
| `xaaIdp.callbackPort` | <Undocumented /> <Gated note="Needs CLAUDE_CODE_ENABLE_XAA=1 in the environment" /> | integer above 0 | - | Fixed loopback callback port for the IdP OIDC login. Set it only if the IdP does not honor RFC 8252 port-any matching.[^schema] | User settings |
| `xaaIdp.clientId` | <Undocumented /> <Gated note="Needs CLAUDE_CODE_ENABLE_XAA=1 in the environment" /> | string | - | Claude Code's `client_id` registered at the IdP. Required.[^schema] | User settings |
| `xaaIdp.issuer` | <Undocumented /> <Gated note="Needs CLAUDE_CODE_ENABLE_XAA=1 in the environment" /> | URL | - | The IdP issuer URL for OIDC discovery. Required.[^schema] | User settings |

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `Login failed: Unable to create API key` | <Undocumented /> | A Console sign-in that makes an API key got no key back. | The token has no `user:inference` scope, so Claude Code asks the server for an API key, and the answer has no key. With a token that has the scopes `org:create_api_key user:profile` and an answer of `{}` from `create_api_key`, `claude auth login --console` printed `Login failed: Unable to create API key. The server accepted the request but did not return a key.` and exited with code 1.[^console-login] |
| `The recommended sign-in isn't available on this machine` | <Undocumented /> | The keyless Console sign-in of `/login` found no folder for its profile, so it goes on with the API-key sign-in. | The profile folder comes from `ANTHROPIC_CONFIG_DIR`, `XDG_CONFIG_HOME`, or `HOME`. With all three empty and no API key, the screen showed `The recommended sign-in isn't available on this machine (no Anthropic config directory was found), so this sign-in will create an API key.` The debug log had `Keyless Console sign-in unavailable here, continuing with the API-key sign-in: Cannot locate the Anthropic config directory. Set ANTHROPIC_CONFIG_DIR (or HOME) and try again.` `claude auth login --console` does not use this sign-in.[^profile-dir] |
| Various | <Undocumented /> | **Login and accounts.** Claude Code refused a sign-in, sign-out, token, or profile step. | You gave both `--console` and `--claudeai`. The policy does not permit `setup-token`. An API key or provider setting takes precedence over a profile. A workload identity federation machine signs in on its own. A profile name or config file is not valid. The code is not valid. An account call such as the org UUID or an API key creation failed. A cloud session poll found no access token (`No access token for polling`). |
| Various | <Undocumented /> | **Cloud gateway sign-in.** `claude auth login --gateway-json` or the gateway login of `/login` stopped. | `claude auth login --gateway-json` found no gateway to use: `Cloud gateway sign-in isn't available with this machine's settings. If your organization manages this machine's settings, a gateway in your own settings file isn't used.` A person runs `--gateway-json` by hand in a terminal: `This command is run by the VS Code extension, not by hand. To sign in from a terminal, run /login in Claude Code.` It runs inside a Claude Code session: `Cloud gateway sign-in needs a person to answer its questions, so it cannot run inside a Claude Code session. Sign in from the Claude Code panel in VS Code, or run /login in Claude Code.` The interactive gateway login ends with no new sign-in: `Login interrupted.` (exit code 1; `Login successful.` prints on success).[^gateway-login] |
| Various | <Undocumented /> | **Organization check after sign-in.** The sign-in itself worked, but Claude Code could not check it against your organization. It writes the reason, then the line "The sign-in was saved but could not be checked against your organization yet; Claude Code checks it again when it next starts." to standard error and carries on. | The organization config call failed or gave no answer. The sign-in stays saved, so the next start checks it again.[^org-check] |
| Various | <Undocumented /> | **Grove settings.** A Grove setting or notice could not be read or changed. | The request failed or the answer has no `grove_enabled` value. |
| Various | <Undocumented /> | **Billing and usage requests.** A billing, usage, or metrics request failed. | The text names the request (for example `prepaid/credits`, `payment_method`, `auto_reload_settings`, `metrics_enabled`) and says it is unavailable, with the reason. |
| Various | <Undocumented /> | **Provider and model setup.** A provider or model setting is not valid. | A project or region value has characters that the request path does not allow. A Foundry resource name is not valid. A model catalog entry or alias is not valid. A fallback model cannot be used. Managed policy settings could not be read, so `allowedProviders` cannot be checked (`Unable to read managed policy settings, which may restrict the API providers this machine may use (allowedProviders)`). The text can hold a detail after `(allowedProviders)`, and it ends with the policy lines, or with `Contact your administrator.` when there are none.[^provider-setup] |
| `Invalid Authorization header value` | <Undocumented /> | **Header values.** Before each request, Claude Code checks the API key, the auth token, and each custom header with the HTTP runtime. A value the runtime refuses stops the request, and no request is sent. The text names the source of the value. The `X-Api-Key` and other header texts follow the same pattern. | `ANTHROPIC_CUSTOM_HEADERS=$'Authorization: a\u0100b' claude -p "Reply with 'OK'."` sent no request and exited 1. The reply starts with `Invalid ANTHROPIC_CUSTOM_HEADERS`, and the debug log had `Invalid Authorization header value from ANTHROPIC_CUSTOM_HEADERS: it contains a non-ASCII character at character 2 (3 characters).` The runtime takes control bytes such as `\x01`, so a value with only those passes the check.[^headers] |
| `${…} invalid:` | <Undocumented /> | **Apps gateway Claude Desktop overlay.** The apps gateway refused the Claude Desktop settings that it serves, because a key or entry is not in the Claude Desktop schema that the gateway bundles. The full text is `${…} invalid:`, then each key, then `: unknown to the apps gateway's bundled Claude Desktop schema, and Claude Desktop would drop or misread the entry or key that holds such a field; check the spelling, or upgrade the gateway if the field is new`. | The gateway reads the keys that the overlay sets. A key that the bundled schema does not know, and that would change what Claude Desktop reads, ends the load with this text. A key that is unknown but harmless only gives a warning that ends with `Sent to Claude Desktop as written.` Check the spelling of the key. Upgrade the gateway when the field is new.[^overlay] |
| `This request would go to a model that is not allowed` | <Undocumented /> | A side request of a user-delegated session was stopped before it left the machine, because its model is not on the list of allowed models. | The check runs only when `CLAUDE_CODE_USER_DELEGATED_SESSION_DIRECT_API` is set. The allowed models come from `CLAUDE_CODE_USER_DELEGATED_SESSION_ALLOWED_CHECK_MODELS`, which holds `claude-opus-5` and `claude-opus-5-5` when unset. A model override that maps to a listed model also passes. On Foundry only a listed name passes. Use a listed model.[^delegated] |

## Claude Apps Gateway Server Key

The key `oidc.user_id_claim` belongs to the server configuration of the Claude apps gateway. It is not a Claude Code settings key. No file under `schemas/` holds it. The program defines it as an optional non-empty string.[^oidc]
The [`oidc` table](https://code.claude.com/docs/en/claude-apps-gateway-config#oidc) of the gateway configuration page does not name it.

| Key | Status | What it does | Notes |
| --- | --- | --- | --- |
| `oidc.user_id_claim` | <Differs /> | Names the `id_token` claim that identifies a person. Default `sub`. | The token must still carry a non-empty `sub`. If the named claim is not a non-empty string, sign-in fails with `USER_ID_CLAIM_MISSING` and the message says to check `oidc.scopes`.[^oidc] |

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Authentication](https://code.claude.com/docs/en/authentication) explains the login methods in the official docs.
- [Auth and Account Variables](../env-vars/auth-and-accounts.md) lists the auth environment variables.
- [Cloud Provider Variables](../env-vars/cloud-providers.md) covers Bedrock, Vertex, and Foundry.

## Sources

[^schema]: The program, its bundled settings schema, `chunk-jkpzhr7r.js:269305`, and for `xaaIdp`, `chunk-jkpzhr7r.js:224651`.
[^providers]: The program, `chunk-jkpzhr7r.js:270772` and `chunk-xethrx83.js:163357`.
[^force-login]: The program, `chunk-jkpzhr7r.js:265014`.
[^nested-login]: The program, `chunk-jkpzhr7r.js:269305` for the schema text and `chunk-xethrx83.js:655425` for the check.
[^console-login]: Run against a local stand-in server. Probe case `print.err319.console-login-no-key`.
[^profile-dir]: Probe case `pty.cli319.login-console-profile-no-dir`.
[^gateway-login]: The program, `chunk-00wezk9v.js:28237` and `chunk-00wezk9v.js:28940`.
[^org-check]: The program, `chunk-00wezk9v.js:26987`.
[^provider-setup]: The program, `chunk-xethrx83.js:160929`.
[^headers]: Probe case `print.err319.custom-headers-bad-authorization`. The program, `chunk-xethrx83.js:421081`.
[^overlay]: The program, `chunk-39421vhy.js:819247` and `chunk-39421vhy.js:821460`. The `${…}` label is `managed.policies[N].desktop`, where `N` is the index of the policy in the gateway file (`chunk-39421vhy.js:855774`).
[^delegated]: The program, `chunk-56bhcxay.js:3489351`, `chunk-56bhcxay.js:3618875`, and `chunk-56bhcxay.js:1363697`.
[^oidc]: The program, `chunk-39421vhy.js:837733`, `chunk-39421vhy.js:962140`, and `chunk-39421vhy.js:962298`.
