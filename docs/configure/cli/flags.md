---
title: All Flags
description: Every claude flag in 2.1.327, with the ones that claude --help hides, grouped by job.
sidebar_position: 2
---

A flag changes how one `claude` run behaves.
`claude --help` shows 66 flags. Another 70 work but stay hidden from the help text.
This page lists both kinds in one place, grouped by what they do.
One hidden flag has no row, because no code reads it: `--agents-view-if-allowed`. The program reads the hidden `--runner-declares`, so it has a row.[^no-row]

Pass a flag after `claude`, for example `claude --model opus`. Most flags last for one run only. A flag is on when you pass it. Some flags have a `--no-` twin, such as `--no-chrome`.

## How to Read the Tables

- <Documented /> means an official docs page names the flag, for example [CLI Reference](https://code.claude.com/docs/en/cli-reference). The column `In --help` says whether the help text shows it.
- <Undocumented /> means only the program has it. It can change or vanish in any release. Treat these flags as unstable.
- Hidden flags mostly serve the Agent SDK, the desktop app, IDE extensions, and teammate processes.

## Example

```bash
# One answer, JSON out, with a spend cap
claude -p "Summarize README.md" --output-format json --max-budget-usd 1

# A careful planning session on a chosen model
claude --model opus --effort high --permission-mode plan

# Stop after three agent turns
claude -p --max-turns 3 "Fix the failing test"
```

## Flags by Job

### Start and Print Mode

Flags that choose how a run starts and how print mode reads input and writes output.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `-p, --print` | <Documented /> | ✅ | Prints the answer and exits. This suits pipes. This mode skips the trust dialog. |
| `--output-format` `<format>` | <Documented /> | ✅ | Sets the output of print mode to `text`, `json`, or `stream-json`. `text` is the default. `json` gives one result object. `stream-json` gives one JSON object per line, live. |
| `--input-format` `<format>` | <Documented /> | ✅ | Sets the input of print mode to `text` or `stream-json`. `text` is the default. `stream-json` gives live input and control requests. |
| `--json-schema` `<schema>` | <Documented /> | ✅ | Checks the final answer against a JSON Schema. It works only with `--print`. Pass the schema as a JSON string. |
| `--include-hook-events` | <Documented /> | ✅ | Adds the hook events to the stream, with `--output-format=stream-json`. |
| `--include-partial-messages` | <Documented /> | ✅ | Adds partial message chunks to the stream, with `--print` and `stream-json`. Adds `stream_event` lines. |
| `--forward-subagent-text` | <Documented /> | ✅ | Adds the text of subagents to the stream as `assistant` and `user` messages, with `--print` and `stream-json`. Messages carry `parent_tool_use_id`. |
| `--replay-user-messages` | <Documented /> | ✅ | Sends the user messages from stdin back on stdout as an acknowledgment. Needs both `stream-json` formats. |
| `--max-budget-usd` `<amount>` | <Documented /> | ✅ | Stops at a spend limit in dollars, with `--print` only. |
| `--max-turns` `<turns>` | <Documented /> | ❌ | Stops after a number of agent turns, with `--print` only. |
| `--no-session-persistence` | <Documented /> | ✅ | Saves nothing to disk, so the session cannot be resumed, with `--print` only. |
| `--prompt-suggestions` `[value]` | <Documented /> | ✅ | Turns on prompt suggestions. Print mode sends a `prompt_suggestion` message after each turn. |
| `--init` | <Documented /> | ❌ | Runs `Setup` hooks with the `init` trigger and then goes on. |
| `--init-only` | <Documented /> | ❌ | Runs `Setup` and `SessionStart:startup` hooks and then exits. |
| `--maintenance` | <Documented /> | ❌ | Runs `Setup` hooks with the `maintenance` trigger and then goes on. |
| `--session-mirror` | <Undocumented /> | ❌ | Writes `transcript_mirror` frames to stdout, for the SDK. |
| `--await-claim` | <Undocumented /> | ❌ | Starts as a spare process for an SDK host and waits for a `claim_session` request. |
| `--await-initialize` | <Undocumented /> | ❌ | Reads the `initialize` request from stdin at startup so its fields apply like flags. |
| `--sdk-url` `<url>` | <Undocumented /> | ❌ | Uses a WebSocket endpoint for SDK input and output, with `-p` and `stream-json`. |
| `--enable-auth-status` | <Undocumented /> | ❌ | Turns on auth status messages in SDK mode. |
| `--workload` `<tag>` | <Undocumented /> | ❌ | Sets a workload tag for the attribution block, with `--print` only. |
| `--client-data-url <url>` | <Undocumented /> | ❌ | Loads a signed configuration document from a URL and exits if it fails. |
| `--allow-other-models` | <Undocumented /> | ❌ | With `--client-data-url`, starts on a model that the document does not list. |
| `--managed-settings` `<json>` | <Undocumented /> | ❌ | Gives policy settings as JSON from a parent process, for the SDK. |
| `--managed-settings-in-initialize` | <Undocumented /> | ❌ | Reads the policy settings from the `managedSettings` field of the `initialize` request, not from `--managed-settings`. It exits if the settings cannot be used. For SDK use only; it needs `--await-initialize`.[^managed-init] |
| `--initialize-fields` `<names>` | <Undocumented /> | ❌ | Reads the named fields of the `initialize` request in place of their flags. The names go in a comma list. `settings` stands for `--settings`, and `disallowedTools` for `--disallowedTools`. It exits if a field cannot be used. For SDK use only. It needs `--await-initialize`, `--input-format=stream-json` with stdin piped, and no `--sdk-url` or subcommand. A name that the program does not know is an error, and so is a name whose flag you also pass.[^initialize-fields] Added in `2.1.327`. |
| `--runner-declares` `<names>` | <Undocumented /> | ❌ | Tells a session what its self-hosted runner can do. The runner passes it as `--runner-declares=<names>` with names such as `diff-finds-nested-repository`, `no-repository-checked-out`, `built-in-gh`, and `built-in-gh-by-default`. An older child program stops with `unknown option`. The first time the list holds `diff-finds-nested-repository`, the flag writes a notice to stderr.[^runner-declares] |
| `--host-auth-is-org-sign-in` | <Undocumented /> | ❌ | Says that the token of the host is an organization sign-in, for desktop hosts. |

### Safe Modes, Settings, and Debug

Flags that strip your setup down, load extra settings, or turn on logs.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `-h, --help` | <Documented /> | ✅ | Shows the help text and exits. |
| `-v, --version` | <Documented /> | ✅ | Prints the version number. |
| `-d`, `--debug` `[filter]` | <Documented /> | ✅ | Turns on debug logs. An optional filter picks the categories, such as `--debug=hooks,mcp` or `--debug='!hooks,!mcp'`. |
| `-d2e`, `--debug-to-stderr` | <Undocumented /> | ❌ | Turns on debug mode and writes to stderr. The flag is deprecated. |
| `--debug-file` `<path>` | <Documented /> | ✅ | Writes the debug logs to a file and turns on debug mode. |
| `--verbose` | <Documented /> | ✅ | Overrides the verbose setting of your config. |
| `--bare` | <Documented /> | ✅ | Starts with a minimal setup that has no hooks, no plugin sync, no auto memory, and no background work. It skips hooks, LSP, plugin sync, attribution, auto memory, background prefetches, keychain reads, and `CLAUDE.md` discovery. |
| `--safe-mode` | <Documented /> | ✅ | Starts with all customizations off, such as `CLAUDE.md`, skills, plugins, hooks, and MCP servers. |
| `--restricted` | <Documented /> | ✅ | Removes the tools that run code and `WebFetch`. Also ignores user, project, and local settings. It suits untrusted input. |
| `--ignore-persisted-trust` | <Undocumented /> | ❌ | No saved workspace trust record counts in this process. `CLAUDE_CODE_IGNORE_PERSISTED_TRUST` does the same. It has no help text.[^persisted-trust] |
| `--ax-screen-reader` | <Documented /> | ✅ | Draws flat text with no borders or animations, for screen readers. |
| `--settings` `<file-or-json>` | <Documented /> | ✅ | Loads more settings from a JSON file or a JSON string. |
| `--setting-sources` `<sources>` | <Documented /> | ✅ | Chooses which setting sources load: `user`, `project`, and `local`. A source that you leave out supplies no auto-mode rules. Managed settings and `--settings` stay.[^setting-sources] |
| `--project-config-root` `<dir>` | <Undocumented /> | ❌ | Reads project settings and the `.claude` trees from another folder. |

### Permissions and Tools

Flags that set the permission mode and the tools the model may use. See [Permissions](../permissions/index.md).

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--permission-mode` `<mode>` | <Documented /> | ✅ | Sets the permission mode of the session. |
| `--inherit-permission-mode` `<mode>` | <Undocumented /> | ❌ | Sets a permission mode from a parent session, used only when nothing else sets one. |
| `--dangerously-skip-permissions` | <Documented /> <Caution note="Skips all permission checks" /> | ✅ | Skips all permission checks. Use it only in a sandbox with no internet access. |
| `--allow-dangerously-skip-permissions` | <Documented /> | ✅ | Makes skipping all permission checks a choice, without turning it on. |
| `--allowedTools`, `--allowed-tools` `<tools...>` | <Documented /> | ✅ | Lists the tools that run without a permission prompt. Since `2.1.326`, a rule that looks incomplete, such as one with a missing `)`, prints a warning that names the first bad rule and how many more the list holds.[^allowed-warn] |
| `--disallowedTools`, `--disallowed-tools` `<tools...>` | <Documented /> | ✅ | Lists the tools that the model cannot use. Since `2.1.326`, an incomplete rule prints the same kind of warning, and says that a tool you meant to block may still run.[^disallowed-warn] |
| `--tools` `<tools...>` | <Documented /> | ✅ | Lists the built-in tools that the model can use. `"default"` uses the default set. Since `2.1.326`, a name that does not look like a tool name, such as one with parentheses, prints a warning.[^tools-warn] |
| `--permission-prompts` `<target>` | <Documented /> | ✅ | Sets who answers permission prompts: `host` or `none`. `host` means the SDK host or `--permission-prompt-tool`. `none` denies anything that would prompt. The permission mode decides the rest. |
| `--permission-prompt-tool <tool>` | <Documented /> | ❌ | Names an MCP tool that answers permission prompts, with `--print` only. |
| `--plan-mode-instructions` `<instructions>` | <Undocumented /> | ❌ | Replaces the default steps of plan mode with your own text. |
| `--enable-auto-mode` | <Undocumented /> <Deprecated note="The help text says deprecated" /> | ❌ | Opts in to auto mode. The flag is deprecated. |

### Model and Thinking

Flags that pick the model and set how hard it thinks.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--model` `<model>` | <Documented /> | ✅ | Sets the model with an alias such as `opus` or with a full name. |
| `--effort` `<level>` | <Documented /> | ✅ | Sets the effort level of the session. |
| `--fallback-model` `<model>` | <Documented /> | ✅ | Sets one or more models to try when the main model is overloaded or unavailable. |
| `--betas` `<betas...>` | <Documented /> | ✅ | Adds beta headers to API requests, for API key users only. |
| `--advisor` `<model>` | <Documented /> | ❌ | Turns on the server-side advisor tool with the model that you name. |
| `--thinking <mode>` | <Undocumented /> | ❌ | Sets the thinking mode: `enabled` (the same as `adaptive`) or `disabled`. |
| `--thinking-display` `<display>` | <Undocumented /> | ❌ | Sets how the thinking text appears in the response. |
| `--max-thinking-tokens` `<tokens>` | <Undocumented /> <Deprecated note="Use --thinking" /> | ❌ | Sets a thinking token limit. The flag is deprecated. Use `--thinking` instead. |
| `--task-budget` `<tokens>` | <Undocumented /> | ❌ | Sets a task budget in tokens on the API side (`output_config.task_budget`). |
| `--fast-mode` `<on\|off>` | <Undocumented /> | ❌ | Turns fast mode on or off. It sets `fastMode` in the flag settings of the session, so it also works on Vertex.[^fast-vertex] See [Fast Mode](../models-and-providers/fast-mode.md#controls). |
| `--include-unsupported-models` | <Undocumented /> | ❌ | Offers models that your account can use and this version does not know. |
| `--autocompact` `<auto\|tokens>` | <Documented /> | ✅ | Sets the auto-compact window to `auto` or to a number of tokens. Since `2.1.327` the number must be at least 100k, with no upper limit in the help text.[^autocompact] |

### System Prompt

Flags that replace or extend the system prompt. See [System Prompt](../../how-it-works/system-prompt.md).

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--system-prompt` `<prompt>` | <Documented /> | ✅ | Replaces the system prompt for the session. |
| `--system-prompt-file` `<file>` | <Documented /> | ❌ | Reads the system prompt from a file. |
| `--append-system-prompt` `<prompt>` | <Documented /> | ✅ | Adds text to the end of the default system prompt. |
| `--append-system-prompt-file` `<file>` | <Documented /> | ❌ | Reads text from a file and adds it to the end of the default system prompt. |
| `--append-subagent-system-prompt` `<prompt>` | <Documented /> | ❌ | Adds text to the system prompt of every subagent, with `--print` only. |
| `--append-subagent-system-prompt-file` `<file>` | <Documented /> | ❌ | Reads text from a file and adds it to every subagent prompt, with `--print` only. |
| `--system-prompt-snapshot` `<on\|off>` | <Documented /> | ✅ | Sets whether Claude Code records the system prompt once and reuses it on every request and resume. |
| `--exclude-dynamic-system-prompt-sections` | <Documented /> | ✅ | Moves the data of the machine from the system prompt to the first user message for better cache reuse. |

### Sessions and Worktrees

Flags that continue, fork, name, or rewind a session, or run it in a worktree or the background. See [Sessions and Storage](../../how-it-works/sessions-and-storage.md).

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `-c, --continue` | <Documented /> | ✅ | Continues the newest conversation of the current folder. |
| `-r, --resume [value]` | <Documented /> | ✅ | Resumes a conversation by session ID or name, or opens the picker. |
| `--fork-session` | <Documented /> | ✅ | Creates a new session ID when you resume, with `--resume` or `--continue`. |
| `--from-pr` `[value]` | <Documented /> | ✅ | Resumes a session that links to a pull request. |
| `--session-id` `<uuid>` | <Documented /> | ✅ | Uses a UUID that you give as the session ID. |
| `-n`, `--name` `<name>` | <Documented /> | ✅ | Sets the display name of the session. |
| `--resume-session-at` `<message id>` | <Undocumented /> | ❌ | Resumes only up to one message of the chain, with `--resume` in print mode. |
| `--resume-drops-turn` `<message id>` | <Undocumented /> | ❌ | Names the turn that a truncating resume drops. The resume fails if more would go. |
| `--reply-on-resume` | <Undocumented /> | ❌ | Asks the model to reply at once when the transcript ends with a user message. |
| `--session-began-as-copy` `<value>` | <Undocumented /> | ❌ | Hidden. A server sends it. The value `1` marks a session that began as a copy of another. Then `--resume` in print mode does not continue the last turn of the session it was copied from, and does not run a tool call that a hook deferred there. Any other value is ignored. It means the same as `CLAUDE_CODE_SESSION_BEGAN_AS_COPY=1`, and either one is enough.[^copy-flag] |
| `--rewind-files` `<user-message-id>` | <Undocumented /> | ❌ | Restores the files to the state at a user message and exits. It needs `--resume`. Since `2.1.326`, it prints `Warning: N tracked paths were skipped: <reason>. Run with --debug for the paths.` when it leaves files untouched.[^rewind-skip] |
| `--bg`, `--background` | <Documented /> | ✅ | Starts the session in the background and prints its ID. |
| `-w, --worktree [name]` | <Documented /> | ✅ | Creates a new git worktree for the session. Since `2.1.327`, a relative `--add-dir` beside the launch folder gives the Bash sandbox that folder, not the one beside the worktree. A relative `--add-dir` above the launch folder, such as `..`, gives the Bash sandbox and a `--bg` session only the worktree, in some starts.[^worktree-add-dir] When you keep the worktree at exit, the exit dialog shows `Worktree kept. Your work is saved at <path>`. Since `2.1.327`, Claude Code also writes that message to standard error as it exits.[^worktree-kept] |
| `--tmux` | <Documented /> | ✅ | Creates a tmux session for the worktree. It needs `--worktree`. |

### Agents, Plugins, MCP, and Context

Flags that add agents, plugins, MCP servers, folders, and files.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--agent` `<agent>` | <Documented /> | ✅ | Sets the agent of the session and overrides the `agent` setting. |
| `--agents` `<json-or-file>` | <Documented /> | ✅ | Defines custom agents with JSON or a file. |
| `--mcp-config <configs...>` | <Documented /> | ✅ | Loads MCP servers from JSON files or strings. |
| `--strict-mcp-config` | <Documented /> | ✅ | Uses only the MCP servers from `--mcp-config`. |
| `--plugin-dir <path>` | <Documented /> | ✅ | Loads a plugin from a folder or a `.zip` file for this session only. |
| `--plugin-url` `<url>` | <Documented /> | ✅ | Fetches a plugin `.zip` file from a URL for this session only. |
| `--plugin-dir-no-mcp` `<path>` | <Undocumented /> | ❌ | Works like `--plugin-dir` but does not read the `.mcp.json` of the plugin. |
| `--disable-slash-commands` | <Documented /> | ✅ | Turns off all skills and commands. |
| `--add-dir` `<directories...>` | <Documented /> | ✅ | Gives the tools access to more folders. Since `2.1.326`, in a local terminal session, `--add-dir` and `/add-dir` show the trust prompt for a folder you have not trusted yet. `claude --bg` refuses such a folder and exits with `Added folder not trusted: <path>`.[^add-dir-trust] |
| `--brief` | <Undocumented /> | ✅ | Turns on the `SendUserMessage` tool so the agent can message the user. |
| `--file` `<specs...>` | <Undocumented /> | ✅ | Downloads file resources at startup, in the form `file_id:relative_path`. |
| `--channels` `<servers...>` | <Documented /> | ❌ | Lists the MCP servers whose channel notifications may register this session. |
| `--dangerously-load-development-channels` `<servers...>` | <Documented /> <Caution /> | ❌ | Loads channel servers that are not on the allowlist, for local development only. |
| `--watch-artifact` `<artifact>` | <Undocumented /> | ❌ | Watches a Claude artifact for new versions and comments. |
| `--watch-artifact-no-autoreact` `<artifact>` | <Undocumented /> | ❌ | Watches an artifact and does not react to it by itself. |
| `--messaging-socket-path` `<path>` | <Undocumented /> | ❌ | Sets the socket or pipe path of the cross-session messaging server. |
| `--proactivity` `<level>` | <Undocumented /> | ❌ | Sets the level of proactivity. `--help` gives no text for it. |

### Teammate Flags

Flags that a lead agent passes to a teammate process it starts. You rarely set them by hand.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--agent-id` `<id>` | <Undocumented /> | ❌ | Sets the ID of a teammate agent. |
| `--agent-name` `<name>` | <Undocumented /> | ❌ | Sets the display name of a teammate. |
| `--team-name` `<name>` | <Undocumented /> | ❌ | Sets the team name for teammate coordination. |
| `--agent-color` `<color>` | <Undocumented /> | ❌ | Sets the UI color of a teammate. |
| `--plan-mode-required` | <Undocumented /> | ❌ | Requires plan mode before the teammate implements anything. |
| `--teammate-mode` `<mode>` | <Documented /> | ❌ | Sets the mode of a teammate. `--help` gives no text for it. |
| `--lead-verify-key` `<time.key>` | <Undocumented /> | ❌ | Gives a teammate the public key that checks the messages of its team lead. The lead passes it when it starts the teammate.[^lead-key] |
| `--agent-type` `<type>` | <Undocumented /> | ❌ | Sets a custom agent type for a teammate. |
| `--parent-session-id` `<id>` | <Undocumented /> | ❌ | Gives the parent session ID for analytics. |

### IDE, Desktop, and Deep Links

Flags that connect to an IDE, the desktop app, or a deep link.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--ide` | <Documented /> | ✅ | Connects to the IDE at startup when exactly one valid IDE is open. |
| `--desktop` | <Documented /> | ✅ | Opens the session in the Claude Desktop app instead of the terminal. |
| `--chrome` | <Documented /> | ✅ | Turns on the Claude in Chrome integration. If the first-run setup cannot connect, Claude Code tells you to restart with `claude --chrome --resume`, not to run `/chrome`.[^chrome-restart] Since `2.1.327`, the integration also refuses to upload files that secret stores use, such as `deploy_key`, `credentials.json`, `.vault-token`, `.dockercfg`, `.dev.vars`, `gh/hosts.yml`, and `gcloud/credentials.db`. This check is on by default, and the server can turn it off. The refusal reads `Cannot upload "<path>": its name or folder is one that credentials are kept under (such as .env, a .pem or .key file, or .ssh), so it is not uploaded on Claude's word alone. Tell the user it was not uploaded.`[^chrome-credentials] |
| `--no-chrome` | <Documented /> | ✅ | Turns off the Claude in Chrome integration. |
| `--prefill` `<text>` | <Undocumented /> | ❌ | Fills the prompt box with text and does not send it. |
| `--prefill-b64` `<b64>` | <Undocumented /> | ❌ | Fills the prompt box with base64url text, for deep links. |
| `--deep-link-origin` | <Undocumented /> | ❌ | Says that a deep link started this session. |
| `--deep-link-repo` `<slug>` | <Undocumented /> | ❌ | Gives the repo slug that the deep link resolved to the current folder. |
| `--deep-link-last-fetch` `<ms>` | <Undocumented /> | ❌ | Gives the time of the last fetch of the repo, in milliseconds. |
| `--deep-link-cwd-b64` `<b64>` | <Undocumented /> | ❌ | Gives the working folder as base64url text, for deep links. |

### Cloud and Remote Sessions

Flags for cloud sessions and Remote Control.

| Flag | Status | In `--help` | What it does |
| --- | --- | --- | --- |
| `--teleport [session]` | <Documented /> | ✅ | Resumes a teleport session. |
| `--cloud [description\|session_id\|url]` | <Documented /> | ✅ | Creates a cloud session, or attaches to one by session ID or `claude.ai/code` URL. Since `2.1.327`, when the connection to the session drops and comes back, and the catch-up cannot load part of the earlier messages, the transcript shows the warning `Some earlier messages from this session couldn't be loaded after reconnecting.`[^catch-up] |
| `--environment <environment_id>` | <Documented /> | ✅ | Creates a cloud session on a self-hosted environment. |
| `--remote-control [name]` | <Documented /> | ✅ | Starts an interactive session with Remote Control turned on. |
| `--rc` `[name]` | <Documented /> | ❌ | Is an alias for `--remote-control`. |
| `--remote-control-session-name-prefix` `<prefix>` | <Documented /> | ✅ | Sets the prefix of the names that Remote Control makes. The default is the host name. |
| `--remote` `[description\|session_id\|url]` | <Documented /> <Deprecated note="Use --cloud" /> | ❌ | Is a deprecated alias for `--cloud`. |
| `--pool` `<pool_id>` | <Undocumented /> <Deprecated note="Use --environment" /> | ❌ | Is a deprecated alias for `--environment`. |
| `--correlation-id` `<id>` | <Undocumented /> | ❌ | Sets an ID that goes back to the environment orchestrator. It needs `--environment`. |
| `--ref` `<ref>` | <Documented /> | ❌ | Sets the branch, tag, or SHA to check out in the remote session. It needs `--cloud` or `--environment`. |
| `--on-branch` `<branch>` | <Undocumented /> | ❌ | Works directly on a branch in the remote session, with checkout and push. |
| `--forward-home-settings` `<true\|false>` | <Undocumented /> | ❌ | Sets whether this machine sends its settings to the cloud session. |
| `--attach-serve` `<session_id>` | <Undocumented /> | ❌ | Attaches a helper to a cloud session. The desktop app starts it. Since `2.1.327`, the helper emits a warning with the text `Some earlier messages from this session could not be loaded after reconnecting.` when the catch-up cannot load part of the earlier messages.[^catch-up] |

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | Deep links. Claude Code refused a deep link. | The `cwd` is not an absolute path. The `cwd` holds `..`, control characters, or a network path. The plugin or marketplace value is not valid. The scheme or action is unknown. The launch command cannot be quoted safely. |
| Various | <Undocumented /> | Flag values. Claude Code refused a command-line flag value or combination. | A flag needs another flag. For example, `--resume-session-at` needs `--resume`. A flag cannot be combined with a prompt. A flag needs a value in a range. `claude auth login --gateway-json` is used with `--console`, `--claudeai`, `--sso`, or `--email` (`--gateway-json can't be used with --console, --claudeai, --sso, or --email.`). The socket path of `--messaging-socket-path` is not a private local socket. A cloud session host (`ccr-session` or `ccr-gateway`) needs `--sdk-url` and checks its host, with `ccr-session host requires --sdk-url` or `ccr-session --sdk-url rejected: ...`.[^ccr-host] A settings file in an `--add-dir` folder names another host (`an --add-dir settings file names another host`). |
| `Error: auto mode could not check some actions Claude tried` | <Undocumented /> | A `-p` run in auto mode stopped with exit code 1. | The server check for an action was not available, so the actions did not run. Use another permission mode. Claude Code prints this text.[^auto-refused] |
| Various | <Undocumented /> | Claude in Chrome. The Claude in Chrome connection failed. | The bridge is not connected. No extension connected. The browser is not paired. The socket directory or socket has the wrong owner or permissions. Claude Code could not find the browser helper. A targeted browser or tab did not take the message. Only the paired browser may answer. The socket closed before a reply came. With a subscription token, the debug file says `[Claude in Chrome] Disabled: OAuth token has no scope accepted by /api/oauth/validate (needs user:profile, user:office, or user:ccr_inference; env-var and setup-token sessions default to user:inference only)`, and no Chrome tool is listed.[^chrome-live] Paired-extension messages are a hard limit: they need a browser extension and a login with those scopes. With `--chrome` and a fake login, Claude Code prints no Chrome line and gives no Chrome tool.[^chrome-fake] |

## Related Pages

- [CLI Overview](index.md)
- [Subcommands](subcommands.md)
- [Environment Variables](../env-vars/index.md) for variables that match many flags.
- [Permission Modes](../permissions/modes.md) for the values of `--permission-mode`.

## Sources

[^no-row]: The program. `--agents-view-if-allowed` is defined at `chunk-rnt5hbrt.js:3299` with no description. The only other places that name it are two lists of flag names, `chunk-avas472e.js:269` and `chunk-t8fs63s8.js:62`. No code reads its value. `--runner-declares` is defined at `chunk-rnt5hbrt.js:3393`, and the runner builds it at `chunk-zaa2qn9h.js:5-11`.
[^managed-init]: The program, `chunk-rnt5hbrt.js:962-993` (the error text), `chunk-rnt5hbrt.js:1036` (the check), and `chunk-ttb87w11.js:416-420` (the field check).
[^initialize-fields]: The program, `chunk-rnt5hbrt.js:3409` (the flag), `chunk-rnt5hbrt.js:1007-1066` (the checks), and `chunk-ttb87w11.js:432-444` (the field rules). `settings` must be a JSON object, and `disallowedTools` a list of strings. The settings apply like `--settings`, before any settings are read, and the program exits with code `1` if they cannot (`chunk-rnt5hbrt.js:1063-1066`).
[^runner-declares]: The program, `chunk-rnt5hbrt.js:72880`, `chunk-zaa2qn9h.js:361`, and `chunk-xa2mcav9.js:331875`.
[^autocompact]: The program, `chunk-rnt5hbrt.js:70098`: "Auto-compact window size (auto, or at least 100k tokens)".
[^persisted-trust]: The program, `chunk-bpr7n093.js:32875` and `chunk-asj6f58y.js:94695`. The program reads the flag from the arguments.
[^setting-sources]: The program, `chunk-rnt5hbrt.js:67323`. The program text lists `user`, `project`, and `local`. The earlier cites `chunk-271f7twe.js:5474` and `chunk-bpr7n093.js:123762` are not checked in `2.1.327`.
[^allowed-warn]: The program, `chunk-61wd57dm.js:79507`, `chunk-61wd57dm.js:79672`, and `chunk-61wd57dm.js:80222`.
[^disallowed-warn]: The program, `chunk-61wd57dm.js:79507`, `chunk-61wd57dm.js:79672`, and `chunk-61wd57dm.js:80222`.
[^tools-warn]: The program, `chunk-61wd57dm.js:80268`.
[^fast-vertex]: Probe case `print.cli322.fast-vertex-flag`.
[^copy-flag]: The program, `chunk-rnt5hbrt.js:73054` and `chunk-rnt5hbrt.js:73367`.
[^lead-key]: The program, `chunk-rnt5hbrt.js:3364-3369` (the flag), `chunk-a41wjpwd.js:1042` and `chunk-a41wjpwd.js:1215` (the lead passes it), and `chunk-61wd57dm.js:6170-6171` (the teammate reads it).
[^chrome-restart]: The program, `chunk-cfxefa64.js:1453268` and `chunk-3z330av7.js:42177`.
[^ccr-host]: The program, `chunk-asj6f58y.js:968638-968912`; the `--gateway-json` check is `chunk-jhpfacch.js:26509`.
[^auto-refused]: Probe case `print.err319.auto-mode-print-refused`.
[^chrome-live]: Live run, case `live.err319`, with `--chrome` and a subscription token.
[^chrome-fake]: Probe case `print.err319.chrome-no-extension`.
[^add-dir-trust]: The program, `chunk-dfq3y18g.js:47920`. The trust prompt in a local terminal session is from the [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^rewind-skip]: The program, `chunk-rap1tzf6.js:36219-36499`. The reasons are in `chunk-ytkczbf2.js:3217`.
[^worktree-add-dir]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-m14bt1pz.js:72801-72811` (pins each relative `--add-dir` to the launch folder), `chunk-m14bt1pz.js:72843-72859` (the path rule), and `chunk-q22ttn58.js:1150` (the call after the worktree is made). The code runs only when the flag `tengu_rosy_fog` is on (`chunk-m14bt1pz.js:72802-72803`). The release notes name the Bash sandbox; the code shows only the `--add-dir` folders.
[^catch-up]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327). The program, `chunk-cfxefa64.js:20780-20785` (the terminal view of a cloud session shows the warning), `chunk-pem2txbt.js:4383` and `chunk-3v0n1mqa.js:1172` (the `--cloud` start and the attach path give the view its session settings), and `chunk-9cym6ykn.js:5951-5961` (the `--attach-serve` helper).
[^worktree-kept]: The program, `chunk-cfxefa64.js:1872824` (the keep choice and its message), `chunk-cfxefa64.js:1881293` (the exit passes the message on as `finalMessage`), and `chunk-m14bt1pz.js:361511` (the exit writes `finalMessage` to file descriptor 2). In the `2.1.326` program, the exit does not pass the message on. [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
[^chrome-credentials]: The program, `chunk-06cjxaee.js:5768` (the refusal text), `chunk-06cjxaee.js:1799` (the credential error that selects it), `chunk-06cjxaee.js:12308` (the upload check passes `secretStores`), `chunk-9xdap7q0.js:10653` (the `secretStores` check), `chunk-9xdap7q0.js:9106` and `chunk-9xdap7q0.js:9902` (the names and folders), and `chunk-06cjxaee.js:21032` with `chunk-xtnx5j0p.js:288` and `chunk-hfh6zg31.js:190` (the default comes from the flag `tengu_squishy_magpie`, which is on unless the server turns it off). The `2.1.326` program has no `secretStores` option. [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
