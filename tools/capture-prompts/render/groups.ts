import { join } from "node:path";

import { formatJson } from "../../schemas/format.ts";
import type { PromptGroup } from "../variants.ts";
import { groupDir } from "./ctx.ts";

// One row for each folder in docs/prompts/. The order is the sidebar order, from position 2.
// index.md holds position 1.
// `ownPage` marks a group that holds a page named after it, such as tools/tools.md. Docusaurus gives
// such a page the route of the folder, so the category links the page in place of a generated index.
export const GROUPS: {
	id: PromptGroup;
	label: string;
	description: string;
	ownPage?: true;
}[] = [
	{
		id: "defaults",
		label: "Defaults",
		description:
			"The base prompts and the whole-prompt views, with the switches that change them.",
	},
	{
		id: "output-styles",
		label: "Output Styles",
		description: "The prompt that each built-in or custom output style adds.",
	},
	{
		id: "context-and-memory",
		label: "Context and Memory",
		description:
			"The prompts for compaction, memory files, and the repository context.",
	},
	{
		id: "agents",
		label: "Agents",
		description:
			"The prompts of the main agent, the built-in subagents, and custom agents.",
	},
	{
		id: "commands",
		label: "Commands",
		description: "The text that a slash command sends to the model.",
	},
	{
		id: "hooks",
		label: "Hooks",
		description: "The prompts that prompt hooks and agent hooks send.",
	},
	{
		id: "modes",
		label: "Modes",
		description:
			"The prompts for the permission modes, plan mode, and the auto mode classifier.",
	},
	{
		id: "skills",
		label: "Skills",
		description: "The prompts of the bundled skills that the Skill tool runs.",
	},
	{
		id: "tools",
		label: "Tools",
		description: "The tool descriptions and schemas that each request sends.",
		ownPage: true,
	},
	{
		id: "other",
		label: "Other",
		description:
			"Prompts that fit no other group, such as overrides and helper requests.",
	},
];

export const isGroup = (g: unknown): g is PromptGroup =>
	GROUPS.some((x) => x.id === g);

// writes docs/prompts/<group>/_category_.json for every group
export const writeCategories = async (): Promise<void> => {
	await Promise.all(
		GROUPS.map(async (g, i) => {
			const cat = {
				label: g.label,
				position: i + 2,
				link: g.ownPage
					? { type: "doc", id: `prompts/${g.id}/${g.id}` }
					: {
							type: "generated-index",
							slug: `/prompts/${g.id}`,
							title: g.label,
							description: g.description,
						},
			};
			const path = join(groupDir(g.id), "_category_.json");
			await Bun.write(path, await formatJson(cat, path));
		}),
	);
};
