import { join } from "node:path";

import { NOTES } from "../notes.ts";
import { ctx, groupDir, nextPos } from "./ctx.ts";
import { pageLink, relink } from "./link.ts";
import { fence, fmt, stripTrailing, toolDiff, udiff, yaml } from "./text.ts";
import type { Cap } from "./types.ts";

const frontMatterLines = (c: Cap): string[] => [
	"---",
	`title: ${yaml(c.v.title)}`,
	`description: ${yaml(c.v.summary.replaceAll("`", ""))}`,
	`sidebar_position: ${nextPos(c.v.group)}`,
	"---",
	"",
];

const sizeLines = (c: Cap): string[] => {
	let sysChars = 0;
	for (const p of c.parts) {
		if (p.label.startsWith("system[")) {
			sysChars += p.text.length;
		}
	}
	return [
		`${c.v.summary} ${c.v.how}`,
		"",
		"## Size",
		"",
		"| Part | Characters |",
		"| --- | --- |",
		...c.parts.map(
			(p) => `| \`${p.label.replace(/ \(.*/u, "")}\` | ${fmt(p.text.length)} |`,
		),
		`| System blocks only | ${fmt(sysChars)} |`,
		`| Everything shown here | ${fmt(c.chars)} |`,
		`| Tools sent | ${c.tools.length} |`,
		"",
		"Sizes count the text after the placeholders are in place. Each placeholder counts at its own length.",
		"",
	];
};

const noticeLines = (c: Cap): string[] => {
	const notes = NOTES[c.v.id];
	return notes === undefined || notes.length === 0
		? []
		: [
				"## What to Notice",
				"",
				...notes.map((x) => `- ${relink(c.v.group, x)}`),
				"",
			];
};

const fullTextLines = (c: Cap, dup: string | undefined): string[] => {
	if (dup !== undefined) {
		return [
			"## Full Text",
			"",
			`This variant sends exactly the same text and tools as ${pageLink(c.v.group, dup, ctx.caps.get(dup)?.v.title ?? dup)}. The page for that variant has the full text.`,
			"",
		];
	}
	return [
		"## Full Text",
		"",
		"The text below is every part of the request that Claude Code builds before your own message, in the order it is sent.",
		"",
		fence(c.text, "text"),
		"",
	];
};

const countLines = (d: string, prefix: string, skip: string): number =>
	d.split("\n").filter((l) => l.startsWith(prefix) && !l.startsWith(skip))
		.length;

const diffLines = async (c: Cap, base: Cap): Promise<string[]> => {
	const { group } = c.v;
	const d = await udiff(base.text, c.text, base.v.id, c.v.id);
	const lines = [
		"## Compared to the Default",
		"",
		`The diff below starts from ${pageLink(group, base.v.id, base.v.title)}. Lines that start with \`-\` are only in the baseline. Lines that start with \`+\` are only here.`,
		"",
	];
	if (d === "") {
		lines.push("There are no differences in the text.", "");
	} else {
		const sign = c.chars - base.chars >= 0 ? "+" : "";
		lines.push(
			`Lines added: ${countLines(d, "+", "+++")}. Lines removed: ${countLines(d, "-", "---")}. Size change: ${sign}${fmt(c.chars - base.chars)} characters.`,
			"",
			fence(d, "diff"),
			"",
		);
	}
	const td = toolDiff(base.tools, c.tools);
	lines.push(
		td === ""
			? "The tool list is the same as the baseline."
			: `Tool list: ${td} See ${pageLink(group, "tools-per-variant", "Tools per Variant")}.`,
		"",
	);
	return lines;
};

const baselineLines = (c: Cap): Promise<string[]> => {
	const base =
		c.v.baseline === undefined ? undefined : ctx.caps.get(c.v.baseline);
	if (base && base.v.id !== c.v.id) {
		return diffLines(c, base);
	}
	return Promise.resolve([
		"## Compared to the Default",
		"",
		"This variant is the baseline. Other pages diff against it.",
		"",
	]);
};

const variantPage = async (id: string, c: Cap): Promise<void> => {
	const lines = [
		...frontMatterLines(c),
		...sizeLines(c),
		...noticeLines(c),
		...fullTextLines(c, ctx.dupOf.get(id)),
		...(await baselineLines(c)),
	];
	await Bun.write(
		join(groupDir(c.v.group), `${id}.md`),
		stripTrailing(lines.join("\n")),
	);
};

export const variantPages = async (): Promise<void> => {
	const pages: Promise<void>[] = [];
	for (const [id, c] of ctx.caps) {
		// each page takes its sidebar position before its first await, so positions follow capture order
		ctx.pageOrder.push(id);
		pages.push(variantPage(id, c));
	}
	await Promise.all(pages);
};
