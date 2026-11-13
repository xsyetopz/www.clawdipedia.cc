---
title: Network and Proxy
description: Environment variables for API addresses, proxies, TLS certificates, time limits, and retries.
sidebar_position: 5
---

These variables control how Claude Code reaches the network.
They set the API base URL, proxies, custom certificates, timeouts, and retry counts.
Use them behind a company proxy or when you route traffic through a gateway.

This page lists 75 variables. `HTTPS_PROXY`, `NO_PROXY`, and `ANTHROPIC_BASE_URL` are the usual ones. Project settings cannot set some endpoint variables before you trust the folder.

## Example

```bash
export HTTPS_PROXY="http://proxy.example:8080"
export NO_PROXY="localhost,127.0.0.1"
export API_TIMEOUT_MS=1200000
claude
```

API calls go through the proxy and wait up to 20 minutes.

## Variables

The table is sorted by name. See [Environment Variables](index.md#how-to-read-the-tables) for what each column and badge means.

| Variable | Status | What it does | Values and default | Notes |
| --- | --- | --- | --- | --- |
| `CLAUDE_CODE_DISABLE_HTTPS_AGENT_KEEPING` | <Undocumented /> | Stops Claude Code from tying the HTTPS agent to the TLS switches. Normally it builds a signature of `NODE_TLS_REJECT_UNAUTHORIZED` and `BUN_TLS_REFUSE_DISTRUSTED_KEYS` (`length:value` for each). It builds a new agent and drops pooled sockets when the signature changes. Set, there is no signature, so a change of those two variables in a session keeps the agent and its sockets. The agent uses keep-alive with no socket limit (the program). | On or off. Off by default | All sessions |
| `CLAUDE_CODE_DISABLE_LOOPED_CROSS_CERT_DROP` | <Undocumented /> | Keeps the cross-certificates that Claude Code would drop from the system store. A certificate is dropped when it is a single, unexpired entry whose issuer links lead back to itself, and the store holds a valid self-signed root with the same subject, key, and subject key identifier that does not expire sooner. A certificate that `NODE_EXTRA_CA_CERTS` also lists stays. If a store entry does not parse, nothing is dropped. The log says `CA certs: Dropped N cross-certificate(s) ...` (the program). | On or off. Off by default. A client certificate (`CLAUDE_CODE_CLIENT_CERT`) also skips the drop | All sessions |
| `CLAUDE_CODE_DISABLE_SELF_NAMED_CERT_DROP` | <Undocumented /> | Keeps every certificate in the `NODE_EXTRA_CA_CERTS` file whose subject and issuer match, whoever signed it. Normally Claude Code drops such a certificate when its own key did not sign it, or it cannot check that, unless a kept certificate issued it or it is in the built-in root list. If all or none would be dropped, the list stays whole. The log says `CA certs: Dropped the certificate with SHA-256 fingerprint ...` at error level (the program). | On or off. Off by default. A client certificate also skips the drop | All sessions |
| `all_proxy` | <Undocumented /> | Lower case proxy variable. It is the last fallback after `HTTPS_PROXY` and `ALL_PROXY` for git proxy settings. | Text. Non-empty string. Also listed with proxy names | All sessions |
| `ANTHROPIC_BASE_URL` | <Documented /> | Overrides the API endpoint. A non-first-party host changes first-party checks, such as Remote Control. Since 2.1.304 tool search stays on behind a custom URL, and a 400 or 422 from the gateway is retried without it. | Text. An unset value or an Anthropic host counts as first party | All sessions. Not set from project `env` before trust |
| `ANTHROPIC_CUSTOM_HEADERS` | <Documented /> | Adds custom request headers. | Text. Split on new lines, each `Name: Value` at the first colon. Claude Code drops bad header names or values with a warning. A bad `Authorization` value stops each request instead (see [Errors](../settings/auth.md#errors)) | All sessions. Not set from project `env` before trust |
| `ANTHROPIC_UNIX_SOCKET` | <Documented /> | Sends first-party API requests over this Unix socket path. | Text. Claude Code passes it as the `unix` fetch option. Also in the host-managed provider list with `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | First-party API client, all. Not set from project `env` before trust |
| `API_FORCE_IDLE_TIMEOUT` | <Documented /> | Forces the streaming body idle timeout on or off. | A number. A true value forces it on and a false value (`0`) turns the fetch timeout off | Anthropic API client, all. Not set from project `env` before trust |
| `API_TIMEOUT_MS` | <Documented /> | Sets the API request timeout in milliseconds. | A number of milliseconds, `600000` (10 minutes) by default. Whole number. Errors show a hint to raise it | All sessions. Not set from project `env` before trust |
| `BUN_TLS_REFUSE_DISTRUSTED_KEYS` | <Undocumented /> | A Bun runtime variable. The program counts any value except `1` as a TLS trust override, as it does for `NODE_TLS_REJECT_UNAUTHORIZED`. The program does not show what Bun does with it. Added in `2.1.314`. | Text. Raw string. Any set value other than `1` counts | All sessions |
| `CARGO_HTTP_CAINFO` | <Undocumented /> | Names the CA bundle file for Cargo. Claude Code sets it to the sandbox CA bundle for sandboxed commands, next to `SSL_CERT_FILE` and others. | Text. Also in a list of CA env names | Sandboxed commands and remote sessions |
| `CLAUDE_AGENT_SDK_CLIENT_APP` | <Documented /> | Names the client app of an Agent SDK host. Claude Code adds it to the user agent as `client-app/<value>`. | Text | SDK hosts. Not set from project `env` before trust |
| `CLAUDE_AGENT_SDK_VERSION` | <Undocumented /> | Reports the Agent SDK version. Claude Code adds it to the user agent as `agent-sdk/<value>`. | Text. The SDK host sets it | SDK hosts. Not set from project `env` before trust |
| `CLAUDE_BG_GATEWAY_WITHHELD` | <Undocumented /> | Names a gateway setting that the dispatcher did not pass to a background session. The session then prints a no-gateway hint. | Text. Active only when `ANTHROPIC_BASE_URL` is unset. Claude Code removes it from the child env | Background sessions. Not set from project `env` before trust |
| `CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS` | <Documented /> | Sets the idle timeout of the byte-level streaming watchdog. | A number of milliseconds. Whole number of `1` or more, clamped to `10000`-`1800000`. Else a first-party default of `180000` from a feature flag | API streaming. Not set from project `env` before trust |
| `CLAUDE_CODE_ADDITIONAL_PROTECTION` | <Undocumented /> | Adds the `x-anthropic-additional-protection: true` header to API requests. | On or off. Read when Claude Code builds the API client | API requests. Not set from project `env` before trust |
| `CLAUDE_CODE_API_BASE_URL` | <Undocumented /> | Gives a fallback API base URL. The Files API uses it when `ANTHROPIC_BASE_URL` is unset. Default `https://api.anthropic.com`. | Text. `ANTHROPIC_BASE_URL` wins when both are set. Credential checks also treat it as a base URL source | First-party API and Files API. Not set from project `env` before trust |
| `CLAUDE_CODE_ATTRIBUTION_HEADER` | <Documented /> | Controls the attribution block at the start of the system prompt. A falsy value such as `0` omits it. | Text. Policy settings have a rule for it. Repo-committed settings may not re-point it | First-party API, not `CLAUDE_CODE_REMOTE` |
| `CLAUDE_CODE_CERT_STORE` | <Documented /> | Chooses the CA certificate sources for TLS. | A comma-separated list, `bundled,system` by default. When no certificate authority is left, startup fails with `No certificate authority to trust: ...` or `No root certificates are left to trust: ...`. Some of these messages name this variable, `SSL_CERT_FILE`, or `SSL_CERT_DIR` (the program) | All sessions |
| `CLAUDE_CODE_CLIENT_CERT` | <Documented /> | Gives the path of the client certificate file for mTLS. | Text. Claude Code reads the file and skips a cert and key that do not match | All sessions |
| `CLAUDE_CODE_CLIENT_KEY` | <Documented /> | Gives the path of the client private key file for mTLS. | Text. Claude Code reads the file | All sessions |
| `CLAUDE_CODE_CLIENT_KEY_PASSPHRASE` | <Documented /> | Gives the passphrase of an encrypted client key. | Text. Claude Code uses it for the key check and the TLS agent | All sessions |
| `CLAUDE_CODE_DISABLE_MTLS_RELOAD_ON_STALE_CONNECTION` | <Documented /> | Stops the re-read of the mTLS client cert and key after a connection-level API error. | On or off. Only matters when `CLAUDE_CODE_CLIENT_CERT` is set | MTLS setups |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | <Documented /> | Turns off nonessential network traffic such as updates, telemetry and error reporting. | On or off | All sessions |
| `CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK` | <Documented /> | Stops the non-streaming retry after a stream fails mid-stream. | On or off | All sessions. Project `env` can set it before trust |
| `CLAUDE_CODE_DISABLE_POOLED_CONNECTION_IDLE_LIMIT` | <Undocumented /> | Stops the idle limit on pooled connections in a cloud session. Without it, the program turns TCP keepalive off and sets a 35000 ms socket timeout when a pooled connection goes idle. It turns keepalive on (1000 ms) and clears the timeout when the connection is reused. Added in `2.1.314`. | On or off, off by default. The limit applies only when `CLAUDE_CODE_REMOTE` is true and `CLAUDE_CODE_ENVIRONMENT_KIND` is unset | Cloud sessions |
| `CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING` | <Documented /> <Gated note="A feature flag or server gate decides by default. This variable overrides it" /> | Forces tool input streaming on or off. Code matches the docs. | On, off, or unset. `0` is off. Else first party needs a feature flag, Vertex and Bedrock need model support and no custom base URL, `1` forces on. Since `2.1.309` a Bedrock base URL on Amazon's own `https://bedrock-runtime.<region>.amazonaws.com` host does not count as custom | All sessions. Project `env` can set it before trust |
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
| `CLAUDE_CODE_INCREMENTAL_REQUEST_BODY` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Builds API request bodies step by step, from the body of an earlier request. Added in `2.1.311`. | A number, `0` by default. Needs the first-party provider and the feature flag `tengu_soft_kurzweil`. A request with `output_format` set is not built this way. A body that fails a check is not used | First-party API requests |
| `CLAUDE_CODE_MAX_RETRIES` | <Documented /> | Sets how many times Claude Code retries a failed API request. | A number. Whole number, `0` or more. Claude Code clamps a value above the cap with a warning unless the retry watchdog is on | All sessions |
| `CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES` | <Documented /> | Limits the re-sends of a non-streaming request that reaches its timeout. `0` fails on the first timeout. | A number. Whole number min `0`, digits only. Unset uses a built-in count only when the retry watchdog is on | All sessions |
| `CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS` | <Documented /> | Sets the first delay of the exponential backoff for retries of an overloaded API error. | A number of milliseconds. Whole number from `500` to `32000` in plain digits, else unset. Used only on the overloaded branch of the retry loop | All API requests |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` | <Documented /> | Sets the ceiling of the backoff for retries of an overloaded API error. | A number of milliseconds. Whole number from `32000` to `300000` in plain digits, else unset. The maximum was `64000` before `2.1.323`. A longer wait than the ceiling plus a margin raises a retry-after error | All API requests |
| `CLAUDE_CODE_OVERLOADED_RETRY_MAX_WAIT_MS` | <Undocumented /> <Gated note="Works only behind a feature flag or server gate" /> | Lets the main conversation keep retrying an overloaded API error, with this value as the wait limit. | A number of milliseconds. It has no effect when `CLAUDE_CODE_MAX_RETRIES` or `CLAUDE_CODE_RETRY_WATCHDOG` is set, or outside the main conversation. The feature flag `tengu_steady_heron` gates it and the program defaults it to on (the program, `chunk-2x9ma4k7.js:2986823`) | Main conversation API requests |
| `CLAUDE_CODE_PROXY_RESOLVES_HOSTS` | <Documented /> | Lets the proxy resolve DNS names. | On or off. When set the proxy agent `lookup` returns the host name as is. When `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` is set, the program ignores this variable from a settings file `env` and logs `Ignoring CLAUDE_CODE_PROXY_RESOLVES_HOSTS` (the program, 2.1.319, `chunk-cr45xy86.js`; cases `print.env319a.proxy-resolves-hosts-from-settings.unset`, `.v1`) | HTTP proxy setups |
| `CLAUDE_CODE_RETRY_WATCHDOG` | <Documented /> | Retries `429` and `529` capacity errors without end for unattended sessions. Docs match the code path that reads it. | On or off. The self-hosted runner sets it to `1` and also clears `CLAUDE_CODE_MAX_RETRIES`. Docs also cover the spend-limit rule | Unattended runs, CI, remote workers. Set by Claude Code for self-hosted runners |
| `CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS` | <Documented /> | Lets the retry watchdog notice a usage limit that was lifted before its reset. Added in `2.1.305` ([v2.1.305 release](https://github.com/anthropics/claude-code/releases/tag/v2.1.305)). The program logs `[usage limit recheck]` lines when it sends or skips a probe request. | A number of milliseconds. The program shows no format check in the strings | Sessions with `CLAUDE_CODE_RETRY_WATCHDOG` |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_USAGE_LIMIT_WAIT_MS` | <Undocumented /> | Caps the total ms that the retry watchdog waits for usage-limit `429` errors to end. When the wait is longer than what is left, the request fails. | A number of milliseconds. Integer 1 or more, digits only. Unset means no limit | Sessions with the retry watchdog on |
| `CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS` | <Documented /> | Caps the ms each API request spends waiting out `429` and `529` errors under the watchdog. After that the next error ends the request. | A number of milliseconds. Integer 1 or more, digits only. Unset means no limit | Sessions with `CLAUDE_CODE_RETRY_WATCHDOG`. Docs say v2.1.295 or later |
| `CLAUDE_CODE_RETRY_WATCHDOG_SCOPE` | <Undocumented /> | Narrows the retry watchdog to capacity errors. New in `2.1.310`. With `capacity`, the watchdog still retries `429` and `529` errors without end, but its other extensions are off: more retries after no response or a non-streaming timeout, keeping background requests on `529`, and the server-error model fallback. | Text. Only `capacity` has an effect | Sessions with `CLAUDE_CODE_RETRY_WATCHDOG` |
| `CLAUDE_CODE_UNWATCHED_REPLY_HOLD_MS` | <Undocumented /> | Holds the streamed reply of a subagent, an auxiliary, or a compaction request for up to this many ms before it passes the data on. Added in `2.1.311`. | A number of ms, `0` by default (no hold). Applies to content block delta and ping events. Held data goes on at 262144 bytes | Streaming replies of subagent, auxiliary, and compaction requests |
| `CLAUDE_ENABLE_BYTE_WATCHDOG` | <Documented /> | Forces the byte-level streaming idle watchdog on or off. | On, off, or unset, on by default. Unset uses a feature flag with default true. Direct, AWS, and gateway only | Anthropic API, AWS, gateway |
| `CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK` | <Documented /> | Enables the byte-level streaming idle watchdog for Bedrock event streams. | On or off. Off by default. Needs the main watchdog to be on | Amazon Bedrock |
| `CLAUDE_ENABLE_STREAM_WATCHDOG` | <Documented /> | Forces the event-level streaming idle watchdog on or off. It also sets the async agent stall time. | On, off, or unset, on by default | All sessions |
| `CLAUDE_SLOW_FIRST_BYTE_MS` | <Undocumented /> | Sets the wait before Claude Code logs a slow first byte on a stream. It does not abort. | A number of milliseconds | - |
| `CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS` | <Documented /> | Sets the first-byte deadline of a streaming request in ms. | A number of milliseconds | - |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | <Documented /> | Sets the idle timeout of the stream watchdogs in ms. | A number of milliseconds | - |
| `CLOUDSDK_CORE_CUSTOM_CA_CERTS_FILE` | <Undocumented /> | Names a CA bundle file for `gcloud`. The Bash sandbox treats it as a CA bundle variable. | A path | - |
| `CURL_CA_BUNDLE` | <Undocumented /> | Names a CA bundle for `curl`. The Bash sandbox treats it as a CA bundle variable. | - | - |
| `DENO_CERT` | <Undocumented /> | Names a CA bundle for Deno. The Bash sandbox treats it as a CA bundle variable. | - | - |
| `GIT_SSL_CAINFO` | <Documented /> | Gives the Git CA bundle path. Claude Code names it in CA hints and in runner messages saying a server value replaces it in a session. | Text. Use is mostly by name in text and lists | Git. Self-hosted runner. Not set from project `env` before trust |
| `HTTP_PROXY` | <Documented /> | Sets the HTTP proxy for Claude Code network traffic. | - | - |
| `http_proxy` | <Documented /> | Lower case HTTP proxy URL. Claude Code reads it as an alternative to `HTTP_PROXY`. | Text. Non-empty string. Order is `HTTP_PROXY`, this, then `CLAUDE_CODE_HTTP_PROXY` for the sandbox proxy | All sessions |
| `HTTPS_PROXY` | <Documented /> | Sets the HTTPS proxy for Claude Code network traffic. | - | - |
| `https_proxy` | <Documented /> | Lower case HTTPS proxy URL. Claude Code reads it as an alternative to `HTTPS_PROXY`. | Text. Non-empty string. Order is `HTTPS_PROXY`, this, then `CLAUDE_CODE_HTTPS_PROXY` for the sandbox proxy | All sessions |
| `NIX_SSL_CERT_FILE` | <Undocumented /> | Claude Code sets it to the CA bundle path in sandboxed commands, with other CA variables. | A path | - |
| `NO_PROXY` | <Documented /> | Lists hosts that skip the proxy. `*` skips it for all. | On or off | - |
| `no_proxy` | <Documented /> | Lower case proxy bypass list. Claude Code reads it with `NO_PROXY`. | A comma-separated list. If both are set and differ, Claude Code joins them with a comma | All sessions |
| `NODE_EXTRA_CA_CERTS` | <Documented /> | Adds extra CA certificates from a PEM file to the trusted set. Since `2.1.318`, a file that is empty, is not PEM, or starts with a damaged certificate no longer stops every connection. The program uses the certificates it can read and prints a warning on stderr. See [`NODE_EXTRA_CA_CERTS` File Faults](#node_extra_ca_certs-file-faults). | A path to a PEM file | All sessions |
| `NODE_TLS_REJECT_UNAUTHORIZED` | <Documented /> | Set to `0` to turn off TLS certificate checks (Bun). Claude Code counts any value except `1` as a trust override. | - | - |
| `NODE_USE_ENV_PROXY` | <Undocumented /> | A value other than empty or `0` makes the Bun `http` client use `HTTP_PROXY` and `HTTPS_PROXY`. A bundled proxy tip names it for Node 22.21 and later. | - | - |
| `NODE_USE_SYSTEM_CA` | <Undocumented /> | The value `1` makes the Bun runtime add the OS CA store to the default CA list. | - | - |
| `SSL_CERT_DIR` | <Undocumented /> | Gives the directory of CA certificates. Claude Code counts it as a custom CA setting. | Text. Raw string (`rawStr`). Together with `NODE_EXTRA_CA_CERTS` and `SSL_CERT_FILE`, it makes the TLS setup treat custom certs as set | All sessions |
| `SSL_CERT_FILE` | <Documented /> | Gives the CA bundle file path. Claude Code treats it as a custom CA setting, and passes it to proxy helpers and the MCP agent proxy. | Text. Raw string. The MCP agent proxy fallback reads the file as PEM | All sessions |
| `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL` | <Undocumented /> | Makes Claude Code treat a custom base URL as first party. A Probes run with it set raised the beta headers from 9 to 12 (added `prompt-caching-scope-2026-01-05`, `thinking-binding-controls-2026-08-01`, `cache-diagnosis-2026-04-07`) and added a `diagnostics` key to the request body. | Any set value. Not set by default | All sessions |

## `NODE_EXTRA_CA_CERTS` File Faults

The `2.1.318` release notes say: "Fixed every connection failing when the `NODE_EXTRA_CA_CERTS` file is empty, not PEM, or starts with a damaged certificate: readable certificates are now used, with a warning on stderr".
Status: <Documented /> in the release notes the program shows. The behavior below is measured.

Each file below was written to the sandbox `HOME` and named in `NODE_EXTRA_CA_CERTS`.
The valid certificate is a throw-away CA made with `openssl`.
Each case ran on `2.1.316` and on `2.1.319` with `--debug-file` set.

| File Content | `2.1.316` | `2.1.319` |
| --- | --- | --- |
| One valid certificate | No warning | No warning |
| Empty file | No warning on stderr. The debug log says the file was appended | Runtime line on stderr, then `Claude Code ignored all of the NODE_EXTRA_CA_CERTS file: it holds no certificate that Claude Code can read.` |
| Text that is not PEM | No warning on stderr | The same two lines as the empty file |
| One damaged certificate only | No warning on stderr | The same two lines as the empty file |
| Damaged certificate, then a valid one | No warning on stderr with the HTTP stub. With the TLS stub, the runtime line only, and the run does not end in 60 s | Runtime line on stderr, then `Claude Code used only the certificates that it could read in full from the NODE_EXTRA_CA_CERTS file`. Connections work |
| Valid certificate, then a damaged one | No warning on stderr | Runtime line on stderr only. The debug log says one certificate in the CA list "could not be read" |
| A path with no file | No warning on stderr. The debug log says `Failed to read NODE_EXTRA_CA_CERTS file` | The same |

**Source:** the program. The message texts are in `chunk-kqqpxt64.js` of the cleaned `2.1.322` module dump, in the function that builds the CA list (`CA certs: The runtime cannot load ... the NODE_EXTRA_CA_CERTS file as one CA list entry`) and in the stderr texts that follow it.

**Runs:** `bun run release:probe:print -- --from 2.1.319 --to 2.1.319 --only cacerts319` (cases `extra-ca.*` and `extra-ca-tls.*`), repeated with `--from 2.1.316 --to 2.1.316`.

**FAFO:**

- Hypothesis: on `2.1.316`, a file that starts with a damaged certificate stops every TLS connection; on `2.1.319` it does not.
  Prediction: with a TLS stub whose certificate chains to the valid CA at the end of the file, `2.1.316` makes no request to the stub, and `2.1.319` does.
  Command: case `extra-ca-tls.damaged-first`. The program reaches `api.anthropic.com` through a local CONNECT proxy (`HTTPS_PROXY`) and the stub.
  Result: on `2.1.316` the run did not end in 60 s, with 0 requests to the stub. On `2.1.319` the run exited with code 0, with 9 requests to the stub, and the stderr text above.
- Control: the same case with a valid file (`extra-ca-tls.valid`) and with a first line of plain text (`extra-ca-tls.not-pem-first`) reached the stub on both versions, 9 requests each. Text before a valid block does not break the file.
- Empty and not-PEM files did not stop the run on `2.1.316` against the plain HTTP stub (exit 0, 1 request). The stderr warning is the only change the cases show for them. A TLS stub cannot test them, because the file then holds no CA for the stub. The `2.1.318` and `2.1.319` runs gave the same results.
- The first stderr line (`Warning: Ignoring extra certs from ..., load failed: ...`) comes from the runtime. On `2.1.316` it showed only in the TLS case. The `Claude Code ...` lines show only on `2.1.318` and later.

## How It Works

Claude Code reads shell variables once at startup, so restart after a change.
Claude Code reapplies values in a settings `env` block when the file changes.
It does not reapply them for features that read their variables only at startup.
Numeric variables such as timeouts accept forms like `2e3` and `64_000` in addition to plain digits, except where a row says digits only.

## Related Pages

- [Environment Variables](index.md): how Claude Code reads variables and which value wins.
- [Cloud Providers](cloud-providers.md)
- [System and Third-Party](system-and-third-party.md): `ALL_PROXY` and CA bundle names owned by other tools.
- [Undocumented Items](../../reference/undocumented.md): every item that only the program shows.

Source: the program (variable names found in the `2.1.314` binary) and the [Environment Variables](https://code.claude.com/docs/en/env-vars) page of the official docs.
