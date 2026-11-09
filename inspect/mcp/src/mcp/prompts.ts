import { z } from "zod";

import { has, server } from "./app.ts";

// ---- prompts: the steps of a task, for an agent with no plan of its own ----

const ask = (t: string) => ({
	messages: [
		{ role: "user" as const, content: { type: "text" as const, text: t } },
	],
});
server.registerPrompt(
	"release_review",
	{
		description: "Review a Claude Code release against the code that changed.",
		argsSchema: {
			from: z.string().describe("Older version."),
			to: z.string().describe("Newer version."),
		},
	},
	({ from, to }) =>
		ask(
			[
				`Review Claude Code ${to} against ${from} with the cc-inspect tools.`,
				`1. Run \`code\` \`prepare\` for ${from} and for ${to}.`,
				`2. Run \`release\` \`diff\` with from ${from} and to ${to}, and page with \`offset\` while it gives next_offset.`,
				`3. Run \`release\` \`notes\` with version ${to} and from ${from}.`,
				"4. For each gated or unmatched line, run `code` `find` with its words, then `release` `explain` with the name you found.",
				'5. Report each line as matched, gated, or not found in the code, with `module:offset`. Call the source "the program", and state only what the code shows.',
			].join("\n"),
		),
);
server.registerPrompt(
	"explain_change",
	{
		description: "Explain one name of a Claude Code version from its code.",
		argsSchema: {
			name: z
				.string()
				.describe("A string, a command such as /loops, or a tool name."),
			version: z
				.string()
				.optional()
				.describe("Version; default: the current install."),
		},
	},
	({ name, version }) =>
		ask(
			[
				`Explain "${name}" in Claude Code ${version ?? "(the current install)"} with the cc-inspect tools.`,
				`1. Run \`code\` \`find\` with query "${name}"${has(version) ? ` and version ${version}` : ""}.`,
				`2. Run \`release\` \`explain\` with name "${name}", and \`code\` \`read\` at the offsets it gives when you need more code.`,
				'3. Report where it is, who uses it, when it runs (gates, env reads, isEnabled), and how (no-op, stub, or handled), with `module:offset`. Call the source "the program".',
			].join("\n"),
		),
);
