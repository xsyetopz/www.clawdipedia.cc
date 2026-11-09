import { expect, test } from "bun:test";

import { countProblems } from "./undocumented-counts.ts";

const page = (counts: { a: number; b: number; total: number; rows: number }) =>
	`## Summary

| Group | Count |
| --- | --- |
| [A](#a) | ${counts.a} |
| [B](#b) | ${counts.b} |
| Total | ${counts.total} |

## A

Count: ${counts.a}.

The 2 rules are all listed on [Rules](./rules.md). They are not repeated here.

| Item | Where |
| --- | --- |
| \`x\` | [P](./p.md) |

## B

Count: ${counts.b}.

| Page | Undocumented Rows |
| --- | --- |
| [Vars](./vars.md) | ${counts.rows} |
`;

const read = (path: string) =>
	path === "./rules.md"
		? "| r1 | <Undocumented /> |\n| r2 | <Undocumented /> |\n| r3 | <Documented /> |"
		: "| v1 | <Undocumented /> |\n| v2 | <Undocumented /> |\n| v3 | <Undocumented /> |";

test("right counts give no problem", () => {
	expect(countProblems(page({ a: 3, b: 3, total: 6, rows: 3 }), read)).toEqual(
		[],
	);
});

test("each stale count is reported on its line", () => {
	const lines = countProblems(
		page({ a: 4, b: 2, total: 7, rows: 2 }),
		read,
	).map((p) => p.line);
	// summary A, summary B, total, Count of A, Count of B, page row of B
	expect(lines).toEqual([5, 6, 7, 11, 21, 25]);
});
