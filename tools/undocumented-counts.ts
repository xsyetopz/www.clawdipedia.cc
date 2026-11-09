// Recounts docs/reference/undocumented.md: each "Count: N." against its section's rows,
// each "Undocumented Rows" cell against the badges on the linked page, and the summary.
export interface CountProblem {
	line: number;
	message: string;
}

const badgeRows = (page: string) =>
	page
		.split("\n")
		.filter((l) => l.startsWith("|") && l.includes("<Undocumented />")).length;

/** Collects the count problems; `report` stores one when the stated and actual counts differ. */
const reporter =
	(out: CountProblem[]) =>
	(i: number, what: string, stated: number, actual: number): void => {
		if (stated !== actual) {
			out.push({
				line: i + 1,
				message: `${what} says ${stated}, actual ${actual}`,
			});
		}
	};

type Report = ReturnType<typeof reporter>;

/** The undocumented rows a "The N ... are all listed on" line adds to its section. */
const lineCount = (
	l: string,
	i: number,
	read: (link: string) => string,
	bad: Report,
): number => {
	const listed = /^The (\d+) .* are all listed on \[[^\]]+\]\(([^)#]+)/u.exec(
		l,
	);
	if (!listed) {
		return 0;
	}
	const n = badgeRows(read(listed[2] ?? ""));
	bad(i, "listed-on count", Number(listed[1]), n);
	return n;
};

/** The undocumented rows one table row adds to its section. */
const rowCount = (
	l: string,
	i: number,
	table: string,
	read: (link: string) => string,
	bad: Report,
): number => {
	let sum = 0;
	if (table.startsWith("| Item |")) {
		sum += 1;
	}
	const pageRow = /^\| \[[^\]]+\]\(([^)#]+)[^)]*\) \| (\d+) \|$/u.exec(l);
	if (table.startsWith("| Page | Undocumented Rows |") && pageRow) {
		const n = badgeRows(read(pageRow[1] ?? ""));
		bad(i, `row of ${pageRow[1]}`, Number(pageRow[2]), n);
		sum += n;
	}
	return sum;
};

/** Recount each section; returns the actual count of each section. */
const checkSections = (
	lines: string[],
	read: (link: string) => string,
	bad: Report,
): Map<string, number> => {
	const actual = new Map<string, number>();
	let section = "";
	let table = "";
	let countAt = -1;
	let sum = 0;
	const close = () => {
		if (countAt < 0) {
			return;
		}
		bad(
			countAt,
			`\`Count:\` of ${section}`,
			Number(lines[countAt]?.match(/\d+/u)?.[0]),
			sum,
		);
		actual.set(section, sum);
	};
	for (const [i, l] of lines.entries()) {
		const h = /^## (.+)/u.exec(l);
		if (h) {
			close();
			[section, table, countAt, sum] = [h[1] ?? "", "", -1, 0];
			continue;
		}
		if (/^Count: \d+\.$/u.test(l)) {
			countAt = i;
		}
		sum += lineCount(l, i, read, bad);
		if (!l.startsWith("|")) {
			table = "";
			continue;
		}
		if (!table) {
			table = l;
			continue;
		}
		if (!l.startsWith("| ---")) {
			sum += rowCount(l, i, table, read, bad);
		}
	}
	close();
	return actual;
};

/** Check the summary table against the section counts. */
const checkSummary = (
	lines: string[],
	actual: Map<string, number>,
	bad: Report,
): void => {
	let total = 0;
	for (const [i, l] of lines.entries()) {
		const g = /^\| \[([^\]]+)\]\(#[^)]+\) \| (\d+) \|$/u.exec(l);
		if (g) {
			const n = actual.get(g[1] ?? "") ?? 0;
			bad(i, `summary of ${g[1]}`, Number(g[2]), n);
			total += n;
		}
		const t = /^\| Total \| (\d+) \|$/u.exec(l);
		if (t) {
			bad(i, "summary total", Number(t[1]), total);
		}
	}
};

export const countProblems = (
	text: string,
	read: (link: string) => string,
): CountProblem[] => {
	const lines = text.split("\n");
	const out: CountProblem[] = [];
	const bad = reporter(out);
	checkSummary(lines, checkSections(lines, read, bad), bad);
	// Order by line; problems on one line keep the order they were found in.
	const byLine = new Map<number, CountProblem[]>();
	for (const p of out) {
		byLine.set(p.line, [...(byLine.get(p.line) ?? []), p]);
	}
	return lines.flatMap((_, i) => byLine.get(i + 1) ?? []);
};
