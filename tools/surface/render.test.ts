import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { isCommitted, readJson } from "./coverage-cli.ts";
import { code, title } from "./render.ts";
import type { Committed } from "./snapshot.ts";

const SCRIPT = join(import.meta.dir, "render.ts");
const ROOT = join(import.meta.dir, "..", "..");

const snapshot: Committed = {
	version: "1.2.3",
	kinds: {
		env: [{ name: "CLAUDE_CODE_LISTED" }, { name: "CLAUDE_CODE_MAPPED" }],
		error: [{ name: "Bad thing a|b" }, { name: "lib: noise one" }],
	},
};
const UNDOCUMENTED =
	"## Settings Keys\n\nCount: 0.\n\n## Related Pages\n\n- x\n";

const repo = async () => {
	const root = await mkdtemp(join(tmpdir(), "render-"));
	const put = (path: string, text: string) => Bun.write(join(root, path), text);
	await Promise.all([
		put("schemas/surface.json", JSON.stringify(snapshot)),
		put(
			"tools/surface/map.json",
			JSON.stringify({
				"env:CLAUDE_CODE_MAPPED": { route: "/x", anchor: "y" },
			}),
		),
		put(
			"tools/surface/exclusions.json",
			JSON.stringify({ "error:lib: *": "library code" }),
		),
		put(
			"docs/configure/env-vars/a.md",
			"---\ntitle: Some Vars\n---\n\n| `CLAUDE_CODE_LISTED` | x |\n",
		),
		put("docs/reference/undocumented.md", UNDOCUMENTED),
	]);
	return root;
};
const run = async (root: string, ...args: string[]) => {
	const proc = Bun.spawn(["bun", SCRIPT, "--root", root, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [err, exitCode] = await Promise.all([
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code: exitCode, err };
};
const read = (root: string, path: string) => Bun.file(join(root, path)).text();

const cells = (l: string | undefined) => (l ?? "").split(/(?<!\\)\|/u).length;

/** The count of rows in each `## ` section's tables, minus the header rows. */
const rowsBySection = (page: string) => {
	const out: Record<string, number> = {};
	let section = "";
	for (const l of page.split("\n")) {
		if (l.startsWith("## ")) {
			section = l.slice(3);
		} else if (l.startsWith("| ") && !/^\| (Item|Kind|---) \|/u.test(l)) {
			out[section] = (out[section] ?? 0) + 1;
		}
	}
	return out;
};

test("each item gets its page, its map route, its exclusion, or no page", async () => {
	const root = await repo();
	const first = await run(root);
	expect(first.code).toBe(0);
	const page = await read(root, "docs/reference/surface-coverage.md");
	expect(page).toContain(
		"| `CLAUDE_CODE_LISTED` | [Some Vars](../configure/env-vars/a.md) |",
	);
	expect(page).toContain("| `CLAUDE_CODE_MAPPED` | [/x#y](/x#y) |");
	// The status cell of an excluded item carries its reason from exclusions.json.
	expect(page).toMatch(/^\| `lib: noise one` \| .*library code.* \|$/mu);
	// An item on no page has a status cell with no link.
	expect(page).toMatch(/^\| `Bad thing a\\\|b` \| [^[\]]+ \|$/mu);
	expect(page).toContain(
		"| [Environment Variables](#environment-variables) | 2 | 1 | 1 | 0 | 0 |",
	);
	expect(page).toContain("| Total | 4 | 1 | 1 | 1 | 1 |");
});

test("the undocumented section goes before Related Pages, and a second run keeps one copy", async () => {
	const root = await repo();
	await run(root);
	await run(root);
	const text = await read(root, "docs/reference/undocumented.md");
	expect(text.split("## In the Program").length).toBe(2);
	expect(text.indexOf("## In the Program")).toBeLessThan(
		text.indexOf("## Related Pages"),
	);
	expect(text).toContain(
		"| [Error Texts](surface-coverage.md#error-texts) | 2 | 1 |\n",
	);
	// The header row of the table has one cell for each cell of its rows.
	const lines = text.split("\n");
	const header = lines.find((l) => l.startsWith("| Kind |"));
	const total = lines.find((l) => l.startsWith("| All kinds |"));
	expect(header).toBeDefined();
	expect(cells(header)).toBe(cells(total));
	// "| Total | n |" is the summary row that check:docs recounts
	expect(text).toContain("| All kinds | 4 | 1 |\n");
	expect(
		text.startsWith(UNDOCUMENTED.slice(0, UNDOCUMENTED.indexOf("## Related"))),
	).toBe(true);
});

test("--check fails on a stale page and passes after a render", async () => {
	const root = await repo();
	const stale = await run(root, "--check");
	expect(stale.code).toBe(1);
	expect(stale.err).toContain("surface-coverage.md");
	await run(root);
	const again = await run(root, "--check");
	expect(again.code).toBe(0);
});

test("a code span holds backticks, newlines, and emoji", () => {
	expect(code("a `b` c")).toBe("``a `b` c``");
	expect(code("`x")).toBe("`` `x ``");
	expect(code("one\ntwo")).toBe("`one\\ntwo`");
	expect(code("⚠ warn")).toBe("`U+26A0 warn`");
});

test("the real page counts equal the snapshot counts", async () => {
	const snap = await readJson(join(ROOT, "schemas/surface.json"), isCommitted);
	const page = await read(ROOT, "docs/reference/surface-coverage.md");
	const rows = rowsBySection(page);
	for (const [kind, items] of Object.entries(snap.kinds)) {
		expect(rows[title(kind)]).toBe(items.length);
		expect(page).toContain(`[${title(kind)}](#`);
		expect(page).toMatch(
			new RegExp(
				`^\\| \\[${title(kind)}\\]\\(#[a-z-]+\\) \\| ${items.length} \\|`,
				"mu",
			),
		);
	}
	const real = await run(ROOT, "--check");
	expect(real.code).toBe(0);
}, 20_000);
