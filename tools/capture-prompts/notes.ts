// Hand-written text for the pages. Facts here come from the captures; the wiki is cited where a capture disagrees.

import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

export const BADGE_NOTES: Record<string, string> = {};

export const NOTES: Record<string, string[]> = {
  "default-lean": [
    "The body (the third `system` block) is short. It has the headings `Harness`, `Session-specific guidance`, `Memory`, `Environment`, and `Context management`.",
    "The environment details (working folder, platform, shell, agent types, skills, and date) are not in `system`. They come in a separate message with the role `system`. Look for `messages[1]`.",
    "The first user message holds a reminder about the git attribution lines. Your own text comes after it.",
    "In `-p` mode, the identity line (`system[1]`) is the SDK line: `You are a Claude agent, built on Anthropic's Claude Agent SDK.` The interactive terminal app uses a different line. See [Captured System Prompts](./index.md#identity-line).",
  ],
  "default-sonnet": [
    "Sonnet 5.5 gets the same lean prompt as Opus 5.5. Only the model name, the model ID, and the commit trailer change.",
    `The old wiki says Sonnet gets the full prompt. The capture shows it does not in ${CLAUDE_CODE_VERSION}, and the official docs agree with the capture.`,
  ],
  "default-haiku": [
    "Haiku 5.5 gets the lean prompt, then five extra paragraphs at the end of the body. They tell the model to finish the whole request, to avoid ending the turn early, and to act when it can name the likely reading of the request.",
    "The old wiki says the prompt for Haiku is the full one. The capture shows the lean prompt with extra text, not the full prompt.",
  ],
  "full-prompt": [
    "The full prompt has many more headings: `System`, `Doing tasks`, `Executing actions with care`, `Using your tools`, `Tone and style`, `Text output`, `Session-specific guidance`, `auto memory`, `Environment`, and `Context management`.",
    "The `auto memory` section is much longer than the lean `Memory` section.",
    "The tool list is the same as the default.",
  ],
  "simple-prompt-sonnet": [
    'The text and tools are the same as the default on Sonnet 5.5. In this release the "short" prompt is already what Sonnet gets.',
  ],
  "simple-prompt-haiku": [
    "The text is the same as the default on Haiku 5.5. The extra paragraphs stay, so they are not part of the full or short switch.",
  ],
  "simple-prompt-opus": ["The text is the same as the default on Opus 5.5."],
  bare: [
    "The body has two lines: `CWD: <cwd>` and `Date: <date>`. Nothing else.",
    "The environment message is empty, so no agent list and no skill list reach the model.",
    "Only three tools are sent. See [Tools per Variant](./tools-per-variant.md).",
    "The user message has no git attribution reminder.",
  ],
  "simple-env": [
    "Same text and tools as `--bare`. `--bare` sets `CLAUDE_CODE_SIMPLE`, so the two are one switch in this capture.",
  ],
  "exclude-dynamic": [
    "The `Environment` and `Context management` sections stay in the body, so they can be cached across machines.",
    "The `Memory` section, with the memory folder path, moves into the first user message. The `Session-specific guidance` section is gone from the body.",
    "The fast-mode sentence is gone from the `Environment` section.",
    "The environment message (working folder, platform) stays in the same place as before.",
  ],
  "exclude-dynamic-full": [
    "On the full prompt the flag moves the same kinds of text: the memory section goes to the first user message and the working-folder data stays out of the shared body.",
  ],
  "style-explanatory": [
    'The first line of the body changes to say that the agent follows an "Output Style".',
    "The style text lands after the model line, in the same message as the environment details, under `# Output Style: Explanatory`.",
    "A short reminder, `Explanatory output style is active.`, goes in near the end of that message.",
  ],
  "style-learning": [
    "The same places as `Explanatory`: the first body line, the style text, and the closing reminder.",
    "The style text asks the model to leave `TODO(human)` tasks for you.",
  ],
  "style-proactive": ["The same places as the other built-in styles."],
  "style-concise": ["The same places as the other built-in styles."],
  "style-custom": [
    "Your file body is put under `# Output Style: <name>` in the environment message. The front matter is not sent.",
    "The first line of the body changes, as with the built-in styles.",
  ],
  "style-custom-full": [
    "Without `keep-coding-instructions`, the whole `Doing tasks` section is gone from the full prompt.",
    "Other full-prompt sections stay.",
  ],
  "style-custom-keep": [
    "With `keep-coding-instructions: true`, the `Doing tasks` section stays. Compare with the previous page, where it is removed.",
  ],
  "style-custom-keep-lean": [
    "On the lean prompt the key changes nothing. The wiki says this too (`keep-coding-instructions` has no effect on the short prompt), and the capture agrees.",
  ],
  "append-system-prompt": [
    "Your text goes at the very end of the body (`system[2]`), after a blank line.",
    "The identity line changes too. With an appended prompt in `-p` mode it reads `You are Claude Code, Anthropic's official CLI for Claude, running within the Claude Agent SDK.`",
  ],
  "system-prompt": [
    "Your text replaces the whole body (`system[2]`).",
    "The attribution reminder and the environment message (agent types, skills, date) are still sent.",
    "The tool list is not changed.",
  ],
  "system-prompt-append": [
    "The replacement text and the appended text sit together in the body. The diff is against the replace-only page.",
  ],
  "claude-md": [
    "Project memory files arrive in the first user message, in a reminder that starts with `Codebase and user instructions are shown below.` They are not in `system`.",
  ],
  "git-repo": [
    "Inside a repository, the first user message gets a `gitStatus` reminder: branch, short status, and recent commits. The environment message says `Is a git repository: true`.",
    "The commit hash is replaced with `<sha>`.",
  ],
  "agent-main": [
    "The agent file body replaces the body (`system[2]`), like `--system-prompt`.",
    "The attribution reminder and the environment message are still sent.",
  ],
  "mode-plan": [
    "Plan mode adds a long block of rules to the environment message: the plan file path, a five-phase workflow, and the `ExitPlanMode` rule.",
    "The plan file name is random in each run, so it shows as `<plan-name>`.",
  ],
  "mode-acceptEdits": [
    "`acceptEdits` does not change the text. The mode only changes what asks for permission.",
  ],
  "mode-dontAsk": [
    "`dontAsk` does not change the text. The mode only changes what asks for permission.",
  ],
  brief: [
    "`--brief` changes nothing in the text or the tools in this capture. The brief rules appear only when the `SendUserMessage` tool exists, and it is not in the tool list here.",
    "The old wiki lists `brief` as a section for `--brief`. The capture does not show it.",
  ],
  compact: [
    "The capture runs twice in the same folders. The first run sends `Reply with 'OK'.`. The second run uses `--continue` and sends `/compact`.",
    "The page shows the second request. It has the normal system blocks, the earlier messages, and a last user message with the summary instructions (an `<analysis>` block, then a `<summary>` block).",
    "The summary request still sends the tool list, but the instructions say not to call tools.",
  ],
  "subagent-general-purpose": [
    "A subagent gets its own body, not the main body. It starts with `You are an agent for Claude Code, Anthropic's official CLI for Claude.`",
    "Short notes follow the agent text: use absolute paths, no emojis, no colon before tool calls, and do not write report files.",
    "The environment message is still sent. The stub made the main agent call the `Agent` tool, so this is a real subagent request.",
  ],
  "subagent-explore": [
    "The `Explore` agent is read-only. The body lists what it must not do, and it gets a shorter tool list.",
    "The same notes follow.",
  ],
  "subagent-plan": [
    "The `Plan` agent is also read-only and asks for a step-by-step plan.",
    "The same notes follow.",
  ],
  "subagent-custom": [
    "The body is your agent file text, then the same notes that every subagent gets. The file's front matter is not sent.",
  ],
  "subagent-statusline-setup": [
    "The `statusline-setup` agent is built in. It starts with `You are a status line setup agent for Claude Code.` and has two tools, `Read` and `Edit`.",
    "Its JSON list matches the real input except in two places. The program sends the agent type as top-level `agent_type`, where the prompt shows `agent.type`. The program also sends `cost`, `exceeds_200k_tokens`, `fast_mode`, `remote`, `agent_type`, and `scratchpad_dir`, which the prompt leaves out. [Status Line](../configure/status-line.md#json-fields) lists every field.",
    "To replace it, save an agent file with `name: statusline-setup`. Your file wins over the built-in one. See [Override a Built-in Agent with a File](./override-agent-file.md).",
  ],
  "subagent-claude": [
    'The `claude` agent is the catch-all agent for the agent view ("FleetView"). Its body is a block of rules for a background job, not the usual `You are an agent for Claude Code` text.',
    "It is listed only when the agent view is on. `CLAUDE_CODE_DISABLE_AGENT_VIEW=1` or the `disableAgentView` setting removes it.",
  ],
  "subagent-web-fetch": [
    "The web-reading agent is off by default. `CLAUDE_CODE_WEB_FETCH_AGENT=1` adds it, and it has one tool, `WebFetch`.",
    "Its body tells the model to treat fetched pages as untrusted data and to report back to the caller.",
  ],
  "override-agent-file": [
    "The request has your file body and the usual subagent notes. The built-in `Explore` text is gone. The file set no `tools`, so the agent is not held to the read-only list of `Explore` (8 tools here against 5).",
    "Agent sources are merged by name in this order, and the later one wins: built-in, plugin, user (`~/.claude/agents`), project (`.claude/agents`), `--agents`, managed settings. This is static evidence from the program. The test here shows the project file winning over the built-in agent.",
  ],
  "override-agents-flag": [
    "`--agents` takes JSON keyed by agent name. A key that equals a built-in name (`general-purpose` here) replaces the built-in agent for that run.",
    "The `--agents` source ranks above project and user files in the merge order, and below managed settings.",
  ],
  "override-append-subagent": [
    "Your text lands at the end of the subagent body, after the usual notes. The built-in `Explore` text stays.",
    "The flag is hidden from `--help` and works only with `-p`. It also reaches subagents of subagents.",
  ],
  "subagent-with-prompt-flags": [
    "`--system-prompt` and `--append-system-prompt` change the main agent only. The `Explore` subagent keeps its own body and none of your text.",
  ],
  "disable-explore-plan": [
    "The `Explore` and `Plan` lines leave the agent list that the model reads. The other agents stay.",
  ],
  "disable-builtin-agents": [
    "In print mode, the whole `Available agent types` list is gone. The `Agent` tool stays but its text changes.",
  ],
  "command-init": [
    "The `/init` text goes into a user message after a `<command-name>` marker. The system blocks do not change.",
    "A file named `.claude/commands/init.md` takes its place. See [Override /init with a Command File](./override-command-init.md).",
  ],
  "command-security-review": [
    "Like `/init`, the text goes into a user message. The system blocks do not change.",
  ],
  "command-simplify": [
    "`/simplify` is a built-in skill. Its text arrives in a user message after a `<command-name>` marker, with the same system blocks as the default.",
  ],
  "command-debug": [
    "`/debug` is a built-in skill. Its text arrives in a user message, with the same system blocks as the default.",
  ],
  "override-command-init": [
    "A command file with the same name as a built-in command replaces its text. The `/init` text is gone and only your file body is sent.",
  ],
  "override-skill-simplify": [
    "A skill folder with the same name as a built-in skill replaces its text. The skill wrapper adds a `Base directory for this skill` line before your file body.",
  ],
  "hook-prompt": [
    "A hook of `type: prompt` makes a request with no tools. The system text is fixed. Your `prompt` goes in the user message, with `$ARGUMENTS` filled with the hook input JSON.",
    'The reply must be JSON, `{"ok": true}` or `{"ok": false}` with a `reason`.',
  ],
  "hook-prompt-stop": [
    "On the `Stop` event the system text is different: it asks the model to read the transcript and judge a stop condition. The request has more messages.",
  ],
  "hook-agent": [
    "A hook of `type: agent` starts a small agent with tools and a `StructuredOutput` tool for the result. The system text is fixed and names the event (`PreToolUse` here).",
    "Your `prompt` goes in the user message. The model defaults to Haiku, and you can set `model` in the hook.",
  ],
  "auto-classifier": [
    "By default, the server checks each tool call: the main request carries a `safeguards` field with a `classifier_context` object that holds the rules and the `auto_mode` lists. See [The Server-Side Check](../../configure/permissions/auto-mode.md#the-server-side-check).",
    "With `CLAUDE_CODE_AUTO_MODE_SERVER=0`, as in this capture, the program sends no `safeguards` field and asks its own classifier. The first stage is a separate request with the system text `You are a security monitor for autonomous AI coding agents.` and no tools.",
    "The stub gave no classifier result that the program could parse, so it sent the same request more than once.",
  ],
  "auto-classifier-custom": [
    "Your `allow`, `hard_deny`, and `environment` entries are added at the place of `$defaults`. Entries before `$defaults` come first.",
    "`soft_deny` had no `$defaults`, so the built-in soft block rules were replaced. The diff shows them removed.",
    "Without `CLAUDE_CODE_AUTO_MODE_SERVER=0`, the same `auto_mode` object goes in `safeguards.classifier_context` of the main request.",
  ],
  "compact-custom": [
    "Text after `/compact` goes under `Additional Instructions:` at the end. Text that a `PreCompact` hook prints on stdout goes in the same place, after your text.",
    "The program does not copy a `## Compact Instructions` section of `CLAUDE.md` into the compaction text. The compaction text only asks the model to follow such a section if it finds one in the included context, and the section reaches the model through the `CLAUDE.md` reminder.",
  ],
  "plan-mode-instructions": [
    "The flag replaces the workflow phases of the plan mode reminder. The read-only rules at the top and the `ExitPlanMode` rules at the end stay.",
  ],
  "git-instructions-off": [
    "The commit and pull request rules live in the `Bash` tool description, so the tool list changes too. The git status reminder is still sent.",
  ],
  "memory-off": ["The whole memory section is gone from the system body."],
  "style-override-builtin": [
    "A custom style file with `name: Explanatory` wins over the built-in `Explanatory` style. Only your file body is sent.",
  ],
};

export { INDEX_FACTS } from "./notes/index-facts.ts";
