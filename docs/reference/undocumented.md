---
title: Undocumented Items
description: Every item that only the program shows, with a link to its page.
sidebar_position: 10
draft: false
---

This page lists everything that official Anthropic docs leave out.
Each item carries the <Undocumented /> badge on its own page.
Here you find them all in one place, sorted by surface, with a link to the page that explains each one.
An undocumented item can change or vanish in any release, so treat it with care.

Counts are table rows. A row can name several items, such as a list of related variables.
Items that the docs name but describe wrongly are in [Behaves Differently From the Docs](#behaves-differently-from-the-docs).

## Summary

| Group | Count |
| --- | --- |
| [Settings Keys](#settings-keys) | 25 |
| [Environment Variables](#environment-variables) | 1092 |
| [CLI Flags and Subcommands](#cli-flags-and-subcommands) | 52 |
| [Permissions](#permissions) | 121 |
| [Hooks](#hooks) | 15 |
| [Commands](#commands) | 2 |
| [Skills](#skills) | 7 |
| [Subagents](#subagents) | 7 |
| [Plugins](#plugins) | 9 |
| [MCP](#mcp) | 32 |
| [Tools](#tools) | 30 |
| [API Endpoints and Betas](#api-endpoints-and-betas) | 98 |
| [System Prompt](#system-prompt) | 34 |
| [Transcript and Sessions](#transcript-and-sessions) | 13 |
| [Headless Protocol](#headless-protocol) | 195 |
| [Mod API](#mod-api) | 0 |
| [Other](#other) | 108 |
| Total | 1840 |

## Settings Keys

Keys for `settings.json` that no official page lists.

Count: 25.

| Item | Where |
| --- | --- |
| `autoUploadSessions` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `daemonColdStart` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `doneMeansMerged` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `modelProposedGoals` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `remoteControl` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `remoteTools` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `skipWorkflowUsageWarning` | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) (Keys) |
| `xaaIdp` | [Auth Settings](../configure/settings/auth.md#keys) (Keys); [MCP Settings and Policy](../extend/mcp/settings.md#settings-keys) (Settings Keys) |
| `autoDreamEnabled` | [Core Settings](../configure/settings/core.md#keys) (Keys); [Memory and Rules](../configure/memory-and-rules.md#auto-memory) (Auto Memory) |
| `precomputeCompactionEnabled` | [Core Settings](../configure/settings/core.md#keys) (Keys) |
| `todoFeatureEnabled` | [Core Settings](../configure/settings/core.md#keys) (Keys) |
| `policyHelpers` | [Enterprise Settings](../configure/settings/enterprise.md#keys) (Keys) |
| `defaultView` | [Extra Keys and Global Config](../configure/settings/extra-keys.md#auto-mode-voice-and-display-keys) (Auto Mode, Voice, and Display Keys) |
| `disablePluginDirectory` | [Extra Keys and Global Config](../configure/settings/extra-keys.md#other-keys) (Other Keys) |
| `isolation.required` | [Extra Keys and Global Config](../configure/settings/extra-keys.md#other-keys) (Other Keys) |
| `isolation.persistHome` | [Extra Keys and Global Config](../configure/settings/extra-keys.md#other-keys) (Other Keys) |
| `remoteControl.shareHostProfile` | [Extra Keys and Global Config](../configure/settings/extra-keys.md#other-keys) (Other Keys) |
| `remoteTools.allowUnattendedServing` | [Extra Keys and Global Config](../configure/settings/extra-keys.md#other-keys) (Other Keys) |
| `modelProposedGoals`, `feedbackDrafts`, `availableModelsMatch`, and 2 more | [Settings Files and Scopes](../configure/settings/index.md#exceptions-to-managed-precedence) (Exceptions to Managed Precedence) |
| `totalTokensReminder` | [Model Settings](../configure/settings/model.md#keys) (Keys) |
| `totalTokensReminderAfterUserTurn` | [Model Settings](../configure/settings/model.md#keys) (Keys) |
| `totalTokensReminderBudget` | [Model Settings](../configure/settings/model.md#keys) (Keys) |
| `breakReminder` | [Interface Settings](../configure/settings/ui.md#keys) (Keys) |
| `quietHours` | [Interface Settings](../configure/settings/ui.md#keys) (Keys) |
| `showMessageTimestamps` | [Interface Settings](../configure/settings/ui.md#keys) (Keys) |

## Environment Variables

There are too many to list one by one. Each page below holds a table, and every undocumented variable in it has the Undocumented badge. The pages sort variables by what they do.

Count: 1092.

| Page | Undocumented Rows |
| --- | --- |
| [Agents and Teams](../configure/env-vars/agents-and-teams.md) | 56 |
| [Auth and Accounts](../configure/env-vars/auth-and-accounts.md) | 52 |
| [Bundled Libraries](../configure/env-vars/bundled-libraries.md) | 123 |
| [Cloud Providers](../configure/env-vars/cloud-providers.md) | 31 |
| [Context and Compaction](../configure/env-vars/context-and-compaction.md) | 31 |
| [Features and Toggles](../configure/env-vars/features-and-toggles.md) | 58 |
| [Models and Effort](../configure/env-vars/models-and-effort.md) | 33 |
| [Network and Proxy](../configure/env-vars/network-and-proxy.md) | 31 |
| [Plugins and MCP](../configure/env-vars/plugins-and-mcp.md) | 64 |
| [Remote and Cloud Sessions](../configure/env-vars/remote-and-cloud-sessions.md) | 152 |
| [SDK and Automation](../configure/env-vars/sdk-and-automation.md) | 28 |
| [Sessions and Storage](../configure/env-vars/sessions-and-storage.md) | 53 |
| [System and Third-Party](../configure/env-vars/system-and-third-party.md) | 195 |
| [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md) | 83 |
| [Tools and Bash](../configure/env-vars/tools-and-bash.md) | 56 |
| [UI and Terminal](../configure/env-vars/ui-and-terminal.md) | 46 |

## CLI Flags and Subcommands

Hidden or unlisted flags and subcommands.

Count: 52.

| Item | Where |
| --- | --- |
| `--plugin-dir-no-mcp <path>` | [Plugin Commands](../extend/plugins/cli.md#session-flags) (Session Flags); [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context); [MCP Settings and Policy](../extend/mcp/settings.md#files-and-flags) (Files and Flags) |
| `--session-mirror` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--await-claim` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--await-initialize` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--sdk-url <url>` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--enable-auth-status` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--workload <tag>` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--client-data-url <url>` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--allow-other-models` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--managed-settings <json>` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `--host-auth-is-org-sign-in` | [All Flags](../configure/cli/flags.md#start-and-print-mode) (Start and Print Mode) |
| `-d2e, --debug-to-stderr` | [All Flags](../configure/cli/flags.md#safe-modes-settings-and-debug) (Safe Modes, Settings, and Debug) |
| `--project-config-root <dir>` | [All Flags](../configure/cli/flags.md#safe-modes-settings-and-debug) (Safe Modes, Settings, and Debug) |
| `--inherit-permission-mode <mode>` | [All Flags](../configure/cli/flags.md#permissions-and-tools) (Permissions and Tools) |
| `--plan-mode-instructions <instructions>` | [All Flags](../configure/cli/flags.md#permissions-and-tools) (Permissions and Tools) |
| `--thinking <mode>` | [All Flags](../configure/cli/flags.md#model-and-thinking) (Model and Thinking) |
| `--thinking-display <display>` | [All Flags](../configure/cli/flags.md#model-and-thinking) (Model and Thinking) |
| `--max-thinking-tokens <tokens>` | [All Flags](../configure/cli/flags.md#model-and-thinking) (Model and Thinking) |
| `--task-budget <tokens>` | [All Flags](../configure/cli/flags.md#model-and-thinking) (Model and Thinking) |
| `--fast-mode <on\|off>` | [All Flags](../configure/cli/flags.md#model-and-thinking) (Model and Thinking) |
| `--include-unsupported-models` | [All Flags](../configure/cli/flags.md#model-and-thinking) (Model and Thinking); [Models and Providers](../configure/models-and-providers/model-catalog.md#choose-a-model) (Choose a Model) |
| `--resume-session-at <message id>` | [All Flags](../configure/cli/flags.md#sessions-and-worktrees) (Sessions and Worktrees); [Sessions and Storage](../how-it-works/sessions-and-storage.md#resume-and-branch) (Resume and Branch) |
| `--resume-drops-turn <message id>` | [All Flags](../configure/cli/flags.md#sessions-and-worktrees) (Sessions and Worktrees) |
| `--reply-on-resume` | [All Flags](../configure/cli/flags.md#sessions-and-worktrees) (Sessions and Worktrees); [Sessions and Storage](../how-it-works/sessions-and-storage.md#resume-and-branch) (Resume and Branch) |
| `--rewind-files <user-message-id>` | [All Flags](../configure/cli/flags.md#sessions-and-worktrees) (Sessions and Worktrees); [Sessions and Storage](../how-it-works/sessions-and-storage.md#resume-and-branch) (Resume and Branch) |
| `--brief` | [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context) |
| `--file <specs...>` | [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context) |
| `--watch-artifact <artifact>` | [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context) |
| `--watch-artifact-no-autoreact <artifact>` | [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context) |
| `--messaging-socket-path <path>` | [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context) |
| `--proactivity <level>` | [All Flags](../configure/cli/flags.md#agents-plugins-mcp-and-context) (Agents, Plugins, MCP, and Context) |
| `--agent-id <id>` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--agent-name <name>` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--team-name <name>` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--agent-color <color>` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--plan-mode-required` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--agent-type <type>` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--parent-session-id <id>` | [All Flags](../configure/cli/flags.md#teammate-flags) (Teammate Flags) |
| `--prefill <text>` | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) (IDE, Desktop, and Deep Links) |
| `--prefill-b64 <b64>` | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) (IDE, Desktop, and Deep Links) |
| `--deep-link-origin` | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) (IDE, Desktop, and Deep Links) |
| `--deep-link-repo <slug>` | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) (IDE, Desktop, and Deep Links) |
| `--deep-link-last-fetch <ms>` | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) (IDE, Desktop, and Deep Links) |
| `--deep-link-cwd-b64 <b64>` | [All Flags](../configure/cli/flags.md#ide-desktop-and-deep-links) (IDE, Desktop, and Deep Links) |
| `--pool <pool_id>` | [All Flags](../configure/cli/flags.md#cloud-and-remote-sessions) (Cloud and Remote Sessions) |
| `--correlation-id <id>` | [All Flags](../configure/cli/flags.md#cloud-and-remote-sessions) (Cloud and Remote Sessions) |
| `--on-branch <branch>` | [All Flags](../configure/cli/flags.md#cloud-and-remote-sessions) (Cloud and Remote Sessions) |
| `--forward-home-settings <true\|false>` | [All Flags](../configure/cli/flags.md#cloud-and-remote-sessions) (Cloud and Remote Sessions) |
| `--attach-serve <session_id>` | [All Flags](../configure/cli/flags.md#cloud-and-remote-sessions) (Cloud and Remote Sessions) |
| `claude sandbox` | [Subcommands](../configure/cli/subcommands.md#commands) (Commands) |
| `claude edit-hook`, `edit-permission-rules`, `edit-memory-settings`, and 5 more | [Subcommands](../configure/cli/subcommands.md#commands) (Commands) |
| `claude import-conversations <exportPath>` | [Subcommands](../configure/cli/subcommands.md#commands) (Commands) |

## Permissions

Auto mode rules, permission modes, rule syntax, and the sandbox.

Count: 121.

The 85 default auto mode rules are all listed on [Auto Mode Default Rules](../configure/permissions/auto-mode-rules.md). They are not repeated here.

| Item | Where |
| --- | --- |
| `CLAUDE_CODE_AUTO_MODE_MODEL` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_BG_CLASSIFIER_MODEL` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_AUTO_MODE_TIER` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_CLASSIFIER_SUMMARY` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_TWO_STAGE_CLASSIFIER` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_AUTO_MODE_EXTERNAL_PERMISSIONS` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CHROME_CLASSIFIER_FLOOR`, `CLAUDE_CHROME_PERMISSION_MODE` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_BG_SESSION_PERMISSION_RULES` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_PARKED_PERMISSION_WAIT_MS` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG` | [Auto Mode](../configure/permissions/auto-mode.md#environment-variables) (Environment Variables); [Hook Configuration](../extend/hooks/configuration.md#failure-handling) (Failure Handling) |
| `rule` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `mode` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `subcommandResults` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `permissionPromptTool` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `hook` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `asyncAgent` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `sandboxOverride` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `workingDir` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `safetyCheck` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `classifier` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `other` | [Permission Modes](../configure/permissions/modes.md#decision-reasons) (Decision Reasons) |
| `dangerousRemoval` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `backgroundOperator` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `suspiciousWindowsPath` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `restrictedMode` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `outsideReadsBlocked` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `claudeSettingsFile` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `internalHardDeny` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `unfinishedCheck` | [Permission Modes](../configure/permissions/modes.md#safety-checks) (Safety Checks) |
| `mcp__server`, `mcp__server__tool` | [Permission Rules](../configure/permissions/rules.md#rule-syntax) (Rule Syntax) |
| `sandbox.ripgrep.command`, `sandbox.ripgrep.args` | [Sandbox](../configure/permissions/sandbox.md#core-keys) (Core Keys) |
| `CLAUDE_CODE_BASH_SANDBOX_SHOW_INDICATOR` | [Sandbox](../configure/permissions/sandbox.md#environment-variables) (Environment Variables) |
| `IS_SANDBOX` | [Sandbox](../configure/permissions/sandbox.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_SANDBOXED` | [Sandbox](../configure/permissions/sandbox.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_SANDBOX_LEAVE_PARENT_FOLDERS_ALONE` | [Sandbox](../configure/permissions/sandbox.md#environment-variables) (Environment Variables) |
| `CLAUDE_CODE_SANDBOX_LEAVE_DENIES_TO_SRT_WIN` | [Sandbox](../configure/permissions/sandbox.md#environment-variables) (Environment Variables) |

## Hooks

Hook settings, events, fields, and handler types.

Count: 15.

| Item | Where |
| --- | --- |
| `asyncTimeout` | [Hook Configuration](../extend/hooks/configuration.md#timeouts) (Timeouts) |
| `onFailure` has no effect | [Hook Configuration](../extend/hooks/configuration.md#failure-handling) (Failure Handling) |
| `CLAUDE_CODE_HOOKS_SAME_THREAD` | [Hook Configuration](../extend/hooks/configuration.md#environment-variables-for-hooks) (Environment Variables for Hooks) |
| `CLAUDE_CODE_DISABLE_HOOK_FORWARDING` | [Hook Configuration](../extend/hooks/configuration.md#environment-variables-for-hooks) (Environment Variables for Hooks) |
| `CLAUDE_CODE_RESUME_SESSIONSTART_HOOKS_WAIT_MS` | [Hook Configuration](../extend/hooks/configuration.md#environment-variables-for-hooks) (Environment Variables for Hooks) |
| `DISABLE_BRIEF_MODE_STOP_HOOK` | [Hook Configuration](../extend/hooks/configuration.md#environment-variables-for-hooks) (Environment Variables for Hooks) |
| `permissionDisplay` | [Hook Events](../extend/hooks/tool-events.md#pretooluse) (PreToolUse) |
| `source` | [Hook Events](../extend/hooks/session-events.md#userpromptsubmit) (UserPromptSubmit) |
| `auth_storage_failure`, `computer_use_enter`, `computer_use_exit`, and 3 more | [Hook Events](../extend/hooks/session-events.md#notification) (Notification) |
| `callback` | [Hook Handlers](../extend/hooks/handlers.md#handler-types) (Handler Types) |
| `rewakeMessage` | [Hook Handlers](../extend/hooks/handlers.md#command-fields) (Command Fields) |
| `rewakeSummary` | [Hook Handlers](../extend/hooks/handlers.md#command-fields) (Command Fields) |
| `cloud` | [Hook Handlers](../extend/hooks/handlers.md#command-fields) (Command Fields) |
| SDK callback hooks | [Hooks](../extend/hooks/index.md#where-hooks-are-defined) (Where Hooks Are Defined) |
| `{"async":true,"asyncTimeout":n}` | [Hook Input and Output](../extend/hooks/input-and-output.md#universal-output-fields) (Universal Output Fields) |

## Commands

Slash commands that no official page lists.

Count: 2.

| Item | Where |
| --- | --- |
| `/pro-trial-expired` | [Slash Commands](../extend/skills-and-commands/slash-commands.md#account-cloud-and-other-commands) (Account, Cloud, and Other Commands) |
| `/daemon` | [Slash Commands](../extend/skills-and-commands/slash-commands.md#account-cloud-and-other-commands) (Account, Cloud, and Other Commands) |

## Skills

Skill frontmatter, bundled skills, and substitutions.

Count: 7.

| Item | Where |
| --- | --- |
| `/keybindings-help` | [Bundled Skills](../extend/skills-and-commands/bundled-skills.md#skills) (Skills) |
| `created_by`, `improved_by` | [Skill Frontmatter](../extend/skills-and-commands/frontmatter.md#keys) (Keys) |
| MCP-served skill | [Skills and Commands](../extend/skills-and-commands/index.md#skill-locations) (Skill Locations) |
| Skill `loadedFrom` values | [Skills and Commands](../extend/skills-and-commands/index.md#skill-locations) (Skill Locations) |
| Name length | [Skills and Commands](../extend/skills-and-commands/index.md#name-resolution) (Name Resolution) |
| Total size cap | [Substitutions and Invocation](../extend/skills-and-commands/substitutions.md#string-substitutions) (String Substitutions) |
| Commit-time skills | [Substitutions and Invocation](../extend/skills-and-commands/substitutions.md#invocation-control) (Invocation Control) |

## Subagents

Frontmatter keys and built-in agents that official pages leave out.

Count: 7.

| Item | Where |
| --- | --- |
| `observer` | [Subagent Frontmatter](../extend/subagents/frontmatter.md#keys) (Keys) |
| `observerMessage` | [Subagent Frontmatter](../extend/subagents/frontmatter.md#keys) (Keys) |
| `observeSubagents` | [Subagent Frontmatter](../extend/subagents/frontmatter.md#keys) (Keys) |
| `workflow-subagent` | [Subagent Runtime](../extend/subagents/runtime.md#built-in-agents) (Built-In Agents) |
| `comment-thread-analyst` | [Subagent Runtime](../extend/subagents/runtime.md#built-in-agents) (Built-In Agents) |
| Web-reading agent | [Subagent Runtime](../extend/subagents/runtime.md#built-in-agents) (Built-In Agents) |
| `CLAUDE_CODE_ENABLE_APPEND_SUBAGENT_PROMPT`, `CLAUDE_CODE_MEMORY_SUBAGENT_APPEND`, `CLAUDE_CODE_SUBAGENT_PROMPT_SNAPSHOT`, and 2 more | [Subagent Runtime](../extend/subagents/runtime.md#limits-and-switches) (Limits and Switches) |

## Plugins

Manifest keys, cache files, and plugin switches.

Count: 9.

| Item | Where |
| --- | --- |
| `plugins/cache/<marketplace>/<plugin>/<version>/` | [Plugin Loading](../extend/plugins/loading.md#paths) (Paths) |
| `plugins/installed_plugins.json` | [Plugin Loading](../extend/plugins/loading.md#paths) (Paths) |
| `plugins/known_marketplaces.json` | [Plugin Loading](../extend/plugins/loading.md#paths) (Paths) |
| `installed`, `marketplaces`, `flagged`, and 2 more | [Plugin Loading](../extend/plugins/loading.md#paths) (Paths) |
| `CLAUDE_CODE_PLUGIN_USE_ZIP_CACHE`, `CLAUDE_CODE_PLUGIN_BINARY_ASSETS`, `CLAUDE_CODE_PLUGIN_ATTRIBUTION`, and 2 more | [Plugin Loading](../extend/plugins/loading.md#env-vars) (Env Vars) |
| `CLAUDE_CODE_SKIP_PLUGIN_MCP_SERVERS`, `CLAUDE_CODE_SKIP_PLUGIN_MCP_SERVERS_EXCEPT`, `CLAUDE_CODE_SKIP_PLUGIN_LOCAL_MCP_SERVERS`, `CLAUDE_CODE_SKIP_PLUGIN_MCP_BUNDLES` | [Plugin Loading](../extend/plugins/loading.md#env-vars) (Env Vars) |
| `experimental.syntaxHighlighting.hljsLanguages` | [Plugin Manifest](../extend/plugins/manifest.md#top-level-keys) (Top-Level Keys) |
| `binaries` | [Plugin Manifest](../extend/plugins/manifest.md#top-level-keys) (Top-Level Keys) |
| `unsupported` | [Marketplaces](../extend/plugins/marketplace.md#plugin-sources) (Plugin Sources) |

## MCP

Server types, scopes, options, and variables for MCP.

Count: 32.

| Item | Where |
| --- | --- |
| `MCP_OAUTH_CLIENT_METADATA_URL` | [MCP Authentication](../extend/mcp/auth.md#oauth-options) (OAuth Options); [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `bareElicitationCapability` | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| `discoveryCache` | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| `request_timeout_ms` | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| `toolPermissions` | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| `disableAutoBackground` | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| `ideName`, `ideRunningInWindows`, `authToken` | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| `cachedInitResponse`, `cachedDiscoverResponse`, `discoverSupport`, and 2 more | [Server Configuration](../extend/mcp/config.md#server-options) (Server Options) |
| Blocked names | [Server Configuration](../extend/mcp/config.md#names) (Names) |
| `ENABLE_MCP_LARGE_OUTPUT_FILES` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables); [MCP Runtime](../extend/mcp/runtime.md#limits) (Limits) |
| `CLAUDE_CODE_MCP_APPS_HOST` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables); [MCP Runtime](../extend/mcp/runtime.md#resources-and-prompts) (Resources and Prompts) |
| `CLAUDE_CODE_SKIP_PLUGIN_MCP_SERVERS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables); [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_SKIP_PLUGIN_MCP_SERVERS_EXCEPT` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_SKIP_PLUGIN_LOCAL_MCP_SERVERS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_SKIP_PLUGIN_MCP_BUNDLES` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_ENABLE_REFRESH_MCP_TOOLS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `MCP_TRUNCATION_PROMPT_OVERRIDE` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_SYNC_PLUGINS_MCP_TIMEOUT_MS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_MCP_CONNECTOR_PREWAIT_MS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_MCP_PREWAIT_SERVERS`, `CLAUDE_CODE_MCP_PREWAIT_SERVERS_MS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_MCP_MEMORY_CGROUP` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_TERMINAL_MCP_TOOLS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_AGENT_SDK_DISABLE_MCP_MANIFESTS` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `CLAUDE_CODE_BRIDGE_MCP_CARRIER` | [MCP Env Vars](../extend/mcp/env.md#undocumented-variables) (Undocumented Variables) |
| `sse-ide` | [MCP](../extend/mcp/index.md#transports) (Transports) |
| `ws-ide` | [MCP](../extend/mcp/index.md#transports) (Transports) |
| `claudeai-proxy` | [MCP](../extend/mcp/index.md#transports) (Transports) |
| `dynamic` | [MCP](../extend/mcp/index.md#scopes) (Scopes) |
| `enterprise`, `agent` | [MCP](../extend/mcp/index.md#scopes) (Scopes) |
| `SearchMcpRegistry`, `SuggestConnectors`, `ListConnectors` | [MCP Runtime](../extend/mcp/runtime.md#tools-and-names) (Tools and Names) |
| `ReadMcpResourceDirTool` | [MCP Runtime](../extend/mcp/runtime.md#resources-and-prompts) (Resources and Prompts) |
| Old tool names | [MCP Runtime](../extend/mcp/runtime.md#resources-and-prompts) (Resources and Prompts) |

## Tools

Tools and tool parameters.

Count: 30.

| Item | Where |
| --- | --- |
| `ProposeGoal` | [Agents, Tasks, and Planning](tools/agents-and-tasks.md#tools) (Tools) |
| `memory_read` | [Files, Search, and Memory](tools/files.md#tools) (Tools) |
| `memory_write` | [Files, Search, and Memory](tools/files.md#tools) (Tools) |
| `memory_list` | [Files, Search, and Memory](tools/files.md#tools) (Tools) |
| `ReadNotifications` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `ShowOnboardingRolePicker` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `OfferChromeSetup` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `SendUserMessage` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `SuggestPluginInstall` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `SuggestSkills` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `FetchInboxMessage` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `PublishPlugin` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `AppifactRepl` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `SendFile` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `DesignSync` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `ClaudeDesign` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `Projects` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `SearchMcpRegistry` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `SuggestConnectors` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `ListConnectors` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `propose_skills` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#gated-tools) (Gated Tools) |
| `ListPlugins`, `ListSkills`, `SearchPlugins`, `SearchSkills`, `RefreshMcpTools`, `enable__mcp__claude-in-chrome`, `enable__mcp__remote-devices__Claude_Browser`, `enable__mcp__remote-devices__computer`, `request_computer` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#plugin-skill-and-browser-tools) (Plugin, Skill, and Browser Tools) |
| `StructuredOutput` | [Gated and Surface-Specific Tools](tools/gated-and-other.md#tools-without-an-inventory-row) (Tools without an Inventory Row) |
| Query `select:A,B` | [Tools](tools/index.md#toolsearch) (ToolSearch) |
| Query keywords | [Tools](tools/index.md#toolsearch) (ToolSearch) |
| Query `+term rest` | [Tools](tools/index.md#toolsearch) (ToolSearch) |
| Placeholder tool | [Tools](tools/index.md#toolsearch) (ToolSearch) |
| Server-side never-defer list | [Tools](tools/index.md#switches-for-tool-search) (Switches for Tool Search) |
| Server-side defer list | [Tools](tools/index.md#switches-for-tool-search) (Switches for Tool Search) |
| `GetTask` | [Shell, Web, and Background Tasks](tools/shell-and-web.md#tools) (Tools) |

## API Endpoints and Betas

Endpoints that Claude Code calls and the beta headers it sends.

Count: 98.

| Item | Where |
| --- | --- |
| `claude-code-20250219` | [Betas](api/betas.md#registry) (Registry) |
| `oauth-2025-04-20` | [Betas](api/betas.md#registry) (Registry) |
| `context-1m-2025-08-07` | [Betas](api/betas.md#registry) (Registry) |
| `context-management-2025-06-27` | [Betas](api/betas.md#registry) (Registry) |
| `structured-outputs-2025-12-15` | [Betas](api/betas.md#registry) (Registry) |
| `web-search-2025-03-05` | [Betas](api/betas.md#registry) (Registry) |
| `advanced-tool-use-2025-11-20` | [Betas](api/betas.md#registry) (Registry) |
| `tool-search-tool-2025-10-19` | [Betas](api/betas.md#registry) (Registry) |
| `effort-2025-11-24` | [Betas](api/betas.md#registry) (Registry) |
| `task-budgets-2026-03-13` | [Betas](api/betas.md#registry) (Registry) |
| `prompt-caching-scope-2026-01-05` | [Betas](api/betas.md#registry) (Registry) |
| `prompt-caching-evict-2026-05-12` | [Betas](api/betas.md#registry) (Registry) |
| `cache-keepalive-2026-09-03` | [Betas](api/betas.md#registry) (Registry) |
| `fast-mode-2026-02-01` | [Betas](api/betas.md#registry) (Registry) |
| `redact-thinking-2026-02-12` | [Betas](api/betas.md#registry) (Registry) |
| `thinking-resumption-2026-07-17` | [Betas](api/betas.md#registry) (Registry) |
| `thinking-token-count-2026-05-13` | [Betas](api/betas.md#registry) (Registry) |
| `afk-mode-2026-01-31` | [Betas](api/betas.md#registry) (Registry) |
| `advisor-tool-2026-03-01` | [Betas](api/betas.md#registry) (Registry) |
| `cache-diagnosis-2026-04-07` | [Betas](api/betas.md#registry) (Registry) |
| `context-hint-2026-04-09` | [Betas](api/betas.md#registry) (Registry) |
| `mcp-servers-2025-12-04` | [Betas](api/betas.md#registry) (Registry) |
| `files-api-2025-04-14` | [Betas](api/betas.md#registry) (Registry) |
| `environments-2025-11-01` | [Betas](api/betas.md#registry) (Registry) |
| `per-turn-control-2026-07-01` | [Betas](api/betas.md#registry) (Registry); [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#effort) (Effort) |
| `timing-2026-09-09` | [Betas](api/betas.md#registry) (Registry) |
| `mid-conversation-tool-changes-2026-07-01` | [Betas](api/betas.md#registry) (Registry) |
| `inline-tools-2026-09-15` | [Betas](api/betas.md#registry) (Registry) |
| `server-side-fallback-2026-06-01` | [Betas](api/betas.md#registry) (Registry) |
| `server-side-fallback-2026-07-01` | [Betas](api/betas.md#registry) (Registry) |
| `fallback-credit-2026-06-01` | [Betas](api/betas.md#registry) (Registry) |
| `auto-mode-classifier-2026-07-16` | [Betas](api/betas.md#registry) (Registry) |
| `dangerous-tool-use-2026-09-03` | [Betas](api/betas.md#registry) (Registry) |
| `thinking-display-updates-2026-08-18` | [Betas](api/betas.md#registry) (Registry) |
| `thinking-binding-controls-2026-08-01` | [Betas](api/betas.md#registry) (Registry) |
| `message-threads-2026-08-12` | [Betas](api/betas.md#registry) (Registry) |
| `mid-conversation-system-2026-04-07` | [Betas](api/betas.md#registry) (Registry) |
| `mid-conversation-system-clear-at-2026-08-21` | [Betas](api/betas.md#registry) (Registry) |
| `/v1/messages/cache_touch` | [Endpoints and Headers](api/endpoints.md#model-endpoints) (Model Endpoints) |
| `/v1/oauth/token`, `/api/oauth/profile`, `/api/oauth/usage`, `/api/oauth/account/settings` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/oauth/account/settings?opt_in_only_if_unset=grove_enabled` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/claude_code/policy_limits` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/claude_code/organizations/metrics_enabled`, `/api/claude_code/notification/preferences`, `/api/claude_code/skills` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/event_logging/v2/batch` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/claude_cli_feedback`, `/api/claude_code_shared_session_transcripts` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/v1/code/sessions`, `/v1/code/triggers`, `/v1/code/github/*`, `/v1/code/agent-proxy` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/v1/ultrareview/quota`, `/v1/ultrareview/preflight` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/model_selector/{id}`, `/api/organization/claude_code_first_token_date` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/ws/speech_to_text/voice_stream` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/frame/*`, `/v1/design/*` | [Endpoints and Headers](api/endpoints.md#account-and-service-endpoints) (Account and Service Endpoints) |
| `/api/claude_cli/bootstrap` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/claude_code/settings` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/claude_code/metrics` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/claude_cli_profile` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/claude_code_grove`, `/api/oauth/account/grove_notice_viewed` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/claude_code_penguin_mode` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/auth/trusted_devices` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/oauth/validate` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/oauth/claude_cli/create_api_key`, `/api/oauth/claude_cli/roles`, `https://api.anthropic.com/api/oauth/claude_cli/create_api_key`, and 1 more | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/oauth/organizations/${…}`, `/api/oauth/organizations/${…}/code/repos/${…}/${…}`, `/api/oauth/organizations/${…}/code/repos/resync`, and 1 more | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/organizations/${…}/reset_rate_limits` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/oauth/file_upload`, `/api/oauth/files/${…}/content` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/oauth/cri`, `https://api.anthropic.com/api/oauth/cri` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/api/oauth/local_pairing` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `/v1/oauth/hello` | [Endpoints and Headers](api/endpoints.md#sign-in-and-account-paths) (Sign-In and Account Paths) |
| `https://platform.claude.com/oauth/authorize` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `https://claude.com/cai/oauth/authorize` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `https://platform.claude.com/v1/oauth/token` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `https://platform.claude.com/oauth/code/callback` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `https://platform.claude.com/oauth/code/success?app=claude-code`, `https://platform.claude.com/buy_credits?returnUrl=/oauth/code/success%3Fapp%3Dclaude-code` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `https://claude.ai/oauth/claude-code-client-metadata` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `https://api.anthropic.com`, `https://claude.ai`, `https://mcp-proxy.anthropic.com` | [Endpoints and Headers](api/endpoints.md#oauth-urls-and-hosts) (OAuth URLs and Hosts) |
| `/v1/mcp_servers?limit=1000` | [Endpoints and Headers](api/endpoints.md#mcp-paths) (MCP Paths) |
| `/v1/mcp/{server_id}`, `/v1/toolbox/shttp/mcp/{server_id}` | [Endpoints and Headers](api/endpoints.md#mcp-paths) (MCP Paths) |
| `/api/organizations/${…}/mcp/start-auth/${…}?product_surface=${…}` | [Endpoints and Headers](api/endpoints.md#mcp-paths) (MCP Paths) |
| `/api/directory/servers?${…}`, `/api/directory/plugins` | [Endpoints and Headers](api/endpoints.md#mcp-paths) (MCP Paths) |
| `/v1/pages/mcp`, `/api/artifacts/mcp`, `/v1/code/mcp/ccr-artifacts`, and 2 more | [Endpoints and Headers](api/endpoints.md#mcp-paths) (MCP Paths) |
| `https://microsoft365.mcp.claude.com/mcp` | [Endpoints and Headers](api/endpoints.md#mcp-paths) (MCP Paths) |
| `/api/features/${…}`, `/api/eval/${…}`, `/api/eval-authed/${…}`, and 1 more | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/environments/bridge`, `/v1/environments/bridge/${…}`, `/v1/environments/bridge/${…}/offline`, and 1 more | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/environments/${…}/work/poll`, `/v1/environments/${…}/work/${…}/ack`, `/v1/environments/${…}/work/${…}/heartbeat`, and 1 more | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/environment_providers`, `/v1/environment_providers/cloud/create` | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/sessions`, `/v1/sessions/${…}`, `/v1/sessions/${…}${…}`, and 2 more | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/files`, `/v1/files/${…}`, `/v1/files/${…}/content` | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/filestore/fs/listDirectory`, `/v1/filestore/fs/readFile` | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `/v1/code/local/memory/mounts`, `/v1/code/local/memory/credential` | [Endpoints and Headers](api/endpoints.md#flags-environments-and-files) (Flags, Environments, and Files) |
| `https://downloads.claude.ai/claude-code-releases` | [Endpoints and Headers](api/endpoints.md#hosts-and-downloads) (Hosts and Downloads) |
| `https://downloads.claude.ai/claude-code-releases/plugins/claude-plugins-official` | [Endpoints and Headers](api/endpoints.md#hosts-and-downloads) (Hosts and Downloads) |
| `https://downloads.claude.ai/model-catalog/v1/catalog.json`, `https://downloads.claude.ai/model-catalog/v1/schema.json` | [Endpoints and Headers](api/endpoints.md#hosts-and-downloads) (Hosts and Downloads) |
| `https://anthropic.com/claude-code/plugin.schema.json` | [Endpoints and Headers](api/endpoints.md#hosts-and-downloads) (Hosts and Downloads) |
| `https://code.claude.com/docs/en/claude_code_docs_map.md`, `https://platform.claude.com/llms.txt`, `https://claude.com/docs/llms.txt`, and 1 more | [Endpoints and Headers](api/endpoints.md#hosts-and-downloads) (Hosts and Downloads) |
| `https://status.claude.com` | [Endpoints and Headers](api/endpoints.md#hosts-and-downloads) (Hosts and Downloads) |
| `x-app`, `anthropic-client-platform`, `X-Stainless-*`, and 2 more | [Endpoints and Headers](api/endpoints.md#request-headers) (Request Headers) |
| `cc_version` | [Endpoints and Headers](api/endpoints.md#attribution-block) (Attribution Block) |
| `cc_entrypoint` | [Endpoints and Headers](api/endpoints.md#attribution-block) (Attribution Block) |
| `cc_workload`, `cc_is_subagent` | [Endpoints and Headers](api/endpoints.md#attribution-block) (Attribution Block) |
| `cc_prev_req`, `cc_prompt_id`, `cc_turn_origin`, and 2 more | [Endpoints and Headers](api/endpoints.md#attribution-block) (Attribution Block) |
| `cc_gateway`, `cc_project`, `cc_project_src` | [Endpoints and Headers](api/endpoints.md#attribution-block) (Attribution Block) |

## System Prompt

How the prompt is built, plus the captured prompt variants.

Count: 34.

| Item | Where |
| --- | --- |
| Haiku 5.5 by default | [The System Prompt](../how-it-works/system-prompt.md#short-or-full-prompt) (Short or Full Prompt) |
| Billing header line | [The System Prompt](../how-it-works/system-prompt.md#where-each-part-goes-in-the-request) (Where Each Part Goes in the Request) |
| Identity line | [The System Prompt](../how-it-works/system-prompt.md#where-each-part-goes-in-the-request) (Where Each Part Goes in the Request) |
| Rules, memory section, appended text | [The System Prompt](../how-it-works/system-prompt.md#where-each-part-goes-in-the-request) (Where Each Part Goes in the Request) |
| Environment details, skills list, agent types, output style text, the date | [The System Prompt](../how-it-works/system-prompt.md#where-each-part-goes-in-the-request) (Where Each Part Goes in the Request) |
| Git status, `CLAUDE.md` files, the git attribution reminder | [The System Prompt](../how-it-works/system-prompt.md#where-each-part-goes-in-the-request) (Where Each Part Goes in the Request) |
| `--permission-mode acceptEdits`, `dontAsk`, `--brief` | [The System Prompt](../how-it-works/system-prompt.md#what-each-flag-does-in-the-captures) (What Each Flag Does in the Captures) |
| `lean_body` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `intro` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `system` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `doing_tasks` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `actions` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `tools` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `tone` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `memory_static` | [The System Prompt](../how-it-works/system-prompt.md#shared-sections) (Shared Sections) |
| `communication` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `pronouns` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `action_caution` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `fable_identity` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `session_guidance` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `memory` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `env_info_simple` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `env_info_static` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `context_management` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections); [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `brief` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| `focus_mode` | [The System Prompt](../how-it-works/system-prompt.md#session-sections) (Session Sections) |
| Default, Lean Prompt | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Default, Haiku 5.5 | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Inside a Git Repository | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Brief Mode (same text as default-lean) | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Compaction Prompt | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Subagent, General Purpose | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Subagent, Explore | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Subagent, Plan | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |

## Transcript and Sessions

Records in the transcript file and how sessions are stored.

Count: 13.

| Item | Where |
| --- | --- |
| `state/`, `mods/`, `bridge-spawn/`, and 3 more | [Sessions and Storage](../how-it-works/sessions-and-storage.md#where-files-live) (Where Files Live) |
| `type` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `uuid` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `parentUuid` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `sessionId` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `timestamp` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `cwd` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `gitBranch` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `version` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `entrypoint` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `userType` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `isSidechain` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |
| `isMeta` | [Transcript Format](transcript-format.md#common-fields) (Common Fields) |

## Headless Protocol

Message types of `--output-format stream-json` and of the control protocol. Nearly every row is undocumented, so this page links to the two pages with counts.

Count: 195.

| Page | Undocumented Rows |
| --- | --- |
| [Control Protocol](../extend/headless/control-protocol.md) | 95 |
| [Stream JSON Messages](../extend/headless/stream-json.md) | 100 |

## Mod API

The Mod API is covered by official Mods pages, so no Mod API item is listed here as undocumented. Differences are in the last section. For the Mod API, Documented means that the item is in the official docs or in the published type file (which the docs call "The complete reference"), so the Mod API shows 0 Undocumented rows.

Count: 0.

## Other

Items that fit no group above: memory, output styles, the status line, models, and how the harness works inside.

Count: 108.

| Item | Where |
| --- | --- |
| `/pause-memory` | [Memory and Rules](../configure/memory-and-rules.md#auto-memory) (Auto Memory) |
| The OpenTelemetry events other than `tool_decision` | [OpenTelemetry Events](opentelemetry.md#events) (Events) |
| `CLAUDE_CODE_REMOTE_MEMORY_DIR`, `CLAUDE_CODE_POST_TURN_MEMORY`, `CLAUDE_COWORK_MEMORY_*`, `CLAUDE_MEMORY_STORES` | [Memory and Rules](../configure/memory-and-rules.md#auto-memory) (Auto Memory) |
| `InstructionFileKind` | [Memory and Rules](../configure/memory-and-rules.md#the-instructionsloaded-hook) (The InstructionsLoaded Hook) |
| `claude-3-5-haiku` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-3-5-sonnet` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-3-7-sonnet` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-sonnet-4-0` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-opus-4-0` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-mythos-5-1` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-mythos-5-2` | [Models and Providers](../configure/models-and-providers/model-catalog.md#catalog) (Catalog); [Models and Providers](../configure/models-and-providers/providers.md#provider-names) (Provider Names) |
| `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-haiku-3-5`, `claude-sonnet-3-7` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-mythos-preview` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-sonnet-4-5-20250929[1m]` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-fable-5-1[1m]` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-sonnet-4-6[1m]`, `claude-opus-4-6[1m]` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-opus-5[1m]`, `claude-opus-5-5[1m]`, `claude-sonnet-5-5[1m]` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `claude-sonnet-5[1m]`, `claude-opus-4-8[1m]` | [Models and Providers](../configure/models-and-providers/model-catalog.md#other-model-ids-in-the-program) (Other Model IDs in the Program) |
| `--thinking <enabled\|adaptive\|disabled>` | [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#thinking) (Thinking) |
| `--thinking-display <summarized\|omitted\|highlights>` | [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#thinking) (Thinking) |
| `--max-thinking-tokens` | [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#thinking) (Thinking) |
| `CLAUDE_CODE_NO_MODEL_FALLBACK` | [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#fallback-and-retries) (Fallback and Retries) |
| `CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD` | [Models and Providers](../configure/models-and-providers/providers.md#providers) (Providers) |
| `CLAUDE_CODE_USE_GATEWAY` | [Models and Providers](../configure/models-and-providers/providers.md#providers) (Providers) |
| `ANTHROPIC_GOOGLE_CLOUD_BASE_URL`, `_LOCATION`, `_PROJECT`, `_WORKSPACE_ID` | [Models and Providers](../configure/models-and-providers/providers.md#endpoint-and-region-variables) (Endpoint and Region Variables) |
| `CLAUDE_CODE_SKIP_ANTHROPIC_GOOGLE_CLOUD_AUTH` | [Models and Providers](../configure/models-and-providers/providers.md#endpoint-and-region-variables) (Endpoint and Region Variables) |
| Custom style over Remote Control | [Output Styles](../configure/output-styles.md#the-outputstyle-setting-and-switching) (The outputStyle Setting and Switching) |
| `outputStylesPath`, `outputStylesPaths` | [Output Styles](../configure/output-styles.md#locations-and-precedence) (Locations and Precedence) |
| Merge order | [Output Styles](../configure/output-styles.md#locations-and-precedence) (Locations and Precedence) |
| `remote.session_id` | [Status Line](../configure/status-line.md#session-and-model-fields) (Session and Model Fields) |
| 4. Message prep | [The Agent Loop](../how-it-works/agent-loop.md#the-stages) (The Stages) |
| 6. Attachments | [The Agent Loop](../how-it-works/agent-loop.md#the-stages) (The Stages) |
| 10. Next round | [The Agent Loop](../how-it-works/agent-loop.md#the-stages) (The Stages) |
| The output stops at `max_tokens` | [The Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) (Recovery Inside the Loop) |
| The response is cut off | [The Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) (Recovery Inside the Loop) |
| A `tool_use` block has no valid call | [The Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) (Recovery Inside the Loop) |
| The model sends only thinking | [The Agent Loop](../how-it-works/agent-loop.md#recovery-inside-the-loop) (Recovery Inside the Loop) |
| Bundled code | [Architecture](../how-it-works/architecture.md#the-big-picture) (The Big Picture) |
| Command parser | [Architecture](../how-it-works/architecture.md#the-big-picture) (The Big Picture) |
| Terminal screen | [Architecture](../how-it-works/architecture.md#the-big-picture) (The Big Picture) |
| Feature flags | [Architecture](../how-it-works/architecture.md#the-big-picture) (The Big Picture) |
| `mcp` | [Architecture](../how-it-works/architecture.md#where-it-runs) (Where It Runs) |
| `claude-code-github-action` | [Architecture](../how-it-works/architecture.md#where-it-runs) (Where It Runs) |
| `local-agent`, `claude-desktop`, `remote` | [Architecture](../how-it-works/architecture.md#where-it-runs) (Where It Runs) |
| Start | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Device settings | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Project root | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Init | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Client data | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Log sinks | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Plugin folders | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Migrations | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Managed settings | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Plugin early start | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Main action | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| MCP connect | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Print mode | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| Interactive mode | [Architecture](../how-it-works/architecture.md#startup-steps) (Startup Steps) |
| See how long each startup step takes | [Architecture](../how-it-works/architecture.md#what-you-can-change-at-startup) (What You Can Change at Startup) |
| Attachments that Claude Code adds | [Context and Compaction](../how-it-works/context-and-compaction.md#what-fills-the-context) (What Fills the Context) |
| Effective window | [Context and Compaction](../how-it-works/context-and-compaction.md#when-compaction-runs) (When Compaction Runs) |
| Warning | [Context and Compaction](../how-it-works/context-and-compaction.md#when-compaction-runs) (When Compaction Runs) |
| Blocked | [Context and Compaction](../how-it-works/context-and-compaction.md#when-compaction-runs) (When Compaction Runs) |
| Reactive | [Context and Compaction](../how-it-works/context-and-compaction.md#kinds-of-compaction) (Kinds of Compaction) |
| Precomputed | [Context and Compaction](../how-it-works/context-and-compaction.md#kinds-of-compaction) (Kinds of Compaction) |
| Larger-model retry | [Context and Compaction](../how-it-works/context-and-compaction.md#kinds-of-compaction) (Kinds of Compaction) |
| Server side | [Context and Compaction](../how-it-works/context-and-compaction.md#kinds-of-compaction) (Kinds of Compaction) |
| `--thinking <enabled\|adaptive\|disabled>` | [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#thinking) (Thinking) |
| `--thinking-display <summarized\|omitted\|highlights>` | [Models and Providers](../configure/models-and-providers/effort-thinking-and-fallback.md#thinking) (Thinking) |
| `effort` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `max_effort` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `xhigh_effort` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `adaptive_thinking` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `mid_conv_tool_change` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `rejects_disabled_thinking` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `per_turn_effort` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `per_turn_timing` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `lean_prompt` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `org_locked_thinking` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `haiku_5_5_early_stopping_guidance` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `refusal_fallback` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `silent_turn_reminder` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `fast_mode` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `thinking_disabled_effort_cap` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `opus_5_prompt_bundle` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `opus_5_5_prompt_bundle` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `fable_5_mitigations` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `fable_5_1_prompt_bundle` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `fable_5_2_prompt_bundle` | [Models and Providers](../configure/models-and-providers/model-catalog.md#capabilities) (Capabilities) |
| `safeguards` | [Request and Cache](../how-it-works/request-and-cache.md#body-fields) (Body Fields) |
| `system[0]` (attribution line) | [Request and Cache](../how-it-works/request-and-cache.md#system-blocks-and-cache-markers) (System Blocks and Cache Markers) |
| `system[1]` (identity line) | [Request and Cache](../how-it-works/request-and-cache.md#system-blocks-and-cache-markers) (System Blocks and Cache Markers) |
| `system[2]` (system prompt) | [Request and Cache](../how-it-works/request-and-cache.md#system-blocks-and-cache-markers) (System Blocks and Cache Markers) |
| Last block of the last message | [Request and Cache](../how-it-works/request-and-cache.md#system-blocks-and-cache-markers) (System Blocks and Cache Markers) |
| `DISABLE_PROMPT_CACHING_MYTHOS` | [Request and Cache](../how-it-works/request-and-cache.md#cache-lifetime) (Cache Lifetime) |
| `CLAUDE_CODE_MESSAGES_PROMPT_CACHE_TTL` | [Request and Cache](../how-it-works/request-and-cache.md#cache-lifetime) (Cache Lifetime) |
| `--model X[1m]` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_AMBER_ASTROLABE` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_BASALT_COVE` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_HUMBLE_HAMMOCK` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_INLINE_TOOLS` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_LANTERN_PRISM` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_LARCH_CISTERN` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_PLUGIN_DIRS` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_SIMULATE_PROXY_USAGE` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `CLAUDE_CODE_USE_COWORK_PLUGINS` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |

## Behaves Differently From the Docs

These items exist in the official docs, but the program works in another way. Count: 42. The badge on each page says how.

| Item | Where |
| --- | --- |
| `disallowedTools` | [Subagent Frontmatter](../extend/subagents/frontmatter.md#keys) (Keys) |
| `effort` | [Skill Frontmatter](../extend/skills-and-commands/frontmatter.md#keys) (Keys) |
| `next.error` | [Hooks and the Hook Chain](../extend/mod-api/events/hooks.md#arguments-of-a-hook) (Arguments of a Hook) |
| `prompt.edit` hook time | [Hooks and the Hook Chain](../extend/mod-api/events/hooks.md#budgets) (Budgets) |
| `vscode` | [Surfaces, Elements, and Render Sites](../extend/mod-api/ui/ui-elements.md#surfaces) (Surfaces) |
| Error type | [Hook Configuration](../extend/hooks/configuration.md#matcher-targets) (Matcher Targets) |
| `disableAllHooks` | [Hook Configuration](../extend/hooks/configuration.md#settings-keys-and-trust) (Settings Keys and Trust) |
| Top-level `decision` and `reason` | [Hook Events](../extend/hooks/tool-events.md#pretooluse) (PreToolUse) |
| `destination` | [Hook Events](../extend/hooks/tool-events.md#permission-update-entries) (Permission Update Entries) |
| `additionalContext` | [Hook Events](../extend/hooks/session-events.md#setup) (Setup) |
| `error` | [Hook Events](../extend/hooks/session-events.md#stopfailure) (StopFailure) |
| `script` | [Hook Handlers](../extend/hooks/handlers.md#handler-types) (Handler Types) |
| `model` | [Hook Handlers](../extend/hooks/handlers.md#prompt-and-agent-fields) (Prompt and Agent Fields) |
| `scratchpad_dir` | [Hook Input and Output](../extend/hooks/input-and-output.md#common-input-fields) (Common Input Fields) |
| `decision` | [Hook Input and Output](../extend/hooks/input-and-output.md#universal-output-fields) (Universal Output Fields) |
| `autoMemoryDirectory` scope | [Memory and Rules](../configure/memory-and-rules.md#auto-memory) (Auto Memory) |
| Model, fast mode, effort, thinking, and PR status change | [Status Line](../configure/status-line.md#when-the-script-runs) (When the Script Runs) |
| `appendPlugins` | [Hooks, Plugins, and Skills Settings](../configure/settings/hooks-and-plugins.md#keys) (Keys) |
| `prependPlugins` | [Hooks, Plugins, and Skills Settings](../configure/settings/hooks-and-plugins.md#keys) (Keys) |
| `CLAUDE_CODE_ARTIFACT_COMMENTS` | [Features and Toggles](../configure/env-vars/features-and-toggles.md#variables) (Variables) |
| `CLAUDE_CODE_ARTIFACT_COMMENTS_AUTOREACT` | [Features and Toggles](../configure/env-vars/features-and-toggles.md#variables) (Variables) |
| `CLAUDE_CODE_MCP_ALLOWLIST_ENV` | [Plugins and MCP](../configure/env-vars/plugins-and-mcp.md#variables) (Variables) |
| `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` | [Plugins and MCP](../configure/env-vars/plugins-and-mcp.md#variables) (Variables) |
| `CLAUDE_CODE_TRANSCRIPT_LOCAL_GC` | [Sessions and Storage](../configure/env-vars/sessions-and-storage.md#variables) (Variables) |
| `CLAUDE_CODE_ENABLE_TELEMETRY` | [Telemetry and Debug](../configure/env-vars/telemetry-and-debug.md#variables) (Variables) |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` | [Tools and Bash](../configure/env-vars/tools-and-bash.md#variables) (Variables) |
| `CLAUDE_CODE_TOOL_MEMORY_LIMIT` | [Tools and Bash](../configure/env-vars/tools-and-bash.md#variables) (Variables) |
| `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT` | [UI and Terminal](../configure/env-vars/ui-and-terminal.md#variables) (Variables) |
| `CLAUDE_CODE_NEW_INIT` | [UI and Terminal](../configure/env-vars/ui-and-terminal.md#variables) (Variables) |
| `CLAUDE_CODE_NONBLOCKING_STDOUT` | [UI and Terminal](../configure/env-vars/ui-and-terminal.md#variables) (Variables) |
| `IS_DEMO` | [UI and Terminal](../configure/env-vars/ui-and-terminal.md#variables) (Variables) |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT` | [The System Prompt](../how-it-works/system-prompt.md#ways-to-change-it) (Ways to Change It) |
| Opus 5.5, Sonnet 5.5 by default | [The System Prompt](../how-it-works/system-prompt.md#short-or-full-prompt) (Short or Full Prompt) |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=0` | [The System Prompt](../how-it-works/system-prompt.md#short-or-full-prompt) (Short or Full Prompt) |
| `CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT=1` | [The System Prompt](../how-it-works/system-prompt.md#short-or-full-prompt) (Short or Full Prompt) |
| Default, Sonnet 5.5 | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Full Prompt | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Simple Prompt Switch on Sonnet (same text as default-sonnet) | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Simple Prompt Switch on Haiku (same text as default-haiku) | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| Simple Prompt Switch on Opus (same text as default-lean) | [Captured System Prompts](../prompts/index.md#all-variants) (All Variants) |
| hook `type: "script"` | [Probes](probes.md#effects-and-differences) (Effects and Differences) |
| `max_results` | [Tools](tools/index.md#toolsearch) (ToolSearch) |

## In the Program

The program of `2.1.323` holds 10117 items in 18 kinds, counted from `schemas/surface.json`.
[Surface Coverage](surface-coverage.md) lists each item with its page.

| Kind | Items | Not on a Page Yet |
| --- | --- | --- |
| [Betas](surface-coverage.md#betas) | 54 | 0 |
| [API Endpoints](surface-coverage.md#api-endpoints) | 455 | 0 |
| [Environment Variables](surface-coverage.md#environment-variables) | 2084 | 0 |
| [Error Texts](surface-coverage.md#error-texts) | 4188 | 0 |
| [Files](surface-coverage.md#files) | 78 | 0 |
| [CLI Flags](surface-coverage.md#cli-flags) | 414 | 0 |
| [Gates](surface-coverage.md#gates) | 1544 | 0 |
| [Hook Events](surface-coverage.md#hook-events) | 33 | 0 |
| [Keybindings](surface-coverage.md#keybindings) | 207 | 0 |
| [Mod API](surface-coverage.md#mod-api) | 239 | 0 |
| [Models](surface-coverage.md#models) | 76 | 0 |
| [OpenTelemetry Events](surface-coverage.md#opentelemetry-events) | 28 | 0 |
| [Permission Rules](surface-coverage.md#permission-rules) | 6 | 0 |
| [Settings](surface-coverage.md#settings) | 199 | 0 |
| [Nested Setting Keys](surface-coverage.md#nested-setting-keys) | 197 | 0 |
| [Slash Commands](surface-coverage.md#slash-commands) | 140 | 0 |
| [Subcommands](surface-coverage.md#subcommands) | 80 | 0 |
| [Tools](surface-coverage.md#tools) | 95 | 0 |
| All kinds | 10117 | 0 |

## Related Pages

- [How to Read This Site](../start/how-to-read.md)
- [Environment Variables](../configure/env-vars/index.md)
- [Mod API Overview](../extend/mod-api/index.md)
