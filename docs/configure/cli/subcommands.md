---
title: Subcommands
description: Every claude subcommand in 2.1.326, including background sessions, auth, plugins, and the hidden commands.
sidebar_position: 3
---

A subcommand is a word after `claude` that starts a separate job, such as `claude doctor`.
`claude --help` lists 18 commands. Several more work but the root help does not show them.
Each command has its own `--help`.

Run `claude <command>`. Run `claude <command> --help` for its options. Each command has its own flags. A command runs only when you call it.

## Example

```bash
claude --bg "run the full test suite"   # prints a short id
claude agents                           # list background sessions
claude logs <id>                        # read recent output
claude stop <id>                        # stop it, keep the conversation
```

## Commands

Each command has its own help text.[^cmd-help]

| Command | Status | What it does |
| --- | --- | --- |
| `claude agents` | <Documented /> | Opens the agent view to watch and start background sessions. `--json` prints the active sessions. With `--json`, `--all` adds completed background sessions. With `--json`, `--cwd <path>` keeps only the sessions started under that path. These options set the defaults of the sessions it dispatches: `--model`, `--effort`, `--agent`, `--permission-mode`, `--add-dir`, `--mcp-config`, `--strict-mcp-config`, `--plugin-dir`, `--settings`, `--setting-sources`, `--restricted`, `--dangerously-skip-permissions` (an alias for `--permission-mode bypassPermissions`), and `--allow-dangerously-skip-permissions`. The hidden `--inherit-permission-mode`, `--managed-settings`, and `--plugin-dir-no-mcp` also work. |
| `claude attach <id\|name>` | <Documented /> | Opens a background session. |
| `claude logs <id\|name>` | <Documented /> | Prints the recent output of a background session. |
| `claude stop <id>` (alias `kill`) | <Documented /> | Stops a background session and keeps the conversation. |
| `claude respawn <id>` or `--all` | <Documented /> | Restarts a background session, or all of them, so it uses the current Claude Code binary. |
| `claude rm <id>` | <Documented /> | Removes a background session from the list, and deletes its worktree when that is safe. The conversation is kept, and `claude --resume` lists it.[^rm] Unlike `stop`, it works on a session that already exited. It takes `--discard-unpushed <commit>@<worktree-id>` (also discards the unpushed commits and uncommitted changes of the worktree while it is still at that commit) and `--force-remove-worktree <worktree-id>` (deletes the worktree folder when the `WorktreeRemove` hook or git could not; the repository must list it as a worktree, with no uncommitted changes to tracked files; the branch stays). For both, pass the value that an earlier `claude rm <id>` printed. |
| `claude daemon [run\|status\|logs\|stop\|uninstall]` | <Documented /> | Controls the supervisor of background sessions, which the root help does not list. See [`daemon` Subcommands](#daemon-subcommands). |
| `claude auth login\|logout\|status` | <Documented /> | Signs you in and out. `status` exits with 1 when you are not signed in. `login` takes `--claudeai` (the default), `--console` (API usage billing), `--email <email>` (fills in the login page), and `--sso`. `status` prints JSON by default (`--json`). With `--text`, it prints text. `login` also has a hidden option, `--gateway-json`, for a program that shows the Cloud gateway sign-in to a person. It writes its questions as JSON lines and reads the answers from stdin. It cannot be combined with `--console`, `--claudeai`, `--sso`, or `--email`. It reads the gateway from the settings of the machine. It checks in this order: a clash with the other login flags, a gateway in the settings, a terminal on stdin, and a Claude Code session. Each failure prints one line to standard error and exits with code 1. See the errors on [Auth Settings](../settings/auth.md#errors).[^gateway-json] |
| `claude setup-token` | <Documented /> | Makes a long-lived token. It needs a subscription. |
| `claude auto-mode config\|critique\|defaults\|reset` | <Documented /> | Shows or resets the rules of the auto mode classifier. `critique` takes `--model <model>`. `defaults` takes `--label <prefix>` to keep only rules whose label starts with the prefix. `reset` takes `-y/--yes` to skip the confirmation. |
| `claude doctor` | <Documented /> | Checks your setup and changes nothing. |
| `claude gateway --config <yaml>` | <Documented /> | Runs the enterprise gateway. |
| `claude import [codex\|gemini\|cursor]` | <Documented /> | Imports the config of another agent, with `--dry-run` and `--yes`. |
| `claude install [stable\|latest\|version]` | <Documented /> | Installs the native build, with `--force`. |
| `claude update` (alias `upgrade`) | <Documented /> | Updates Claude Code. Package-manager installs update through the package manager. |
| `claude mcp ...` | <Documented /> | Manages MCP servers (see [MCP](../../extend/mcp/cli.md)). |
| `claude plugin ...` (alias `plugins`) | <Documented /> | Manages plugins (see [Plugins](../../extend/plugins/cli.md)). |
| `claude plugin test [dir]` | <Documented /> | Runs the tests of a mod. |
| `claude purge [path]` | <Documented /> <Caution note="Deletes the state of a project" /> | Deletes the state of a project, with `--all`, `--dry-run`, `-i/--interactive` (asks before each item), and `-y/--yes`. Since `2.1.326`, when both stdout and stderr go to a pipe or a file, it prints "Claude Code can't show a prompt here", deletes nothing, and tells you to send one of them to the terminal.[^purge-pipe] Since `2.1.311`, the purge plan ends with "Purging deletes data only on this computer, not anything stored by Anthropic".[^purge] |
| `claude remote-control` (alias `rc`) | <Documented /> | Lets you control local sessions from `claude.ai` or the mobile app. See [Remote Control Server](remote-control.md). |
| `claude ultrareview [target]` | <Documented /> | Starts a cloud review with many agents, with `--json`, `--post`, `--no-post` (the default), `--timeout`, and `--trust-workspace`. Since `2.1.309` it needs a trusted folder. It asks on a terminal. Without a terminal it may refuse, so scripts pass `--trust-workspace` after the target, or set `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1`. |
| `claude self-hosted-runner` | <Documented /> | Runs cloud sessions on your machine, and the root help does not list it. Subcommands: `orchestrator`, `setup`, `doctor`, and `decode-token`. See [Self-Hosted Runner](self-hosted-runner.md) for every option and error. |
| `claude sandbox` | <Undocumented /> | A hidden command with three subcommands for the Windows sandbox: `install` adds the sandbox user and network filters. It asks for elevation once. `status` prints the sandbox state and the Windows install state as one JSON line. `uninstall` removes them and lists what stays behind, with `--json`. |
| `claude edit-hook`, `edit-permission-rules`, `edit-memory-settings`, `edit-skill-overrides`, `edit-sandbox-settings`, `edit-chrome-settings`, `design-login` | <Undocumented /> | Hidden commands that read one JSON edit from stdin with `--json`. Their text says they serve the VS Code extension. `design-login --status` reports whether design-system access is authorized and exits. |
| `claude workspace-trust --json` | <Undocumented /> | A hidden command that reports, as JSON, whether the current folder holds a saved workspace trust record. `--json` is required, and no other argument is allowed. The text says the VS Code extension uses it. The JSON has `trusted`, `directory`, `root` and `unsafe_path` when they apply, and `sandbox_limits_files`. If the record cannot be read, it prints `claude workspace-trust: the trust record could not be read: <message>`.[^trust-cmd] |
| `claude apply-project-settings` | <Undocumented /> | A hidden command that shows how your user and project settings differ from what you accepted for cloud sessions on this computer. It lets you accept them. It needs a terminal. |
| `claude project` | <Undocumented /> <Deprecated note="Use claude purge" /> | A hidden command with one subcommand, `purge`. The help text says that `claude project purge` is now `claude purge` and that the old name still works for now. |
| `claude worktree-hook` | <Undocumented /> | Since `2.1.326`, a hidden command that runs the WorktreeCreate or WorktreeRemove hooks for the current directory and reports the result as JSON. The help text says Claude Desktop uses it.[^worktree-hook] It needs `--json` and `--event <create\|remove>`. `--name <slug>` names the worktree to create, `--path <absolute>` names the worktree to remove, and `--trusted-folder <absolute>` is also accepted. The outcome is `refused`, `failed`, or `started`. |
| `claude import-conversations <exportPath>` | <Undocumented /> | A hidden command that archives an export, with `--cwd` and `--dry-run`. |

:::note[Hidden Commands]
The `edit-*` commands and `design-login` read one JSON edit from stdin.
Their own text says they serve the VS Code extension. Do not build scripts on them.
:::

### `ultrareview` Eval Flags

Since `2.1.319`, `claude ultrareview` has three hidden options, and `2.1.323` adds a fourth, `--review-md`. They belong to an eval mode that the gate `tengu_review_bughunter_config.eval_enabled` controls. Without the gate, each option fails with `error: unknown option` and exit code 1.[^eval-flags] The official docs do not list these flags ([Run Ultrareview Non-Interactively](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively)).

| Flag | Status | What it does | Default |
| --- | --- | --- | --- |
| `--list <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Reads the pull requests to review from a file. Do not give pull requests as arguments with it. `-` is refused, so the list must be in a file. | Off |
| `--output <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sets where the report goes. Claude Code refuses a place inside its own folder, where old files may be removed. | A file in the program's own folder |
| `--max-cost <dollars>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sets a limit on cost, in US dollars. The value must be a number above 0. | Off |
| `--review-md <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sends the file as a draft `REVIEW.md` in place of the `REVIEW.md` of each repository. Claude Code refuses a file that is not UTF-8 text or is blank, with `Nothing was started.` Without the gate, it prints `error: unknown option '--review-md'`.[^review-md] | Off |

Claude Code also refuses the launch inside a Claude Code session when `CLAUDE_CODE_ULTRAREVIEW_REVIEW_MD_FILE` asks for a draft. Only a person may send a draft `REVIEW.md`.[^review-md-session]

In eval mode, `--json`, `--timeout`, `--post`, `--no-post`, and `--trust-workspace` are refused with `--json, --timeout, --post, --no-post and --trust-workspace don't work with eval. Leave them out.` Every refusal ends with `Nothing was started.`

### `daemon` Subcommands

`claude daemon --help` lists `run [json-path]`, `status`, `logs`, `uninstall`, and `stop` (with `--any` and `--keep-workers`), and the options `--json-path <p>` (default `~/.claude/daemon.json`) and `--log-file <p>` (default `~/.claude/daemon.log`).[^daemon-help] The help text says: "Service install is disabled in this version — the daemon runs on demand and exits when the last client disconnects."

- With no subcommand, the daemon opens the hub on a terminal, and runs in the foreground (`run`) when stdin is not a terminal.
- `log` is an alias of `logs`. Both options also take the `--option=value` form.
- A word that is not a subcommand and holds `.`, `/`, `\`, or `~` is read as `run <json-path>`. Any other word prints `unknown subcommand: <word>`, then the help text, and exits with code 1.[^daemon-unknown]
- The parser also knows `install`, `start`, `restart`, `list`, `scheduled`, `remote-control`, and `hub`, which the help text does not list. Each of these exits with code 1 when you run it without a terminal:[^daemon-probe]

| Command | Status | Result (exit code 1 in each case) |
| --- | --- | --- |
| `claude daemon install`, `start`, `restart` | <Undocumented /> <Deprecated note="Service install is disabled" /> | ``claude daemon <name>` is disabled in this version — the daemon runs on demand and exits when the last client disconnects.`` |
| `claude daemon list [--json]` | <Undocumented /> | `'daemon list' is not available in this environment.` |
| `claude daemon scheduled`, `remote-control` | <Undocumented /> | `'daemon remote-control' is not available in this environment.` `scheduled` uses the same handler.[^daemon-remote] |
| `claude daemon hub` | <Undocumented /> | Opens the interactive hub. It needs a terminal on stdin and stdout. With no daemon and no terminal, it prints the status report (`not running`, then the socket folder, `control.sock`, the worker count, `roster.json`, and `daemon.log`). |

`--origin <service|transient|foreground>` and `--spawned-by <json>` are internal options. Claude Code passes them when it starts the daemon on demand (`daemon run --origin transient --spawned-by {"label","cwd","pid"}`), and `claude daemon status` shows them as the start reason.

### `gateway` Role and Retention Options

Since `2.1.317` and `2.1.318`, the gateway YAML file takes two more options: `upstreams[].assume_role` and `admin.identity_retention_days`.[^gw-roles] The gateway builds the STS address from the region (`https://sts.<region>.amazonaws.com`) and has no setting for it.[^sts-address]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `upstreams[].assume_role.role_arn` | <Undocumented /> | Makes the gateway call `sts:AssumeRole` for this role and sign the upstream request with the assumed keys. It works on `bedrock` and `mantle` upstreams. The value must match `arn:aws:iam::<12 digits>:role/<name>` (also `arn:aws-us-gov`). | Off: the upstream is signed with the source keys |
| `upstreams[].assume_role.external_id` | <Undocumented /> | Sends this value as the external ID of the call. It needs 2 to 1224 characters from letters, digits, and `_+=,.@:/-`. | No external ID |
| `upstreams[].assume_role.session_name` | <Undocumented /> | `sub` or `email` names the session after that claim of the user token, so each developer has a session in AWS. | One shared session, `claude-apps-gateway` |
| `admin.identity_retention_days` | <Undocumented /> | Sets how many days the gateway keeps the email, name, and groups it stores for each user, and the daily group records. The value must be a whole number above 0. | `90` |

With `assume_role`, the gateway makes one `sts:AssumeRole` call with the role, the external ID, and the session name. It signs that call with the source key and signs the upstream call with the assumed key. The session name is `claude-apps-gateway` (shared), the `sub` claim, or the `email` claim. Without `assume_role`, there is no STS call and the upstream call uses the source key.[^assume-run]

When STS fails, the gateway does not fall back to its own keys. It returns status `502` and makes no upstream call. The log reads `upstream bedrock: sts:AssumeRole on <role> for the shared session failed (AccessDenied: ...); request not sent; the gateway's own credentials were not used instead.` With the proxy to STS closed, the same line shows `Error: connect ECONNREFUSED`. A `session_name` run names the session as `sub=<sub>` in the line.[^assume-fail]

The gateway refuses these values when it starts, exits with code 1, and prints the schema issue:[^assume-refuse]

- `must be an IAM role ARN (arn:aws:iam::<account>:role/<name>)` for a `role_arn` that does not match.
- `must be 2 to 1224 characters of letters, digits and _+=,.@:/-` for an `external_id` that does not match.
- `Invalid enum value. Expected 'email' | 'sub', received 'name'` for another `session_name`.
- `assume_role needs SigV4 source credentials (access keys or the ambient AWS chain, auth: {}); aws_bearer_token cannot call sts:AssumeRole` with `auth.aws_bearer_token`.
- `Unrecognized key(s) in object: 'assume_role'` on an `anthropic` upstream.
- `Number must be greater than 0` for `identity_retention_days: 0`, and `Expected number, received nan` for a text value.

A `mantle` upstream with `session_name` next to a `bedrock` upstream without one starts, and the log warns `upstream 'bedrock' sets assume_role.session_name for per-developer AWS attribution, but upstream 'm' sets none, so the requests 'm' serves are not attributed per developer`.[^assume-mixed]

The gateway deletes identity records older than `identity_retention_days` when it starts. With the default, a 100-day record goes and a 60-day record stays. With `30`, both go. The gateway also deletes a group record older than the limit and a group record of a user with no stored identity, and keeps the group records of a stored user that are inside the limit.[^retention-run]

### `gateway` Pooled Budget, Sign-In Notice, and Blocked Message Options

Since `2.1.319`, the gateway YAML file takes four more options: `login_notice`, `admin.blocked_message`, `admin.pooled_conflict_rule`, and `admin.pooled_priority_order`.[^pooled-notes] On `2.1.316`, the gateway does not start with these options. It exits with code 1 and prints `Unrecognized key(s) in object: 'login_notice'`. With all four options, it also names `pooled_conflict_rule` and `pooled_priority_order`.[^pooled-216]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `admin.pooled_conflict_rule` | <Undocumented /> | Decides which pooled group budget pays first for a developer in several groups. `default_order` or `priority_list`. With `priority_list`, the gateway uses `admin.pooled_priority_order`.[^pooled-order-code] | Not set: the default order |
| `admin.pooled_priority_order` | <Undocumented /> | The group names that pay first, in order. Up to 50 names, each non-empty, none twice. It has an effect only with `pooled_conflict_rule: priority_list`. | Not set |
| `login_notice` | <Undocumented /> | A top-level plain-text message of 1 to 500 characters. The gateway puts it in the `device_authorization` response and on its browser verification page. The `/login` gateway sign-in screen of the program shows it as `Notice from <host>:` and the text. | Not set: no message |
| `admin.blocked_message` | <Documented /> | Appended after ` · ` to the `429 billing_error` of a developer who reached a spend limit. The program removes a final `.` from the default message first. | Not set: only the default message |

This example sets all four options and `identity_retention_days`. `login_notice` needs `oidc`, because without it no one can sign in. Add `listen`, `upstreams`, and the database to run it.[^example-run]

```yaml
oidc:
  issuer: http://127.0.0.1:<port>
  client_id: probe-client
  client_secret: probe-client-secret
login_notice: "Call IT <i>now</i> & ask for a code"
admin:
  identity_retention_days: 90
  blocked_message: "request an increase at https://go.probe.invalid/claude-limits"
  pooled_conflict_rule: priority_list
  pooled_priority_order: [a, b]
```

The [official page](https://code.claude.com/docs/en/claude-apps-gateway-config#admin) names `admin.blocked_message` ("Appended verbatim to the `429 billing_error` a blocked developer sees") and has no text for the other three options.

The gateway refuses a bad pooled setting when it starts, and warns for an order it ignores. A repeated group, `priority_list` with no order, and an unknown rule exit with code 1 and print `admin.pooled_priority_order lists a group more than once`, `admin.pooled_conflict_rule: priority_list needs at least one group in admin.pooled_priority_order`, and `Invalid enum value. Expected 'default_order' | 'priority_list', received 'other'`. An order without `priority_list` listens and logs `warn admin.pooled_priority_order is ignored unless admin.pooled_conflict_rule is priority_list`. A valid pair logs no line about either option.[^pooled-run]

When a request would use up the pooled budget of a group, the developer sees `This request exceeds your group's budget. Ask your organization's admins to raise it, or try again after it resets on <Month> <day> at <HH:MM> UTC.`[^pooled-reset]

The gateway serves `login_notice` in the `device_authorization` response and on the verification page, and the page escapes it. On a gateway with `oidc`, `POST /oauth/device_authorization` returns `200` with a `login_notice` key equal to `Call IT <i>now</i> & ask for a code`. `GET /device` returns `200` with the text escaped (`&lt;i&gt;now&lt;/i&gt; &amp;`) and not as raw HTML. Without the option, the response has no `login_notice` key and the page has no text. A value of 501 characters is refused at start with `String must contain at most 500 character(s)`. Without `oidc`, the gateway listens and warns `login_notice (no one can sign in, so no one sees it)`.[^notice-run]

The `/login` gateway sign-in screen shows the `login_notice` of the `device_authorization` response. On `2.1.319`, the screen shows the code, the link, then `Notice from 127.0.0.1:` and `Call IT now and ask for a code`, then `Waiting for sign-in to complete in your browser…`. Without the key, the screen has no notice line. On `2.1.316`, the screen has no notice line with the key either.[^notice-screen]

`admin.blocked_message` is appended to the spend-limit error. With an organization limit of `0`, the request gets `429`, error type `billing_error`, and no call reaches the upstream. The message is `spend limit reached · request an increase at https://go.probe.invalid/claude-limits` with the option and `spend limit reached` without it. A limit of `0` has no reset date, so the `resets Dec 1` form does not show.[^blocked-run]

### `gateway` Policy Mode and Upstream Endpoint Changes

The `2.1.321` changes follow.[^v321]

| Item | Status | What it does |
| --- | --- | --- |
| `managed.policy_mode: layered` | <Documented /> | Every managed policy that matches a developer applies, each merged over the ones listed below it. Managed MCP servers now add up over every matching policy, and a catch-all policy (`match: {}`) counts as one. A gateway that is on `layered` serves more MCP servers after the upgrade. The gateway warns when a catch-all is not the last entry, because the policies after it never match.[^layered] |
| `base_url` on an upstream, and `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_VERTEX_BASE_URL`, `ANTHROPIC_FOUNDRY_BASE_URL` | <Documented /> | The gateway does not read these variables from its own environment. Model requests to each `bedrock`, `vertex`, or `foundry` upstream that has no `base_url` go to the provider's default endpoint. At start, the gateway warns that it does not read the variable, and says to copy the URL into `base_url` on each such upstream, or remove the variable.[^base-url] |

### `claude auth status` Sign-In Date

Since `2.1.318`, `claude auth status` has a `loginExpiresAt` key in its JSON, and a `Sign-in ends:` line with `--text`.
The `2.1.318` release notes say: "Added the date a stored claude.ai sign-in ends to `claude auth status` (`loginExpiresAt`) and to `claude -p` JSON results (`credential_expires_at`)".[^v318] The [stream JSON page](../../extend/headless/stream-json.md#field-new-in-21318) has the second field.
Status: <Undocumented /> on the official pages.

| Case | `loginExpiresAt` | Text Output |
| --- | --- | --- |
| Stored claude.ai login with a refresh end date | The end date as an ISO string | `Sign-in ends: between <3 days before> and <date> (<ISO string>)` |
| No login, no stored refresh date, Bedrock provider, stored date before 2025-01-01, stored date over 10 years ahead, or an access token ending over 3 days after the refresh token | `null` | No line |

The key is always in the JSON, so a script can test for `null`.
With `claude -p`, Claude Code also writes `Warning: this sign-in ends between <date> and <date> (in 2 days at the earliest). Renewing it does not move those dates. Run claude auth login before then, or use claude setup-token for unattended jobs.` to stderr when the end is less than 10 days away.

The key and the texts come from the program.[^expiry-source]

`status` prints the stored refresh end date in `loginExpiresAt`, and `null` when Claude Code cannot vouch for it. The key equals `2030-01-15T12:00:00.000Z` for the full login, and the text line is `Sign-in ends: between 2030-01-12 and 2030-01-15 (2030-01-15T12:00:00.000Z)`. Each case of the third table row gives `null` and no text line. The no-login run exits with code 1.[^expiry-run]
A stored date in the past (2025-06-01) prints `Sign-in may have ended: between ... and ...`. A refresh end in 5 days prints the stderr warning above with `in 2 days at the earliest`. The 2030 runs print no warning.[^expiry-past]

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | Update and install. `claude update` or `claude install` failed. | Claude Code could not fetch the latest version from the npm registry. `claude update` prints `Failed to check for updates` and exits with code 1 when no latest version came back. The channel or version is not valid: a target that looks like a version but is not well-formed semver, such as `claude install 1.2.3-a_b`, prints `Invalid version string from argument: not a well-formed version (9 characters)` and exits with code 1 .[^install-version] A checksum does not match. The executable is in use. Another instance is updating. Permissions are missing. Claude Code could not restore the executable after a failed update. |
| Various | <Undocumented /> | Background sessions and daemon. A background session, `claude attach`, `claude respawn`, or daemon step failed or printed a notice. | The service is not installed or did not start. `--bg` ignores `--session-id`. A session cannot start, wake, or attach. The terminal host died. A daemon lock or roster could not be read or written. The background manager failed to start. |
| Various | <Undocumented /> | `claude gateway` server configuration. `claude gateway` refused its configuration or a sign-in request. | A `cri.` or `oidc.` setting is not valid. A loopback URL is in use without `CLAUDE_GATEWAY_ALLOW_LOOPBACK`. An ID token is missing a claim. The email domain or group is not allowed. An upstream credential or role could not be used. The store (`store.postgres_url`) is not readable. A bedrock or mantle upstream sets `assume_role` and an `auth.aws_bearer_token`. Claude Code refuses this when it reads the config: `upstream 'NAME': assume_role needs SigV4 source credentials (access keys or the ambient AWS chain, auth: {}); aws_bearer_token cannot call sts:AssumeRole`. The run exits with code 1 and lists this issue with the other schema issues.[^gw-bearer] |
| `Logout failed: Your account or API key may still be in the config file. Run claude auth logout.` | <Undocumented /> | `claude auth logout` printed this text and exited with code 1. | The config file `.claude.json` could not be cleared. In the probe, `.claude.json` was a folder. A read-only config folder (`chmod 555`) did not cause it: the run exited with code 0 and printed nothing.[^logout] |
| `Logged out on this computer, but Anthropic didn't confirm the login was revoked.` | <Undocumented /> | `claude auth logout` and `/logout` cleared the local login, but the revoke request got no confirmation.[^logout-revoke] | Since `2.1.326`, Claude Code asks again when the first reply is a server error or a network failure. The text goes on: the login may still work until you revoke it at a page that the text names. |
| `Warning: the claude.ai login on this machine has ended.` | <Undocumented /> | Print mode warned that the claude.ai login has ended and that the run uses the sign-in from `ant auth login` instead. | The warning goes to stderr. It says the usage is billed to the named organization. It tells you to run `claude auth login` to sign in again. In `2.1.323` it adds that `claude auth logout` stops the warning and removes the ended login and the other saved credentials, such as MCP server logins and plugin secrets. `2.1.322` has the warning too, and its text says only "or `claude auth logout` to remove the ended login and keep that sign-in without this warning".[^login-ended] |
| `Stopping. Any review that has launched goes on in the cloud and is billed.` | <Undocumented /> | A hidden `claude ultrareview eval` run was stopped by a signal. | Claude Code prints this text to stderr when `claude ultrareview eval` gets SIGINT or SIGTERM (exit codes 130 and 143). The `eval` form needs the feature config `tengu_review_bughunter_config` (`enabled` and `eval_enabled`), a policy, and a first-party login.[^stopping]. The official docs do not list `eval`, but they give the same rule for the public subcommand: exit code 130 on Ctrl-C, and a review that has started "may still be running in the cloud" and uses a free run or bills ([Run Ultrareview Non-Interactively](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively), [Pricing and Free Runs](https://code.claude.com/docs/en/ultrareview#pricing-and-free-runs)). Six gate checks that started nothing all printed `error: unknown option '--output'`.[^stopping-live] |
| `Failed to read environment secret file` | <Undocumented /> | `claude self-hosted-runner` could not read the file of `--environment-secret-file`. | The text names the path and the system error. Without the file, `claude self-hosted-runner --api-url http://127.0.0.1:9 --environment-secret-file ~/missing` prints `error: Failed to read environment secret file <path> (ENOENT: no such file or directory, open '<path>')` and exits with code 2.[^secret-missing] |
| Various | <Undocumented /> | `decode-token`. `decode-token` could not read or check a token. | A flag is unknown or has no value. The token is not a JWT with three base64url segments. The token has no `exp` claim. The token is expired or not yet valid. The token uses an `alg` other than ES256 or RS256. The JWKS could not be fetched. The JWKS has no key with that `kid`. The signature check failed. |
| Various | <Undocumented /> | Conversation import. Claude Code refused a conversation import or export file. | The file is over the size limit. The file is not valid JSON. The manifest does not match after the import. |

## Related Pages

- [CLI Overview](index.md)
- [All Flags](flags.md)
- [Auto Mode](../permissions/auto-mode.md) covers the `claude auto-mode` commands in depth.

## Sources

[^cmd-help]: The text of `claude <command> --help` in `2.1.326`.
[^rm]: The program, `chunk-ph0kyf9w.js:69249`.
[^gateway-json]: The program.
[^purge]: The program, `chunk-mw30c4jj.js:1529` in `2.1.323`, with the same options in `claude purge --help`.
[^trust-cmd]: The program, `chunk-2jz0wx1x.js:37057`.
[^worktree-hook]: The program, `chunk-sqnqta3y.js:646`.
[^eval-flags]: The program, the option definitions with `hideHelp()` and the eval handler `ultrareviewEvalHandler`. Probe cases `print.cli319.ultrareview-max-cost`, `-list`, and `-output`. A build without the gate refuses the option. Result: exit 1 with `error: unknown option '--max-cost'`, `'--list'`, and `'--output'`.
[^review-md]: The program, `chunk-2jz0wx1x.js:58523` and `chunk-kamh1y2p.js:36492`.
[^review-md-session]: The program, `chunk-dcft79a2.js:30478`.
[^daemon-help]: The program, help text in `2.1.326` and argument parser, `chunk-8009tpd5.js`, near offset 75628.
[^daemon-unknown]: Probe case `cli321.daemon-unknown`.
[^daemon-probe]: Probe group `cli321`.
[^daemon-remote]: Probe case `cli321.daemon-remote-control`. `scheduled` was not run.
[^gw-roles]: [`2.1.317` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.317) and [`2.1.318` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318). The program, `chunk-xqw0kbdk.js:57831` (`assume_role`) and `chunk-xqw0kbdk.js:58577` (`identity_retention_days`). Probe cases `print.api319.gateway.assume-role-*` and `print.api319.gateway.identity-retention-*` start `claude gateway --config` on a temporary Postgres, a stub upstream, and a stub of STS.
[^sts-address]: The program, `chunk-xqw0kbdk.js:55441`. The probe reaches the STS stub through a local CONNECT proxy with a throw-away CA.
[^assume-run]: Probe cases `assume-role-sts`, `-session-sub`, `-session-email`, and `assume-role-none`. Status `200`. The STS stub got one call with the `RoleArn`, `ExternalId` `probe-external-id`, and `RoleSessionName` `claude-apps-gateway` (shared), `u1` (the `sub` claim), or `u@example.com` (the `email` claim). The STS call was signed with the source key. The upstream call was signed with the assumed key. Without `assume_role` there was no STS call and the upstream call was signed with the source key.
[^assume-fail]: Probe cases `assume-role-sts-denied` and `assume-role-sts-down`: status `502`, zero upstream calls.
[^assume-refuse]: Probe cases `assume-role-bad-arn`, `-bad-external-id`, `-bad-session-name`, `-bearer-token`, `-anthropic`, `identity-retention-zero`, and `identity-retention-text`.
[^assume-mixed]: Probe case `assume-role-mixed-session`.
[^retention-run]: Probe cases `identity-retention-default`, `-90`, and `-30`. The first start stored one user and one group record for today. I then moved the user and its group record to 60 days old. I added a user and a group record that are 100 days old, a 1-day group record for the same user, and a 1-day group record for a user with no stored identity. The next start with `90` (the default, or set) kept the 60-day user, deleted the 100-day user, deleted the 100-day group record, and deleted the 1-day group record of the user with no stored identity. The 60-day and 1-day group records of the stored user stayed. The next start with `30` deleted every user and group record. On `2.1.316`, the first start made no `principal_groups` table, so the cases stop there.
[^pooled-notes]: [`2.1.319` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.319). The program, `chunk-xqw0kbdk.js:58180` (`login_notice`) and `chunk-xqw0kbdk.js:58574` to `58606` (`admin.blocked_message`, `admin.pooled_conflict_rule`, `admin.pooled_priority_order`). Probe cases `print.api319.gateway.pooled-*`, `print.api319.gateway.login-notice-*`, and `print.api319.gateway.blocked-message-*` start `claude gateway --config` on a temporary Postgres and a stub upstream. The `login-notice-served` cases add a stub of the identity provider that serves only the discovery document.
[^pooled-216]: Probe cases `login-notice-served` and `example-all-four`.
[^pooled-reset]: The program, `chunk-ajpqe291.js:60842-60844`. [2.1.326 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^pooled-order-code]: The program, `chunk-xqw0kbdk.js:61201`.
[^example-run]: Probe case `print.api319.gateway.example-all-four`. Its `device_authorization` response has the `login_notice` text.
[^pooled-run]: Probe cases `pooled-order-duplicate`, `pooled-priority-list-empty`, `pooled-rule-unknown`, `pooled-order-ignored`, and `pooled-order-with-rule`. The runs cover the config check only: the stub upstream reports too little use to empty a pooled budget, so the order of payment is read from the code, `chunk-xqw0kbdk.js:61201`, and not run.
[^notice-run]: Probe cases `login-notice-served`, `login-notice-unset`, `login-notice-too-long`, and `login-notice-no-oidc`. These runs do not open the sign-in screen of the program.
[^notice-screen]: Pty cases `cli319.gateway-login-notice.set` and `.unset`. A stand-in gateway on `127.0.0.1` answered discovery and `device_authorization`, and kept the token poll pending. User settings had `forceLoginMethod: "gateway"` and `forceLoginGatewayUrl`. The run typed `/login`, pressed Enter on the gateway URL, and chose "Yes, trust this gateway" (the prompt starts on "No, cancel login"). The program sent `GET /.well-known/oauth-authorization-server`, then `POST /oauth/device_authorization`, and opened `/device` with the `BROWSER` command.
[^blocked-run]: Probe cases `blocked-message-set` and `blocked-message-unset`.
[^v321]: [`2.1.321` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321). The program.
[^layered]: The program, `chunk-xqw0kbdk.js:1426224`.
[^base-url]: The program, `chunk-xqw0kbdk.js:1565691`.
[^v318]: [`2.1.318` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318).
[^expiry-source]: The program: the key in `chunk-wy6zmjgd.js` (`loginExpiresAt: ... credential_expires_at ?? null`), the texts and the 10 day limit in `chunk-x4fdscgs.js`.
[^expiry-run]: `bun run release:probe:print -- --from 2.1.319 --to 2.1.319 --only notes319.login-expiry` (cases `status-json`, `status-text`, `no-login-status`, `no-refresh-date`, `access-outlives-refresh`, `third-party-provider`, `before-2025`, `over-ten-years`, `past`, `soon-print`), with a fake `.credentials.json` in a temporary `CLAUDE_CONFIG_DIR`, and the first-party base URL assumed.
[^expiry-past]: Probe cases `past` and `soon-print`.
[^install-version]: Probe case `print.err319.install-version-underscore`.
[^gw-bearer]: Probe case `print.err319.gateway-assume-role-bearer`.
[^logout]: Probe cases `print.err319.auth-logout-dir` and `print.err319.auth-logout-unwritable`.
[^login-ended]: The program, `chunk-xqxdp2xw.js:1486` in `2.1.323` and `chunk-xqxdp2xw.js:1219` in `2.1.322`.
[^stopping]: The program, read site `chunk-kamh1y2p.js`, search `Stopping. Any review`.
[^stopping-live]: This site does not run ultrareview live, because each run can bill the account: the repo owner chose the official docs and community reports as the source for it. One gate check used the live login (case `live.err319`, before this rule). Five used cached features, a fake OAuth login, `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL`, and `CLAUDE_INTERNAL_FC_OVERRIDES`.
[^secret-missing]: Probe case `print.err319.runner-secret-file-missing`.
[^logout-revoke]: The program, `chunk-racqty5b.js:168` and `chunk-racqty5b.js:316-336`. [2.1.326 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^purge-pipe]: The program, `chunk-tjf38bfw.js:820-830`. [2.1.325 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.325).
