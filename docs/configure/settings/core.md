---
title: Core Settings
description: Keys for compaction, memory, cleanup, shell commands, files, the env block, the sandbox, and updates.
sidebar_position: 2
---

These keys control how Claude Code compacts the conversation, remembers things, cleans up old files, and runs shell commands. Most people change only a few of them, such as `language` or `cleanupPeriodDays`. Set a key in a settings file to change its default. Boolean keys such as `autoMemoryEnabled` and `autoCompactEnabled` switch a feature on or off. The `env` and `sandbox` keys are objects that have their own pages elsewhere.

## Example

### Keep Transcripts for a Week

This file deletes transcripts after 7 days. It keeps auto memory on. It lets Claude see more shell output inline. It asks for answers in German.

```json title="~/.claude/settings.json"
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "cleanupPeriodDays": 7,
  "autoMemoryEnabled": true,
  "bashOutputMaxChars": 50000,
  "language": "german"
}
```

## Keys

Official page: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, the facts come from the settings schema.[^schema] Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `$schema` | <Documented /> | string | - | Point your editor at the published JSON schema for autocomplete and checks. Use `https://clawdipedia.cc/schemas/claude-code-settings.json`, which is the `$id` of the schema. | Settings files |
| `attribution` | <Documented /> | boolean or object | Standard attribution | Customize the attribution Claude Code adds to commits and pull requests. `false` hides all attribution. | Any settings file |
| `attribution.commit` | <Documented /> | string | Standard attribution | Attribution text for git commits, including any trailers. An empty string hides it. | Any settings file |
| `attribution.pr` | <Documented /> | string | Standard attribution | Attribution text for pull request descriptions. An empty string hides it. | Any settings file |
| `autoCompactEnabled` | <Documented /> | boolean | - | Turn automatic compaction off or on. | Any settings file |
| `autoCompactWindow` | <Documented /> | number or `"auto"` | - | Set how full the context gets before Claude Code compacts. A number of at least `100000` tokens, or `"auto"` for the window tuned for the model. Since `2.1.327` there is no upper limit.[^compact-window] | Any settings file |
| `autoCompactOfferAnswer` | <Undocumented /> | object: `model`, `choice`, `tokens`, `at` | - | The Claude Desktop Code tab sets this key. Claude Code reads it from the flag settings only. It records your answer to the app's offer of a lower auto-compact window. `model` is the model name, 1 to 200 characters. `choice` is `accept`, `keep`, or `undo`. `tokens` is the window you chose or kept, a positive whole number. `at` is when you answered, in epoch milliseconds. All four fields are required.[^compact-offer] | Flag settings only |
| `autoCompactRaisedForLoad` | <Undocumented /> | boolean | - | The Claude Desktop Code tab sets this key. Claude Code reads it from the flag settings only. `true` lets a conversation compact at twice what each request still holds after a summary (system prompt, tools, and instruction files), when that is above the auto-compact threshold.[^compact-offer] | Flag settings only |
| `autoDreamEnabled` | <Undocumented /> | boolean | - | Turn background memory consolidation (auto-dream) on or off. A value here overrides the server-side default. | Settings files |
| `autoMemoryDirectory` | <Documented /> | string | `~/.claude/projects` | Store auto memory in a directory you choose. `~/` expands to your home directory. Claude Code ignores the key in the checked-in project file. | Any settings file |
| `autoMemoryEnabled` | <Documented /> | boolean | - | Turn auto memory off or on. | Any settings file |
| `autoUpdatesChannel` | <Documented /> | enum: `latest`, `stable`, `rc` | `latest` | Follow the stable release channel instead of latest. | Any settings file |
| `awaySummaryEnabled` | <Documented /> | boolean | - | Turn off the session recap shown when you come back to the terminal. The recap shows after 5 or more minutes away. Claude Code skips the automatic recap when the prompt holds a draft, when you are at or near a rate limit, or when the prompt cache is too old. Since `2.1.326`, it also skips the recap when the last reply was billed to usage credits. `/recap` shows a recap in each of these cases.[^away-skip] | Any settings file |
| `bashEditDiffEnabled` | <Documented /> | boolean | Off. In `auto` and `bypassPermissions` modes it is on when the Bash tool handles file edits or the model configuration turns it on[^bash-diff] | Record the files that changed while a Bash command ran. `false` turns it off in every mode. `true` turns it on in every mode. Outside `auto` and `bypassPermissions` modes, only user, flag, or policy settings can turn it on. Version `2.1.314` described the default as on when the Bash tool handles file edits. `CLAUDE_CODE_BASH_EDIT_DIFF` wins over this key. | User or managed settings |
| `bashOutputMaxChars` | <Documented /> | integer | `30000` | Set how much of a successful command's output Claude receives inline. Claude Code clamps it to `4000`-`128000`. Longer output goes to a file, and Claude gets a preview and the path. `BASH_MAX_OUTPUT_LENGTH` sets only the read-back window, and this key replaces it when set. | Any settings file |
| `claudeMd` | <Documented /> <ManagedOnly /> | string | - | Inject organization-wide CLAUDE.md instructions from managed settings. Only managed settings honor it. | Managed settings only |
| `claudeMdExcludes` | <Documented /> | array of string | - | Skip specific CLAUDE.md files when memory loads. Takes glob patterns or absolute paths. Managed files cannot be excluded. Since `2.1.327`, a pattern on Windows also matches a path whose drive letter is in the other case.[^excludes-327] | Any settings file |
| `cleanupPeriodDays` | <Documented /> | integer | 30 | Choose how many days Claude Code keeps transcripts before deleting them. The minimum is `1`.[^cleanup-min] `--no-session-persistence` turns off transcript writes. Cleanup deletes data only on this computer, not anything that Anthropic stores.[^cleanup-local] The sweep starts 5 seconds after launch. A transcript 40 days old is removed with `7` and with the default, and kept with `365`. `0` does not load: the debug log says `cleanupPeriodDays: Number must be greater than or equal to 0`. `1.5` is skipped with `Expected int`.[^cleanup-runs] Since `2.1.323`, a folder or file that the sweep cannot read counts as an error, unless it is missing (`ENOENT`, `ENOTDIR`). The debug log then says `cleanup could not examine <path>: <code>`.[^cleanup-error] | Any settings file |
| `defaultShell` | <Documented /> | enum: `bash`, `powershell` | `bash` | Choose whether Bash or PowerShell runs the shell commands you type with the `!` prefix. | Any settings file |
| `desktopSessionCleanupPeriodDays` | <Documented /> | integer | - | Set an age limit in days for Claude Desktop and Cowork transcripts. `0` (the default) means no ceiling. Claude Code ignores it when org policy sets `cleanupPeriodDays`. | User or managed settings |
| `disableArtifact` | <Documented /> <Deprecated note="Use enableArtifact" /> | boolean | - | Deprecated. Use `enableArtifact` to turn the Artifact tool off. `true` still turns the tool off. Claude Code ignores `false`. | Any settings file |
| `enableArtifact` | <Documented /> | boolean | On once the feature is available | Turn the `Artifact` tool on or off. A `false` in any file turns it off. No file can turn it back on. | Any settings file |
| `env` | <Documented /> | object | - | Set environment variables for every session and its subprocesses. | Any settings file |
| `fileCheckpointingEnabled` | <Documented /> | boolean | - | Turn off or on the file snapshots that `/rewind` restores. | Any settings file |
| `fileSuggestion` | <Documented /> | object | - | Supply `@` file autocomplete from your own command. | Any settings file |
| `fileSuggestion.command` | <Documented /> | string | - | The shell command that supplies `@` file suggestions. It gets `{"query": "..."}` on stdin. | Any settings file |
| `fileSuggestion.type` | <Documented /> | `command` | - | Always `command`. Required with `command`. | Any settings file |
| `idleCompaction` | <Documented /> | boolean | - | Set it to `false` to stop Claude Code from compacting a long conversation while your terminal session is idle. Defaults to `true`. | Any settings file |
| `attributionProject` | <Undocumented /> | string | - | The claude.ai Project this session names for your organization's usage reports: the ID of the Project, which starts with `claude_proj_` or `chan_`, or the UUID of a `claude_proj_` Project. The IDs that start with `chan_` are new in `2.1.319`. An empty string names none and stops lower-precedence files from naming one. Claude Code sends it only with a claude.ai login or a direct Anthropic API connection, outside cloud sessions, and when `CLAUDE_CODE_ATTRIBUTION_HEADER` is not `0`. Behind a Claude apps gateway that reports usage by group, name one of your groups instead, such as `payments`. This works when the gateway's admin sets `admin.billing_group_tag`, and `CLAUDE_CODE_ATTRIBUTION_HEADER` does not affect it. Claude Code sends the value under that tag name in the `tags` of each Messages request. The `CLAUDE_CODE_ATTRIBUTION_PROJECT` variable wins. In managed settings it overrides personal files. Project settings count only once you trust the folder, so use the variable for CI. A plain string is accepted, including one with a wrong prefix, and a number gives `Expected string, but received number`. With a made-up `claude_proj_01` ID in user settings, the first system block of the `/v1/messages` request, the line that starts `x-anthropic-billing-header:`, gains the fields `cc_project` (the ID) and `cc_project_src` (`user`), and the debug log says `Attribution Project: <ID> (from user)`. A value `foo_123` adds no field, and the debug log says `Attribution Project: ignored a value that names no Project (from user)`. The ID must match `claude_proj_` or `chan_`, then `01`, then 22 base58 characters.[^attr-project] | Any settings file |
| `attributionProjectPolicy` | <Undocumented /> <ManagedOnly /> | object | - | Your organization's default for `attributionProject`. Its `default` key is the Project used when neither `CLAUDE_CODE_ATTRIBUTION_PROJECT` nor `attributionProject` names one. | Managed settings only |
| `attributionProjectPolicy.default` | <Undocumented /> | string | - | The Project that Claude Code uses when neither `CLAUDE_CODE_ATTRIBUTION_PROJECT` nor `attributionProject` names one. Use its ID, which starts with `claude_proj_` or `chan_`, or the UUID of a `claude_proj_` Project. Behind a Claude apps gateway that reports usage by group, use a group name instead. | Managed settings only |
| `includeCoAuthoredBy` | <Documented /> <Deprecated note="Use attribution" /> | boolean | `true` | Deprecated, so use `attribution` to hide or change commit and PR attribution. | Any settings file |
| `includeGitInstructions` | <Documented /> | boolean | `true` | Remove the built-in commit and PR instructions from Claude's context. | Any settings file |
| `language` | <Documented /> | string | - | Have Claude respond in a language other than English. | Any settings file |
| `minimumVersion` | <Documented /> | string | - | Keep auto-updates from installing anything below a version. | Any settings file |
| `plansDirectory` | <Documented /> | string | `~/.claude/plans` | Choose where plan mode writes plan files. The path is relative to the project root. Since `2.1.323`, Claude Code refuses a write that it cannot show to stay inside the project, with "Could not confirm the plansDirectory folder and plan file are inside this project, so the plan was not saved". Since `2.1.326`, if Claude Code cannot save an approved plan to that folder, it saves the plan in the default plans folder (`~/.claude/plans`) and uses that file for the rest of the session. A notice says where the plan went and why the first save failed. If the default folder fails too, the notice says so, and Claude keeps the approved text in the conversation.[^plans-fallback] | Any settings file |
| `precomputeCompactionEnabled` | <Undocumented /> | boolean | - | Build the compaction summary in the background before Claude Code needs it. It applies only when auto-compact is on. | Settings files |
| `precomputeArmTokens` | <Undocumented /> | integer | - | A positive whole number of tokens. The main conversation starts its background compaction summary at this many tokens, when that is sooner than it would by itself, so that a `/compact` sent below the automatic threshold finds it ready. A window set below the billing boundary compacts without a background summary, and this does not change that. | `--settings` only: Claude Code reads it from the flag settings, for a host that starts Claude Code |
| `respectGitignore` | <Documented /> | boolean | `true` | Keep gitignored files out of the `@` file picker. | Any settings file |
| `respondToBashCommands` | <Documented /> | boolean | `true` | Stop Claude from responding after a `!` shell command runs. The command output still joins the context. | Any settings file |
| `sandbox` | <Documented /> | object | - | Isolate Bash commands from your filesystem and network on macOS, Linux, and WSL2. | Any settings file |
| `skipWebFetchPreflight` | <Documented /> | boolean | - | Skip the WebFetch hostname check when Anthropic is unreachable. | Any settings file |
| `todoFeatureEnabled` | <Undocumented /> | boolean | - | Turn the todo and task tracking panel on or off. | Settings files |
| `worktree` | <Documented /> | object | - | Configure how Claude Code creates git worktrees. Covers `--worktree`, `EnterWorktree`, and agent isolation. | Any settings file |
| `worktree.baseRef` | <Documented /> | `fresh` or `head` | `fresh` | Choose which ref new worktrees branch from. `fresh` branches from `origin/<default-branch>`. `head` branches from your local `HEAD`, so unpushed commits are present. It applies to `--worktree`, `EnterWorktree`, and agent isolation. | Any settings file |
| `worktree.bgIsolation` | <Documented /> | `worktree` or `none` | `worktree` | Choose how background sessions isolate file edits. `worktree` blocks `Edit` and `Write` in the main checkout until the session calls `EnterWorktree`. `none` lets background jobs edit the working copy directly. | Any settings file |
| `worktree.location` | <Documented /> | string | - | Set the folder where Desktop SSH sessions create worktrees on this machine, instead of `<project>/.claude/worktrees`. Use an absolute path or a path that starts with `~/`. Only the desktop app reads it. See [Settings Reference](https://code.claude.com/docs/en/settings-reference#worktree-location). | User settings |
| `worktree.sparsePaths` | <Documented /> | array of strings | - | Check out only the listed directories in each worktree through git sparse-checkout. Add `.claude` to keep the repository settings in each worktree. | Any settings file |
| `worktree.symlinkDirectories` | <Documented /> | array of strings | - | Symlink these directories from the main repository into each worktree. Claude Code symlinks none by default. | Any settings file |

## Git Path for Worktrees

Since `2.1.326`, when a server-side flag is on, Claude Code runs git with a stricter `PATH` when it creates, fetches into, or resets a worktree, and for `/teleport`. The stricter `PATH` keeps only entries that are absolute paths. It drops empty entries and relative entries. When no entry is left, `PATH` is `/dev/null`. A git filter or helper that you start by a bare name may no longer be found. Give it by its full path.[^git-path]
Status: <Gated />. The official docs do not state it.

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Environment Variable Groups](../env-vars/context-and-compaction.md) lists the variables that pair with compaction keys.
- [Memory and Rules](../memory-and-rules.md) covers `CLAUDE.md` and auto memory.
- [Sandbox](../permissions/sandbox.md) covers the `sandbox` key in detail.

## Sources

[^schema]: The program, its bundled settings schema, `chunk-jkpzhr7r.js:279143`.
[^bash-diff]: The program, `chunk-56bhcxay.js:5754973`.
[^cleanup-runs]: Probe cases `print.cli319.cleanup.sweep-7`, `print.cli319.cleanup.sweep-default`, `print.cli319.cleanup.sweep-365`, `print.cli319.cleanup.zero`, and `print.cli319.cleanup.float`. A `-p` run used a Bash call that sleeps 9 seconds, because the sweep starts 5 seconds after launch. The runs made only `/v1/messages` requests. The wording of the `0` message is the program's, `chunk-jkpzhr7r.js:415868`.
[^cleanup-error]: The program, `chunk-s08ggwfb.js:13823`.
[^cleanup-min]: The schema is `int().positive()` and its text says "Minimum 1".
[^cleanup-local]: The schema text, since `2.1.319`. The program, `chunk-jkpzhr7r.js:226881`.
[^excludes-327]: [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327)
[^compact-window]: The settings schema, `2.1.327`. The old maximum was `1000000`.
[^compact-offer]: The program, `chunk-jkpzhr7r.js:296330`; the reader is at `chunk-5699r6rq.js:620145`. Both keys are new in `2.1.327`.
[^attr-project]: The settings schema. Probe cases `print.cli319.attr.claude-proj`, `print.cli319.attr.chan`, `print.cli319.attr.bad-prefix`, and `print.cli319.attr.number`. Live probe case `live.cli319.attribution`, with a real login. The group-name text is from the settings schema, and the gateway side is in the program, `chunk-56bhcxay.js:1290945` and `chunk-39421vhy.js:942723`. See also the [`2.1.327` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.327).
[^plans-fallback]: The program, `chunk-wchmynj9.js:8155-8190`. [`2.1.325` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.325).
[^away-skip]: The program, `chunk-j2wfp6sf.js:123344-123907`. [`2.1.326` release notes](https://github.com/anthropics/claude-code/releases/tag/v2.1.326).
[^git-path]: The program, `chunk-x7g75ktc.js:3480` (the `PATH` filter) and `chunk-sgnhnrtc.js:625` (flag `tengu_proud_perlis`, on by default; the filter applies when the flag is on), and `chunk-9k6h19d9.js:7164` (the git environment for worktrees). Worktree creation uses it at `chunk-56bhcxay.js:4449062` and `chunk-56bhcxay.js:4445236`, the worktree fetch at `chunk-56bhcxay.js:4401955`, the reset of a resumed worktree at `chunk-56bhcxay.js:4426164`, and `/teleport` at `chunk-56bhcxay.js:2501212`.
