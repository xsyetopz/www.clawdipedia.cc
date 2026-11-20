// The command line of the citation term check: see the usage in citation-terms.ts.
import { basename } from "node:path";

import { program } from "./binary.ts";
import { toLines } from "./citation-lines.ts";
import {
	citationTerms,
	codeAt,
	suggest,
	termsByLine,
} from "./citation-terms.ts";
import { sources } from "./sources.ts";

const convert = async (
	files: string[],
	texts: string[],
	modules: ReadonlyMap<string, string>,
	clean: ReadonlyMap<string, readonly string[]>,
	write: boolean,
): Promise<number> => {
	const got = files.map((file, i) =>
		toLines(texts[i] ?? "", modules, clean, file),
	);
	for (const g of got) {
		for (const c of g.done) {
			console.info(`${c.file}:${c.line}: ${c.from} -> ${c.to} (${c.term})`);
		}
		for (const c of g.left) {
			console.info(`${c.file}:${c.line}: ${c.from} left: ${c.reason}`);
		}
	}
	if (write) {
		await Promise.all(
			files.flatMap((file, i) =>
				(got[i]?.done.length ?? 0) > 0
					? [Bun.write(file, got[i]?.text ?? "")]
					: [],
			),
		);
	}
	const done = got.reduce((n, g) => n + g.done.length, 0);
	const left = got.reduce((n, g) => n + g.left.length, 0);
	console.info(
		`${done} converted, ${left} left, in ${files.length} files${write ? " (written)" : ""}`,
	);
	return left === 0 ? 0 : 1;
};

/** Runs the term check, or with `--to-lines` the conversion, on the files of `args`; gives the exit code. */
export const main = async (args: string[]): Promise<number> => {
	const v = args.indexOf("--version");
	const version = v === -1 ? undefined : args[v + 1];
	const flags = new Set(args.filter((a) => a.startsWith("--")));
	const files = args.filter(
		(a, i) => !a.startsWith("--") && (v === -1 || (i !== v && i !== v + 1)),
	);
	const show = flags.has("--show");
	const hints = flags.has("--suggest");
	const p = await program(version);
	const modules = new Map(p.modules.map((m) => [basename(m.name), m.source]));
	const cleaned = await sources(p.path);
	const clean = new Map(
		cleaned.flatMap((s) =>
			s.clean === undefined
				? []
				: [[basename(s.name), s.clean.split("\n")] as const],
		),
	);
	const texts = await Promise.all(files.map((f) => Bun.file(f).text()));
	if (flags.has("--to-lines")) {
		return convert(files, texts, modules, clean, flags.has("--write"));
	}
	const all = texts.flatMap((t, i) =>
		citationTerms(t, modules, files[i], clean, flags.has("--lines-only")),
	);
	const misses = all.filter((c) => c.term === undefined);
	for (const c of misses) {
		console.info(
			`${c.file}:${c.line}: ${c.citation}: no term of the line near it`,
		);
		if (show) {
			console.info(`  > ${codeAt(c.citation, modules)}`);
		}
		if (hints) {
			const terms =
				termsByLine(texts[files.indexOf(c.file)] ?? "")[c.line - 1] ?? [];
			for (const s of suggest(c.citation, terms, clean)) {
				console.info(`  ? ${s.place} (${s.term})`);
			}
		}
	}
	console.info(
		`${misses.length} misses, ${all.length} citations, in ${files.length} files`,
	);
	return misses.length === 0 ? 0 : 1;
};
