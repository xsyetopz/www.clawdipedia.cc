import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { formatText } from "../../schemas/format.ts";
import { DOCS } from "./ctx.ts";
import { GROUPS, writeCategories } from "./groups.ts";

// Docusaurus routes docs/prompts/<group>/<group>.md to /prompts/<group>, the same route a
// generated index of that category claims. Two pages on one route fail the build, so the category
// of such a group must link the page. loadHand() deletes the generated page before
// writeCategories() runs, so the flag cannot come from the disk.
test("a group whose folder holds a page named after it is marked ownPage", async () => {
	const listed = await Promise.all(
		GROUPS.map(async (g) => ({
			id: g.id,
			files: await readdir(join(DOCS, g.id)),
		})),
	);
	const onDisk = listed
		.filter((g) => g.files.includes(`${g.id}.md`))
		.map((g) => g.id);
	const marked = GROUPS.filter((g) => g.ownPage).map((g) => g.id);
	expect(new Set(marked)).toEqual(new Set(onDisk));
});

test("every group id is a folder of docs/prompts", async () => {
	const entries = await readdir(DOCS, { withFileTypes: true });
	const dirs = new Set(
		entries.filter((e) => e.isDirectory()).map((e) => e.name),
	);
	expect(GROUPS.map((g) => g.id).filter((id) => !dirs.has(id))).toEqual([]);
});

test("writeCategories writes each _category_.json as `bun fmt` leaves it", async () => {
	await writeCategories();
	const files = GROUPS.map((g) => join(DOCS, g.id, "_category_.json"));
	const pairs = await Promise.all(
		files.map(async (f) => {
			const text = await Bun.file(f).text();
			return [text, await formatText(text, f)];
		}),
	);
	expect(pairs.filter(([a, b]) => a !== b)).toEqual([]);
});
