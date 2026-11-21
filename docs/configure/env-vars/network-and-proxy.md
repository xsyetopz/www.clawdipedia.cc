---
title: Network and Proxy
description: Environment variables for API addresses, proxies, TLS certificates, time limits, and retries.
sidebar_position: 5
---

These variables control how Claude Code reaches the network. They set the API base URL, proxies, custom certificates, timeouts, and retry counts. Use them behind a company proxy, or when you route traffic through a gateway.

Set a variable in your shell or in the `env` key of `settings.json`. `HTTPS_PROXY`, `NO_PROXY`, and `ANTHROPIC_BASE_URL` are the usual ones. Project settings cannot set some endpoint variables before you trust the folder. This page lists 79 variables.

## Example

```bash
export HTTPS_PROXY="http://proxy.example:8080"
export NO_PROXY="localhost,127.0.0.1"
export API_TIMEOUT_MS=1200000
claude
```

API calls go through the proxy and wait up to 20 minutes.

## Variables

The table is sorted by name.[^names] See [Environment Variables](index.md#how-to-read-the-tables) for what each column and badge means.

| Variable | Status | What it does | Values and default | Notes |
| --- | --- | --- | --- | --- |
| `CLAUDE_BG_GATEWAY_ROUTED` | <Undocumented /> | The background dispatcher sets it to `1` in the environment of a background session that it routed through an LLM gateway. The session reads it to know that the gateway carried it. If a session that has the mark loses its gateway, Claude Code stops it with "No LLM gateway: session stopped." and "No model request was sent."[^bg-gateway] | Claude Code sets it. Do not set it by hand. A server gate for it defaults to on | Background sessions |
| `CLAUDE_CODE_DISABLE_HTTPS_AGENT_KEEPING` | <Undocumented /> | Stops Claude Code from tying the HTTPS agent to the TLS switches. Normally it builds a signature of `NODE_TLS_REJECT_UNAUTHORIZED` and `BUN_TLS_REFUSE_DISTRUSTED_KEYS` (`length:value` for each). It builds a new agent and drops pooled sockets when the signature changes. Set, there is no signature, so a change of those two variables in a session keeps the agent and its sockets. The agent uses keep-alive with no socket limit.[^https-agent] | On or off. Off by default | All sessions |
| `CLAUDE_CODE_DISABLE_LOOPED_CROSS_CERT_DROP` | <Undocumented /> | Keeps the cross-certificates that Claude Code would drop from the system store. A certificate is dropped when it is a single, unexpired entry whose issuer links lead back to itself, and the store holds a valid self-signed root with the same subject, key, and subject key identifier that does not expire sooner. A certificate that `NODE_EXTRA_CA_CERTS` also lists stays. If a store entry does not parse, nothing is dropped. The log says `CA certs: Dropped N cross-certificate(s) ...`.[^cross-cert] | On or off. Off by default. A client certificate (`CLAUDE_CODE_CLIENT_CERT`) also skips the drop | All sessions |
| `CLAUDE_CODE_DISABLE_SELF_NAMED_CERT_DROP` | <Undocumented /> | Keeps every certificate in the `NODE_EXTRA_CA_CERTS` file whose subject and issuer match, whoever signed it. Normally Claude Code drops such a certificate when its own key did not sign it, or it cannot check that, unless a kept certificate issued it or it is in the built-in root list. If all or none would be dropped, the list stays whole. The log says `CA certs: Dropped the certificate with SHA-256 fingerprint ...` at error level.[^self-named] | On or off. Off by default. A client certificate also skips the drop | All sessions |
| `all_proxy` | <Undocumented /> | Lower case proxy variable. It is the last fallback after `HTTPS_PROXY` and `ALL_PROXY` for git proxy settings. | Text. Non-empty string. Also listed with proxy names | All sessions |
| `ANTHROPIC_BASE_URL` | <Documented /> | Overrides the API endpoint. A non-first-party host changes first-party checks, such as Remote Control. | Text. An unset value or an Anthropic host counts as first party | All sessions. Not set from project `env` before trust |
| `ANTHROPIC_CUSTOM_HEADERS` | <Documented /> | Adds custom request headers. | Text. Split on new lines, each `Name: Value` at the first colon. Claude Code drops bad header names or values with a warning. A bad `Authorization` value stops each request instead (see [Errors](../settings/auth.md#errors)) | All sessions. Not set from project `env` before trust |
| `ANTHROPIC_UNIX_SOCKET` | <Documented /> | Sends first-party API requests over this Unix socket path. | Text. Claude Code passes it as the `unix` fetch option. Also in the host-managed provider list with `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | First-party API client, all. Not set from project `env` before trust |
| `API_FORCE_IDLE_TIMEOUT` | <Documented /> | Forces the streaming body idle timeout on or off. | On, off, or unset. A true value forces it on and a false value (`0`) turns the fetch timeout off. Any other value, such as a number of seconds, counts as unset.[^force-idle] | Anthropic API client, all. Not set from project `env` before trust |
| `API_TIMEOUT_MS` | <Documented /> | Sets the API request timeout in milliseconds. | A number of milliseconds, `600000` (10 minutes) by default. Whole number. Errors show a hint to raise it | All sessions. Not set from project `env` before trust |
| `BUN_TLS_REFUSE_DISTRUSTED_KEYS` | <Undocumented /> | A Bun runtime variable. Claude Code counts any value except `1` as a TLS trust override, as it does for `NODE_TLS_REJECT_UNAUTHORIZED`.[^bun-tls] | Text. Raw string. Any set value other than `1` counts | All sessions |
| `CARGO_HTTP_CAINFO` | <Undocumented /> | Names the CA bundle file for Cargo. Claude Code sets it to the sandbox CA bundle for sandboxed commands, next to `SSL_CERT_FILE` and others. | Text. Also in a list of CA env names | Sandboxed commands and remote sessions |
| `CLAUDE_AGENT_SDK_CLIENT_APP` | <Documented /> | Names the client app of an Agent SDK host. Claude Code adds it to the user agent as `client-app/<value>`. | Text | SDK hosts. Not set from project `env` before trust |
| `CLAUDE_AGENT_SDK_VERSION` | <Undocumented /> | Reports the Agent SDK version. Claude Code adds it to the user agent as `agent-sdk/<value>`. | Text. The SDK host sets it | SDK hosts. Not set from project `env` before trust |
| `CLAUDE_BG_GATEWAY_WITHHELD` | <Undocumented /> | Names a gateway setting that the dispatcher did not pass to a background session. The session then prints a no-gateway hint. | Text. Active only when `ANTHROPIC_BASE_URL` is unset. Claude Code removes it from the child env | Background sessions. Not set from project `env` before trust |
| `CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS` | <Documented /> | Sets the idle timeout of the byte-level streaming watchdog. | A number of milliseconds. Whole number of `1` or more, clamped to `10000`-`1800000`. Else a first-party default of `180000` from a feature flag | API streaming. Not set from project `env` before trust |
| `CLAUDE_CODE_ADDITIONAL_PROTECTION` | <Undocumented /> | Adds the `x-anthropic-additional-protection: true` header to API requests. | On or off. Read when Claude Code builds the API client | API requests. Not set from project `env` before trust |
| `CLAUDE_CODE_API_BASE_URL` | <Undocumented /> | Gives a fallback API base URL. The Files API uses it when `ANTHROPIC_BASE_URL` is unset. Default `https://api.anthropic.com`. | Text. `ANTHROPIC_BASE_URL` wins when both are set. Credential checks also treat it as a base URL source | First-party API and Files API. Not set from project `env` before trust |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | <Documented /> | Controls the attribution block at the start of the system prompt. A falsy value such as `0` omits it. | Text. Policy settings have a rule for it. Repo-committed settings may not re-point it | First-party API, not `CLAUDE_CODE_REMOTE` |
| `CLAUDE_CODE_CERT_STORE` | <Documented /> | Chooses the CA certificate sources for TLS. | A comma-separated list, `bundled,system` by default. When no certificate authority is left, startup fails with `No certificate authority to trust: ...` or `No root certificates are left to trust: ...`. Some of these messages name this variable, `SSL_CERT_FILE`, or `SSL_CERT_DIR`[^cert-store] | All sessions |
| `CLAUDE_CODE_CLIENT_CERT` | <Documented /> | Gives the path of the client certificate file for mTLS. | Text. Claude Code reads the file and skips a cert and key that do not match | All sessions |
| `CLAUDE_CODE_CLIENT_KEY` | <Documented /> | Gives the path of the client private key file for mTLS. | Text. Claude Code reads the file | All sessions |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | <Documented /> | Gives the passphrase of an encrypted client key. | Text. Claude Code uses it for the key check and the TLS agent | All sessions |
| `CLAUDE_CODE_DISABLE_MTLS_RELOAD_ON_STALE_CONNECTION` | <Documented /> | Stops the re-read of the mTLS client cert and key after a connection-level API error. | On or off. Only matters when `CLAUDE_CODE_CLIENT_CERT` is set | MTLS setups |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | <Documented /> | Turns off nonessential network traffic such as updates, telemetry and error reporting. | On or off | All sessions |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | <Documented /> | Stops the non-streaming retry after a stream fails mid-stream. | On or off | All sessions. Project `env` can set it before trust |
| `CLAUDE_CODE_DISABLE_POOLED_CONNECTION_IDLE_LIMIT` | <Undocumented /> | Stops the idle limit on pooled connections in a cloud session. Without it, Claude Code turns TCP keepalive off and sets a 35000 ms socket timeout when a pooled connection goes idle. It turns keepalive on (1000 ms) and clears the timeout when the connection is reused. | On or off, off by default. The limit applies only when `CLAUDE_CODE_REMOTE` is true and `CLAUDE_CODE_ENVIRONMENT_KIND` is unset | Cloud sessions |
| `CLAUDE_CODE_DISABLE_PROXY_SCHEME_REPAIR` | <Undocumented /> | Stops Claude Code from adding `http://` to a bare `host:port` value of `https_proxy` or `HTTPS_PROXY`. When neither stdin nor stdout is a terminal, such as in the desktop app, an SDK, or cron, Claude Code repairs a bare value of this kind. | On or off, off by default. The repair applies only to a value such as `proxy.example:8080` (host, colon, port 1 to 65535) from `https_proxy` or `HTTPS_PROXY`. It does not apply when stdin or stdout is a terminal, or when `--bg`, `--background`, or `--routine` is in the arguments.[^scheme-repair] | All sessions |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING` | <Documented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces tool input streaming on or off. The code matches the official page.[^fgts] | On, off, or unset. `0` is off. Else first party needs a feature flag, Vertex and Bedrock need model support and no custom base URL, `1` forces on. A Bedrock base URL on Amazon's own `https://bedrock-runtime.<region>.amazonaws.com` host does not count as custom | All sessions. Project `env` can set it before trust |
| `CLAUDE_CODE_EXTRA_BODY` | <Documented /> | Merges a JSON object into the top level of every API request body. | JSON text. Ignored when org policy blocks experimental betas. Passed on to background sessions | All sessions |
| `CLAUDE_CODE_EXTRA_METADATA` | <Undocumented /> | Merges a JSON object into the metadata of API requests. | JSON text. Claude Code logs an error and ignores a bad value | All sessions |
| `CLAUDE_CODE_GATEWAY_HINT_HEADERS` | <Documented /> <Gated note="Works only behind a feature flag or server gate" /> | Sends or stops the gateway hint headers such as `x-claude-code-request-class`. | On, off, or unset. Unset sends them on some connections and else uses a feature flag on first party | All sessions |
| `CLAUDE_CODE_GATEWAY_MODEL_DISCOVERY_TIMEOUT_MS` | <Documented /> | Sets the timeout of the gateway `/v1/models` discovery request. | A number of milliseconds, `3000` by default. Whole number from `1` to `2147483647`, plain digits | Gateway setups with discovery on |
| `CLAUDE_CODE_GZIP_CCR_REQUEST_BODIES` | <Undocumented /> | Turns gzip of CCR worker request bodies on or off. | On, off, or unset. Used only for the `ccr_worker` source | Remote worker sessions |
| `CLAUDE_CODE_GZIP_DATADOG_LOGS` | <Undocumented /> | Turns gzip of Datadog log batches on or off. | On, off, or unset. Unset is on only in Anthropic-hosted remote sessions (`CLAUDE_CODE_REMOTE` set, `CLAUDE_CODE_ENVIRONMENT_KIND` unset, so not BYOC), else off. If Datadog refuses a gzipped batch, gzip is off for the rest of the process | All sessions |
| `CLAUDE_CODE_GZIP_REQUEST_BODIES` | <Documented /> | Turns gzip of request bodies to Anthropic on or off. Set `0` for a TLS-inspecting proxy. | On, off, or unset. Compression is skipped for a proxy, mTLS, a custom CA, or a Unix socket. Level comes from `CLAUDE_CODE_GZIP_REQUEST_BODY_LEVEL` | Direct Anthropic connections |
| `CLAUDE_CODE_GZIP_REQUEST_BODY_BLOCKS` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Sets the `blocks` gzip mode for large request bodies, from 524288 chars up. | A number, `0` by default. Whole number from `0` to `2`, plain digits. Only `1` and `2` act | Messages API requests |
| `CLAUDE_CODE_GZIP_REQUEST_BODY_LEVEL` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Sets the gzip level for request bodies. | A number, `0` by default. Whole number from `0` to `9`, plain digits. Only `1` to `9` act | All API requests |
| `CLAUDE_CODE_HTTP_PROXY` | <Undocumented /> | Gives the fallback HTTP proxy. Claude Code uses it to build the proxy variables of child tools when `HTTP_PROXY` and `http_proxy` are empty. | Text. Fills `YARN_*`, `npm_config_*`, and `GLOBAL_AGENT_*` proxy vars that are unset | All sessions, child process env |
| `CLAUDE_CODE_HTTPS_PROXY` | <Undocumented /> | Gives the fallback HTTPS proxy. Claude Code uses it to build the proxy variables of child tools when `HTTPS_PROXY` and `https_proxy` are empty. | Text. Fills `YARN_*`, `npm_config_*`, and `GLOBAL_AGENT_*` proxy vars that are unset | All sessions, child process env |
| `CLAUDE_CODE_INCREMENTAL_REQUEST_BODY` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Builds API request bodies step by step, from the body of an earlier request. | A number, `0` by default. Needs the first-party provider and a feature flag.[^kurzweil] A request with `output_format` set is not built this way. A body that fails a check is not used | First-party API requests |
| `CLAUDE_CODE_MAX_RETRIES` | <Documented /> | Sets how many times Claude Code retries a failed API request. | A number. Whole number, `0` or more. Claude Code clamps a value above the cap with a warning unless the retry watchdog is on | All sessions |
| `CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES` | <Documented /> | Limits the re-sends of a non-streaming request that reaches its timeout. `0` fails on the first timeout. | A number. Whole number min `0`, digits only. Unset uses a built-in count only when the retry watchdog is on | All sessions |
| `CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS` | <Documented /> | Sets the first delay of the exponential backoff for retries of an overloaded API error. | A number of milliseconds. Whole number from `500` to `32000` in plain digits, else unset. Used only on the overloaded branch of the retry loop | All API requests |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` | <Documented /> | Sets the ceiling of the backoff for retries of an overloaded API error. | A number of milliseconds. Whole number from `32000` to `300000` in plain digits, else unset. A longer wait than the ceiling plus a margin raises a retry-after error | All API requests |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_WAIT_MS` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Lets the main conversation keep retrying an overloaded API error, with this value as the wait limit. | A number of milliseconds. It has no effect when `CLAUDE_CODE_MAX_RETRIES` or `CLAUDE_CODE_RETRY_WATCHDOG` is set, or outside the main conversation. A feature flag gates it and defaults to on[^steady-heron] | Main conversation API requests |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | <Documented /> | Lets the proxy resolve DNS names. | On or off. When set the proxy agent `lookup` returns the host name as is. When `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` is set, Claude Code ignores this variable from a settings file `env` and logs `Ignoring CLAUDE_CODE_PROXY_RESOLVES_HOSTS`[^proxy-hosts] | HTTP proxy setups |
| `CLAUDE_CODE_RETRY_WATCHDOG` | <Documented /> | Retries `429` and `529` capacity errors without end for unattended sessions. The official page matches the code path that reads it. | On or off. The self-hosted runner sets it to `1` and also clears `CLAUDE_CODE_MAX_RETRIES`. The official page also covers the spend-limit rule | Unattended runs, CI, remote workers. Set by Claude Code for self-hosted runners |
| `CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS` | <Documented /> | Lets the retry watchdog notice a usage limit that was lifted before its reset. Claude Code logs `[usage limit recheck]` lines when it sends or skips a probe request. | A number of milliseconds. No format check is shown | Sessions with `CLAUDE_CODE_RETRY_WATCHDOG` |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS` | <Undocumented /> | Caps the total ms that the retry watchdog waits for usage-limit `429` errors to end. When the wait is longer than what is left, the request fails. | A number of milliseconds. Integer 1 or more, digits only. Unset means no limit | Sessions with the retry watchdog on |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` | <Documented /> | Caps the ms each API request spends waiting out `429` and `529` errors under the watchdog. After that the next error ends the request. | A number of milliseconds. Integer 1 or more, digits only. Unset means no limit | Sessions with `CLAUDE_CODE_RETRY_WATCHDOG` |
| `CLAUDE_CODE_RETRY_WATCHDOG_SCOPE` | <Undocumented /> | Narrows the retry watchdog to capacity errors. With `capacity`, the watchdog still retries `429` and `529` errors without end, but its other extensions are off: more retries after no response or a non-streaming timeout, keeping background requests on `529`, and the server-error model fallback. | Text. Only `capacity` has an effect | Sessions with `CLAUDE_CODE_RETRY_WATCHDOG` |
| `CLAUDE_CODE_UNWATCHED_REPLY_HOLD_MS` | <Undocumented /> | Holds the streamed reply of a subagent, an auxiliary, or a compaction request for up to this many ms before it passes the data on. | A number of ms, `0` by default (no hold). Applies to content block delta and ping events. Held data goes on at 262144 bytes | Streaming replies of subagent, auxiliary, and compaction requests |
| `CLAUDE_ENABLE_BYTE_WATCHDOG` | <Documented /> | Forces the byte-level streaming idle watchdog on or off. | On, off, or unset, on by default. Unset uses a feature flag with default true. Direct, AWS, and gateway only | Anthropic API, AWS, gateway |
| `CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK` | <Documented /> | Enables the byte-level streaming idle watchdog for Bedrock event streams. | On or off. Off by default. Needs the main watchdog to be on | Amazon Bedrock |
| `CLAUDE_ENABLE_STREAM_WATCHDOG` | <Documented /> | Forces the event-level streaming idle watchdog on or off. It also sets the async agent stall time. | On, off, or unset, on by default | All sessions |
| `CLAUDE_SLOW_FIRST_BYTE_MS` | <Undocumented /> | Sets the wait before Claude Code logs a slow first byte on a stream. It does not abort. | A number of milliseconds | - |
| `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS` | <Documented /> | Sets the first-byte deadline of a streaming request in ms. | A number of milliseconds | - |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | <Documented /> | Sets the idle timeout of the stream watchdogs in ms. A value above 5 minutes also raises the 5-minute connection limit, up to 30 minutes, on gateways, custom base URLs, and cloud providers.[^stream-idle-limit] | A number of milliseconds | - |
| `CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE` | <Undocumented /> | Names a CA bundle file for `gcloud`. The Bash sandbox treats it as a CA bundle variable. | A path | - |
| `CURL_CA_BUNDLE` | <Undocumented /> | Names a CA bundle for `curl`. The Bash sandbox treats it as a CA bundle variable. | - | - |
| `DENO_CERT` | <Undocumented /> | Names a CA bundle for Deno. The Bash sandbox treats it as a CA bundle variable. | - | - |
| `GIT_SSL_CAINFO` | <Documented /> | Gives the Git CA bundle path. Claude Code names it in CA hints and in runner messages saying a server value replaces it in a session. | Text. Use is mostly by name in text and lists | Git. Self-hosted runner. Not set from project `env` before trust |
| `HTTP_PROXY` | <Documented /> | Sets the HTTP proxy for Claude Code network traffic. | - | - |
| `http_proxy` | <Documented /> | Lower case HTTP proxy URL. Claude Code reads it as an alternative to `HTTP_PROXY`. | Text. Non-empty string. Order is `HTTP_PROXY`, this, then `CLAUDE_CODE_HTTP_PROXY` for the sandbox proxy | All sessions |
| `HTTPS_PROXY` | <Documented /> | Sets the HTTPS proxy for Claude Code network traffic. | - | - |
| `https_proxy` | <Documented /> | Lower case HTTPS proxy URL. Claude Code reads it as an alternative to `HTTPS_PROXY`. | Text. Non-empty string. Order is `HTTPS_PROXY`, this, then `CLAUDE_CODE_HTTPS_PROXY` for the sandbox proxy. A bare `host:port` value is repaired to `http://host:port` in a run with no terminal on stdin and stdout (see `CLAUDE_CODE_DISABLE_PROXY_SCHEME_REPAIR`) | All sessions |
| `NIX_SSL_CERT_FILE` | <Undocumented /> | Claude Code sets it to the CA bundle path in sandboxed commands, with other CA variables. | A path | - |
| `NO_PROXY` | <Documented /> | Lists hosts that skip the proxy. `*` skips it for all. | On or off | - |
| `no_proxy` | <Documented /> | Lower case proxy bypass list. Claude Code reads it with `NO_PROXY`. | A comma-separated list. If both are set and differ, Claude Code joins them with a comma | All sessions |
| `NODE_EXTRA_CA_CERTS` | <Documented /> | Adds extra CA certificates from a PEM file to the trusted set. If the file is empty, is not PEM, or holds a damaged certificate, the program uses the certificates it can read and prints a warning on stderr. See [`NODE_EXTRA_CA_CERTS` File Faults](#node_extra_ca_certs-file-faults). | A path to a PEM file | All sessions |
| `NODE_TLS_REJECT_UNAUTHORIZED` | <Documented /> | Set to `0` to turn off TLS certificate checks (Bun). Claude Code counts any value except `1` as a trust override. | - | - |
| `NODE_USE_ENV_PROXY` | <Undocumented /> | A value other than empty or `0` makes the Bun `http` client use `HTTP_PROXY` and `HTTPS_PROXY`. A bundled proxy tip names it for Node 22.21 and later. | - | - |
| `NODE_USE_SYSTEM_CA` | <Undocumented /> | The value `1` makes the Bun runtime add the OS CA store to the default CA list. | - | - |
| `SSL_CERT_DIR` | <Undocumented /> | Gives the directory of CA certificates. Claude Code counts it as a custom CA setting. | Text. Raw string. Together with `NODE_EXTRA_CA_CERTS` and `SSL_CERT_FILE`, it makes the TLS setup treat custom certs as set | All sessions |
| `SSL_CERT_FILE` | <Documented /> | Gives the CA bundle file path. Claude Code treats it as a custom CA setting, and passes it to proxy helpers and the MCP agent proxy. | Text. Raw string. The MCP agent proxy fallback reads the file as PEM | All sessions |
| `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL` | <Undocumented /> | Makes Claude Code treat a custom base URL as first party. A probe with it set raised the beta headers from 9 to 12 (added `prompt-caching-scope-2026-01-05`, `thinking-binding-controls-2026-08-01`, `cache-diagnosis-2026-04-07`) and added a `diagnostics` key to the request body.[^assume-first-party] | Any set value. Not set by default | All sessions |

## `NODE_EXTRA_CA_CERTS` File Faults

A file named in `NODE_EXTRA_CA_CERTS` that is empty, is not PEM, or holds a damaged certificate does not stop every connection. The program uses the certificates it can read and reports the fault.[^ca-faults]

| Fault | Report |
| --- | --- |
| The file holds no certificate that the program can read: an empty file, text that is not PEM, or only damaged certificates | Stderr: `Claude Code ignored all of the NODE_EXTRA_CA_CERTS file: it holds no certificate that Claude Code can read.` |
| The certificates in the file cannot all load together | Stderr: `Claude Code used only the certificates that it could read in full from the NODE_EXTRA_CA_CERTS file`, with more text that follows it in the program |
| Some certificates in the CA list cannot be read | Debug log: `CA certs: N certificate(s) in the CA list could not be read and are skipped` |
| The path has no file, or the read fails | Debug log: `CA certs: Failed to read NODE_EXTRA_CA_CERTS file (<path>): <error>` |

## Certificate Name-Constraint Errors

The message text below comes from the program.[^name-constraint]

A certificate authority in the server's chain can limit the names it may certify (a name constraint).
When a server certificate breaks that limit, Claude Code shows a message that says what to fix.
Whoever runs the server, proxy, or gateway makes the fix.
The message starts with `Unable to connect to API: SSL certificate verification failed (<code>).`

| Code | What the message says to do |
| --- | --- |
| `PERMITTED_VIOLATION`, `EXCLUDED_VIOLATION` | Issue a new certificate whose names all fit the limit, or one whose chain has no such limit. The message adds that a certificate with no DNS subject alternative name can have its common name checked as a DNS name, even an address. |
| `NAME_CONSTRAINTS_WITHOUT_SANS` | Issue a new certificate that lists its names as subject alternative names. |
| `UNSUPPORTED_CONSTRAINT_TYPE` | The limit covers a kind of name that Claude Code cannot check, usually IP addresses. Claude Code refuses any certificate under such an authority that lists a name of that kind. Issue a certificate whose chain has no such limit, or one that lists only DNS names that every authority in the chain allows. Clients must then use those names to reach the server. |

## Certificate Signature Errors

Status: <Undocumented /> in the official docs. The message text comes from the program.[^signature]

The message starts with `Unable to connect to API: SSL certificate verification failed (CERT_SIGNATURE_FAILURE).`
The message then says:

- After a CA renewal, this computer can trust two CA certificates with the same name but different keys. The server's certificates do not say which key signed them.
- The fix is to issue certificates with authority key identifiers, or to trust only the one CA that still signs.
- "If no CA was renewed, don't work around this error, because it can also mean that something on the network changed the connection."

When Claude Code knows that an IT team manages the computer, the message words the fix for that team.

## Proxy Requests with Only `ALL_PROXY`

Status: <Undocumented /> in the official docs. The code is a shared HTTP client, so it applies to the requests of that client and not only to plugin requests.[^all-proxy]

- When `ALL_PROXY` is the only proxy variable, the client sends its requests through a CONNECT tunnel.
- The connect timeout is 25000 ms. After that, the error says "Timed out connecting through the proxy set in HTTPS_PROXY or ALL_PROXY. Check that the proxy is running and can reach the destination server. You can also add that server to NO_PROXY."
- A proxy value that is not an http or https URL gives "The proxy setting (HTTPS_PROXY or ALL_PROXY) is not an http or https URL, so this request was not sent.".

## How It Works

Claude Code reads shell variables once at startup, so restart after a change. Claude Code reapplies values in a settings `env` block when the file changes. It does not reapply them for features that read their variables only at startup. Numeric variables such as timeouts accept forms like `2e3` and `64_000` in addition to plain digits, except where a row says digits only.

## Related Pages

- [Environment Variables](index.md): how Claude Code reads variables and which value wins.
- [Cloud Providers](cloud-providers.md)
- [System and Third-Party](system-and-third-party.md): `ALL_PROXY` and CA bundle names owned by other tools.
- [Undocumented Items](../../reference/undocumented.md): every item that only the program shows.

## Sources

[^names]: The program, `chunk-c203g5kd.js:916` (the table of variable names, for example `CLAUDE_CODE_DISABLE_HTTPS_AGENT_KEEPING`), and the [Environment Variables](https://code.claude.com/docs/en/env-vars) page of the official docs.
[^bg-gateway]: The program, `chunk-bbcqrxq1.js:1145` (the dispatcher sets it when `gatewayRouted` is true), `chunk-gd77dyw4.js:631` (the variable name `CLAUDE_BG_GATEWAY_ROUTED`), `chunk-gttxc09k.js:20` (the session reads it), and `chunk-gttxc09k.js:61` and `chunk-gttxc09k.js:61` (the stop messages). Gate `tengu_bg_gateway_mark`, default on, at `chunk-gttxc09k.js:20`.
[^https-agent]: The program, `chunk-3jjr3wje.js:4278-4280` (the signature, `CLAUDE_CODE_DISABLE_HTTPS_AGENT_KEEPING`), `chunk-3jjr3wje.js:5903-5904` (the log text), and `chunk-3jjr3wje.js:6191-6198` (the agent options, `keepAlive`).
[^cross-cert]: The program, `chunk-3jjr3wje.js:4668` (the log text), `chunk-3jjr3wje.js:5666-5669` (the switch and the client certificate check), and `chunk-3jjr3wje.js:5366-5370` (the client certificate flag).
[^self-named]: The program, `chunk-3jjr3wje.js:5450-5456` (the switch), `chunk-3jjr3wje.js:5551` (the log text), and `chunk-3jjr3wje.js:5366-5370` (the client certificate flag).
[^bun-tls]: The program, `chunk-gd77dyw4.js:395-398` (the two TLS variable names, `NODE_TLS_REJECT_UNAUTHORIZED` and `BUN_TLS_REFUSE_DISTRUSTED_KEYS`) and `chunk-3jjr3wje.js:4272` (a value other than `1` counts, `!== "1"`).
[^cert-store]: The program, `chunk-3jjr3wje.js:4395-4405` (the variable), `chunk-3jjr3wje.js:5156-5163` (the startup messages), and `chunk-3jjr3wje.js:5634` (the message that names the variable).
[^proxy-hosts]: The program, `chunk-3jjr3wje.js:6582-6585` (the proxy agent `lookup`), `chunk-18mwdpr8.js:147-150` (the WebSocket path), `chunk-scytkwpe.js:152` (the host-managed list), and `chunk-5e3gtsn9.js:990-1004` (the `Ignoring` log). Probe cases `print.env319a.proxy-resolves-hosts-from-settings.unset` and `.v1`.
[^steady-heron]: The program, `chunk-bzyb60p0.js:160663-160671`. Feature flag `tengu_steady_heron`.
[^kurzweil]: The program, `chunk-bzyb60p0.js:157788` (feature flag `tengu_soft_kurzweil`) and `chunk-bzyb60p0.js:157881` (the first-party and `output_format` checks).
[^fgts]: The program, `chunk-bzyb60p0.js:110138` (the setting) and `chunk-zhr7rpv7.js:1910` (the Amazon Bedrock host check on `ANTHROPIC_BEDROCK_BASE_URL`).
[^assume-first-party]: [Probes](../../reference/probes.md).
[^ca-faults]: The program, `chunk-3jjr3wje.js:4878` (the ignored-file message), `chunk-3jjr3wje.js:4876` (the partial-use message), `chunk-3jjr3wje.js:5872` (the unreadable certificate count), and `chunk-3jjr3wje.js:4383` and `chunk-3jjr3wje.js:5706` (the failed read).
[^name-constraint]: The program, `chunk-865at33z.js:14050` (the code set, `PERMITTED_VIOLATION`), `chunk-865at33z.js:14056` (the message function), and `chunk-865at33z.js:14268` (the error text that carries them, `verification failed`).
[^signature]: The program, `chunk-tvttgr51.js:275` (the message with the IT team wording, `authority key identifiers`), `chunk-865at33z.js:14173` (the code check, `CERT_SIGNATURE_FAILURE`), `chunk-865at33z.js:14174` (the SSL certificate error wrapper), and `chunk-865at33z.js:14270` (the error text, `verification failed`).
[^all-proxy]: The program, `chunk-3jjr3wje.js:6835` (`ALL_PROXY` as the only proxy), `chunk-3jjr3wje.js:6854` (the proxy URL check), and `chunk-3jjr3wje.js:6859` (the 25000 ms timeout) and `chunk-3jjr3wje.js:6872` (its error text).
[^stream-idle-limit]: The program, `chunk-gq1dr8pm.js:16634` (the 5-minute and 30-minute values, `300000` and `1800000`), `chunk-gq1dr8pm.js:16637` (the raised limit, `Math.min`), `chunk-gq1dr8pm.js:17268` (the request option, `raisedBodyIdleTimeoutMs`), and `chunk-gq1dr8pm.js:17835` (the variable, `CLAUDE_STREAM_IDLE_TIMEOUT_MS`).
[^scheme-repair]: The program, `chunk-80c601hv.js:468`.
[^force-idle]: The program, `chunk-3jjr3wje.js:6768` (`API_FORCE_IDLE_TIMEOUT`, used as `!== !0` and `=== !1`) and `chunk-c203g5kd.js:3491` (`triBool`). The type was an integer in `2.1.329`.
