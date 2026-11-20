import { basename } from "node:path";

import { lineTerms } from "./citation-terms.ts";
import { linesOf, sameLine } from "./clean-lines.ts";
import { moduleMapper } from "./module-map.ts";
import {
	claimTerms,
	relocate,
	sameFrame,
	type Source,
	termNear,
} from "./relocate.ts";
import { NEAR_LINES, termLine, termOffset } from "./term-move.ts";

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
	how: "same" | "term" | "module" | "unmapped";
}

const FOLLOW_ON =
	/(chunk-[\da-z]+\.js)(?:([:@])(\d+)(?:-(\d+))?|(`? lines )(\d+) to (\d+))?|(?<=`):(\d+)(?:-(\d+))?(?=`)/gu;
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

/**
 * The fallback for a number that `sameCode` cannot place: the code spans and quoted strings of the claim line (`lineTerms`, as the term
 * check reads them) are looked up near the number in the old module, then in the new one. Of the places that hold the term, the one with
 * the most alike surroundings wins, and the nearest to `n` breaks a tie. The number keeps its offset from the term.
 */
const termCode = (
	{ old, target }: Pair,
	form: string,
	n: number,
	terms: string[],
): number | undefined => {
	if (terms.length === 0) {
		return undefined;
	}
	const a = linesOf(old);
	const b = linesOf(target);
	if (form === "lines" || (form === ":" && isLine(old, a, n, terms))) {
		return a && b && n >= 1 && n <= a.length
			? termLine(a, b, n, terms)
			: undefined;
	}
	return termOffset(old.text, target.text, n, terms);
};

type Group = string | undefined;

interface Claim {
	file: string;
	line: number;
	terms: string[];
	/** The code spans and quoted strings of the line, for the term fallback. */
	spans: string[];
}

// Each end of a range finds its code on its own, so the two can land out of order; a reversed range does not move.
const ordered = (a: number | undefined, b: number | "" | undefined): boolean =>
	a === undefined || b === undefined || b === "" || a <= b;

const howMoved = (moved: boolean, viaTerm: boolean): Move["how"] => {
	if (!moved) {
		return "module";
	}
	return viaTerm ? "term" : "same";
};

/** Where number `n` moves: with its code, or by a term of the line when that fails. */
const place = (
	pair: Pair,
	form: string,
	n: number,
	{ terms, spans }: Claim,
): { at?: number; term?: boolean } => {
	const same = sameCode(pair, form, n, terms);
	if (same !== undefined) {
		return { at: same };
	}
	const at = termCode(pair, form, n, spans);
	return at === undefined ? {} : { at, term: true };
};

/** Moves one citation that names a chunk: gives its new text, and the pair that the numbers after it on the line move with. */
const moveChunk = (
	{ oldByName, newNames, mapModule, moves }: Ctx,
	claim: Claim,
	found: string,
	chunk: string,
	[sep, offset, offsetEnd, lead, first, end]: Group[],
): { text: string; pair?: Pair } => {
	const { file, line } = claim;
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
	let viaTerm = false;
	const sameAt = (n: Group, form = ":"): number | undefined => {
		const placed = n === undefined ? {} : place(pair, form, Number(n), claim);
		viaTerm ||= placed.term === true;
		return placed.at;
	};
	const name = basename(target.name);
	const moved = sameAt(offset, sep);
	// A `:A-B` moves only when both ends find their code, so a range never mixes builds.
	const movedEnd = offsetEnd === undefined ? "" : sameAt(offsetEnd, sep);
	const range = [sameAt(first, "lines"), sameAt(end, "lines")];
	const numbers =
		moved === undefined
			? range.every((n) => n !== undefined) &&
				ordered(range[0], range[1]) &&
				`${lead}${range[0]} to ${range[1]}`
			: movedEnd !== undefined &&
				ordered(moved, movedEnd) &&
				`${sep}${moved}${movedEnd === "" ? "" : `-${movedEnd}`}`;
	const text =
		numbers === false ? found.replace(chunk, name) : `${name}${numbers}`;
	moves.push({
		file,
		line,
		from: found,
		to: text,
		how: howMoved(numbers !== false, viaTerm),
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
	const spans = lineTerms(lineText);
	let last: Pair | undefined;
	const sameAt = (n: Group): number | undefined =>
		last && n !== undefined
			? (sameCode(last, ":", Number(n), terms) ??
				termCode(last, ":", Number(n), spans))
			: undefined;
	return lineText.replaceAll(FOLLOW_ON, (found: string, ...groups: Group[]) => {
		const [chunk, sep, offset, offsetEnd, lead, first, end, from, to] = groups;
		if (chunk === undefined) {
			return `:${sameAt(from) ?? from}${to === undefined ? "" : `-${sameAt(to) ?? to}`}`;
		}
		const numbers = [sep, offset, offsetEnd, lead, first, end];
		const moved = moveChunk(
			ctx,
			{ file, line, terms, spans },
			found,
			chunk,
			numbers,
		);
		last = moved.pair;
		return moved.text;
	});
};

/**
 * Moves the chunk citations in `files` (file name to Markdown text) from the build of `oldSources` to the build of `newSources`.
 * A citation that names a module of the old build and not of the new one moves to the new module that shares the most long string
 * literals with it. A number moves with its code ("same"); when that fails, it moves by a code span or quoted string of its line that stands near it in the
 * old module and is found in the new one ("term"); otherwise the numbers stay ("module").
 * A `lines A to B` form counts lines of the cleaned module (`clean` of a source), and so does a `:N` that the cleaned module has as a
 * line, unless the words of the claim stand only near the raw offset `N`: such a line moves to the nearest place with the same lines
 * around it. A `@N`, and each other `:N`, is a raw offset: it moves when `relocate` finds the same code, or stays when the code
 * around that offset is the same in both modules. A `:A-B` after a chunk moves only when both ends move.
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
