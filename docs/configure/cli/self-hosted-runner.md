---
title: Self-Hosted Runner
description: Every option of claude self-hosted-runner and its orchestrator, setup, doctor, and decode-token subcommands in 2.1.323, with the parser rules and each error.
sidebar_position: 5
---

`claude self-hosted-runner` runs Claude Code cloud sessions on a machine that you control. The root help text does not list the command.
The [official overview](https://code.claude.com/docs/en/self-hosted-environments) explains environments and runners. The [deploy guide](https://code.claude.com/docs/en/self-hosted-environments-deploy) and the [configuration guide](https://code.claude.com/docs/en/self-hosted-environments-configuration) explain most options. This page lists every option in `2.1.323`, with the options that the official pages do not name, and the exact parser rules.

Source: the text of `claude self-hosted-runner --help` and of each subcommand help in `2.1.323`, and the option parser of the program (`chunk-jmkrmahq.js`, near offset 253048). The variables are on [Remote and Cloud Session Variables](../env-vars/remote-and-cloud-sessions.md).

## Example

```bash
claude self-hosted-runner \
  --environment-secret-file /run/secrets/env-secret \
  --base-dir /workspace --capacity 1 \
  --drain-wait-sec 60 --release-idle-session-min 30
```

## Parser Rules

The command has its own parser. It does not use the parser of the root `claude` command.

- A flag takes its value from the next argument. The `--flag=value` form is not read; the parser stops with `unknown flag --flag=value`.
- These flags ignore a missing value and keep the default: `--api-url`, `--environment-secret-file`, `--base-dir`, `--exec-path`, `--hooks-dir`, `--log-level`, `--log-file`, `--lock-to-account`, `--debug-token-dir`, `--capacity`, `--health-port`, `--kill-session-after-min`, `--exit-if-unused-min`, `--drain-grace-sec`, and `--startup-timeout-min`. `--client-label` also ignores a value that starts with `--` or holds only spaces.
- `--release-idle-session-min` with no value prints a warning and sets no limit. A value of only spaces counts as `0`, with a warning.
- `--trust-workspace`, `--remove-session-state`, and `--diff-finds-nested-repository` take an optional `true`, `false`, `1`, or `0`. Any other next argument is not used, and the option turns on.
- An unknown flag stops the runner with `unknown flag <flag>`. An empty argument stops it with `empty argument — a flag value may be unset (failed env/K8s substitution?)`. Any other word stops it with `unexpected argument '<word>' — this command takes no positional arguments`.
- A flag wins over its variable. Times in variables are in milliseconds; the flags take seconds or minutes, as their names say.
- Each parser error prints `error: <message>`, then `Run 'claude self-hosted-runner --help' for usage.`, and the runner exits with code 2. The `cli321` probe runs confirmed this.
- An on-demand runner that the server refuses because it is not needed (the session ended or paused) exits with code 0. The program maps the refusal reasons `session_paused`, `queue_entry_gone`, `pool_moved`, and `standby_gone` to exit code 0. A superseded work order exits with code 1 again; `2.1.321` and `2.1.322` used code 0 ([2.1.323 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.323)). A work order that was already used (`already_registered`, `standby_already_redeemed`) and any other reason also exit with code 1 (`chunk-jmkrmahq.js:262763`).

## Connection Options

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--api-url <url>` | <Undocumented /> | Sets the API base URL. | `https://api.anthropic.com` |
| `--environment-secret-file <path>` | <Documented /> | Reads the environment secret from the file. `SELF_HOSTED_RUNNER_ENVIRONMENT_SECRET` gives the secret itself. The [quickstart](https://code.claude.com/docs/en/self-hosted-environments-quickstart) uses it. | None |
| `--pool-secret-file <path>` | <Undocumented /> <Deprecated note="Use --environment-secret-file" /> | Old name of `--environment-secret-file`. It prints `[runner:warn] --pool-secret-file is deprecated; use --environment-secret-file` and works. `SELF_HOSTED_RUNNER_POOL_SECRET` is the old variable. | None |
| `--lock-to-account <id>` | <Documented /> | Locks the runner to one account at registration. Only that account's sessions come to it. See [Harden Your Deployment](https://code.claude.com/docs/en/self-hosted-environments-deploy#harden-your-deployment). | Off |
| `--client-label <label>` | <Undocumented /> | Sets the label that the console shows beside the runner. It is not used for authorization or routing. | The host name |
| `--proxy-authorization-command <command>` | <Documented /> | Runs the command for each new connection to the egress proxy. Its stdout is the full `Proxy-Authorization` value. Needs `HTTPS_PROXY` or `HTTP_PROXY`; `ALL_PROXY` alone is not read. The runner starts a local forward proxy on `127.0.0.1` for itself and its sessions. Not with `orchestrator`. See [Authenticate to an Egress Proxy](https://code.claude.com/docs/en/self-hosted-environments-deploy#authenticate-to-an-egress-proxy). | Off |
| `--proxy-authorization-file <path>` | <Documented /> | Same, but reads the value from a file for each new connection. Give only one of the two. | Off |
| `--agent-proxy-url <url>` | <Undocumented /> | Sends each session through the agent proxy at the `https://` URL, with no user name or password. Not with the two proxy authorization options. While set, the runner refuses sessions that the environment's relay mode sends through Anthropic's relay. | Off |

## Runtime Options

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--capacity <n>` | <Documented /> | Sets the maximum number of sessions at the same time. A positive integer. | `1` |
| `--base-dir <path>` | <Documented /> | Sets the folder for checkouts and per-session state. Required on Windows. | `/workspace` |
| `--exec-path <path>` | <Documented /> | Sets the program that the runner starts for each session. See [Pin the Version](https://code.claude.com/docs/en/self-hosted-environments-deploy#pin-the-version). | The runner's own program |
| `--hooks-dir <path>` | <Documented /> | Sets the folder of the lifecycle hooks (checkout, command, post-session). A missing hook uses the built-in behavior. | None |
| `--session-stop-grace-sec <n>` | <Documented /> | Waits this long for the session process to exit after the session ends, then kills it. A positive number. See [Shutdown Timing](https://code.claude.com/docs/en/self-hosted-environments-deploy#shutdown-timing). | `5` |
| `--sigkill-timeout-sec` | <Undocumented /> <Deprecated note="Renamed to --session-stop-grace-sec" /> | Removed. The runner stops with an error that gives the new name. | |
| `--post-session-hook-timeout-sec <n>` | <Documented /> | Sets the SIGTERM limit of the post-session hook. A positive number. | `60` |
| `--checkout-hook-timeout-min <n>` | <Undocumented /> | Stops each checkout hook run at this limit (SIGTERM, then SIGKILL). The session setup then fails with a `checkout hook timed out` error. `0` turns it off. Maximum 10080. | `30` |
| `--drain-wait-sec <n>` | <Documented /> | On SIGTERM or SIGINT, waits up to this long for the running turn and background tasks of each session. A task that just finished counts until the next turn starts (`SELF_HOSTED_RUNNER_BG_RESULT_GRACE_MS`, default 30 seconds). A turn that just finished counts until the session reports its end (`SELF_HOSTED_RUNNER_POST_TURN_SETTLE_MS`, default 7 seconds). Maximum 86400. | `0` |
| `--drain-wait-bg-tasks-sec <n>` | <Undocumented /> <Deprecated note="Use --drain-wait-sec" /> | Old name of `--drain-wait-sec`. It prints a warning and works. | `0` |
| `--drain-marker-file <path>` | <Undocumented /> | When this file exists at the start of a drain, the runner reports its exit as a host drain. If the first line of a regular file is a Unix time in seconds, the report includes it as the force-delete time. Telemetry only. | Off |
| `--git-ssh-rewrite <host>` | <Documented /> | Rewrites `https://<host>/...` source URLs to `git@<host>:...`. Give it more than once for more hosts. | Off |
| `--git-host-rewrite <from>=<to>` | <Documented /> | Rewrites `https://<from>/...` to `https://<to>/...`, before `--git-ssh-rewrite`. Both sides are bare host names. | Off |
| `--use-anthropic-git-proxy` | <Documented /> | Uses Anthropic-managed git. Needs `--capacity 1`, git 2.32 or later, and a global git config that is not a device such as `/dev/null`. It deletes and replaces the home-level git config of the runner account at startup and before each session. See [Harden Your Deployment](https://code.claude.com/docs/en/self-hosted-environments-deploy#harden-your-deployment). | Off |
| `--configure-git` | <Documented /> | Sets the git identity to `Claude <noreply@anthropic.com>` with commit signing. Needs git 2.34 or later. See [Configure Git](https://code.claude.com/docs/en/self-hosted-environments-deploy#configure-git). | Off |
| `--push-outcome-on-release` | <Documented /> | Pushes each outcome branch before the runner ends a session that did not complete. See [Prompt Sessions to Push Their Work](https://code.claude.com/docs/en/self-hosted-environments-configuration#prompt-sessions-to-push-their-work). | Off |
| `--trust-workspace [bool]` | <Documented /> | Trusts the repository paths of each session, so repo `permissions.allow` and `additionalDirectories` apply. With `false`, the runner sets `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1` for each session, and no workspace trust record counts (the program, `chunk-jmkrmahq.js:176984`, `chunk-x4fdscgs.js:85193`). | `true` |
| `--remove-session-state [bool]` | <Documented /> | Removes the per-session state under `<base-dir>/_sessions/` when a session ends. See [Reuse a Pre-Warmed Checkout](https://code.claude.com/docs/en/self-hosted-environments-deploy#reuse-a-pre-warmed-checkout). | `false` |
| `--diff-finds-nested-repository [bool]` | <Undocumented /> | Lets the Changes pane show a repository cloned in a subfolder of a session started with no repository. Needs `--capacity 1`, and works only while the tool sandbox is off. | `false` |
| `--confine-repo-settings <mode>` | <Documented /> | Sets the guard for settings committed in the repository: `warn`, `enforce`, or `off`. | `warn` |
| `--server-auto-mode-lists <mode>` | <Undocumented /> | Sets which auto mode classifier lists from the server a session may get: `all`, `no-allow`, or `none`. `no-allow` holds back the allow list and the exceptions to soft block rules. | `no-allow` |
| `--host-config-snapshot <mode>` | <Undocumented /> | Sets where the startup copy of the host config folder is kept: `disk` (under `--base-dir`, checked at each session start) or `memory` (64 MiB at most). | `disk` |
| `--health-port <port>` | <Documented /> | Sets the port of the `/healthz` listener. An integer from 0 to 65535; `0` turns it off. See [Kubernetes](https://code.claude.com/docs/en/self-hosted-environments-deploy#kubernetes). | `8080` |
| `--log-level <level>` | <Documented /> | Sets the log level: `info` or `debug`. It has no variable. | `info` |
| `--log-file <path>` | <Documented /> | Also writes the runner logs to the file, in append mode. | Off |

The host config folder has no flag. Set `SELF_HOSTED_RUNNER_HOST_CONFIG_DIR`; `--host-config-dir` stops the runner with `unknown flag --host-config-dir`. See [MCP Servers](https://code.claude.com/docs/en/self-hosted-environments-configuration#mcp-servers).

## Lifecycle Options

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--exit-if-unused-min <n>` | <Documented /> | Exits the runner if it gets no work for this long. Maximum 10080. See [Make On-Demand Runners Exit When Idle](https://code.claude.com/docs/en/self-hosted-environments-configuration#make-on-demand-runners-exit-when-idle). | Never |
| `--drain-grace-sec <n>` | <Documented /> | Keeps the runner polling this long after its sessions end. `0` exits at once. Maximum 604800. | `0` |
| `--retire-at <epoch-seconds>` | <Documented /> | Retires the runner at this Unix time in whole seconds. A value from 1000000000 to 100000000000. | Never |
| `--defer-shutdown-max-min <m>` | <Documented /> | On the first SIGTERM or SIGINT, stops new work and keeps serving sessions for up to `m` minutes before it drains. Fractions are allowed. Maximum 10080. See [Runner Lifecycle](https://code.claude.com/docs/en/self-hosted-environments#runner-lifecycle). | `0` |

## Per-Session Watchdog Options

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--release-idle-session-min <n>` | <Documented /> | Releases a session after this long with no user input. Any value, `0` included, overrides the idle limit that Anthropic's control plane sends. Maximum 10080. | Never |
| `--hold-idle-file <path>` | <Documented /> | Does not release an idle session while the file is a regular file changed in the last 180 seconds. The runner looks again every 30 seconds. The hold does not apply at startup, at `--retire-at`, at the `--defer-shutdown-max-min` ceiling, or at `--kill-session-after-min`. Since `2.1.311`. See [Keep an Idle Session While Its Processes Run](https://code.claude.com/docs/en/self-hosted-environments-deploy#keep-an-idle-session-while-its-processes-run). | Off |
| `--max-hold-min <n>` | <Documented /> | With `--hold-idle-file`, holds a session no longer than this. `0` turns the hold off. Maximum 10080. | `1440` |
| `--startup-timeout-min <n>` | <Documented /> | Releases a session whose process has not finished starting up after this long. `0` turns it off. Maximum 10080. | `15` |
| `--kill-session-after-min <n>` | <Documented /> | Limits the life of a session process. At the limit, a waiting session is released; a running turn is stopped 15 minutes later (`SELF_HOSTED_RUNNER_MAX_LIFETIME_GRACE_MS`). Maximum 10080. | Never |
| `--debug-token-dir <path>` | <Undocumented /> | Writes live tokens to disk. For debugging only. | Off |
| `-h`, `--help` | <Documented /> | Prints the help text. | |

## Runner Errors

Source: the program, in its parser (`chunk-0p6farb3.js`, offsets 245200–255000). The `cli321` probe ran the cases with a probe name.

| Message | When | Probe |
| --- | --- | --- |
| `--capacity must be a positive integer, got: <value>` | The value is not an integer of 1 or more. | |
| `--health-port must be an integer in [0, 65535] (0 disables), got: <value>` | The port is out of range. | |
| `--git-ssh-rewrite requires a hostname` | No value. | |
| `--git-host-rewrite requires <from>=<to>` | No value, or no text on one side of `=`. | |
| `--git-host-rewrite expects bare hostnames (e.g. ext.example.com=int.example.com), not URLs. Got: <value>` | A side holds `://` or `/`. | `runner-git-host-rewrite-url` |
| `duplicate --git-host-rewrite for '<host>'` | The same `<from>` host twice. | |
| `[runner:warn] --git-ssh-rewrite '<host>' will not match: --git-host-rewrite rewrites it to '<to>' first.` | A warning. The runner goes on. | |
| `--confine-repo-settings requires one of enforce/warn/off (got: "<value>")` | A bad mode. | `runner-confine-bad` |
| `--server-auto-mode-lists requires one of all/no-allow/none (got: "<value>")` | A bad mode. | `runner-lists-bad` |
| `--host-config-snapshot requires one of disk/memory (got: "<value>")` | A bad mode. | `runner-snapshot-bad` |
| `--<flag> must be a non-negative number of minutes (0 disables, max 10080), got: <value>` | A bad value of `--kill-session-after-min`, `--exit-if-unused-min`, `--release-idle-session-min`, `--startup-timeout-min`, `--checkout-hook-timeout-min`, `--max-hold-min`, or `--defer-shutdown-max-min`. | |
| `--<flag> must be a positive number of seconds, got: <value>` | A bad value of `--session-stop-grace-sec` or `--post-session-hook-timeout-sec`. | |
| `--<flag> must be a non-negative number of seconds (max 86400), got: <value>` | A bad value of `--drain-wait-sec` or `--drain-wait-bg-tasks-sec`. | `runner-drain-wait-bg-tasks` |
| `--drain-grace-sec must be a non-negative number of seconds (0 = immediate, max 604800), got: <value>` | A bad value. | |
| `--retire-at must be an absolute Unix timestamp in whole SECONDS (...), got: <value>` | Milliseconds, a duration, or text. | `runner-retire-at-ms` |
| `--sigkill-timeout-sec was renamed to --session-stop-grace-sec. ...` | The old flag. | `runner-sigkill` |
| `--drain-marker-file requires a file path (the marker your host writes to announce a graceful drain), got: <value>` | No value, an empty value, or a value that starts with `--`. | |
| `--hold-idle-file requires a file path (a file your host keeps fresh while the session has processes left running), got: <value>` | No value, an empty value, or a value that starts with `--`. | |
| `the path, or a link on the way to it, leads to a network location; point --hold-idle-file at a local file` | The hold file is on a network location (`chunk-0p6farb3.js:241153`). | |
| `the path could not be checked for links to a network location: a folder or link on the way could not be read` | A folder or link on the way to the hold file cannot be read. | |
| `--agent-proxy-url requires your proxy's https:// URL` | No value, an empty value, or a value that starts with `--`. | |
| `--proxy-authorization-command / --proxy-authorization-file requires a value` | No value, or a value that starts with `--`. | |
| `--diff-finds-nested-repository requires --capacity 1. ...` | The option is on with a capacity over 1. | |
| `Failed to read environment secret file <path> (<system error>)` | The secret file cannot be read. | `runner-pool-secret-file` |
| `unknown flag <flag>` | An unknown flag. | `runner-host-config-dir-flag` |
| `empty argument — a flag value may be unset (failed env/K8s substitution?)` | An empty argument. | `runner-empty-argument` |
| `unexpected argument '<word>' — this command takes no positional arguments` | A word that is not a flag. | `runner-positional` |

## `orchestrator`

`claude self-hosted-runner orchestrator` polls the spawn-hints queue and runs the `spawn-runner` hook in `--hooks-dir` once for each hint. The hook must start the work and exit within `--hook-timeout`. Exit code `0` is success, `1` is a failure to retry, and `2` or more stops further tries. See [On-Demand Runners](https://code.claude.com/docs/en/self-hosted-environments-configuration#on-demand-runners) and [The Spawn-Runner Hook](https://code.claude.com/docs/en/self-hosted-environments-configuration#the-spawn-runner-hook).

Source: the program, in its help text and its orchestrator parser (`chunk-d8kkjn8f.js`, near offset 24075).

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--api-url <url>` | <Undocumented /> | Sets the API base URL. | `https://api.anthropic.com` |
| `--environment-secret-file <path>` | <Documented /> | As for the runner. `--pool-secret-file` is the deprecated alias. | None |
| `--hooks-dir <path>` | <Documented /> | The folder of the `spawn-runner` hook. Required. | None |
| `--hook-concurrency <n>` | <Undocumented /> | Sets how many hooks run at the same time, and how many hints one poll claims. 1 to 100. | `4` |
| `--hook-timeout <sec>` | <Documented /> | Sends SIGTERM to the hook after this many seconds. Over 0. The value plus 5 seconds must be less than `--expected-spawn-seconds`. | `60` |
| `--expected-spawn-seconds <n>` | <Documented /> | Sets the p99 boot time of the runners it starts, sent as the server lease. 10 to 3600. All replicas must use the same value. | `120` |
| `--min-idle <n>` | <Documented /> | Keeps at least this many free session slots. 0 to 200. | `0` |
| `--scm-connector-host <host[:port]>` | <Undocumented /> | Turns on a tunnel to a GitHub Enterprise Server host that only your network can reach. | Off |
| `--scm-connector-id <n>` | <Undocumented /> | The GitHub Enterprise configuration ID of the organization. A positive integer. Required with `--scm-connector-host`. | None |
| `--scm-connector-provider <slug>` | <Undocumented /> | The provider slug. 1 to 32 of `a-z`, `0-9`, and `-`. | `ghe` |
| `--scm-connector-ca-file <path>` | <Undocumented /> | An extra PEM CA bundle for the TLS to the host. | None |
| `--scm-connector-host-rewrite <from>=<host:port>` | <Undocumented /> | Connects to another address and keeps the host name for TLS. The help text marks it as for end-to-end tests only. | Off |
| `--shutdown-drain-sec <n>` | <Documented /> | On SIGTERM, gives the poll and the hooks this many seconds to end. 0 to 3600. | `0` |
| `--health-port <port>` | <Documented /> | The `/healthz` port. It always answers 200. `0` turns it off. | `8080` |
| `--log-level <level>` | <Documented /> | `info` or `debug`. | `info` |
| `--agent-proxy-url <url>` | <Undocumented /> | Passes the agent proxy to the hook as `SELF_HOSTED_RUNNER_AGENT_PROXY_URL`. | Off |
| `--debug-dir <path>` | <Undocumented /> | Writes each work order and hook stderr to files in the folder. They are deleted after 5 minutes. For development only. | Off |

Orchestrator errors that the `cli321` probe printed (exit code 2, then `Run 'claude self-hosted-runner orchestrator --help' for usage.`):

- `--hook-timeout (200s) + 5s SIGKILL grace must be less than --expected-spawn-seconds (120s) — otherwise an HA replica re-claims the lease while this hook is still running and both spawn a runner` (`runner-orchestrator-hook-timeout`).
- `--min-idle must be an integer in [0, 200]` (`runner-orchestrator-min-idle`).
- `--scm-connector-id / --scm-connector-provider / --scm-connector-ca-file / --scm-connector-host-rewrite require --scm-connector-host` (`runner-orchestrator-scm-id-only`).

With no hook folder, the orchestrator prints `[runner:fatal] orchestrator requires --hooks-dir (or SELF_HOSTED_RUNNER_HOOKS_DIR) — no spawn-runner hook directory configured` on stdout and exits with code 1 (`runner-orchestrator-no-hooks`). The code also refuses a `spawn-runner` hook that is missing, not a regular file, or not executable, and an environment secret without the `ccr:pool_id` claim.

## `setup` And `doctor`

| Command | Status | What it does |
| --- | --- | --- |
| `claude self-hosted-runner setup [args...]` | <Documented /> | Starts a session that guides you from zero to a working environment: it creates an environment, starts a local runner, checks that it shows in the Admin UI, and writes `CHEAT-SHEET.md`. See the [quickstart](https://code.claude.com/docs/en/self-hosted-environments-quickstart). |
| `claude self-hosted-runner doctor [args...]` | <Undocumented /> | Starts a session that diagnoses a deployment (auth, network, lifecycle, session, queue, version, observability). It reads `/healthz`, the runner logs, and the admin API, fixes what it can, and writes a redacted bundle. |

Both pass the other arguments to the Claude Code session.

## `decode-token`

`claude self-hosted-runner decode-token [token]` decodes a session-ingress JWT and prints its claims as JSON. It removes an `sk-ant-cc-` or `sk-ant-si-` prefix. The token comes from the argument, then `CLAUDE_CODE_SESSION_ACCESS_TOKEN`, then stdin. See [Provision Credentials Scoped to the Session Creator](https://code.claude.com/docs/en/self-hosted-environments-configuration#provision-credentials-scoped-to-the-session-creator).

By default it checks the signature against `<api-url>/v1/code/.well-known/jwks.json` and the `exp` and `nbf` claims, with 60 seconds of skew. On success it prints `verified (kid=…, sig+exp)` on stderr. A failed check, an expired token, or a failed key fetch exits with code 1. It does not check `iss`, `aud`, or the token type.

| Option | Status | What it does |
| --- | --- | --- |
| `--header` | <Undocumented /> | Prints the JWT header in place of the claims. |
| `--no-verify` | <Undocumented /> | Skips the signature check and the key fetch. Do not use the output for an auth decision. |
| `--no-check-expiry` | <Undocumented /> | Skips the `exp` and `nbf` check. The signature check stays. |
| `--api-url <url>` | <Undocumented /> | Sets the base URL of the key fetch. |
| `--verify` | <Undocumented /> <Deprecated note="Verification is the default" /> | Kept for old scripts. It does nothing. |
| `-h`, `--help` | <Documented /> | Prints the help text. |

The default of `--api-url` is `ANTHROPIC_BASE_URL`, else the built-in API URL.

## Related Pages

- [Subcommands](subcommands.md)
- [Remote and Cloud Session Variables](../env-vars/remote-and-cloud-sessions.md)
- [Remote Control Server](remote-control.md)
