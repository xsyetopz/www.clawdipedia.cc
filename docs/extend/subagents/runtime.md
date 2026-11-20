---
title: Subagent Runtime
description: Built-in agents, tool filters, forks, background runs, depth and concurrency limits, and agent teams.
sidebar_position: 3
---

Claude Code ships a few built-in agents, and a set of rules limits every subagent.
The rules cover tool filters, forks, background runs, depth limits, and agent teams.
For example, a subagent cannot start another one past the depth limit, which is 3 by default.
A fork is a subagent that inherits the whole conversation and shares the prompt cache with its parent.

Your own agent file replaces a built-in one of the same name. Limits come from env vars and settings. The switches are `CLAUDE_CODE_FORK_SUBAGENT`, `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS`, `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS`, and `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS`.

## Example

Limit nesting to one level. Run every subagent in the foreground.

```bash
export CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1
export CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1
claude
```

## Built-In Agents

Claude Code has 14 built-in names. Six are in the docs. The rest are internal or are not agents. The `subagent_type` parameter of the `Agent` tool picks one.[^builtins]

| Agent | Status | What it does | Notes |
| --- | --- | --- | --- |
| `Explore` | <Documented /> | A fast read-only search agent. | Model `inherit`, with a cap at the `opus` tier when the session model is newer than `opus` (`CLAUDE_CODE_DISABLE_EXPLORE_INHERIT_CAP` removes the cap). It has `omitClaudeMd` and no git status. Denies `Agent`, `ExitPlanMode`, `Edit`, `Write`, `NotebookEdit`, and the four Artifact tools `Artifact`, `ArtifactComments`, `ArtifactData`, and `ArtifactCheck`. A user agent named `Explore` overrides it. `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1` removes it.[^explore] |
| `Plan` | <Documented /> | A research agent for plan mode. | Model `inherit`. The same `disallowedTools` as `Explore`. `omitClaudeMd` is true. |
| `general-purpose` | <Documented /> | A capable agent for multi-step work. | `tools:["*"]`. Model: `CLAUDE_CODE_SUBAGENT_MODEL` or the main model. The default when you omit `subagent_type`. `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` removes it in `-p`. |
| `claude` | <Documented /> | A catch-all agent with every tool. | `tools:["*"]`, `appendSystemPrompt` true, no model of its own. Also the default agent for a dispatched background session. |
| `statusline-setup` | <Documented /> | Configures the status line for `/statusline`. | Tools `Read` and `Edit`. Model `sonnet`. Color `orange`. Interactive. |
| `claude-code-guide` | <Documented /> | Answers questions about Claude Code. | Model `haiku` (checked: the interactive screen sent `claude-haiku-5-5`). Mode `dontAsk`. Tools `Bash`, `Read`, `WebFetch`, `WebSearch`. The prompt also lists your custom skills, agents, MCP servers, plugin skills, and the names of your settings keys. Claude Code leaves it out when `CLAUDE_CODE_ENTRYPOINT` is `sdk-ts`, `sdk-py`, or `sdk-cli` (a `-p` run reports `sdk-cli`). So it exists only in the interactive CLI. Prompt text: [Subagent, Claude Code Guide](../../prompts/agents/subagent-claude-code-guide.md). |
| `fork` | <Documented /> | A fork of the main conversation. | Inherits the system prompt, tools, model, and history. Cannot start a fork. At the depth limit it keeps `Agent`, but the tool returns an error. Needs fork mode. Forks started together are each told which launch is their own.[^v307] |
| `workflow-subagent` | <Undocumented /> | The agent that `Workflow` scripts use. | `Workflow` scripts start their agents with this type. The model is `CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL` if set (and not `inherit`), then `CLAUDE_CODE_SUBAGENT_MODEL`, then the main model. Both win over a `model` option in `agent()`. The prompt tells the agent that its final text goes back to the script as a string. You cannot start it with the `Agent` tool, in `-p` or in the interactive screen (`Agent type 'workflow-subagent' not found`).[^probes] |
| `comment-thread-analyst` | <Undocumented /> | Analyzes artifact comment threads. | One tool. Model `inherit`. `maxTurns` 6. `omitClaudeMd` true. Only the artifact comment pipeline starts it (the definition says it is not for direct spawning). It is not in the agent list in any entry point. |
| `web-fetch` | <Undocumented /> <Gated note="CLAUDE_CODE_WEB_FETCH_AGENT" /> | Fetches URLs for a caller. | Prompt "web-reading specialist". `maxTurns` 15. Color `blue`. `omitClaudeMd` true. Model `haiku` or `inherit`, by a flag (a probe run inherited the main model). The agent exists only when `CLAUDE_CODE_WEB_FETCH_AGENT` is on (or its server flag). With default settings the interactive screen also answers `Agent type 'web-fetch' not found`. Then the main session loses its own `WebFetch` tool and calls this agent instead. The agent has only `WebFetch`. It is off when you set `CLAUDE_CODE_SIMPLE` or `CLAUDE_CODE_DISABLE_WEB_FETCH`.[^probes] |

:::note
In `-p` and the SDK entry points the spawnable built-in types are `claude`, `Explore`, `general-purpose`, `Plan`, and `statusline-setup`, plus `web-fetch` when it is on. In the interactive screen with default settings the list is `claude`, `claude-code-guide`, `Explore`, `general-purpose`, `Plan`, and `statusline-setup`, plus `fork`. `comment-thread-analyst` and `workflow-subagent` are not spawnable with `Agent` in either place (`Agent type '...' not found`). The artifact comment pipeline starts `comment-thread-analyst`, and `Workflow` scripts start `workflow-subagent`.
The names `worker`, `renewal`, `killed`, `decorations`, and `main-session` also appear in the program. They are not spawnable agent types as far as anyone read.
See [Probes](../../reference/probes.md#subagents-and-hooks).
:::

## Tools and Context of a Subagent

| Rule | Status | What it does | Notes |
| --- | --- | --- | --- |
| First filter | <Documented /> | Removes tools from every subagent. | Removed: `Agent` at the depth limit (not for a fork), `AskUserQuestion`, `EndConversation`, `EnterPlanMode`, `ExitPlanMode` (kept in `plan` mode), `ScheduleWakeup`, `WaitForMcpServers`, `Workflow`. Forks skip both filters. |
| Second filter | <Documented /> | The built-in tools that a background subagent keeps. | File and search tools, shell tools, web tools, `TodoWrite`, `Skill`, `ToolSearch`, the worktree tools, `Monitor`, `TaskStop`, `SendMessage`, `Artifact`, `SubagentHandback`, and every MCP tool. |
| Foreground or background | <Documented /> | How Claude Code places a start. | A teammate start and `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` run in the foreground. Fork mode and `background: true` run in the background. Otherwise the default is background, and `Ctrl+B` backgrounds a running task. |
| Resume | <Documented /> | Continues a finished subagent. | Use `SendMessage` with the name or agent ID. A per-call `model` also applies on resume. Claude Code saves the per-call `model` (after a hook changes the call) in the agent metadata, and it reads the saved value on resume.[^resume] A subagent started with no per-call `model` saves its resolved model only when the server gate `tengu_graceful_pudding` is on (it is on by default) and one session check is false, or when a subagent starts it on its own model and that model is not the model of the main session. A sibling is a subagent that messages the resumed one and is not its parent. When a sibling resumes a subagent, the resumed subagent does not take the model and the effort of the sibling. It takes the model of the main session, and the effort that the sibling had picked is cleared. The resumed subagent also does not keep the allowed-tools and permission-mode rules of the sibling. Its permission mode stays the mode of the sibling only when that mode is no more permissive than the session mode, in the order `plan`, `default` (and `dontAsk`), `acceptEdits`, `auto`, `bypassPermissions`. Otherwise the session mode replaces it. A `default` mode also becomes the session mode when the session mode is `dontAsk`.[^resume-327] |
| Initial context | <Documented /> | What a non-fork subagent loads. | The agent prompt, the task message, `CLAUDE.md` files (unless `omitClaudeMd`), git status (not for `Explore` and `Plan`), preloaded skills, and a roster of siblings with `SendMessage`. No output style and no auto memory. |

## Limits and Switches

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | <Documented /> | Layers of nesting below the main session. | Default 3. At the limit `Agent` is withheld, except from a fork. `1` turns nesting off. Claude Code reads the depth from this variable, then from a server experiment value, then uses 3.[^depth] |
| Order of `Agent` refusals | <Undocumented /> | The checks that run before a subagent starts. | In order: spawn depth, a stop pending on the spawner, an unknown agent type, the concurrency limit, then the budget. The first check that fails gives the error.[^refusals] |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | <Documented /> | The most subagents running at once. | Default 20. The error is `Concurrent subagent limit reached`. Ultracode sessions are exempt. Resumes and `/subtask` forks take a slot but are not blocked. |
| Hook agent turn cap | <Undocumented /> | Stops an agent hook that runs too long. | At turn 50 the hook agent aborts and logs `Hooks: Agent turn N hit max turns, aborting`. The hook outcome is `cancelled`.[^hook-cap] See [Hook Handlers](../hooks/handlers.md). |
| First subagent on a model | <Undocumented /> | Waits for the model's settings from Anthropic. | The first subagent on a model waits up to 1.5 seconds for those settings, and up to 10 seconds in `claude -p`, instead of starting without them.[^model-wait] |
| Subagent `maxTurns` | <Documented /> | Stops a subagent at its turn limit. | The loop adds a `max_turns_reached` attachment, and the debug log says `Reached max turns limit`. A `-p` run that reaches its own `--max-turns` ends with the result subtype `error_max_turns` and the error `Reached maximum number of turns (N)`.[^max-turns] |
| `CLAUDE_CODE_FORK_SUBAGENT` | <Documented /> | Fork mode. | On by default. `1` forces on, `0` forces off. In a non-interactive session, a server flag can turn it off unless `1` is set.[^fork-mode] In fork mode every subagent runs in the background, and `Agent` has no `run_in_background`. |
| `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` | <Documented /> | Runs all subagents in the foreground. | Set `1`. Also removes `run_in_background`. |
| `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS` | <Documented /> | The stall timeout. | Default 600000. |
| `CLAUDE_CODE_FORWARD_SUBAGENT_TEXT` and `--forward-subagent-text` | <Documented /> | Sends subagent text in `stream-json`. | Print mode only. |
| `CLAUDE_CODE_SUBAGENT_MODEL`, `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` | <Documented /> | The default model, and forcing it. | See `model` on [Subagent Frontmatter](frontmatter.md). |
| `CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL`, `subagentPromptCacheTtl` | <Documented /> | The cache TTL for subagent requests. | `5m` or `1h`. Frontmatter `experimental.cacheTtl` is the third source. See [Request and Cache](../../how-it-works/request-and-cache.md). |
| `CLAUDE_CODE_ENABLE_APPEND_SUBAGENT_PROMPT`, `CLAUDE_CODE_MEMORY_SUBAGENT_APPEND`, `CLAUDE_CODE_SUBAGENT_PROMPT_SNAPSHOT`, `CLAUDE_CODE_SUBAGENT_CACHE_EVICT`, `CLAUDE_CODE_SUBAGENT_CONFIG_WARNING` | <Undocumented /> | Other subagent variables in the program. | `--append-subagent-system-prompt <text>` (or `--append-subagent-system-prompt-file <file>`, print mode only, hidden) adds text to the end of every subagent system prompt. It turns on `CLAUDE_CODE_ENABLE_APPEND_SUBAGENT_PROMPT`, and the variable alone changes nothing. Using both flags gives an error. `CLAUDE_CODE_SUBAGENT_CONFIG_WARNING` turns the startup notice that your config asks for subagents on (`1`) or off (`0`). `CLAUDE_CODE_SUBAGENT_CACHE_EVICT` adds the `prompt-caching-evict-2026-05-12` beta to a subagent's last request, on a first-party login. `CLAUDE_CODE_SUBAGENT_PROMPT_SNAPSHOT` and `CLAUDE_CODE_MEMORY_SUBAGENT_APPEND` showed no change in print mode.[^probes] |
| Settings `agent`, `teammateMode` | <Documented /> | `agent` sets the main-session agent. `teammateMode` picks the teammate display. | `teammateMode` takes `auto`, `tmux`, `iterm2`, or `in-process`.[^teammate-mode] |
| tmux teammate pane start | <Gated note="Server flag" /> | How a teammate pane runs its start command. | When the command holds a character such as `!`, `$`, or `\`, a newline, or a non-ASCII character, and a server flag is on, the pane runs it through `-c` in the tmux `default-shell` if that is a bash or zsh path, and in `/bin/sh` otherwise. A pane that starts through `/bin/sh` may not read your shell start-up files.[^teammate-sh] |
| Setting `subagentStatusLine` | <Documented /> <Deprecated note="Works; will stop in a future release" /> | Custom row for each subagent in the agent panel. The command runs. | The schema says "Deprecated: still works, and will stop working in a future release". The program warns "subagentStatusLine is deprecated in favor of mods and will stop working in a future release" when a plugin sets it.[^status-line] |
| Safeguards stop a subagent | <Undocumented /> | The text that Claude gets when safeguards stop an agent. | It starts `Safeguards stopped this agent.` The text adds `, and automatic model switching is off` when that is the case for the stopped model. For a `cyber` stop where a retry is allowed, it says Claude can start a new agent with a clearer prompt that asks for no more than it needs, and that the same content reworded is likely to be stopped too. Otherwise it says to pass the message on to the user. It ends `Don't do the agent's work yourself: safeguards cover this conversation too.`[^safeguards] |
| Subagent output limit | <Undocumented /> | What a subagent gets when its reply stops at the output token limit. | A subagent whose reply stops at the limit with some text, and no unfinished block, gets this text: "Output token limit hit. Your caller does not receive an answer in pieces." It asks for the whole answer again, more briefly, if this was the final answer, and otherwise for the work in smaller pieces. If the reply stops a second time, the text starts "Output token limit hit again." It asks for the whole answer in at most half the length of the last try, or for what fits with a first line that says so.[^output-limit] |

All variables are also listed on [Environment Variables for Agents and Teams](../../configure/env-vars/agents-and-teams.md).

## Agent Teams

An agent team is a group of Claude sessions that work as teammates.

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| Agent teams | <Gated note="Set CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1." /> <Experimental /> | Several sessions work as teammates. | A named subagent started in an interactive team session starts as a teammate. `team_name` and `mode` on `Agent` are deprecated. Claude Code ignores them. |
| Teammate tools | <Gated note="Same switch as agent teams." /> | Extra tools for a teammate. | Teammates keep `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`, `CronCreate`, `CronDelete`, `CronList`. `SendMessage` routes by name, `main`, or agent ID. |
| `TeammateIdle` hook | <Documented /> | Runs when a teammate is about to go idle. | Exit 2 or `continue:false` keeps it working. See [Hook Events](../hooks/agent-events.md#teammateidle). |
| `TaskCreated`, `TaskCompleted` hooks | <Documented /> | Task lifecycle events. | `TaskCompleted` also fires when a teammate finishes its turn. |
| `agent.spawn` mod event | <Documented /> | Fires before a subagent or teammate starts. | `e.isTeammate` is true for a teammate. `next({...e, model})` sets the model. See [Plugin Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). |
| `CLAUDE_CODE_TEAM_TEARDOWN_PARK_TIMEOUT_MS` | <Documented /> | The wait at exit for team teardown. | 1000 to 60000 ms in print mode. |

## How It Works

```mermaid
flowchart TD
    A["<code>Agent</code> tool call"] --> B{Depth limit reached?}
    B -- yes --> C["Withhold <code>Agent</code> tool, or return an error for a fork"]
    B -- no --> D{Concurrent limit reached?}
    D -- yes --> E[Error: Concurrent subagent limit reached]
    D -- no --> F[Pick the agent type]
    F --> G[Apply the first tool filter]
    G --> H{Background?}
    H -- yes --> I[Apply the second tool filter]
    H -- no --> J[Run in the foreground]
    I --> K[Run and return a summary]
    J --> K
```

## Git Commands in a Worktree Subagent

A subagent that runs isolated in a worktree cannot run some git commands in `Bash`. A main session that runs in a worktree it created is covered in the same way. A main session in your own checkout is not affected. These commands can rewrite what the worktree shares with your own checkout, such as its branches, or start a program that Claude Code cannot check. The rule holds in every repository. Most of these commands are refused only when a server-side flag is on; the Status column says which.[^worktree-guard]
Status: <Gated />. The official docs do not state it.

The message names the worktree and the command. For the commands in the first part of the table, it says that the command is refused in every repository. It tells the agent to change its own branch with `git commit`, `git reset`, or `git rebase`, to start another with `git branch <new-branch> <commit>`, and to leave your branches as they are. It ends with "If the task needs it, say so when you report back."[^worktree-guard]

| Git Command | Status | What Is Refused |
| --- | --- | --- |
| `git for-each-repo` | <Undocumented />. Needs a server flag. | Every use. |
| `git worktree` | <Undocumented />. Needs a server flag. | Every verb except `add`, `list`, `lock`, `prune`, `remove`, and `unlock`. `git worktree add` works for a path under the worktree or in a scratch directory. |
| `git fast-import` | <Undocumented />. Needs a server flag. | Every use. Without the server flag, only `--allow-unsafe-features` is refused, and `git fast-import` works without it.[^worktree-optout] |
| `git filter-branch` | <Undocumented />. Needs a server flag. | A call with arguments. |
| `git filter-repo` | <Undocumented />. Needs a server flag. | Every option except `--analyze` and `--version`. |
| `git history` | <Undocumented />. Needs a server flag. | The verbs `drop`, `fixup`, `reword`, and `split`. |
| `git replay` | <Undocumented />. Needs a server flag. | A call with arguments. |
| `git update-ref` | <Undocumented />. Needs a server flag. | A change to a ref, except refs under `refs/bisect/`, `refs/rewritten/`, and `refs/worktree/`, and refs such as `HEAD`. |
| `git refs` | <Undocumented />. Needs a server flag. | Every verb except `exists`, `list`, `optimize`, and `verify`. |
| `git symbolic-ref` | <Undocumented />. Needs a server flag. | A form that changes a ref. |
| `git replace` | <Undocumented />. Needs a server flag. | Every form except `list`. |
| `git reflog` | <Undocumented />. Needs a server flag. | The verbs `delete`, `drop`, `expire`, and `write`. |

| `git bisect` | <Undocumented />. Needs a server flag. | `git bisect run`. Also `git bisect view` and `git bisect visualize` with a word that is not an option, and a first word that the shell can expand. `git bisect good` and `git bisect bad` still work: run the test yourself, then mark each commit. `git bisect view` still works with only `git log` options, such as `--oneline`.[^worktree-optout] |
| `git maintenance` | <Undocumented />. Needs a server flag. | `git maintenance register` and `git maintenance start`. Also a word after `git maintenance` that the shell can expand, as the program cannot tell which verb it is. `git gc` and `git maintenance run`, `stop`, `unregister`, and `is-needed` still work.[^worktree-optout] |
| `scalar` | <Undocumented />. Needs a server flag. | `scalar register`, `scalar clone`, `scalar reconfigure`, `scalar run all`, and `scalar run config`. `git gc` and `git maintenance run` still work, and so does `scalar run` with one task: `fetch`, `commit-graph`, `loose-objects`, or `pack-files`.[^worktree-optout] |
| `git checkout` and `git switch` | <Undocumented /> | The option `--ignore-other-worktrees`. Use a branch of its own: `git checkout -b <new-branch> <commit>` or `git switch -c <new-branch> <commit>`.[^worktree-optout] |
| `git worktree add` | <Undocumented /> | The option `--force`. Run it without the option, and add `-b <new-branch>` for a new branch. If git says that the path is registered but missing, run `git worktree prune` first.[^worktree-optout] |
| `git fetch` | <Undocumented /> | The option `--update-head-ok`. Fetch into a branch of its own.[^worktree-optout] |
| `git apply` | <Undocumented /> | The option `--unsafe-paths`. Use a patch whose paths stay inside the worktree.[^worktree-optout] |
| `git merge-index` | <Undocumented />. Needs a server flag. | Every call with arguments. Use `git merge-file` or `git merge`.[^worktree-optout] |
| `git config` | <Undocumented />. Needs a server flag. | `--edit`, `--remove-section`, and `--rename-section`. Also a set or an unset of a setting that is not on a short list of harmless settings, and of any setting in a file named with `--file`. Pass a setting for one command with `git -c`, or ask the person to set it.[^worktree-optout] |
| A git command that starts a program | <Undocumented />. Needs a server flag. | An option that names a program, such as `--upload-pack`, `--exec`, `--extcmd`, `--receive-pack`, `--httpd`, or the filter options of `git filter-branch`. Also `git remote-ext`, and a URL that starts with `ext::` or `fd::`. Run it without that option or remote.[^worktree-optout] |
| A git internal helper | <Undocumented /> | A name that looks like an internal helper, which is a git command with `--` in its name. Run the ordinary git command, add the missing space if `--` starts an option, or write a path as `./name`.[^worktree-optout] |

Without its flag, a command that needs one runs as before.[^worktree-guard]

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| `Failed to create iTerm2 split pane`, `Failed to send command to iTerm2 pane`, `Failed to send command to pane` | <Undocumented /> | Claude Code could not put a teammate in a terminal pane. | The `it2` split call or the `tmux respawn-pane` call returned an error. The text ends with the error output of that call. |
| `Failed to create swarm session`, `Failed to create swarm-view window` | <Undocumented /> | The tmux backend could not open the window for teammates. | With `teammateMode` `tmux`, a session that runs outside tmux puts its teammates in a separate tmux session. The text ends with the error output of `tmux new-session` (no such session yet) or `tmux new-window` (the session exists without its view window). The `Agent` tool result holds the text. Only an interactive session builds the team, so the probes use the terminal screen.[^swarm] |

## Related Pages

- [Subagents](index.md): where agent files live.
- [Subagent Frontmatter](frontmatter.md): the keys of an agent file.
- [Hook Events](../hooks/agent-events.md#agent-and-task-events): the agent and task events.
- [Environment Variables for Agents and Teams](../../configure/env-vars/agents-and-teams.md): the full variable list.
- [Agents and Tasks Tools](../../reference/tools/agents-and-tasks.md) for `Agent`.

## Sources

[^builtins]: The program, the agent definitions `general-purpose` (`chunk-hg1yqkjk.js:9021`), `Explore` (`chunk-hg1yqkjk.js:17264`), `Plan` (`chunk-hg1yqkjk.js:17345`), `claude-code-guide` (`chunk-hg1yqkjk.js:139747`), and `statusline-setup` (`chunk-hg1yqkjk.js:140123`), and the `Agent` tool schema with `subagent_type` (`chunk-2ry3tbza.js:1377`).
[^v307]: The program, `chunk-hg1yqkjk.js:137532` ("Fork started"), `chunk-hg1yqkjk.js:137532` ("This call started a fork, and that fork is you."), and `chunk-hg1yqkjk.js:137532` ("This is the parent's call, not yours.").
[^probes]: The program, `workflow-subagent` (`chunk-v4hzksrd.js:6`), `CLAUDE_CODE_WORKFLOW_SUBAGENT_MODEL` (`chunk-g3qk0r3n.js:8`), `CLAUDE_CODE_WEB_FETCH_AGENT` (`chunk-hg1yqkjk.js:108616`), and `chunk-gh3fdgea.js:14`, and [Probes](../../reference/probes.md#subagents-and-hooks).
[^resume]: The program, `chunk-f00gew3e.js:8523` (`model`, saved in the agent metadata only when the call has one, or when the gate `tengu_graceful_pudding` and the check `$a6b971` at `chunk-f00gew3e.js:8489` allow it) and `chunk-rjy0ddvf.js:2667` (`a36?.model`, read on resume).
[^resume-327]: The program, `a36?.model` at `chunk-rjy0ddvf.js:2667` for the saved model, which the resume reads only when the metadata holds one, and for the saved effort model. For a resume from a sibling, the check is `a64` at `chunk-rjy0ddvf.js:2013`. The program compares the id of the calling agent with the parent of the resumed agent, and skips the check for an observer. For a sibling, it clears the effort layers and the picked effort model of the call context, adds a model layer with the main-loop model of the main session, then runs the permission step (`a67`) at `chunk-rjy0ddvf.js:2029`. That step drops the allowed-tools and permission-mode layers of the sibling, keeps their modes as caps (`chunk-q9rzh92c.js:168` (`permission_mode_cap`)), and resets the permission mode to the session mode with `chunk-hg1yqkjk.js:68113` (`mode: a2`) unless the rank check at `chunk-t39fw2cy.js:6797` keeps it. The program shows no prompt or refusal text for this step.
[^model-wait]: The program, `chunk-hg1yqkjk.js:261536` for the waits (`1500` ms, or `1e4` ms when the session is a single-shot print session; the choice, `$3f2086()`, is at `chunk-hg1yqkjk.js:261555`) and `chunk-hg1yqkjk.js:261577` for the wait (the wait is on unless the gate `tengu_deep_shore` is off, and on timeout the run goes on without the settings). `chunk-f00gew3e.js:9194` (`$3148d6`) calls it from the subagent start.
[^depth]: The program, `chunk-j9a179b2.js:10` and `chunk-2ry3tbza.js:1625`.
[^refusals]: The program, the `Agent` tool: `chunk-2ry3tbza.js:1622` (`subagent_depth_cap`), `chunk-2ry3tbza.js:1630` (`subagent_spawner_stop_pending`), `chunk-2ry3tbza.js:1715` (`Agent type '...' not found`), `chunk-2ry3tbza.js:3509` (`subagent_concurrency_cap`, called at `chunk-2ry3tbza.js:1735`), and `chunk-2ry3tbza.js:1727` (`subagent_budget_exhausted`).
[^hook-cap]: The program, the agent hook runner, `chunk-hg1yqkjk.js:261880`.
[^max-turns]: The program, the agent loop, `chunk-hg1yqkjk.js:128598`.
[^teammate-mode]: The program, `chunk-t39fw2cy.js:9602` and `chunk-0wbf18qr.js:36`.
[^teammate-sh]: The program, `chunk-fp93ayjr.js:19` (`/bin/sh`, `-c`, and the bash or zsh path), `chunk-fp93ayjr.js:8` (`$4f78e5`, the characters that need no shell), `chunk-fp93ayjr.js:7` (the flag `bot_protected_tengu_sparkling_pike`), and `chunk-8s9dhbdm.js:243` (`respawn-pane`, with `default-shell` read at `chunk-8s9dhbdm.js:215`).
[^status-line]: The program, `chunk-t39fw2cy.js:8787` (the settings schema) and `chunk-mf7vnf0k.js:156` with `chunk-mf7vnf0k.js:156` (the warning).
[^safeguards]: The program, `chunk-f00gew3e.js:1007` (`Safeguards stopped this agent.`).
[^output-limit]: The program, `chunk-e9fhcxkx.js:255` (first text) and `chunk-e9fhcxkx.js:255` (second text).
[^swarm]: The program, `chunk-mjwpm8mh.js:6694` (`initializeSessionTeam`) and `chunk-8s9dhbdm.js:458`. Probe cases `pty.cli319.tmux-swarm-session` and `pty.cli319.tmux-swarm-window`, with a stand-in `tmux` whose `new-session` and `new-window` fail.
[^worktree-optout]: The program, `chunk-r7rff4m8.js:220` (`git for-each-repo`), `chunk-r7rff4m8.js:1554` (`git merge-index`), `chunk-r7rff4m8.js:1554` (`git bisect`), `chunk-r7rff4m8.js:1597` (`git maintenance`), `chunk-r7rff4m8.js:1597` (`--ignore-other-worktrees`), `chunk-r7rff4m8.js:1597` (`--update-head-ok`), `chunk-r7rff4m8.js:1616` (`git fast-import`, with `--allow-unsafe-features` at `chunk-r7rff4m8.js:1616`), `chunk-r7rff4m8.js:1616` (`--unsafe-paths`), and `chunk-r7rff4m8.js:1646` (`scalar`). The server flag `tengu_mellow_platypus` turns on the `git bisect` row, `tengu_buzzing_emerson` turns on the `git maintenance` and `scalar` rows, and `tengu_gentle_harbor` turns on the `git merge-index`, `git config`, and program rows (`chunk-r7rff4m8.js:814`, `chunk-r7rff4m8.js:814`, `chunk-r7rff4m8.js:814`). The other rows need none of these flags.

Official pages: [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents), [Environment Variables](https://code.claude.com/docs/en/env-vars), and [Hooks Reference](https://code.claude.com/docs/en/hooks).
[^worktree-guard]: The program, `chunk-hg1yqkjk.js:248360` and `chunk-r7rff4m8.js:388` (`Refusing to run it`) and `chunk-r7rff4m8.js:671` (`If the task needs it, say so when you report back.`). The program applies the check to an agent that has its own worktree and to a main session that runs in a worktree it created (`chunk-hg1yqkjk.js:248360`, `judgeBgWorktreeCommand`). The server flag `tengu_level_meadow` (`$2f32f9` at `chunk-r7rff4m8.js:350`, set at `chunk-r7rff4m8.js:194`) turns on the rows without a separate flag in the table.
[^fork-mode]: The program, `chunk-hg1yqkjk.js:137491` (the gate `tengu_federated_ullman` and the variable).
[^explore]: The program, `chunk-hg1yqkjk.js:17264` for the definition (`agentType: "Explore"`), whose `disallowedTools` names resolve at `chunk-fd03jnvq.js:7` (`Agent`), `chunk-e9fhcxkx.js:547` (the four Artifact tools), `chunk-z9wq6tma.js:5` (`ExitPlanMode`), and `chunk-5ghdkswv.js:373`, `chunk-5ghdkswv.js:374`, and `chunk-5ghdkswv.js:415` (`NotebookEdit`, `Edit`, `Write`), `chunk-hg1yqkjk.js:17278` for the model cap (`CLAUDE_CODE_DISABLE_EXPLORE_INHERIT_CAP`), `chunk-f00gew3e.js:8216` for the missing git status (`omitGitStatus`), and `chunk-hg1yqkjk.js:14054` for the environment variable (`CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS`).
