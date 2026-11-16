---
title: What Changed
description: What changed in Claude Code 2.1.326, the release this site covers, against 2.1.323, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.326`, the release this site covers, against `2.1.323`, the last release that this page covered.
It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.326`, the version shown in the navbar.

## Version 2.1.326

Sources: the release notes of [`2.1.325`](https://github.com/anthropics/claude-code/releases/tag/v2.1.325) and [`2.1.326`](https://github.com/anthropics/claude-code/releases/tag/v2.1.326), and a comparison of the `2.1.323` and `2.1.326` programs. The site skipped `2.1.325`, and `2.1.324` does not exist. Each row states what the linked page states. The notes items for VS Code, the web, cloud sessions, and Remote Control are not all on this site.

### Plugins and Mods

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Plugin loaded from a folder | <Documented /> | A path or link that leads outside the plugin folder is skipped, and a warning names the path. `claude plugin validate` reports some unsafe paths and links. | [Plugin Loading](../extend/plugins/loading.md#unsafe-paths-and-links), [Plugin CLI](../extend/plugins/cli.md#subcommands) |
| `extraKnownMarketplaces` in a worktree | <Documented /> | A session in a git worktree can skip the marketplaces from the worktree's own settings. A notice tells you to add the marketplace yourself. | [Plugin Loading](../extend/plugins/loading.md#unsafe-paths-and-links) |
| Malformed display field in `plugin.json` | <Documented /> | A bad `author` or `homepage` no longer stops an enabled plugin from loading. Claude Code ignores the field, and `/plugin` and `claude plugin list` show a note. | [Plugin Manifest](../extend/plugins/manifest.md#how-it-works), [Plugin CLI](../extend/plugins/cli.md#how-it-works) |
| `--plugin-dir` and nested skills | <Documented /> | A `.claude/skills` folder inside such a plugin no longer loads from a session that you started above the plugin. | [Plugin CLI](../extend/plugins/cli.md#session-flags) |
| `claude plugin eval --output-dir ''` | <Documented /> | An empty path stops with an error. Pass a directory, or leave the option out. | [Plugin CLI](../extend/plugins/cli.md#how-it-works) |
| Failed HTTPS clone | <Documented /> | The message says that git runs with terminal prompts turned off, so it needs a credential it can get without asking you. | [Plugin CLI](../extend/plugins/cli.md#how-it-works) |
| `CLAUDE_CODE_PLUGIN_MCPB_DIR` | <Undocumented /> | The folder where `.mcpb` bundles unpack is `<config>/plugins/mcpb`, and this variable replaces it. | [Plugin CLI](../extend/plugins/cli.md#how-it-works), [Plugins and MCP Variables](../configure/env-vars/plugins-and-mcp.md#variables) |
| `claude plugin uninstall` and bundles | <Documented /> | It also deletes the files unpacked from `.mcpb` and `.dxt` bundles, unless another plugin uses the bundle. | [Plugin CLI](../extend/plugins/cli.md#how-it-works) |
| `/plugin` questions | <Documented /> | Uninstall, remove-marketplace, and switch-copy questions are lists. Use the arrow keys and Enter. The keys `y`, `n`, and `u` no longer answer. | [Plugin CLI](../extend/plugins/cli.md#how-it-works) |
| `github` marketplace `ref` | <Documented /> | `ref` takes a branch, a tag, or a full commit ID. A full ID holds the marketplace at that commit. A client before `2.1.326` cannot clone such a pin. | [Marketplace](../extend/plugins/marketplace.md#marketplace-sources) |
| `pluginDigests` | <Differs /> | It is deprecated and ignored. Settings that hold it still load. A plugin must be the copy that its install record holds, or it does not load. | [Marketplace](../extend/plugins/marketplace.md#plugin-digests) |
| Marketplace trust text | <Documented /> | The add-marketplace confirmation, the install warning, and the recommendation prompt now say that plugins can run code on your computer. | [Marketplace](../extend/plugins/marketplace.md#how-it-works) |

### Mod API Type File

Source: the program: the Mod API type file (`schemas/claude-code.d.ts`) of `2.1.326`, compared with the one of `2.1.323`.

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `$.session.info` | <Documented /> | It returns the transcript file, scratchpad, prompt id, agent type, config root, platform, and hosting of the session. | [Session Calls](../extend/mod-api/calls/session.md#members), [Session Types](../extend/mod-api/types/session/compact-measure-messages.md#sessioninfo) |
| `session.stop` | <Documented /> | It fires when the person presses Stop. It only observes. | [Session Calls](../extend/mod-api/calls/session.md#engine-events), [Session Receive, Send, and Usage Types](../extend/mod-api/types/session/receive-send-usage.md#sessionstopinput) |
| `tool.judge` | <Documented /> | It fires when auto mode is about to ask its classifier about a call. | [Tool, Command, and Config Calls](../extend/mod-api/calls/tool-command-config.md#engine-events), [Tool Call, Check, and Describe Types](../extend/mod-api/types/tool-command-config/tool-calls.md#tooljudgeinput) |
| `tool.run` | <Documented /> | It fires when an allowed call is about to run. A hook can answer in place of the tool. It never fires for a refusal. | [Tool, Command, and Config Calls](../extend/mod-api/calls/tool-command-config.md#engine-events) |
| `$.fs.read` range | <Documented /> | `options.offset` and `options.length` read a range of bytes of a file. | [Files, Store, and State](../extend/mod-api/calls/fs-store-state.md#members) |
| `plugin.register` `provides` | <Documented /> | A hook can narrow what a plugin loads. `PluginRegisterInput` also holds `provides`, `unread`, and `requiredByOrganization?`. | [Plugin and Engine](../extend/mod-api/calls/plugin.md#events), [Plugin and Engine](../extend/mod-api/calls/plugin.md#types) |
| `PluginProvides` and `PluginHookEntry` | <Documented /> | New types that list what a plugin provides, kind by kind, and each settings hook that it ships. | [Plugin and Engine](../extend/mod-api/calls/plugin.md#types) |
| `$.wasm.compile` | <Documented /> | A new noun that compiles WebAssembly in the environment of the module. A `wasm.compile` hook can read, replace, or refuse the bytes. | [Clock, HTTP, Process, Environment, and Settings](../extend/mod-api/calls/clock-http-process-env-settings.md#members), [Process, Settings, and State Types](../extend/mod-api/types/infra/process-settings-state.md#wasmcompileinput) |
| `$.process.hookEnv` | <Documented /> | It returns the variables that name the session and the plugin, as a command hook gets them. | [Clock, HTTP, Process, Environment, and Settings](../extend/mod-api/calls/clock-http-process-env-settings.md#members) |
| `$.model.complete` and `$.model.classify` cost | <Documented /> | An answered request counts toward the session cost, `/cost`, `$.session.usage()`, `--max-budget-usd`, and the cost and token metrics. | [Model, Audio, and MCP](../extend/mod-api/calls/model-audio-mcp.md#members) |
| `$.audio.speak` signal | <Documented /> | It rejects at once when `options.signal` aborts. | [Model, Audio, and MCP](../extend/mod-api/calls/model-audio-mcp.md#members) |
| `$.mcp.call` | <Documented /> | A remote server that is down is dialed again with the sign-in already held. | [Model, Audio, and MCP](../extend/mod-api/calls/model-audio-mcp.md#members) |
| `$.agent.call` and `agent.call` | <Documented /> | `$.agent.call` runs a tool as an agent's own call. A hook above the caller reads the abort signal as `next.signal`. | [Agent Calls](../extend/mod-api/calls/agent.md#members-of-the-agent-noun), [Agent Calls](../extend/mod-api/calls/agent.md#events-raised-by-agent-calls) |
| `$.agent.limits` | <Documented /> | It returns how many agents may run at once, how deep they nest, and whether they may run in the background. | [Agent Calls](../extend/mod-api/calls/agent.md#members-of-the-agent-noun), [Agent Calls](../extend/mod-api/calls/agent.md#agent-limits) |
| `AgentInfo` fields | <Documented /> | `kind`, `taskStatus`, `label`, `startTime`, `cwd`, `model`, `effort`, `contextWindowSize`, `tokenCount`, `tokenSamples`, `lastRequest`, `usage`, `cost`, and `hasRow` are new. | [Agent Calls](../extend/mod-api/calls/agent.md#what-agentlist-returns) |
| `AgentSpawnInput.parentAgentId` | <Documented /> | A plugin can start a spawn under a running or resting agent of the session. | [Agent Calls](../extend/mod-api/calls/agent.md#spawn-types) |
| `ui.pointer` | <Documented /> | It fires when the person clicks or taps the backdrop. Only the hooks of the plugin that set the theme see it. | [UI Events](../extend/mod-api/ui/ui-events.md#engine-events), [UI Call Argument and Result Types](../extend/mod-api/types/ui/call-arguments.md#uipointerinput) |
| `overflowX` box prop | <Documented /> | The value `'scroll'` stops the box from wrapping its children. | [UI Element Props Types](../extend/mod-api/types/ui/element-props.md#boxprops) |
| `wrap` `'clip'` and `maxLines` | <Documented /> | `'clip'` is a new `wrap` value. `maxLines` limits the lines from 1 to 10000. | [UI Select, Text, and Focus Types](../extend/mod-api/types/ui/select-text-focus.md#textprops) |

### Settings, Permissions, and Startup

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `subagentStatusLine` | <Documented /> | It works again, after it had no effect in `2.1.323`. It is deprecated: it still works and will stop working in a future release. | [Status Line](../configure/status-line.md#subagent-status-line), [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) |
| `sandbox.autoAllowBashIfSandboxed` | <Differs /> | The default is `false`. Sandboxed commands go through the normal permission flow. Set `true` to skip the prompt. | [Sandbox](../configure/permissions/sandbox.md#core-keys), [Sandbox](../configure/permissions/sandbox.md#how-it-works) |
| `sandbox.windows.backend` | <Documented /> | A new key for Windows. `sandboxuser` is the default, and `mxc` is experimental. | [Sandbox](../configure/permissions/sandbox.md#core-keys) |
| Sandbox writes in `--add-dir` folders | <Gated /> | When a server-side flag is on, the sandbox refuses writes to protected `.claude` files in each added folder. | [Sandbox](../configure/permissions/sandbox.md#other-behavior) |
| Sandbox and `~/.ssh` | <Gated /> | `sandbox.filesystem.allowWrite` entries in project and local settings open nothing under `~/.ssh` or `~/.claude/remote`. Name `~/.ssh` in user or managed settings. | [Sandbox](../configure/permissions/sandbox.md#other-behavior) |
| Sandbox and `.git` links | <Gated /> | After a sandboxed command, Claude Code sets aside each new symlink and each new ref file that points outside `refs/`. | [Sandbox](../configure/permissions/sandbox.md#other-behavior) |
| Warning for an incomplete rule | <Documented /> | `--allowedTools`, `--disallowedTools`, and `--tools` warn at start-up about an entry that does not look like a complete rule. | [Permission Rules](../configure/permissions/rules.md#warnings-about-rules), [Flags](../configure/cli/flags.md#permissions-and-tools) |
| Warning for an unsaved rule change | <Documented /> | The terminal warns when a rule change from `/permissions`, a tool prompt, or `/add-dir` cannot be written to a settings file. | [Permission Rules](../configure/permissions/rules.md#warnings-about-rules) |
| Auto mode and failed policy settings | <Documented /> | If the served policy settings fail to load, a session that started in auto mode by default falls back to another mode. A session that starts while the policy verdict is pending picks its mode again when the verdict arrives. | [Auto Mode](../configure/permissions/auto-mode.md) |
| Auto mode and wildcard rules | <Documented /> | A `Bash` wildcard rule whose program word is not a plain name, or is a Windows path, is dropped. The safety check decides these calls. | [Auto Mode](../configure/permissions/auto-mode.md#broad-allow-rules-in-auto-mode) |
| Untrusted git repositories | <Gated /> | A read-only `git` command asks first when git would use a repository that Claude Code cannot match to a trusted folder. | [Permission Flow](../how-it-works/permission-flow.md#untrusted-git-repositories) |
| `cd` and a relative path | <Documented /> | A `Bash` command can ask first when it reads a relative path after a `cd`. | [Permission Flow](../how-it-works/permission-flow.md#sign-in-files-in-shell-commands) |
| Folder trust prompt | <Documented /> | It lists each settings file of the folder, with the tags `(runs commands)` and `(sets environment variables)`. | [Permission Flow](../how-it-works/permission-flow.md#folder-trust-prompt) |
| Settings nested too deep | <Documented /> | Values nested more than 64 levels deep are dropped, with a warning. | [Settings](../configure/settings/index.md#deep-nesting) |
| `allowedHttpHookUrls` and `httpHookAllowedEnvVars` | <Documented /> | Where managed settings do not set them, a list in another file does not apply to managed hooks. | [Hooks and Plugins Settings](../configure/settings/hooks-and-plugins.md#keys), [Hook Configuration](../extend/hooks/configuration.md#settings-keys-and-trust) |
| `awaySummaryEnabled` | <Documented /> | The automatic recap is also skipped when the last reply was billed to usage credits. | [Core Settings](../configure/settings/core.md#keys) |
| `plansDirectory` | <Documented /> | If Claude Code cannot save an approved plan there, it saves the plan in `~/.claude/plans`. | [Core Settings](../configure/settings/core.md#keys) |
| `autoContinueAtUsageLimit` | <Documented /> | The wait stops when your login changes or ends. | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) |
| `apply_flag_settings` | <Undocumented /> | A request with an invalid setting applies nothing and keeps the earlier settings. | [Control Protocol](../extend/headless/control-protocol.md#subtypes) |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | <Differs /> | It applies to every model id that Claude Code does not recognize. | [Context and Compaction Variables](../configure/env-vars/context-and-compaction.md#variables) |
| `CLAUDE_CODE_CHILD_NOTES_DIR` | <Undocumented /> | Claude Code sets it for child processes when a notes directory exists. Do not set it by hand. | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| Settings file saved with an error | <Undocumented /> | A settings file that you save with an error during a session gets a pinned warning that names the file. | [Settings](../configure/settings/index.md#errors) |
| Sandbox after a worktree move | <Documented /> | The sandbox keeps its state when a session enters or leaves a worktree, until you run `/cd` or `/sandbox`. Bash commands may then ask first. | [Sandbox](../configure/permissions/sandbox.md#other-behavior) |
| Sandbox helper programs | <Documented /> | Programs that the sandbox starts for its own use, ripgrep, and read-only local git commands run without Claude Code's sign-in tokens and API keys. | [Sandbox](../configure/permissions/sandbox.md#other-behavior) |

### Tools, Hooks, and MCP

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `Write` and `Edit` on sign-in files | <Undocumented /> | Both refuse the sign-in token file, the machine key file, the token lock file, and a hard link to one of them. | [File Tools](../reference/tools/files.md#write-and-edit-limits) |
| `Read` on a device file | <Undocumented /> | A path that names a device or process file, such as one under `/dev` or `/proc`, is refused. | [File Tools](../reference/tools/files.md#errors) |
| `ExitWorktree` | <Documented /> | `remove` is also refused while a background subagent or shell command may still run in the worktree. | [Agent and Task Tools](../reference/tools/agents-and-tasks.md#tools) |
| Goal tools | <Gated /> | `SetGoal` is the former `ProposeGoal`. `GetGoal` and `PauseGoal` are new. | [Agent and Task Tools](../reference/tools/agents-and-tasks.md#tools) |
| `SendMessage` refusal | <Undocumented /> | It refuses to send to a session on another machine when this session signs in with an API key, an auth token, a profile, or a workload identity. | [Agent and Task Tools](../reference/tools/agents-and-tasks.md#errors) |
| `Monitor` with only stderr output | <Documented /> | A watch that ends with no events, and whose command wrote to stderr, tells Claude so. | [Shell and Web Tools](../reference/tools/shell-and-web.md#how-it-works) |
| Code Mode and agent teams | <Undocumented /> | Agent teams no longer block Code Mode. | [Gated and Other Tools](../reference/tools/gated-and-other.md#code-mode) |
| Shell working directory | <Undocumented /> | A Bash command no longer runs in the launch folder when its working directory is gone. It fails with a message. | [Agent Loop](../how-it-works/agent-loop.md#the-tool-stage) |
| Subagent output limit | <Undocumented /> | A subagent whose reply stops at the token limit is asked up to 3 times to answer again, more briefly. | [Subagent Runtime](../extend/subagents/runtime.md#limits-and-switches), [Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) |
| `decision: "block"` hook output | <Documented /> | It also blocks when `hookSpecificOutput` names a different event. Claude Code ignores that field and logs a warning. | [Hook Input and Output](../extend/hooks/input-and-output.md#decision-patterns) |
| Exit code 127 on `PreToolUse` | <Documented /> | The notice adds that a program the hook needs may be missing. | [Hook Input and Output](../extend/hooks/input-and-output.md#exit-codes) |
| `updatedInput` from several hooks | <Documented /> | Claude Code keeps a hook's input rewrite in more cases when several hooks answer one call. The last `updatedInput` wins. | [Tool Events](../extend/hooks/tool-events.md#pretooluse) |
| HTTP hook `headers` | <Documented /> | Claude Code drops `Content-Length` and `Transfer-Encoding` and logs a warning. | [Hook Handlers](../extend/hooks/handlers.md#http-fields) |
| Failed hooks in the transcript | <Documented /> | A failed, blocking, or timed-out hook shows in red, and a hook that stops Claude shows in yellow. | [Hook Configuration](../extend/hooks/configuration.md#environment-variables-for-hooks) |
| `/mcp` questions from background tasks | <Documented /> | Esc and Ctrl+C read `answer later`. A closed question marks its task as `needs your input`. | [MCP Runtime](../extend/mcp/runtime.md#elicitation-and-channels) |
| MCP helper that fails | <Documented /> | It no longer marks a server as needing sign-in for other sessions when no OAuth refresh token is stored. | [MCP Auth](../extend/mcp/auth.md#headershelper) |
| `claude mcp add-json` messages | <Documented /> | A bad entry gets a message that says what to change. | [MCP CLI](../extend/mcp/cli.md#subcommands) |
| `claude mcp serve` and the sandbox | <Documented /> | It ignores `dangerouslyDisableSandbox` and `sandbox.excludedCommands`. | [MCP CLI](../extend/mcp/cli.md#subcommands) |
| `managed-mcp.json` that appears late | <Documented /> | Claude Code shows a notice, and may ignore a late file that the running account could have written. | [MCP Settings](../extend/mcp/settings.md#files-and-flags) |

### CLI, Sessions, and Accounts

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `/login` and an unused API key | <Documented /> | `/login` says that requests still use the approved key. `/status` names an unused `ANTHROPIC_API_KEY`. | [Account and Access](../how-it-works/account-and-access.md#login-and-an-unused-api-key) |
| Login code screen | <Documented /> | After you submit the code, the screen shows "Finishing sign-in…". | [Account and Access](../how-it-works/account-and-access.md#finishing-a-login) |
| `/login` code prompt | <Documented /> | It refuses a web address, a `localhost` address, or a short number code, and stays open. The sign-in request also asks for the scope `user:privacy_consents:write`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `claude auth logout` | <Undocumented /> | Claude Code asks again when the revoke request gets a server error or a network failure. | [Subcommands](../configure/cli/subcommands.md#errors) |
| Background session and `ANTHROPIC_API_KEY` | <Documented /> | A background session that is not `--bare` cannot use a key that nobody approved. | [CLI](../configure/cli/index.md#background-sessions-and-api-keys) |
| `--add-dir` and `/add-dir` | <Documented /> | They show the trust prompt for a folder you have not trusted. `claude --bg` refuses such a folder. | [Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) |
| `--rewind-files` | <Undocumented /> | It prints a warning when it leaves files untouched. | [Flags](../configure/cli/flags.md#sessions-and-worktrees) |
| `claude purge` | <Documented /> | When stdout and stderr both go to a pipe or file, it deletes nothing and tells you to use the terminal. | [Subcommands](../configure/cli/subcommands.md#commands) |
| `claude worktree-hook` | <Undocumented /> | A hidden command that runs the WorktreeCreate or WorktreeRemove hooks and reports JSON. | [Subcommands](../configure/cli/subcommands.md#commands) |
| `claude self-hosted-runner` options | <Undocumented /> | `--no-clone-through-agent-proxy` and `--use-anthropic-gh` are new hidden flags. `SELF_HOSTED_RUNNER_USE_ANTHROPIC_GH` sets the second one. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options), [Remote and Cloud Sessions Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| Print mode retry line | <Documented /> | Print mode writes a dim line to `stderr` while it waits to retry an API request. | [Headless Mode](../extend/headless/index.md#how-it-works) |
| `child-logs/` | <Undocumented /> | Debug logs of Remote Control sessions started with `--verbose` go to `~/.claude/child-logs/`. | [Sessions and Storage](../how-it-works/sessions-and-storage.md#where-files-live), [Remote Control](../configure/cli/remote-control.md#options), [Files on Disk](files-on-disk.md#caches-and-account-files) |
| Remote Control exit codes | <Documented /> | The exit code tells a service manager whether to start the server again. | [Remote Control](../configure/cli/remote-control.md#exit-codes) |
| Partial transcript line | <Undocumented /> | Claude Code adds a newline before the next append, so records do not join. | [Sessions and Storage](../how-it-works/sessions-and-storage.md#errors) |
| `/rewind` | <Documented /> | It says `Code changes unknown` for an untracked turn. A restore can skip some files, and the result says so. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/cd` in fullscreen mode | <Documented /> | When the trust prompt does not fit the window, `Yes` is refused until the window is taller. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/memory`, `/skills`, `/tui` | <Documented /> | `/memory` warns about a read-only file. `/skills` closes on a second Ctrl+C or Ctrl+D. `/tui` names what keeps the renderer. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| `/terminal-setup`, `/help`, `/status` | <Documented /> | `/terminal-setup` names the tmux lines that Shift+Enter needs. `/help` takes `[command]`, and `/<command> --help` opens it for a built-in command. `/status` has a `Features` row. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |
| Command that is off | <Documented /> | A built-in command that is off says why, instead of `Unknown command`. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#when-a-command-is-off) |
| Queued message hint | <Undocumented /> | The hint reads `Queued · <key> send now`, or `Queued · click to send now`. | [Unbound and Reserved Keys](../configure/keybindings/unbound-and-reserved.md#click-to-send-a-queued-message) |

### Models, Network, and Telemetry

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Refused `max_tokens` | <Undocumented /> | Claude Code resends the request with the limit that the error names. It keeps the lower cap until `/clear`, compaction, resume, or a provider change. | [Model Endpoints](../reference/api/endpoints.md#model-endpoints), [Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) |
| Context length errors of gateways | <Undocumented /> | Claude Code knows the errors of many third-party gateways and Foundry, so sessions compact instead of stopping on every turn. | [Models](../how-it-works/models.md#retries-and-timeouts) |
| `opusplan` | <Documented /> | A subagent that has its own model keeps it in plan mode. | [Model Catalog](../configure/models-and-providers/model-catalog.md#aliases) |
| `sonnet[1m]` | <Undocumented /> | Claude Code no longer rewrites a saved `sonnet[1m]` to a dated model ID. | [Model Catalog](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) |
| `/api/oauth/usage` | <Undocumented /> | The usage read adds `skip_spend=1` for each read kind except the plain one. | [Account and Service Endpoints](../reference/api/endpoints.md#account-and-service-endpoints) |
| `/v1/privacy-consents` | <Undocumented /> | Claude Code reads and saves the training consent with your claude.ai sign-in. | [Sign-In and Account Paths](../reference/api/endpoints.md#sign-in-and-account-paths) |
| Push notification text | <Undocumented /> | The tool description in a push notification from Remote Control or a cloud session is masked. | [Secret Masking](../reference/secret-masking.md#where-it-applies) |
| `CLAUDE_BG_GATEWAY_ROUTED` | <Undocumented /> | The background dispatcher sets it. A session with the mark stops when it loses its gateway. | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#variables) |
| `CERT_SIGNATURE_FAILURE` | <Documented /> | The error names a possible cause after a CA renewal and what IT can change. | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#certificate-signature-errors) |
| `ALL_PROXY` as the only proxy | <Documented /> | Plugin and marketplace requests fail after 25 seconds when the proxy never answers. | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#proxy-requests-with-only-all_proxy) |
| `user_prompt` event | <Undocumented /> | A message sent while tool calls run also gives this event, with `delivery.mode` set to `mid_turn`. | [OpenTelemetry](../reference/opentelemetry.md#events) |
| `tool_decision` event | <Documented /> | A managed `PreToolUse` hook that refuses a tool call also leaves this event and an entry in `permission_denials`. | [OpenTelemetry](../reference/opentelemetry.md#events) |
| `OTEL_RESOURCE_INCLUDE_HOST` | <Undocumented /> | It adds `host.name` and `host.id` to the OpenTelemetry resource. | [Telemetry and Debug Variables](../configure/env-vars/telemetry-and-debug.md#variables) |

## Earlier Releases

This site keeps no page for an older release. The official [Changelog](https://code.claude.com/docs/en/changelog) lists every release.

## Example

In `2.1.326`, `subagentStatusLine` works again. It is deprecated, but it still works.
Check the version, then check that a settings file with the key loads:

```bash
claude --version
claude -p --settings '{"subagentStatusLine":{"type":"command","command":"echo hi"}}' "Reply with 'OK'."
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
