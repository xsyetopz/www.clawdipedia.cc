---
title: Subcommands
description: Every claude subcommand in 2.1.329, including background sessions, auth, plugins, and the hidden commands.
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
| `claude agents` | <Documented /> | Opens the agent view to watch and start background sessions. `--json` prints the active sessions. With `--json`, `--all` adds completed background sessions. With `--json`, `--cwd <path>` keeps only the sessions started under that path. These options set the defaults of the sessions it dispatches: `--model`, `--effort`, `--agent`, `--permission-mode`, `--add-dir`, `--mcp-config`, `--strict-mcp-config`, `--plugin-dir`, `--settings`, `--setting-sources`, `--restricted`, `--dangerously-skip-permissions` (an alias for `--permission-mode bypassPermissions`), and `--allow-dangerously-skip-permissions`. The hidden `--inherit-permission-mode`, `--managed-settings`, and `--plugin-dir-no-mcp` also work. The unpushed-commit check of a session worktree works when the worktree has a file or folder named `HEAD` at the top level. See `claude rm`.[^head-file] |
| `claude attach <id\|name>` | <Documented /> | Opens a background session. |
| `claude logs <id\|name>` | <Documented /> | Prints the recent output of a background session. |
| `claude stop <id>` (alias `kill`) | <Documented /> | Stops a background session and keeps the conversation. |
| `claude respawn <id>` or `--all` | <Documented /> | Restarts a background session, or all of them, so it uses the current Claude Code binary. |
| `claude rm <id>` | <Documented /> | Removes a background session from the list, and deletes its worktree when that is safe. The conversation is kept, and `claude --resume` lists it.[^rm] Unlike `stop`, it works on a session that already exited. It takes `--discard-unpushed <commit>@<worktree-id>` (also discards the unpushed commits and uncommitted changes of the worktree while it is still at that commit) and `--force-remove-worktree <worktree-id>` (deletes the worktree folder when the `WorktreeRemove` hook or git could not; the repository must list it as a worktree, with no uncommitted changes to tracked files; the branch stays). For both, pass the value that an earlier `claude rm <id>` printed. `claude rm` removes a fully pushed session whose worktree has a file or folder named `HEAD` at the top level.[^head-file] |
| `claude daemon [run\|status\|logs\|stop\|uninstall]` | <Documented /> | Controls the supervisor of background sessions, which the root help does not list. See [`daemon` Subcommands](#daemon-subcommands). |
| `claude auth login\|logout\|status` | <Documented /> | Signs you in and out. `status` exits with 1 when you are not signed in. `login` takes `--claudeai` (the default), `--console` (API usage billing), `--email <email>` (fills in the login page), and `--sso`. `status` prints JSON by default (`--json`). With `--text`, it prints text. `login` also has a hidden option, `--gateway-json`, for a program that shows the Cloud gateway sign-in to a person. It writes its questions as JSON lines and reads the answers from stdin. It cannot be combined with `--console`, `--claudeai`, `--sso`, or `--email`. It reads the gateway from the settings of the machine. It checks in this order: a clash with the other login flags, a gateway in the settings, a terminal on stdin, and a Claude Code session. Each failure prints one line to standard error and exits with code 1. See the errors on [Auth Settings](../settings/auth.md#errors).[^gateway-json] The hidden `--organization-gateway` flag signs in to your organization's gateway through its identity provider. It cannot be combined with another sign-in option and needs a terminal.[^org-gateway] |
| `claude setup-token` | <Documented /> | Makes a long-lived token. It needs a subscription. |
| `claude auto-mode config\|critique\|defaults\|reset` | <Documented /> | Shows or resets the rules of the auto mode classifier. `critique` takes `--model <model>`. `defaults` takes `--label <prefix>` to keep only rules whose label starts with the prefix. `reset` takes `-y/--yes` to skip the confirmation. |
| `claude doctor` | <Documented /> | Checks your setup and changes nothing. |
| `claude gateway --config <yaml>` | <Documented /> | Runs the enterprise gateway. When the gateway starts, it always prints a notice: it can push settings that run commands on developer machines, so keep it on a private network and never expose it to the public internet.[^gw-notice] |
| `claude import [codex\|gemini\|cursor]` | <Documented /> | Imports the config of another agent, with `--dry-run` and `--yes`. |
| `claude install [stable\|latest\|version]` | <Documented /> | Installs the native build, with `--force`. |
| `claude update` (alias `upgrade`) | <Documented /> | Updates Claude Code. Package-manager installs update through the package manager. |
| `claude mcp ...` | <Documented /> | Manages MCP servers (see [MCP](../../extend/mcp/cli.md)). |
| `claude plugin ...` (alias `plugins`) | <Documented /> | Manages plugins (see [Plugins](../../extend/plugins/cli.md)). |
| `claude plugin test [dir]` | <Documented /> | Runs the tests of a mod. |
| `claude purge [path]` | <Documented /> <Caution note="Deletes the state of a project" /> | Deletes the state of a project, with `--all`, `--dry-run`, `-i/--interactive` (asks before each item), and `-y/--yes`. When both stdout and stderr go to a pipe or a file, it prints "Claude Code can't show a prompt here", deletes nothing, and tells you to send one of them to the terminal.[^purge-pipe] The purge plan ends with "Purging deletes data only on this computer, not anything stored by Anthropic".[^purge] |
| `claude remote-control` (alias `rc`) | <Documented /> | Lets you control local sessions from `claude.ai` or the mobile app. See [Remote Control Server](remote-control.md). |
| `claude ultrareview [target]` | <Documented /> | Starts a cloud review with many agents, with `--json`, `--post`, `--no-post` (the default), `--timeout`, and `--trust-workspace`. It needs a trusted folder. It asks on a terminal. Without a terminal it may refuse, so scripts pass `--trust-workspace` after the target, or set `CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK=1`. |
| `claude self-hosted-runner` | <Documented /> | Runs cloud sessions on your machine, and the root help does not list it. Subcommands: `orchestrator`, `setup`, `doctor`, and `decode-token`. See [Self-Hosted Runner](self-hosted-runner.md) for every option and error. |
| `claude sandbox` | <Undocumented /> | A hidden command with three subcommands for the Windows sandbox: `install` adds the sandbox user and network filters. It asks for elevation once. `status` prints the sandbox state and the Windows install state as one JSON line. `uninstall` removes them and lists what stays behind, with `--json`. |
| `claude edit-hook`, `edit-permission-rules`, `edit-memory-settings`, `edit-skill-overrides`, `edit-sandbox-settings`, `edit-chrome-settings`, `design-login` | <Undocumented /> | Hidden commands that read one JSON edit from stdin with `--json`. Their text says they serve the VS Code extension. `design-login --status` reports whether design-system access is authorized and exits. |
| `claude workspace-trust --json` | <Undocumented /> | A hidden command that reports, as JSON, whether the current folder holds a saved workspace trust record. `--json` is required, and no other argument is allowed. The text says the VS Code extension uses it. The JSON has `trusted`, `directory`, `root` and `unsafe_path` when they apply, and `sandbox_limits_files`. If the record cannot be read, it prints `claude workspace-trust: the trust record could not be read: <message>`.[^trust-cmd] |
| `claude apply-project-settings` | <Undocumented /> | A hidden command that shows how your user and project settings differ from what you accepted for cloud sessions on this computer. It lets you accept them. It needs a terminal. |
| `claude project` | <Undocumented /> <Deprecated note="Use claude purge" /> | A hidden command with one subcommand, `purge`. The help text says that `claude project purge` is now `claude purge` and that the old name still works for now. |
| `claude worktree-hook` | <Undocumented /> | A hidden command that runs the WorktreeCreate or WorktreeRemove hooks for the current directory and reports the result as JSON. The help text says Claude Desktop uses it.[^worktree-hook] It needs `--json` and `--event <create\|remove>`. `--name <slug>` names the worktree to create, `--path <absolute>` names the worktree to remove, and `--trusted-folder <absolute>` is also accepted. The outcome is `refused`, `failed`, or `started`. |
| `claude import-conversations <exportPath>` | <Undocumented /> | A hidden command that archives an export, with `--cwd` and `--dry-run`. |

After the terminal resumes (for example when you run `fg` after you suspend Claude Code), most prompts ignore every answer except Esc for a moment. In a list prompt, Esc cancels at once, and Enter on an option is ignored for up to `150` ms from the resume signal.[^fg-guard]

:::note[Hidden Commands]
The `edit-*` commands and `design-login` read one JSON edit from stdin.
Their own text says they serve the VS Code extension. Do not build scripts on them.
:::

### `ultrareview` Eval Flags

`claude ultrareview` has four hidden options: `--max-cost`, `--list`, `--output`, and `--review-md`. They belong to an eval mode that a server-side config turns on. Without the gate, each option fails with `error: unknown option '<option>'`.[^eval-flags] The official docs do not list these flags ([Run Ultrareview Non-Interactively](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively)).

| Flag | Status | What it does | Default |
| --- | --- | --- | --- |
| `--list <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Reads the pull requests to review from a file. Do not give pull requests as arguments with it. `-` is refused, so the list must be in a file. | Off |
| `--output <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sets where the report goes. Claude Code refuses a place inside its own folder, where old files may be removed. | A file in the program's own folder |
| `--max-cost <dollars>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sets a limit on cost, in US dollars. The value must be a number above 0. | Off |
| `--review-md <file>` | <Gated note="tengu_review_bughunter_config.eval_enabled" /> | Sends the file as a draft `REVIEW.md` in place of the `REVIEW.md` of each repository. Claude Code refuses a file that is not UTF-8 text or is blank, with `Nothing was started.` Without the gate, it prints `error: unknown option '--review-md'`.[^review-md] | Off |

Claude Code also refuses the launch inside a Claude Code session when `CLAUDE_CODE_ULTRAREVIEW_REVIEW_MD_FILE` asks for a draft. Only a person may send a draft `REVIEW.md`.[^review-md-session]

In eval mode, `--json`, `--timeout`, `--post`, `--no-post`, and `--trust-workspace` are refused with `--json, --timeout, --post, --no-post and --trust-workspace don't work with eval. Leave them out.` Every refusal ends with `Nothing was started.`

### `daemon` Subcommands

`claude daemon --help` lists `run [json-path]`, `status`, `logs`, `uninstall`, and `stop` (with `--any` and `--keep-workers`), and the options `--json-path <p>` (default `~/.claude/daemon.json`) and `--log-file <p>` (default `~/.claude/daemon.log`).[^daemon-help] The help text says: "Service install is disabled in this version — the daemon runs on demand and exits once no client is connected and no background session is running." It also says that idle background sessions usually stop after about an hour, and that a session you moved to the background with the left arrow before typing anything usually stops after about 5 minutes, or right away if you exit agent view.

- With no subcommand, the parser picks `hub` when stdin is a terminal, and `run` (the foreground) when it is not. The program turns `hub` into `status`, so a terminal gets the status report.
- `log` is an alias of `logs`. Both options also take the `--option=value` form.
- A word that is not a subcommand and holds `.`, `/`, `\`, or `~` is read as `run <json-path>`. Any other word prints `unknown subcommand: <word>`, then the help text, and exits with code 1.[^daemon-unknown]
- The parser also knows `install`, `start`, `restart`, `list`, `scheduled`, `remote-control`, and `hub`, which the help text does not list. The program gates them:[^daemon-probe]

| Command | Status | Result |
| --- | --- | --- |
| `claude daemon install`, `start`, `restart` | <Undocumented /> <Deprecated note="Service install is disabled" /> | Prints ``claude daemon <name>` is disabled in this version — the daemon runs on demand and exits once no client is connected and no background session is running.`` to stderr and exits with code 1. |
| `claude daemon list [--json]` | <Undocumented /> | Prints `'daemon list' is not available in this environment.` and exits with code 1, because the program has the check fixed to off. |
| `claude daemon scheduled`, `remote-control` | <Undocumented /> | Prints `'daemon <name>' is not available in this environment.` and exits with code 1. `scheduled` is always off here, except for the internal cleanup call. `remote-control` is on only when the remote-control gate of the program is on.[^daemon-remote] |
| `claude daemon hub` | <Undocumented /> | Runs `status`, because the program turns `hub` into `status`. |

`--origin <service|transient|foreground>` and `--spawned-by <json>` are internal options. Claude Code passes them when it starts the daemon on demand (`daemon run --origin transient --spawned-by {"label","cwd","pid"}`), and `claude daemon status` shows them as the start reason.

### `gateway` Role and Retention Options

The gateway YAML file takes the options `upstreams[].assume_role` and `admin.identity_retention_days`.[^gw-roles] The gateway builds the STS address from the region (`https://sts.<region>.amazonaws.com`, or `sts-fips` when `AWS_USE_FIPS_ENDPOINT` is `true`) and has no setting for it.[^sts-address]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `upstreams[].assume_role.role_arn` | <Undocumented /> | Makes the gateway call `sts:AssumeRole` for this role and sign the upstream request with the assumed keys. It works on `bedrock` and `mantle` upstreams. The value must match `arn:aws:iam::<12 digits>:role/<name>` (also `arn:aws-us-gov`). | Off: the upstream is signed with the source keys |
| `upstreams[].assume_role.external_id` | <Undocumented /> | Sends this value as the external ID of the call. It needs 2 to 1224 characters from letters, digits, and `_+=,.@:/-`. | No external ID |
| `upstreams[].assume_role.session_name` | <Undocumented /> | `sub` or `email` names the session after that claim of the user token, so each developer has a session in AWS. | One shared session, `claude-apps-gateway` |
| `admin.identity_retention_days` | <Undocumented /> | Sets how many days the gateway keeps the email, name, and groups it stores for each user, and the daily group records. The value must be a whole number above 0. | `90` |

With `assume_role`, the gateway makes one `sts:AssumeRole` call with the role, the external ID, and the session name. It signs that call with the source key and signs the upstream call with the assumed key. The session name is `claude-apps-gateway` (shared), the `sub` claim, or the `email` claim. Without `assume_role`, there is no STS call and the upstream call uses the source key.[^assume-run]

When STS fails, the gateway does not fall back to its own keys. It makes no upstream call. The error reads `upstream bedrock: sts:AssumeRole on <role> for the shared session failed (AccessDenied: ...); request not sent; the gateway's own credentials were not used instead. Check: ...` With `session_name`, the session shows as `sub=<sub>` in the line.[^assume-fail]

The gateway refuses these values when it reads the configuration and prints the schema issue:[^assume-refuse]

- `must be an IAM role ARN (arn:aws:iam::<account>:role/<name>)` for a `role_arn` that does not match.
- `must be 2 to 1224 characters of letters, digits and _+=,.@:/-` for an `external_id` that does not match.
- `Invalid enum value. Expected 'email' | 'sub', received 'name'` for another `session_name`.
- `assume_role needs SigV4 source credentials (access keys or the ambient AWS chain, auth: {}); aws_bearer_token cannot call sts:AssumeRole` with `auth.aws_bearer_token`.
- `Unrecognized key(s) in object: 'assume_role'` on an `anthropic` upstream.
- `Number must be greater than 0` for `identity_retention_days: 0`, and `Expected number, received nan` for a text value.

A `mantle` upstream with `session_name` next to a `bedrock` upstream without one starts, and the gateway warns `upstream 'bedrock' sets assume_role.session_name for per-developer AWS attribution, but upstream 'm' sets none, so the requests 'm' serves are not attributed per developer`.[^assume-mixed]

The gateway deletes identity records older than `identity_retention_days` when it starts, and again on an interval. It also deletes a group record older than the limit and a group record of a user with no stored identity, and keeps the group records of a stored user that are inside the limit.[^retention-run]

### `gateway` Pooled Budget, Sign-In Notice, and Blocked Message Options

The gateway YAML file takes four options: `login_notice`, `admin.blocked_message`, `admin.pooled_conflict_rule`, and `admin.pooled_priority_order`.[^pooled-notes]

| Option | Status | What it does | Default |
| --- | --- | --- | --- |
| `admin.pooled_conflict_rule` | <Undocumented /> | Decides which pooled group budget pays first for a developer in several groups. `default_order` or `priority_list`. With `priority_list`, the gateway uses `admin.pooled_priority_order`.[^pooled-order-code] | Not set: the default order |
| `admin.pooled_priority_order` | <Undocumented /> | The group names that pay first, in order. Up to 50 names, each non-empty, none twice. It has an effect only with `pooled_conflict_rule: priority_list`. | Not set |
| `login_notice` | <Undocumented /> | A top-level plain-text message of 1 to 500 characters. The gateway puts it in the `device_authorization` response and on its browser verification page. The `/login` gateway sign-in screen of the program shows it as `Notice from <host>:` and the text. | Not set: no message |
| `admin.blocked_message` | <Documented /> | Appended after ` · ` to the `429 billing_error` of a developer who reached a spend limit. The program removes a final `.` from the default message first. | Not set: only the default message |

This example sets all four options and `identity_retention_days`. Add `listen`, `upstreams`, and the database to run it.

```yaml
oidc:
  issuer: https://idp.example.com
  client_id: example-client
  client_secret: example-client-secret
login_notice: "Call IT <i>now</i> & ask for a code"
admin:
  identity_retention_days: 90
  blocked_message: "request an increase at https://go.example.com/claude-limits"
  pooled_conflict_rule: priority_list
  pooled_priority_order: [a, b]
```

The [official page](https://code.claude.com/docs/en/claude-apps-gateway-config#admin) names `admin.blocked_message` ("Appended verbatim to the `429 billing_error` a blocked developer sees") and has no text for the other three options.

The gateway refuses a bad pooled setting when it reads the configuration, and warns for an order it ignores. A repeated group, `priority_list` with no order, and an unknown rule are schema issues: `admin.pooled_priority_order lists a group more than once`, `admin.pooled_conflict_rule: priority_list needs at least one group in admin.pooled_priority_order`, and an enum error for the rule. An order without `priority_list` logs `admin.pooled_priority_order is ignored unless admin.pooled_conflict_rule is priority_list`.[^pooled-run]

When a request would use up the pooled budget of a group, the developer sees `This request exceeds your group's budget. Ask your organization's admins to raise it, or try again after it resets on <Month> <day> at <HH:MM> UTC.`[^pooled-reset]

The gateway serves `login_notice` in the `device_authorization` response and on the verification page, and the page escapes the text. The value is 1 to 500 characters. Without `oidc`, the gateway warns `login_notice (no one can sign in, so no one sees it)`.[^notice-run]

The `/login` gateway sign-in screen shows the `login_notice` of the `device_authorization` response. The screen shows the code and the link, then `Notice from <host>:` and the notice text, then `Waiting for sign-in to complete in your browser…`. Without the key, the screen has no notice line.[^notice-screen]

`admin.blocked_message` is appended to the spend-limit error. The request gets `429` with error type `billing_error`. With an organization limit of `0`, the message is `spend limit reached`, with no reset date. With another limit, it is `spend limit reached · resets <Mon> <day>`. The option adds ` · ` and its text after the message.[^blocked-run]

### `gateway` Policy Mode and Upstream Endpoints

| Item | Status | What it does |
| --- | --- | --- |
| `managed.policy_mode: layered` | <Documented /> | Every managed policy that matches a developer applies, each merged over the ones listed below it. Managed MCP servers add up over every matching policy, and a catch-all policy (`match: {}`) counts as one. The gateway warns when a catch-all is not the last entry, because the policies after it never match.[^layered] |
| `base_url` on an upstream, and `ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_VERTEX_BASE_URL`, `ANTHROPIC_FOUNDRY_BASE_URL` | <Documented /> | The gateway does not read these variables from its own environment. Model requests to each `bedrock`, `vertex`, or `foundry` upstream that has no `base_url` go to the provider's default endpoint. At start, the gateway warns that it does not read the variable, and says to copy the URL into `base_url` on each such upstream, or remove the variable.[^base-url] |

### `claude auth status` Sign-In Date

`claude auth status` has a `loginExpiresAt` key in its JSON, and a `Sign-in ends:` line with `--text`.
The JSON also has a `consoleProfileSignInOffered` key (<Undocumented />). It is `true` when `/login` would offer the keyless Console sign-in (see [Auth Settings](../settings/auth.md)). That needs the Anthropic API as the provider, no forced organization, and a `forceLoginMethod` other than `claudeai`. Other checks also apply. Otherwise the key is absent.[^console-profile]
The [stream JSON page](../../extend/headless/stream-json.md) has the second field, `credential_expires_at`, which `claude -p` JSON results also carry.
Status: <Undocumented /> on the official pages.

| Case | `loginExpiresAt` | Text Output |
| --- | --- | --- |
| Stored claude.ai login with a refresh end date | The end date as an ISO string | `Sign-in ends: between <3 days before> and <date> (<ISO string>)` |
| No login, no stored refresh date, a provider other than the Anthropic API, stored date before 2025-01-01, stored date over 10 years ahead, or an access token ending over 3 days after the refresh token | `null` | No line |

The key is always in the JSON, so a script can test for `null`.
With `claude -p`, Claude Code also writes `Warning: this sign-in ends between <date> and <date> (in 2 days at the earliest). Renewing it does not move those dates. Run claude auth login before then, or use claude setup-token for unattended jobs.` to stderr when the end is less than 10 days away.

The key and the texts come from the program.[^expiry-source]

`status` prints the stored refresh end date in `loginExpiresAt`, and `null` when Claude Code cannot vouch for it. The text line reads `Sign-in ends: between <earliest> and <latest> (<ISO date>)`. A stored date in the past prints `Sign-in may have ended: between <earliest> and <latest> (<ISO date>)`. When the end is less than a day away, the line reads `Sign-in ends: any day now, by <latest> (<ISO date>)`. A refresh end inside the warning window prints a stderr warning (`Warning: this sign-in may have ended between ...` for a date in the past).[^expiry-run]

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | Update and install. `claude update` or `claude install` failed. | Claude Code could not fetch the latest version from the npm registry. `claude update` prints `Couldn't check for updates` and `Couldn't get the latest version from the npm registry`, with the possible causes, when no latest version came back. The channel or version is not valid: a target that looks like a version but is not well-formed semver, such as `claude install 1.2.3-a_b`, prints `Invalid version string from argument: not a well-formed version (9 characters)`.[^install-version] A checksum does not match. The executable is in use. Another instance is updating. Permissions are missing. Claude Code could not restore the executable after a failed update. |
| Various | <Undocumented /> | Background sessions and daemon. A background session, `claude attach`, `claude respawn`, or daemon step failed or printed a notice. | The service is not installed or did not start. `--bg` ignores `--session-id`. A session cannot start, wake, or attach. The terminal host died. A daemon lock or roster could not be read or written. The background manager failed to start. |
| Various | <Undocumented /> | `claude gateway` server configuration. `claude gateway` refused its configuration or a sign-in request. | A `cri.` or `oidc.` setting is not valid. A loopback URL is in use without `CLAUDE_GATEWAY_ALLOW_LOOPBACK`. An ID token is missing a claim. The email domain or group is not allowed. An upstream credential or role could not be used. The store (`store.postgres_url`) is not readable. A bedrock or mantle upstream sets `assume_role` and an `auth.aws_bearer_token`. Claude Code refuses this when it reads the config: `upstream 'NAME': assume_role needs SigV4 source credentials (access keys or the ambient AWS chain, auth: {}); aws_bearer_token cannot call sts:AssumeRole`. The run lists this issue with the other schema issues.[^gw-bearer] |
| `Couldn't log out: Your account or API key may still be in the config file. Run claude auth logout.` | <Undocumented /> | `claude auth logout` printed this text to stderr and exited with code 1. | The logout could not save the config file, so the account or API key is still in it.[^logout] |
| `Logged out on this computer, but Anthropic didn't confirm the login was revoked.` | <Undocumented /> | `claude auth logout` and `/logout` cleared the local login, but the revoke request got no confirmation.[^logout-revoke] | Claude Code asks again when the first reply is a server error or a network failure. The text goes on: the login may still work until you revoke it at a page that the text names. |
| `Warning: the claude.ai login on this machine has ended.` | <Undocumented /> | Print mode with text output (not `json` or `stream-json`) warned that the claude.ai login has ended and that the run uses the sign-in from `ant auth login` instead. | The warning goes to stderr. It says the usage is billed to the named organization. It tells you to run `claude auth login` to sign in again. It says that `claude auth logout` removes the ended login and the other saved credentials, such as MCP server logins and plugin secrets.[^login-ended] |
| `Stopping. Any review that has launched goes on in the cloud and may be billed.` | <Undocumented /> | A hidden `claude ultrareview eval` run was stopped by a signal. | Claude Code prints this text to stderr when `claude ultrareview eval` gets SIGINT or SIGTERM (exit codes 130 and 143). The `eval` form needs a server-side config, a policy, and a first-party login.[^stopping] The official docs do not list `eval`, but they give the same rule for the public subcommand: exit code 130 on Ctrl-C, and a review that has started "may still be running in the cloud" and uses a free run or bills ([Run Ultrareview Non-Interactively](https://code.claude.com/docs/en/ultrareview#run-ultrareview-non-interactively), [Pricing and Free Runs](https://code.claude.com/docs/en/ultrareview#pricing-and-free-runs)). |
| `Failed to read environment secret file` | <Undocumented /> | `claude self-hosted-runner` could not read the file of `--environment-secret-file`. | The text names the path and the system error: `Failed to read environment secret file <path> (<error>)`.[^secret-missing] |
| Various | <Undocumented /> | `decode-token`. `decode-token` could not read or check a token. | A flag is unknown or has no value. The token is not a JWT with three base64url segments. The token has no `exp` claim. The token is expired or not yet valid. The token uses an `alg` other than ES256 or RS256. The JWKS could not be fetched. The JWKS has no key with that `kid`. The signature check failed. |
| Various | <Undocumented /> | Conversation import. Claude Code refused a conversation import or export file. | The file is over the size limit. The file is not valid JSON. The manifest does not match after the import. |

## Related Pages

- [CLI Overview](index.md)
- [All Flags](flags.md)
- [Auto Mode](../permissions/auto-mode.md) covers the `claude auto-mode` commands in depth.

## Sources

[^cmd-help]: The text of `claude <command> --help` in the installed program.
[^rm]: The program, `chunk-7kvz9y39.js:3260`.
[^gateway-json]: The program, `chunk-rwevfvv3.js:2118` and `chunk-f5q1yhhc.js:878`.
[^purge]: The program, `chunk-vdba82q2.js:1664` (the plan text), with the same options in `claude purge --help`.
[^trust-cmd]: The program, `chunk-rwevfvv3.js:1377`.
[^worktree-hook]: The program, `chunk-8xd2189w.js:722` (the options and help text) and `chunk-8xd2189w.js:722` (the outcomes).
[^eval-flags]: The program, the option definitions with `hideHelp()`, `chunk-rwevfvv3.js:2277`, the eval handler `ultrareviewEvalHandler` with the `error: unknown option` refusal, `chunk-jcfcwvjz.js:1407`, and the gate function, `chunk-g4jweshk.js:19906` (`eval_enabled`). The server-side config is `tengu_review_bughunter_config.eval_enabled`.
[^review-md]: The program, `chunk-rwevfvv3.js:2280` and `chunk-jcfcwvjz.js:1405`.
[^review-md-session]: The program, `chunk-71kv8x50.js:1325`.
[^daemon-help]: The program, help text and argument parser, `chunk-r5a5pree.js:3785`.
[^daemon-unknown]: The program, the subcommand set `chunk-r5a5pree.js:3859` (`install`) and the path test `chunk-r5a5pree.js:3891` (`[./\\~]`), and the refusal `chunk-r5a5pree.js:4750` (`unknown subcommand`).
[^daemon-probe]: The program, the gated set (`list`, `scheduled`, `remote-control`, `hub`) at `chunk-r5a5pree.js:3806`, the gate checks at `chunk-r5a5pree.js:4096`, the install, start, and restart text at `chunk-r5a5pree.js:4288` and `chunk-r5a5pree.js:4392`, the gate check at `chunk-r5a5pree.js:4050`, and the exit in `chunk-wtmc4k02.js:78` (the always-off check `$19297d` is at `chunk-wtmc4k02.js:44`).
[^daemon-remote]: The program, `chunk-r5a5pree.js:4096`.
[^gw-roles]: The program, `chunk-d24x4t47.js:9039` (the `assume_role` schema), `chunk-d24x4t47.js:9711` (`identity_retention_days`), and `chunk-d24x4t47.js:6588` (the call to STS).
[^sts-address]: The program, `chunk-d24x4t47.js:6589` (`sts-fips` and `AWS_USE_FIPS_ENDPOINT`) and `chunk-d24x4t47.js:6590` (the address).
[^assume-run]: The program, `chunk-d24x4t47.js:6561` (the session name `claude-apps-gateway`), `chunk-d24x4t47.js:8976` (the `session_name` values `sub` and `email`), and `chunk-d24x4t47.js:7020` (the `assume_role` role and external ID).
[^assume-fail]: The program, `chunk-d24x4t47.js:6680` (the `sts:AssumeRole` error text).
[^assume-refuse]: The program, `chunk-d24x4t47.js:8968` (the role and external ID texts), `chunk-d24x4t47.js:8976` (the `session_name` enum), `chunk-d24x4t47.js:7015` (the `aws_bearer_token` check), `chunk-d24x4t47.js:9711` (`identity_retention_days`). The `Unrecognized key(s)`, `Invalid enum value`, and `Number must be greater than 0` texts are the messages of the schema library for these schemas.
[^assume-mixed]: The program, `chunk-d24x4t47.js:15084` (the `assume_role.session_name` warning).
[^retention-run]: The program, `chunk-d24x4t47.js:10801` (the deletes, with `identityRetentionDays`), the default `90` at `chunk-d24x4t47.js:9711` (`identity_retention_days`), and `chunk-d24x4t47.js:10667` (the first run and the interval).
[^pooled-notes]: The program, `chunk-d24x4t47.js:9314` (`login_notice`) and `chunk-d24x4t47.js:9708` (`admin.blocked_message`, `admin.pooled_conflict_rule`, `admin.pooled_priority_order`), and `chunk-d24x4t47.js:15000` (the warning for an order without `priority_list`).
[^pooled-reset]: The program, `chunk-d24x4t47.js:11984` (the text "This request exceeds your group's budget").
[^pooled-order-code]: The program, `chunk-d24x4t47.js:12339` (`pooled_conflict_rule` and `pooled_priority_order`). The warning text for an ignored order is at `chunk-d24x4t47.js:15000`.
[^pooled-run]: The program, `chunk-d24x4t47.js:9720` and `chunk-d24x4t47.js:9747` (the schema), and `chunk-d24x4t47.js:15000` (the warning). The order of payment is read from the code, `chunk-d24x4t47.js:12339`.
[^notice-run]: The program, the response at `chunk-d24x4t47.js:14166` (`login_notice`), the page at `chunk-d24x4t47.js:6191` (`loginNotice`), the length limit at `chunk-d24x4t47.js:9316` (`$909f51`) and `chunk-3bmbcs0v.js:6` (`$27e3cd = 500`), and the warning for a missing `oidc` at `chunk-d24x4t47.js:15224`.
[^notice-screen]: The program, the sign-in screen, `chunk-z9j6gvtc.js:734`.
[^blocked-run]: The program, `chunk-d24x4t47.js:12437` (`blocked_message`).
[^layered]: The program, `chunk-d24x4t47.js:9624` (`policy_mode`), `chunk-d24x4t47.js:10109` (`layered`), and `chunk-d24x4t47.js:10141` (the `match: {}` warning).
[^base-url]: The program, `chunk-d24x4t47.js:15183` (`ANTHROPIC_BEDROCK_BASE_URL`, `ANTHROPIC_VERTEX_BASE_URL`, `ANTHROPIC_FOUNDRY_BASE_URL`, and the warning that follows).
[^expiry-source]: The program: the key in `chunk-f5q1yhhc.js:1461` (`loginExpiresAt`), `chunk-fe58ty6c.js:39` (`credential_expires_at`), the texts and the 10 day limit in `chunk-fe58ty6c.js:35-70`, and the date checks in `chunk-e1bhc498.js:14` (the `firstParty` provider and the `refreshToken`).
[^console-profile]: The program, `chunk-f5q1yhhc.js:1466` (the key is set next to `gatewaySignInOffered`) and `chunk-q427jmr7.js:56` (the checks: the first-party provider, no `forceLoginOrgUUID`, and a login method other than `claudeai`, plus other checks that this page does not describe).
[^expiry-run]: The program, `chunk-fe58ty6c.js:49` (the text line) and `chunk-fe58ty6c.js:63` (the warning), and `chunk-fe58ty6c.js:35` (the window, `$4cbd60 = 7 + $ed8b84` with `$ed8b84 = 3`, in days).
[^install-version]: The program, `chunk-ecns4dsm.js:2514`; the update text is at `chunk-jd0zjfgy.js:1138`.
[^gw-bearer]: The program, `chunk-d24x4t47.js:9260` (`assume_role` with `aws_bearer_token`).
[^logout]: The program, `chunk-f5q1yhhc.js:1511` (the check and the text prefix) and `chunk-kexhz84t.js:170` (the text).
[^login-ended]: The program, `chunk-s8egyyte.js:61` for the text and `chunk-s8egyyte.js:41` for the check that the login ended (`login_ended`). Print mode starts the check at `chunk-txash88y.js:2041` only when the output format is not `json` or `stream-json`.
[^stopping]: The program, `chunk-jcfcwvjz.js:1563` (the `SIGINT` and `SIGTERM` handlers with 130 and 143) and `chunk-jcfcwvjz.js:1674` (the text). The server-side config is `tengu_review_bughunter_config` (`enabled` and `eval_enabled`).
[^secret-missing]: The program, `chunk-3kp5jwr6.js:16053`.
[^logout-revoke]: The program, `chunk-kexhz84t.js:170-172` (the text), `chunk-kexhz84t.js:351-366` (the second request when the first answer is `retryable`, and the unconfirmed result), `chunk-kexhz84t.js:447` (`revoke_unconfirmed`: the text goes to stderr), and `chunk-aq3ms068.js:15191` (a server error or a network failure is `retryable`).
[^purge-pipe]: The program, `chunk-vdba82q2.js:884` ("Claude Code can't show a prompt here").
[^head-file]: The program, `chunk-hg1yqkjk.js:96426` (the check for `claude rm`), and `chunk-hg1yqkjk.js:96488`. These `git rev-list` calls end with `--`, so git reads `HEAD` as a revision and not as a path. The message text is at `chunk-7kvz9y39.js:660`.
[^fg-guard]: The program, `chunk-0b3aev3g.js:15009` (`noteResumed`, the resume time) and `chunk-0b3aev3g.js:15137` (the `SIGCONT` handler that sets it) and `chunk-wz8vy3bj.js:23` (the `150` ms limit), and `chunk-4hvh0e00.js:804` (in a list prompt, the `escape` key calls `onCancel` at once) and `chunk-4hvh0e00.js:734` (the Enter key waits for `refusedWithin`, the `150` ms limit).
[^org-gateway]: The program, `chunk-rwevfvv3.js:2116` (the hidden `--organization-gateway` option and help text) and `chunk-f5q1yhhc.js:836` (the text "can't be used with another sign-in option").
[^gw-notice]: The program, `chunk-v9ek375d.js:48` (the notice "Keep it on your private network") and `chunk-d24x4t47.js:14944` (the `tls` and `managed` start-up call, printed at start-up).
