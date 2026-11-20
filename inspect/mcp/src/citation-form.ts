// A program citation names its chunk and its place, so a reader can open the code a page states.
// The place is written `:N` or `:N-M` after the chunk file name, because the citation mover reads that form
// as a line of the cleaned module or as a raw offset, and keeps it valid across builds.

/** One program citation that does not give its chunk and its `:N` place. */
export interface UnlocatedCitation {
	file: string;
	/** 1-based line in the file. */
	line: number;
	/** What to fix. */
	problem: string;
}

const CHUNK = /chunk-[\da-z]+\.js/gu;
// A chunk name without `.js`, as in "(chunk-a1cg2ptw)". The stale-module check reads only the file name form,
// so this form can name a module of an older build and pass unseen.
const NAMELESS = /chunk-[\da-z]{8}(?![\da-z.])/gu;
const LOCATED = /chunk-[\da-z]+\.js:\d+(?:-\d+)?/u;
const FOOTNOTE = /^\[\^[^\]]+\]:/u;
const PROGRAM = /\bthe program\b/iu;

/** The problem of one chunk mention at `at` in `line`, or undefined when it has a `:N` place. */
const chunkProblem = (
	line: string,
	at: number,
	name: string
): string | undefined => {
	const rest = line.slice(at + name.length);
	if (/^:\d/u.test(rest)) {
		return undefined;
	}
	if (/^@\d/u.test(rest)) {
		return `${name}@N: write the place as ${name}:N`;
	}
	if (/^`? lines \d/u.test(rest)) {
		return `${name} lines A to B: write the place as ${name}:A-B`;
	}
	return `${name} names no :N place`;
};

// A range place follows a chunk name, as in "`chunk-a.js:40-44`"; a bare place (BARE) is reported on its own.
const RANGE = /(?:chunk-[\da-z]+\.js|`):(\d+)-(\d+)/gu;

// A place in backticks with no chunk name, as in "`:40`" or "`@40`". A reader cannot open it without the chunk.
const BARE = /`([:@]\d+(?:-\d+)?)`/gu;

/** The problem of each bare place in `line`. */
const bareProblems = (line: string): string[] =>
	[...line.matchAll(BARE)].map(
		(m) =>
			`${m[1]} names no chunk: write the place as chunk-x.js${m[1]?.replace("@", ":")}`
	);

/** The problem of each `:A-B` range in `line` whose end comes before its start. */
const rangeProblems = (line: string): string[] =>
	[...line.matchAll(RANGE)]
		.filter((m) => Number(m[2]) < Number(m[1]))
		.map(
			(m) =>
				`:${m[1]}-${m[2]} ends before it starts: write the range as :A-B with A <= B`
		);

/** Whether a line attributes a finding to the program: a footnote definition in Markdown, or any line of JSON. */
const isSourceLine = (file: string, line: string): boolean =>
	PROGRAM.test(line) && (file.endsWith(".json") || FOOTNOTE.test(line));

/**
 * The program citations in `files` (file name to text) that do not name a chunk and its `:N` place:
 * each chunk mention without `:N`, each place without its chunk on a line that names the program, and each footnote
 * (each JSON line) that names the program and no located chunk.
 */
export const unlocatedCitations = (
	files: Record<string, string>
): UnlocatedCitation[] =>
	Object.entries(files).flatMap(([file, text]) =>
		text.split("\n").flatMap((line, i) => {
			const out: UnlocatedCitation[] = [];
			for (const m of line.matchAll(CHUNK)) {
				const problem = chunkProblem(line, m.index, m[0]);
				if (problem !== undefined) {
					out.push({ file, line: i + 1, problem });
				}
			}
			for (const m of line.matchAll(NAMELESS)) {
				out.push({
					file,
					line: i + 1,
					problem: `${m[0]} has no .js: write the place as ${m[0]}.js:N`
				});
			}
			const bare = PROGRAM.test(line) ? bareProblems(line) : [];
			for (const problem of [...bare, ...rangeProblems(line)]) {
				out.push({ file, line: i + 1, problem });
			}
			if (isSourceLine(file, line) && !LOCATED.test(line)) {
				out.push({
					file,
					line: i + 1,
					problem: "names the program but no chunk-x.js:N"
				});
			}
			return out;
		})
	);
