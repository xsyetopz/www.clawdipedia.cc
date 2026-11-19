// Recounts docs/reference/undocumented.md: each "Count: N." against its section's rows,
// each "Undocumented Rows" cell against the badges on the linked page, and the summary.
export interface CountProblem {
	line: number;
	message: string;
}

interface Found extends CountProblem {
	stated: number;
	actual: number;
}

const badgeRows = (page: string) =>
	page
		.split("\n")
		.filter((l) => l.startsWith("|") && l.includes("<Undocumented />")).length;

/** Collects the count problems; `report` stores one when the stated and actual counts differ. */
const reporter =
	(out: Found[]) =>
	(i: number, what: string, stated: number, actual: number): void => {
		if (stated !== actual) {
			out.push({
				line: i + 1,
				message: `${what} says ${stated}, actual ${actual}`,
				stated,
				actual,
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

// Order by line; problems on one line keep the order they were found in.
const collect = (text: string, read: (link: string) => string): Found[] => {
	const lines = text.split("\n");
	const out: Found[] = [];
	const bad = reporter(out);
	checkSummary(lines, checkSections(lines, read, bad), bad);
	const byLine = new Map<number, Found[]>();
	for (const p of out) {
		byLine.set(p.line, [...(byLine.get(p.line) ?? []), p]);
	}
	return lines.flatMap((_, i) => byLine.get(i + 1) ?? []);
};

/** The counts on the page that differ from its rows and the linked pages, in line order. */
export const countProblems = (
	text: string,
	read: (link: string) => string,
): CountProblem[] =>
	collect(text, read).map(({ line, message }) => ({ line, message }));

/**
 * The page with each stale count replaced by the actual one. A table cell count is the last cell of its row;
 * any other count is the first number on its line.
 */
export const fixCounts = (
	text: string,
	read: (link: string) => string,
): string => {
	const lines = text.split("\n");
	for (const { line, stated, actual } of collect(text, read)) {
		const l = lines[line - 1] ?? "";
		const cell = new RegExp(String.raw`\| ${stated} \|$`, "u");
		lines[line - 1] = cell.test(l)
			? l.replace(cell, `| ${actual} |`)
			: l.replace(new RegExp(String.raw`\b${stated}\b`, "u"), String(actual));
	}
	return lines.join("\n");
};
