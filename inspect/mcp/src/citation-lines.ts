// Converts raw-offset citations into lines of the cleaned module: see `--to-lines` in citation-terms.ts.
import {
	lineHit,
	linesWith,
	offsetHit,
	termsByLine,
	WINDOW
} from "./citation-terms.ts";
import { wordSet } from "./term-move.ts";

/** A citation with its optional `-B` end of a range. */
const RANGE = /(chunk-[\da-z]+\.js)([:@])(\d+)(?:-(\d+))?/gu;

/** Lines on each side of a term line whose words tell two places of the same term apart. */
const CONTEXT_LINES = 2;

/** Characters on each side of a minified hit whose words tell two places of the same term apart. */
const CONTEXT_CHARS = 200;

/** A term on more lines than this names no place: the report asks for a read by hand. */
const MAX_LINES = 8;

/** A plain dictionary word, such as `directory` or `Anthropic`, sits near unrelated code and places nothing. */
const PLAIN_WORD = /^[A-Z]?[a-z]+$/u;

/** One citation that `toLines` rewrote or left, with the reason when left. */
export interface LineConversion {
	file: string;
	line: number;
	from: string;
	/** The rewritten citation; absent when left. */
	to?: string;
	term?: string;
	reason?: string;
}

/**
 * The cleaned-module line that holds `term` at raw offset `at`, picked among the lines that hold it by the words
 * around the minified hit. A tie for the best, or no line, gives a reason instead.
 */
const pickLine = (
	code: string,
	rows: readonly string[],
	at: number,
	term: string
): { line: number } | { reason: string } => {
	const hit = code.indexOf(term, Math.max(0, at - WINDOW));
	const want = wordSet(
		code.slice(
			Math.max(0, hit - CONTEXT_CHARS),
			hit + term.length + CONTEXT_CHARS
		)
	);
	const holding = linesWith(rows, term);
	if (holding.length > MAX_LINES) {
		return {
			reason: `"${term}" is on ${holding.length} lines: too common to place`
		};
	}
	const scored = holding
		.map((line) => {
			const got = wordSet(
				rows
					.slice(Math.max(0, line - 1 - CONTEXT_LINES), line + CONTEXT_LINES)
					.join("\n")
			);
			const shared = [...want].filter((w) => got.has(w)).length;
			return { line, score: shared / Math.max(1, want.size, got.size) };
		})
		.toSorted((a, b) => b.score - a.score);
	const [best, next] = scored;
	if (best === undefined) {
		return { reason: `no cleaned line holds "${term}"` };
	}
	if (next !== undefined && next.score === best.score) {
		return {
			reason: `tie between lines ${best.line} and ${next.line} for "${term}"`
		};
	}
	return { line: best.line };
};

/** The lines for the offsets `ends` (one, or both ends of a range) of a citation, or the reason one end stays. */
const convertRange = (
	code: string,
	rows: readonly string[],
	ends: readonly (string | undefined)[],
	terms: readonly string[]
): { lines: number[]; term: string } | { reason: string } => {
	const offsets = ends.flatMap((n) => (n === undefined ? [] : [Number(n)]));
	// The longest term first: it names its code most exactly, and a short word sits near much code.
	const byLength = terms
		.filter((term) => !PLAIN_WORD.test(term))
		.toSorted((x, y) => y.length - x.length);
	const lines: number[] = [];
	let first = "";
	for (const n of offsets) {
		let got: { line: number } | { reason: string } = {
			reason: `no term of the line near offset ${n}`
		};
		for (const term of byLength) {
			if (offsetHit(code, n, [term]) === undefined) {
				continue;
			}
			got = pickLine(code, rows, n, term);
			if ("line" in got) {
				first ||= term;
				break;
			}
		}
		if ("reason" in got) {
			return got;
		}
		lines.push(got.line);
	}
	const [start = 0, end = start] = lines;
	if (end < start) {
		return { reason: `range ends land out of order (${start}, ${end})` };
	}
	return { lines: start === end ? lines.slice(0, 1) : lines, term: first };
};

/**
 * Rewrites each citation of `md` that the term check matches only as a raw offset into the cleaned-module line
 * that holds the same term. Only the number changes. A range converts both ends or stays as it is.
 */
export const toLines = (
	md: string,
	modules: ReadonlyMap<string, string>,
	clean: ReadonlyMap<string, readonly string[]>,
	file = ""
): { text: string; done: LineConversion[]; left: LineConversion[] } => {
	const terms = termsByLine(md);
	const done: LineConversion[] = [];
	const left: LineConversion[] = [];
	const text = md
		.split("\n")
		.map((row, i) =>
			row.replaceAll(
				RANGE,
				(from, chunk: string, sep: string, a: string, b?: string) => {
					const code = modules.get(chunk);
					const rows = clean.get(chunk);
					const mine = terms[i] ?? [];
					const note = { file, line: i + 1, from };
					if (
						code === undefined ||
						rows === undefined ||
						lineHit(rows, Number(a), mine) !== undefined ||
						offsetHit(code, Number(a), mine) === undefined
					) {
						return from;
					}
					// A number inside the module's line count may already be a line whose term moved: read it by hand.
					if (Number(a) <= rows.length) {
						left.push({
							...note,
							reason: "number is also a line of the module"
						});
						return from;
					}
					const got = convertRange(code, rows, [a, b], mine);
					if ("reason" in got) {
						left.push({ ...note, reason: got.reason });
						return from;
					}
					const to = `${chunk}${sep}${got.lines.join("-")}`;
					done.push({ ...note, to, term: got.term });
					return to;
				}
			)
		)
		.join("\n");
	return { text, done, left };
};
