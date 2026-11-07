---
title: Bundled Libraries
description: Environment variables read only by libraries bundled inside Claude Code, such as the AWS SDK, gRPC, and cloud detectors.
sidebar_position: 17
---

Claude Code ships with libraries inside its program.
These libraries read their own environment variables, and Claude Code itself does not use them.
A variable here only works when the library code runs. Setting one can change behavior in a way Claude Code does not plan for.

This page lists 128 variables. The effect depends on the library and the feature that runs it. Set them in your shell.

## Example

```bash
export GRPC_VERBOSITY=DEBUG
claude
```

The bundled gRPC library prints more log lines. This helps when an OTEL gRPC exporter fails.

## Variables

The table is sorted by name. See [Environment Variables](index.md#how-to-read-the-tables) for what each column and badge means.

| Variable | Status | Library | What it does |
| --- | --- | --- | --- |
| `APP_URL` | <Undocumented /> | cloud detector | A bundled cloud detector treats a value that contains `ondigitalocean.app` as the DigitalOcean App Platform. |
| `AWS_ACCOUNT_ID` | <Undocumented /> | AWS SDK | The bundled AWS SDK env credential provider reads it with the key, secret, token, expiry, and scope vars. |
| `AWS_AUTH_SCHEME_PREFERENCE` | <Undocumented /> | AWS SDK | The bundled AWS SDK reads it as a comma list of preferred auth schemes. |
| `AWS_CONTAINER_AUTHORIZATION_TOKEN` | <Undocumented /> | AWS SDK | The bundled AWS SDK sends it as the auth value to the container credentials endpoint. |
| `AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE` | <Undocumented /> | AWS SDK | The bundled AWS SDK reads the container credentials auth token from this file path. |
| `AWS_CREDENTIAL_EXPIRATION` | <Documented /> | AWS SDK | The bundled AWS SDK env credential provider reads it as the expiry time of the env credentials. |
| `AWS_DEFAULTS_MODE` | <Undocumented /> | AWS SDK | The bundled AWS SDK reads it as the SDK defaults mode. |
| `AWS_EC2_METADATA_DISABLED` | <Undocumented /> | AWS SDK | Turns off the EC2 instance metadata lookup in the bundled AWS SDK credential chain and region defaults. |
| `AWS_EC2_METADATA_SERVICE_ENDPOINT` | <Undocumented /> | AWS SDK | Sets the EC2 metadata service URL for the bundled AWS SDK. |
| `AWS_EC2_METADATA_SERVICE_ENDPOINT_MODE` | <Undocumented /> | AWS SDK | Picks `IPv4` or `IPv6` for the EC2 metadata service address in the bundled AWS SDK. |
| `AWS_EC2_METADATA_V1_DISABLED` | <Undocumented /> | AWS SDK | Blocks the IMDSv1 fallback in the bundled AWS SDK, so the SDK uses only token-based IMDSv2. |
| `AWS_ENDPOINT_URL_SIGNIN` | <Undocumented /> | AWS SDK | Overrides the AWS sign-in endpoint in the bundled AWS SDK. The `login_session` credential provider (`aws login`) loads the SDK sign-in client to refresh tokens. Added in `2.1.314`. |
| `AWS_ENDPOINT_URL_SSO` | <Undocumented /> | AWS SDK | Overrides the AWS SSO endpoint in the bundled AWS SDK. |
| `AWS_ENDPOINT_URL_SSO_OIDC` | <Undocumented /> | AWS SDK | Overrides the AWS SSO OIDC endpoint in the bundled AWS SDK. |
| `AWS_LAMBDA_MAX_CONCURRENCY` | <Undocumented /> | AWS SDK | Selects the concurrent-aware store in the bundled AWS Lambda `InvokeStore` when present. |
| `AWS_LOGIN_CACHE_DIRECTORY` | <Undocumented /> | AWS SDK | Sets the cache folder for the AWS SDK `login_session` credential provider (`aws login`). |
| `AWS_MAX_ATTEMPTS` | <Undocumented /> | AWS SDK | Sets the maximum retry attempts of the bundled AWS SDK clients. |
| `AWS_RETRY_MODE` | <Undocumented /> | AWS SDK | Sets the retry mode of the bundled AWS SDK clients. |
| `AWS_ROLE_SESSION_NAME` | <Undocumented /> | AWS SDK | Sets the session name for AWS web identity role assumption in the bundled AWS SDK. |
| `AWS_SDK_UA_APP_ID` | <Undocumented /> | AWS SDK | Adds an `app/<id>` part to the user agent of the bundled AWS SDK calls. |
| `AWS_USE_DUALSTACK_ENDPOINT` | <Undocumented /> | AWS SDK | Turns on AWS dual-stack endpoints in the AWS SDK. |
| `AZURE_ADDITIONALLY_ALLOWED_TENANTS` | <Undocumented /> | Azure SDK | Lists extra tenant IDs the bundled Azure identity library may use. |
| `AZURE_AUTHORITY_HOST` | <Undocumented /> | Azure SDK | Sets the Microsoft Entra authority URL of the bundled Azure identity library. |
| `AZURE_CLIENT_CERTIFICATE_PASSWORD` | <Undocumented /> | Azure SDK | Gives the password of the client certificate for the Azure `EnvironmentCredential`. |
| `AZURE_CLIENT_CERTIFICATE_PATH` | <Undocumented /> | Azure SDK | Gives the client certificate path for the Azure `EnvironmentCredential`. |
| `AZURE_CLIENT_ID` | <Documented /> | Azure SDK | Gives the Azure app client ID for the bundled Azure identity credentials. |
| `AZURE_CLIENT_SECRET` | <Undocumented /> | Azure SDK | Gives the Azure app client secret for the Azure `EnvironmentCredential`. |
| `AZURE_CLIENT_SEND_CERTIFICATE_CHAIN` | <Undocumented /> | Azure SDK | Makes the Azure client certificate credential send the full certificate chain. |
| `AZURE_FEDERATED_TOKEN_FILE` | <Undocumented /> | Azure SDK | Gives the federated token file for Azure workload identity login. |
| `AZURE_IDENTITY_DISABLE_MULTITENANTAUTH` | <Undocumented /> | Azure SDK | Turns off multi-tenant token requests in the Azure identity library, so the library always uses the configured tenant. |
| `AZURE_LOG_LEVEL` | <Undocumented /> | Azure SDK | Sets the log level of the bundled Azure SDK logger. |
| `AZURE_PASSWORD` | <Undocumented /> | Azure SDK | Gives the password for the Azure username and password credential. |
| `AZURE_POD_IDENTITY_AUTHORITY_HOST` | <Undocumented /> | Azure SDK | Sets the Azure pod identity authority host for managed identity login in the bundled MSAL library. |
| `AZURE_REGIONAL_AUTHORITY_NAME` | <Undocumented /> | Azure SDK | Sets the regional authority name for MSAL token requests. |
| `AZURE_TENANT_ID` | <Documented /> | Azure SDK | Gives the Azure tenant ID for the bundled Azure identity credentials. |
| `AZURE_TOKEN_CREDENTIALS` | <Undocumented /> | Azure SDK | Picks which Azure credential chain `DefaultAzureCredential` uses. |
| `AZURE_USERNAME` | <Undocumented /> | Azure SDK | Gives the username for the Azure username and password credential. |
| `BUF_BIGINT_DISABLE` | <Undocumented /> | protobuf | Turns off native `BigInt` use in the bundled protobuf library, so it uses its fallback int64 code. |
| `BUN_DISABLE_DYNAMIC_CHUNK_SIZE` | <Undocumented /> | Bun runtime | Turns off dynamic chunk size tuning for native readable streams in the Bun runtime. |
| `BUN_FEATURE_FLAG_VERBOSE_WARNINGS` | <Undocumented /> | Bun runtime | Shows the Bun runtime warning for unsupported `async_hooks` use. |
| `BUN_INSPECT_NOTIFY` | <Undocumented /> | Bun runtime | Tells the Bun inspector where to report that it listens. |
| `BUN_OPTIONS` | <Undocumented /> | Bun runtime | Adds Bun command-line options to every Bun process, including the child processes of MCP servers. A Probes run with a bad value made a plugin MCP server fail with `CONNECTION_CLOSED` and removed its tool. |
| `BUN_PORT` | <Undocumented /> | Bun runtime | Gives a fallback port for the Bun dev server when the default port is busy. |
| `CHOKIDAR_INTERVAL` | <Undocumented /> | chokidar | Sets the poll interval for the bundled `chokidar` file watcher when polling is on. |
| `CHOKIDAR_USEPOLLING` | <Undocumented /> | chokidar | Forces the bundled `chokidar` file watcher to use polling or not. |
| `CLOUD_RUN_JOB` | <Undocumented /> | Google auth | Marks a Google Cloud Run job. |
| `DATABASE_URL` | <Documented /> | Bun SQL | Gives the default connection URL to the embedded Bun SQL client. |
| `DATABASEURL` | <Undocumented /> | Bun SQL | Is a second spelling of `DATABASE_URL` for the embedded Bun SQL client. |
| `DEBUG_AUTH` | <Undocumented /> | Google auth | Prints GCP metadata detection errors with `console.info`. |
| `DETECT_GCP_RETRIES` | <Undocumented /> | Google auth | Sets the number of retries for GCP metadata server detection. |
| `FUNCTION_NAME` | <Undocumented /> | Google auth | Marks a Google Cloud Functions runtime in the bundled Google auth library. |
| `FUNCTION_TARGET` | <Undocumented /> | Google auth | Marks a Google Cloud Functions runtime in the bundled Google auth library. |
| `GAE_MODULE_NAME` | <Undocumented /> | Google auth | Marks a Google App Engine runtime in the bundled Google auth library. |
| `GAE_SERVICE` | <Undocumented /> | Google auth | Marks a Google App Engine runtime in the bundled Google auth library. |
| `GCE_METADATA_HOST` | <Undocumented /> | Google auth | Sets the host of the Compute Engine metadata server for the bundled Google auth library. |
| `GCE_METADATA_IP` | <Undocumented /> | Google auth | Sets the address of the Compute Engine metadata server for the bundled Google auth library. |
| `GOOGLE_API_CERTIFICATE_CONFIG` | <Undocumented /> | Google auth | Gives the path of the certificate config for mTLS in the bundled Google auth library. |
| `GOOGLE_CLOUD_QUOTA_PROJECT` | <Undocumented /> | Google auth | Sets the quota project of the credential in the bundled Google auth library. |
| `GRACEFUL_FS_PLATFORM` | <Undocumented /> | graceful-fs | Overrides the platform name that the bundled `graceful-fs` patches use. |
| `GRPC_DEFAULT_SSL_ROOTS_FILE_PATH` | <Undocumented /> | gRPC | Gives the path of a root certificate file that the bundled gRPC library loads as its TLS roots. |
| `GRPC_EXPERIMENTAL_ENABLE_OUTLIER_DETECTION` | <Undocumented /> | gRPC | Turns the gRPC outlier detection load balancer on or off. |
| `GRPC_NODE_TRACE` | <Undocumented /> | gRPC | Lists the gRPC tracers to turn on. |
| `GRPC_NODE_USE_ALTERNATIVE_RESOLVER` | <Undocumented /> | gRPC | Makes the gRPC DNS resolver use the alternative path when it is `true`. |
| `GRPC_NODE_VERBOSITY` | <Undocumented /> | gRPC | Sets the gRPC log level. |
| `GRPC_SSL_CIPHER_SUITES` | <Undocumented /> | gRPC | Sets the TLS cipher suites of the bundled gRPC library. |
| `GRPC_TRACE` | <Undocumented /> | gRPC | Lists the gRPC tracers to turn on. |
| `GRPC_VERBOSITY` | <Undocumented /> | gRPC | Sets the gRPC log level. |
| `LRU_CACHE_IGNORE_AC_WARNING` | <Undocumented /> | lru-cache | Set to `1` to hide the `lru-cache` warning about a missing `AbortController`. |
| `MARIADB_DATABASE` | <Undocumented /> | Bun SQL | Sets the database of the MariaDB connection of the embedded Bun SQL client. |
| `MARIADB_HOST` | <Undocumented /> | Bun SQL | Sets the host of the MariaDB connection of the embedded Bun SQL client. |
| `MARIADB_PASSWORD` | <Undocumented /> | Bun SQL | Sets the password of the MariaDB connection of the embedded Bun SQL client. |
| `MARIADB_PORT` | <Undocumented /> | Bun SQL | Sets the port of the MariaDB connection of the embedded Bun SQL client. |
| `MARIADB_URL` | <Undocumented /> | Bun SQL | Gives the default MariaDB connection URL to the embedded Bun SQL client. |
| `MARIADB_USER` | <Undocumented /> | Bun SQL | Sets the user of the MariaDB connection of the embedded Bun SQL client. |
| `MARIADBDATABASE` | <Undocumented /> | Bun SQL | Is another spelling of `MARIADB_DATABASE`. |
| `MARIADBHOST` | <Undocumented /> | Bun SQL | Is another spelling of `MARIADB_HOST`. |
| `MARIADBPASSWORD` | <Undocumented /> | Bun SQL | Is another spelling of `MARIADB_PASSWORD`. |
| `MARIADBPORT` | <Undocumented /> | Bun SQL | Is another spelling of `MARIADB_PORT`. |
| `MARIADBURL` | <Undocumented /> | Bun SQL | Is another spelling of `MARIADB_URL` for the embedded Bun SQL client. |
| `MARIADBUSER` | <Undocumented /> | Bun SQL | Is another spelling of `MARIADB_USER`. |
| `MYSQL_DATABASE` | <Undocumented /> | Bun SQL | Sets the database of the MySQL connection of the embedded Bun SQL client. |
| `MYSQL_HOST` | <Undocumented /> | Bun SQL | Sets the host of the MySQL connection of the embedded Bun SQL client. |
| `MYSQL_PASSWORD` | <Undocumented /> | Bun SQL | Sets the password of the MySQL connection of the embedded Bun SQL client. |
| `MYSQL_PORT` | <Undocumented /> | Bun SQL | Sets the port of the MySQL connection of the embedded Bun SQL client. |
| `MYSQL_URL` | <Undocumented /> | Bun SQL | Gives the default MySQL connection URL to the embedded Bun SQL client. |
| `MYSQL_USER` | <Undocumented /> | Bun SQL | Sets the user of the MySQL connection of the embedded Bun SQL client. |
| `MYSQLDATABASE` | <Undocumented /> | Bun SQL | Is another spelling of `MYSQL_DATABASE`. |
| `MYSQLHOST` | <Undocumented /> | Bun SQL | Is another spelling of `MYSQL_HOST`. |
| `MYSQLPASSWORD` | <Undocumented /> | Bun SQL | Is another spelling of `MYSQL_PASSWORD`. |
| `MYSQLPORT` | <Undocumented /> | Bun SQL | Is another spelling of `MYSQL_PORT`. |
| `MYSQLURL` | <Undocumented /> | Bun SQL | Is another spelling of `MYSQL_URL` for the embedded Bun SQL client. |
| `MYSQLUSER` | <Undocumented /> | Bun SQL | Is another spelling of `MYSQL_USER`. |
| `NODE_CHANNEL_FD` | <Undocumented /> | Bun runtime | In the Bun runtime, a set value means that the process has an IPC channel. The runtime stubs `send` and `disconnect` in workers. |
| `NODE_CLUSTER_SCHED_POLICY` | <Undocumented /> | Bun runtime | Sets the scheduling policy of the Bun runtime `cluster` to `rr` or `none`. |
| `NODE_DEBUG` | <Undocumented /> | Bun runtime | Enables `debuglog` sections by name in the Bun runtime. |
| `NODE_DISABLE_COLORS` | <Undocumented /> | Bun runtime | In the Bun runtime, a non-empty value sets the terminal color depth to one color. |
| `NODE_NO_READLINE` | <Undocumented /> | Bun runtime | In the Bun REPL, a number that parses to non-zero turns off terminal mode. |
| `NODE_PORT` | <Undocumented /> | Bun runtime | Gives a fallback port for the Bun dev server after `PORT` and `BUN_PORT`, when the port is in use. |
| `NODE_REPL_EXTERNAL_MODULE` | <Undocumented /> | Bun runtime | Gives the path of a module that the Bun REPL loads in place of the built-in REPL. |
| `NODE_REPL_HISTORY` | <Undocumented /> | Bun runtime | Sets the file path for persistent history in the Bun REPL. |
| `NODE_REPL_HISTORY_SIZE` | <Undocumented /> | Bun runtime | Sets the history size of the Bun REPL. |
| `NODE_REPL_MODE` | <Undocumented /> | Bun runtime | Sets the Bun REPL mode to `strict` or `sloppy`. |
| `NODE_UNIQUE_ID` | <Undocumented /> | Bun runtime | Gives the worker id of a forked worker in the Bun runtime `cluster`. The runtime deletes it after use. |
| `OSTYPE` | <Undocumented /> | which | The bundled `which` code treats `cygwin` or `msys` as a Windows-style path list. |
| `PASSWORD` | <Documented /> | Bun SQL | Gives a fallback password to the embedded Bun SQL client. |
| `PG_DATABASE` | <Undocumented /> | Bun SQL | Sets the database of the Postgres connection of the embedded Bun SQL client. |
| `PG_HOST` | <Undocumented /> | Bun SQL | Sets the host of the Postgres connection of the embedded Bun SQL client. |
| `PG_PASSWORD` | <Undocumented /> | Bun SQL | Sets the password of the Postgres connection of the embedded Bun SQL client. |
| `PG_PORT` | <Undocumented /> | Bun SQL | Sets the port of the Postgres connection of the embedded Bun SQL client. |
| `PG_SSLMODE` | <Undocumented /> | Bun SQL | Sets the TLS mode of the Postgres connection of the embedded Bun SQL client. |
| `PG_URL` | <Undocumented /> | Bun SQL | Is a third spelling of `POSTGRES_URL` for the embedded Bun SQL client. |
| `PG_USER` | <Undocumented /> | Bun SQL | Sets the user of the Postgres connection of the embedded Bun SQL client. |
| `PGDATABASE` | <Undocumented /> | Bun SQL | Is another spelling of `PG_DATABASE`. |
| `PGHOST` | <Undocumented /> | Bun SQL | Is another spelling of `PG_HOST`. |
| `PGPASSWORD` | <Undocumented /> | Bun SQL | Is another spelling of `PG_PASSWORD`. |
| `PGPORT` | <Undocumented /> | Bun SQL | Is another spelling of `PG_PORT`. |
| `PGSSLMODE` | <Undocumented /> | Bun SQL | Is another spelling of `PG_SSLMODE`. |
| `PGURL` | <Undocumented /> | Bun SQL | Is another spelling of `POSTGRES_URL` for the embedded Bun SQL client. |
| `PGUSER` | <Undocumented /> | Bun SQL | Is another spelling of `PG_USER`. |
| `POSTGRES_URL` | <Undocumented /> | Bun SQL | Gives the default Postgres connection URL to the embedded Bun SQL client. |
| `SQLITE_URL` | <Undocumented /> | Bun SQL | Gives the default SQLite connection URL to the embedded Bun SQL client. |
| `SQLITEURL` | <Undocumented /> | Bun SQL | Is another spelling of `SQLITE_URL` for the embedded Bun SQL client. |
| `TEAMCITY_VERSION` | <Undocumented /> | color support | Is a TeamCity CI variable. |
| `TLS_DATABASE_URL` | <Undocumented /> | Bun SQL | Gives a default URL and turns on TLS for the embedded Bun SQL client. |
| `TLS_MARIADB_DATABASE_URL` | <Undocumented /> | Bun SQL | Gives the MariaDB URL and turns on TLS for the embedded Bun SQL client. |
| `TLS_MYSQL_DATABASE_URL` | <Undocumented /> | Bun SQL | Gives the MySQL URL and turns on TLS for the embedded Bun SQL client. |
| `TLS_POSTGRES_DATABASE_URL` | <Undocumented /> | Bun SQL | Gives the Postgres URL and turns on TLS for the embedded Bun SQL client. |
| `VERBOSE_SSR` | <Undocumented /> | Bun runtime | Is the debug flag for Bun server-side rendering. |

## How It Works

A scan of strings in the program found the names, so the list can miss names that the program builds at run time.
Rows describe what the library does with the name, not what Claude Code does.

## Related Pages

- [Environment Variables](index.md): how Claude Code reads variables and which value wins.
- [System and Third-Party](system-and-third-party.md)
- [Telemetry and Debug](telemetry-and-debug.md)
- [Undocumented Items](../../reference/undocumented.md): every item that only the program shows.

Source: the program (variable names found in the `2.1.314` binary) and the [Environment Variables](https://code.claude.com/docs/en/env-vars) page of the official docs.
