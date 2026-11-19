// Usage: bun inspect/mcp/src/type-tables.ts <file.md> [...] [--types <file.d.ts>] [--prose]
// Compares the Mod API tables in Markdown with the type file the program embeds (schemas/claude-code.d.ts
// holds the same text). Row forms:
// - Under a `### \`Name\`` heading, a row per member of the declaration `Name`, or of the render component
//   `Name` (its member of `RenderPropsOf`): the name, the type (`Type: \`T\`` or a leading `` `T` ``), and
//   `Optional` when the member has `?`. A member with no row is a mismatch too.
// - A call such as `$.ui.notice`: a member of `CoreEngineInterface`, through nested object types.
// - An event such as `ui.render`: a key of an event map, with its `Input` and `Result` types.
// - A type with `Alias of \`T\``: the text after `=` in its declaration.
// --prose prints each compared row beside the doc comment of its member, for a reading of the descriptions.
import { join } from "node:path";

import { checkTables, type TableCheck } from "./type-tables/check.ts";
import { typeFile } from "./type-tables/parse.ts";
import { newWords } from "./type-tables/words.ts";

export {
	checkTables,
	type Mismatch,
	type Prose,
	type TableCheck,
} from "./type-tables/check.ts";
export {
	aliasOf,
	nested,
	normalizeType,
	type TypeField,
	type TypeFile,
	typeFields,
	typeFile,
} from "./type-tables/parse.ts";
export { newWords } from "./type-tables/words.ts";

const report = (r: TableCheck, prose: boolean): void => {
	for (const m of r.mismatches) {
		console.info(`${m.file}:${m.line}: ${m.text}`);
	}
	for (const m of r.skipped) {
		console.info(`${m.file}:${m.line}: not compared: ${m.text}`);
	}
	if (prose) {
		for (const p of r.checked) {
			console.info(
				`${p.file}:${p.line}: ${p.name}\n  page: ${p.page}\n  type: ${p.doc}\n  new: ${newWords(p.page, p.doc).join(" ")}`,
			);
		}
	}
};

const main = async (args: string[]): Promise<number> => {
	const t = args.indexOf("--types");
	const prose = args.includes("--prose");
	const types =
		t === -1
			? join(import.meta.dir, "..", "..", "..", "schemas", "claude-code.d.ts")
			: (args[t + 1] ?? "");
	const files = args.filter(
		(a, i) => a !== "--prose" && (t === -1 || (i !== t && i !== t + 1)),
	);
	const f = typeFile(await Bun.file(types).text());
	const texts = await Promise.all(files.map((file) => Bun.file(file).text()));
	const results = texts.map((text, i) => checkTables(text, f, files[i]));
	for (const r of results) {
		report(r, prose);
	}
	const count = results.reduce((n, r) => n + r.mismatches.length, 0);
	const checked = results.reduce((n, r) => n + r.checked.length, 0);
	console.info(
		`${count} mismatches, ${checked} rows compared, in ${files.length} files`,
	);
	return count === 0 ? 0 : 1;
};

if (import.meta.main) {
	process.exitCode = await main(Bun.argv.slice(2));
}
