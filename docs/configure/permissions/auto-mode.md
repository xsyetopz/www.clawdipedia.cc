---
title: Auto Mode
description: How the auto mode classifier decides, the autoMode setting, the claude auto-mode commands, and the related environment variables.
sidebar_position: 5
---

Auto mode lets Claude Code run without routine prompts. A classifier model reads each action and blocks what is risky, such as a deploy to production or a push of secrets. Tune the classifier with the `autoMode` setting when it blocks too much or too little for your setup.

Pick `auto` as the permission mode to turn it on. Set `permissions.defaultMode: "auto"` to start in it. Since `2.1.326`, if the served policy settings fail to load, a session that started in auto mode by the built-in default falls back to another mode. The mode is the `defaultMode` that policy settings name, other than `auto` or `bypassPermissions`. For an organization policy or HIPAA, the mode is `default`. A session that starts while the policy verdict is still pending picks its mode again when the verdict arrives, and the debug log says `startup resolved ... re-resolved to ...`.[^auto-fallback][^auto-reresolve] Set `permissions.disableAutoMode: "disable"` to turn it off. User settings, `--settings`, and managed settings can set `autoMode`. Project and local settings cannot, because both files live in the repository, where a checked-in repository or a build step could add its own allow rules.[^auto-sources][^official-project]

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

`$defaults` keeps the built-in entries at that place. A list without `$defaults` replaces them. Run `claude auto-mode config` to see the result.

## How the Classifier Decides

- The classifier is a model call. It reads the transcript, with your rules as its system prompt.
- By default it allows an action. It blocks an action that matches a `hard_deny` rule. It also blocks one that matches a `soft_deny` rule when no `allow` rule and no clear request from you clears it.
- `soft_deny` rules cover destructive or irreversible actions that your intent can clear. `hard_deny` rules are security boundaries that your intent does not clear.[^deny-kinds]
- If the classifier cannot answer, Claude Code blocks the call or sends it to a person. The texts are `Classifier unavailable` and `Auto mode classifier transcript exceeded context window - falling back to manual approval`.[^unavailable]
- Repeated denials trip a circuit breaker.
- A server-side classifier can review actions instead. See [The Server-Side Check](#the-server-side-check). Server lists can add rules. Claude Code ignores server entries that are not strings, are blank, or hold control characters.[^server-lists]

The default rule lists are on [Auto Mode Default Rules](auto-mode-rules.md).

### The Server-Side Check

Official page: [Server-Side Classifier Review](https://code.claude.com/docs/en/permission-modes#server-side-classifier-review). In auto mode, Claude Code can ask the server to judge each tool call, so no extra classifier request is needed.[^server-check]

- In auto mode, each main request has a top-level `safeguards` field, `[{"type": "dangerous_tool_use", "classifier_context": …}]`, and the betas `dangerous-tool-use-2026-09-03` and `afk-mode-2026-01-31`.[^server-check]
- The reply carries the verdict in `safeguard_results`, in `message_delta.delta` of a stream or at the top level of a plain reply. The verdict for each call is under the `tool_use` id.
- `not_flagged` runs the call. `flagged` denies it with `The server-side auto mode classifier judged this action dangerous (it gave no explanation)`, and `PermissionDenied` fires.
- With no verdict, Claude Code refuses each call that needs the check. The text with a gateway is `Auto mode can't check actions in this session. Its safety check runs on the server, and your requests go through <host>, which doesn't pass it through.` On a direct connection it is `…and the server isn't running it for this session.` The debug log has `[server-classifier] Bash: the server-side classifier does not run for this session (server_no_result) and no local one judges in its place`.[^server-check]
- `CLAUDE_CODE_AUTO_MODE_SERVER=0` and `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` each remove `safeguards` from the requests. Then Claude Code sends its own classifier requests (stage `xml_s1`, model `claude-sonnet-5[1m]` in the run).[^server-probe]
- `CLAUDE_CODE_AUTO_MODE_SERVER=1` wins over `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`: the requests keep `safeguards` and the beta `dangerous-tool-use-2026-09-03`. With both set and no verdict, Claude Code logs `[server-classifier] the platform gave no classification for this request (server_no_result); treating that as this deployment's answer: auto mode classifies locally for the rest of this session and stops sending the classifier context`, and then sends its own classifier requests (stages `xml_s1` and `xml_s2`). With only `CLAUDE_CODE_AUTO_MODE_SERVER=1`, no verdict refuses the call and no local classifier runs.[^server-probe]
- A gateway must pass the `anthropic-beta` value, `safeguards`, and `safeguard_results` through. A gateway that cannot do this answers `400 invalid_request_error` with a message that names `safeguards`. The client then sends the request again without them and runs the check itself.[^gateway-guide]

| Run (`-p --permission-mode auto`, the model calls `Bash` with `curl -s http://127.0.0.1:9/x`)[^server-probe] | Result |
| --- | --- |
| Direct connection (cc-inspect `apiHost: true, baseUrl: false`), verdict `not_flagged` | `curl` ran, `PostToolUse` fired |
| Direct connection, verdict `flagged` | Denied by the classifier, `PermissionDenied` fired |
| Direct connection, no verdict | Denied, `the server isn't running it for this session` |
| Stub base URL (a gateway), verdict `not_flagged` | `curl` ran, `PostToolUse` fired |
| Stub base URL, no verdict | Denied, `your requests go through 127.0.0.1:<port>, which doesn't pass it through` |
| `CLAUDE_CODE_AUTO_MODE_SERVER=0`, or `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1` with `CLAUDE_CODE_AUTO_MODE_SERVER` unset, verdict `not_flagged` | No `safeguards` field. Local classifier requests, and the `OK` stub reply gave `Auto mode could not evaluate this action and is blocking it for safety` |
| `CLAUDE_CODE_AUTO_MODE_SERVER=1` and `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`, no verdict | `safeguards` sent. After `server_no_result`, local classifier requests (`xml_s1`, `xml_s2`) for the rest of the session |

The cc-inspect `code` action `cli` makes these runs, with `calls: [{"name": "Bash", "input": {"command": "curl -s http://127.0.0.1:9/x"}, "safeguard": "not_flagged"}]`.

### The Two Stages

The classifier can ask in two stages. A short first stage clears most calls, and a full second stage judges the rest.[^stages] See [Probes](../../reference/probes.md#auto-mode).

1. Server config picks the mode: `fast` (stage 1 only), `thinking` (stage 2 only), or `both`. The default is `both`. A site that uses severity scores always uses `both`.[^stage-flag]
2. Stage 1 is a short request. `max_tokens` is 64, or 256 in `fast` mode, plus the thinking budget. The stop sequence is `</severity>` in severity mode and `</block>` in block mode. `fast` mode sends no stop sequence. The prompt tells the model that stage 1 does not apply user intent.
3. Stage 1 blocks when the severity is more than threshold 1, or when it answers `<block>yes`. It allows only when the reply stops at the stop sequence or at `end_turn`, and the reply is the bare tag. The result text is `Allowed by fast classifier`. Any other reply goes to stage 2.
4. Stage 2 is a full request. `max_tokens` is 8192 plus the thinking budget, with no stop sequence. It blocks when the severity is more than threshold 2. A reply it cannot parse blocks.
5. Parse rules: the program removes thinking blocks. A severity reply must hold exactly one `<severity>N</severity>`. A block reply must hold `<block>yes</block>` or `<block>no</block>`. The category must be one of a known set.

| Item | Value |
| --- | --- |
| Severity thresholds | Server config `severityByModel` or `severityBySite`. With the feature-flag client off, the built-in values apply: `claude-sonnet-5` stage 1 `25`, stage 2 `35`. `claude-opus-4-8` stage 1 `45`, stage 2 `35`. The `[1m]` forms have the same values. The fallback values are `15` and `20`[^stage-defaults] |
| Models with no threshold | Block mode (`<block>yes` or `no`), for example Haiku models[^stage-code] |
| Thinking | Models in a built-in list get `thinking: {type: "disabled"}` and budget `0`. The list holds the Claude 3 models, Opus 4 to 4.8, Opus 5, Sonnet 4 to 4.6, Sonnet 5, and Haiku 4.5. Other models get no `thinking` field and 2048 more tokens. For example, stage 1 on Haiku 5.5 asks for 2112 tokens[^stage-think] |
| Retries | Server config `maxRetries`, default `4`. A stage sends its request again while the reply cannot be parsed, so a stage sends up to 5 requests. A capture with an unparseable stub reply showed 5 stage 1 requests at 64 tokens and 5 stage 2 requests at 8192 tokens[^stage-code] |
| Time limits | 60 seconds per request. For a long transcript, 10 more seconds per 50,000 tokens over 50,000, with a maximum of 120 seconds. Stage 2 has a deadline of 120 seconds[^stage-code] |
| Errors | Stage 1 error: `Classifier unavailable - blocking for safety`. Stage 2 error: `Stage 2 classifier error - blocking based on stage 1 assessment`. Transcript too long: `Classifier transcript exceeded context window`[^stage-code] |

:::note[Prompt Text and Thresholds]
The classifier prompt names 50 as the block boundary. Claude Code compares the score with the thresholds in the table, not with 50.
:::

`CLAUDE_CODE_AUTO_MODE_TEMPERATURE` is read as a number with the default `1`. The captured classifier requests had no `temperature` field, so no effect is known for it.[^stage-probe]

### Broad Allow Rules in Auto Mode

When a session enters auto mode, Claude Code removes allow rules that would let calls skip the classifier. These are broad rules that grant arbitrary code execution, such as `Bash(*)`, a wildcard interpreter like `Bash(python*)`, package-manager run commands, and `Agent` and `Monitor` allow rules.[^official-broad] Claude Code removes them from all sources and logs `Ignoring dangerous permission <rule> from <source> (bypasses classifier)`. It puts them back when the session leaves auto mode.[^broad-rules] The official page [How Auto Mode Evaluates Actions](https://code.claude.com/docs/en/permission-modes#how-auto-mode-evaluates-actions) gives a shorter list.

Claude Code removes these allow rules:

- A `Bash` rule with no content, or a bare `*`.
- A `Bash` rule for an interpreter or a command runner, in the forms `x`, `x:*`, `x *`, `x*`, or `x -…*`: `python`, `python3`, `python2`, `node`, `deno`, `tsx`, `ruby`, `perl`, `php`, `lua`, `npx`, `bunx`, `npm run`, `yarn run`, `pnpm run`, `bun run`, `bash`, `sh`, `zsh`, `fish`, `ssh`, `eval`, `exec`, `env`, `xargs`, `sudo`. A `python -m <module>` rule stays.
- A `PowerShell` rule for an interpreter or a cmdlet that runs code, also in the `.exe` forms.
- Allow rules for the `Agent` and `Monitor` tools, the REPL tool, and some MCP tools.
- Every `Bash` and `PowerShell` allow rule, when `autoMode.classifyAllShell` is `true`.
- Since `2.1.326`, a `Bash` wildcard rule when its program word is not a plain name.[^odd-word] That is the case when the text before the `*` has no program, or when the word has a character other than letters, digits, `_`, `.`, `+`, `@`, `%`, `,`, `:`, `~`, `/`, and `-`, such as `$HOME`. It is also the case when the word is a variable assignment such as `NAME=value`. If the `*` touches the last word, a word that starts with `~`, `/`, `\`, or a drive letter, or that has a `..` segment, counts too. The safety check then decides these commands. A rule without a `*` stays.
- Since `2.1.326`, a `Bash` wildcard rule whose program is a Windows path with backslashes, such as `C:\tools\git.exe *`. The rule goes, and the safety check decides those calls. An exact rule keeps its allow.[^win-path]

### Classifier Billing Notice

When auto mode falls back from the server-side classifier to its own classifier requests, which are billed, Claude Code can show a notice. The title is `We're changing auto mode to no longer charge for classifier requests in Claude Code.` The text says `However, this session isn't eligible.` and links to [Auto Mode Classifier Billing](https://code.claude.com/docs/en/auto-mode-classifier-billing).[^billing]

- When Claude Code detects a gateway, the text names its host. It detects a base URL host outside `anthropic.com`, a custom provider base URL, or the gateway URL. It knows some gateways by name, such as LiteLLM, Helicone, Portkey, Cloudflare AI Gateway, Kong, Braintrust, Bifrost, and Databricks.
- When the Claude desktop app manages the provider and turned the gateway check on, the title is `Auto mode switched to its built-in safety check for this session`. This form is new in `2.1.316`.
- In an interactive session, it is a dialog: you continue or interrupt. If you interrupt, the result is `Cancelled at the classifier billing notice`. With no dialog surface, Claude Code logs the fallback and continues.
- In `-p` mode, it goes to stderr. With `--output-format stream-json --verbose`, it is a warning event.

Claude Code shows it only when all of these are true:

- A hidden server-side flag is on. The default is on.[^billing-flag]
- The plan is not Pro, Max, or Team.
- No gateway was detected. Or there is a gateway, and you did not accept the notice (`autoModeClassifierBillingNoticeAcknowledgedAt`) in the last 24 hours.

On `2.1.319`, Claude Code asks for the notice only after a refusal of the server-side check sets a latch for the rest of the session.[^billing-latch] Three interactive runs with a custom base URL did not show the notice:

| Setup | Hypothesis | Result |
| --- | --- | --- |
| No verdict from the stub[^billing-probe] | The notice shows, as on 2.1.316. | The dialog `Auto mode can't check actions in this session` showed. The notice did not. |
| HTTP 400 to the dangerous-tool-use beta, with `--debug-file`[^billing-probe] | The refusal starts the local classifier and the notice. | The debug file logged `the platform rejected a beta on this request (HTTP 400) ... auto mode decides with the local classifier`. The dialog `Auto mode can't check actions in this session` showed. The notice did not. |
| `CLAUDE_CODE_AUTO_MODE_SERVER=0`[^billing-probe] | Local classifier requests start the notice. | No notice, no `Notification`, and no `safeguards` field in the requests. The local classifier got no usable answer from the stub, and the screen showed `Not run · auto mode's check had no usable answer`. |

## The `autoMode` Setting

Official pages: [Choose a Permission Mode](https://code.claude.com/docs/en/permission-modes) and [Configure Auto Mode](https://code.claude.com/docs/en/auto-mode-config).

| Key | Status | What it does | How it works | Scope |
| --- | --- | --- | --- | --- |
| `autoMode.allow` | <Documented /> | Exceptions to the soft deny rules | The value is a list of strings. `$defaults` inherits the built-in rules at that place | User, `--settings`, managed |
| `autoMode.soft_deny` | <Documented /> | Block rules that user intent can clear | Same list rules | Same |
| `autoMode.hard_deny` | <Documented /> | Block rules that no intent clears | Same list rules | Same |
| `autoMode.environment` | <Documented /> | Facts about your setup and trusted resources | Same list rules | Same |
| `autoMode.classifyAllShell` | <Documented /> | Suspends every `Bash` and `PowerShell` allow rule in auto mode | All shell commands go to the classifier. The default is `false`. Claude Code reads user, `--settings`, and managed settings. The flag is on if any of them is `true`. `false` is the same as unset, so it cannot turn the flag off. Claude Code does not read project and local settings[^classify-all] | User, `--settings`, managed |
| `permissions.disableAutoMode` | <Documented /> | Turns auto mode off | The value is `disable`, the only accepted value | Settings |
| `skipAutoPermissionPrompt` | <Documented /> | The user accepted the opt-in dialog | Boolean | Settings |
| `useAutoModeDuringPlan` | <Documented /> | Plan mode uses auto semantics | The default is `true` | Settings |
| `permissions.defaultMode: "auto"` | <Documented /> | Start in auto mode | It does not come from project or local settings | User, managed |

The plugin `settings.json` does not accept `autoMode`.

:::note[Which Sources Count]
Only user, `--settings`, and managed settings can set the rules. Claude Code ignores rules in `.claude/settings.json` and `.claude/settings.local.json`.[^sources-probe] Managed settings also apply, from `managed-settings.json` and `managed-settings.d/`. Claude Code joins lists from all sources. User or `--settings` rules come first, and managed rules come after. `$defaults` expands where it sits. A list with no `$defaults` in any source has no built-in rules. See [Probes](../../reference/probes.md#configure-and-memory).

A managed `autoMode.allow` list with no `$defaults` replaces the built-in allow rules. Then Claude Code strips `$defaults` from the `autoMode.allow` list of a `--settings` file, so that file cannot add the built-ins back. It also strips it when a managed settings file has a load error at `autoMode` or `autoMode.allow`, or fails to load as a whole. No probe checked this case, because managed settings need a root-owned folder. The "Scheduled-Task Fires" allow rule stays when an allow list replaces the defaults.[^strip-defaults]

The [official docs](https://code.claude.com/docs/en/auto-mode-config) confirm this only for `classifyAllShell` (user and `--settings`). A managed `true` for `classifyAllShell` wins over `false` in user settings or `--settings`. A managed `false` does not cancel `true` in user settings or `--settings`. Claude Code reads no other source. From `2.1.319`, a test of this needs `CLAUDE_CODE_AUTO_MODE_SERVER=0`.[^classify-probe] See [Probes](../../reference/probes.md#auto-mode).
:::

## The `claude auto-mode` Commands

| Command | Status | What it does | How it works | Scope |
| --- | --- | --- | --- | --- |
| `claude auto-mode defaults` | <Documented /> | Prints the default `environment`, `allow`, `soft_deny`, and `hard_deny` as JSON | Option `--label <prefix>` shows only rules whose label starts with the prefix, without regard to case. With no `autoMode` in any source, the output is the same as `config` [^defaults-probe] | CLI |
| `claude auto-mode config` | <Documented /> | Prints the effective config as JSON | It uses your settings where set and defaults elsewhere | CLI |
| `claude auto-mode critique` | <Documented /> | Asks a model to review your custom rules | Option `--model <model>`. It checks clarity, completeness, conflicts, and actionability | CLI |
| `claude auto-mode reset` | <Documented /> | Removes `autoMode` from the user settings file | Option `-y, --yes` skips the prompt | CLI |
| `/auto-mode-setup` | <Documented /> | Scans the project and recent sessions, and proposes `autoMode` rules | Shows `Auto-mode setup proposal is ready for review`. Since `2.1.304` it is also on Bedrock, Vertex, Foundry, a Claude apps gateway, and with telemetry off. `skillOverrides["auto-mode-setup"]: "off"` turns it off.[^setup-off] | Interactive |

The `config` output tags custom rules as `(custom rules added alongside the defaults)` or `(custom rules replacing defaults)`.

Put `--settings <file>` before the subcommand: `claude --settings f.json auto-mode config` reads the file. `claude auto-mode config --settings f.json` stops with `error: unknown option '--settings'` and exit code 1. A probe got the same result on `2.1.314` and `2.1.316`.[^settings-order]

### `claude auto-mode critique` Details

Use `critique` to find unclear or conflicting rules before you rely on them.[^critique]

- With no custom rules in `allow`, `soft_deny`, `hard_deny`, or `environment`, the command prints `No custom auto mode rules found.` and sends no request.
- Otherwise it sends one request to the model with the full classifier system prompt and your custom rules. `max_tokens` is 4096. Claude Code prints the first text block of the reply.
- A long review can end in the middle of a word, because the reply stops at the 4096 token limit. Claude Code does not ask for the rest.
- If the request fails, Claude Code prints `Failed to analyze rules:` and the error text. A missing login shows the error of the request, for example `Could not resolve authentication method`.

### `/auto-mode-setup` Without the Dialog

`/auto-mode-setup` also has a non-interactive form. It is the same in `2.1.314` and `2.1.316`.[^setup-form]

It works in `-p` mode when `CLAUDE_CODE_REMOTE` is not set and a classifier model is set. The interactive command also needs the server-side auto mode config `envOnboarding: true`.

- `--wizard posture=<personal|open-source|enterprise|mixed> scope=<all|project> depth=<both|shell|repos|here> --propose` makes a proposal.
- `--expect-sha256 <64-hex> --apply-file <absolute-path>` applies a proposal file. The options `--request-id <uuid>` and `--apply-target user|project` are optional.
- The apply file must be in the system temp folder or the Claude config folder, and no `Read` deny rule can cover it. It must be a regular file of 1 MB or less with one hard link. Claude Code does not follow a symbolic link. Its SHA-256 must match `--expect-sha256`.
- Claude Code always writes to the user settings. `--apply-target` only checks that the scope of the proposal agrees.
- Claude Code refuses the one-shot `--apply` with `One-shot --apply isn't available…`.

## Environment Variables

| Variable | Status | What it does | How it works | Scope |
| --- | --- | --- | --- | --- |
| `CLAUDE_CODE_AUTO_MODE_SERVER` | <Documented /> | Server-side review of auto mode actions | `0` removes `safeguards` from the requests and uses own classifier requests. `1` keeps `safeguards` also when `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1`; then a reply with no verdict switches the session to the local classifier (runs on `2.1.319`, see [The Server-Side Check](#the-server-side-check)). Needs `2.1.271` | Env |
| `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT` | <Documented /> | Removes the time limit of critical-path `rm` prompts | In auto mode these go to the classifier | Launch env only |
| `CLAUDE_CODE_AUTO_MODE_MODEL` | <Undocumented /> | Model of the classifier | A server-configured classifier model wins, and Claude Code logs `ignoring CLAUDE_CODE_AUTO_MODE_MODEL=`. Claude Code refuses `claude-sonnet-5-5`, `claude-opus-5-5`, and `claude-opus-5` as the value. If `ANTHROPIC_DEFAULT_SONNET_MODEL` names a 5.5 model, Claude Code uses the Sonnet 5 default instead and says so.[^model-env] | Env |
| `CLAUDE_CODE_AUTO_MODE_FULL_CONTEXT` | <Undocumented /> | Keeps the full context for the auto mode check when the check judges only a set of MCP tools in another permission mode. New in `2.1.316` | See [Tools and Bash](../env-vars/tools-and-bash.md) | Env |
| `CLAUDE_CODE_BG_CLASSIFIER_MODEL` | <Undocumented /> | Classifier model for background sessions | Listed with the model env vars | Env |
| `CLAUDE_CODE_AUTO_MODE_TIER` | <Undocumented /> | Any value sets the tier to `strict` | The tier source is `env` | Env |
| `CLAUDE_CODE_CLASSIFIER_SUMMARY` | <Undocumented /> | Chooses `llm` or `heuristic` summaries | Claude Code parses a boolean. A hidden server-side flag picks the default when it is unset[^summary-flag] | Env |
| `CLAUDE_CODE_TWO_STAGE_CLASSIFIER` | <Undocumented /> | No effect. The two-stage mode (`fast`, `thinking`, or `both`) comes from server config. `both` is the default | Claude Code ignores the value.[^ignored-env] | Env |
| `CLAUDE_CODE_AUTO_MODE_EXTERNAL_PERMISSIONS` | <Undocumented /> | No effect | Claude Code ignores the value.[^ignored-env] | Env |
| `CLAUDE_CHROME_CLASSIFIER_FLOOR` | <Undocumented /> | Turns the Chrome classifier floor on or off for auto mode | Used when set. When unset, a hidden server-side flag decides (default off). Project `env` can set it only to a true value[^chrome-flag] | Env |
| `CLAUDE_CHROME_PERMISSION_MODE` | <Undocumented /> | Permission mode that the Claude in Chrome bridge uses | `ask`, `skip_all_permission_checks`, or `follow_a_plan`. Another value logs a warning. Claude Code sets `skip_all_permission_checks` for the Chrome native host when it skips permission checks. Project `env` can set it only to `ask` | Env |
| `CLAUDE_BG_SESSION_PERMISSION_RULES` | <Undocumented /> | JSON with `allow`, `deny`, `addDirs` for a background session | Claude Code reads it when `CLAUDE_CODE_SESSION_KIND` is `bg`. It removes the variable from the child env[^bg-rules] | Env |
| `CLAUDE_CODE_PARKED_PERMISSION_WAIT_MS` | <Undocumented /> | Wait for a parked permission | The default is `2000` | Env |
| `CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG` | <Undocumented /> | Own skills and commands cannot pre-approve tools | Personal hooks need existing rules | Env |

## How It Works

[Permission Flow](../../how-it-works/permission-flow.md) shows where the classifier sits: after the rules and hooks, only for calls that would otherwise ask.

## Related Pages

- [Auto Mode Default Rules](auto-mode-rules.md)
- [Permission Modes](modes.md)
- [Permission Rules](rules.md)
- [Subcommands](../cli/subcommands.md)

## Sources

[^auto-sources]: The `autoMode` schema text and the program.
[^deny-kinds]: The `autoMode` schema text.
[^unavailable]: The program.
[^server-lists]: The program.
[^server-check]: The program, `2.1.319`. `chunk-c39c4txm.js@29336` parses the verdict, `chunk-2x9ma4k7.js@3156866` reads it from the stream, and `chunk-2x9ma4k7.js@3385693` acts on it.
[^server-probe]: Probe cases `print.automode.classifier-server.server-1`, `print.automode.classifier-server.server-1-betas-off`, and `print.automode.classifier-server.betas-off`, run on `2.1.319`.
[^gateway-guide]: The program, `chunk-xqw0kbdk.js@1497453`. The gateway guide in the program says this.
[^stages]: The program, `chunk-2x9ma4k7.js` (the classifier) and `chunk-xmxh26v7.js` (the defaults). A probe captured the requests.
[^stage-flag]: The program. Server config `tengu_auto_mode_config.twoStageClassifier` picks the mode.
[^stage-defaults]: The program, `chunk-xmxh26v7.js`.
[^stage-code]: The program, `chunk-2x9ma4k7.js`.
[^stage-think]: The program, `chunk-x4fdscgs.js`.
[^stage-probe]: The program, `chunk-2x9ma4k7.js`, and a probe that captured the classifier requests.
[^official-project]: [Auto Mode Configuration](https://code.claude.com/docs/en/auto-mode-config) in the official docs.
[^official-broad]: [Permission Modes](https://code.claude.com/docs/en/permission-modes) in the official docs.
[^broad-rules]: The program, `chunk-r2xdymmc.js` and `chunk-b8q0kwgb.js`.
[^billing]: The program, `chunk-2x9ma4k7.js@1500321` to `@1501302`, `chunk-64gae3y3.js@4372`, and `chunk-dj7ngekh.js@1905`, `2.1.319`.
[^billing-flag]: The program. The flag is `tengu_velvet_heron`.
[^billing-latch]: The program, `chunk-2x9ma4k7.js@3383202`.
[^billing-probe]: Probe cases `pty.notifications.agent-needs-input`, `pty.notifications.agent-needs-input-refused`, and `pty.notifications.auto-mode-local`, in table order.
[^classify-all]: The program.
[^sources-probe]: A probe ran `claude auto-mode config` with `autoMode.allow` set in each source. The program logs `tengu_settings_auto_mode_rules_untrusted_source_ignored` for an ignored source. Its message says only policy, user, and flag settings may set the rules. The run did not check `classifyAllShell`, because it is not in the `auto-mode config` output.
[^strip-defaults]: The program, `chunk-rqvvpwt0.js` and `chunk-fxkn94rg.js`.
[^classify-probe]: A probe counted classifier requests for a `curl` command that a user allow rule covered. The count was 1 with `true` in user settings or `--settings`, and 0 with `false` or unset. A managed `false` with `true` in user settings or `--settings` gave 1. A managed `true` gave 1 in every case. Without `CLAUDE_CODE_AUTO_MODE_SERVER=0` on `2.1.319`, a stub that gives the server-side check no verdict gets no classifier request.
[^defaults-probe]: A probe with the cc-inspect `code` action `cli`.
[^setup-off]: The program.
[^settings-order]: A probe on `2.1.314` and `2.1.316`.
[^critique]: The program, `chunk-ehm6jcnf.js`.
[^setup-form]: The program, `chunk-qmz13t7c.js` and `chunk-2x9ma4k7.js:107357`.
[^model-env]: The program, `chunk-x4fdscgs.js`.
[^summary-flag]: The program.
[^ignored-env]: The program lists the name in its environment table as a boolean, and no code reads it.
[^chrome-flag]: The program. The flag is `tengu_cowork_chrome_automode_default`.
[^bg-rules]: The program.
[^auto-reresolve]: The program, `chunk-88d8nvn3.js:1255-1285`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^auto-fallback]: [2.1.326 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326). The program, `chunk-mdf23c0f.js:76-82` and `:116-135`, which logs `[auto-mode] the built-in auto default gave way to ... served settings failed`. The program skips the fallback when `CLAUDE_CODE_BRIDGE_CHILD_AUTO_DEFAULT` is set. The release note also says terminal and VS Code sessions with no mode set start in auto mode when the policy has not loaded. The cleaned code does not show that start, so this page does not state it.
[^odd-word]: [2.1.326 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326). The program, `chunk-88hf417t.js:28` calls `chunk-3q9v3gt8.js:590-616`. The rule applies to `Bash` only. A run of the same expressions on sample rules, such as `$HOME *`, `~/bin/x*`, and `FOO=1 *`, removed them. It kept `git *`, `~/bin/x *`, and `/usr/bin/git *`.
[^win-path]: [2.1.326 release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326). The program, `chunk-3q9v3gt8.js:593-598` and `:599-616`. A backslash is not in the set of plain characters, so a wildcard rule with a backslash path as its program goes. The release note also says Claude Code plans to restore rules that start with `.\`. The cleaned code does not show that, so this page does not state it.
