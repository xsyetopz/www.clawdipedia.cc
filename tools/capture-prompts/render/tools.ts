import { join } from "node:path";

import { ctx, groupDir, nextPos } from "./ctx.ts";
import { pageLink, pagePath, relink } from "./link.ts";
import { fence, fmt, stripTrailing, toolDiff } from "./text.ts";
import type { Cap } from "./types.ts";

// tools-per-variant
const toolLink = (name: string) =>
	`[\`${name}\`](${pagePath("tools", "tools")}#${name.toLowerCase()})`;
const perVariantHead = (def: Cap): string[] => [
	"---",
	`title: "Tools per Variant"`,
	`description: "Which tools each system prompt variant sends, and how the tool text differs."`,
	`sidebar_position: ${nextPos("tools")}`,
	"---",
	"",
	"Tools are part of what the model reads. Each request carries a list of tools, and each tool has a name, a description, and a schema. This page compares the lists across variants.",
	"",
	"## Default Tool List",
	"",
	`The default list has ${def.tools.length} tools on Opus 5.5. The columns show the length of the description and of the JSON schema, in characters.`,
	"",
	"| Tool | Description | Schema |",
	"| --- | --- | --- |",
	...def.tools.map(
		(t) => `| ${toolLink(t.name)} | ${fmt(t.desc)} | ${fmt(t.schema)} |`,
	),
	"",
	"## Differences by Variant",
	"",
	"Each row compares one variant to the default list. Variants with the same tools and text as the default are grouped at the end.",
	"",
	"| Variant | Tools | Difference |",
	"| --- | --- | --- |",
];

const perVariantRows = (def: Cap): string[] => {
	const rows: string[] = [];
	const same: string[] = [];
	for (const [id, c] of ctx.caps) {
		if (id === "default-lean") {
			continue;
		}
		const d = toolDiff(def.tools, c.tools);
		if (d === "") {
			same.push(pageLink("tools", id, c.v.title));
		} else {
			rows.push(
				`| ${pageLink("tools", id, c.v.title)} | ${c.tools.length} | ${d} |`,
			);
		}
	}
	return [
		...rows,
		"",
		"## Same Tools as the Default",
		"",
		`${same.join(", ")}.`,
		"",
	];
};

const bareLines = (): string[] => {
	const bare = ctx.caps.get("bare");
	return bare
		? [
				"## Bare Mode Tools",
				"",
				"| Tool | Description | Schema |",
				"| --- | --- | --- |",
				...bare.tools.map(
					(t) => `| \`${t.name}\` | ${fmt(t.desc)} | ${fmt(t.schema)} |`,
				),
				"",
			]
		: [];
};

export const toolsPerVariantPage = async (): Promise<void> => {
	const def = ctx.caps.get("default-lean");
	if (!def) {
		throw new Error("missing default-lean capture");
	}
	const L = [...perVariantHead(def), ...perVariantRows(def), ...bareLines()];
	await Bun.write(
		join(groupDir("tools"), "tools-per-variant.md"),
		stripTrailing(L.join("\n")),
	);
};

// tools: the default text of every tool, deferred ones from tools-upfront
export const toolsPage = async (): Promise<void> => {
	const def = ctx.caps.get("default-lean");
	const all = ctx.caps.get("tools-upfront") ?? def;
	if (!def || !all) {
		throw new Error("missing default-lean capture");
	}
	const upfront = new Set(def.tools.map((t) => t.name));
	const sent = new Set(all.tools.map((t) => t.name));
	const list = [...all.tools, ...def.tools.filter((t) => !sent.has(t.name))];
	const L: string[] = [
		"---",
		`title: "Tool Descriptions"`,
		`description: "The default description and input schema of every tool Claude Code sends, and how to override them."`,
		`sidebar_position: ${nextPos("tools")}`,
		"---",
		"",
		`This page shows the text the model reads for each tool: the description and the JSON input schema. The text comes from [${all.v.title}](./${all.v.id}.md), which sends ${all.tools.length} tools with their full text, and from the default request, which sends ${def.tools.length} tools in full. It lists the rest only by name, and \`ToolSearch\` loads their text when the model asks for it.`,
		"",
		"Gated tools, and tools that only the interactive screen or other modes add (such as `AskUserQuestion`, `EnterPlanMode`, and the task tools), are not in this capture. See [Tools](../reference/tools/index.md) for the full list.",
		"",
		"## How to Override",
		"",
		"| What | How | Where to read more |",
		"| --- | --- | --- |",
		"| A tool's description | A Mod API `tool.describe` hook gets the description and returns a new one. It works for built-in and MCP tools. | [Mod API Tools, Commands, and Config](../extend/mod-api/calls/tool-command-config.md) |",
		"| Deferred or sent upfront | `ENABLE_TOOL_SEARCH`, or `isDeferred` from a `tool.describe` hook. | [Tools and Bash Variables](../configure/env-vars/tools-and-bash.md) |",
		"| MCP tool description length | `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` | [Plugins and MCP Variables](../configure/env-vars/plugins-and-mcp.md) |",
		"| Which tools are sent | `--tools`, `--disallowedTools`, or a deny rule removes a tool. | [Tools](../reference/tools/index.md) |",
		"",
		"## Tools",
		"",
	].map((s) => relink("tools", s));
	for (const t of list) {
		L.push(
			`### \`${t.name}\``,
			"",
			`Sent in full by default: ${upfront.has(t.name) ? "✅ Yes" : "❌ No, deferred"}. Description: ${fmt(t.desc)} characters. Schema: ${fmt(t.schema)} characters.`,
			"",
			fence(t.text || "(no description)", "text"),
			"",
			fence(t.schemaText, "json skip-lint"),
			"",
		);
	}
	await Bun.write(
		join(groupDir("tools"), "tools.md"),
		stripTrailing(L.join("\n")),
	);
};
