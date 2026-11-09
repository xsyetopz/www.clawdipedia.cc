import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { ROOT } from "../../util.ts";
import type { DocFile } from "./kind.ts";

/** The text of every Markdown file under docs/, with its path relative to the repo root. */
export const loadDocs = async (): Promise<DocFile[]> => {
	const entries = await readdir(join(ROOT, "docs"), {
		recursive: true,
		withFileTypes: true,
	});
	const files = entries
		.filter((e) => e.isFile() && /\.mdx?$/u.test(e.name))
		.map((e) => join(e.parentPath, e.name));
	return Promise.all(
		files.map(async (p) => ({
			file: p.slice(ROOT.length + 1),
			text: await Bun.file(p).text(),
		})),
	);
};
