import { readdir, rm } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { VARIANTS } from "../variants.ts";
import { ctx, DOCS } from "./ctx.ts";
import { isGroup } from "./groups.ts";
import { pageLink, type Place } from "./link.ts";
import { sortStrings } from "./text.ts";
import type { FrontMatter, HandPage } from "./types.ts";

const frontMatter = async (file: string): Promise<FrontMatter> => {
	const content = await Bun.file(file).text();
	const raw = content.replace(/^﻿/u, "").replaceAll("\r\n", "\n");
	const m = /^---\n([\s\S]*?)\n---\n/u.exec(raw);
	const body = m?.[1];
	const yaml: unknown =
		body !== undefined && body !== "" ? Bun.YAML.parse(body) : {};
	return isFrontMatter(yaml) ? yaml : {};
};

const isFrontMatter = (v: unknown): v is FrontMatter =>
	typeof v === "object" && v !== null;

/** Check one hand-written page and add it to the shared state. */
const addHand = (f: string, fm: FrontMatter): void => {
	const id = basename(f, ".md");
	if (VARIANTS.some((v) => v.id === id)) {
		throw new Error(
			`docs/prompts/${f} is hand-written (generated: false) but its name collides with variant id "${id}".`,
		);
	}
	const { group } = fm;
	if (!isGroup(group)) {
		throw new Error(
			`docs/prompts/${f} is hand-written but its front matter has no valid "group" (got ${JSON.stringify(group)}).`,
		);
	}
	if (dirname(f) !== group) {
		throw new Error(
			`docs/prompts/${f} has group "${group}" but sits in the folder "${dirname(f)}".`,
		);
	}
	ctx.hand.push({
		id,
		title: String(fm.title),
		group,
		row: fm.index,
	});
};

// Scans docs/prompts/** : keeps a page with generated: false, deletes every other page.
// index.md and the _category_.json files are not touched.
export const loadHand = async (): Promise<void> => {
	const files = sortStrings(await readdir(DOCS, { recursive: true })).filter(
		(f) => f.endsWith(".md") && f !== "index.md",
	);
	const fronts = await Promise.all(
		files.map((f) => frontMatter(join(DOCS, f))),
	);
	const removals: Promise<void>[] = [];
	for (const [i, f] of files.entries()) {
		const fm = fronts[i] ?? {};
		if (fm.generated === false) {
			addHand(f, fm);
		} else {
			removals.push(rm(join(DOCS, f)));
		}
	}
	await Promise.all(removals);
};
// hand-written rows go after the generated row named in `after`, else at the end
export const handRows = (afterId?: string) =>
	ctx.hand.filter(
		(h) =>
			h.row !== undefined &&
			(afterId === undefined
				? h.row.after === undefined ||
					h.row.after === "" ||
					!ctx.caps.has(h.row.after)
				: h.row.after === afterId),
	);
export const handLink = (h: HandPage, from: Place) =>
	pageLink(from, h.id, h.title);
export const handIndexRow = (h: HandPage, from: Place) =>
	`| ${handLink(h, from)} | ${h.row?.change} | ${h.row?.toggle} | ${h.row?.where} | <${h.row?.status} /> |`;
