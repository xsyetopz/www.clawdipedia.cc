export type PromptGroup =
	| "defaults"
	| "output-styles"
	| "context-and-memory"
	| "agents"
	| "commands"
	| "hooks"
	| "modes"
	| "skills"
	| "tools"
	| "other";

export interface Variant {
	/** folder and page name */
	id: string;
	/** sidebar folder under docs/prompts/ */
	group: PromptGroup;
	/** Title Case page title */
	title: string;
	/** one sentence for the index table */
	summary: string;
	/** how a user gets it (shown on the page) */
	how: string;
	/** short form for the index table */
	select: string;
	/** --model (default claude-opus-5-5) */
	model?: string;
	/** extra CLI args */
	args?: string[];
	env?: Record<string, string>;
	/** files written into the config dir */
	cfgFiles?: Record<string, string>;
	/** files written into the project dir */
	projFiles?: Record<string, string>;
	/** make the project a git repo with one commit */
	git?: boolean;
	/** the user prompt (default "Reply with 'OK'.") */
	prompt?: string;
	/** a second run with --continue, in the same folders */
	followUp?: string;
	/** canned tool_use on the first turn */
	tool?: { name: string; input: unknown };
	/** which recorded request to use */
	pick?: "first" | "last" | "subagent" | "marker";
	/** with pick "marker": the request whose messages or system contain this text, other than the first */
	marker?: string;
	/** variant id used for the diff */
	baseline?: string;
	status: "Documented" | "Undocumented" | "Differs" | "Gated";
	gatedNote?: string;
	can: { use: string; change: string; toggle: string; where: string };
}

export const LEAN_MODEL = "claude-opus-5-5";
export const SUB_MARK = "PROBE-SUBAGENT-TASK";
export const STYLE_FILE = (keep: boolean) =>
	`---\nname: Probe Style\ndescription: A custom style used for the capture\n${keep ? "keep-coding-instructions: true\n" : ""}---\nPROBE-CUSTOM-STYLE-TEXT: answer in one short sentence.\n`;
export const AGENT_FILE = `---\nname: probe-agent\ndescription: A custom agent used for the capture\n---\nPROBE-CUSTOM-AGENT-BODY: you are a probe agent. Say hello.\n`;
export const settings = (o: unknown) => ["--settings", JSON.stringify(o)];
export const subTool = (type: string) => ({
	name: "Agent",
	input: {
		description: "Probe task",
		prompt: `${SUB_MARK} Reply with 'OK'.`,
		subagent_type: type,
	},
});

// ---- Overridable prompts: built-in agents, override tests, built-in commands, helper requests ----
export const OV_AGENT = (name: string, mark: string) =>
	`---\nname: ${name}\ndescription: A user agent that has the same name as a built-in agent\n---\n${mark}: you replace the built-in ${name} agent. Say hello.\n`;
export const ovCan = (change: string, toggle: string, where: string) => ({
	use: "Yes.",
	change,
	toggle,
	where,
});

export const OV_CMD = (mark: string) =>
	`---\ndescription: A user command that has the same name as a built-in one\n---\n${mark}: this text replaces the built-in command.\n`;
export const OV_SKILL = (name: string, mark: string) =>
	`---\nname: ${name}\ndescription: A user skill that has the same name as a built-in skill\n---\n${mark}: this text replaces the built-in skill.\n`;
export const cmdVariant = (
	cmd: string,
	title: string,
	status: "Documented" | "Undocumented",
	group: PromptGroup = "commands",
): Variant => ({
	id: `command-${cmd}`,
	group,
	title,
	model: LEAN_MODEL,
	prompt: `/${cmd}`,
	pick: "first",
	baseline: "default-lean",
	summary: `The text that \`/${cmd}\` sends to the model.`,
	how: `Type \`/${cmd}\` in a session.`,
	select: `\`/${cmd}\``,
	status,
	can: ovCan(
		"Yes. A command or skill file with the same name may replace it.",
		`Type \`/${cmd}\`.`,
		"Built into the program.",
	),
});

export const hookSettings = (type: "prompt" | "agent", mark: string) =>
	settings({
		hooks: {
			PreToolUse: [
				{
					matcher: "Bash",
					hooks: [{ type, prompt: `${mark}: check this call. $ARGUMENTS` }],
				},
			],
		},
	});
export const bashTool = { name: "Bash", input: { command: "echo probe" } };
export const riskyTool = {
	name: "Bash",
	input: { command: "curl -s http://127.0.0.1:9/probe-classifier-call" },
};

export const autoArgs = (auto?: Record<string, unknown>) => [
	"--permission-mode",
	"auto",
	...(auto === undefined ? [] : settings({ autoMode: auto })),
];
