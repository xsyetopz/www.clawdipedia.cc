import {
	bashTool,
	hookSettings,
	LEAN_MODEL,
	ovCan,
	type Variant,
} from "./base.ts";

export const HOOK_VARIANTS: Variant[] = [
	{
		id: "hook-prompt",
		group: "hooks",
		title: "Prompt Hook Request",
		model: LEAN_MODEL,
		tool: bashTool,
		args: hookSettings("prompt", "PROBE-HOOK-PROMPT"),
		pick: "marker",
		marker: "PROBE-HOOK-PROMPT",
		baseline: "default-lean",
		summary:
			'The request that a hook of `type: "prompt"` sends to a small model. You write the user text; the program adds the system text.',
		how: 'Add a hook handler `{"type": "prompt", "prompt": "... $ARGUMENTS"}` to `settings.json`.',
		select: "Hook `type: prompt`",
		status: "Documented",
		can: ovCan(
			"Partly. You write the prompt and pick the model. The system text is fixed.",
			"Add or remove the hook.",
			"`hooks` in any settings scope.",
		),
	},
	{
		id: "hook-agent",
		group: "hooks",
		title: "Agent Hook Request",
		model: LEAN_MODEL,
		tool: bashTool,
		args: hookSettings("agent", "PROBE-HOOK-AGENT"),
		pick: "marker",
		marker: "PROBE-HOOK-AGENT",
		baseline: "default-lean",
		summary:
			'The request that a hook of `type: "agent"` sends. You write the task; the program adds the system text.',
		how: 'Add a hook handler `{"type": "agent", "prompt": "... $ARGUMENTS"}` to `settings.json`.',
		select: "Hook `type: agent`",
		status: "Documented",
		can: ovCan(
			"Partly. You write the prompt and pick the model. The system text is fixed.",
			"Add or remove the hook.",
			"`hooks` in any settings scope.",
		),
	},
];
