// Compares the Mod API tables in Markdown with the type file. See ../type-tables.ts for the row forms.
import { typeFields, type TypeFile } from "./parse.ts";
import { propsOf, type Row, rowOutcome, type Section } from "./rows.ts";

/** One table row that needs a look: a mismatch, or a row the check could not compare. */
export interface Mismatch {
	file: string;
	line: number;
	text: string;
}

/** A compared row: the description cell of the page beside the doc comment of the member. */
export interface Prose {
	file: string;
	line: number;
	name: string;
	page: string;
	doc: string;
}

/** What one Markdown text gives: the mismatches, the rows not compared, and the compared rows. */
export interface TableCheck {
	mismatches: Mismatch[];
	skipped: Mismatch[];
	checked: Prose[];
}

const NO_SECTION: Section = {
	heading: undefined,
	fields: undefined,
	elements: false,
	seen: new Set(),
	line: 0
};

const cells = (row: string): string[] =>
	row
		.replaceAll(String.raw`\|`, "\u0000")
		.split("|")
		.slice(1, -1)
		.map((c) => c.replaceAll("\u0000", "|").trim());

const tick = (cell: string): string | undefined =>
	/^`([^`]+)`$/u.exec(cell)?.[1];

/** The section a heading line opens, or undefined for a line that is no heading. */
const openSection = (
	f: TypeFile,
	line: string,
	n: number
): Section | undefined => {
	const h = /^#{2,4} `?([\w$]+)`?\s*$/u.exec(line);
	if (!h && !/^#{1,4} /u.test(line)) {
		return undefined;
	}
	const heading = h?.[1];
	const base = { ...NO_SECTION, seen: new Set<string>(), line: n + 1 };
	if (heading === undefined) {
		return base;
	}
	const declared = typeFields(f, heading);
	const fields = declared ?? propsOf(f, heading);
	// A plain heading (`### Spinner`) names a type only when the file has it; `## Surfaces` names none.
	if (fields === undefined && !line.includes("`")) {
		return base;
	}
	return { ...base, heading, fields, elements: declared === undefined };
};

/** The members of the closed section that no row named. */
const missingRows = (s: Section): string[] => {
	if (!s.fields || s.seen.size === 0) {
		return [];
	}
	const own = s.fields.filter((x) => x.inherited !== true);
	return [...new Set(own.map((x) => x.name))]
		.filter((name) => !s.seen.has(name))
		.map((name) => `${s.heading}: no row for member \`${name}\``);
};

/** The parts of a table row whose first cell is a code span, or undefined for any other line. */
const rowOf = (line: string): Row | undefined => {
	if (!line.startsWith("| ") || line.startsWith("| ---")) {
		return undefined;
	}
	const c = cells(line);
	const first = tick(c[0] ?? "");
	return first === undefined
		? undefined
		: { first, typeCell: c.at(-1) ?? "", page: c.slice(2).join(" | ") };
};

/** Compares the tables in one Markdown text with the type file. */
export const checkTables = (md: string, f: TypeFile, file = ""): TableCheck => {
	const out: TableCheck = { mismatches: [], skipped: [], checked: [] };
	let s = NO_SECTION;
	const close = () => {
		for (const text of missingRows(s)) {
			out.mismatches.push({ file, line: s.line, text });
		}
	};
	for (const [n, line] of md.split("\n").entries()) {
		const next = openSection(f, line, n);
		if (next) {
			close();
			s = next;
			continue;
		}
		const r = rowOf(line);
		if (!r) {
			continue;
		}
		const o = rowOutcome(f, s, r);
		if (o.kind === "ok") {
			out.checked.push({
				file,
				line: n + 1,
				name: o.name,
				page: r.page,
				doc: o.doc
			});
		} else {
			(o.kind === "bad" ? out.mismatches : out.skipped).push({
				file,
				line: n + 1,
				text: o.text
			});
		}
	}
	close();
	return out;
};
