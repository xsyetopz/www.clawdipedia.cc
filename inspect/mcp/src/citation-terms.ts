// Usage: bun inspect/mcp/src/citation-terms.ts [--version <v>] <file.md> [...]
// For each `chunk-x.js:N` citation in the Markdown files, looks for a term of the same line near offset N of the module.
// A term is a code span (`name`) or a quoted string ("text") of the line (or a code-like piece of one), or, for a footnote, of each line that uses it. A citation with no term near its offset prints
// as a miss, for a read by hand: the offset can be stale, or the line can name the code only in words.
import { basename } from "node:path";

import { program } from "./binary.ts";
import { sources } from "./sources.ts";

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
const WINDOW = 600;

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
): CitationTerm[] => {
	const lines = md.split("\n");
	const uses = footnoteUses(lines);
	return lines.flatMap((text, i) => {
		const label = /^\[\^([\w-]+)\]:/u.exec(text)?.[1];
		const used = label === undefined ? [] : (uses.get(label) ?? []);
		const terms = new Set([text, ...used].flatMap((l) => lineTerms(l)));
		return [...text.matchAll(CITED)].map((m): CitationTerm => {
			const code = modules.get(m[1] ?? "") ?? "";
			const at = Number(m[2]);
			const start = Math.max(0, at - WINDOW);
			const found: CitationTerm = { file, line: i + 1, citation: m[0] };
			for (const t of terms) {
				// The first hit after the window start: a later hit is outside too.
				const hit = code.indexOf(t, start);
				if (hit !== -1 && hit + t.length <= at + WINDOW) {
					found.term = t;
					found.as = "offset";
					return found;
				}
			}
			// A `:N` can also be a line of the cleaned module (see tools/check/citations.ts).
			const rows = clean?.get(m[1] ?? "");
			if (rows !== undefined && at >= 1 && at <= rows.length) {
				const near = rows
					.slice(Math.max(0, at - 1 - NEAR_LINES), at + NEAR_LINES)
					.join("\n");
				for (const t of terms) {
					if (near.includes(t)) {
						found.term = t;
						found.as = "line";
						return found;
					}
				}
			}
			return found;
		});
	});
};

/** The code at the offset of `citation`, one line, for a read by hand next to the cited line. */
export const codeAt = (
	citation: string,
	modules: ReadonlyMap<string, string>,
	length = 200,
): string => {
	const m = /(chunk-[\da-z]+\.js)[:@](\d+)/u.exec(citation);
	const code = modules.get(m?.[1] ?? "");
	if (code === undefined) {
		return "(no such module)";
	}
	const at = Number(m?.[2]);
	return code.slice(at, at + length).replaceAll(/\s+/gu, " ");
};

const main = async (args: string[]): Promise<number> => {
	const v = args.indexOf("--version");
	const version = v === -1 ? undefined : args[v + 1];
	const show = args.includes("--show");
	const files = args.filter(
		(a, i) => a !== "--show" && (v === -1 || (i !== v && i !== v + 1)),
	);
	const p = await program(version);
	const modules = new Map(p.modules.map((m) => [basename(m.name), m.source]));
	const cleaned = await sources(p.path);
	const clean = new Map(
		cleaned.flatMap((s) =>
			s.clean === undefined
				? []
				: [[basename(s.name), s.clean.split("\n")] as const],
		),
	);
	const texts = await Promise.all(files.map((f) => Bun.file(f).text()));
	const all = texts.flatMap((t, i) =>
		citationTerms(t, modules, files[i], clean),
	);
	const misses = all.filter((c) => c.term === undefined);
	for (const c of misses) {
		console.info(
			`${c.file}:${c.line}: ${c.citation}: no term of the line near it`,
		);
		if (show) {
			console.info(`  > ${codeAt(c.citation, modules)}`);
		}
	}
	console.info(
		`${misses.length} misses, ${all.length} citations, in ${files.length} files`,
	);
	return misses.length === 0 ? 0 : 1;
};

if (import.meta.main) {
	process.exitCode = await main(Bun.argv.slice(2));
}
