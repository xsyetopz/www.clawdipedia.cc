---
title: Self-Hosted Runner
description: Every option of claude self-hosted-runner and its orchestrator, setup, doctor, and decode-token subcommands in 2.1.328, with the parser rules and each error.
sidebar_position: 5
---

`claude self-hosted-runner` runs Claude Code cloud sessions on a machine that you control. The root help text does not list the command.
The [official overview](https://code.claude.com/docs/en/self-hosted-environments) explains environments and runners. The [deploy guide](https://code.claude.com/docs/en/self-hosted-environments-deploy) and the [configuration guide](https://code.claude.com/docs/en/self-hosted-environments-configuration) explain most options. This page lists every option in `2.1.328`, with the options that the official pages do not name, and the exact parser rules.

The variables are on [Remote and Cloud Session Variables](../env-vars/remote-and-cloud-sessions.md).[^runner-help]

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
- Each parser error prints `error: <message>`, then `Run 'claude self-hosted-runner --help' for usage.`, and the runner exits with code 2. [^cli321]
- An on-demand runner that the server refuses because it is not needed (the session ended or paused) exits with code 0. Claude Code maps the refusal reasons `session_paused`, `queue_entry_gone`, `pool_moved`, and `standby_gone` to exit code 0. A superseded work order exits with code 1.[^exit-codes] A work order that was already used (`already_registered`, `standby_already_redeemed`) and any other reason also exit with code 1.

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
| `--use-anthropic-git-proxy` | <Documented /> | Uses Anthropic-managed git. Needs `--capacity 1`, git 2.32 or later, and a global git config that is not a device such as `/dev/null`. It deletes and replaces the home-level git config of the runner account at startup and before each session. If `GIT_CONFIG_GLOBAL` names a non-empty directory, or is, or lies in, a place that the runner resets, the runner keeps it. It then ignores the variable for itself and its sessions, gives the sessions a new git config file, and prints a warning. Put operator git config in `/etc/gitconfig` or use `--configure-git`.[^git-config-global] See [Harden Your Deployment](https://code.claude.com/docs/en/self-hosted-environments-deploy#harden-your-deployment). | Off |
| `--no-clone-through-agent-proxy` | <Undocumented /> | A hidden flag. With `--agent-proxy-url`, the runner then does not clone http(s) repositories through the proxy. It skips the git version check and the warning about the proxy credential that go with that clone.[^no-clone] | Off |
| `--use-anthropic-gh [bool]` | <Undocumented /> | Offers the built-in `gh api` of Claude Code to sessions where no `gh` is installed. It reaches the REST API of github.com only, and its requests go through Anthropic, which adds the GitHub credential it holds for the session, if any. `false`, `0`, `no`, or `off` turns it off. The runner withholds it on Windows, above `--capacity 1`, with `--agent-proxy-url`, with `--exec-path` or a command hook, while nonessential traffic is disabled, with a model provider other than the Anthropic API, on a runner that a Claude Code session's shell started, in code reviews, in tools-only sessions, and where the older git proxy carries the git of a session.[^gh] It is off by default in a session whose settings guard Claude's GitHub tools by name. `--use-anthropic-gh true` turns it on there.[^v328-gh] It reads `SELF_HOSTED_RUNNER_USE_ANTHROPIC_GH`. | On |
| `--configure-git` | <Documented /> | Sets the git identity to `Claude <noreply@anthropic.com>` with commit signing. Needs git 2.34 or later. See [Configure Git](https://code.claude.com/docs/en/self-hosted-environments-deploy#configure-git). | Off |
| `--push-outcome-on-release` | <Documented /> | Pushes each outcome branch before the runner ends a session that did not complete. See [Prompt Sessions to Push Their Work](https://code.claude.com/docs/en/self-hosted-environments-configuration#prompt-sessions-to-push-their-work). | Off |
| `--trust-workspace [bool]` | <Documented /> | Trusts the repository paths of each session, so repo `permissions.allow` and `additionalDirectories` apply. With `false`, the runner sets `CLAUDE_CODE_IGNORE_PERSISTED_TRUST=1` for each session, and no workspace trust record counts.[^trust] | `true` |
| `--remove-session-state [bool]` | <Documented /> | Removes the per-session state under `<base-dir>/_sessions/` when a session ends. See [Reuse a Pre-Warmed Checkout](https://code.claude.com/docs/en/self-hosted-environments-deploy#reuse-a-pre-warmed-checkout). | `false` |
| `--repository-folder <owner>/<repo>=<folder>` | <Undocumented /> | Names the folder that sessions use for a repository, such as its pre-warmed checkout on a volume, in place of `<owner>/<repo>` under `--base-dir`. `'<owner>/*=<folder>/*'` (in quotes) covers each repository of the owner: the folder in `<folder>` that has its name. You can repeat the flag. Each folder must exist when the runner starts, under its real path. At `--capacity` above 1 it does nothing, and the runner logs a warning. When a `checkout` hook prepares the repository, the runner does not use the folder. It reads `SELF_HOSTED_RUNNER_REPOSITORY_FOLDER` as a comma-separated list.[^repo-folder] | None |
| `--diff-finds-nested-repository [bool]` | <Undocumented /> | Lets the Changes pane show a repository cloned in a subfolder of a session started with no repository. Needs `--capacity 1`, and works only while the tool sandbox is off. The runner tells the child about it with `--runner-declares` (see [All Flags](flags.md)). If `--exec-path` is a script, it must put nothing before `"$@"`. | `false` |
| `--confine-repo-settings <mode>` | <Documented /> | Sets the guard for settings committed in the repository: `warn`, `enforce`, or `off`. | `warn` |
| `--server-auto-mode-lists <mode>` | <Undocumented /> | Sets which auto mode classifier lists from the server a session may get: `all`, `no-allow`, or `none`. `no-allow` holds back the allow list and the exceptions to soft block rules. | `no-allow` |
| `--host-config-snapshot <mode>` | <Undocumented /> | Sets where the startup copy of the host config folder is kept: `disk` (under `--base-dir`, checked at each session start) or `memory` (64 MiB at most). | `disk` |
| `--health-port <port>` | <Documented /> | Sets the port of the `/healthz` listener. An integer from 0 to 65535; `0` turns it off. See [Kubernetes](https://code.claude.com/docs/en/self-hosted-environments-deploy#kubernetes). | `8080` |
| `--log-level <level>` | <Documented /> | Sets the log level: `info` or `debug`. It has no variable. | `info` |
| `--log-file <path>` | <Documented /> | Also writes the runner logs to the file, in append mode. | Off |
| `--nested-model-access [bool]` | <Undocumented /> | Lets a command that a session runs start a Claude Code of its own, such as `claude -p`, that can use the model. The runner opens a private socket for each session and adds the session's model credential to model calls that arrive there. The commands get no model credential. Needs `--nested-model-allow`. The runner does not apply the model limits of managed settings, does not ask before a model that is billed to usage credits, and does not record the calls in the session. Any process of the same Unix user that holds the session's token can use the socket, so give the sessions of each person a Unix user of their own. The runner opens no socket for a session whose organization is under HIPAA or has server-managed settings, or for a session that uses governed git. The log then says `nested model access NOT OPENED`. The runner asks again at each renewal of the model token. A refusal ends the access, and two failed reads in a row suspend it. It cannot be combined with `--agent-proxy-url`, `--proxy-authorization-command`, `--proxy-authorization-file`, or `ANTHROPIC_UNIX_SOCKET`. It reads `SELF_HOSTED_RUNNER_NESTED_MODEL_ACCESS`.[^nested-model] | Off |
| `--nested-model-allow <models>` | <Undocumented /> | Lists the models that nested calls may use. You can repeat the flag. The values are comma-separated model ids, and an id that ends in `*` matches by prefix. The runner checks the list against the model of the request, each fallback, and the advisor. A call that names another model, or none, is refused. Name every model that a nested Claude Code uses: main, small (side tasks), subagent, fallback, and advisor. It limits which models, not how many tokens. Needs `--nested-model-access`. The environment variable `SELF_HOSTED_RUNNER_NESTED_MODEL_ALLOW` is used only when the flag is not given.[^nested-model] | None |
| `--nested-model-call-budget <n>` | <Undocumented /> | Sets the most model calls that the runner forwards for one session. Further calls are refused, and `0` refuses every call. A call is one request, whatever its model and length. The runner keeps the count while it runs. The count starts again when the runner restarts or the session moves to another runner. The value is a whole number from `0` to `999999999`. The environment variable `SELF_HOSTED_RUNNER_NESTED_MODEL_CALL_BUDGET` is used only when the flag is not given.[^nested-model] | `200` |

The host config folder has no flag. Set `SELF_HOSTED_RUNNER_HOST_CONFIG_DIR`; `--host-config-dir` stops the runner with `unknown flag --host-config-dir`. See [MCP Servers](https://code.claude.com/docs/en/self-hosted-environments-configuration#mcp-servers).

## Lifecycle Options

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--exit-if-unused-min <n>` | <Documented /> | Exits the runner if it gets no work for this long. Maximum 10080. See [Make On-Demand Runners Exit When Idle](https://code.claude.com/docs/en/self-hosted-environments-configuration#make-on-demand-runners-exit-when-idle). | Never |
| `--drain-grace-sec <n>` | <Documented /> | Keeps the runner polling this long after its sessions end. `0` exits at once. Maximum 604800. At `--capacity 1`, when the runner clones through the agent proxy and a different session already used the repository folder in this process, the runner moves the folder aside and clones the repository again. If it cannot move the folder aside, it logs `[runner:warn] <folder> could not be moved aside, so it is not cloned anew`.[^drain-reclone] | `0` |
| `--retire-at <epoch-seconds>` | <Documented /> | Retires the runner at this Unix time in whole seconds. A value from 1000000000 to 100000000000. | Never |
| `--defer-shutdown-max-min <m>` | <Documented /> | On the first SIGTERM or SIGINT, stops new work and keeps serving sessions for up to `m` minutes before it drains. Fractions are allowed. Maximum 10080. See [Runner Lifecycle](https://code.claude.com/docs/en/self-hosted-environments#runner-lifecycle). | `0` |

## Per-Session Watchdog Options

The help text and the parser give these rows.[^watchdog]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--release-idle-session-min <n>` | <Documented /> | Releases a session after this long with no user input. Any value, `0` included, overrides the idle limit that Anthropic's control plane sends. Maximum 10080. | Never |
| `--hold-idle-file <path>` | <Documented /> | Does not release an idle session while the file is a regular file changed in the last 180 seconds. The runner looks again every 30 seconds. The hold does not apply at startup, at `--retire-at`, at the `--defer-shutdown-max-min` ceiling, or at `--kill-session-after-min`. See [Keep an Idle Session While Its Processes Run](https://code.claude.com/docs/en/self-hosted-environments-deploy#keep-an-idle-session-while-its-processes-run). | Off |
| `--max-hold-min <n>` | <Documented /> | With `--hold-idle-file`, holds a session no longer than this. `0` turns the hold off. Maximum 10080. | `1440` |
| `--startup-timeout-min <n>` | <Documented /> | Releases a session whose process has not finished starting up after this long. `0` turns it off. Maximum 10080. | `15` |
| `--kill-session-after-min <n>` | <Documented /> | Limits the life of a session process. At the limit, a waiting session is released; a running turn is stopped 15 minutes later (`SELF_HOSTED_RUNNER_MAX_LIFETIME_GRACE_MS`). Maximum 10080. | Never |
| `--debug-token-dir <path>` | <Undocumented /> | Writes live tokens to disk. For debugging only. | Off |
| `-h`, `--help` | <Documented /> | Prints the help text. | |

## Retry Setting of a Session

The runner starts each session with `CLAUDE_CODE_RETRY_WATCHDOG` set to `1`, so the session retries rate limits and overload errors without end.[^runner-retry] The session removes `CLAUDE_CODE_RETRY_WATCHDOG` from the environment of the commands and hooks it starts. A `claude -p` that a script or hook starts thus does not wait out rate limits.[^runner-retry]

## Runner Errors

Each row is an error of the parser.[^parser-errors] The runner writes each one to `stderr` as `error: <message>`, adds `Run 'claude self-hosted-runner --help' for usage.`, and exits with code 2.[^error-prefix]

| Message | When |
| --- | --- |
| `--capacity must be a positive integer, got: <value>` | The value is not an integer of 1 or more. |
| `--health-port must be an integer in [0, 65535] (0 disables), got: <value>` | The port is out of range. |
| `--git-ssh-rewrite requires a hostname` | No value. |
| `--nested-model-access needs a list of models: ...` | `--nested-model-access` is on, and neither `--nested-model-allow` nor `SELF_HOSTED_RUNNER_NESTED_MODEL_ALLOW` gives a list. |
| `--nested-model-access cannot be combined with --agent-proxy-url or --proxy-authorization-command / --proxy-authorization-file: ...` | The access is on with an agent proxy or a proxy authorization option. |
| `--nested-model-access cannot be used while ANTHROPIC_UNIX_SOCKET is set in the runner's environment: ...` | The access is on and the runner's own environment has `ANTHROPIC_UNIX_SOCKET`. |
| `<name> must be a comma-separated list of model ids, such as <model-id>,<prefix>*. ...` | A value of `--nested-model-allow` has a bad id. An id starts with a letter or digit, uses only letters, digits, and `. _ : @ / -`, and may end in one `*`. |
| `<name> must be a whole number from 0 to 999999999 (got: <value>)` | The value of `--nested-model-call-budget` is not a whole number in range. |
| `--git-host-rewrite requires <from>=<to>` | No value, or no text on one side of `=`. |
| `--git-host-rewrite expects bare hostnames (e.g. ext.example.com=int.example.com), not URLs. Got: <value>` | A side holds `://` or `/`.[^probe-git-host-rewrite-url] |
| `duplicate --git-host-rewrite for '<host>'` | The same `<from>` host twice. |
| `[runner:warn] --git-ssh-rewrite '<host>' will not match: --git-host-rewrite rewrites it to '<to>' first.` | A warning. The runner goes on. |
| `--confine-repo-settings requires one of enforce/warn/off (got: "<value>")` | A bad mode.[^probe-confine-bad] |
| `--server-auto-mode-lists requires one of all/no-allow/none (got: "<value>")` | A bad mode.[^probe-lists-bad] |
| `--host-config-snapshot requires one of disk/memory (got: "<value>")` | A bad mode.[^probe-snapshot-bad] |
| `--<flag> must be a non-negative number of minutes (0 disables, max 10080), got: <value>` | A bad value of `--kill-session-after-min`, `--exit-if-unused-min`, `--release-idle-session-min`, `--startup-timeout-min`, `--checkout-hook-timeout-min`, `--max-hold-min`, or `--defer-shutdown-max-min`. |
| `--<flag> must be a positive number of seconds, got: <value>` | A bad value of `--session-stop-grace-sec` or `--post-session-hook-timeout-sec`. |
| `--<flag> must be a non-negative number of seconds (max 86400), got: <value>` | A bad value of `--drain-wait-sec` or `--drain-wait-bg-tasks-sec`.[^probe-drain-wait-bg-tasks] |
| `--drain-grace-sec must be a non-negative number of seconds (0 = immediate, max 604800), got: <value>` | A bad value. |
| `--retire-at must be an absolute Unix timestamp in whole SECONDS (...), got: <value>` | Milliseconds, a duration, or text.[^probe-retire-at-ms] |
| `--sigkill-timeout-sec was renamed to --session-stop-grace-sec. ...` | The old flag.[^probe-sigkill] |
| `--drain-marker-file requires a file path (the marker your host writes to announce a graceful drain), got: <value>` | No value, an empty value, or a value that starts with `--`. |
| `--hold-idle-file requires a file path (a file your host keeps fresh while the session has processes left running), got: <value>` | No value, an empty value, or a value that starts with `--`. |
| `the path, or a link on the way to it, leads to a network location; point --hold-idle-file at a local file` | The hold file is on a network location.[^hold-network] |
| `the path could not be checked for links to a network location: a folder or link on the way could not be read` | A folder or link on the way to the hold file cannot be read. |
| `--agent-proxy-url requires your proxy's https:// URL` | No value, an empty value, or a value that starts with `--`. |
| `--proxy-authorization-command / --proxy-authorization-file requires a value` | No value, or a value that starts with `--`. |
| `<name> must be <owner>/<repo>=<folder>, or <owner>/*=<folder>/* (got: <value>)` | A value of `--repository-folder` or `SELF_HOSTED_RUNNER_REPOSITORY_FOLDER` has a bad shape. `<name>` is the flag or the variable.[^repo-folder-errors] |
| `--repository-folder cannot be used: <folder> cannot be looked at (<system error>)` | The runner cannot look at the folder.[^repo-folder-errors] |
| `--diff-finds-nested-repository requires --capacity 1. ...` | The option is on with a capacity over 1. |
| `Failed to read environment secret file <path> (<system error>)` | The secret file cannot be read.[^probe-pool-secret-file] |
| `unknown flag <flag>` | An unknown flag.[^probe-host-config-dir-flag] |
| `empty argument — a flag value may be unset (failed env/K8s substitution?)` | An empty argument.[^probe-empty-argument] |
| `unexpected argument '<word>' — this command takes no positional arguments` | A word that is not a flag.[^probe-positional] |

### Start-Up Failure After Registration

A runner that fails to start after it registers tells the server before it exits.[^startup-fail] The runner writes these lines in order:

| Line | When |
| --- | --- |
| `[runner:fatal] <message> (startup_fatal:<code>)` | Always. `<code>` is `gitconfig_wipe_failed`, `git_proxy_setup_failed`, `configure_git_failed`, or `startup_failed`. For a failure with no code, the code is `startup_failed` and `<message>` starts with `unexpected startup failure:`. |
| `[runner:exit] Reported this startup failure for session <id>; the server ...` | The work order names a session, as for an on-demand runner. The runner reports the failure against each session it holds. The line then says that the server `will not offer it to another runner until an environment admin retries it` or that the server `may retry it on another runner`. |
| `[runner:exit] Could not confirm that the server recorded this startup failure (...), so this runner exits without deregistering; ...` | The report gets no answer within 4 s, or it fails. The runner does not deregister. The server removes the runner when its lease expires. |
| `[runner:exit] Not reporting this startup failure against the session: a shutdown signal had arrived, ...` | A stop signal came before the failure. The runner deregisters with the reason `shutdown_signal`. |
| `[runner:exit] Deregistered after startup failure (startup_fatal:<code>)` | The runner deregistered. The reason it sends is `startup_git_proxy_setup_failed` for the codes `gitconfig_wipe_failed` and `git_proxy_setup_failed`, `startup_configure_git_failed` for `configure_git_failed`, and `startup_failed` for `startup_failed`. |
| `[runner:exit] Could not tell the server this runner is leaving (...); after its lease expires the server removes it` | The deregistration failed. |

## `orchestrator`

`claude self-hosted-runner orchestrator` polls the spawn-hints queue and runs the `spawn-runner` hook in `--hooks-dir` once for each hint. The hook must start the work and exit within `--hook-timeout`. Exit code `0` is success, `1` is a failure to retry, and `2` or more stops further tries. On a failure, the orchestrator sends the end of the hook's stderr back as the error. It also sends the last stderr line that starts with `user-message:` and a space to the user of the session. It does not send the line if the line holds a control character, such as a color, or looks as if it holds a secret, or if the hook timed out or a signal ended it. An exit status of 129 to 159 counts as a signal.[^user-message] See [On-Demand Runners](https://code.claude.com/docs/en/self-hosted-environments-configuration#on-demand-runners) and [The Spawn-Runner Hook](https://code.claude.com/docs/en/self-hosted-environments-configuration#the-spawn-runner-hook).[^orch]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `--api-url <url>` | <Undocumented /> | Sets the API base URL. | `https://api.anthropic.com` |
| `--environment-secret-file <path>` | <Documented /> | As for the runner. `--pool-secret-file` is the deprecated alias. | None |
| `--hooks-dir <path>` | <Documented /> | The folder of the `spawn-runner` hook. Required. | None |
| `--hook-concurrency <n>` | <Undocumented /> | Sets how many hooks run at the same time, and how many hints one poll claims. 1 to 100. | `4` |
| `--hook-timeout <sec>` | <Documented /> | Sends SIGTERM to the hook after this many seconds. Over 0. The value plus 5 seconds must be less than `--expected-spawn-seconds`. | `60` |
| `--expected-spawn-seconds <n>` | <Documented /> | Sets the p99 boot time of the runners it starts, sent as the server lease. 10 to 3600. All replicas must use the same value. | `120` |
| `--hook-label <label>=<values>` | <Undocumented /> | Hands this entry of a session's metadata to the hook as `CLAUDE_RUNNER_META_<LABEL>`. The values are words, as in `size=small,large`, or a range of whole numbers, as in `cpus=1..64`. For a session with another value, the hook does not run. Repeat the flag once for each label. It needs `--min-idle` at 0.[^hook-label] | None |
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

These orchestrator errors exit with code 2, then print `Run 'claude self-hosted-runner orchestrator --help' for usage.`:

- `--hook-timeout (200s) + 5s SIGKILL grace must be less than --expected-spawn-seconds (120s) — otherwise an HA replica re-claims the lease while this hook is still running and both spawn a runner`.[^orch-timeout]
- `--min-idle must be an integer in [0, 200]`.[^orch-min-idle]
- `--hook-label cannot read "<value>". It takes words, as in size=small,large, or a range from low to high, as in cpus=1..64, of up to nine digits with no leading zero. ...`.[^hook-label-errors]
- `--hook-label takes one argument: put commas between the words, as in size=small,large, and give each label a flag of its own`.[^hook-label-errors]
- `--hook-label names one label twice: give all its values in one flag, as in size=small,large`.[^hook-label-errors]
- `--hook-label cannot be used with --min-idle: a standby runner ignores the labels of the session that it takes. Remove one of the two`.[^hook-label-errors]
- `--scm-connector-id / --scm-connector-provider / --scm-connector-ca-file / --scm-connector-host-rewrite require --scm-connector-host`.[^orch-scm]

With no hook folder, the orchestrator prints `[runner:fatal] orchestrator requires --hooks-dir (or SELF_HOSTED_RUNNER_HOOKS_DIR) — no spawn-runner hook directory configured` on stdout and exits with code 1.[^orch-no-hooks] The code also refuses a `spawn-runner` hook that is missing, not a regular file, or not executable, and an environment secret without the `ccr:pool_id` claim.

### Orchestrator Metrics

The orchestrator answers `GET /metrics` in the Prometheus text format. It adds two metrics.[^orch-metrics]

| Metric | Status | What it counts | Notes |
| --- | --- | --- | --- |
| `claude_code_self_hosted_orchestrator_session_queue_wait_by_reason_seconds` | <Undocumented /> | A histogram of the seconds that a session waited in the queue before the orchestrator claimed it. It splits `claude_code_self_hosted_orchestrator_session_queue_wait_seconds` by the `reason` label. | `reason` is `session_created` (a new session), `resumed` (a re-opened session), `none`, or `other`. A retry counts under its own reason. |
| `claude_code_self_hosted_orchestrator_sessions_given_up_total` | <Undocumented /> | A counter of how often Anthropic gave up starting a runner for a session, since the process started. | The `cause` label is `lease_expiry`, `retries_exhausted`, or `hook_declined`. Each give-up counts in one instance, so add the values across instances. |

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

## Sources

[^runner-help]: The text of `claude self-hosted-runner --help` and of each subcommand help in `2.1.328`, and the option parser of the program: the parse loop at `chunk-gv1b3n3g.js:329805`, its unknown-option branch at `chunk-gv1b3n3g.js:339555`, and the root help text from `chunk-gv1b3n3g.js:353970`, which runs to its `--help` line at `chunk-gv1b3n3g.js:393087`.
[^cli321]: Probe group `cli321`.
[^exit-codes]: The program, `chunk-gv1b3n3g.js:345212`.
[^no-clone]: The program, `chunk-gv1b3n3g.js:339187` (the parser), `chunk-gv1b3n3g.js:406369` (the warning), and `chunk-gv1b3n3g.js:407369` (the git version check). The warning and the check both depend on the flag.
[^gh]: The program, the parser `chunk-gv1b3n3g.js:331215`, the help text `chunk-gv1b3n3g.js:365608-366900`, and the reasons for withholding `chunk-gv1b3n3g.js:36300-37917`.
[^nested-model]: The program, `chunk-gv1b3n3g.js:331779` (`--nested-model-access`), `chunk-gv1b3n3g.js:331975` (`--nested-model-call-budget`), `chunk-gv1b3n3g.js:339941` (the variables), `chunk-gv1b3n3g.js:339986` and `chunk-gv1b3n3g.js:393621-393944` (the errors), `chunk-gv1b3n3g.js:374893` (the help text), and `chunk-gv1b3n3g.js:403088` (the start-up log).
[^git-config-global]: The program, `chunk-gv1b3n3g.js:351977-352550` (the reset) and `chunk-gv1b3n3g.js:413399-414047` (the warning).
[^trust]: The program, `chunk-xethrx83.js:58018` and `chunk-sm9djeyx.js:32872`.
[^parser-errors]: The program, `chunk-gv1b3n3g.js:339425-372037`. Probe group `cli321`.
[^orch]: The program, help text and orchestrator parser, `chunk-ydhgnm30.js:44033` and `chunk-ydhgnm30.js:20648`.

[^user-message]: The program, `chunk-ydhgnm30.js:44526` (the help text), `chunk-1ag7mmq0.js:56872` (the `user-message:` prefix), `chunk-1ag7mmq0.js:61471` (the stderr reader and its control-character and secret checks), `chunk-ydhgnm30.js:42559` (the timeout and signal check), and `chunk-ydhgnm30.js:43000` (the `user_message` field of the nack).

[^drain-reclone]: The program, `chunk-gv1b3n3g.js:383455` (the help text), `chunk-gv1b3n3g.js:194111` (the agent-proxy check that a different session used the folder), and `chunk-gv1b3n3g.js:295584` (the move aside and its log lines).
[^orch-timeout]: Probe case `runner-orchestrator-hook-timeout`, group `cli321`.
[^hook-label]: The program, `chunk-ydhgnm30.js:1705` (the help text), `chunk-ydhgnm30.js:790` (the parser), and `chunk-ydhgnm30.js:886` (the `--min-idle` check). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^repo-folder]: The program, `chunk-gv1b3n3g.js:16118` (the help text), `chunk-gv1b3n3g.js:16536` (the warning at `--capacity` above 1), and `chunk-gv1b3n3g.js:8337` (the `checkout` hook). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^repo-folder-errors]: The program, `chunk-gv1b3n3g.js:14749` (the shape check) and `chunk-gv1b3n3g.js:3808` (the look at the folder). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^hook-label-errors]: The program, `chunk-ydhgnm30.js:208` (the words and ranges), `chunk-ydhgnm30.js:794` and `chunk-ydhgnm30.js:798` (the flag form), and `chunk-ydhgnm30.js:886` (the `--min-idle` check). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^orch-min-idle]: Probe case `runner-orchestrator-min-idle`, group `cli321`.
[^orch-scm]: Probe case `runner-orchestrator-scm-id-only`, group `cli321`.
[^orch-no-hooks]: Probe case `runner-orchestrator-no-hooks`, group `cli321`.
[^orch-metrics]: The program, `chunk-ydhgnm30.js:1118` (the reason metric), `chunk-ydhgnm30.js:1141` (the give-up metric), and `chunk-ydhgnm30.js:1179` (the `/metrics` route). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^hold-network]: The program, `chunk-gv1b3n3g.js:350028`.
[^probe-git-host-rewrite-url]: Probe case `runner-git-host-rewrite-url`.
[^probe-confine-bad]: Probe case `runner-confine-bad`.
[^probe-lists-bad]: Probe case `runner-lists-bad`.
[^probe-snapshot-bad]: Probe case `runner-snapshot-bad`.
[^probe-drain-wait-bg-tasks]: Probe case `runner-drain-wait-bg-tasks`.
[^probe-retire-at-ms]: Probe case `runner-retire-at-ms`.
[^probe-sigkill]: Probe case `runner-sigkill`.
[^probe-pool-secret-file]: Probe case `runner-pool-secret-file`.
[^probe-host-config-dir-flag]: Probe case `runner-host-config-dir-flag`.
[^probe-empty-argument]: Probe case `runner-empty-argument`.
[^probe-positional]: Probe case `runner-positional`.
[^watchdog]: The program, the parser `chunk-gv1b3n3g.js:336066-337956`, the help text `chunk-gv1b3n3g.js:389449` and `chunk-gv1b3n3g.js:391984`, and the constants `chunk-gv1b3n3g.js:325413` (10080 minutes), `chunk-gv1b3n3g.js:349489` (180 seconds, 30 seconds, 1440 minutes), `chunk-gv1b3n3g.js:269208` (the 15 minutes of the kill grace).
[^runner-retry]: The program, `chunk-gv1b3n3g.js:252098` (the session environment), and `chunk-thtytpkk.js:14876` with `chunk-427dvgs1.js:2262`: in a remote session whose `CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE` is `self_hosted`, the environment of a child process drops `CLAUDE_CODE_RETRY_WATCHDOG`.
[^error-prefix]: The program, `chunk-gv1b3n3g.js:16365` (the runner) and `chunk-ydhgnm30.js:1772` (the orchestrator, which names `claude self-hosted-runner orchestrator --help`).
[^startup-fail]: The program, `chunk-gv1b3n3g.js:342519` (the codes and the deregistration reasons), `chunk-gv1b3n3g.js:343139` (the report against each session), `chunk-gv1b3n3g.js:343899` (the 4 s limit on the report), `chunk-gv1b3n3g.js:344102` (the failure path), and `chunk-gv1b3n3g.js:31519` (a work order that names a session). [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328).
[^v328-gh]: [`2.1.328` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.328). The program, `chunk-16v2wsc7.js:1562`.
