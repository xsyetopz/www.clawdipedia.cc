import { afterAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { knownCases } from "./parts/check.ts";
import { grepHits } from "./scan.ts";

const base = await mkdtemp(join(tmpdir(), "facts-test-"));
afterAll(async () => {
	await rm(base, { recursive: true, force: true });
});

const write = async (version: string, facts: string[]) => {
	await Bun.write(
		join(base, version, "live", "usage.429.json"),
		JSON.stringify({ schema: 1, id: "live.usage.429", facts }),
	);
};

test("a case's facts come from its newest capture, not from older ones", async () => {
	await write("2.1.9", ["docs/old.md#renamed:00000000"]);
	await write("2.1.10", ["docs/new.md#current:11111111"]);
	const known = await knownCases(base);
	expect(known.facts.get("live.usage.429")).toEqual(
		new Set(["docs/new.md#current:11111111"]),
	);
});

/** A git repo with one committed page and one page that nobody staged. */
const repoWithNewPage = async () => {
	const root = await mkdtemp(join(tmpdir(), "facts-grep-"));
	await Bun.write(join(root, "docs", "committed.md"), "Covers `2.1.312`.\n");
	const git = async (...a: string[]) => {
		const p = Bun.spawn(["git", ...a], {
			cwd: root,
			env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null" },
		});
		await p.exited;
	};
	await git("init", "-q");
	await git("config", "user.email", "test@example.com");
	await git("config", "user.name", "test");
	await git("add", "docs/committed.md");
	await git("commit", "-qm", "add page");
	await Bun.write(join(root, "docs", "split.md"), "Also covers `2.1.312`.\n");
	return root;
};

test("the version scan reaches a page that nobody staged yet", async () => {
	const root = await repoWithNewPage();
	const hits = await grepHits(root);
	expect(hits.get("docs/committed.md")).toEqual([1]);
	// A page split writes new files. Until someone stages them, a plain `git grep` skips them, so
	// their version facts would never reach the gate.
	expect(hits.get("docs/split.md")).toEqual([1]);
	await rm(root, { recursive: true, force: true });
});
