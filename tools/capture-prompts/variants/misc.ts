import {
	autoArgs,
	LEAN_MODEL,
	ovCan,
	riskyTool,
	settings,
	subTool,
	type Variant,
} from "./base.ts";

export const MISC_VARIANTS: Variant[] = [
	{
		id: "auto-classifier",
		group: "modes",
		title: "Auto Mode Classifier",
		model: LEAN_MODEL,
		tool: riskyTool,
		args: autoArgs(),
		// 2.1.319 asks the server-side check first and sends no local classifier request.
		env: { CLAUDE_CODE_AUTO_MODE_SERVER: "0" },
		pick: "marker",
		marker: "probe-classifier-call",
		baseline: "default-lean",
		summary: "The request that the auto mode classifier sends for a tool call.",
		how: "Run `claude --permission-mode auto` with `CLAUDE_CODE_AUTO_MODE_SERVER=0`. The classifier runs when the model calls a tool that no rule already allows.",
		select: "`--permission-mode auto`",
		status: "Documented",
		can: ovCan(
			"Partly. The `autoMode` setting edits the rule lists.",
			'`--permission-mode auto` or `defaultMode: "auto"`.',
			"`autoMode` in user, flag, or managed settings.",
		),
	},
	{
		id: "auto-classifier-custom",
		group: "modes",
		title: "Auto Mode Classifier, Custom Rules",
		model: LEAN_MODEL,
		tool: riskyTool,
		args: autoArgs({
			allow: ["PROBE-AUTO-ALLOW", "$defaults"],
			soft_deny: ["PROBE-AUTO-SOFT"],
			hard_deny: ["PROBE-AUTO-HARD", "$defaults"],
			environment: ["PROBE-AUTO-ENV", "$defaults"],
		}),
		// 2.1.319 asks the server-side check first and sends no local classifier request.
		env: { CLAUDE_CODE_AUTO_MODE_SERVER: "0" },
		pick: "marker",
		marker: "probe-classifier-call",
		baseline: "auto-classifier",
		summary:
			"The same classifier request with `autoMode` rules in the settings. `$defaults` keeps the built-in rules in that list; without it they are replaced.",
		how: 'Set `autoMode` in settings: `{"allow": ["...", "$defaults"], "soft_deny": [...], "hard_deny": [...], "environment": [...]}`.',
		select: "`autoMode` setting",
		status: "Documented",
		can: ovCan(
			"Yes. You write the rules.",
			"`autoMode` setting.",
			"`autoMode` in user, flag, or managed settings.",
		),
	},
	{
		id: "compact-custom",
		group: "context-and-memory",
		title: "Compaction Prompt, Custom Instructions",
		model: LEAN_MODEL,
		followUp: "/compact PROBE-COMPACT-ARG keep the file names",
		projFiles: {
			"CLAUDE.md":
				"# Notes\n\n## Compact Instructions\nPROBE-COMPACT-MD: keep test output.\n",
		},
		args: settings({
			hooks: {
				PreCompact: [
					{
						hooks: [{ type: "command", command: "echo PROBE-COMPACT-HOOK" }],
					},
				],
			},
		}),
		pick: "last",
		baseline: "compact",
		summary:
			"The compaction request with the three ways to add your own instructions.",
		how: "Add text after `/compact`, add a `## Compact Instructions` section to `CLAUDE.md`, or print text from a `PreCompact` hook.",
		select: "`/compact <text>`, CLAUDE.md, or `PreCompact` hook",
		status: "Documented",
		can: ovCan(
			"Yes. You add focus text. The base summary rules stay.",
			"`/compact <text>`.",
			"The command line, `CLAUDE.md`, or a `PreCompact` hook.",
		),
	},
	{
		id: "plan-mode-instructions",
		group: "modes",
		title: "Plan Mode, Custom Workflow",
		model: LEAN_MODEL,
		args: [
			"--permission-mode",
			"plan",
			"--plan-mode-instructions",
			"PROBE-PLAN-WORKFLOW: write a one-line plan.",
		],
		baseline: "mode-plan",
		summary:
			"`--plan-mode-instructions` replaces the workflow phases in the plan mode reminder.",
		how: 'Run `claude --permission-mode plan --plan-mode-instructions "your workflow"`.',
		select: "`--plan-mode-instructions`",
		status: "Undocumented",
		can: ovCan(
			"Yes. You give the workflow text. The read-only rules and the `ExitPlanMode` rule stay.",
			"`--plan-mode-instructions`.",
			"Command-line flag.",
		),
	},
	{
		id: "git-instructions-off",
		group: "context-and-memory",
		title: "Git Instructions Turned Off",
		model: LEAN_MODEL,
		git: true,
		args: settings({ includeGitInstructions: false }),
		baseline: "git-repo",
		summary:
			"`includeGitInstructions: false` removes the built-in commit and pull request rules.",
		how: 'Set `"includeGitInstructions": false` in `settings.json`, or set `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`.',
		select: "`includeGitInstructions: false`",
		status: "Documented",
		can: ovCan(
			"Yes. It removes text.",
			"`includeGitInstructions` or `CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS=1`.",
			"Any settings scope, or an environment variable.",
		),
	},
	{
		id: "memory-off",
		group: "context-and-memory",
		title: "Auto Memory Turned Off",
		model: LEAN_MODEL,
		env: { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" },
		baseline: "default-lean",
		summary: "`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` removes the memory section.",
		how: 'Set `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, or `"autoMemoryEnabled": false` in `settings.json`.',
		select: "`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`",
		status: "Documented",
		can: ovCan(
			"Yes. It removes text.",
			"`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` or `autoMemoryEnabled`.",
			"Environment variable or any settings scope.",
		),
	},
	{
		id: "style-override-builtin",
		group: "output-styles",
		title: "Custom Output Style with a Built-in Name",
		model: LEAN_MODEL,
		args: settings({ outputStyle: "Explanatory" }),
		cfgFiles: {
			"output-styles/explanatory.md":
				"---\nname: Explanatory\ndescription: A user style with a built-in name\n---\nPROBE-STYLE-OVERRIDE: answer in one short sentence.\n",
		},
		baseline: "style-explanatory",
		summary:
			"A style file named `Explanatory` takes the place of the built-in style.",
		how: "Save `~/.claude/output-styles/explanatory.md` with `name: Explanatory` in its front matter.",
		select: "Style file with a built-in name",
		status: "Undocumented",
		can: ovCan(
			"Yes. You write the file.",
			"`/output-style` or the `outputStyle` setting.",
			"`~/.claude/output-styles/*.md` or `.claude/output-styles/*.md`.",
		),
	},
	{
		id: "subagent-with-prompt-flags",
		group: "agents",
		title: "Subagent with --system-prompt and --append-system-prompt",
		model: LEAN_MODEL,
		args: [
			"--system-prompt",
			"REPLACEMENT-TEXT-FROM-FLAG",
			"--append-system-prompt",
			"APPENDED-TEXT-FROM-FLAG",
		],
		tool: subTool("Explore"),
		pick: "subagent",
		baseline: "subagent-explore",
		summary:
			"Shows whether the main-thread prompt flags reach a built-in subagent.",
		how: 'Run `claude --system-prompt "A" --append-system-prompt "B"`, then let the model start the `Explore` agent.',
		select: "Prompt flags plus a subagent",
		status: "Undocumented",
		can: ovCan(
			"Not for the subagent. Use `--append-subagent-system-prompt`.",
			"The flags.",
			"Command-line flags.",
		),
	},
	{
		id: "hook-prompt-stop",
		group: "hooks",
		title: "Prompt Hook on Stop",
		model: LEAN_MODEL,
		args: settings({
			hooks: {
				Stop: [
					{
						hooks: [
							{ type: "prompt", prompt: "PROBE-HOOK-STOP: is the work done?" },
						],
					},
				],
			},
		}),
		pick: "marker",
		marker: "PROBE-HOOK-STOP",
		baseline: "hook-prompt",
		summary:
			"A prompt hook on the `Stop` event gets a different system text from a tool hook.",
		how: 'Add a `{"type": "prompt", "prompt": "..."}` handler under `Stop` in `settings.json`.',
		select: "Hook `type: prompt` on `Stop`",
		status: "Documented",
		can: ovCan(
			"Partly. You write the prompt and pick the model. The system text is fixed.",
			"Add or remove the hook.",
			"`hooks` in any settings scope.",
		),
	},
	{
		id: "tools-upfront",
		group: "defaults",
		title: "All Tools Sent Upfront",
		model: LEAN_MODEL,
		env: { ENABLE_TOOL_SEARCH: "false" },
		baseline: "default-lean",
		summary:
			"`ENABLE_TOOL_SEARCH=false` sends every tool with its full text, the deferred ones too.",
		how: "Set `ENABLE_TOOL_SEARCH=false`.",
		select: "`ENABLE_TOOL_SEARCH=false`",
		status: "Documented",
		can: ovCan(
			"Yes. It adds the deferred tools to the request.",
			"`ENABLE_TOOL_SEARCH`.",
			"Environment variable, or `env` in any settings scope.",
		),
	},
];
