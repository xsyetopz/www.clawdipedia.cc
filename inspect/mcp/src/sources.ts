import { basename, join } from "node:path";

import { program } from "./binary.ts";
import { prepared } from "./prepare.ts";
import type { Source } from "./relocate.ts";

/** The modules of a version or path for a citation move: each with its raw text, and with its cleaned text when it parses. */
export const sources = async (binary?: string): Promise<Source[]> => {
	const [p, { dir }] = await Promise.all([program(binary), prepared(binary)]);
	return Promise.all(
		p.modules.map(async (m) => {
			const source: Source = { name: m.name, text: m.source };
			const clean = Bun.file(join(dir, "modules", basename(m.name)));
			if (await clean.exists()) {
				source.clean = await clean.text();
			}
			return source;
		}),
	);
};
