import { expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { check, docsNames, PAGES, shape } from "./coverage.ts";

const SCRIPT = join(import.meta.dir, "coverage.ts");

const snapshot = {
	version: "1.2.3",
	kinds: {
		env: [{ name: "CLAUDE_CODE_EXAMPLE" }, { name: "CLAUDE_CODE_LISTED" }],
		flag: [{ name: "--one" }, { name: "--two" }],
	},
};
const docs = { env: new Set(["CLAUDE_CODE_LISTED"]), flag: new Set<string>() };

/** A repo folder with the snapshot, the map, the exclusions, and some docs files. */
const repo = async (
	map: unknown,
	exclusions: unknown,
	files: Record<string, string> = {},
) => {
	const root = await mkdtemp(join(tmpdir(), "coverage-"));
	const put = (path: string, text: string) => Bun.write(join(root, path), text);
	await Promise.all([
		put("schemas/surface.json", JSON.stringify(snapshot)),
		put("tools/surface/map.json", JSON.stringify(map)),
		put("tools/surface/exclusions.json", JSON.stringify(exclusions)),
		...Object.entries(files).map(([p, t]) => put(p, t)),
	]);
	return root;
};
const exec = async (args: string[]) => {
	const proc = Bun.spawn(["bun", SCRIPT, ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	return { code, out, err };
};
const run = (root: string, ...args: string[]) =>
	exec(["--root", root, ...args]);

test("an unmapped item fails and prints its key", async () => {
	const root = await repo({}, {});
	const r = await run(root);
	expect(r.code).toBe(1);
	expect(r.err).toContain("env:CLAUDE_CODE_EXAMPLE");
	expect(r.err).toContain("flag:--one");
});

test("an item named in a docs table, in the map, or in the exclusions is covered", async () => {
	const root = await repo(
		{ "flag:--one": { route: "/configure/cli/flags", anchor: "one" } },
		{ "env:CLAUDE_CODE_EXAMPLE": "internal", "flag:--two": "test only" },
		{
			"docs/configure/env-vars/a.md":
				"| Name | Note |\n| --- | --- |\n| `CLAUDE_CODE_LISTED` | x |\n",
		},
	);
	const r = await run(root);
	expect(r.err).toBe("");
	expect(r.code).toBe(0);
	// The counts table ends with one notice line that carries the tag of the check.
	expect(r.out.trimEnd().split("\n").at(-1)).toMatch(/^surface:check: \S/u);
});

test("a stale exclusion fails and names the entry", async () => {
	const root = await repo(
		{ "flag:--one": { route: "/x" }, "flag:--two": { route: "/x" } },
		{
			"env:CLAUDE_CODE_GONE": "was removed",
			"env:CLAUDE_CODE_EXAMPLE": "internal",
		},
		{
			"docs/configure/env-vars/a.md": "| `CLAUDE_CODE_LISTED` |\n",
		},
	);
	const r = await run(root);
	expect(r.code).toBe(1);
	expect(r.err).toContain("exclusions.json");
	expect(r.err).toContain("env:CLAUDE_CODE_GONE");
	expect(r.err).not.toContain("map.json");
});

test("a stale map entry fails", () => {
	const out = check(
		snapshot,
		docs,
		{ "flag:--gone": { route: "/x" } },
		{ "env:CLAUDE_CODE_EXAMPLE": "internal" },
	);
	expect(out.stale).toEqual(["map.json: flag:--gone"]);
});

test("a prefix exclusion covers every item with the prefix and is stale with none", () => {
	const ok = check(
		snapshot,
		docs,
		{},
		{ "flag:--*": "all flags", "env:CLAUDE_CODE_E*": "x" },
	);
	expect(ok.unmapped).toEqual([]);
	expect(ok.stale).toEqual([]);
	expect(ok.rows.find((r) => r.kind === "flag")?.excluded).toBe(2);
	const stale = check(snapshot, docs, {}, { "flag:--zzz*": "nothing" });
	expect(stale.stale).toEqual(["exclusions.json: flag:--zzz*"]);
});

test("an error map key ending in * maps a family by prefix, and other kinds do not", () => {
	const snap = {
		version: "1.2.3",
		kinds: {
			error: [
				{ name: "Unknown hook type: a" },
				{ name: "Unknown hook type: b" },
			],
			flag: [{ name: "--one" }],
		},
	};
	const entry = { route: "/extend/hooks", anchor: "errors" };
	const none = { error: new Set<string>(), flag: new Set<string>() };
	const ok = check(
		snap,
		none,
		{ "error:Unknown hook type*": entry },
		{
			"flag:--one": "x",
		},
	);
	expect(ok.unmapped).toEqual([]);
	expect(ok.stale).toEqual([]);
	expect(ok.rows.find((r) => r.kind === "error")?.mapped).toBe(2);
	const stale = check(
		snap,
		none,
		{ "error:Nothing*": entry },
		{
			"error:Unknown*": "x",
			"flag:--one": "x",
		},
	);
	expect(stale.stale).toEqual(["map.json: error:Nothing*"]);
	// Only the error kind takes a prefix key, so a star on another kind is one finding that names it.
	const star = shape({ "flag:--*": entry }, {});
	expect(star).toHaveLength(1);
	expect(star[0]).toContain("flag:--*");
	expect(shape({ "error:Unknown hook*": entry }, {})).toEqual([]);
});

test("an entry of an unknown kind is stale", () => {
	const out = check(snapshot, docs, {}, { "nope:a": "x" });
	expect(out.stale).toEqual(["exclusions.json: nope:a"]);
});

test("--kind limits the unmapped items and the stale entries to those kinds", async () => {
	const out = check(
		snapshot,
		docs,
		{},
		{ "flag:--gone": "x", "env:CLAUDE_CODE_EXAMPLE": "internal" },
		["env"],
	);
	expect(out.rows.map((r) => r.kind)).toEqual(["env"]);
	expect(out.unmapped).toEqual([]);
	expect(out.stale).toEqual([]);
	const root = await repo(
		{},
		{},
		{ "docs/configure/env-vars/a.md": "| `CLAUDE_CODE_LISTED` |\n" },
	);
	const r = await run(root, "--kind", "env");
	expect(r.err).toContain("env:CLAUDE_CODE_EXAMPLE");
	expect(r.err).not.toContain("flag:");
	const unknown = await run(root, "--kind", "nope");
	expect(unknown.code).toBe(2);
});

test("an exclusion needs a reason and a map entry needs a route", () => {
	// A route that does not start with "/" and a blank reason are each one finding that names its key.
	const bad = shape({ "flag:--a": { route: "x" } }, { "env:A": " " });
	expect(bad).toHaveLength(2);
	expect(bad.join("\n")).toContain("flag:--a");
	expect(bad.join("\n")).toContain("env:A");
	expect(shape({ "flag:--a": { route: "/x" } }, { "env:A": "why" })).toEqual(
		[],
	);
});

test("an error prefix key shorter than 8 characters is rejected in both files", () => {
	const entry = { route: "/x" };
	// Of these five keys only the two short ones are findings. The other three have 8 characters or
	// more before the star, so the count proves which keys passed.
	const out = shape(
		{ "error:Unknown*": entry, "error:Unknown hook*": entry },
		{ "error:q*": "x", [`error:\${…} is r*`]: "x", "error:Not conn*": "x" },
	);
	expect(out).toHaveLength(2);
	expect(out.join("\n")).toContain("error:Unknown*");
	expect(out.join("\n")).toContain("error:q*");
	// the length counts the text after "error:" and before "*"
	expect(shape({}, { "error:Short": "x", "env:A*": "x" })).toEqual([]);
});

test("docs names are the exact backticked names in the name cell of table rows of the pages", async () => {
	const root = await repo(
		{},
		{},
		{
			"docs/a/one.md":
				"Text with `NOT_IN_TABLE`.\n| `A` | `b\\|c` | x `--f <v>` |\n| `d\\|e`, `F` | y |\n",
			"docs/a/sub/two.mdx": "| `DEEP` |\n",
			"docs/other.md": "| `ELSEWHERE` |\n",
		},
	);
	expect(await docsNames(root, ["docs/a", "docs/missing.md"])).toEqual(
		new Map([
			["A", join(root, "docs/a/one.md")],
			["d|e", join(root, "docs/a/one.md")],
			["F", join(root, "docs/a/one.md")],
			["DEEP", join(root, "docs/a/sub/two.mdx")],
		]),
	);
});

test("a token only in a cell other than the name cell does not document an item", async () => {
	const root = await repo(
		{},
		{},
		{
			"docs/configure/cli/a.md":
				"| Name | See |\n| --- | --- |\n| `--one` | [`project`](/x), `--two` |\n",
		},
	);
	const flagPages = Object.entries(PAGES)
		.filter(([kind]) => kind === "flag")
		.flatMap(([, pages]) => pages);
	const names = await docsNames(root, flagPages);
	expect([...names.keys()]).toEqual(["--one"]);
	const out = check(
		{
			version: "1.2.3",
			kinds: { flag: [{ name: "--one" }, { name: "--two" }] },
		},
		{ flag: names },
		{},
		{},
	);
	expect(out.unmapped).toEqual(["flag:--two"]);
});

test("the counts add up for each kind", () => {
	const out = check(snapshot, docs, { "flag:--one": { route: "/x" } }, {});
	expect(out.rows).toEqual([
		{ kind: "env", items: 2, docs: 1, mapped: 0, excluded: 0, unmapped: 1 },
		{ kind: "flag", items: 2, docs: 0, mapped: 1, excluded: 0, unmapped: 1 },
	]);
});

test("the real repo prints the counts of every kind, whatever the result", async () => {
	const { out } = await exec([]);
	expect(out).toContain("kind");
	expect(out).toContain("unmapped");
	for (const k of Object.keys(PAGES)) {
		expect(out).toMatch(new RegExp(`^${k} +\\d+`, "mu"));
	}
	expect(out).toMatch(/^total +\d+/mu);
}, 20_000);
