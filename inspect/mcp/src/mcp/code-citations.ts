import { join } from "node:path";

import { program } from "../binary.ts";
import { staleCitations } from "../citations.ts";
import { type Args, need, type Out, text } from "./app.ts";

/** The `citations` action: the chunk citations in the Markdown files of `dir` that name no module of the build. */
export const citations = async ({ dir, version }: Args): Promise<Out> => {
	const root = need(dir, "dir");
	const p = await program(version);
	const files: Record<string, string> = {};
	for await (const f of new Bun.Glob("**/*.md").scan(root)) {
		files[f] = await Bun.file(join(root, f)).text();
	}
	const stale = staleCitations(
		files,
		p.modules.map((m) => m.name),
	);
	return text(
		stale.length > 0
			? `${stale.length} citation(s) name a chunk that ${p.path} lacks\n${stale.map((c) => `- ${c.file}:${c.line}: ${c.citation}`).join("\n")}`
			: `${p.path}: every chunk citation in ${Object.keys(files).length} files names a module`,
		{ stale },
	);
};
