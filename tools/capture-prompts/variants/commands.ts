import { cmdVariant, OV_CMD, OV_SKILL, type Variant } from "./base.ts";

export const COMMAND_VARIANTS: Variant[] = [
	cmdVariant("init", "Command, /init", "Documented"),
	cmdVariant("security-review", "Command, /security-review", "Documented"),
	cmdVariant("simplify", "Skill, /simplify", "Undocumented", "skills"),
	cmdVariant("debug", "Skill, /debug", "Undocumented", "skills"),
	{
		...cmdVariant("init", "Override /init with a Command File", "Undocumented"),
		id: "override-command-init",
		group: "commands",
		projFiles: { ".claude/commands/init.md": OV_CMD("PROBE-OVERRIDE-CMD") },
		baseline: "command-init",
	},
	{
		...cmdVariant(
			"simplify",
			"Override /simplify with a Skill File",
			"Undocumented",
		),
		id: "override-skill-simplify",
		group: "other",
		projFiles: {
			".claude/skills/simplify/SKILL.md": OV_SKILL(
				"simplify",
				"PROBE-OVERRIDE-SKILL",
			),
		},
		baseline: "command-simplify",
	},
];
