---
title: What Changed
description: What changed in Claude Code 2.1.328, the release this site covers, against 2.1.327, the release before it.
sidebar_position: 4
---

This page lists the changes in `2.1.328`, the release this site covers, against `2.1.327`, the release before it.
It lists nothing older. It is short on purpose. The site only repeats what its sources say. It does not guess.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.328`, the version shown in the navbar.

## Version 2.1.328

Sources: the [release notes of `2.1.328`](https://github.com/anthropics/claude-code/releases/tag/v2.1.328), and a comparison of the `2.1.327` and `2.1.328` programs and Mod API type files. Each row states what the linked page states. Notes items about other products (such as VS Code and Remote Control), and fixes with no setting, key, or text that a page states, are not on this page.

### Permissions, Hooks, and Settings

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Auto mode on third-party providers | <Documented /> | Auto mode accepts Opus 4.6 and Sonnet 4.6 on Amazon Bedrock, Google Cloud's Agent Platform, Microsoft Foundry, and the Claude apps gateway. In `2.1.327`, the model check refused both models there. | [Auto Mode](../configure/permissions/auto-mode.md) |
| `onFailure: "block"` on `mcp_tool` hooks | <Documented /> | `"block"` works on `mcp_tool` hooks, as on `command` and `http` hooks. A failed call to the MCP server blocks the action. | [Hook Configuration](../extend/hooks/configuration.md#failure-handling) |
| `deniedMcpServers` and `allowManagedMcpServersOnly` | <Documented /> | An entry found only in a project's settings file does not apply to a server that the organization provides. An entry of the form `claude.ai <name>` also applies to that connector in cloud and self-hosted runner sessions. The schema text of `allowManagedMcpServersOnly` adds that a user can deny a server that the organization provides. | [MCP and Channels Settings](../configure/settings/mcp-and-channels.md#keys) |
| `remoteMessageReceipts` | <Undocumented /> | A new setting with the values `on`, `always`, and `off`. It sets delivery notices for messages between this session and cloud or Remote Control sessions. | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) |

### Skills and Slash Commands

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `/code-review` | <Documented /> | On most models it reports only bugs and `CLAUDE.md` violations. Run `/simplify` for reuse, simplification, and efficiency cleanups. Each finding is marked Important, Pre-existing, or Nit, and the summary ends with a suggested fix. | [Bundled Skills](../extend/skills-and-commands/bundled-skills.md#skills) |
| `/list-agents` | <Documented /> | When its server flag is on, the list is shown to you alone. Claude gets a note that it did not see the list. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/chrome` | <Gated /> | The welcome text says that Claude Code asks before Claude acts on a site, unless your permission mode or a rule in `/permissions` answers for you. | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |

### Tools

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `McpTaskResumePolling` | <Undocumented /> | A tool behind a hidden server-side flag. It resumes tracking of a background MCP task after tracking stopped. The prompt says to call it only when the user explicitly asks. | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#gated-tools) |
| Refused `project_write` with `edits` | <Undocumented /> | A refused write of SEARCH/REPLACE blocks gives texts that start with `Write refused; nothing in the project was changed.` | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#errors) |
| `WebSearch` cut off | <Undocumented /> | A `WebSearch` call that ended with no results because the search was cut off gives `The search was cut off before any results arrived. Try again.` | [Shell and Web Tools](../reference/tools/shell-and-web.md#errors) |

### System Prompt

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `<pasted_content>` rule in `system` and `lean_body` | <Undocumented /> | The rule says text in `<pasted_content>` tags came from somewhere else, so Claude follows its instructions only when your own message asks for it. It is on by default in more setups. | [System Prompt](../how-it-works/system-prompt.md#shared-sections) |
| `user_privacy` section | <Gated /> | It tells Claude to keep what it learns about you private. The default of the experiment `tengu_prancy_pebble` was off in `2.1.327`. It now depends on the provider and the account. | [System Prompt](../how-it-works/system-prompt.md#session-sections) |
| `curl` rule in `env_info_simple` | <Undocumented /> | The prompt always has the rule "In `curl`, send untrusted values with `--form-string`, not `-F`." In `2.1.327`, only an experiment that was off by default added it. | [System Prompt](../how-it-works/system-prompt.md#session-sections) |

### Flags and Self-Hosted Runner

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `--metadata` `<key=value>` | <Undocumented /> | Labels the session for the script that starts its machine. It needs `--environment` with the ID of a self-hosted environment. | [CLI Flags](../configure/cli/flags.md#cloud-and-remote-sessions) |
| `--hold-repository-while-parked` | <Undocumented /> | A hidden flag for the SDK. Until the claim, Claude Code holds back parts of the checkout. It needs `--await-claim`. | [CLI Flags](../configure/cli/flags.md#start-and-print-mode) |
| `--repository-folder` | <Undocumented /> | Names the folder that sessions use for a repository, in place of the path under `--base-dir`. It does nothing at `--capacity` above 1. Two new errors report a bad value or a folder that cannot be looked at. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runner-errors) |
| `--hook-label` | <Undocumented /> | Hands an entry of a session's metadata to the `spawn-runner` hook as `CLAUDE_RUNNER_META_<LABEL>`. It needs `--min-idle` at 0. Four new errors report a bad use. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runner-errors) |
| Orchestrator metrics | <Undocumented /> | `GET /metrics` of the orchestrator adds two metrics. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#orchestrator-metrics) |
| `--use-anthropic-gh` | <Undocumented /> | The built-in `gh api` is off by default in a session whose settings guard Claude's GitHub tools by name. `--use-anthropic-gh true` turns it on there. | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options) |

### Environment Variables

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME` | <Undocumented /> | Lets a host stop `claude -p --resume` and `--continue` from running a tool call that a hook deferred in the session. | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | <Documented /> | A value above 5 minutes also raises the 5-minute connection limit, up to 30 minutes, on gateways, custom base URLs, and cloud providers. | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#variables) |
| `CLAUDE_RUNNER_SESSION_UUID` and `CLAUDE_CODE_REMOTE_SESSION_UUID` | <Undocumented /> | The runner sets both for the session and for its `checkout`, `post-session`, and `spawn-runner` hooks. | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| `SELF_HOSTED_RUNNER_REPOSITORY_FOLDER` | <Undocumented /> | The variable of `--repository-folder`. It is a comma-separated list of `<owner>/<repo>=<folder>` entries. | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| `CCR_CHECKPOINT_URL` and `CLAUDE_CODE_CCR_AFFINITY_KEY` | <Undocumented /> | A set `CCR_CHECKPOINT_URL` stops one system reminder in some resumed remote sessions. `CLAUDE_CODE_CCR_AFFINITY_KEY` sends its value in the `x-ccr-affinity-key` header. | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| `CLAUDE_CODE_THINKING_RESUMPTION` | <Undocumented /> | Controls thinking resumption, which resumes a truncated response. The beta `thinking-resumption-2026-07-17` goes with it. | [Models and Effort Variables](../configure/env-vars/models-and-effort.md#variables) |
| `CLAUDE_CODE_PEPPY_STARLIGHT` | <Undocumented /> | Turns on or off one line at the end of the `Agent` tool description. | [Agents and Teams Variables](../configure/env-vars/agents-and-teams.md#variables) |
| `CLAUDE_CODE_WEBSEARCH_CITATIONS` | <Undocumented /> | A set value also adds a system prompt section that says the app shows a source chip for each cited web result. | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| `CLAUDE_CODE_SHELL_MCP_SERVERS` and `CLAUDE_CODE_WATCHED_SLEEP` | <Undocumented /> | Claude Code sets both. The first lists HTTPS servers for shell child processes. The second marks a rewritten leading `sleep`. | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| `CLAUDE_CODE_RELAUNCH_SANDBOX_HOLD` and `CLAUDE_CODE_HOST_CHECKED_FOLDER` | <Undocumented /> | Claude Code sets the first on relaunch to carry the held sandbox limits. The program shows no effect for the second. | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| `PROGRAMFILES` | <Undocumented /> | Gives the Windows `Program Files` folder as the second choice, behind a feature flag or server gate. | [System and Third-Party Variables](../configure/env-vars/system-and-third-party.md#variables) |

### API Paths and Betas

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `/v1/code/ultrareview/${…}` | <Undocumented /> | A server gate decides whether Claude Code first asks this path for the quota and preflight checks of an ultrareview. It then asks `/v1/ultrareview/${…}` if the first request fails. | [API Endpoints](../reference/api/endpoints.md#account-and-service-endpoints) |
| `resumption-2026-10-08` | <Undocumented /> | A beta value, behind a server config, for requests that do not resume an incomplete thinking block. | [Betas](../reference/api/betas.md#registry) |

### Mod API Calls

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `$.session.machine` and `session.machine` | <Documented /> | Returns the system name, the kernel release, the hardware, and which of `npm`, `yarn`, `pnpm`, `bun`, `deno`, and `node` are on the `PATH`. | [Session Calls](../extend/mod-api/calls/session.md#members) |
| `tool.offer` and `$.tool.offer` | <Documented /> | The engine asks once for each tool before the first request of a loop, and again at a call. `{ isOffered: false }` keeps the tool from the model of that loop. | [Tool, Command, and Config Calls](../extend/mod-api/calls/tool-command-config.md#members) |
| Tier of `$.command.run`, `$.prompt.submit`, `$.session.compact`, and `$.tool.call` | <Documented /> | These calls run through the hooks that hear them. A person's hooks do not hear a call that an organization's mod makes. Every ask in a `$.tool.call` becomes an allow, except for a built-in tool whose dialog is the call itself. | [The Dollar Object](../extend/mod-api/nouns-and-gates.md#the-dollar-object) |
| `next.origin` | <Documented /> | Its type is `NextOrigin`, which adds `hookOwner` and `isOrganizations`. | [Hook Types](../extend/mod-api/types/hooks.md#nextorigin) |
| `telemetry.log` | <Documented /> | Where `sec-default` is seated, a collector record passes the `user` tier by. | [Telemetry Calls](../extend/mod-api/calls/telemetry.md#members) |
| `agent.offer` and `AgentSpec.autoCompactWindow` | <Documented /> | The offer to resume an agent carries its `agentId`. The type file says `autoCompactWindow` is at least 100000. | [Agent Calls](../extend/mod-api/calls/agent.md#agent-spec) |
| `$.http.fetch` | <Documented /> | A model request that a hook edits keeps the session's credential while `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set. | [Clock, HTTP, Process, Env, and Settings Calls](../extend/mod-api/calls/clock-http-process-env-settings.md#members) |
| `$.env.set` and `$.config.set` refusals | <Undocumented /> | Error texts that end in a code: `OUT_OF_STEP`, `HOST_RULE`, `PINNED`, `HELD`, `NO_ROW`, `LOCKED`, and `NOT_WRITTEN`. | [Mod API](../extend/mod-api/index.md#errors) |
| `allowManagedModsOnly` | <Documented /> | An app that embeds Claude Code can also switch it on. The managed settings of an admin still win. | [The Dollar Object](../extend/mod-api/nouns-and-gates.md#gates-that-stop-mods) |
| `isTextDisplayOnly` | <Gated /> | The text of a run also stays in requests unless that run's output was for the person alone. | [Command and Config Types](../extend/mod-api/types/tool-command-config/command-config.md#commandrunresult) |

## Example

In `2.1.328`, `CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME` lets a host stop `claude -p --resume` from running a tool call that a hook deferred.
Check the version, then set the variable for one run:

```bash
claude --version
CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME=1 claude -p --resume <session-id>
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)
