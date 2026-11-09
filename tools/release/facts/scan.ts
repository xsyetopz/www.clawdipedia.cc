// The scan of release:facts: version-labelled sentences in docs/, found with git grep.
import { createHash } from "node:crypto";
import { join } from "node:path";

import { ROOT, toolEnv } from "../util.ts";
import type { Fact, FactClass } from "./types.ts";

const VERSION_RE = /2\.1\.\d+/u;
// A phrase before the version, `from` right before it, or `(or|and) later|newer|earlier` right after it.
const CHANGE_RE =
	/\b(?:(?:since|new in|added in|changed in|as of|removed in|dropped in|before|older than)\b.{0,40}?|from\s+[`(]?)2\.1\.\d+|2\.1\.\d+[`)]*\s+(?:or|and)\s+(?:later|newer|earlier)\b/iu;
const GAP_RE = /\bnot checked on\b/iu;
const FENCE_RE = /^\s*(`{3,}|~{3,})(.*)$/u;
const HEADING_RE = /^#{1,6}\s+(.*)$/u;

export const classify = (text: string): FactClass => {
	if (GAP_RE.test(text)) {
		return "gap";
	}
	return CHANGE_RE.test(text) ? "change" : "info";
};

export const normalise = (s: string): string =>
	s.toLowerCase().replaceAll(/\s+/gu, " ").trim();

export const slug = (h: string): string =>
	h
		.toLowerCase()
		.trim()
		// keeps non-ASCII letters; drops backticks and punctuation
		.replaceAll(/[^\p{L}\p{N}_ -]/gu, "")
		// one hyphen per space, as github-slugger does ("A — B" -> "a--b")
		.replaceAll(" ", "-");

export const factId = (file: string, heading: string, text: string): string =>
	`${file}#${slug(heading)}:${createHash("sha1").update(normalise(text)).digest("hex").slice(0, 8)}`;

/** The sentences of a prose line that carry a version. Table rows stay whole. */
const units = (line: string): string[] => {
	const t = line.trim();
	if (t.startsWith("|")) {
		return [t];
	}
	const bare = t.replace(/^(?:[-*+]|\d+\.)\s+/u, "");
	return bare
		.split(/(?<=[.!?])\s+(?=[A-Z`"(])/u)
		.filter((s) => VERSION_RE.test(s));
};

type Fence = { ch: string; len: number } | null;

/** A closing fence has the same character, at least the same length, and no text after it. */
const nextFence = (fence: Fence, marker: string, rest: string): Fence => {
	const ch = marker[0] ?? "`";
	if (fence === null) {
		return { ch, len: marker.length };
	}
	return ch === fence.ch && marker.length >= fence.len && rest.trim() === ""
		? null
		: fence;
};

const headingOf = (line: string): string | undefined => {
	const h = HEADING_RE.exec(line)?.[1];
	return h === undefined || h === "" ? undefined : h.trim();
};

/** For each line: its heading, and which 1-based lines are frontmatter (`skip`) or fences (`inFence`). */
const layoutOf = (lines: string[]) => {
	const headingAt: string[] = [];
	const inFence = new Set<number>();
	const skip = new Set<number>();
	let cur = "";
	let fence: Fence = null;
	let front = lines[0]?.trim() === "---";
	for (const [i, l] of lines.entries()) {
		if (front) {
			skip.add(i + 1);
			if (i > 0 && l.trim() === "---") {
				front = false;
			}
		}
		const f = FENCE_RE.exec(l);
		if (f?.[1] !== undefined) {
			fence = nextFence(fence, f[1], f[2] ?? "");
			inFence.add(i + 1);
		} else if (fence !== null) {
			inFence.add(i + 1);
		}
		if (fence === null && !front) {
			cur = headingOf(l) ?? cur;
		}
		headingAt[i] = cur;
	}
	return { headingAt, inFence, skip };
};

/**
 * Facts of one file. `hitLines` are 1-based lines that match the version regex (from git grep).
 * Same unit on two lines gets one fact (first line).
 */
export const factsFromFile = (
	file: string,
	content: string,
	hitLines: number[],
): Fact[] => {
	const lines = content.split("\n");
	const { headingAt, inFence, skip } = layoutOf(lines);
	const seen = new Set<string>();
	const out: Fact[] = [];
	for (const n of hitLines) {
		if (skip.has(n) || inFence.has(n)) {
			continue;
		}
		const heading = headingAt[n - 1] ?? "";
		for (const u of units(lines[n - 1] ?? "")) {
			const id = factId(file, heading, u);
			if (seen.has(id)) {
				continue;
			}
			seen.add(id);
			out.push({
				id,
				file,
				line: n,
				text: u,
				heading,
				class: classify(u),
				kind: null,
				probes: [],
				status: "unmapped",
			});
		}
	}
	return out;
};

/**
 * `git grep -n --untracked -E '2\.1\.[0-9]+' -- docs` as file -> lines.
 * `--untracked` covers a page that a split or a new page created and nobody staged yet,
 * because without it the facts of that page never reach the gate.
 */
export const grepHits = async (root = ROOT): Promise<Map<string, number[]>> => {
	const p = Bun.spawn(
		[
			"git",
			"grep",
			"-n",
			"--untracked",
			"-E",
			String.raw`2\.1\.[0-9]+`,
			"--",
			"docs",
		],
		{ cwd: root, env: toolEnv(), stdout: "pipe" },
	);
	const out = await new Response(p.stdout).text();
	const hits = new Map<string, number[]>();
	for (const l of out.split("\n")) {
		const m = /^([^:]+):(\d+):/u.exec(l);
		if (m?.[1] === undefined || m[2] === undefined) {
			continue;
		}
		hits.set(m[1], [...(hits.get(m[1]) ?? []), Number(m[2])]);
	}
	return hits;
};

export const findFacts = async (): Promise<Fact[]> => {
	const hits = [...(await grepHits())].toSorted(([a], [b]) =>
		a.localeCompare(b),
	);
	const perFile = await Promise.all(
		hits.map(async ([file, lines]) =>
			factsFromFile(file, await Bun.file(join(ROOT, file)).text(), lines),
		),
	);
	return perFile.flat();
};
