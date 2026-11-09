import type { PromptGroup } from "../variants.ts";
import { ctx } from "./ctx.ts";

// "root" is docs/prompts/ itself, where index.md sits.
export type Place = PromptGroup | "root";

// the group of each page that the listing steps write
const LISTING_PLACE: Record<string, Place> = {
	index: "root",
	tools: "tools",
	"tools-per-variant": "tools",
	"built-in-agents": "agents",
	"built-in-skills": "skills",
};

export const placeOf = (id: string): Place => {
	const place =
		LISTING_PLACE[id] ??
		ctx.caps.get(id)?.v.group ??
		ctx.hand.find((h) => h.id === id)?.group;
	if (!place) {
		throw new Error(`no group for the prompt page "${id}"`);
	}
	return place;
};

// the relative path from a page in `from` to the page `id`
export const pagePath = (from: Place, id: string) => {
	const to = placeOf(id);
	if (from === to) {
		return `./${id}.md`;
	}
	if (to === "root") {
		return `../${id}.md`;
	}
	return from === "root" ? `./${to}/${id}.md` : `../${to}/${id}.md`;
};

export const pageLink = (from: Place, id: string, title: string) =>
	`[${title}](${pagePath(from, id)})`;

// Text is written with ./<id>.md for a prompt page and ../ for a page outside docs/prompts/.
// This moves both to the place of the page that holds the text.
export const relink = (from: Place, text: string) =>
	text
		.replaceAll("](../", from === "root" ? "](../" : "](../../")
		.replaceAll(
			/\]\(\.\/([A-Za-z0-9-]+)\.md/gu,
			(_, id: string) => `](${pagePath(from, id)}`,
		);
