---
title: Subagent Frontmatter
description: Every key of a subagent file and of the --agents JSON, with rules for how Claude Code reads them.
sidebar_position: 2
---

An agent file is a Markdown file that defines a subagent.
The keys at the top of the file (the frontmatter) set its name, tools, model, and limits. The body is its prompt.
For example, a file with `name: reviewer` and `tools: Read, Grep` makes a read-only review agent.

Edit the file, or pass `--agents` JSON. To turn a subagent off, delete the file or deny `Agent(name)` in `permissions.deny`.

## Example

```bash
claude --agents '{
  "tester": {
    "description": "Runs the test suite and reports failures.",
    "prompt": "Run the tests. Report each failing test and its error.",
    "tools": ["Bash", "Read"],
    "model": "haiku",
    "maxTurns": 10
  }
}'
```

## Keys

| Key | Status | What it does | Notes |
| --- | --- | --- | --- |
| `name` | <Documented /> | The unique ID of the agent. | At most 256 characters. Must not start with `-` or contain `:`. Hooks receive it as `agent_type`. Claude Code treats a file with no `name` as documentation. |
| `description` | <Documented /> | Tells Claude when to delegate to the agent. | Required. Claude Code skips a file with `name` but no `description`. A literal `\n` becomes a newline. It may not be empty in `--agents` JSON. |
| `tools` | <Documented /> | An allowlist of tools. | A comma-separated string or a YAML list. If you omit it, the agent inherits all tools that subagents can use. `Agent(a, b)` limits which types a `--agent` main thread can start. `mcp__server__*` picks a whole server. |
| `disallowedTools` | <Documented /> | A denylist of tools. Claude Code applies it first. Then `tools` resolves against what remains. | An entry such as `Bash(git push *)` removes the whole tool. `mcp__github__*` withholds MCP tools. |
| `model` | <Documented /> | The model of the agent. | `sonnet`, `opus`, `haiku`, `fable`, a full model ID, or `inherit`. Order of choice: the per-call `model`, this field, `CLAUDE_CODE_SUBAGENT_MODEL`, the main model. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` forces one model. See [Models](../../how-it-works/models.md). |
| `permissionMode` | <Documented /> | The permission mode of the agent. | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`, or `manual` (same as `default`). `bypassPermissions` applies only when the main session has it. Claude Code ignores it for plugin agents, and logs a warning. |
| `maxTurns` | <Documented /> | The most agentic turns before the agent stops. | A positive integer, as a number or a string. At the limit the loop adds a `max_turns_reached` attachment with `maxTurns` and `turnCount`, and the subagent stops.[^max-turns] A bad value logs `Agent file <path> has invalid maxTurns '<value>'. Must be a positive integer.`, and Claude Code drops the value. A plugin agent file logs the same text with `Plugin agent file`. |
| `autoCompactWindow` | <Documented /> | Lowers the auto-compact window for this agent. | An integer of `100000` or more. It only lowers the window the subagent would otherwise inherit, and has no effect on the main session agent.[^acw] See [Context and Compaction](../../how-it-works/context-and-compaction.md). |
| `skills` | <Documented /> | Skills preloaded into the agent context. | Claude Code injects the full skill text, for at most 32 names. A skill with `disable-model-invocation: true` cannot be preloaded. Claude Code skips a missing skill and logs it. |
| `mcpServers` | <Documented /> | MCP servers for this agent. | A list of server names, or inline `{name: config}` objects. Inline servers connect at start and disconnect at the end. Claude Code ignores it for plugin agents. |
| `hooks` | <Documented /> | Hooks scoped to this agent. | Events: `PreToolUse`, `PostToolUse`, `Stop` (becomes `SubagentStop`). Claude Code ignores it for plugin agents. See [Hooks](../hooks/index.md). |
| `memory` | <Documented /> | The scope of persistent memory. | `user` is `~/.claude/agent-memory/<name>/`. `project` is `.claude/agent-memory/<name>/`. `local` is `.claude/agent-memory-local/<name>/`. Claude Code logs an invalid value and drops it. |
| `background` | <Documented /> | Keeps the agent in the background. | `true` or `false`, as a string or boolean. Other values log an error. A teammate may not start such an agent. |
| `omitClaudeMd` | <Documented /> | Starts without user, project, and local `CLAUDE.md`. | `true` only. Managed policy files still load. `Explore`, `Plan`, and the web-reading agent set it. |
| `effort` | <Documented /> | The effort level while the agent runs. | `low`, `medium`, `high`, `xhigh`, `max`. The text of Claude Code also lists an integer.[^effort] `CLAUDE_CODE_EFFORT_LEVEL` wins. |
| `isolation` | <Documented /> | Runs the agent apart from your working folder. | You can set `worktree` or `remote` in an agent file. Any other value gives an `invalid isolation value` warning. `worktree` runs the agent in a temporary git worktree that branches from the default branch. `remote` starts the agent in a cloud session, and the agent always runs in the background. It needs a cloud login and a git root, and a server gate must allow it. When `remote` is not available, Claude Code uses a worktree if there is a git root, and a local agent if not. It writes `[remote agent] isolation:'remote' is unavailable` to the debug log. The docs name only `worktree`, and the `--agents` schema describes only `worktree`. A plugin's agent file accepts only `worktree`.[^isolation] In a probe in `-p`, `isolation: remote` in a file ran the agent in a local worktree and started no cloud session. It was not tried with a cloud login. |
| `color` | <Documented /> | The display color. | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan`. |
| `initialPrompt` | <Documented /> | The first user turn when the agent is the main session. | Used with `--agent` or the `agent` setting. Claude Code processes commands and skills. Not read when the agent starts as a subagent. Claude Code ignores it in a plugin agent file. |
| `experimental` | <Documented /> <Experimental /> | A map of experimental options. | `cacheTtl`: `5m` or `1h` sets the prompt cache TTL when neither a `subagentPromptCacheTtl` setting nor an env var sets a value. Claude Code ignores `1h` in subscription overage. Claude Code ignores unknown keys. |
| `observer` | <Undocumented /> <Gated note="CLAUDE_CODE_EXPERIMENTAL_OBSERVER_AGENTS" /> | An agent type that starts as a background observer whenever this agent runs. | A trimmed string. Needs `CLAUDE_CODE_EXPERIMENTAL_OBSERVER_AGENTS`. Without it, Claude Code ignores the field. With it, the named agent starts in the background. It gets an activity digest after each turn of this agent. It has an `ObserverReport` tool. An observer cannot have its own observer.[^observer] |
| `observerMessage` | <Undocumented /> <Gated note="Same gate as observer." /> | Text added to each activity digest sent to the observer. | A string. It follows the default digest instruction as the last line (checked by a probe). |
| `observeSubagents` | <Undocumented /> <Gated note="Same gate as observer." /> | Whether subagents inherit the observer. | A boolean, default true. `false` stops inheritance. |

## Rules for Files

- Claude Code skips a file in any of these cases. It has no `name`. Its opening `---` is not on line 1. It has a bad `name` or no `description`. Its YAML does not parse. Details go to the `--debug` log.
- A plugin agent whose frontmatter has no `name` or does not parse still loads, under its file name.
- A plugin agent has the name `plugin:folder:file`. The file `agents/review/security.md` in `my-plugin` is `my-plugin:review:security`.
- A plugin agent file cannot set `permissionMode`, `hooks`, `mcpServers`, `initialPrompt`, `observer`, `observerMessage`, or `observeSubagents`. Claude Code ignores each key that is present. It logs `Plugin agent file <path> sets <key>, which is ignored for plugin agents. Define the agent in .claude/agents/ to use <key>.`[^plugin-agent] `maxTurns` and `autoCompactWindow` are still read, and each is checked as the table says.

- Frontmatter keys are case-sensitive and use camelCase. In a probe, Claude Code ignored `Tools` and `disallowed-tools`, while `tools` and `disallowedTools` worked. See [Probes](../../reference/probes.md#subagents-and-hooks).

## The `--agents` JSON

`--agents` takes a JSON object. Each key is an agent name. The value uses these fields:

`description` (required), `prompt` (required), `tools`, `disallowedTools`, `model`, `effort` (level or integer), `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `autoCompactWindow`, `skills`, `initialPrompt`, `memory`, `background`, `omitClaudeMd`, `isolation`, `observer`, `observerMessage`, `observeSubagents`.

The `prompt` field replaces the file body.
These agents have priority 2, below managed settings.
In print mode (`-p`), `--agents` also takes a file path.[^agents-file]
An interactive session refuses a path.
The plugin mod call `$.agent.register` uses the same schema.

## Exact Fields

The exact fields are in two files. For the `--agents` JSON, see `https://clawdipedia.cc/schemas/claude-code-agents-json.json`, made from the `--agents` validator of Claude Code. For the frontmatter, see the `agent` definition in `https://clawdipedia.cc/schemas/claude-code-frontmatter.json`, made from its frontmatter validators.[^validators]
They list every field of this release. Look up a field there before you rely on it.

## Related Pages

- [Subagents](index.md): where agent files live.
- [Subagent Runtime](runtime.md): built-in agents and limits.
- [Skill Frontmatter](../skills-and-commands/frontmatter.md): the keys of a skill.
- [Hooks](../hooks/index.md): the `hooks` key.

## Sources

[^max-turns]: The program, the agent loop, `chunk-56bhcxay.js:2412588`, and the frontmatter parser, `chunk-56bhcxay.js:2969766`.
[^effort]: The program, the frontmatter schema, `chunk-56bhcxay.js:2922420`.
[^isolation]: The program, the agent file parser, `chunk-56bhcxay.js:2969185`. The Agent tool input schema and its description of both values, `chunk-tt7pb888.js:28728`. The fallback, `chunk-tt7pb888.js:6732`. The cloud launch and its checks, `chunk-tt7pb888.js:46950`. The `--agents` schema, `chunk-56bhcxay.js:1075614`. The plugin agent parser, `chunk-56bhcxay.js:2922120`. Probes: see [Probes](../../reference/probes.md#subagents-and-hooks).
[^observer]: The program, `chunk-6fzqs776.js:1202` and `chunk-56bhcxay.js:1075614`, and [Probes](../../reference/probes.md#subagents-and-hooks).
[^plugin-agent]: The program, the plugin agent loader, `chunk-56bhcxay.js:2922420`.
[^validators]: The program, the frontmatter schema, `chunk-56bhcxay.js:2959248`, the frontmatter parser, `chunk-56bhcxay.js:2969185`, and the `--agents` JSON schema, `chunk-tt7pb888.js:28728`. Official page: [Create Custom Subagents](https://code.claude.com/docs/en/sub-agents).
[^acw]: The program, `chunk-20bv8pca.js:297489`.
[^agents-file]: The program, `chunk-gywceass.js:76740`.
