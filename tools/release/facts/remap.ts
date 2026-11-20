// release:facts --remap: carries map.json across a docs edit. An edited sentence gets a new fact id, so its
// entry goes stale and the new id is unmapped. A close stale sentence in the same file passes on its entry;
// otherwise the footnotes of the sentence's Markdown block give a source. A fact with neither stays unmapped,
// because a guessed entry would hide an uncited sentence from the gate.
import { join } from "node:path";

import { ROOT, toolEnv } from "../util.ts";
import { factsFromFile } from "./scan.ts";
import type { Fact, FactMap, MapEntry } from "./types.ts";

/** Word overlap below which a stale entry is not passed on: the sentence changed more than its wording. */
export const RENAME_SCORE = 0.85;

const words = (s: string): Set<string> =>
	new Set(s.toLowerCase().match(/[a-z0-9_.`-]+/gu));

/** Shared words over the word count of the shorter sentence (1 means one sentence holds the other). */
export const similarity = (a: string, b: string): number => {
	const x = words(a);
	const y = words(b);
	const shared = [...x].filter((w) => y.has(w)).length;
	return shared / Math.max(1, Math.min(x.size, y.size));
};

// A blank line or a heading ends a Markdown block.
const open = (l: string | undefined): boolean =>
	l !== undefined && l.trim() !== "" && !l.startsWith("#");

/** The lines of the Markdown block (paragraph, list, or table) around a 1-based line, footnote lines left out. */
const blockOf = (lines: string[], line: number): string => {
	let a = line - 1;
	let b = line - 1;
	while (a > 0 && open(lines[a - 1])) {
		a--;
	}
	while (b < lines.length - 1 && open(lines[b + 1])) {
		b++;
	}
	return lines
		.slice(a, b + 1)
		.filter((l) => !l.startsWith("[^"))
		.join("\n");
};

/**
 * The map entry that the citations of a fact give: a program chunk first, then the Mod API type file, then release notes,
 * then an official page.
 * The fact's own line wins over its block, so a sentence takes its own footnote before a neighbour's.
 */
export const entryFromCitations = (
	content: string,
	fact: Pick<Fact, "line" | "text">
): MapEntry | null => {
	const lines = content.split("\n");
	const own = lines[fact.line - 1] ?? "";
	const scope = /\[\^[\w-]+\]/u.test(own) ? own : blockOf(lines, fact.line);
	const notes = [...scope.matchAll(/\[\^([\w-]+)\]/gu)].map(
		(m) => lines.find((l) => l.startsWith(`[^${m[1]}]:`)) ?? ""
	);
	const all = [...notes, scope].join(" ");
	const chunk = /chunk-[a-z0-9]+\.js(?::[0-9-]+)?/u.exec(all)?.[0];
	const notesVersion = /releases\/tag\/v(\d+\.\d+\.\d+)/u.exec(all)?.[1];
	const page = /https:\/\/code\.claude\.com\/[^\s)]+/u.exec(all)?.[0];
	// The type file ships with the program, so a claim read there needs no probe, as a schema change does not.
	const typeFile = all.includes("schemas/claude-code.d.ts");
	if (chunk !== undefined) {
		const rn =
			notesVersion === undefined ? "" : `; release notes ${notesVersion}`;
		return {
			kind: "manual",
			probes: [],
			note: `read in the program at ${chunk}${rn}`
		};
	}
	if (typeFile) {
		return {
			kind: "schema",
			probes: [],
			note: "read in the Mod API type file (schemas/claude-code.d.ts)"
		};
	}
	if (notesVersion !== undefined) {
		return {
			kind: "external",
			probes: [],
			note: `cites the ${notesVersion} release notes`
		};
	}
	return page === undefined
		? null
		: { kind: "external", probes: [], note: `cites ${page}` };
};

/** Inputs of a remap: the facts after applyMap, the map, and the text of each file at the base ref and now. */
export interface RemapInput {
	facts: Fact[];
	map: FactMap;
	before: Map<string, string>;
	now: Map<string, string>;
}

/** The outcome of a remap: the new map, the counts, and the facts that no rule could source. */
export interface RemapResult {
	map: FactMap;
	renamed: number;
	sourced: number;
	dropped: number;
	unsourced: Fact[];
}

const staleTexts = (
	stale: string[],
	before: Map<string, string>
): Map<string, string> => {
	const texts = new Map<string, string>();
	for (const file of new Set(stale.map((s) => s.split("#")[0] ?? ""))) {
		const content = before.get(file);
		if (content === undefined) {
			continue;
		}
		const hits = content
			.split("\n")
			.flatMap((l, i) => (/2\.1\.[0-9]+/u.test(l) ? [i + 1] : []));
		for (const f of factsFromFile(file, content, hits)) {
			texts.set(f.id, f.text);
		}
	}
	return texts;
};

const bestStale = (
	fact: Fact,
	stale: string[],
	texts: Map<string, string>,
	used: Set<string>
): string | null => {
	let best: string | null = null;
	let score = 0;
	for (const s of stale) {
		const t = texts.get(s);
		if (used.has(s) || !s.startsWith(`${fact.file}#`) || t === undefined) {
			continue;
		}
		const v = similarity(fact.text, t);
		if (v > score) {
			score = v;
			best = s;
		}
	}
	return score >= RENAME_SCORE ? best : null;
};

/** Pass stale entries on to edited facts, source the rest from citations, and drop entries no fact uses. */
export const remap = ({ facts, map, before, now }: RemapInput): RemapResult => {
	const ids = new Set(facts.map((f) => f.id));
	const stale = Object.keys(map).filter((k) => !ids.has(k));
	const texts = staleTexts(stale, before);
	const out: FactMap = Object.fromEntries(
		Object.entries(map).filter(([k]) => ids.has(k))
	);
	const used = new Set<string>();
	const unsourced: Fact[] = [];
	let renamed = 0;
	let sourced = 0;
	// The gate (`--check`) holds only change facts to a source; an info or gap fact stays unmapped by design.
	for (const f of facts.filter(
		(x) => x.status === "unmapped" && x.class === "change"
	)) {
		const old = bestStale(f, stale, texts, used);
		const kept = old === null ? undefined : map[old];
		if (old !== null && kept !== undefined) {
			used.add(old);
			out[f.id] = kept;
			renamed++;
			continue;
		}
		const entry = entryFromCitations(now.get(f.file) ?? "", f);
		if (entry === null) {
			unsourced.push(f);
			continue;
		}
		out[f.id] = entry;
		sourced++;
	}
	return {
		map: out,
		renamed,
		sourced,
		dropped: stale.length - used.size,
		unsourced
	};
};

/** The text of each file at a git ref and in the work tree, for every file that holds a fact or a map entry. */
export const readTexts = async (
	facts: Fact[],
	map: FactMap,
	ref: string
): Promise<{ before: Map<string, string>; now: Map<string, string> }> => {
	const files = new Set([
		...facts.map((f) => f.file),
		...Object.keys(map).map((k) => k.split("#")[0] ?? "")
	]);
	const before = new Map<string, string>();
	const now = new Map<string, string>();
	await Promise.all(
		[...files].map(async (file) => {
			const p = Bun.spawn(["git", "show", `${ref}:${file}`], {
				cwd: ROOT,
				env: toolEnv(),
				stdout: "pipe",
				stderr: "ignore"
			});
			const text = await new Response(p.stdout).text();
			if ((await p.exited) === 0) {
				before.set(file, text);
			}
			const current = Bun.file(join(ROOT, file));
			if (await current.exists()) {
				now.set(file, await current.text());
			}
		})
	);
	return { before, now };
};
