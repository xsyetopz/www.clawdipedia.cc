import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";
import { INDEX_FACTS } from "../notes.ts";
import { ctx, DOCS } from "./ctx.ts";
import { handIndexRow, handLink, handRows } from "./hand.ts";
import { pageLink, relink } from "./link.ts";
import { badge, fmt, para, stripTrailing } from "./text.ts";
import type { HandPage } from "./types.ts";

const facts = (lines: string[]) => para(lines).map((l) => relink("root", l));
const FIXED_ROWS = [
	"| [Tool Descriptions](./tools.md) (Every request carries them) | ✅ Yes. A Mod API `tool.describe` hook replaces a description. | `ENABLE_TOOL_SEARCH`, `--tools`, `--disallowedTools`. | Built into the program. | <Undocumented /> |",
	"| [Built-In Skills](./built-in-skills.md) (The main agent reads one line for each) | ✅ Yes. A skill or command with the same name replaces one. | `--disable-slash-commands`. | Built into the program. Override in `.claude/skills/<name>/SKILL.md`. | <Documented /> |",
	"| [Built-In Agents](./built-in-agents.md) (The main agent reads one line for each) | ✅ Yes. An agent with the same name replaces one. | `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS`, `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS`. | Built into the program. Override in `.claude/agents/<name>.md`. | <Documented /> |",
	"| [Tools per Variant](./tools-per-variant.md) (Every request carries the list) | ✅ Yes. Use `--tools`, `--allowedTools`, `--disallowedTools`, or settings. | `--bare` and `CLAUDE_CODE_SIMPLE=1` cut the list to three tools. | Built into the program. | <Undocumented /> |",
];

const promptRows = (): string[] => {
	const rows: string[] = [];
	for (const [id, c] of ctx.caps) {
		const u = c.v.can.use.replace(/^✅? ?Yes\.?\s*/u, "").replace(/\.$/u, "");
		const name = `${pageLink("root", id, c.v.title)}${u === "" ? "" : ` (${u})`}`;
		const ch = c.v.can.change.replace(/^(Yes|No)\b/u, (m) =>
			m === "Yes" ? "✅ Yes" : "❌ No",
		);
		rows.push(
			`| ${name} | ${ch} | ${c.v.can.toggle} | ${c.v.can.where} | ${badge(c.v)} |`,
		);
		for (const h of handRows(id)) {
			rows.push(handIndexRow(h, "root"));
		}
	}
	for (const h of handRows()) {
		rows.push(handIndexRow(h, "root"));
	}
	for (const r of FIXED_ROWS) {
		rows.push(relink("root", r));
	}
	return rows;
};

const handAll = (h: HandPage) =>
	`| ${handLink(h, "root")} | ${h.row?.select} | ${fmt(h.row?.chars ?? 0)} | ${h.row?.tools} | ${h.row?.sections} |`;

const allRows = (afterId?: string) =>
	handRows(afterId)
		.filter((h) => h.row?.select !== undefined)
		.map((h) => handAll(h));

const variantRows = (): string[] => {
	const rows: string[] = [];
	for (const [id, c] of ctx.caps) {
		const dup = ctx.dupOf.get(id);
		const secs =
			c.sections.length > 0
				? c.sections.map((x) => `\`${x}\``).join(", ")
				: "none";
		rows.push(
			`| ${pageLink("root", id, c.v.title)}${dup === undefined ? "" : ` (same text as ${dup})`} | ${c.v.select} | ${fmt(c.chars)} | ${c.tools.length} | ${secs} |`,
		);
		for (const r of allRows(id)) {
			rows.push(r);
		}
	}
	return rows;
};

export const indexPage = async (): Promise<void> => {
	const L: string[] = [
		"---",
		`title: "Captured System Prompts"`,
		`description: "Every system prompt variant you can pick in Claude Code ${CLAUDE_CODE_VERSION}, captured offline and compared."`,
		`sidebar_position: 1`,
		"---",
		"",
		...facts(INDEX_FACTS.intro),
		"",
		"## Every Prompt and How to Change It",
		"",
		"A condition in parentheses after a prompt name is the condition that makes the prompt apply.",
		"",
		"| Prompt | Can You Change It? | Turn On or Off | Where It Lives | Status |",
		"| --- | --- | --- | --- | --- |",
		...promptRows(),
		"",
		"## How the Captures Were Made",
		"",
		...facts(INDEX_FACTS.method),
		"",
		"## The Three System Blocks",
		"",
		...facts(INDEX_FACTS.blocks),
		"",
		"## How Claude Code Picks the Variant",
		"",
		...facts(INDEX_FACTS.flow),
		"",
		"## All Variants",
		"",
		"Size is the number of characters in everything shown on the variant page, after placeholders are in place. The last column lists the `#` headings found in the system body.",
		"",
		"| Variant | How to select it | Characters | Tools | Sections |",
		"| --- | --- | --- | --- | --- |",
		...variantRows(),
		...allRows(),
		"",
		relink("root", "See also [Tools per Variant](./tools-per-variant.md)."),
		"",
		...facts(INDEX_FACTS.placeholders),
		"",
		"## How to Regenerate",
		"",
		...facts(INDEX_FACTS.regen),
		"",
	];
	await Bun.write(join(DOCS, "index.md"), stripTrailing(L.join("\n")));
};
