---
title: Auto Mode
description: How the auto mode classifier decides, the autoMode setting, the claude auto-mode commands, and the related environment variables.
sidebar_position: 5
---

Auto mode lets Claude Code run without routine prompts.
A classifier model reads each action and blocks what is risky, such as a deploy to production or a push of secrets.
You tune it with the `autoMode` setting.

Pick `auto` as the permission mode. `permissions.disableAutoMode: "disable"` turns it off. `permissions.defaultMode: "auto"` starts in it. User settings, `--settings`, and managed settings set `autoMode`. Project and local settings do not.

## Example

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "autoMode": {
    "environment": [
      "$defaults",
      "Trusted repo: github.com/acme/app",
      "Trusted cloud buckets: s3://acme-build-cache"
    ],
    "soft_deny": [
      "$defaults",
      "Staging Migrations: Running database migrations against the shared staging database."
    ]
  }
}
```

`$defaults` keeps the built-in entries at that place. A list without `$defaults` replaces them.
Run `claude auto-mode config` to see the result.

## How the Classifier Decides

- The classifier is a model call. It reads the transcript, with your rules as its system prompt.
- By default it allows an action. It blocks an action that matches a `hard_deny` rule. It also blocks one that matches a `soft_deny` rule when no `allow` rule and no clear request from you clears it.
- `soft_deny` rules cover destructive or irreversible actions that your intent can clear.
  `hard_deny` rules are security boundaries that your intent does not clear. Source: the `autoMode` schema text.
- If the classifier cannot answer, Claude Code blocks the call or sends it to a person. Program texts: `Classifier unavailable`, and `Auto mode classifier transcript exceeded context window - falling back to manual approval`.
- Repeated denials trip a circuit breaker.
- A server-side classifier can review actions instead. See [The Server-Side Check](#the-server-side-check). Server lists can add rules. The program ignores server entries that are not strings, are blank, or hold control characters.

The default rule lists are on [Auto Mode Default Rules](auto-mode-rules.md).

### The Server-Side Check

Official page: [Server-Side Classifier Review](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review). Source: the program, 2.1.319 (`chunk-6cetpjxd.js@26476` parses the verdict, `chunk-9r1hbf9p.js@3012193` reads it from the stream, `chunk-9r1hbf9p.js@3240012` acts on it).

- In auto mode, each main request has a top-level `safeguards` field, `[{"type": "dangerous_tool_use", "classifier_context": …}]`, and the betas `dangerous-tool-use-2026-09-03` and `afk-mode-2026-01-31`.
- The reply carries the verdict in `safeguard_results`, in `message_delta.delta` of a stream or at the top level of a plain reply. The verdict for each call is under the `tool_use` id.
- `not_flagged` runs the call. `flagged` denies it with `The server-side auto mode classifier judged this action dangerous (it gave no explanation)`, and `PermissionDenied` fires.
- With no verdict, the program refuses each call that needs the check. The text with a gateway is `Auto mode can't check actions in this session. Its safety check runs on the server, and your requests go through <host>, which doesn't pass it through.` On a direct connection it is `…and the server isn't running it for this session.` The debug log has `[server-classifier] Bash: the server-side classifier does not run for this session (server_no_result) and no local one judges in its place`.
- `CLAUDE_CODE_AUTO_MODE_SERVER=0` and `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` each remove `safeguards` from the requests. Then the program sends its own classifier requests (stage `xml_s1`, model `claude-sonnet-5[1m]` in the run).
- `CLAUDE_CODE_AUTO_MODE_SERVER=1` wins over `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`: the requests keep `safeguards` and the beta `dangerous-tool-use-2026-09-03`. With both set and no verdict, the program logs `[server-classifier] the platform gave no classification for this request (server_no_result); treating that as this deployment's answer: auto mode classifies locally for the rest of this session and stops sending the classifier context`, and then sends its own classifier requests (stages `xml_s1` and `xml_s2`). With only `CLAUDE_CODE_AUTO_MODE_SERVER=1`, no verdict refuses the call and no local classifier runs. Cases: `print.automode.classifier-server.server-1`, `.server-1-betas-off`, `.betas-off`.
- The gateway guide in the program tells a gateway to pass the `anthropic-beta` value, `safeguards`, and `safeguard_results` through. A gateway that cannot do this answers `400 invalid_request_error` with a message that names `safeguards`. The guide says the client then sends the request again without them and runs the check itself (`chunk-95zy4jce.js@1496289`).

| Run (2.1.319, `-p --permission-mode auto`, the model calls `Bash` with `curl -s http://127.0.0.1:9/x`) | Result |
| --- | --- |
| Direct connection (cc-inspect `apiHost: true, baseUrl: false`), verdict `not_flagged` | `curl` ran, `PostToolUse` fired |
| Direct connection, verdict `flagged` | Denied by the classifier, `PermissionDenied` fired |
| Direct connection, no verdict | Denied, `the server isn't running it for this session` |
| Stub base URL (a gateway), verdict `not_flagged` | `curl` ran, `PostToolUse` fired |
| Stub base URL, no verdict | Denied, `your requests go through 127.0.0.1:<port>, which doesn't pass it through` |
| `CLAUDE_CODE_AUTO_MODE_SERVER=0`, or `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` with `CLAUDE_CODE_AUTO_MODE_SERVER` unset, verdict `not_flagged` | No `safeguards` field. Local classifier requests, and the `OK` stub reply gave `Auto mode could not evaluate this action and is blocking it for safety` |
| `CLAUDE_CODE_AUTO_MODE_SERVER=1` and `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`, no verdict | `safeguards` sent. After `server_no_result`, local classifier requests (`xml_s1`, `xml_s2`) for the rest of the session |

The cc-inspect `code` action `cli` makes these runs: `calls: [{"name": "Bash", "input": {"command": "curl -s http://127.0.0.1:9/x"}, "safeguard": "not_flagged"}]`.

### The Two Stages

Source: the program, `chunk-9r1hbf9p.js` (the classifier) and `chunk-nc1242sj.js` (the defaults). A probe captured the requests. See [Probes](../../reference/probes.md#auto-mode).

1. Server config `tengu_auto_mode_config.twoStageClassifier` picks the mode: `fast` (stage 1 only), `thinking` (stage 2 only), or `both`. The default is `both`. A site that uses severity scores always uses `both`.
2. Stage 1 is a short request. `max_tokens` is 64, or 256 in `fast` mode, plus the thinking budget. The stop sequence is `</severity>` in severity mode and `</block>` in block mode. `fast` mode sends no stop sequence. The prompt tells the model that stage 1 does not apply user intent.
3. Stage 1 blocks when the severity is more than threshold 1, or when it answers `<block>yes`. It allows only when the reply stops at the stop sequence or at `end_turn`, and the reply is the bare tag. The result text is `Allowed by fast classifier`. Any other reply goes to stage 2.
4. Stage 2 is a full request. `max_tokens` is 8192 plus the thinking budget, with no stop sequence. It blocks when the severity is more than threshold 2. A reply it cannot parse blocks.
5. Parse rules: the program removes thinking blocks. A severity reply must hold exactly one `<severity>N</severity>`. A block reply must hold `<block>yes</block>` or `<block>no</block>`. The category must be one of a known set.

| Item | Value | Source |
| --- | --- | --- |
| Severity thresholds | Server config `severityByModel` or `severityBySite`. With the feature-flag client off, the built-in values apply: `claude-sonnet-5` stage 1 `25`, stage 2 `35`. `claude-opus-4-8` stage 1 `45`, stage 2 `35`. The `[1m]` forms have the same values. The fallback values are `15` and `20` | `chunk-nc1242sj.js` |
| Models with no threshold | Block mode (`<block>yes` or `no`), for example Haiku models | `chunk-9r1hbf9p.js` |
| Thinking | Models in a built-in list get `thinking: {type: "disabled"}` and budget `0`. The list holds the Claude 3 models, Opus 4 to 4.8, Opus 5, Sonnet 4 to 4.6, Sonnet 5, and Haiku 4.5. Other models get no `thinking` field and 2048 more tokens. For example, stage 1 on Haiku 5.5 asks for 2112 tokens | `chunk-yqezv9gr.js` |
| Retries | Server config `maxRetries`, default `4`. A stage sends its request again while the reply cannot be parsed, so a stage sends up to 5 requests. A capture with an unparseable stub reply showed 5 stage 1 requests at 64 tokens and 5 stage 2 requests at 8192 tokens | `chunk-9r1hbf9p.js` |
| Time limits | 60 seconds per request. For a long transcript, 10 more seconds per 50,000 tokens over 50,000, with a maximum of 120 seconds. Stage 2 has a deadline of 120 seconds | `chunk-9r1hbf9p.js` |
| Errors | Stage 1 error: `Classifier unavailable - blocking for safety`. Stage 2 error: `Stage 2 classifier error - blocking based on stage 1 assessment`. Transcript too long: `Classifier transcript exceeded context window` | `chunk-9r1hbf9p.js` |

:::note[Prompt Text and Thresholds]
The classifier prompt names 50 as the block boundary. The program compares the score with the thresholds in the table, not with 50.
:::

`CLAUDE_CODE_AUTO_MODE_TEMPERATURE` is read as a number with the default `1`. The captured classifier requests had no `temperature` field, so this page does not give an effect for it.

### Broad Allow Rules in Auto Mode

When a session enters auto mode, the program removes allow rules that would let calls skip the classifier. It removes them from all sources and logs `Ignoring dangerous permission <rule> from <source> (bypasses classifier)`. It puts them back when the session leaves auto mode. Source: the program, `chunk-z1rrqs8n.js` and `chunk-5kdjdecf.js`. The official page [How Auto Mode Evaluates Actions](https://code.claude.com/docs/en/permission-modes#how-auto-mode-evaluates-actions) gives a shorter list.

The program removes these allow rules:

- A `Bash` rule with no content, or a bare `*`.
- A `Bash` rule for an interpreter or a command runner, in the forms `x`, `x:*`, `x *`, `x*`, or `x -…*`: `python`, `python3`, `python2`, `node`, `deno`, `tsx`, `ruby`, `perl`, `php`, `lua`, `npx`, `bunx`, `npm run`, `yarn run`, `pnpm run`, `bun run`, `bash`, `sh`, `zsh`, `fish`, `ssh`, `eval`, `exec`, `env`, `xargs`, `sudo`. A `python -m <module>` rule stays.
- A `PowerShell` rule for an interpreter or a cmdlet that runs code, also in the `.exe` forms.
- Allow rules for the `Agent` and `Monitor` tools, the REPL tool, and some MCP tools.
- Every `Bash` and `PowerShell` allow rule, when `autoMode.classifyAllShell` is `true`.

### Classifier Billing Notice

When auto mode falls back from the server-side classifier to its own classifier requests, which are billed, the program can show a notice. The title is `We're changing auto mode to no longer charge for classifier requests in Claude Code.` The text says `However, this session isn't eligible.` and links to [Auto Mode Classifier Billing](https://code.claude.com/docs/en/auto-mode-classifier-billing). Source: the program, `chunk-9r1hbf9p.js@1396984` to `@1397965`, `chunk-mm3e44qr.js@4356`, and `chunk-9pxcgzjr.js@1905` (2.1.319).

- When the program detects a gateway, the text names its host. It detects a base URL host outside `anthropic.com`, a custom provider base URL, or the gateway URL. It knows some gateways by name, such as LiteLLM, Helicone, Portkey, Cloudflare AI Gateway, Kong, Braintrust, Bifrost, and Databricks.
- When the Claude desktop app manages the provider and turned the gateway check on, the title is `Auto mode switched to its built-in safety check for this session`. This form is new in `2.1.316`.
- In an interactive session, it is a dialog: you continue or interrupt. If you interrupt, the result is `Cancelled at the classifier billing notice`. With no dialog surface, the program logs the fallback and continues.
- In `-p` mode, it goes to stderr. With `--output-format stream-json --verbose`, it is a warning event.

The program shows it only when all of these are true:

- The hidden server-side flag `tengu_velvet_heron` is on. The default is on.
- The plan is not Pro, Max, or Team.
- No gateway was detected. Or there is a gateway, and you did not accept the notice (`autoModeClassifierBillingNoticeAcknowledgedAt`) in the last 24 hours.

On 2.1.319, the program asks for the notice only after a refusal of the server-side check sets a latch for the rest of the session (the program, `chunk-9r1hbf9p.js@3237528`). Three interactive runs with a custom base URL did not show the notice:

| Setup | Hypothesis | Result |
| --- | --- | --- |
| No verdict from the stub (case `pty.notifications.agent-needs-input`) | The notice shows, as on 2.1.316. | The dialog `Auto mode can't check actions in this session` showed. The notice did not. |
| HTTP 400 to the dangerous-tool-use beta (case `pty.notifications.agent-needs-input-refused`, `--debug-file`) | The refusal starts the local classifier and the notice. | The debug file logged `the platform rejected a beta on this request (HTTP 400) ... auto mode decides with the local classifier`. The dialog `Auto mode can't check actions in this session` showed. The notice did not. |
| `CLAUDE_CODE_AUTO_MODE_SERVER=0` (case `pty.notifications.auto-mode-local`) | Local classifier requests start the notice. | No notice, no `Notification`, and no `safeguards` field in the requests. The local classifier got no usable answer from the stub, and the screen showed `Not run · auto mode's check had no usable answer`. |

## The `autoMode` Setting

Official pages: [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes) and [Configure Auto Mode](https://code.claude.com/docs/en/auto-mode-config).

| Key | Status | What it does | How it works | Scope |
| --- | --- | --- | --- | --- |
| `autoMode.allow` | <Documented /> | Exceptions to the soft deny rules | The value is a list of strings. `$defaults` inherits the built-in rules at that place | User, `--settings`, managed |
| `autoMode.soft_deny` | <Documented /> | Block rules that user intent can clear | Same list rules | Same |
| `autoMode.hard_deny` | <Documented /> | Block rules that no intent clears | Same list rules | Same |
| `autoMode.environment` | <Documented /> | Facts about your setup and trusted resources | Same list rules | Same |
| `autoMode.classifyAllShell` | <Documented /> | Suspends every `Bash` and `PowerShell` allow rule in auto mode | All shell commands go to the classifier. The default is `false`. The program reads user, `--settings`, and managed settings. The flag is on if any of them is `true`. `false` is the same as unset, so it cannot turn the flag off. The program does not read project and local settings | User, `--settings`, managed |
| `permissions.disableAutoMode` | <Documented /> | Turns auto mode off | The value is `disable` | Settings |
| `skipAutoPermissionPrompt` | <Documented /> | The user accepted the opt-in dialog | Boolean | Settings |
| `useAutoModeDuringPlan` | <Documented /> | Plan mode uses auto semantics | The default is `true` | Settings |
| `permissions.defaultMode: "auto"` | <Documented /> | Start in auto mode | It does not come from project or local settings | User, managed |

The plugin `settings.json` does not accept `autoMode`.

:::note[Which Sources Count]
A probe ran `claude auto-mode config` with `autoMode.allow` set in each source. Rules from user settings and from a `--settings` file applied. The program ignored rules in `.claude/settings.json` and `.claude/settings.local.json`. The program logs `tengu_settings_auto_mode_rules_untrusted_source_ignored` for them. Its message says only policy, user, and flag settings may set the rules. Managed settings also applied, from `managed-settings.json` and `managed-settings.d/`. The program joins lists from all sources. User or `--settings` rules come first, and managed rules come after. `$defaults` expands where it sits. A list with no `$defaults` in any source has no built-in rules. `classifyAllShell` is not in the `auto-mode config` output, so this run did not check it. See [Probes](../../reference/probes.md#configure-and-memory).
A managed `autoMode.allow` list with no `$defaults` replaces the built-in allow rules. Then the program strips `$defaults` from the `autoMode.allow` list of a `--settings` file, so that file cannot add the built-ins back. The program also strips it when a managed settings file has a load error at `autoMode` or `autoMode.allow`, or fails to load as a whole. No probe checked this case, because managed settings need a root-owned folder. The "Scheduled-Task Fires" allow rule stays when an allow list replaces the defaults (the program, `chunk-b2pagpjq.js` and `chunk-mfrsszee.js`).
The [official docs](https://code.claude.com/docs/en/auto-mode-config) confirm this only for `classifyAllShell` (user and `--settings`). A separate probe checked `classifyAllShell` by counting classifier requests for a `curl` command that a user allow rule covered. The count was 1 with `true` in user settings or `--settings`, and 0 with `false` or unset. A managed `false` with `true` in user settings or `--settings` gave 1. A managed `true` gave 1 in every case, even with `false` in user settings or `--settings`. The program reads no other source. From `2.1.319`, this count needs `CLAUDE_CODE_AUTO_MODE_SERVER=0`: without it, a stub that gives the server-side check no verdict gets no classifier request. See [Probes](../../reference/probes.md#auto-mode).
:::

## The `claude auto-mode` Commands

| Command | Status | What it does | How it works | Scope |
| --- | --- | --- | --- | --- |
| `claude auto-mode defaults` | <Documented /> | Prints the default `environment`, `allow`, `soft_deny`, and `hard_deny` as JSON | Option `--label <prefix>` shows only rules whose label starts with the prefix, without regard to case. With no `autoMode` in any source, the output is the same as `config` (a probe with cc-inspect `code` action `cli`) | CLI |
| `claude auto-mode config` | <Documented /> | Prints the effective config as JSON | It uses your settings where set and defaults elsewhere | CLI |
| `claude auto-mode critique` | <Documented /> | Asks a model to review your custom rules | Option `--model <model>`. It checks clarity, completeness, conflicts, and actionability | CLI |
| `claude auto-mode reset` | <Documented /> | Removes `autoMode` from the user settings file | Option `-y, --yes` skips the prompt | CLI |
| `/auto-mode-setup` | <Documented /> | Scans the project and recent sessions, and proposes `autoMode` rules | Shows `Auto-mode setup proposal is ready for review`. Since `2.1.304` it is also on Bedrock, Vertex, Foundry, a Claude apps gateway, and with telemetry off. `skillOverrides["auto-mode-setup"]: "off"` turns it off (the program). | Interactive |

The `config` output tags custom rules as `(custom rules added alongside the defaults)` or `(custom rules replacing defaults)`.

Put `--settings <file>` before the subcommand: `claude --settings f.json auto-mode config` reads the file. `claude auto-mode config --settings f.json` stops with `error: unknown option '--settings'` and exit code 1. A probe got the same result on `2.1.314` and `2.1.316`.

### `claude auto-mode critique` Details

Source: the program, `chunk-bfce5cr2.js`.

- With no custom rules in `allow`, `soft_deny`, `hard_deny`, or `environment`, the command prints `No custom auto mode rules found.` and sends no request.
- Otherwise it sends one request to the model with the full classifier system prompt and your custom rules. `max_tokens` is 4096. The program prints the first text block of the reply.
- A long review can end in the middle of a word, because the reply stops at the 4096 token limit. The program does not ask for the rest.
- If the request fails, the program prints `Failed to analyze rules:` and the error text. A missing login shows the error of the request, for example `Could not resolve authentication method`.

### `/auto-mode-setup` Without the Dialog

The program also has a non-interactive form of `/auto-mode-setup`. It is the same in `2.1.314` and `2.1.316`. Source: the program, `chunk-vyxqch9k.js` and `chunk-9r1hbf9p.js:101010`.

It works in `-p` mode when `CLAUDE_CODE_REMOTE` is not set and a classifier model is set. The interactive command also needs the server-side auto mode config `envOnboarding: true`.

- `--wizard posture=<personal|open-source|enterprise|mixed> scope=<all|project> depth=<both|shell|repos|here> --propose` makes a proposal.
- `--expect-sha256 <64-hex> --apply-file <absolute-path>` applies a proposal file. The options `--request-id <uuid>` and `--apply-target user|project` are optional.
- The apply file must be in the system temp folder or the Claude config folder, and no `Read` deny rule can cover it. It must be a regular file of 1 MB or less with one hard link. The program does not follow a symbolic link. Its SHA-256 must match `--expect-sha256`.
- The program always writes to the user settings. `--apply-target` only checks that the scope of the proposal agrees.
- The program refuses the one-shot `--apply` with `One-shot --apply isn't available…`.

## Environment Variables

| Variable | Status | What it does | How it works | Scope |
| --- | --- | --- | --- | --- |
| `CLAUDE_CODE_AUTO_MODE_SERVER` | <Documented /> | Server-side review of auto mode actions | `0` removes `safeguards` from the requests and uses own classifier requests. `1` keeps `safeguards` also when `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`; then a reply with no verdict switches the session to the local classifier (runs on 2.1.319, see [The Server-Side Check](#the-server-side-check)). Needs `2.1.271` | Env |
| `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT` | <Documented /> | Removes the time limit of critical-path `rm` prompts | In auto mode these go to the classifier | Launch env only |
| `CLAUDE_CODE_AUTO_MODE_MODEL` | <Undocumented /> | Model of the classifier | A server-configured classifier model wins, and the program logs `ignoring CLAUDE_CODE_AUTO_MODE_MODEL=`. The program refuses `claude-sonnet-5-5`, `claude-opus-5-5`, and `claude-opus-5` as the value. If `ANTHROPIC_DEFAULT_SONNET_MODEL` names a 5.5 model, the program uses the Sonnet 5 default instead and says so (`chunk-yqezv9gr.js`) | Env |
| `CLAUDE_CODE_AUTO_MODE_FULL_CONTEXT` | <Undocumented /> | Keeps the full context for the auto mode check when the check judges only a set of MCP tools in another permission mode. New in `2.1.316` | See [Tools and Bash](../env-vars/tools-and-bash.md) | Env |
| `CLAUDE_CODE_BG_CLASSIFIER_MODEL` | <Undocumented /> | Classifier model for background sessions | Listed with the model env vars | Env |
| `CLAUDE_CODE_AUTO_MODE_TIER` | <Undocumented /> | Any value sets the tier to `strict` | Source `env` | Env |
| `CLAUDE_CODE_CLASSIFIER_SUMMARY` | <Undocumented /> | Chooses `llm` or `heuristic` summaries | The program parses a boolean. A hidden server-side flag picks the default | Env |
| `CLAUDE_CODE_TWO_STAGE_CLASSIFIER` | <Undocumented /> | No effect. The program lists it in its environment table as a boolean and no code reads it. The two-stage mode (`fast`, `thinking`, or `both`) comes from server config. `both` is the default | The program ignores the value | Env |
| `CLAUDE_CODE_AUTO_MODE_EXTERNAL_PERMISSIONS` | <Undocumented /> | No effect. The program lists the name in its environment table and no code reads it | The program ignores the value | Env |
| `CLAUDE_CHROME_CLASSIFIER_FLOOR` | <Undocumented /> | Turns the Chrome classifier floor on or off for auto mode | Used when set. When unset, the hidden server-side flag `tengu_cowork_chrome_automode_default` decides (default off). Project `env` can set it only to a true value | Env |
| `CLAUDE_CHROME_PERMISSION_MODE` | <Undocumented /> | Permission mode that the Claude in Chrome bridge uses | `ask`, `skip_all_permission_checks`, or `follow_a_plan`. Another value logs a warning. Claude Code sets `skip_all_permission_checks` for the Chrome native host when it skips permission checks. Project `env` can set it only to `ask` | Env |
| `CLAUDE_BG_SESSION_PERMISSION_RULES` | <Undocumented /> | JSON with `allow`, `deny`, `addDirs` for a background session | The program reads it when `CLAUDE_CODE_SESSION_KIND` is `bg`. The program removes it from the child env | Env |
| `CLAUDE_CODE_PARKED_PERMISSION_WAIT_MS` | <Undocumented /> | Wait for a parked permission | The default is `2000` | Env |
| `CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG` | <Undocumented /> | Own skills and commands cannot pre-approve tools | Personal hooks need existing rules | Env |

## How It Works

[Permission Flow](../../how-it-works/permission-flow.md) shows where the classifier sits: after the rules and hooks, only for calls that would otherwise ask.

## Related Pages

- [Auto Mode Default Rules](auto-mode-rules.md)
- [Permission Modes](modes.md)
- [Permission Rules](rules.md)
- [Subcommands](../cli/subcommands.md)
