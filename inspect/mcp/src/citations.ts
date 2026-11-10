import { basename } from "node:path";

import {
	claimTerms,
	relocate,
	sameFrame,
	type Source,
	termNear,
} from "./relocate.ts";

/** One citation of a program chunk in a Markdown file. */
export interface Citation {
	file: string;
	/** 1-based line of the citation in the file. */
	line: number;
	/** The text as written: `chunk-x.js`, `chunk-x.js:N`, `chunk-x.js@N`, or `chunk-x.js lines A to B`. */
	citation: string;
	/** The chunk file name. */
	chunk: string;
}

const CITATION = /(chunk-[\da-z]+\.js)(?:[:@]\d+|`? lines \d+ to \d+)?/gu;

/** The chunk citations in Markdown `text`, in order, with the 1-based line of each. */
export const findCitations = (file: string, text: string): Citation[] =>
	text.split("\n").flatMap((lineText, i) =>
		[...lineText.matchAll(CITATION)].map((m) => ({
			file,
			line: i + 1,
			citation: m[0],
			chunk: m[1] ?? m[0],
		})),
	);

/**
 * The chunk citations in `files` (file name to Markdown text) whose chunk is not among `moduleNames`.
 * A module name may be a path, as in the program; only its last part is compared.
 */
export const staleCitations = (
	files: Record<string, string>,
	moduleNames: Iterable<string>,
): Citation[] => {
	const known = new Set([...moduleNames].map((n) => basename(n)));
	return Object.entries(files)
		.flatMap(([file, text]) => findCitations(file, text))
		.filter((c) => !known.has(c.chunk));
};

/** One citation moved to a newer build. `to` is absent when no module of the new build matches. */
export interface Move {
	file: string;
	line: number;
	from: string;
	to?: string;
	how: "same" | "module" | "unmapped";
}

const FOLLOW_ON =
	/(chunk-[\da-z]+\.js)(?:([:@])(\d+)|(`? lines )(\d+) to (\d+))?|(?<=`):(\d+)(?:-(\d+))?(?=`)/gu;
const LITERAL = /"[^"\\\n]{20,}"/gu;

/** Maps an old module to the new module that shares the most long string literals with it, once for each old module. */
const moduleMapper = (
	oldByName: Map<string, Source>,
	newSources: Source[],
): ((chunk: string) => Source | undefined) => {
	const literals = newSources.map((source) => ({
		source,
		literals: new Set(source.text.match(LITERAL)),
	}));
	const mapped = new Map<string, Source | undefined>();
	return (chunk) => {
		if (!mapped.has(chunk)) {
			const old = new Set(oldByName.get(chunk)?.text.match(LITERAL));
			const [best] = literals
				.map((n) => ({
					source: n.source,
					shared: [...old].filter((l) => n.literals.has(l)).length,
				}))
				.toSorted((a, b) => b.shared - a.shared);
			mapped.set(chunk, best && best.shared > 0 ? best.source : undefined);
		}
		return mapped.get(chunk);
	};
};

interface Ctx {
	oldByName: Map<string, Source>;
	newNames: Set<string>;
	mapModule: (chunk: string) => Source | undefined;
	moves: Move[];
}

interface Pair {
	old: Source;
	target: Source;
}

const NEAR_LINES = 10;
const MIN_WINDOW = 40;

// The cleaner names a declaration, and a chunk, by a hash of its code, so changed code has another name in each build.
const HASH_NAME = /\$[\da-f]{6}\b|chunk@[\da-f]{8}\.js/gu;
const cleanLines = new WeakMap<Source, string[]>();
const linesOf = (s: Source): string[] | undefined => {
	if (s.clean === undefined) {
		return undefined;
	}
	const lines =
		cleanLines.get(s) ??
		s.clean.split("\n").map((l) => l.trim().replaceAll(HASH_NAME, "$"));
	cleanLines.set(s, lines);
	return lines;
};

/** Where line `n` (1-based) of `a` sits in `b`: the nearest place with the same lines around it. A window of little text could match anywhere, so it is skipped. */
const sameLine = (a: string[], b: string[], n: number): number | undefined => {
	for (const radius of [4, 2, 1]) {
		const before = Math.min(radius, n - 1);
		const want = a.slice(n - 1 - before, n + radius);
		if (want.join("").length >= MIN_WINDOW) {
			for (let k = 0; k < Math.max(a.length, b.length); k += 1) {
				const to = [n - k, n + k].find((line) => {
					const at = line - 1 - before;
					return at >= 0 && want.every((l, i) => b[at + i] === l);
				});
				if (to !== undefined) {
					return to;
				}
			}
		}
	}
	return undefined;
};

// A `:N` is a line of the cleaned module in some citations and a raw offset in others: the claim's own words decide, and a line wins a tie.
const isLine = (
	old: Source,
	lines: string[] | undefined,
	n: number,
	terms: string[],
): boolean =>
	lines !== undefined &&
	n <= lines.length &&
	(!termNear(old.text, n, terms) ||
		terms.some((t) =>
			lines
				.slice(Math.max(0, n - 1 - NEAR_LINES), n + NEAR_LINES)
				.join("\n")
				.includes(t),
		));

const sameCode = (
	{ old, target }: Pair,
	form: string,
	n: number,
	terms: string[],
): number | undefined => {
	const a = linesOf(old);
	const b = linesOf(target);
	if (form === "lines" || (form === ":" && isLine(old, a, n, terms))) {
		return a && b ? sameLine(a, b, n) : undefined;
	}
	const [r] = relocate(old.text, n, terms, [target], 1);
	if (r?.same === true) {
		return r.offset;
	}
	// With no anchor near, the code can still sit at the same offset; past the end, two empty frames would match.
	return n < old.text.length && sameFrame(old.text, n, target.text, n)
		? n
		: undefined;
};

type Group = string | undefined;

interface Claim {
	file: string;
	line: number;
	terms: string[];
}

/** Moves one citation that names a chunk: gives its new text, and the pair that the numbers after it on the line move with. */
const moveChunk = (
	{ oldByName, newNames, mapModule, moves }: Ctx,
	{ file, line, terms }: Claim,
	found: string,
	chunk: string,
	[sep, offset, lead, first, end]: Group[],
): { text: string; pair?: Pair } => {
	const old = newNames.has(chunk) ? undefined : oldByName.get(chunk);
	if (!old) {
		return { text: found };
	}
	const target = mapModule(chunk);
	if (!target) {
		moves.push({ file, line, from: found, how: "unmapped" });
		return { text: found };
	}
	const pair = { old, target };
	const sameAt = (n: Group, form = ":"): number | undefined =>
		n === undefined ? undefined : sameCode(pair, form, Number(n), terms);
	const name = basename(target.name);
	const moved = sameAt(offset, sep);
	const range = [sameAt(first, "lines"), sameAt(end, "lines")];
	const numbers =
		moved === undefined
			? range.every((n) => n !== undefined) &&
				`${lead}${range[0]} to ${range[1]}`
			: `${sep}${moved}`;
	const text =
		numbers === false ? found.replace(chunk, name) : `${name}${numbers}`;
	moves.push({
		file,
		line,
		from: found,
		to: text,
		how: numbers === false ? "module" : "same",
	});
	return { text, pair };
};

const moveLine = (
	ctx: Ctx,
	file: string,
	line: number,
	lineText: string,
): string => {
	const terms = claimTerms(lineText);
	let last: Pair | undefined;
	const sameAt = (n: Group): number | undefined =>
		last && n !== undefined ? sameCode(last, ":", Number(n), terms) : undefined;
	return lineText.replaceAll(FOLLOW_ON, (found: string, ...groups: Group[]) => {
		const [chunk, sep, offset, lead, first, end, from, to] = groups;
		if (chunk === undefined) {
			return `:${sameAt(from) ?? from}${to === undefined ? "" : `-${sameAt(to) ?? to}`}`;
		}
		const numbers = [sep, offset, lead, first, end];
		const moved = moveChunk(ctx, { file, line, terms }, found, chunk, numbers);
		last = moved.pair;
		return moved.text;
	});
};

/**
 * Moves the chunk citations in `files` (file name to Markdown text) from the build of `oldSources` to the build of `newSources`.
 * A citation that names a module of the old build and not of the new one moves to the new module that shares the most long string
 * literals with it. A number moves with its code ("same"); otherwise the numbers stay ("module").
 * A `lines A to B` form counts lines of the cleaned module (`clean` of a source), and so does a `:N` that the cleaned module has as a
 * line, unless the words of the claim stand only near the raw offset `N`: such a line moves to the nearest place with the same lines
 * around it. A `@N`, and each other `:N`, is a raw offset: it moves when `relocate` finds the same code, or stays when the code
 * around that offset is the same in both modules.
 * A backticked `:N` or `:N-M` after a citation on the same line moves with the last chunk named before it.
 * Gives each move and the rewritten text of each file.
 */
export const moveCitations = (
	files: Record<string, string>,
	oldSources: Source[],
	newSources: Source[],
): { moves: Move[]; files: Record<string, string> } => {
	const oldByName = new Map(oldSources.map((s) => [basename(s.name), s]));
	const ctx: Ctx = {
		oldByName,
		newNames: new Set(newSources.map((s) => basename(s.name))),
		mapModule: moduleMapper(oldByName, newSources),
		moves: [],
	};
	const out = Object.fromEntries(
		Object.entries(files).map(([file, text]) => [
			file,
			text
				.split("\n")
				.map((lineText, i) => moveLine(ctx, file, i + 1, lineText))
				.join("\n"),
		]),
	);
	return { moves: ctx.moves, files: out };
};
