---
title: Gated and Surface-Specific Tools
description: Tools that appear only behind a gate, a plan, or a session mode, plus StructuredOutput, WaitForMcpServers, and the MCP resource tools.
sidebar_position: 5
---

These tools appear only when a gate, a plan, or a session mode turns them on.
Most of them serve onboarding, design work, connectors, or self-hosted runners.
For example, `PushNotification` sends a notice to your terminal when a long task ends.
For most of them a server-side flag decides. So you cannot switch them on yourself.

These tools work only if your account, plan, or session mode has the gate on. A hidden server-side flag decides, with few exceptions. A few have an env var or setting, such as `CLAUDE_CODE_SKILL_PROPOSALS`.

## Gated Tools

All of these are available in the main session only. Background subagents do not keep them, unless the Notes column says otherwise.
[Tools](index.md#how-to-read-the-tool-tables) explains the Yes and No columns.
Source: [Tools Reference](https://code.claude.com/docs/en/tools-reference) for the tools marked as documented, and the program (the tool definitions and their `searchHint` text) for the rest.

| Tool | Status | What It Does | Parameters and Gate | Read-Only | Parallel | Deferred |
| --- | --- | --- | --- | --- | --- | --- |
| `ReadNotifications` | <Undocumented /> <Gated note="hidden server-side flag" /> | Reads queued external notifications (webhooks, triggers). | No parameters. | ✅ | ✅ | ❌ |
| `ShareOnboardingGuide` | <Documented /> <Gated note="hidden server-side flag" /> | Uploads `ONBOARDING.md` and returns a team share link. | `mode` (`check`, `update`, `create`, `delete`, default `check`), `short_code` (string, optional). | ❌ | ❌ | ❌ |
| `ShowOnboardingRolePicker` | <Undocumented /> <Gated note="hidden server-side flag" /> | Shows the Cowork onboarding role picker. | No parameters. | ❌ | ❌ | ❌ |
| `OfferChromeSetup` | <Undocumented /> <Gated note="hidden server-side flag" /> | Offers Claude in Chrome setup. | `reason` (string, max 200, optional). | ❌ | ❌ | ✅ |
| `SendUserMessage` | <Undocumented /> <Gated note="hidden server-side flag" /> | Sends a message to the user (brief or assistant mode). | `message` (string, required, markdown), `attachments` (paths or file objects, optional), `status` (`normal` or `proactive`). Has an alias. | ✅ | ❌ | ❌ |
| `SendFeedback` | <Documented /> <Gated note="hidden server-side flag" /> | Drafts product or model-behavior feedback. | `type` (enum), `title` (string, required), `details` (string, required), `area`, `failure_mode`, `task_category` (optional). | ❌ | ❌ | ❌ |
| `SuggestPluginInstall` | <Undocumented /> <Gated note="hidden server-side flag" /> | Renders a plugin install card. | `contextLabel` (string, max 128), `plugins` (1 to 16), `trigger`. | ❌ | ❌ | Runtime check |
| `SuggestSkills` | <Undocumented /> <Gated note="hidden server-side flag" /> | Renders addable claude.ai skills by keyword. | `keywords` (1 to 8 strings, required), `contextLabel`, `trigger`. | ❌ | ❌ | Runtime check |
| `FetchInboxMessage` | <Undocumented /> <Gated note="hidden server-side flag" /> | Reads a relayed inbox message from a linked thread. | `file_id` (string, required). | ✅ | ❌ | ✅ |
| `PublishPlugin` | <Undocumented /> <Gated note="hidden server-side flag" /> | Publishes a plugin or mod to the organization library. | `path` (string, required), `destination` (`organization`), `description`, `replace` (boolean), `shown`, `question`. | ❌ | ❌ | ✅ |
| `Artifact` | <Documented /> <Gated note="enableArtifact setting in the old page" /> | Renders an HTML file to a claude.ai web page. | The saved sub-agents docs list `Artifact` among the tools a background subagent keeps. | ❌ | ❌ | ❌ |
| `AppifactRepl` | <Undocumented /> <Gated note="hidden server-side flag" /> | Runs appifact SDK JavaScript against an artifact. | `skill`, `artifact` (strings, optional), `code` (string, required). | ❌ | ❌ | ❌ |
| `SendFile` | <Undocumented /> <Gated note="hidden server-side flag" /> | Sends files to another Claude Code session. | `to` (string, required), `files` (string array, 1 up to a maximum), `message` (optional). | ❌ | ❌ | ✅ |
| `Poll` | <Documented /> <Gated note="hidden server-side flag" /> | Waits for and receives queued harness events. | No parameters. | ✅ | ❌ | ❌ |
| `PushNotification` | <Documented /> <Gated note="hidden server-side flag" /> | Sends a notification to the terminal and optionally to mobile. | `message` (string, required, under 200 characters), `status` (`proactive`). Also an entry-point rule for `remote_trigger`. | ❌ | ❌ | ✅ |
| `DesignSync` | <Undocumented /> <Gated note="hidden server-side flag" /> | Syncs local design system components to a claude.ai/design project. | `method`, `projectId`, `path`, `writes`, `deletes`, `planId`, `files`, `paths`, `name`, `assets`, `localDir`. | ❌ | ❌ | ✅ |
| `ClaudeDesign` | <Undocumented /> <Gated note="hidden server-side flag" /> | Works with Claude Design projects. | `operation`, `arguments` (object, default `{}`). | ❌ | ❌ | ❌ |
| `Projects` | <Undocumented /> <Gated note="allow_projects_tool policy and an attached project" /> | Reads and writes the attached claude.ai project. | `method` union, with method-specific fields. | ❌ | ❌ | ❌ |
| `SendToProject` | <Undocumented /> <Gated note="allow_remote_sessions policy, not CLAUDE_CODE_REMOTE, and a hidden server-side flag" /> | Sends this session's work to a Claude Project, the last step of [`/send-to-project`](../../extend/skills-and-commands/slash-commands.md). | `project_name` (string, 1 to 200, required), `project_id` (string, max 160, optional), `attach_git_remote` (boolean, required), `proposal` (object, required). It shows its own confirmation pane and does nothing unless you approve. It works only in the turn where you ran `/send-to-project`. Remote Control must be on for the session. | ❌ | ❌ | ✅ |
| `SendToProjectContext` | <Undocumented /> <Gated note="same gate as SendToProject" /> | Returns what `/send-to-project` read about the folder and the target project. It sends nothing. | No parameters. It works once, in the turn where you ran `/send-to-project`. A second call returns a short note. | ✅ | ❌ | ✅ |
| `EndConversation` | <Documented /> <Gated note="hidden server-side flag" /> | Ends the conversation (abuse, or on request). | No parameters. Removed from subagents. | ✅ | ❌ | ✅ |
| `RemoteTrigger` | <Documented /> <Gated note="first-party login, allow_remote_sessions policy, not CLAUDE_CODE_REMOTE" /> | Manages scheduled cloud agent routines. | `action`, `trigger_id`, `session_id`, `cursor`, `body`. | ❌ | ❌ | ✅ |
| `SearchMcpRegistry` | <Undocumented /> <Gated note="hidden server-side flag" /> | Finds MCP connectors by keyword. | `keywords` (1 to 8 strings). | ❌ | ❌ | ✅ |
| `SuggestConnectors` | <Undocumented /> <Gated note="hidden server-side flag" /> | Resolves MCP connector payloads by `directoryUuid`. | `uuids` (1 to 32 strings). | ❌ | ❌ | Runtime check |
| `ListConnectors` | <Undocumented /> <Gated note="hidden server-side flag" /> | Lists installed MCP connectors. | `keywords` (optional filter). | ❌ | ❌ | ✅ |
| `SendUserFile` | <Documented /> <Gated note="hidden server-side flag" /> | Delivers files to the user. | `files` (string array), `caption`, `status` (`normal` or `proactive`), `display` (`render` or `attach`). | ❌ | ❌ | Runtime check |
| `propose_skills` | <Undocumented /> <Gated note="CLAUDE_CODE_SKILL_PROPOSALS or a remote entry point" /> | Proposes skills from recurring procedures. It needs a remote environment (`CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE` set). Since `2.1.310`, a host launch with no disk also works when both `CLAUDE_CODE_SKILL_PROPOSALS` and `CLAUDE_CODE_SYNC_SKILLS` are set (the program). The test goes in this order (`chunk-d5m0r1p4.js@31649` in `2.1.323`; the test is unchanged from `2.1.322`, where it sat at `chunk-d5m0r1p4.js@31649`). It is off in a child session (`CLAUDE_CODE_CHILD_SESSION` or `CLAUDECODE`). With no disk and the derived surface `remote_cowork`, it follows `CLAUDE_CODE_SYNC_SKILLS` and the sync veto. Otherwise it needs `CLAUDE_CODE_SKILL_PROPOSALS`, or the entry point `remote_cowork`, or, since `2.1.319`, the session origin `claude_ai_chat` (`CLAUDE_CODE_SESSION_ORIGIN`) together with a cowork entry point (`remote_cowork` or `remote_cowork_trigger`). The remote environment test and the last tests did not change. Cases `print.api319.tool.propose-skills.cowork` (entry point `remote_cowork`: listed), `.trigger` (`remote_cowork_trigger`: not listed), `.trigger-chat` (`remote_cowork_trigger` and `claude_ai_chat`: listed), `.chat-only` (`claude_ai_chat` with the default entry point: not listed). All four set `CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE` and `CLAUDE_CODE_SYNC_SKILLS=1`. | `proposals`: an array of objects with `name`, `kind` (`new` or `improvement`), `target`, `description`, `evidence`, `skillMd`. | ❌ | ❌ | ❌ |
| `ReadWidgetContext` | <Undocumented /> <Gated note="remote session, non-interactive run, and the server flag tengu_amber_trellis" /> | Reads what an MCP App view has shared. The prompt says views are drawn in the conversation from earlier tool calls, and each has a `widget_id` (`widget_` and 8 characters). With no `widget_id`, every held view is returned. Each answer is a JSON object with `widget_id`, `tool_name`, `view`, and `widget_reported_state`, followed by the images. The prompt tells Claude to treat the shared state as data with no instructions. The tool is on when `CLAUDE_CODE_REMOTE` is set, the run is not interactive and not diskless, and the flag `tengu_amber_trellis` is on (`chunk-2x9ma4k7.js@1158500`; the definition is `chunk-4pz2b5hr.js@16368`). Cases `print.api319.tool.widget.off` (not listed) and `.remote-flag` (`CLAUDE_CODE_REMOTE=1` and the flag cached as on: listed). | `widget_id` (string, optional). The result is `blocks` (text or image) and `isError`. | ✅ | ✅ | ❌ |
| `WrapUp` | <Undocumented /> <Gated note="CLAUDE_CODE_ENABLE_WRAP_UP and the server flag tengu_merry_thunder" /> | Offers the user a next step when a turn ends (user-facing name "Wrap up"). The prompt starts "Call this before you write your closing message: it fills the next-step box that the app draws under that message". Claude calls it once in each turn that changed files, ran commands, or ended with a question for the user, and skips short answers. It always allows the call, and the tool is read-only. The result text is "Recorded. Write your closing message now, as the last thing you say this turn." With `ask` it adds that the closing message ends with the question in one short sentence. The tool is on when the launch offers it (`CLAUDE_CODE_ENABLE_WRAP_UP`, never in a child session), Code Mode is off or `Ny()` fails, and the flag `tengu_merry_thunder` is on (`chunk-4pz2b5hr.js@35232`, `chunk-5erhnvzw.js@19789`). Since `2.1.323` a session that came from the phone (cloud origin `remote_mobile`) also needs the server flag `tengu_refactored_crystal` (`chunk-4pz2b5hr.js@35364`, `chunk-5erhnvzw.js@19790`). Cases `print.api319.tool.wrap-up.env-flag` (the variable and the cached flag: listed), `.env`, `.flag-only`, and `.off` (none listed). | `recap` (string, required, 2 or 3 short sentences). `ask` (string, optional, the user's one decision, under 100 characters). `blocked` (boolean, optional, true when work stops until the user answers). `actions` (up to 2, optional, needs `ask`): `{label}` is a reply of 1 to 3 plain words and at most 24 characters, and `{action}` is one of `verify`, `fix_ci`, `address_comments`, `resolve_conflicts`. A label that spells `ultracode`, `ultraplan`, `ultrareview`, or `ultrathink`, holds a line break or tab, or holds two blanks in a row is refused. The result is `asks` (boolean). | ❌ | ❌ | ❌ |
| `Yield` | <Undocumented /> <Gated note="server flag tengu_dazzling_acorn, and Code Mode off" /> | Waits for background work. The description is "Wait for your background work". Claude calls it only when it has no other work. It resumes when a background tool reports, a message arrives, a scheduled prompt is due, or a tool it waits on reaches its time limit. The result text says why the wait ended. Only the first call in a reply waits; a second call in the same reply returns at once. New in `2.1.323`. | The input schema is not listed here. The tool is on when the flag `tengu_dazzling_acorn` holds an object with `enabled` set to true, and Code Mode is not on (`chunk-30ykagaf.js@5337`). The flag value can carry its own `description` text, which then replaces the built-in prompt (`chunk-wsbdy0t0.js@22262`, `chunk-m7hqs62q.js@1094`). | ✅ | ❌ | ❌ |

## Plugin, Skill, and Browser Tools

Source: the program (the tool names and the input schemas in [`claude-code-tools.json`](../schemas.md)). The four plugin and skill tools share one enable gate, described below. The program does not show a gate for the other tools, except where the table gives one.

| Tool | Status | What It Does | Parameters and Gate |
| --- | --- | --- | --- |
| `ListPlugins` | <Undocumented /> | Lists plugins. | `keywords` (up to 8 strings, optional filter). Omit it to list everything. [Shared enable gate](#shared-enable-gate). |
| `ListSkills` | <Undocumented /> | Lists skills. | `keywords` (up to 8 strings, optional filter). Omit it to list everything. [Shared enable gate](#shared-enable-gate). |
| `SearchPlugins` | <Undocumented /> | Searches plugins by keyword. | `keywords` (1 to 8 strings, required). [Shared enable gate](#shared-enable-gate). |
| `SearchSkills` | <Undocumented /> | Searches skills by keyword. | `keywords` (1 to 8 strings, required). [Shared enable gate](#shared-enable-gate). |
| `RefreshMcpTools` | <Undocumented /> <Gated note="CLAUDE_CODE_ENABLE_REFRESH_MCP_TOOLS" /> | Queries the tool list of connected MCP servers again and applies it. It never dials a server. | `server` (string, optional). Omit it to refresh all connected servers. Each result has a `status` of `refreshed`, `error`, or `not_connected`. |
| `enable__mcp__claude-in-chrome` | <Undocumented /> <Gated note="a remote session profile" /> | Enables Claude in Chrome, the Claude extension in the Chrome browser on your computer, for the conversation. | `task` (string, optional): what Claude is about to do in the browser. [Computer link gate](#computer-link-gate). |
| `enable__mcp__remote-devices__Claude_Browser` | <Undocumented /> <Gated note="a remote session profile" /> | Enables the browser built into the Claude desktop app for the conversation. | `task` (string, optional). [Computer link gate](#computer-link-gate). |
| `enable__mcp__remote-devices__computer` | <Undocumented /> <Gated note="a remote session profile" /> | Enables computer use on your own computer for the conversation: screenshots, clicks, typing, scrolling, and opening apps, through the tools that start with `mcp__remote-devices__computer_`. | `task` (string, optional): what Claude is about to do on the computer. [Computer link gate](#computer-link-gate). |
| `request_computer` | <Undocumented /> <Gated note="a remote session profile" /> | Does nothing. Its description tells the model that it cannot connect a computer, and that the tools that start with `mcp__remote-devices__` run on your computer. | No parameters. [Computer link gate](#computer-link-gate). |

### Shared Enable Gate

`ListPlugins`, `ListSkills`, `SearchPlugins`, `SearchSkills`, `SuggestPluginInstall`, and `SuggestSkills` all use one `isEnabled` function (the program, `chunk-arh3hz21.js` and `chunk-phz964my.js`). Claude Code evaluates these tests in order and stops at the first answer.

| Step | Test | Result |
| --- | --- | --- |
| 1 | The policy mirror for `allow_plugin_skill_search` says `org_denied`, `latched`, or `unregistered`. | Off |
| 2 | A policy mirror answer exists (not `null`) and the HIPAA mode is on. | Off |
| 3 | `CLAUDE_CODE_REMOTE` is set and the provider is first party. | On |
| 4 | The entrypoint is `claude-desktop`, `claude-desktop-3p`, or `local-agent`, the session is not a child session, the provider is first party, and the rollout reader answers true. | On |
| 5 | None of the above. | Off |

- The provider is first party when no `CLAUDE_CODE_USE_*` variable for Bedrock, Mantle, Vertex, or another cloud provider selects another one. A normal terminal login (entrypoint `cli`) with `CLAUDE_CODE_REMOTE` unset reaches step 5, so these tools are off.
- The rollout reader of step 4 answers from a server flag (`tengu_saddle_lantern`, default `false`), which you cannot set. `SuggestSkills` and `SuggestPluginInstall` are deferred only while their own rollout test is off.
- A second check answers for a tool name: it says yes for every name outside the list `SearchPlugins`, `SearchSkills`, `ListPlugins`, `ListSkills`, and gives the gate's answer for those four. The two `Suggest` tools are not in that list.
- A search call that the policy refuses fails with the policy text, `Plugin and skill search is unavailable right now; please try again.`, when the policy gives no text of its own. A login token without the `user:plugins` scope makes `SearchPlugins` return an empty list.

### Computer Link Gate

The program lists the four stub tools `enable__mcp__claude-in-chrome`, `enable__mcp__remote-devices__Claude_Browser`, `enable__mcp__remote-devices__computer`, and `request_computer` when one of two tests passes (`chunk-656gy9e9.js` `isEnabled`). Each stub is deferred, so with tool search on it is announced by name, not sent in full.

| Test | What It Needs | Case |
| --- | --- | --- |
| Remote session profile | `CCR_SESSION_PROFILE` set, `SESSION_INGRESS_URL` an `https://` origin with no path, query, or user, `CLAUDE_CODE_REMOTE_SESSION_ID` that starts with `cse_` (letters, digits, and `_` only), and the Anthropic API as the provider, not Bedrock, Vertex, or Foundry (`chunk-793j3w2k.js`). | `print.api319.tool.enable-stubs.profile`: listed. `.profile-bad-id` (`session_probe`) and `.profile-http-ingress` (`http://`): not listed. `.direct` (none set): not listed. |
| claude.ai chat surface | `CLAUDE_CODE_SESSION_ORIGIN=claude_ai_chat`, a host launch with no disk whose derived surface is `remote_cowork`, and the server flag `tengu_merry_tide`. The host sets the last two launch options. No env var or flag sets them. | `print.api319.tool.enable-stubs.chat-flag` (the origin and the flag, no host launch): not listed. |

```bash title="List the computer link stubs"
CCR_SESSION_PROFILE=1 \
SESSION_INGRESS_URL=https://ingress.example.com \
CLAUDE_CODE_REMOTE_SESSION_ID=cse_example \
ENABLE_TOOL_SEARCH=false \
claude -p "Reply with 'OK'."
```

A call answers with a text that depends on what the session has. With no linked computer, the text tells the model to say so in plain words and to do the task with the tools it has.

## Self-Hosted Runner Tools

These nine tools are off by default. A `--tools` list that names one of them turns them on, except in a remote session (`CLAUDE_CODE_REMOTE`) or a background session (the program, `chunk-5erhnvzw.js`, search `baseTools`). All are <Undocumented /> and <Gated note="a self_hosted_runner_ name in --tools" />. All are deferred.

| Tool | What It Does | Read-Only | Parallel |
| --- | --- | --- | --- |
| `self_hosted_runner_get_pool` | Reads self-hosted environment aggregates and queue counts. | ✅ | ✅ |
| `self_hosted_runner_list_sessions` | Lists queued and assigned sessions in a self-hosted environment. | ✅ | ✅ |
| `self_hosted_runner_list_runners` | Lists registered self-hosted runners for an environment. | ✅ | ✅ |
| `self_hosted_runner_list_secrets` | Lists self-hosted environment secrets (metadata only). | ✅ | ✅ |
| `self_hosted_runner_read_health` | Probes the local runner `/healthz` endpoint. | ✅ | ✅ |
| `self_hosted_runner_read_metrics` | Reads runner Prometheus gauges from `/metrics`. | ✅ | ✅ |
| `self_hosted_runner_requeue_session` | Requeues a stuck session onto another runner. | ❌ | ❌ |
| `self_hosted_runner_spawn_local` | Starts a local runner process for a try-out. | ❌ | ❌ |
| `self_hosted_runner_tail_log` | Tails the runner log file with secret redaction. | ✅ | ✅ |

## Tools without an Inventory Row

The inventory file does not list these tools, because their definitions do not use a plain `searchHint` text.

| Tool | Status | What It Does | How It Works | Available In | Read-Only | Parallel | Deferred |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ToolSearch` | <Documented /> | Loads the schema of deferred tools. | See [ToolSearch](index.md#toolsearch). | Main session and subagents. | ❌ | ❌ | ❌ |
| `WaitForMcpServers` | <Documented /> <Gated note="used when tool search is off" /> | Waits for pending MCP servers. | Removed from subagents. | Main session. | ❌ | ❌ | ❌ |
| `StructuredOutput` | <Undocumented /> | Returns the final JSON for `--json-schema` runs. | Never deferred. | Main session in print mode. | ❌ | ❌ | ❌ |
| `ListMcpResourcesTool`, `ReadMcpResourceTool`, `ReadMcpResourceDirTool` | <Documented /> | List and read MCP resources. | Deferred. Offered when an MCP server has resources. | Main session. | ✅ | ✅ | ✅ |

[Agents, Tasks, and Planning](agents-and-tasks.md) and [Shell, Web, and Background Tasks](shell-and-web.md) list `Agent`, `Monitor`, `ScheduleWakeup`, `Workflow`, and `SubagentHandback`.

## Code Mode

Code Mode is an experimental opt-in. Claude writes JavaScript that calls its tools, and the `REPL` tool runs it. The release notes for `2.1.323` list it as new. The page the notes link to, `https://code.claude.com/docs/en/code-mode`, answered HTTP 404 when this page was written, so this section rests on the program only.

Source: the program (`chunk-h780xah3.js@6142`, `chunk-6hmtgpqk.js@2000`, `chunk-64gae3y3.js@1100`).

| Item | Status | What It Does |
| --- | --- | --- |
| `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` | <Undocumented /> | The switch. The program reads it from the shell, from `env` in user settings, and from `env` in a `--settings` file. A true value asks for Code Mode. A false value turns it off. A value that is neither makes the program refuse it with "must be 1 to turn it on". |
| Refusals | <Undocumented /> | When Claude Code asks for Code Mode and cannot start it, it prints "Code Mode (experimental) isn't available" with the reason, then starts with the ordinary tools. Reasons in the program include: your organization's settings do not allow it, managed settings or `~/.claude.json` also set the variable, the model is not Opus 5.5, Sonnet 5.5, or later, the provider is not the Anthropic API, a deny rule or `--tools` leaves the tool out, and agent teams are on. It is off in background jobs and with Remote Control. |
| Server flag | <Gated note="tengu_rustling_blossom" /> | The program also needs this flag on for your account, with the reason "it isn't open to your account yet". |
| Other tools | <Undocumented /> | With Code Mode on, `Yield` is off (`chunk-30ykagaf.js@5337`). |

## Result Fields New In `2.1.311`

Source: `AppifactReplResult`, `PollResult`, and `ProjectsResult` in [`claude-code-tools.json`](../schemas.md), and the program.

| Field | Status | Tool and Result | Type | What It Means |
| --- | --- | --- | --- | --- |
| `toolsUsed` | <Undocumented /> | `AppifactRepl` | Array of strings | The tools that the calls of the script's artifact reached, whose names the prompt of this conversation did not yet carry. The `tool_result` text opens with a line that names them. The program leaves the field out when the list is empty (`chunk-y00rsa8r.js:1870`, `chunk-y00rsa8r.js:1964`, `chunk-y00rsa8r.js:2082`). |
| `toolsUsed` | <Undocumented /> | `Poll` | Array of strings | A list of tool names. The program leaves the field out when the list is empty (`chunk-2x9ma4k7.js:187123`). The schema gives no description, so this page states only its name and type. |
| `local_file` | <Undocumented /> | `Projects`, the `project_info` result | String | A path to a file that holds the project description and instructions in full, with long lines split. The program returns it when the two together are too long to return. Then `description` and `instructions` are empty strings. The file is for reading only. Edits to it do not change the project (`chunk-qkje5ysj.js:1804`, `chunk-qkje5ysj.js:1835`). |

In `2.1.321` the program has no server flag for the `toolsUsed` list. It builds the list from the tools that each agent recorded (`chunk-b67kdazn.js:1857`, `chunk-b67kdazn.js:4285`).

## Result Fields New In `2.1.321`

Source: `SendUserFileResult` in [`claude-code-tools.json`](../schemas.md), and the program.

| Field | Status | Tool and Result | Type | What It Means |
| --- | --- | --- | --- | --- |
| `attachments[].thumbnail` | <Undocumented /> | `SendUserFile` | Object `{width, height}` of numbers | The size of a thumbnail of the file. The schema gives no description. When a result arrives from another process, the program keeps `thumbnail` only if the attachment has a `file_uuid` and both numbers are integers from 1 to 1000000. Otherwise it drops the field (`chunk-jqk6zhc4.js:12878`, `chunk-ewf4bz8j.js@2032`). |

`REPLResult.imagesRefused` is not listed. The `REPL` tool is not user-reachable, so no page covers it (see [Surface Coverage](../surface-coverage.md)).

## Example

Turn on skill proposals for one session. The tool also needs a remote environment (see the `propose_skills` row). So in a local terminal this line alone does not turn it on.

```bash title="Enable propose_skills"
CLAUDE_CODE_SKILL_PROPOSALS=1 claude
```

## How It Works

Claude Code builds a gated tool only when its gate passes. Gates are a login type, a policy, an entry point, an env var, or a server-side flag.
A tool with a server-side flag appears for some accounts and not for others. So the same version can show different tools.
Most of these tools are deferred. So Claude finds them with `ToolSearch` and not in the first tool list.

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `Failed to spawn runner` | <Undocumented /> | `self_hosted_runner_spawn_local` could not start the runner process. | The tool starts the program's own file again with `self-hosted-runner` and the flags of the call. The text gives the system error and the full command. Run: `--tools self_hosted_runner_spawn_local` with a copy of the program, and a `PreToolUse` hook that deleted the copy before the call. The tool result was `Failed to spawn runner (ENOENT: no such file or directory, posix_spawn '<path>'). Command: <path> self-hosted-runner --environment-secret-file …`. Probe case `print.err319.runner-spawn-missing-binary`. |
| Various | <Undocumented /> | **Artifact.** The `Artifact` tool refused or could not finish a call. | An input no longer matches what was approved (`action`, `url`, `type_url`, `out_dir`, or a file). So nothing was done. The call must be retried. An action is not available in this session or build. A required argument is missing or wrong (`url`, `thread_id`, `cursor`, `db_op`, `collection`, `doc_id`, `file_path`, `asset_id`). A Read or Edit permission rule blocks the file. The page, the preview, or a database write could not be completed. |
| Various | <Undocumented /> | **Claude Design.** `DesignSync` or `ClaudeDesign` refused a call or could not reach Claude Design. | No plan token or an old one. Run `finalize_plan` first. A path is reserved (`CLAUDE.md`, `CLAUDE.local.md`, and `.claude/`) or outside the finalized plan. A write needs a one-time approval or a project write grant that is not active. A request to Claude Design failed with an HTTP status, or the OAuth base URL is not on the first-party allowlist. |
| Various | <Undocumented /> | **Projects.** The `Projects` tool refused a read or write. | The session has no project attached. A write would put the project over its maximum size. `if_version` no longer matches the doc. The uploaded bytes do not match. The path is a file upload (`project_delete` removes text docs only). |
| `Could not` | <Undocumented /> | **Send to project.** A call to the Claude Projects service failed. The full text is `Could not <step>: <detail>`. The program fills `<step>` with a fixed phrase, so the phrases are parts of one message and not separate messages. | `<step>` is, for example, `create the project`, `look up the project`, `list your cloud environments`, `save to project memory`, `send the message`, or `submit the setup proposal`. `<detail>` is the message of the server, or `the server responded with status <code>`. It can also say that Projects need the first-party provider, that nonessential traffic is off, or that Projects need a Claude.ai login (`/login`). |
| `write_files: the directory approved at finalize_plan no longer resolves to the path that was approved` | <Undocumented /> | **Claude Design.** `DesignSync` stopped a `write_files` call. | The approved directory was moved, replaced, or deleted after `finalize_plan`. The full text goes on: `Nothing in this call was uploaded. Run finalize_plan again.` |
| Various | <Undocumented /> | **Computer use.** A computer-use action was refused. | The platform is not supported. A key chord has too many components. The clipboard write did not round-trip. The session has no disk for the lock. A session context is missing. |
| Various | <Undocumented /> | **Trigger tools.** A trigger call was missing a required argument. | A caller used an action such as `get`, `update`, `list_runs`, `run`, or `get_run_log` without `trigger_id` or `session_id`. A caller used `create`, `update`, or `create_webhook_trigger` without `body`. A `get_run_log` call gave a cursor that is not in the right form (the program checks it before any request). Run live (case `live.err319`, a subscription token, "Reply with 'OK'." first): `RemoteTrigger` was in the tool list, and a `get_run_log` call with cursor `bad` returned `cursor is not in the form that get_run_log hands out for this session_id, so nothing was read.` and no request was sent. The print case `print.err319.remote-trigger-bad-cursor` with a fake login did not list the tool, because the tool needs the `allow_remote_sessions` policy from a signed policy file. |
| `Cannot write reserved paths`, `Cannot delete reserved paths` | <Undocumented /> | **Claude Design.** A `write_files` or `delete_files` call of `DesignSync` named a reserved path. The text is `Cannot write reserved paths: ${…}. CLAUDE.md, CLAUDE.local.md and .claude/ carry agent instructions and are blocked regardless of the plan.` (or `Cannot delete reserved paths` with the same end). | The call lists the reserved paths and stops before it uploads or deletes anything. The check runs after the plan token check and before the check that the path is in the finalized plan. A plan does not allow a reserved path. Take `CLAUDE.md`, `CLAUDE.local.md`, and `.claude/` paths out of the call. Before 2.1.321 the text named only `CLAUDE.md` and `.claude/` and said they carry instructions "to the design agent". Source: the program (`chunk-hp5tht7v.js:39220` for write, `chunk-hp5tht7v.js:40151` for delete). |
| `Write refused; nothing in the project was changed. if_version does not name the copy` | <Undocumented /> | **Projects.** A `project_write` that has `if_version` was refused, because `if_version` is not the copy of the doc that the tool checks the write against. | The copy is the last whole text of the doc that the session was shown or typed in this conversation. For a write from a file, it is also the last one read to or written from a file. Call `project_read` on the path, change the text that it returns, and write again without `if_version`. The text is one of several `Write refused; nothing in the project was changed.` messages in the same module. Since `2.1.321`: `2.1.319` does not have this text. Source: the program (`chunk-qkje5ysj.js:39862`). |

## Related Pages

- [Tools](index.md)
- [MCP](../../extend/mcp/index.md)
- [Tools Reference](https://code.claude.com/docs/en/tools-reference)
