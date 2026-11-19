---
title: What Changed
description: What Claude Code 2.1.328, the release this site covers, shows for each change that its release notes list.
sidebar_position: 4
---

This page lists the changes in `2.1.328`, the release this site covers.
It is short on purpose. Each row rests on the program code and cites it in a footnote.
For every fix and small change, read the official [Changelog](https://code.claude.com/docs/en/changelog).

## How to Check Your Version

Run `claude --version`.
The `/release-notes` command shows a cached copy of the [changelog](https://code.claude.com/docs/en/changelog).
This site covers `2.1.328`, the version shown in the navbar.

## Version 2.1.328

Sources: the program, and the [release notes of `2.1.328`](https://github.com/anthropics/claude-code/releases/tag/v2.1.328) as a second source. Each row states what the program code shows. Notes items about other products (such as VS Code and Remote Control), and fixes with no setting, key, or text that a page states, are not on this page.

### Permissions, Hooks, and Settings

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| Auto mode model check | <Documented /> | Auto mode accepts `claude-opus-4-6`, `claude-sonnet-4-6`, and newer models. It refuses older models. On a third-party provider it also refuses a Haiku model other than `claude-haiku-5-5`.[^auto-models] | [Auto Mode](../configure/permissions/auto-mode.md) |
| `onFailure: "block"` on `mcp_tool` hooks | <Documented /> | `"block"` works on `mcp_tool` hooks, as on `command` and `http` hooks. A failed call to the MCP server blocks the action.[^on-failure] | [Hook Configuration](../extend/hooks/configuration.md#failure-handling) |
| `deniedMcpServers` and `allowManagedMcpServersOnly` | <Documented /> | An entry found only in a project's settings file does not apply to a server that the organization provides. The schema text of `allowManagedMcpServersOnly` adds that a user can deny a server that the organization provides.[^denied-mcp] | [MCP and Channels Settings](../configure/settings/mcp-and-channels.md#keys) |
| `remoteMessageReceipts` | <Undocumented /> | A setting with the values `on`, `always`, and `off`. It sets delivery notices for messages between this session and cloud or Remote Control sessions.[^receipts] | [Agents and Remote Settings](../configure/settings/agents-and-remote.md#keys) |

### Skills and Slash Commands

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `/code-review` | <Documented /> | On most models it reports only bugs and `CLAUDE.md` violations. Run `/simplify` for reuse, simplification, and efficiency cleanups. Each finding is marked Important, Pre-existing, or Nit.[^code-review] | [Bundled Skills](../extend/skills-and-commands/bundled-skills.md#skills) |
| `/list-agents` | <Documented /> | When its server flag is on, the list is shown to you alone. Claude gets a note that it did not see the list.[^list-agents] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#session-and-conversation-commands) |
| `/chrome` | <Gated /> | The welcome text says that Claude Code asks before Claude acts on a site, unless your permission mode or a rule in `/permissions` answers for you.[^chrome] | [Slash Commands](../extend/skills-and-commands/slash-commands.md#setup-interface-and-config-commands) |

### Tools

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `McpTaskResumePolling` | <Undocumented /> | A tool behind a hidden server-side flag. It resumes tracking of a background MCP task after tracking stopped. The prompt says to call it only when the user explicitly asks.[^resume-polling] | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#gated-tools) |
| Refused `project_write` with `edits` | <Undocumented /> | A refused write of SEARCH/REPLACE blocks gives texts that start with `Write refused; nothing in the project was changed.`[^project-write] | [Gated and Surface-Specific Tools](../reference/tools/gated-and-other.md#errors) |
| `WebSearch` cut off | <Undocumented /> | A `WebSearch` call that ended with no results because the search was cut off gives `The search was cut off before any results arrived. Try again.`[^websearch-cut] | [Shell and Web Tools](../reference/tools/shell-and-web.md#errors) |

### System Prompt

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `<pasted_content>` rule in `system` and `lean_body` | <Undocumented /> | The rule says text in `<pasted_content>` tags came from somewhere else, so Claude follows its instructions only when your own message asks for it.[^pasted] | [System Prompt](../how-it-works/system-prompt.md#shared-sections) |
| `user_privacy` section | <Gated /> | It tells Claude to keep what it learns about you private. The default of the experiment `tengu_prancy_pebble` depends on the provider and the account.[^privacy] | [System Prompt](../how-it-works/system-prompt.md#session-sections) |
| `curl` rule in `env_info_simple` | <Undocumented /> | The prompt always has the rule "In `curl`, send untrusted values with `--form-string`, not `-F`."[^curl] | [System Prompt](../how-it-works/system-prompt.md#session-sections) |

### Flags and Self-Hosted Runner

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `--metadata` `<key=value>` | <Undocumented /> | Labels the session for the script that starts its machine. It needs `--environment` with the ID of a self-hosted environment.[^metadata] | [CLI Flags](../configure/cli/flags.md#cloud-and-remote-sessions) |
| `--hold-repository-while-parked` | <Undocumented /> | A hidden flag for the SDK. Until the claim, Claude Code holds back parts of the checkout. It needs `--await-claim`.[^hold] | [CLI Flags](../configure/cli/flags.md#start-and-print-mode) |
| `--repository-folder` | <Undocumented /> | Names the folder that sessions use for a repository, in place of the path under `--base-dir`. It does nothing at `--capacity` above 1. Errors report a bad value or a folder that cannot be looked at.[^repo-folder] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runner-errors) |
| `--hook-label` | <Undocumented /> | Hands an entry of a session's metadata to the `spawn-runner` hook as `CLAUDE_RUNNER_META_<LABEL>`. It needs `--min-idle` at 0. Errors report a bad use.[^hook-label] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runner-errors) |
| Orchestrator metrics | <Undocumented /> | `GET /metrics` of the orchestrator reports `claude_code_self_hosted_orchestrator_session_queue_wait_by_reason_seconds` and `claude_code_self_hosted_orchestrator_sessions_given_up_total`.[^metrics] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#orchestrator-metrics) |
| `--use-anthropic-gh` | <Undocumented /> | The built-in `gh api` is off by default in a session whose settings guard Claude's GitHub tools by name. `--use-anthropic-gh true` turns it on there.[^gh] | [Self-Hosted Runner](../configure/cli/self-hosted-runner.md#runtime-options) |

### Environment Variables

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME` | <Undocumented /> | Lets a host stop a resumed session from running a tool call that a hook deferred.[^deferred] | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| `CLAUDE_STREAM_IDLE_TIMEOUT_MS` | <Documented /> | A value above 5 minutes raises the stream idle limit to that value, up to 30 minutes.[^idle] | [Network and Proxy Variables](../configure/env-vars/network-and-proxy.md#variables) |
| `CLAUDE_RUNNER_SESSION_UUID` and `CLAUDE_CODE_REMOTE_SESSION_UUID` | <Undocumented /> | The runner sets both for the session and for its `checkout`, `post-session`, and `spawn-runner` hooks.[^uuid] | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| `SELF_HOSTED_RUNNER_REPOSITORY_FOLDER` | <Undocumented /> | The variable of `--repository-folder`. It is a comma-separated list of `<owner>/<repo>=<folder>` entries.[^repo-env] | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| `CCR_CHECKPOINT_URL` and `CLAUDE_CODE_CCR_AFFINITY_KEY` | <Undocumented /> | A set `CCR_CHECKPOINT_URL` stops one system reminder in some remote sessions. `CLAUDE_CODE_CCR_AFFINITY_KEY` sends its value in the `x-ccr-affinity-key` header.[^ccr] | [Remote and Cloud Session Variables](../configure/env-vars/remote-and-cloud-sessions.md#variables) |
| `CLAUDE_CODE_THINKING_RESUMPTION` | <Undocumented /> | Controls thinking resumption, which resumes a truncated response. The beta `thinking-resumption-2026-07-17` goes with it.[^thinking] | [Models and Effort Variables](../configure/env-vars/models-and-effort.md#variables) |
| `CLAUDE_CODE_PEPPY_STARLIGHT` | <Undocumented /> | Turns on or off one line at the end of the `Agent` tool description.[^peppy] | [Agents and Teams Variables](../configure/env-vars/agents-and-teams.md#variables) |
| `CLAUDE_CODE_WEBSEARCH_CITATIONS` | <Undocumented /> | A set value also adds a system prompt section that says the app shows a source chip for each cited web result.[^citations] | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| `CLAUDE_CODE_SHELL_MCP_SERVERS` and `CLAUDE_CODE_WATCHED_SLEEP` | <Undocumented /> | Claude Code sets both. The first lists HTTP servers for shell child processes. The second marks a rewritten leading `sleep`.[^shell-env] | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md#variables) |
| `CLAUDE_CODE_RELAUNCH_SANDBOX_HOLD` and `CLAUDE_CODE_HOST_CHECKED_FOLDER` | <Undocumented /> | Claude Code sets the first on relaunch to carry the held sandbox limits. The program shows no effect for the second.[^relaunch] | [Sessions and Storage Variables](../configure/env-vars/sessions-and-storage.md#variables) |
| `PROGRAMFILES` | <Undocumented /> | Names the Windows `Program Files` folder for the PowerShell module path of the sandbox. It is read after `ProgramFiles`.[^programfiles] | [System and Third-Party Variables](../configure/env-vars/system-and-third-party.md#variables) |

### API Paths and Betas

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `/v1/code/ultrareview/${…}` | <Undocumented /> | A server gate decides whether Claude Code first asks this path for the ultrareview quota. It asks `/v1/ultrareview/${…}` when the gate is off, or when the first request answers 404.[^ultrareview] | [API Endpoints](../reference/api/endpoints.md#account-and-service-endpoints) |
| `resumption-2026-10-08` | <Undocumented /> | A beta value, on the first-party API only and behind a server gate, for a request whose last message is not from the assistant.[^resumption] | [Betas](../reference/api/betas.md#registry) |

### Mod API Calls

| Change | Status | What it means for you | Where to read more |
| --- | --- | --- | --- |
| `$.session.machine` and `session.machine` | <Documented /> | Returns the system name, the kernel release, the hardware, and which of `npm`, `yarn`, `pnpm`, `bun`, `deno`, and `node` are on the `PATH`.[^m-machine] | [Session Calls](../extend/mod-api/calls/session.md#members) |
| `tool.offer` and `$.tool.offer` | <Documented /> | The engine asks once for each tool before the first request of a loop, and again at a call. `{ isOffered: false }` keeps the tool from the model of that loop.[^m-offer] | [Tool, Command, and Config Calls](../extend/mod-api/calls/tool-command-config.md#members) |
| Tier of `$.command.run`, `$.prompt.submit`, `$.session.compact`, and `$.tool.call` | <Documented /> | These calls run through the hooks that hear them. A person's hooks do not hear a call that an organization's mod makes. Every ask in a `$.tool.call` becomes an allow, except for a built-in tool whose dialog is the call itself.[^m-tier] | [The Dollar Object](../extend/mod-api/nouns-and-gates.md#the-dollar-object) |
| `next.origin` | <Documented /> | Its type is `NextOrigin`, which adds `hookOwner` and `isOrganizations`.[^m-origin] | [Hook Types](../extend/mod-api/types/hooks.md#nextorigin) |
| `telemetry.log` | <Documented /> | Where `sec-default` is seated, a collector record passes the `user` tier by.[^m-telemetry] | [Telemetry Calls](../extend/mod-api/calls/telemetry.md#members) |
| `agent.offer` and `AgentSpec.autoCompactWindow` | <Documented /> | The offer to resume an agent carries its `agentId`. The type file says `autoCompactWindow` is at least 100000.[^m-agent] | [Agent Calls](../extend/mod-api/calls/agent.md#agent-spec) |
| `$.http.fetch` | <Documented /> | A model request that a hook edits keeps the session's credential while `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set.[^m-http] | [Clock, HTTP, Process, Env, and Settings Calls](../extend/mod-api/calls/clock-http-process-env-settings.md#members) |
| `$.env.set` and `$.config.set` refusals | <Undocumented /> | Error texts that end in a code: `OUT_OF_STEP`, `HOST_RULE`, `PINNED`, `HELD`, `NO_ROW`, `LOCKED`, and `NOT_WRITTEN`.[^m-codes] | [Mod API](../extend/mod-api/index.md#errors) |
| `allowManagedModsOnly` | <Documented /> | Managed settings set it. An app that embeds Claude Code can also switch it on through the plugin options that it passes.[^m-mods-only] | [The Dollar Object](../extend/mod-api/nouns-and-gates.md#gates-that-stop-mods) |
| `isTextDisplayOnly` | <Gated /> | The text of a run also stays in requests unless that run's output was for the person alone.[^m-display] | [Command and Config Types](../extend/mod-api/types/tool-command-config/command-config.md#commandrunresult) |

## Example

In `2.1.328`, `CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME` lets a host stop a resumed session from running a tool call that a hook deferred.
Check the version, then set the variable for one run:

```bash
claude --version
CLAUDE_CODE_DISABLE_DEFERRED_TOOL_RESUME=1 claude --resume <session-id>
```

## Related Pages

- [How to Read These Docs](how-to-read.md)
- [What Can I Change](what-can-i-change.md)
- [Files on Disk](files-on-disk.md)

## Sources

[^auto-models]: The program, `chunk-xethrx83.js:526000` (the model check) and `chunk-xethrx83.js:400035` (the model order).
[^on-failure]: The program, `chunk-jkpzhr7r.js:22812`.
[^denied-mcp]: The program, `chunk-jkpzhr7r.js:243982` (the project-settings rule) and `chunk-jkpzhr7r.js:255110` (the user denial).
[^receipts]: The program, `chunk-jkpzhr7r.js:300096` (the setting) and `chunk-8hgq720g.js:407` (the gate).
[^code-review]: The program, `chunk-tsfj8qb8.js:95114` (the description), `chunk-tsfj8qb8.js:54109` (the labels), and `chunk-tsfj8qb8.js:198142` (the `/simplify` prompt).
[^list-agents]: The program, `chunk-djw7n09x.js:10964` (the note) and `chunk-p90ry0yq.js:237` (the server flag).
[^chrome]: The program, `chunk-ytavvbnp.js:35010`.
[^resume-polling]: The program, `chunk-ayyfbsnd.js:7696`.
[^project-write]: The program, `chunk-dtar9gh9.js:28245` (the `edits` field) and `chunk-dtar9gh9.js:74171` (the refusal).
[^websearch-cut]: The program, `chunk-r1yxtgw6.js:73349`.
[^pasted]: The program, `chunk-56bhcxay.js:93436` (the rule) and `chunk-56bhcxay.js:2879167` (the `lean_body` section). The rule is added when the program names the pasted-content tag.
[^privacy]: The program, `chunk-56bhcxay.js:2852268` (the text) and `chunk-56bhcxay.js:2886753` (the section and the experiment).
[^curl]: The program, `chunk-56bhcxay.js:131142`.
[^metadata]: The program, `chunk-gywceass.js:85097`.
[^hold]: The program, `chunk-gywceass.js:82436`.
[^repo-folder]: The program, `chunk-gv1b3n3g.js:379281` (the help text) and `chunk-gv1b3n3g.js:88807` (the error text).
[^hook-label]: The program, `chunk-ydhgnm30.js:45424` (the help text), `chunk-ydhgnm30.js:7790` (the variable), and `chunk-ydhgnm30.js:7088` (the error text).
[^metrics]: The program, `chunk-ydhgnm30.js:32653` (the route), `chunk-ydhgnm30.js:28749`, and `chunk-ydhgnm30.js:30454`.
[^gh]: The program, `chunk-16v2wsc7.js:1560`.
[^deferred]: The program, `chunk-56bhcxay.js:2424575`.
[^idle]: The program, `chunk-y5weakn8.js:336036`.
[^uuid]: The program, `chunk-1ag7mmq0.js:41838` (the definition), `chunk-1ag7mmq0.js:46927` (`checkout`), `chunk-1ag7mmq0.js:53824` (`post-session`), `chunk-1ag7mmq0.js:59949` (`spawn-runner`), and `chunk-gv1b3n3g.js:252584` (the session).
[^repo-env]: The program, `chunk-gv1b3n3g.js:379281`.
[^ccr]: The program, `chunk-5699r6rq.js:712373` (`CCR_CHECKPOINT_URL`) and `chunk-yee8s2pc.js:1333` (`CLAUDE_CODE_CCR_AFFINITY_KEY`).
[^thinking]: The program, `chunk-56bhcxay.js:3147788` (the variable) and `chunk-20bv8pca.js:170468` (the beta).
[^peppy]: The program, `chunk-56bhcxay.js:1837155` (the switch) and `chunk-56bhcxay.js:4063221` (the line).
[^citations]: The program, `chunk-4h0jyvmx.js:423572` and `chunk-0jy30rtj.js:2567`.
[^shell-env]: The program, `chunk-thtytpkk.js:6015` (`CLAUDE_CODE_SHELL_MCP_SERVERS`) and `chunk-4h0jyvmx.js:449093` (`CLAUDE_CODE_WATCHED_SLEEP`).
[^relaunch]: The program, `chunk-kwkzbftg.js:1038096` (`CLAUDE_CODE_RELAUNCH_SANDBOX_HOLD`) and `chunk-4128y5tp.js:2814` (`CLAUDE_CODE_HOST_CHECKED_FOLDER`, named in a list only).
[^programfiles]: The program, `chunk-56bhcxay.js:1155806`.
[^ultrareview]: The program, `chunk-jbxcwws7.js:936` (the paths) and `chunk-jbxcwws7.js:1507` (the quota call).
[^resumption]: The program, `chunk-20bv8pca.js:170521` (the beta) and `chunk-56bhcxay.js:3202698` (its use).
[^m-machine]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:588181` (`SessionMachine`) and `claude-code.d.ts-09a2d7e5.txt.zst:588800` (the tool lists).
[^m-offer]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:230630` (`tool.offer`).
[^m-tier]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:677118` (`Tier`), `claude-code.d.ts-09a2d7e5.txt.zst:142599` (`$.session.compact`), `claude-code.d.ts-09a2d7e5.txt.zst:146954` (`$.prompt.submit`), `claude-code.d.ts-09a2d7e5.txt.zst:151893` (`$.tool.call`), and `claude-code.d.ts-09a2d7e5.txt.zst:157460` (`$.command.run`).
[^m-origin]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:343232` (`NextOrigin`).
[^m-telemetry]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:235319` (`telemetry.log`).
[^m-agent]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:222115` (`agent.offer`) and `claude-code.d.ts-09a2d7e5.txt.zst:34437` (`AgentSpec`).
[^m-http]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:276962` (`HttpInit`) and `claude-code.d.ts-09a2d7e5.txt.zst:182751` (`$.http.fetch`).
[^m-codes]: The program, `chunk-r240nspa.js:10663` (`$.env.set`) and `chunk-r240nspa.js:11246` (`$.config.set`).
[^m-mods-only]: The program, `chunk-jkpzhr7r.js:165565` (the policy plugin options), `chunk-jkpzhr7r.js:166026` (the copy of the options), and `chunk-jjvvs86e.js:2033` (the read of managed settings).
[^m-display]: The program, the Mod API type file loaded at `chunk-wkbr4m8m.js:257`, `claude-code.d.ts-09a2d7e5.txt.zst:88549` (`isTextDisplayOnly`).
