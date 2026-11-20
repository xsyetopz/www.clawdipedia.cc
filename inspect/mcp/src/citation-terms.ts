// Usage: bun inspect/mcp/src/citation-terms.ts [--version <v>] [--show] [--suggest] [--lines-only] <file.md> [...]
//        bun inspect/mcp/src/citation-terms.ts [--version <v>] --to-lines [--write] <file.md> [...]
// --lines-only counts a citation that matches only as a raw offset as a miss: the site rule is that N is a line of the cleaned module.
// --to-lines rewrites each raw-offset citation as the cleaned-module line that holds the matched term at the same place; a tie or no hit leaves it as it is and prints a report.
// --show prints the code at each missed offset; --suggest prints up to 3 cleaned-module lines that hold a term of the line.
// For each `chunk-x.js:N` citation in the Markdown files, looks for a term of the same line near offset N of the module.
// A term is a code span (`name`) or a quoted string ("text") of the line (or a code-like piece of one), or, for a footnote, of each line that uses it. A citation with no term near its offset prints
// as a miss, for a read by hand: the offset can be stale, or the line can name the code only in words.

/** One `chunk-x.js:N` citation and the term of its line that the code holds near N, if any. */
export interface CitationTerm {
	file: string;
	line: number;
	citation: string;
	/** The first term of the line found near the offset; absent for a miss. */
	term?: string;
	/** How `:N` read when the term was found: a raw offset, or a line of the cleaned module. */
	as?: "offset" | "line";
}

/** Lines on each side of a cleaned-module line that a term may sit in, as the citation mover reads one. */
const NEAR_LINES = 10;

/** Characters on each side of the offset that a term may sit in: a footnote cites the start of a statement. */
export const WINDOW = 600;

const CITED = /(chunk-[\da-z]+\.js)[:@](\d+)/gu;

/** A piece of a span that can stand for code: a plain English word such as "the" sits near any offset. */
const codeLike = (piece: string): boolean =>
	/[^a-z]/u.test(piece) || piece.length >= 8;

/** The code spans and quoted strings of a Markdown line, without citations, at least 3 characters each. */
export const lineTerms = (line: string): string[] => {
	const spans = [...line.matchAll(/`([^`]+)`/gu)].map((m) => m[1] ?? "");
	const quotes = [...line.matchAll(/"([^"]{5,})"/gu)].map((m) => m[1] ?? "");
	const terms = new Set<string>();
	for (const t of [...spans, ...quotes]) {
		if (/^chunk-[\da-z]+\.js/u.test(t)) {
			continue;
		}
		for (const piece of [t.trim(), ...t.split(/[\s(),=]+/u)]) {
			if (piece.length >= 3 && (piece === t.trim() || codeLike(piece))) {
				terms.add(piece);
			}
		}
	}
	return [...terms];
};

/** The lines that use each footnote label, by label: a footnote cites the code for the words of those lines. */
const footnoteUses = (lines: string[]): Map<string, string[]> => {
	const uses = new Map<string, string[]>();
	for (const line of lines) {
		for (const m of line.matchAll(/\[\^([\w-]+)\](?!:)/gu)) {
			const label = m[1] ?? "";
			uses.set(label, [...(uses.get(label) ?? []), line]);
		}
	}
	return uses;
};

/**
 * The citations of `md` and, for each, the first term of its line (or of the lines that use its footnote) near its place.
 * The place is the raw offset N, or, when `clean` holds the module, line N of the cleaned module.
 */
export const citationTerms = (
	md: string,
	modules: ReadonlyMap<string, string>,
	file = "",
	clean?: ReadonlyMap<string, readonly string[]>,
	linesOnly = false
): CitationTerm[] => {
	const lines = md.split("\n");
	const terms = termsByLine(md);
	return lines.flatMap((text, i) =>
		[...text.matchAll(CITED)].map((m): CitationTerm => {
			const at = Number(m[2]);
			const found: CitationTerm = { file, line: i + 1, citation: m[0] };
			const mine = terms[i] ?? [];
			const byOffset = linesOnly
				? undefined
				: offsetHit(modules.get(m[1] ?? "") ?? "", at, mine);
			if (byOffset !== undefined) {
				found.term = byOffset.term;
				found.as = "offset";
				return found;
			}
			// A `:N` can also be a line of the cleaned module (see tools/check/citations.ts).
			const term = lineHit(clean?.get(m[1] ?? ""), at, mine);
			if (term !== undefined) {
				found.term = term;
				found.as = "line";
			}
			return found;
		})
	);
};

/** The first term held within the window of raw offset `at`, with the place of its first hit. */
export const offsetHit = (
	code: string,
	at: number,
	terms: readonly string[]
): { term: string; hit: number } | undefined => {
	const start = Math.max(0, at - WINDOW);
	for (const term of terms) {
		// The first hit after the window start: a later hit is outside too.
		const hit = code.indexOf(term, start);
		if (hit !== -1 && hit + term.length <= at + WINDOW) {
			return { term, hit };
		}
	}
	return undefined;
};

/** The first term held within 10 lines of line `at` of the cleaned module. */
export const lineHit = (
	rows: readonly string[] | undefined,
	at: number,
	terms: readonly string[]
): string | undefined => {
	if (rows === undefined || at < 1 || at > rows.length) {
		return undefined;
	}
	const near = rows
		.slice(Math.max(0, at - 1 - NEAR_LINES), at + NEAR_LINES)
		.join("\n");
	return terms.find((t) => near.includes(t));
};

/** The code at the offset of `citation`, one line, for a read by hand next to the cited line. */
export const codeAt = (
	citation: string,
	modules: ReadonlyMap<string, string>,
	length = 200
): string => {
	const m = /(chunk-[\da-z]+\.js)[:@](\d+)/u.exec(citation);
	const code = modules.get(m?.[1] ?? "");
	if (code === undefined) {
		return "(no such module)";
	}
	const at = Number(m?.[2]);
	return code.slice(at, at + length).replaceAll(/\s+/gu, " ");
};

/** At most this many places that hold a term are suggested for one miss. */
const MAX_SUGGESTIONS = 3;

/** A term at more places than this, in all modules, names no one place. */
const MAX_PLACES = 5;

/** One cleaned-module line that holds a term of a missed citation's line. */
export interface Suggestion {
	place: string;
	term: string;
}

export const linesWith = (rows: readonly string[], term: string): number[] =>
	rows.flatMap((row, i) => (row.includes(term) ? [i + 1] : []));

/**
 * Lines of the cleaned modules that hold a term of `terms`, for a read by hand of a missed `citation`.
 * The cited module comes first, nearest to N; then, for a term that the cited module does not hold,
 * other modules where the term is at no more than 5 places. A suggestion is a lead, not a fix.
 */
export const suggest = (
	citation: string,
	terms: readonly string[],
	clean: ReadonlyMap<string, readonly string[]>
): Suggestion[] => {
	const m = /(chunk-[\da-z]+\.js)[:@](\d+)/u.exec(citation);
	const chunk = m?.[1] ?? "";
	const at = Number(m?.[2]);
	const longest = [...terms].toSorted((a, b) => b.length - a.length);
	const own = clean.get(chunk) ?? [];
	const inOwn = longest
		.flatMap((term) => linesWith(own, term).map((line) => ({ term, line })))
		.toSorted((a, b) => Math.abs(a.line - at) - Math.abs(b.line - at))
		.map((h) => ({ place: `${chunk}:${h.line}`, term: h.term }));
	const elsewhere = longest
		.filter((term) => !own.some((row) => row.includes(term)))
		.flatMap((term) => {
			const places = [...clean].flatMap(([name, rows]) =>
				linesWith(rows, term).map((line) => ({
					place: `${name}:${line}`,
					term
				}))
			);
			return places.length <= MAX_PLACES ? places : [];
		});
	const seen = new Set<string>();
	return [...inOwn, ...elsewhere]
		.filter((s) => !seen.has(s.place) && Boolean(seen.add(s.place)))
		.slice(0, MAX_SUGGESTIONS);
};

/** The terms that the term check reads for each line of `md`: its own, and for a footnote, those of each line that uses it. */
export const termsByLine = (md: string): string[][] => {
	const lines = md.split("\n");
	const uses = footnoteUses(lines);
	const termsOf = (text: string): string[] => {
		const label = /^\[\^([\w-]+)\]:/u.exec(text)?.[1];
		const used = label === undefined ? [] : (uses.get(label) ?? []);
		const terms = new Set([text, ...used].flatMap((l) => lineTerms(l)));
		return [...terms];
	};
	return lines.map((text) => termsOf(text));
};

if (import.meta.main) {
	// Loaded here: the command line reads this module and `citation-lines.ts`, which reads it too.
	const { main } = await import("./citation-cli.ts");
	process.exitCode = await main(Bun.argv.slice(2));
}
