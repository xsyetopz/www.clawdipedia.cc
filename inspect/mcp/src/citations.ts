import { basename } from "node:path";

import { claimTerms, relocate, type Source } from "./relocate.ts";

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
	/(chunk-[\da-z]+\.js)(?:([:@])(\d+)|`? lines \d+ to \d+)?|(?<=`):(\d+)(?:-(\d+))?(?=`)/gu;
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

const sameCode = (
	{ old, target }: Pair,
	n: number,
	terms: string[],
): number | undefined => {
	const [r] = relocate(old.text, n, terms, [target], 1);
	return r?.same === true ? r.offset : undefined;
};

const moveLine = (
	{ oldByName, newNames, mapModule, moves }: Ctx,
	file: string,
	line: number,
	lineText: string,
): string => {
	const terms = claimTerms(lineText);
	let last: Pair | undefined;
	const sameAt = (n: number): number | undefined =>
		last && sameCode(last, n, terms);
	return lineText.replaceAll(
		FOLLOW_ON,
		(
			found,
			chunk: string | undefined,
			sep: string | undefined,
			offset: string | undefined,
			from: string | undefined,
			to: string | undefined,
		) => {
			if (chunk === undefined) {
				return `:${sameAt(Number(from)) ?? from}${to === undefined ? "" : `-${sameAt(Number(to)) ?? to}`}`;
			}
			const old = newNames.has(chunk) ? undefined : oldByName.get(chunk);
			const target = old && mapModule(chunk);
			last = old && target ? { old, target } : undefined;
			if (!old) {
				return found;
			}
			if (!last) {
				moves.push({ file, line, from: found, how: "unmapped" });
				return found;
			}
			const name = basename(last.target.name);
			const moved = offset === undefined ? undefined : sameAt(Number(offset));
			const next =
				moved === undefined
					? found.replace(chunk, name)
					: `${name}${sep}${moved}`;
			moves.push({
				file,
				line,
				from: found,
				to: next,
				how: moved === undefined ? "module" : "same",
			});
			return next;
		},
	);
};

/**
 * Moves the chunk citations in `files` (file name to Markdown text) from the build of `oldSources` to the build of `newSources`.
 * A citation that names a module of the old build and not of the new one moves to the new module that shares the most long string
 * literals with it. With an offset, the offset moves too when `relocate` finds the same code ("same"); otherwise the numbers stay ("module").
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
