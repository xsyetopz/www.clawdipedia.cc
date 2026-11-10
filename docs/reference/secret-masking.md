---
title: Secret Masking
description: How Claude Code finds secrets in text and replaces them with a marker, with the rule table, the tiers, and the order.
sidebar_position: 12
---

Claude Code masks text that looks like a secret before it shows or records the text.
It replaces the secret with `[REDACTED]`. This page describes the algorithm and the rule table.
It does not list each pattern.
Source: the program, 2.1.319, and 2.1.321, which has the same rule IDs and levels (`chunk-6nmgrknh.js`, rule table `@21724` to `@29399`). Every row is <Undocumented />.

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

The `high` rules cover these vendors (`chunk-6nmgrknh.js`). The `gitlab-*` family has 11 rules, such as `gitlab-pat`, `gitlab-deploy-token`, and `gitlab-ci-build-token`.

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
The table shows the output that each caller masks in 2.1.319. All callers are in the program; offsets are in the cleaned code.

| Output | Function | Source |
| --- | --- | --- |
| Each line of the debug log, and each line of the second log file (`[time] [level] message`, which turns over at 10 MiB) | `redact` | `chunk-kd0vv9vh.js@34927`, `chunk-k0rez7a5.js@21777` |
| The `error` and `debug` lines in the log files of an MCP server | `redact` | `chunk-p8vmn6m1.js@2790`, `@3031` |
| The `error_message` (cut to 2,000 characters) and `error_stack` (cut to 4,000 characters) of an error report | `redact` | `chunk-ne1755n5.js@321999` to `@322577` |
| The hook name and the stderr text of a hook that fails | `redact` | `chunk-ne1755n5.js@1024727` to `@1024994` |
| A `/feedback` report: the error list, the debug log text, the error messages and stacks, the upload error, the description, and the transcript in the bundle | `redact` | `chunk-fzgxnvda.js@16168` to `@29084` |
| The title and body of a bug report GitHub issue | `redact` | `chunk-pcdt7e62.js@12992`, `@13004` |
| The validation error of a plugin manifest | `redact` | `chunk-nhpnq9a8.js@10088` |
| The roster name in a fork message | `redact` | `chunk-3y8jk8we.js@25853`, `@26289` |
| The debug line for data written to the stdin of a child process | `redact` | `chunk-1csb1paq.js@11002` |
| A suggested reply. The program drops it when masking changes it. | `redact` | `chunk-xvn44q1p.js@5057` |
| A web URL in `claude mcp add`. The program refuses it (`secret_in_url`) when masking changes it. | `redact` | `chunk-55kjycmk.js@21963` |
| The auto mode check input. The program compares the masked text with the input to find the secret spans. | `redact` | `chunk-ne1755n5.js@5276540` |
| An MCP server config that the program shows | `redact`, on each key and value | `chunk-hwj4b0aa.js@31845` to `@32495` |
| The preview of tool input, including the field names | `redactForDisplay` | `chunk-wzaa40hd.js@2776` to `@5480` |
| The path, the description, and the skill summary in a permission request that the program sends to a connected client | `redactForDisplay`, and `redactContext` then `redactTokens` | `chunk-z7xkc6v3.js@39955`, `@42228`, `@43970` |
| The command, the description, and the plan reason in a remote or push permission notice | `redactContext` then `redactTokens` | `chunk-sjzh0vbz.js@92016`, `@92266`, `chunk-1z1vfkec.js@9034` to `@17499` |
| The teammate description when a teammate starts (50 characters) | `redactContext` with tracked tokens | `chunk-gcccnvpy.js@5579` |
| The detail, intent, and latest question of a background job (1,000 and 600 characters), and the tail of its output | `redactContext` with tracked tokens, and `redactTokens` | `chunk-4dgmvrqy.js@21737` to `@33062` |

More calls to `redact` are in `chunk-j3jg1se6.js:1842`, `chunk-ev1xth67.js:2584`, `chunk-6zaq4jhh.js:186`, `chunk-m5e5t0fv.js:16`, `chunk-kd54ptvn.js:563`, `chunk-xd913ea5.js:4241`, `chunk-3y8jk8we.js:731`, `chunk-h5pmez41.js:155`, `chunk-h9msc7hp.js:2327`, and `chunk-e5k8z25c.js:218`. These calls mask a job detail, a task summary line, or a session or job name. The masker class is the only copy in the program: its method names are in no other module.

A probe (2.1.319, `-p --debug-file`) used a `UserPromptSubmit` hook that wrote `leak ghp_<token>` to stderr and exited `1`. The debug log had `leak [REDACTED]`, and the token was in no request. The transcript kept the full token.

### Outputs That Keep the Secret

Masking does not apply to the text of your prompt or to tool output in these outputs.
A probe sent a prompt with a fake GitHub token in the `github-pat` shape (`ghp_` and 36 letters). That shape is a `high` rule.
The full token stayed in each of these outputs:

| Output | Probe setting |
| --- | --- |
| The Messages API request that goes to the model | `-p` against a local stub |
| The session transcript, `projects/<project>/<session>.jsonl` in the config folder | The same run |
| The OpenTelemetry `user_prompt` log event | `CLAUDE_CODE_ENABLE_TELEMETRY=1`, `OTEL_LOG_USER_PROMPTS=1`, and the `console` logs exporter. A run with no telemetry did not print the token. |
| The `tool_result` in the next Messages API request, the `stream-json` output, and the transcript | 2.1.319, `-p --allowedTools Bash`. The stub made the model run `printf 'ghp_%s%s' <half> <half>`, so the full token was only in the tool output. A second run with `Read` of a file that holds the token gave the same result. |

Source: a probe of 2.1.316, and of 2.1.319, with cc-inspect `code` `cli` and `query`, which names each request, stream, and transcript file that holds a text. The tool runs used the `calls` option, which makes the stub call tools in order.
To keep a secret out of these outputs, do not put it in a prompt, and do not let a tool print or read it. Without `OTEL_LOG_USER_PROMPTS`, the prompt is not in the OpenTelemetry events (see [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md)).

## Secret Scan

The `scan` function does not change text. It returns the label of each `high` rule that matches, and a `Private Key` label for a private-key block.
A label comes from the rule name. The program spells some words in a fixed way: `GitHub`, `GitLab`, `OpenAI`, `HuggingFace`, `DigitalOcean`, `HashiCorp`, `SendGrid`, `NPM`, `PyPI`, `AWS`, `GCP`, `API`, `PAT`, `AD`, `TF`, `OAuth`, `JWT`, `CI`, and `SCIM`.
Example: the rule `github-pat` has the label `GitHub PAT`.

The program uses the scan in four places.

| Place | Result |
| --- | --- |
| A write to a memory file (`chunk-vr3j7h4t.js`) | The write fails with `Content contains potential secrets (<labels>) and cannot be written to memory.` The text then names the reason. A team memory file says that team memory is shared with all repository collaborators. A memory file says that memory is synced to your account. |
| A command in an auto mode denial notice (`chunk-d3btef94.js@1717254`) | When the scan finds a secret in the command, the tool input, or the reason, the notice shows no command and no reason. The notice also shows none when the check itself fails. |
| Synced settings and config content (`chunk-6aah5g27.js@9141`) | The program checks the content for credentials. |
| The files of a skill package folder (`chunk-nynkk9mk.js@34617`) | The program gets the labels for each file. All `anthropic-*` rules give one label. |

## Related Pages

- [Transcript Format](transcript-format.md)
- [Probes](probes.md)
