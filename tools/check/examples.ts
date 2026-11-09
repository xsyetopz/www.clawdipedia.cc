// Example checks. Run with: bun tools/check/examples.ts [--fix]
// Runs oxlint (with the repo .oxlintrc.json) and `bun fmt` (with the [fmt]
// section of bunfig.toml) on the fenced code blocks in docs/ that they handle.
// Skip a block by adding `skip-lint` to its fence meta: ```json skip-lint title="..."
// Skipped by default: docs/prompts/ (verbatim captures).
// --fix writes oxlint's safe fixes and the `bun fmt` layout back into the markdown.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

import { sorted, sortedStrings } from "../schemas/sorted.ts";
import {
	type Block,
	DOCS,
	findBlocks,
	ROOT,
	SKIP_MARKER,
	walk,
} from "./example-blocks.ts";

// oxlint skips hidden folders, `bun fmt` and oxlint skip gitignored ones, and both read the repo config only inside the repo.
const TMP = join(import.meta.dir, "..", "examples-tmp");

// Examples are fragments: they use names they do not declare or define, have no types, and stub bodies.
const IGNORED_RULES = new Set([
	"eslint(no-unused-vars)",
	"typescript(no-unused-vars)",
	"eslint(no-undef)",
	"eslint(require-await)",
	"typescript(require-await)",
	"typescript(strict-boolean-expressions)",
	"eslint(no-empty-function)",
	"jest(no-standalone-expect)",
]);
const isIgnored = (code: string) =>
	IGNORED_RULES.has(code) || code.startsWith("typescript(no-unsafe-");

interface Diag {
	message: string;
	code: string;
	filename: string;
	labels?: { span?: { line?: number } }[];
}

const run = async (cmd: string[]) => {
	const p = Bun.spawn(cmd, { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
	const [out] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
		p.exited,
	]);
	return out;
};

const OXLINT = ["bun", "run", "oxlint", "--"];

const isDiag = (d: unknown): d is Diag =>
	typeof d === "object" &&
	d !== null &&
	"code" in d &&
	typeof d.code === "string" &&
	"message" in d &&
	typeof d.message === "string" &&
	"filename" in d &&
	typeof d.filename === "string";

const lint = async (): Promise<{ diags: Diag[]; files: number }> => {
	const out = await run([...OXLINT, "-f", "json", TMP]);
	const start = out.indexOf('{ "diagnostics"');
	if (start === -1) {
		console.error(out);
		throw new Error("oxlint gave no JSON report.");
	}
	const parsed: unknown = JSON.parse(out.slice(start));
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		!("diagnostics" in parsed) ||
		!("number_of_files" in parsed)
	) {
		throw new TypeError("oxlint gave a JSON report of an unknown shape.");
	}
	const { diagnostics, number_of_files: files } = parsed;
	if (!Array.isArray(diagnostics) || typeof files !== "number") {
		throw new TypeError("oxlint gave a JSON report of an unknown shape.");
	}
	return { diags: diagnostics.filter((d) => isDiag(d)), files };
};

const tmpFile = (b: Block) => join(TMP, `${b.id}.${b.ext}`);

const readBacks = (blocks: Block[]) =>
	Promise.all(blocks.map((b) => readFile(tmpFile(b), "utf8")));

/** Format with the repo `bun fmt` style, then indent with two spaces per tab: the markdown keeps its code blocks in spaces. */
const format = async (blocks: Block[]) => {
	await run(["bun", "fmt", TMP]);
	const texts = await readBacks(blocks);
	await Promise.all(
		blocks.map((b, n) =>
			writeFile(
				tmpFile(b),
				(texts[n] ?? "").replaceAll(/^\t+/gmu, (tabs) =>
					"  ".repeat(tabs.length),
				),
			),
		),
	);
};

/** Write the changed blocks of one markdown file back, from the bottom up. */
const applyToFile = async (
	file: string,
	list: Block[],
	byId: Map<string, Block>,
) => {
	// Re-read: other agents edit docs.
	const text = await readFile(file, "utf8");
	const lines = text.split("\n");
	for (const b of sorted(list, (x, y) => y.line - x.line)) {
		const old = byId.get(b.id);
		if (old === undefined) {
			continue;
		}
		const cur = lines.slice(b.line - 1, b.line - 1 + old.lines);
		const want = old.code.split("\n").slice(0, -1);
		if (
			cur.map((l) => l.slice(old.indent.length)).join("\n") !== want.join("\n")
		) {
			console.error(
				`${relative(ROOT, file)}:${b.line}: changed meanwhile, not fixed`,
			);
			continue;
		}
		const repl = b.code
			.split("\n")
			.slice(0, -1)
			.map((l) => (l === "" ? l : old.indent + l));
		lines.splice(b.line - 1, old.lines, ...repl);
	}
	await writeFile(file, lines.join("\n"));
};

/** Fix the temporary files, write the changed blocks back, and give the count of changed blocks. */
const fix = async (blocks: Block[], byId: Map<string, Block>) => {
	await run([...OXLINT, "--fix", TMP]);
	await format(blocks);
	const nexts = await readBacks(blocks);
	const changed = new Map<string, Block[]>();
	let count = 0;
	for (const [n, b] of blocks.entries()) {
		const next = nexts[n] ?? b.code;
		if (next !== b.code) {
			count++;
			changed.set(b.file, [
				...(changed.get(b.file) ?? []),
				{ ...b, code: next },
			]);
			b.code = next;
		}
	}
	await Promise.all(
		[...changed].map(([file, list]) => applyToFile(file, list, byId)),
	);
	return count;
};

const place = (b: Block, line: number | undefined) =>
	`${relative(ROOT, b.file).split(sep).join("/")}:${b.line + Math.max((line ?? 1) - 1, 0)}`;

/** Report each oxlint diagnostic and each block that `bun fmt` would change. Give the problem count. */
const report = async (blocks: Block[], byId: Map<string, Block>) => {
	let problems = 0;
	const { diags: all, files } = await lint();
	const scripts = blocks.filter((b) => b.ext !== "json" && b.ext !== "jsonc");
	if (files !== scripts.length) {
		console.error(
			`oxlint processed ${files} files but ${scripts.length} script blocks were written. The gate would be a no-op.`,
		);
		process.exitCode = 1;
	}
	for (const d of all.filter((x) => !isIgnored(x.code))) {
		const b = byId.get(/(b\d{4})\./u.exec(d.filename)?.[1] ?? "");
		if (b !== undefined) {
			problems++;
			console.error(
				`${place(b, d.labels?.[0]?.span?.line)}: ${d.code}: ${d.message.split("\n")[0]}`,
			);
		}
	}
	await format(blocks);
	const nexts = await readBacks(blocks);
	for (const [n, b] of blocks.entries()) {
		if (nexts[n] !== b.code) {
			problems++;
			console.error(`${place(b, 1)}: bun fmt: needs formatting`);
		}
	}
	return problems;
};

const main = async () => {
	const fixing = process.argv.includes("--fix");
	// --self-test DIR: scan DIR instead of docs/ (to prove the gate catches errors).
	const stIdx = process.argv.indexOf("--self-test");
	const scanRoot = stIdx === -1 ? DOCS : (process.argv[stIdx + 1] ?? DOCS);
	const counter = { n: 0 };
	const blocks: Block[] = [];
	let skipped = 0;
	const found = await walk(scanRoot);
	const files = sortedStrings(found);
	const texts = await Promise.all(files.map((f) => readFile(f, "utf8")));
	for (const [n, file] of files.entries()) {
		const r = findBlocks(file, texts[n] ?? "", counter);
		blocks.push(...r.blocks);
		skipped += r.skipped;
	}
	await rm(TMP, { recursive: true, force: true });
	await mkdir(TMP, { recursive: true });
	try {
		await Promise.all(blocks.map((b) => writeFile(tmpFile(b), b.code)));
		const byId = new Map(blocks.map((b) => [b.id, b]));
		const fixed = fixing ? await fix(blocks, byId) : 0;
		const problems = await report(blocks, byId);
		console.info(
			`Checked ${blocks.length} example blocks (${skipped} skipped with ${SKIP_MARKER}${fixing ? `, ${fixed} fixed` : ""}).`,
		);
		if (problems > 0) {
			console.error(`${problems} problem(s) in examples.`);
			process.exitCode = 1;
		}
	} finally {
		await rm(TMP, { recursive: true, force: true });
	}
};

await main();
