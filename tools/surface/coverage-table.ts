import type { Row } from "./coverage.ts";

const pad = (s: string | number, n: number) => String(s).padStart(n);
const COLUMNS: [string, number, (r: Row) => number][] = [
	["items", 6, (r) => r.items],
	["docs", 6, (r) => r.docs],
	["map", 6, (r) => r.mapped],
	["excluded", 8, (r) => r.excluded],
	["unmapped", 8, (r) => r.unmapped],
];
/** The counts of the rows as a table with a total line. */
export const table = (rows: Row[]): string => {
	const w = Math.max(...rows.map((r) => r.kind.length), 4);
	const line = (label: string, cell: (c: (typeof COLUMNS)[number]) => string) =>
		`${label.padEnd(w)} ${COLUMNS.map((c) => cell(c)).join(" ")}`;
	const sum = (f: (r: Row) => number) => rows.reduce((n, r) => n + f(r), 0);
	return [
		line("kind", ([h, n]) => pad(h, n)),
		...rows.map((r) => line(r.kind, ([, n, f]) => pad(f(r), n))),
		line("total", ([, n, f]) => pad(sum(f), n)),
	].join("\n");
};
