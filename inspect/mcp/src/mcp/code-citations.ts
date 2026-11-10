import { basename, join } from "node:path";

import { program } from "../binary.ts";
import { moveCitations, staleCitations } from "../citations.ts";
import { claimTerms, relocate } from "../relocate.ts";
import { sources } from "../sources.ts";
import { type Args, need, type Out, text } from "./app.ts";

/** The `citations` action: the chunk citations in the Markdown files of `dir` that name no module of the build; with `from`, where each moves to in the build. */
export const citations = async ({ dir, from, version }: Args): Promise<Out> => {
	const root = need(dir, "dir");
	const p = await program(version);
	const files: Record<string, string> = {};
	for await (const f of new Bun.Glob("**/*.md").scan(root)) {
		files[f] = await Bun.file(join(root, f)).text();
	}
	if (from !== undefined) {
		const { moves } = moveCitations(
			files,
			await sources(from),
			await sources(version),
		);
		const count = (how: string) => moves.filter((m) => m.how === how).length;
		return text(
			`${moves.length} citation(s) of ${from} move to ${p.path}: ${count("same")} same, ${count("module")} module, ${count("unmapped")} unmapped\n${moves.map((m) => `${m.file}:${m.line}: ${m.from} -> ${m.to ?? "unmapped"} (${m.how})`).join("\n")}`,
			{ moves },
		);
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

/** The `relocate` action: where the code at `offset` of `module` in the build `from` sits in the build `version`. `query` is the claim that names the code. */
export const relocateAction = async ({
	from,
	module,
	offset = 0,
	query,
	version,
	limit = 3,
}: Args): Promise<Out> => {
	const name = need(module, "module");
	const old = await program(need(from, "from"));
	const m = old.modules.find((x) => basename(x.name) === name);
	if (!m) {
		throw new Error(`no module "${name}" in ${old.path}`);
	}
	const target = await program(version);
	const found = relocate(
		m.source,
		offset,
		claimTerms(query ?? ""),
		target.modules.map((x) => ({ name: x.name, text: x.source })),
		limit,
	);
	return text(
		found.length > 0
			? `${name}@${offset} of ${old.path} in ${target.path}\n${found.map((r) => `- ${r.module}@${r.offset}  score ${r.score.toFixed(2)}${r.same ? ", same code" : ""}  anchor ${r.anchor}`).join("\n")}`
			: `${name}@${offset}: no anchor from the query stands near the offset, or ${target.path} lacks it`,
		{ found },
	);
};
