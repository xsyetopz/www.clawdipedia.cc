---
title: Secret Masking
description: How Claude Code finds secrets in text and replaces them with a marker, with the rule table, the tiers, and the order.
sidebar_position: 12
---

Claude Code masks text that looks like a secret before it shows or records the text.
It replaces the secret with `[REDACTED]`. This page describes the algorithm and the rule table, not each pattern. The program has no setting that turns masking on or off. To keep a secret out of the places where masking does not apply, see [Outputs That Keep the Secret](#outputs-that-keep-the-secret).
Every row is <Undocumented />.

## The Rule Table

One table holds 65 rules. Each rule has an `id`, a `source` pattern, and a `confidence` tier.
Some rules also have a `prefilter` (a cheap test that runs first), a `run` or `displayRun` (a character class for long runs), and `redactOnly`.

| Tier | Rules | What the rules match |
| --- | --- | --- |
| `low` | 13 | Context rules. Examples: `url-userinfo`, `sensitive-assign`, `cloud-env-var`, `http-auth-scheme`, `loose-jwt`, `loose-anthropic-key`, `gcp-service-account`. |
| `high` | 52 | Token rules for one vendor format. Examples: `aws-access-token`, `github-pat`, `anthropic-api-key`, `openai-api-key`, the `gitlab-*` family, the `slack-*` family, `stripe-access-token`. |

The table order is the order of use. The `low` rules come first, then the `high` rules, from `aws-access-token` to `shopify-shared-secret`.

## Passes

| Pass | What it does |
| --- | --- |
| `redactContext(text, includeRedactOnly)` | First it masks private-key blocks. Then it applies each `low` rule in table order. A `redactOnly` rule runs only when the flag is `true`. A rule with a `prefilter` runs only when the prefilter matches. The marker keeps the key name or prefix, and keeps one pair of quotes around the value. |
| `redactTokens(text)` | Applies each `high` rule in table order. A rule is skipped when its `prefilter` does not match. |
| `redact(text)` | Finds URL ranges first. With none, it runs `redactContext` with `redactOnly` rules on, then `redactTokens`. With URL ranges, it tracks the matches so that the URL stays readable. It caches the result for short strings. |
| `redactForDisplay(text)` | A separate rule set that uses only the `high` tier. It leaves a match alone when the matched text holds a shell character (`$`, a backtick, `\|`, `;`, `&`, `<`, `>`, `(`, `)`, a space) or a path character (`/`, `.`, `@`, `:`, `~`, `*`, `?`, `\`). So a command or a path does not break. |

A `high` rule matches only when no letter, digit, `_`, or `-` comes before it. After it, no letter, digit, `_`, `-`, `+`, or `=` may follow.
A rule with a run class matches a token that is split by a long run of that class, and it reads the whole run.
The program sizes its work on long text in units of 16,384 characters.

## Private Keys

A separate reader looks for the text `-----BEGIN`, with no case check on the word, and any number of extra `-` characters.
It reads each block to its end and replaces the whole block with `[REDACTED]`. It runs before the `low` rules.

## High Tier Rule Names

The `high` rules cover these vendors.[^rule-table] The `gitlab-*` family has 11 rules, such as `gitlab-pat`, `gitlab-deploy-token`, and `gitlab-ci-build-token`.

| Vendor | Rule names |
| --- | --- |
| Amazon, Google, Azure | `aws-access-token`, `gcp-api-key`, `google-oauth-client-secret`, `azure-ad-client-secret` |
| Anthropic, OpenAI, Hugging Face | `anthropic-api-key`, `anthropic-admin-api-key`, `anthropic-oauth-token`, `openai-api-key`, `openai-legacy-api-key`, `huggingface-access-token` |
| GitHub | `github-pat`, `github-fine-grained-pat`, `github-app-token`, `github-oauth`, `github-refresh-token` |
| Slack | `slack-bot-token`, `slack-user-token`, `slack-rotation-token`, `slack-app-token`, `slack-workflow-token`, `slack-webhook-url` |
| Grafana, Sentry | `grafana-api-key`, `grafana-cloud-api-token`, `grafana-service-account-token`, `sentry-user-token`, `sentry-org-token` |
| Other | `digitalocean-pat`, `digitalocean-access-token`, `supabase-secret-key`, `supabase-access-token`, `twilio-api-key`, `sendgrid-api-token`, `npm-access-token`, `pypi-upload-token`, `databricks-api-token`, `hashicorp-tf-api-token`, `pulumi-api-token`, `postman-api-token`, `stripe-access-token`, `shopify-access-token`, `shopify-shared-secret` |

## Low Tier Rule Names

| Rule | What it masks |
| --- | --- |
| `url-userinfo`, `url-userinfo-tail`, `url-userinfo-later-at`, `url-userinfo-encoded` | The user name and password part of a URL (`://user:pass@host`), also when the `@` is written as `%40`. |
| `sensitive-assign` | The value in `name=value` or `name: value` when the name holds a sensitive word. |
| `sensitive-assign-escaped` | The same, when quotes in the text are escaped with a backslash. `redactOnly`. |
| `cloud-env-var` | The value of a variable that starts with `AWS`, `GOOGLE`, `GCP`, `GCLOUD`, or `AZURE` and an underscore. |
| `http-auth-scheme` | A `Bearer` or `Basic` credential of 20 or more characters. |
| `loose-jwt` | A JSON Web Token that starts with `eyJ`. |
| `loose-anthropic-key` | Text that starts with `sk-ant` and has 10 or more key characters. |
| `gcp-service-account` | A Google service account address that ends in `.iam.gserviceaccount.com`. |
| `masked-value-rest`, `anthropic-signed-key-rest` | The part of a value that stays after an earlier rule masked its start. `anthropic-signed-key-rest` is `redactOnly`. |

A name is sensitive when it holds one of these words, with no case check: `api_key`, `secret`, `token`, `password`, `passwd`, `credential`, `bearer`, `authorization`, `auth_header`, `cookie`, `session_id`, `session_key`, `connection_string`, `client_secret`, or a `private`, `ssh`, `encryption`, `signing`, `access`, `deploy`, `master`, or `license` key. The words may be joined with `_` or `-`, or with nothing.

## Where It Applies

No setting or environment variable that turns masking on or off was found in the program.
The table shows the output that each caller masks.

| Output | Function |
| --- | --- |
| Each line of the debug log, and each line of the second log file (`[time] [level] message`, which turns over at 10 MiB)[^where-1] | `redact` |
| The `error` and `debug` lines in the log files of an MCP server[^where-2] | `redact` |
| The `error_message` (cut to 2,000 characters) and `error_stack` (cut to 4,000 characters) of an error report[^where-3] | `redact` |
| The hook name and the stderr text of a hook that fails[^where-4] | `redact` |
| A `/feedback` report: the error list, the debug log text, the error messages and stacks, the upload error, the description, and the transcript in the bundle[^where-5] | `redact` |
| The title and body of a bug report GitHub issue[^where-6] | `redact` |
| The validation error of a plugin manifest[^where-7] | `redact` |
| The roster name in a fork message[^where-8] | `redact` |
| The debug line for data written to the stdin of a child process[^where-9] | `redact` |
| A suggested reply. The program drops it when masking changes it.[^where-10] | `redact` |
| A web URL in `claude mcp add`. The program refuses it (`secret_in_url`) when masking changes it.[^where-11] | `redact` |
| The auto mode check input. The program compares the masked text with the input to find the secret spans.[^where-12] | `redact` |
| An MCP server config that the program shows[^where-13] | `redact`, on each key and value |
| The preview of tool input, including the field names[^where-14] | `redactForDisplay` |
| The path, the description, and the skill summary in a permission request that the program sends to a connected client[^where-15] | `redactForDisplay` |
| The command, the description, and the plan reason in a remote or push permission notice[^where-16] | `redactContext` then `redactTokens` |
| The tool description in a push notification from Remote Control or a cloud session[^where-masker] | `redactContext` then `redactTokens`. The masker keeps a `://[REDACTED]` host marker when a `.` or `-` follows it. |
| The detail, intent, and latest question of a background job (1,000 and 600 characters), and the tail of its output[^where-18] | `redactContext` with tracked tokens, and `redactTokens` |

More calls to `redact` mask a job detail, a task summary line, or a session or job name.[^more-calls] The masker class is the only copy in the program.

### Outputs That Keep the Secret

Masking does not apply to the text of your prompt or to tool output in these outputs.
A probe sent a prompt with a fake GitHub token in the `github-pat` shape (`ghp_` and 36 letters). That shape is a `high` rule.
The full token stayed in each of these outputs:

| Output | Probe setting |
| --- | --- |
| The Messages API request that goes to the model | `-p` against a local stub |
| The session transcript, `projects/<project>/<session>.jsonl` in the config folder | The same run |
| The `tool_result` in the next Messages API request, the `stream-json` output, and the transcript | `-p --allowedTools Bash`. The stub made the model run `printf 'ghp_%s%s' <half> <half>`, so the full token was only in the tool output. |

These results come from probes of the program.[^leak-probe]
To keep a secret out of these outputs, do not put it in a prompt, and do not let a tool print or read it.

The OpenTelemetry `user_prompt` event shows `<REDACTED>` in place of the prompt unless `OTEL_LOG_USER_PROMPTS` is set. With it set, the program passes the prompt through its filter for account memory text. The code of that path does not call `redact`, so a secret in the prompt stays.[^otel-prompt]

## Secret Scan

The `scan` function does not change text. It returns the label of each `high` rule that matches, and a `Private Key` label for a private-key block.
A label comes from the rule name. The program spells some words in a fixed way: `GitHub`, `GitLab`, `OpenAI`, `HuggingFace`, `DigitalOcean`, `HashiCorp`, `SendGrid`, `NPM`, `PyPI`, `AWS`, `GCP`, `API`, `PAT`, `AD`, `TF`, `OAuth`, `JWT`, `CI`, and `SCIM`.
Example: the rule `github-pat` has the label `GitHub PAT`.

The program uses the scan in four places.

| Place | Result |
| --- | --- |
| A write to a memory file[^scan-memory] | The write fails with `Content contains potential secrets (<labels>) and cannot be written to memory.` The text then names the reason. A team memory file says that team memory is shared with all repository collaborators. A memory file says that memory is synced to your account. |
| A command in an auto mode denial notice[^scan-denial] | When the scan finds a secret in the command, the tool input, or the reason, the notice shows no command and no reason. The notice also shows none when the check itself fails. |
| The files of a skill package folder[^scan-skill] | The program gets the labels for each file. All `anthropic-*` rules give one label. |

## Related Pages

- [Transcript Format](transcript-format.md)
- [Probes](probes.md)

## Sources

[^where-1]: The program, `chunk-rq7vgh0h.js:38098`, `chunk-mq5tkwp3.js:546`.
[^where-2]: The program, `chunk-mnc5rjsz.js:2790` (the `error` line) and `chunk-mnc5rjsz.js:3031` (the `debug` line).
[^where-3]: The program, `chunk-56bhcxay.js:391140` (the message) and `chunk-56bhcxay.js:391715` (the stack).
[^where-4]: The program, `chunk-56bhcxay.js:1235898` (the hook name) and `chunk-56bhcxay.js:1236161` (the stderr text).
[^where-5]: The program, `chunk-yv54xvss.js:17590-30557`: the error list at `chunk-yv54xvss.js:17590`, the debug log text at `chunk-yv54xvss.js:19410`, the error messages and stacks at `chunk-yv54xvss.js:21435`, the upload error at `chunk-yv54xvss.js:23336`, the description at `chunk-yv54xvss.js:24360`, and the transcript at `chunk-yv54xvss.js:29529-30557`.
[^where-6]: The program, `chunk-zn693w3h.js:12431` (the title) and `chunk-zn693w3h.js:12443` (the body).
[^where-7]: The program, `chunk-5sxh0dm8.js:9932`.
[^where-8]: The program, `chunk-5e06b4s2.js:31239` and `chunk-5e06b4s2.js:31675`.
[^where-9]: The program, `chunk-b2j77k2b.js:12203`.
[^where-10]: The program, `chunk-2742jms1.js:5529`.
[^where-11]: The program, `chunk-9t1jqzwd.js:25560`.
[^where-12]: The program, `chunk-56bhcxay.js:5864871` (the masked text is compared with the input in `cRt()`, which starts at `chunk-56bhcxay.js:5864555`). The program calls `cRt()` when the server classifier rewrites the tool input, at `chunk-56bhcxay.js:3691181` and `chunk-56bhcxay.js:5865642`.
[^where-13]: The program, `chunk-4nj280gz.js:34684-35332`.
[^where-14]: The program, `chunk-mwfcwvmn.js:2790-5481`: the field names at `chunk-mwfcwvmn.js:2790` and the values at `chunk-mwfcwvmn.js:5481`.
[^where-15]: The program, `chunk-6qx4m5tj.js:39829` (the path), `chunk-6qx4m5tj.js:41967` (the skill), and `chunk-6qx4m5tj.js:44240` (the description and the skill summary). The description is the tool summary that `Ojr()` builds with `redactForDisplay` (`chunk-mwfcwvmn.js:7617`, which calls `W` at `chunk-mwfcwvmn.js:7309`), set at `chunk-6qx4m5tj.js:41903`. The module that sends the request imports only `JJ` (`redactForDisplay`, `chunk-jq8xvscs.js:30130`) from the masker (`chunk-6qx4m5tj.js:709`).
[^where-16]: The program, `chunk-ggmpjhj1.js:94538` (the command), `chunk-ggmpjhj1.js:94760` (the tool summary from `Aaa()`, which masks with `redactContext` then `redactTokens` at `chunk-mwfcwvmn.js:7660`), and `chunk-ggmpjhj1.js:94802` (the description). Also `chunk-xmg4s9wn.js:10226-11728` (the plan reason, the command, and the description).
[^where-18]: The program, `chunk-gmcczr1c.js:26750` (the intent, 1,000 characters), `chunk-gmcczr1c.js:27149` (the latest question, 600 characters), and `chunk-gmcczr1c.js:37127` (the output tail).
[^rule-table]: The program, `chunk-jq8xvscs.js:12990-20834`.
[^more-calls]: The program. A job detail: `chunk-f2bg3s01.js:33878`, `chunk-mj6016d6.js:44485`, `chunk-wq6qw79p.js:3839`, and `chunk-fcdwedb2.js:5873`. A task summary line: `chunk-3r0fyrgm.js:6585` and `chunk-ckewb6rp.js:3582`. A session or job name: `chunk-h20cnm6k.js:23602`, `chunk-faznt4sc.js:74826`, `chunk-5e06b4s2.js:31239`, and `chunk-avyyrx5p.js:57723`. The masker method names are in no other module.
[^leak-probe]: Probes with cc-inspect `code` `cli` and `query`, which names each request, stream, and transcript file that holds a text. The tool runs used the `calls` option, which makes the stub call tools in order.
[^scan-memory]: The program, `chunk-yt808435.js:3947-4509`.
[^scan-denial]: The program, `chunk-j2wfp6sf.js:1819236`.
[^scan-skill]: The program, `chunk-5nqgrc1r.js:38840`.
[^where-masker]: The program, `chunk-jq8xvscs.js:29160-29408` (the host marker and the masker), `chunk-mwfcwvmn.js:7660` (the tool summary passes through the masker), and `chunk-xmg4s9wn.js:11652` (the notification body).
[^otel-prompt]: The program, `chunk-xkv5w8yy.js:371` (the event), `chunk-pw9xqvmf.js:19822` (the `<REDACTED>` text and the filter call), and `chunk-pw9xqvmf.js:14251` (the filter).
