import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";
import type { PromptGroup } from "../variants.ts";
import type { Cap, HandPage } from "./types.ts";

const ROOT = join(import.meta.dir, "..", "..", "..");
export const CAPTURES =
	process.env["CAPTURE_OUT"] ??
	join(ROOT, "captures", CLAUDE_CODE_VERSION, "prompts");
export const OUT = join(import.meta.dir, "..", "out");
export const DOCS = join(ROOT, "docs", "prompts");
await mkdir(OUT, { recursive: true });
await mkdir(DOCS, { recursive: true });

// the folder of a group; Bun.write makes it on first write
export const groupDir = (group: PromptGroup) => join(DOCS, group);

const caps = new Map<string, Cap>();
const hand: HandPage[] = [];
const dupOf = new Map<string, string>();
const pos: Partial<Record<PromptGroup, number>> = {};
const pageOrder: string[] = [];

// The state that the render steps share. Each step runs in the order that render.ts calls it.
export const ctx = { caps, hand, dupOf, pos, pageOrder };

// the next sidebar_position in a group; each group counts from 1
export const nextPos = (group: PromptGroup) => {
	const n = (ctx.pos[group] ?? 0) + 1;
	ctx.pos[group] = n;
	return n;
};
