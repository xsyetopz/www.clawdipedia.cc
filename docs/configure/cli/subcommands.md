---
title: Subcommands
description: Every claude subcommand in 2.1.321, including background sessions, auth, plugins, and the hidden commands.
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

Source: the text of `claude <command> --help` in `2.1.314`.

| Command | Status | What it does |
| --- | --- | --- |
| `claude agents` | <Documented /> | Opens the agent view to watch and start background sessions. `--json` prints the active sessions. With `--json`, `--all` adds completed background sessions. With `--json`, `--cwd <path>` keeps only the sessions started under that path. These options set the defaults of the sessions it dispatches: `--model`, `--effort`, `--agent`, `--permission-mode`, `--add-dir`, `--mcp-config`, `--strict-mcp-config`, `--plugin-dir`, `--settings`, `--setting-sources`, `--restricted`, `--dangerously-skip-permissions` (an alias for `--permission-mode bypassPermissions`), and `--allow-dangerously-skip-permissions`. The hidden `--inherit-permission-mode`, `--managed-settings`, and `--plugin-dir-no-mcp` also work. |
| `claude attach <id\|name>` | <Documented /> | Opens a background session. |
| `claude logs <id\|name>` | <Documented /> | Prints the recent output of a background session. |
| `claude stop <id>` (alias `kill`) | <Documented /> | Stops a background session and keeps the conversation. |
| `claude respawn <id>` or `--all` | <Documented /> | Restarts a background session, or all of them, so it uses the current Claude Code binary. |
| `claude rm <id>` | <Documented /> | Deletes a background session and its worktree when that is safe. Unlike `stop`, it works on a session that already exited. In `2.1.321` it takes `--discard-unpushed <commit>@<worktree-id>` (also discards the unpushed commits and uncommitted changes of the worktree while it is still at that commit) and `--force-remove-worktree <worktree-id>` (deletes the worktree folder when the `WorktreeRemove` hook or git could not; the repository must list it as a worktree, with no uncommitted changes to tracked files; the branch stays). For both, pass the value that an earlier `claude rm <id>` printed. |
| `claude daemon [run\|status\|logs\|stop\|uninstall]` | <Documented /> | Controls the supervisor of background sessions, which the root help does not list. See [`daemon` Subcommands](#daemon-subcommands). |
| `claude auth login\|logout\|status` | <Documented /> | Signs you in and out. `status` exits with 1 when you are not signed in. `login` takes `--claudeai` (the default), `--console` (API usage billing), `--email <email>` (fills in the login page), and `--sso`. `status` prints JSON by default (`--json`). With `--text`, it prints text. `login` also has a hidden option, `--gateway-json`, for a program that shows the Cloud gateway sign-in to a person. It writes its questions as JSON lines and reads the answers from stdin. It cannot be combined with `--console`, `--claudeai`, `--sso`, or `--email`. It reads the gateway from the settings of the machine. It checks in this order: a clash with the other login flags, a gateway in the settings, a terminal on stdin, and a Claude Code session. Each failure prints one line to standard error and exits with code 1. See the errors on [Auth Settings](../settings/auth.md#errors) (the program). |
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
| `claude purge [path]` | <Documented /> <Caution note="Deletes the state of a project" /> | Deletes the state of a project, with `--all`, `--dry-run`, `-i/--interactive` (asks before each item), and `-y/--yes`. Since `2.1.311`, the purge plan ends with "Purging deletes data only on this computer, not anything stored by Anthropic" (`chunk-dq6ghgb6.js:1478` in `2.1.311`; the same text is at `chunk-dq6ghgb6.js:38178` in `2.1.321`, with the same options in `claude purge --help`). |
| `claude remote-control` (alias `rc`) | <Documented /> | Lets you control local sessions from `claude.ai` or the mobile app. See [Remote Control Server](remote-control.md). |
| `claude ultrareview [target]` | <Documented /> | Starts a cloud review with many agents, with `--json`, `--post`, `--no-post` (the default), `--timeout`, and `--trust-workspace`. Since `2.1.309` it needs a trusted folder. It asks on a terminal. Without a terminal it may refuse, so scripts pass `--trust-workspace` after the target, or set `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1`. |
| `claude self-hosted-runner` | <Documented /> | Runs cloud sessions on your machine, and the root help does not list it. Subcommands: `orchestrator`, `setup`, `doctor`, and `decode-token`. See [Self-Hosted Runner](self-hosted-runner.md) for every option and error. |
| `claude sandbox` | <Undocumented /> | A hidden command with three subcommands for the Windows sandbox: `install` adds the sandbox user and network filters. It asks for elevation once. `status` prints the sandbox state and the Windows install state as one JSON line. `uninstall` removes them and lists what stays behind, with `--json`. |
| `claude edit-hook`, `edit-permission-rules`, `edit-memory-settings`, `edit-skill-overrides`, `edit-sandbox-settings`, `edit-chrome-settings`, `drop-worktree-registrations`, `design-login` | <Undocumented /> | Hidden commands that read one JSON edit from stdin with `--json`. Their text says they serve the VS Code extension. `design-login --status` reports whether design-system access is authorized and exits. |
| `claude apply-project-settings` | <Undocumented /> | A hidden command that shows how your user and project settings differ from what you accepted for cloud sessions on this computer. It lets you accept them. It needs a terminal. |
| `claude project` | <Undocumented /> <Deprecated note="Use claude purge" /> | A hidden command with one subcommand, `purge`. The program says that `claude project purge` is now `claude purge` and that the old name still works for now. |
| `claude import-conversations <exportPath>` | <Undocumented /> | A hidden command that archives an export, with `--cwd` and `--dry-run`. |

:::note[Hidden Commands]
The `edit-*` commands, `drop-worktree-registrations`, and `design-login` read one JSON edit from stdin.
Their own text says they serve the VS Code extension. Do not build scripts on them.
:::

### `ultrareview` Eval Flags

Since `2.1.319`, the program defines three hidden options on `claude ultrareview`. They belong to an eval mode that the gate `tengu_review_bughunter_config.eval_enabled` controls.
Source: the program (the option definitions with `hideHelp()`, and the eval handler `ultrareviewEvalHandler`).
The official docs do not list these flags ([Run Ultrareview Non-Interactively](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively)).
Run: case `print.cli319.ultrareview-max-cost`, `-list`, and `-output`. Hypothesis: a build without the gate refuses the option. Prediction: exit 1 and `error: unknown option`. Result: exit 1 with `error: unknown option '--max-cost'`, `'--list'`, and `'--output'`.

| Flag | Status | What it does | Default |
| --- | --- | --- | --- |
| `--list <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Reads the pull requests to review from a file. Do not give pull requests as arguments with it. `-` is refused, so the list must be in a file. | Off |
| `--output <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sets where the report goes. The program refuses a place inside its own folder, where old files may be removed. | A file in the program's own folder |
| `--max-cost <dollars>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sets a limit on cost, in US dollars. The value must be a number above 0. | Off |

In eval mode, `--json`, `--timeout`, `--post`, `--no-post`, and `--trust-workspace` are refused with `--json, --timeout, --post, --no-post and --trust-workspace don't work with eval. Leave them out.` Every refusal ends with `Nothing was started.`

### `daemon` Subcommands

`claude daemon --help` lists `run [json-path]`, `status`, `logs`, `uninstall`, and `stop` (with `--any` and `--keep-workers`), and the options `--json-path <p>` (default `~/.claude/daemon.json`) and `--log-file <p>` (default `~/.claude/daemon.log`). The help text says: "Service install is disabled in this version — the daemon runs on demand and exits when the last client disconnects."
Source: the program, in its help text in `2.1.321` and its argument parser (`chunk-k0rez7a5.js`, near offset 75628).

- With no subcommand, the daemon opens the hub on a terminal, and runs in the foreground (`run`) when stdin is not a terminal.
- `log` is an alias of `logs`. Both options also take the `--option=value` form.
- A word that is not a subcommand and holds `.`, `/`, `\`, or `~` is read as `run <json-path>`. Any other word prints `unknown subcommand: <word>`, then the help text, and exits with code 1 (case `cli321.daemon-unknown`).
- The parser also knows `install`, `start`, `restart`, `list`, `scheduled`, `remote-control`, and `hub`, which the help text does not list. The `cli321` probe ran each without a terminal:

| Command | Status | Result (exit code 1 in each case) |
| --- | --- | --- |
| `claude daemon install`, `start`, `restart` | <Undocumented /> <Deprecated note="Service install is disabled" /> | ``claude daemon <name>` is disabled in this version — the daemon runs on demand and exits when the last client disconnects.`` |
| `claude daemon list [--json]` | <Undocumented /> | `'daemon list' is not available in this environment.` |
| `claude daemon scheduled`, `remote-control` | <Undocumented /> | `'daemon remote-control' is not available in this environment.` (case `cli321.daemon-remote-control`). `scheduled` uses the same handler and was not run. |
| `claude daemon hub` | <Undocumented /> | Opens the interactive hub. It needs a terminal on stdin and stdout. With no daemon and no terminal, the run printed the status report (`not running`, then the socket folder, `control.sock`, the worker count, `roster.json`, and `daemon.log`). |

`--origin <service|transient|foreground>` and `--spawned-by <json>` are internal options. Claude Code passes them when it starts the daemon on demand (`daemon run --origin transient --spawned-by {"label","cwd","pid"}`), and `claude daemon status` shows them as the start reason.

### `gateway` Role and Retention Options

Since `2.1.317` and `2.1.318` ([2.1.317 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.317), [2.1.318 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.318)), the gateway YAML file takes two more options. Both are in the program: the schema is in `chunk-dbyxjq34.js:57824` (`assume_role`) and `chunk-dbyxjq34.js:58570` (`identity_retention_days`).
Runs: cases `print.api319.gateway.assume-role-*` and `print.api319.gateway.identity-retention-*`. They start `claude gateway --config` on a temporary Postgres, a stub upstream, and a stub of STS. The stub of STS is reached through a local CONNECT proxy with a throw-away CA, because the program builds the STS address from the region (`https://sts.<region>.amazonaws.com`, `chunk-dbyxjq34.js:55451`) and has no setting for it.

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `upstreams[].assume_role.role_arn` | <Undocumented /> | Makes the gateway call `sts:AssumeRole` for this role and sign the upstream request with the assumed keys. It works on `bedrock` and `mantle` upstreams. The value must match `arn:aws:iam::<12 digits>:role/<name>` (also `arn:aws-us-gov`). | Off: the upstream is signed with the source keys |
| `upstreams[].assume_role.external_id` | <Undocumented /> | Sends this value as the external ID of the call. It needs 2 to 1224 characters from letters, digits, and `_+=,.@:/-`. | No external ID |
| `upstreams[].assume_role.session_name` | <Undocumented /> | `sub` or `email` names the session after that claim of the user token, so each developer has a session in AWS. | One shared session, `claude-apps-gateway` |
| `admin.identity_retention_days` | <Undocumented /> | Sets how many days the gateway keeps the email, name, and groups it stores for each user, and the daily group records. The value must be a whole number above 0. | `90` |

Hypothesis: `assume_role` makes one `sts:AssumeRole` call and signs the request to the upstream with the assumed key. Prediction: one STS call with the role, the external ID, and the session name, signed with the source key; the upstream sees the assumed key.
Result (`assume-role-sts`, `-session-sub`, `-session-email`): status `200`. The STS stub got one call with the `RoleArn`, `ExternalId` `probe-external-id`, and `RoleSessionName` `claude-apps-gateway` (shared), `u1` (the `sub` claim), or `u@example.com` (the `email` claim). The STS call was signed with the source key. The upstream call was signed with the assumed key. Without `assume_role` (`assume-role-none`) there was no STS call and the upstream call was signed with the source key.

Hypothesis: when STS fails, the gateway does not fall back to its own keys. Prediction: status `502` and no call to the upstream.
Result (`assume-role-sts-denied`, `assume-role-sts-down`): status `502`, zero upstream calls. The log reads `upstream bedrock: sts:AssumeRole on <role> for the shared session failed (AccessDenied: ...); request not sent; the gateway's own credentials were not used instead.` With the proxy to STS closed, the same line shows `Error: connect ECONNREFUSED`. A `session_name` run names the session as `sub=<sub>` in the line.

The gateway refuses these values when it starts, exits with code 1, and prints the schema issue (cases `assume-role-bad-arn`, `-bad-external-id`, `-bad-session-name`, `-bearer-token`, `-anthropic`, `identity-retention-zero`, `identity-retention-text`):

- `must be an IAM role ARN (arn:aws:iam::<account>:role/<name>)` for a `role_arn` that does not match.
- `must be 2 to 1224 characters of letters, digits and _+=,.@:/-` for an `external_id` that does not match.
- `Invalid enum value. Expected 'email' | 'sub', received 'name'` for another `session_name`.
- `assume_role needs SigV4 source credentials (access keys or the ambient AWS chain, auth: {}); aws_bearer_token cannot call sts:AssumeRole` with `auth.aws_bearer_token`.
- `Unrecognized key(s) in object: 'assume_role'` on an `anthropic` upstream.
- `Number must be greater than 0` for `identity_retention_days: 0`, and `Expected number, received nan` for a text value.

A `mantle` upstream with `session_name` next to a `bedrock` upstream without one starts, and the log warns `upstream 'bedrock' sets assume_role.session_name for per-developer AWS attribution, but upstream 'm' sets none, so the requests 'm' serves are not attributed per developer` (case `assume-role-mixed-session`).

Hypothesis: the gateway deletes identity records older than `identity_retention_days` when it starts. Prediction: with the default, a 100-day record goes and a 60-day record stays; with `30`, both go.
Result (`identity-retention-default`, `-90`, `-30`): the first start stored one user and one group record for today. I then moved the user and its group record to 60 days old. I added a user and a group record that are 100 days old, a 1-day group record for the same user, and a 1-day group record for a user with no stored identity. The next start with `90` (the default, or set) kept the 60-day user, deleted the 100-day user, deleted the 100-day group record, and deleted the 1-day group record of the user with no stored identity. The 60-day and 1-day group records of the stored user stayed. The next start with `30` deleted every user and group record. On `2.1.316`, the first start made no `principal_groups` table, so the cases stop there.

### `gateway` Pooled Budget, Sign-In Notice, and Blocked Message Options

Since `2.1.319` ([2.1.319 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.319)), the gateway YAML file takes four more options. All are in the program: the schema is in `chunk-dbyxjq34.js:58173` (`login_notice`) and `chunk-dbyxjq34.js:58567` to `58606` (`admin.blocked_message`, `admin.pooled_conflict_rule`, `admin.pooled_priority_order`).
Runs: cases `print.api319.gateway.pooled-*`, `print.api319.gateway.login-notice-*`, and `print.api319.gateway.blocked-message-*`. They start `claude gateway --config` on a temporary Postgres and a stub upstream. The `login-notice-served` cases add a stub of the identity provider that serves only the discovery document.
On `2.1.316`, the gateway does not start with these options. It exits with code 1 and prints `Unrecognized key(s) in object: 'login_notice'` (`login-notice-served`). With all four options, it also names `pooled_conflict_rule` and `pooled_priority_order` (`example-all-four`).

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `admin.pooled_conflict_rule` | <Undocumented /> | Decides which pooled group budget pays first for a developer in several groups. `default_order` or `priority_list`. With `priority_list`, the gateway uses `admin.pooled_priority_order` (`chunk-dbyxjq34.js:61194`). | Not set: the default order |
| `admin.pooled_priority_order` | <Undocumented /> | The group names that pay first, in order. Up to 50 names, each non-empty, none twice. It has an effect only with `pooled_conflict_rule: priority_list`. | Not set |
| `login_notice` | <Undocumented /> | A top-level plain-text message of 1 to 500 characters. The gateway puts it in the `device_authorization` response and on its browser verification page. The `/login` gateway sign-in screen of the program shows it as `Notice from <host>:` and the text. | Not set: no message |
| `admin.blocked_message` | <Documented /> | Appended after ` · ` to the `429 billing_error` of a developer who reached a spend limit. The program removes a final `.` from the default message first. | Not set: only the default message |

Example: the case `print.api319.gateway.example-all-four` starts the gateway with these lines, and its `device_authorization` response has the `login_notice` text. The run adds `listen`, `upstreams`, and the database to them. `login_notice` needs `oidc`, because without it no one can sign in.

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

Hypothesis: the gateway refuses a bad pooled setting when it starts, and warns for an order it ignores. Prediction: exit code 1 with the schema text for a repeated group, for `priority_list` with no order, and for an unknown rule; a warning, with the gateway still listening, for an order without `priority_list`; no pooled line for a valid pair.
Result (`pooled-order-duplicate`, `pooled-priority-list-empty`, `pooled-rule-unknown`, `pooled-order-ignored`, `pooled-order-with-rule`): the first three exit with code 1 and print `admin.pooled_priority_order lists a group more than once`, `admin.pooled_conflict_rule: priority_list needs at least one group in admin.pooled_priority_order`, and `Invalid enum value. Expected 'default_order' | 'priority_list', received 'other'`. The fourth listens and logs `warn admin.pooled_priority_order is ignored unless admin.pooled_conflict_rule is priority_list`. The fifth listens and logs no line about either option. The runs cover the config check only: the stub upstream reports too little use to empty a pooled budget, so the order of payment is read from the code (`chunk-dbyxjq34.js:61194`) and not run.

Hypothesis: `login_notice` is served in the sign-in response and on the verification page, and the page escapes it. Prediction: the response has the text; the page has the text with the HTML characters escaped; without the option, neither has it.
Result (`login-notice-served`, `login-notice-unset`): on a gateway with `oidc`, `POST /oauth/device_authorization` returned `200` with a `login_notice` key equal to `Call IT <i>now</i> & ask for a code`. `GET /device` returned `200` with the text escaped (`&lt;i&gt;now&lt;/i&gt; &amp;`) and not as raw HTML. Without the option, the response has no `login_notice` key and the page has no text. A value of 501 characters is refused at start with `String must contain at most 500 character(s)` (`login-notice-too-long`). Without `oidc`, the gateway listens and warns `login_notice (no one can sign in, so no one sees it)` (`login-notice-no-oidc`). These runs do not open the sign-in screen of the program. The next run does.

Hypothesis: the `/login` gateway sign-in screen shows the `login_notice` of the `device_authorization` response. Prediction: with the key, the screen shows the text after the device code; without it, no text; `2.1.316` shows no text.
Result (pty cases `cli319.gateway-login-notice.set` and `.unset`): a stand-in gateway on `127.0.0.1` answered discovery and `device_authorization`, and kept the token poll pending. User settings had `forceLoginMethod: "gateway"` and `forceLoginGatewayUrl`. The run typed `/login`, pressed Enter on the gateway URL, and chose "Yes, trust this gateway" (the prompt starts on "No, cancel login"). The program sent `GET /.well-known/oauth-authorization-server`, then `POST /oauth/device_authorization`, and opened `/device` with the `BROWSER` command. On `2.1.319`, the screen showed the code, the link, then `Notice from 127.0.0.1:` and `Call IT now and ask for a code`, then `Waiting for sign-in to complete in your browser…`. Without the key, the screen had no notice line. On `2.1.316`, the screen had no notice line with the key either.

Hypothesis: `admin.blocked_message` is appended to the spend-limit error. Prediction: `429` with `spend limit reached · <message>`; without the option, `spend limit reached`.
Result (`blocked-message-set`, `blocked-message-unset`): with an organization limit of `0`, the request got `429`, error type `billing_error`, and no call reached the upstream. The message was `spend limit reached · request an increase at https://go.probe.invalid/claude-limits` with the option and `spend limit reached` without it. A limit of `0` has no reset date, so the run does not show the `resets Dec 1` form.

### `gateway` Policy Mode and Upstream Endpoint Changes

Source: the [2.1.321 notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.321) and the program.

| Item | Status | What it does |
| --- | --- | --- |
| `managed.policy_mode: layered` | <Documented /> | Every managed policy that matches a developer applies, each merged over the ones listed below it. Managed MCP servers now add up over every matching policy, and a catch-all policy (`match: {}`) counts as one. A gateway that is on `layered` serves more MCP servers after the upgrade. The program warns when a catch-all is not the last entry, because the policies after it never match (`chunk-dbyxjq34.js:1425771`). |
| `base_url` on an upstream, and `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_VERTEX_BASE_URL`, `ANTHROPIC_FOUNDRY_BASE_URL` | <Documented /> | The gateway does not read these variables from its own environment. Model requests to each `bedrock`, `vertex`, or `foundry` upstream that has no `base_url` go to the provider's default endpoint. At start, the gateway warns that it does not read the variable, and says to copy the URL into `base_url` on each such upstream, or remove the variable (`chunk-dbyxjq34.js:1563405`). |

### `claude auth status` Sign-In Date

Since `2.1.318`, `claude auth status` has a `loginExpiresAt` key in its JSON, and a `Sign-in ends:` line with `--text`.
The `2.1.318` release notes say: "Added the date a stored claude.ai sign-in ends to `claude auth status` (`loginExpiresAt`) and to `claude -p` JSON results (`credential_expires_at`)". The [stream JSON page](../../extend/headless/stream-json.md#field-new-in-21318) has the second field.
Status: <Undocumented /> on the official pages.

| Case | `loginExpiresAt` | Text Output |
| --- | --- | --- |
| Stored claude.ai login with a refresh end date | The end date as an ISO string | `Sign-in ends: between <3 days before> and <date> (<ISO string>)` |
| No login, no stored refresh date, Bedrock provider, stored date before 2025-01-01, stored date over 10 years ahead, or an access token ending over 3 days after the refresh token | `null` | No line |

The key is always in the JSON, so a script can test for `null`.
With `claude -p`, the program also writes `Warning: this sign-in ends between <date> and <date> (in 2 days at the earliest). Renewing it does not move those dates. Run claude auth login before then, or use claude setup-token for unattended jobs.` to stderr when the end is less than 10 days away.

**Source:** the program: the key in `chunk-e9px5knf.js` (`loginExpiresAt: ... credential_expires_at ?? null`), the texts and the 10 day limit in `chunk-cs3pvamd.js`.

**Runs:** `bun run release:probe:print -- --from 2.1.319 --to 2.1.319 --only notes319.login-expiry` (cases `status-json`, `status-text`, `no-login-status`, `no-refresh-date`, `access-outlives-refresh`, `third-party-provider`, `before-2025`, `over-ten-years`, `past`, `soon-print`).

**FAFO:**

- Hypothesis: `status` prints the stored refresh end date in `loginExpiresAt`, and `null` when the program cannot vouch for it.
  Prediction: the key equals `2030-01-15T12:00:00.000Z` for the full login, and is `null` for each case in the third table row.
  Command: the cases above, with a fake `.credentials.json` in a temporary `CLAUDE_CONFIG_DIR`, and the first-party base URL assumed.
  Result: the key equalled the stored date; the text line was `Sign-in ends: between 2030-01-12 and 2030-01-15 (2030-01-15T12:00:00.000Z)`. Each case of the third row gave `null` and no text line. The no-login run exited with code 1.
- The `past` case (2025-06-01) printed `Sign-in may have ended: between ... and ...`. The `soon-print` case (refresh end in 5 days) printed the stderr warning above with `in 2 days at the earliest`. The 2030 runs printed no warning.

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | **Update and install.** `claude update` or `claude install` failed. | Claude Code could not fetch the latest version from the npm registry. `claude update` prints `Failed to check for updates` and exits with code 1 when no latest version came back. The channel or version is not valid: a target that looks like a version but is not well-formed semver, such as `claude install 1.2.3-a_b`, prints `Invalid version string from argument: not a well-formed version (9 characters)` and exits with code 1 (case `print.err319.install-version-underscore`). A checksum does not match. The executable is in use. Another instance is updating. Permissions are missing. Claude Code could not restore the executable after a failed update. |
| Various | <Undocumented /> | **Background sessions and daemon.** A background session, `claude attach`, `claude respawn`, or daemon step failed or printed a notice. | The service is not installed or did not start. `--bg` ignores `--session-id`. A session cannot start, wake, or attach. The terminal host died. A daemon lock or roster could not be read or written. The background manager failed to start. |
| Various | <Undocumented /> | **`claude gateway` server configuration.** `claude gateway` refused its configuration or a sign-in request. | A `cri.` or `oidc.` setting is not valid. A loopback URL is in use without `CLAUDE_GATEWAY_ALLOW_LOOPBACK`. An ID token is missing a claim. The email domain or group is not allowed. An upstream credential or role could not be used. The store (`store.postgres_url`) is not readable. A bedrock or mantle upstream sets `assume_role` and an `auth.aws_bearer_token`. The program refuses this when it reads the config: `upstream 'NAME': assume_role needs SigV4 source credentials (access keys or the ambient AWS chain, auth: {}); aws_bearer_token cannot call sts:AssumeRole`. The run exits with code 1 and lists this issue with the other schema issues. Probe case `print.err319.gateway-assume-role-bearer`. |
| `Logout failed: Your account or API key may still be in the config file. Run claude auth logout.` | <Undocumented /> | `claude auth logout` printed this text and exited with code 1. | The config file `.claude.json` could not be cleared. In the probe, `.claude.json` was a folder. A read-only config folder (`chmod 555`) did not cause it: the run exited with code 0 and printed nothing. Probe cases `print.err319.auth-logout-dir` and `print.err319.auth-logout-unwritable`. |
| `Stopping. Any review that has launched goes on in the cloud and is billed.` | <Undocumented /> | A hidden `claude ultrareview eval` run was stopped by a signal. | The program prints this text to stderr when `claude ultrareview eval` gets SIGINT or SIGTERM (exit codes 130 and 143). The `eval` form needs the feature config `tengu_review_bughunter_config` (`enabled` and `eval_enabled`), a policy, and a first-party login (read site `chunk-fpb06zbw.js`, search `Stopping. Any review`). The official docs do not list `eval`, but they give the same rule for the public subcommand: exit code 130 on Ctrl-C, and a review that has started "may still be running in the cloud" and uses a free run or bills ([Run Ultrareview Non-Interactively](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively), [Pricing and Free Runs](https://code.claude.com/docs/en/ultrareview#pricing-and-free-runs)). This site does not run ultrareview live, because each run can bill the account: the repo owner chose the official docs and community reports as the source for it. Six gate checks that started nothing all printed `error: unknown option '--output'`: one with the live login (case `live.err319`, before this rule), and five with cached features, a fake OAuth login, `_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL`, and `CLAUDE_INTERNAL_FC_OVERRIDES`. |
| `Failed to read environment secret file` | <Undocumented /> | `claude self-hosted-runner` could not read the file of `--environment-secret-file`. | The text names the path and the system error. Run: `claude self-hosted-runner --api-url http://127.0.0.1:9 --environment-secret-file ~/missing` printed `error: Failed to read environment secret file <path> (ENOENT: no such file or directory, open '<path>')` and exited with code 2. Probe case `print.err319.runner-secret-file-missing`. |
| Various | <Undocumented /> | **`decode-token`.** `decode-token` could not read or check a token. | A flag is unknown or has no value. The token is not a JWT with three base64url segments. The token has no `exp` claim. The token is expired or not yet valid. The token uses an `alg` other than ES256 or RS256. The JWKS could not be fetched. The JWKS has no key with that `kid`. The signature check failed. |
| Various | <Undocumented /> | **Conversation import.** Claude Code refused a conversation import or export file. | The file is over the size limit. The file is not valid JSON. The manifest does not match after the import. |

## Related Pages

- [CLI Overview](index.md)
- [All Flags](flags.md)
- [Auto Mode](../permissions/auto-mode.md) covers the `claude auto-mode` commands in depth.
