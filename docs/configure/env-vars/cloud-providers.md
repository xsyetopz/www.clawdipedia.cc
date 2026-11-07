---
title: Cloud Providers
description: Environment variables for Amazon Bedrock, Google Vertex AI, Microsoft Foundry, and gateway setups.
sidebar_position: 4
---

These variables point Claude Code at a cloud provider instead of the Anthropic API.
Switch a provider on with a `CLAUDE_CODE_USE_*` variable. Then set the region, credentials, and endpoints for it.
They also cover LLM gateways that sit in front of a provider.

This page lists 79 variables. Set `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, or the Foundry switch to `1`. Then set region, project, and endpoint variables. To turn one off, unset the `CLAUDE_CODE_USE_*` variable. You can override a stale shell export with an empty string in `settings.json` `env`.

## Example

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "env": {
    "CLAUDE_CODE_USE_BEDROCK": "1",
    "AWS_REGION": "us-east-1"
  }
}
```

Claude Code now talks to Amazon Bedrock in `us-east-1`.

## Variables

The table is sorted by name. See [Environment Variables](index.md#how-to-read-the-tables) for what each column and badge means.

| Variable | Status | What it does | Values and default | Notes |
| --- | --- | --- | --- | --- |
| `ANTHROPIC_AWS_BASE_URL` | <Documented /> | Overrides the Claude Platform on AWS endpoint URL. | Text. A set value also changes first-party checks for this provider | Provider `anthropicAws`. Not set from project `env` before trust |
| `ANTHROPIC_AWS_WORKSPACE_ID` | <Documented /> | Gives the workspace ID for Claude Platform on AWS. Claude Code shows it as `Workspace ID` and passes `workspaceId` to the AWS client. | Text, headers by default. The client gets `workspaceId` only when this var is set and an `anthropic-workspace-id` header exists in the default headers. Header source not traced | Provider `anthropicAws`. Not set from project `env` before trust |
| `ANTHROPIC_BEDROCK_BASE_URL` | <Documented /> | Overrides the Amazon Bedrock endpoint URL. | Text. Defaults are `https://bedrock-runtime.<region>.amazonaws.com` for requests and `https://bedrock.<region>.amazonaws.com` for the control plane | Provider `bedrock`. Not set from project `env` before trust |
| `ANTHROPIC_BEDROCK_MANTLE_BASE_URL` | <Documented /> | Overrides the Amazon Bedrock Mantle endpoint URL. | Text. Default is `https://bedrock-mantle.<region>.api.aws` | Provider `mantle`. Not set from project `env` before trust |
| `ANTHROPIC_BEDROCK_REGION_PREFIX` | <Documented /> | Sets the cross-region inference profile prefix that Claude Code tries first. Ignored in `us-gov-` regions. | One of `us`, `eu`, `apac`, `jp`, `au`, or `global`. Claude Code rejects any other value. Without it, Claude Code derives `us`, `eu`, `apac`, or `global` from the AWS region. Claude Code never picks `jp` and `au` for you | Provider `bedrock`. Project `env` can set it before trust |
| `ANTHROPIC_BEDROCK_SERVICE_TIER` | <Documented /> | Sends the value in the `X-Amzn-Bedrock-Service-Tier` header. The status view shows it as `Bedrock service tier`. | Text. Code does not check the value | Provider `bedrock`. Project `env` can set it before trust |
| `ANTHROPIC_FOUNDRY_BASE_URL` | <Documented /> | Sets the full base URL of the Foundry resource. | Text. Wins over `ANTHROPIC_FOUNDRY_RESOURCE`. Without both, the URL is undefined | Provider `foundry`. Not set from project `env` before trust |
| `ANTHROPIC_FOUNDRY_RESOURCE` | <Documented /> | Sets the Foundry resource name. Claude Code builds `https://<resource>.services.ai.azure.com` from it. | Text. Claude Code checks it as a resource name. An invalid value with no base URL raises an error | Provider `foundry`. Not set from project `env` before trust |
| `ANTHROPIC_GOOGLE_CLOUD_BASE_URL` | <Undocumented /> | Overrides the endpoint for the Claude Platform on Google Cloud provider. | Text. Default is `https://claude.googleapis.com`. A set value counts as a custom endpoint in first-party checks | Provider `anthropicGoogleCloud`. Not set from project `env` before trust |
| `ANTHROPIC_GOOGLE_CLOUD_LOCATION` | <Undocumented /> | Sets the GCP location for the Claude Platform on Google Cloud provider. | Text. Claude Code passes it to the client setup. The status view shows `global` when it is unset | Provider `anthropicGoogleCloud`. Not set from project `env` before trust |
| `ANTHROPIC_GOOGLE_CLOUD_PROJECT` | <Undocumented /> | Sets the GCP project for the Claude Platform on Google Cloud provider. | Text. Falls back to `GOOGLE_CLOUD_PROJECT` in the status view. Also feeds Google auth when no other project var is set | Provider `anthropicGoogleCloud`. Not set from project `env` before trust |
| `ANTHROPIC_GOOGLE_CLOUD_WORKSPACE_ID` | <Undocumented /> | Sets the workspace ID for the Claude Platform on Google Cloud provider. The status view shows it. | Text. Claude Code passes it to the client setup with the project and location | Provider `anthropicGoogleCloud`. Not set from project `env` before trust |
| `ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION` | <Documented /> | Overrides the AWS region for the Haiku-class model on Bedrock. | Text | Providers `bedrock` and `mantle`. Project `env` can set it before trust |
| `ANTHROPIC_VERTEX_BASE_URL` | <Documented /> | Overrides the Vertex endpoint URL. | Text, comes by default. A set value also turns off the default for fine-grained tool streaming on Vertex | Provider `vertex`. Not set from project `env` before trust |
| `ANTHROPIC_VERTEX_PROJECT_ID` | <Documented /> | Sets the GCP project for Vertex requests. | Text. It is the last choice after `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, and their lowercase forms | Provider `vertex`. Not set from project `env` before trust |
| `AWS_ACCESS_KEY_ID` | <Documented /> | Gives the standard AWS access key. Claude Code reads it into the Bedrock credential set. It also uses it with the secret key for AWS-based federation. | Text | Providers `bedrock` and `mantle`. Not set from project `env` before trust |
| `AWS_CONFIG_FILE` | <Documented /> | Gives the standard AWS config file path. Claude Code uses it in the AWS cache key and as an input of the auth refresh check. | Text. Key is config file, credentials file, and profile. A host-managed provider check also tests it | Providers `bedrock` and `mantle`. Not set from project `env` before trust |
| `AWS_CONTAINER_CREDENTIALS_FULL_URI` | <Undocumented /> | Gives the standard AWS container credentials URL. Claude Code includes it in the inputs that refresh cached AWS credentials. | Text | Providers `bedrock` and `mantle`. Not set from project `env` before trust |
| `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` | <Undocumented /> | Gives the standard AWS container credentials path. Claude Code includes it in the inputs that refresh cached AWS credentials. | Text | Providers `bedrock` and `mantle`. Not set from project `env` before trust |
| `AWS_DEFAULT_REGION` | <Documented /> | Gives the standard AWS region. It is the fallback for `AWS_REGION`. Claude Code defaults to `us-east-1` when neither is valid. | Text. Order is `AWS_REGION`, then this var, then the shared config, then `us-east-1` | Providers `bedrock` and `mantle`. Project `env` can set it before trust |
| `AWS_ENDPOINT_URL` | <Documented /> | Sets a global AWS endpoint override. Claude Code uses it as a fallback STS URL and counts it as a Bedrock base URL source. | Text. Fallback after `AWS_ENDPOINT_URL_STS` for STS and after the Bedrock-specific names for Bedrock | Bedrock and AWS STS. Not set from project `env` before trust |
| `AWS_ENDPOINT_URL_BEDROCK` | <Documented /> | Overrides the Bedrock endpoint URL. Claude Code lists it as a Bedrock base URL source for provider checks. | Text. In the Bedrock variable list after `ANTHROPIC_BEDROCK_BASE_URL` and `AWS_ENDPOINT_URL_BEDROCK_RUNTIME` | Bedrock. Not set from project `env` before trust |
| `AWS_ENDPOINT_URL_BEDROCK_RUNTIME` | <Documented /> | Overrides the Bedrock runtime endpoint URL. Claude Code lists it as a Bedrock base URL source for provider checks. | Text. In the Bedrock variable list right after `ANTHROPIC_BEDROCK_BASE_URL` | Bedrock. Not set from project `env` before trust |
| `AWS_ENDPOINT_URL_STS` | <Undocumented /> | Sets the AWS STS endpoint. Claude Code reads it first, then `AWS_ENDPOINT_URL`, then `https://sts.<region>.amazonaws.com`. | Text. Also used by the gateway STS role-assume code | Bedrock and AWS STS. Not set from project `env` before trust |
| `AWS_PROFILE` | <Documented /> | Selects the AWS shared config profile for Bedrock credentials and region lookup. | Text. Part of the credential fingerprint and of the `awsAuthRefresh` cache key | Bedrock. Project `env` can set it before trust |
| `AWS_REGION` | <Documented /> | Sets the AWS region for Bedrock. Claude Code reads it first, then `AWS_DEFAULT_REGION`, then the shared config, then `us-east-1`. | Text. An invalid value gives source `env-invalid` and falls back to the default | Bedrock. Project `env` can set it before trust |
| `AWS_ROLE_ARN` | <Undocumented /> | Gives the role for AWS web identity login. Claude Code also uses it as a credential source marker for Bedrock auth refresh. | Text | Bedrock |
| `AWS_SECRET_ACCESS_KEY` | <Documented /> | Gives the AWS secret key for Bedrock. It pairs with `AWS_ACCESS_KEY_ID` and `AWS_SESSION_TOKEN`. | Text. Claude Code also writes it into an env object built from a Bedrock access key setup | Bedrock. Not set from project `env` before trust |
| `AWS_SESSION_TOKEN` | <Documented /> | Gives the temporary AWS session token that goes with the access key pair for Bedrock. | Text. Claude Code also writes it into an env object built from a Bedrock access key setup | Bedrock. Not set from project `env` before trust |
| `AWS_SHARED_CREDENTIALS_FILE` | <Documented /> | Sets the path of the AWS shared credentials file for Bedrock. | Text. Path string. Part of the credential fingerprint and the `awsAuthRefresh` cache key | Bedrock. Not set from project `env` before trust |
| `AWS_USE_FIPS_ENDPOINT` | <Documented /> | Selects the FIPS STS endpoint for the gateway role assume code. | Text. True only for the exact string `true` | Gateway STS (AWS identity federation) |
| `AWS_WEB_IDENTITY_TOKEN_FILE` | <Documented /> | Gives the path of the web identity token file for AWS role login. Claude Code also uses it as a credential source marker. | Text. Path string | Bedrock |
| `CLAUDE_CODE_AGENT_PROXY_GH_SHIM` | <Undocumented /> | Makes the CCR agent proxy write a `gh` shim onto `PATH`. | On or off. Claude Code sets `1` for the session when the tool config has `ghPathShim`. A failed write logs a warning | Claude Code on the web with agent proxy. Not set from project `env` before trust |
| `CLAUDE_CODE_AGENT_PROXY_GIT_CONFIG` | <Undocumented /> | Makes the CCR agent proxy append a governed git config. | On or off. Claude Code sets `1` for the session when the tool config has `gitConfig`. A failed append logs a warning | Claude Code on the web with agent proxy. Not set from project `env` before trust |
| `CLAUDE_CODE_AGENT_PROXY_GIT_HOSTS` | <Undocumented /> | Lists the governed git hosts for the CCR agent proxy. | A comma-separated list, host by default. Claude Code ignores bad entries and logs the count. An empty value gives the default host | Claude Code on the web with agent proxy. Not set from project `env` before trust |
| `CLAUDE_CODE_AWS_CHAIN_RESOLVE_TIMEOUT_MS` | <Documented /> | Sets how long Claude Code waits for the AWS default credential chain before the request fails. | A number of milliseconds, `60000` by default. Whole number from `1` to `2147483647` ms | Bedrock, Mantle, Claude Platform on AWS |
| `CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_DEFAULT` | <Documented /> | Stops Claude Code from treating a Bedrock streaming response without `Content-Type` as `application/vnd.amazon.eventstream`. | On or off. Code sets the header only when the provider is Bedrock and the header is empty | Bedrock |
| `CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_GUARD` | <Documented /> | Skips the check that a Bedrock stream has the `vnd.amazon.eventstream` content type. | On or off. Without it the request fails and the error names this variable | Bedrock |
| `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | <Documented /> | Marks that a host app manages provider routing. | On or off. Part of a host-managed marker list with `ANTHROPIC_UNIX_SOCKET` and `CLAUDE_CODE_HOST_AUTH_ENV_VAR`. Also gates gateway mode | Host apps such as Desktop |
| `CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH` | <Documented /> | Skips client-side auth for Claude Platform on AWS, for gateways that sign requests themselves. Claude Code keeps your own `Authorization` header. | On or off. Also skips the AWS credential setup at startup. The status view shows that auth is skipped | Claude Platform on AWS. Project `env` can set it before trust |
| `CLAUDE_CODE_SKIP_ANTHROPIC_GOOGLE_CLOUD_AUTH` | <Undocumented /> | Skips Google credentials for Claude Platform on Google Cloud. The client runs with `skipAuth` and keeps your own `Authorization` header. | On or off, Credentials by default. Also skips the Application Default Credentials setup and refresh hints | Claude Platform on Google Cloud. Project `env` can set it before trust |
| `CLAUDE_CODE_SKIP_AWS_CRED_CACHE` | <Documented /> | Turns off the in-process cache of AWS default-chain credentials. Claude Code then resolves the chain on each API request. | On or off. It also skips the credential lookup in the retry check | Bedrock and other AWS paths |
| `CLAUDE_CODE_SKIP_BEDROCK_AUTH` | <Documented /> | Skips AWS auth for Amazon Bedrock, for example behind an LLM gateway. Requests use the no-auth scheme. | On or off. Also stops the startup credential refresh for Bedrock | Bedrock. Project `env` can set it before trust |
| `CLAUDE_CODE_SKIP_FOUNDRY_AUTH` | <Documented /> | Skips Azure auth for Microsoft Foundry. Claude Code sends a placeholder token and keeps your own `Authorization` header. | On or off. Ignored when `ANTHROPIC_FOUNDRY_AUTH_TOKEN` or `ANTHROPIC_FOUNDRY_API_KEY` is set. Docs note a change in v2.1.203 | Microsoft Foundry. Project `env` can set it before trust |
| `CLAUDE_CODE_SKIP_MANTLE_AUTH` | <Documented /> | Skips AWS auth for Amazon Bedrock Mantle, for example behind an LLM gateway. Claude Code keeps your own `Authorization` header. | On or off. Claude Code reads an `AWS_BEARER_TOKEN_BEDROCK` value first. Also skips the startup credential refresh | Bedrock Mantle. Project `env` can set it before trust |
| `CLAUDE_CODE_SKIP_MODEL_ACCESS_MEMORY` | <Documented /> | Turns off the saved memory of models the startup checks found your account cannot invoke on Bedrock and Vertex. | On or off. When set, Claude Code does not build the key for the saved file, so it reads and writes nothing | Bedrock and Vertex startup model checks |
| `CLAUDE_CODE_SKIP_VERTEX_AUTH` | <Documented /> | Skips Google auth for Google Cloud Agent Platform (Vertex), for example behind an LLM gateway. | On or off. The Google auth builder gets the `skip` kind. Also stops the startup credential refresh | Vertex. Project `env` can set it before trust |
| `CLAUDE_CODE_USE_ANTHROPIC_AWS` | <Documented /> | Selects Claude Platform on AWS as the provider. | On or off. Provider order: gateway, Bedrock, Foundry, this, Google Cloud, Mantle, Vertex. Allowed in project `env` before trust | Claude Platform on AWS |
| `CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD` | <Undocumented /> | Selects the Anthropic Google Cloud provider. Docs have no row for it. Auth errors are handled like Vertex. | On or off. Provider order puts it after Claude Platform on AWS. Allowed in project `env` before trust | Anthropic Google Cloud provider |
| `CLAUDE_CODE_USE_BEDROCK` | <Documented /> | Selects Amazon Bedrock as the provider. | On or off. Wins over Foundry, Vertex, and others. With `CLAUDE_CODE_USE_MANTLE` it routes `anthropic.*` models to Mantle | Amazon Bedrock |
| `CLAUDE_CODE_USE_FOUNDRY` | <Documented /> | Selects Microsoft Foundry as the provider. | On or off. Wins over Claude Platform on AWS, Vertex, and Mantle. Allowed in project `env` before trust | Microsoft Foundry |
| `CLAUDE_CODE_USE_GATEWAY` | <Undocumented /> | Marks a host-managed gateway session. Claude Code needs `ANTHROPIC_BASE_URL` and a token. Without them, it warns and ignores the flag. | On or off. Needs `ANTHROPIC_AUTH_TOKEN` or a descriptor token. Some paths also need `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` | Desktop and host-managed gateway |
| `CLAUDE_CODE_USE_MANTLE` | <Documented /> | Selects the Amazon Bedrock Mantle endpoint. | On or off. With Bedrock on, `anthropic.*` model ids route to Mantle. Allowed in project `env` before trust | Amazon Bedrock Mantle |
| `CLAUDE_CODE_USE_VERTEX` | <Documented /> | Selects Google Cloud's Agent Platform (Vertex) as the provider. | On or off. Last in the provider order before first party. Allowed in project `env` before trust | Google Vertex |
| `CLAUDE_GATEWAY_ALLOW_LOOPBACK` | <Documented /> | Lets the gateway server reach loopback addresses. Otherwise it blocks them as SSRF. | On or off. The error text says to set `1` in the gateway environment | `claude gateway` server |
| `CLAUDE_GATEWAY_DRAIN_TIMEOUT_MS` | <Documented /> | Sets how long open requests may finish after a shutdown signal. | A number of milliseconds, `25000` by default. Plain digits 1 to 2147000000 | `claude gateway` server |
| `CLAUDE_GATEWAY_LOG_FORMAT` | <Undocumented /> | Sets the log line format of the gateway server. `json` writes each line to stderr as a JSON object with `severity`, `time`, and `message`, and drops the startup banner. | `json`, any case, turns it on. Any other value gives plain text. Unset gives plain text | `claude gateway` server. Read in `chunk-0wfv83qh.js@470`. Runs `env319b.gateway.bad-config-json` and `bad-config-JSON-upper` gave a JSON error line; `bad-config-default` and `bad-config-text` gave a plain line |
| `CLAUDE_GATEWAY_LOG_LEVEL` | <Documented /> | Sets the log level of the gateway server. | `info` by default. `debug`, `info`, `warn`, or `error`, any case | `claude gateway` server |
| `CLAUDE_GATEWAY_PROXY_IS_EGRESS_BOUNDARY` | <Documented /> | Treats the forward proxy as the egress boundary. The gateway passes hostnames and does not resolve them itself. | On or off. Needs `HTTPS_PROXY` or `HTTP_PROXY` and no `NO_PROXY`. Warns when it clashes with `CLAUDE_GATEWAY_ALLOW_LOOPBACK` | `claude gateway` server |
| `CLOUD_ML_REGION` | <Documented /> | Sets the Vertex AI region. | - | - |
| `CLOUDSDK_ACTIVE_CONFIG_NAME` | <Undocumented /> | Picks the active `gcloud` config name. Claude Code reads it to find the GCP project and account. | Text | - |
| `CLOUDSDK_AUTH_ACCESS_TOKEN` | <Undocumented /> | Gives a `gcloud` access token. Its presence counts as a cloud credential for provider checks. | Text (a secret) | - |
| `CLOUDSDK_CONFIG` | <Undocumented /> | Sets the `gcloud` config directory that Claude Code reads. | - | - |
| `GCLOUD_PROJECT` | <Documented /> | Gives the Google Cloud project id for Vertex AI. It is the first choice. | Text. Order is `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, lowercase forms, then `ANTHROPIC_VERTEX_PROJECT_ID` | Vertex. Not set from project `env` before trust |
| `gcloud_project` | <Undocumented /> | Gives the lowercase GCP project id. It is a fallback after the uppercase names for the Vertex project. | Text. Non-empty string. Order: `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, this, `google_cloud_project`, then `ANTHROPIC_VERTEX_PROJECT_ID` | Vertex AI |
| `GOOGLE_APPLICATION_CREDENTIALS` | <Documented /> | Gives the path of the Google credentials file. Claude Code uses it for Vertex auth, and the Google auth library also uses it. | Text. Lowercase form is also read. Part of the Vertex client cache key | Vertex. Not set from project `env` before trust |
| `google_application_credentials` | <Undocumented /> | Gives the lowercase GCP credentials path. It is a fallback after `GOOGLE_APPLICATION_CREDENTIALS`. | Text. Non-empty string | Vertex AI |
| `GOOGLE_CLOUD_PROJECT` | <Documented /> | Gives the Google Cloud project id for Vertex AI. It comes after `GCLOUD_PROJECT`. | Text. Lowercase form is also read. Also passed to the Google Cloud client | Vertex. Not set from project `env` before trust |
| `google_cloud_project` | <Undocumented /> | Gives the lowercase GCP project id. It is a fallback in the Vertex project lookup. | Text. Non-empty string. Order: `GCLOUD_PROJECT`, `GOOGLE_CLOUD_PROJECT`, `gcloud_project`, then this | Vertex AI |
| `GOOGLE_EXTERNAL_ACCOUNT_ALLOW_EXECUTABLES` | <Undocumented /> | Must be `1` to let Google pluggable auth run an executable. | Other values throw an error | Google auth library |
| `GOOGLE_EXTERNAL_ACCOUNT_AUDIENCE` | <Undocumented /> | The Google auth library sets it in the env of a pluggable auth executable. It holds the audience. | - | Google auth library |
| `GOOGLE_EXTERNAL_ACCOUNT_IMPERSONATED_EMAIL` | <Undocumented /> | The Google auth library sets it in the env of a pluggable auth executable when it impersonates a service account. | - | Google auth library |
| `GOOGLE_EXTERNAL_ACCOUNT_INTERACTIVE` | <Undocumented /> | The Google auth library sets it to `0` in the env of a pluggable auth executable. | - | Google auth library |
| `GOOGLE_EXTERNAL_ACCOUNT_OUTPUT_FILE` | <Undocumented /> | The Google auth library sets it in the env of a pluggable auth executable when an output file is set. | A path | Google auth library |
| `GOOGLE_EXTERNAL_ACCOUNT_TOKEN_TYPE` | <Undocumented /> | The Google auth library sets it in the env of a pluggable auth executable. It holds the subject token type. | - | Google auth library |
| `K_CONFIGURATION` | <Undocumented /> | Detects Google Cloud Run jobs and services in the bundled Google auth library. | - | - |
| `K_SERVICE` | <Undocumented /> | Detects Google Cloud Run in the bundled Google auth library and in Claude Code's environment report. | - | - |
| `METADATA_SERVER_DETECTION` | <Undocumented /> | Controls how the bundled Google auth library detects the GCE metadata server. | - | - |
| `VERTEX_REGION_CLAUDE_*` | <Undocumented /> | Sets the Google Cloud region for one model family. One variable exists for each suffix. | Text. The first table entry whose model prefix matches the model id wins, then `CLOUD_ML_REGION`, then `us-east5` | Google Cloud Agent Platform (`CLAUDE_CODE_USE_VERTEX`) |

## How It Works

Claude Code picks one provider when it starts.
The provider decides which auth path, endpoint, and model IDs it uses.
If a shell profile exports a provider switch you cannot remove, set it to an empty string in the `env` block.
Claude Code treats an empty value as unset for provider selection.

## Related Pages

- [Environment Variables](index.md): how Claude Code reads variables and which value wins.
- [Models and Effort](models-and-effort.md): pin model IDs for a provider.
- [Auth and Accounts](auth-and-accounts.md)
- [Network and Proxy](network-and-proxy.md)
- [Undocumented Items](../../reference/undocumented.md): every item that only the program shows.

Source: the program (variable names found in the `2.1.314` binary) and the [Environment Variables](https://code.claude.com/docs/en/env-vars) page of the official docs.
